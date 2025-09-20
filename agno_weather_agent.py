#!/usr/bin/env python3

import asyncio
import os
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from phi.agent import Agent
from phi.model.openrouter import OpenRouter
from phi.tools.mcp import MCPTools

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global MCP tools instance
mcp_tools: Optional[MCPTools] = None

class WeatherResponse(BaseModel):
    city: str
    bucket: str
    message: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage MCP connection lifecycle inside a FastAPI app"""
    global mcp_tools

    try:
        # Startup: connect to our MCP server
        script_dir = Path(__file__).parent
        server_path = script_dir / "mcp_weather_server.py"

        logger.info(f"Starting MCP server from: {server_path}")

        # Initialize MCP tools with our weather server
        mcp_tools = MCPTools(command=f"python {server_path}")
        await mcp_tools.connect()
        logger.info("MCP Weather Server connected successfully")

        # Add the MCP tools to our agent
        agent.tools = [mcp_tools]
        logger.info("Agent configured with MCP tools")

        yield

    except Exception as e:
        logger.error(f"Failed to start MCP server: {e}")
        raise
    finally:
        # Shutdown: Close MCP connection
        if mcp_tools:
            try:
                await mcp_tools.close()
                logger.info("MCP connection closed")
            except Exception as e:
                logger.error(f"Error closing MCP connection: {e}")

# Create the agent with environment-aware music instructions
agent = Agent(
    name="Environment-Aware Music Agent",
    instructions="""
You manage environment-aware music recommendations. Your role is to:

1. Use the weather tool to fetch current weather conditions for the requested city
2. Return the weather bucket (sunny/cloudy/rainy/windy/night)
3. Provide a brief, friendly response about the weather bucket

Your only tool is weather data. When asked about weather:
- Call the get_weather tool with the city name
- Extract the bucket from the response
- Return the bucket with a short description

Keep responses concise and focused on the weather bucket result.
Example: "The weather bucket for London is 'cloudy' - perfect for some chill ambient music!"
""",
    model=OpenRouter(id="deepseek/deepseek-chat-v3.1"),  # Using DeepSeek via OpenRouter
    markdown=False,
    show_tool_calls=False,
)

# Initialize FastAPI app
app = FastAPI(
    title="Weather MCP Agent API",
    description="Environment-aware music agent using MCP weather tools",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_model=dict)
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Weather MCP Agent API",
        "description": "Environment-aware music agent using MCP weather tools",
        "version": "1.0.0",
        "endpoints": {
            "/weather": "Get weather bucket for a city",
            "/health": "Health check"
        },
        "example": "/weather?city=London"
    }

@app.get("/health", response_model=dict)
async def health_check():
    """Health check endpoint"""
    mcp_status = "connected" if mcp_tools else "disconnected"
    return {
        "status": "healthy",
        "mcp_server": mcp_status,
        "agent": "ready"
    }

@app.get("/weather", response_model=WeatherResponse)
async def get_weather(city: str = Query(..., description="City name to get weather for", example="London")):
    """
    Get weather bucket for a city using the MCP weather agent

    Args:
        city: City name (e.g., 'London', 'New York', 'Tokyo')

    Returns:
        WeatherResponse with city, bucket, and message
    """
    if not mcp_tools:
        raise HTTPException(status_code=503, detail="MCP server not available")

    try:
        logger.info(f"Getting weather for city: {city}")

        # Run the agent to get weather
        response = await agent.arun(f"Get the weather bucket for {city}")

        # Extract bucket from agent response
        # The agent should return something like "The weather bucket for London is 'cloudy'"
        response_text = response.content

        # Try to extract bucket from response
        bucket = None
        for potential_bucket in ["sunny", "cloudy", "rainy", "windy", "night"]:
            if potential_bucket in response_text.lower():
                bucket = potential_bucket
                break

        if not bucket:
            # Fallback: try to parse JSON from response if agent returns structured data
            try:
                # Look for JSON in the response
                import re
                json_match = re.search(r'\{[^}]*"bucket"[^}]*\}', response_text)
                if json_match:
                    json_data = json.loads(json_match.group())
                    bucket = json_data.get("bucket", "cloudy")
            except:
                bucket = "cloudy"  # Default fallback

        return WeatherResponse(
            city=city,
            bucket=bucket,
            message=response_text
        )

    except Exception as e:
        logger.error(f"Error getting weather for {city}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get weather: {str(e)}")

if __name__ == "__main__":
    import uvicorn

    # Check if OpenRouter API key is available
    if not os.getenv("OPENROUTER_API_KEY"):
        logger.warning("OPENROUTER_API_KEY not found. Please set it for the agent to work.")

    logger.info("Starting Weather MCP Agent API...")
    uvicorn.run(
        "agno_weather_agent:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )