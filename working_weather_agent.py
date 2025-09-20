#!/usr/bin/env python3
"""
Working Weather Agent with OpenRouter + DeepSeek
Bypasses MCP issues and uses direct HTTP calls for demonstration
"""

import asyncio
import os
import json
import logging
import aiohttp
from datetime import datetime
from typing import Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from phi.agent import Agent
from phi.model.openrouter import OpenRouter

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Weather condition mapping to buckets (same as our MCP server)
WEATHER_CONDITION_TO_BUCKET = {
    800: "sunny", 801: "cloudy", 802: "cloudy", 803: "cloudy", 804: "cloudy",
    500: "rainy", 501: "rainy", 502: "rainy", 503: "rainy", 504: "rainy",
    511: "rainy", 520: "rainy", 521: "rainy", 522: "rainy", 531: "rainy",
    300: "rainy", 301: "rainy", 302: "rainy", 310: "rainy", 311: "rainy",
    312: "rainy", 313: "rainy", 314: "rainy", 321: "rainy",
    200: "rainy", 201: "rainy", 202: "rainy", 210: "rainy", 211: "rainy",
    212: "rainy", 221: "rainy", 230: "rainy", 231: "rainy", 232: "rainy",
    600: "cloudy", 601: "cloudy", 602: "cloudy", 611: "cloudy", 612: "cloudy",
    613: "cloudy", 615: "cloudy", 616: "cloudy", 620: "cloudy", 621: "cloudy", 622: "cloudy",
    701: "cloudy", 711: "cloudy", 721: "cloudy", 731: "windy", 741: "cloudy",
    751: "windy", 761: "windy", 762: "cloudy", 771: "windy", 781: "windy",
}

class WeatherResponse(BaseModel):
    city: str
    bucket: str
    message: str
    temperature: float
    description: str

# Global agent instance
weather_agent: Agent = None

async def get_weather_bucket(city: str) -> Dict[str, Any]:
    """Get weather data and return bucket"""
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if not api_key:
        logger.warning("No OpenWeather API key, using mock data")
        return {
            "bucket": "sunny",
            "temperature": 20.0,
            "description": "clear sky",
            "error": None
        }

    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": city, "appid": api_key, "units": "metric"}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    logger.error(f"OpenWeather API error: {response.status}")
                    return {
                        "bucket": "cloudy",
                        "temperature": 15.0,
                        "description": "unknown conditions",
                        "error": f"API Error: {response.status}"
                    }

                data = await response.json()

                # Extract weather information
                weather = data["weather"][0]
                main = data["main"]
                wind = data.get("wind", {})
                sys = data["sys"]

                # Apply our bucket logic
                weather_id = weather["id"]
                current_time = data["dt"]
                sunrise = sys.get("sunrise", 0)
                sunset = sys.get("sunset", 0)

                # Check if it's nighttime
                if current_time < sunrise or current_time > sunset:
                    bucket = "night"
                else:
                    # Check wind speed
                    wind_speed = wind.get("speed", 0)
                    if wind_speed > 10:
                        bucket = "windy"
                    else:
                        bucket = WEATHER_CONDITION_TO_BUCKET.get(weather_id, "cloudy")

                return {
                    "bucket": bucket,
                    "temperature": main["temp"],
                    "description": weather["description"],
                    "error": None
                }

    except Exception as e:
        logger.error(f"Error fetching weather: {e}")
        return {
            "bucket": "cloudy",
            "temperature": 15.0,
            "description": "unknown conditions",
            "error": str(e)
        }

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the agent on startup"""
    global weather_agent

    try:
        # Initialize the DeepSeek agent via OpenRouter
        logger.info("Initializing DeepSeek agent via OpenRouter...")

        weather_agent = Agent(
            name="Environment-Aware Music Agent",
            model=OpenRouter(
                id="deepseek/deepseek-chat-v3.1",
                api_key=os.getenv("OPENROUTER_API_KEY")
            ),
            instructions="""
You are an environment-aware music recommendation agent. Your role is to:

1. Analyze weather conditions and return appropriate weather buckets
2. Provide brief, friendly responses about music recommendations
3. Keep responses concise and focused on the weather bucket result

Weather buckets:
- sunny: Clear skies → Upbeat, energetic music
- cloudy: Overcast → Chill ambient vibes
- rainy: Rain/storms → Cozy jazz & introspective tunes
- windy: Strong winds → Dynamic, powerful music
- night: Nighttime → Calm atmospheric sounds

Example response: "The weather bucket for London is 'cloudy' ☁️ - perfect for some chill ambient music!"
""",
            markdown=False,
        )

        logger.info("✅ DeepSeek agent initialized successfully!")
        yield

    except Exception as e:
        logger.error(f"Failed to initialize agent: {e}")
        yield
    finally:
        logger.info("Shutting down weather agent...")

# Initialize FastAPI app
app = FastAPI(
    title="Weather MCP Agent with DeepSeek",
    description="Environment-aware music agent using OpenRouter + DeepSeek v3.1",
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
        "name": "Weather MCP Agent with DeepSeek",
        "description": "Environment-aware music agent using OpenRouter + DeepSeek v3.1",
        "version": "1.0.0",
        "model": "deepseek/deepseek-chat-v3.1",
        "endpoints": {
            "/weather": "Get weather bucket for a city",
            "/health": "Health check"
        },
        "example": "/weather?city=London"
    }

@app.get("/health", response_model=dict)
async def health_check():
    """Health check endpoint"""
    agent_status = "ready" if weather_agent else "not initialized"

    return {
        "status": "healthy",
        "agent": agent_status,
        "model": "deepseek/deepseek-chat-v3.1",
        "weather_api": "connected" if os.getenv("OPENWEATHER_API_KEY") else "mock",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/weather", response_model=WeatherResponse)
async def get_weather(city: str = Query(..., description="City name to get weather for", example="London")):
    """
    Get weather bucket for a city using DeepSeek agent

    Args:
        city: City name (e.g., 'London', 'New York', 'Tokyo')

    Returns:
        WeatherResponse with city, bucket, message, temperature, and description
    """
    if not weather_agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        logger.info(f"Getting weather for city: {city}")

        # Get weather data
        weather_data = await get_weather_bucket(city)
        bucket = weather_data["bucket"]
        temperature = weather_data["temperature"]
        description = weather_data["description"]

        # Create a detailed prompt for the agent
        agent_prompt = f"""
The weather data for {city}:
- Weather bucket: {bucket}
- Temperature: {temperature}°C
- Description: {description}

Please provide a brief, friendly response about this weather bucket and music recommendations.
"""

        # Run the DeepSeek agent
        logger.info("Running DeepSeek agent...")
        response = weather_agent.run(agent_prompt)

        # Extract the response content
        response_text = response.content if hasattr(response, 'content') else str(response)

        return WeatherResponse(
            city=city,
            bucket=bucket,
            message=response_text,
            temperature=temperature,
            description=description
        )

    except Exception as e:
        logger.error(f"Error processing weather request for {city}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process weather request: {str(e)}")

if __name__ == "__main__":
    import uvicorn

    # Check API keys
    openweather_key = os.getenv("OPENWEATHER_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    if not openrouter_key:
        logger.error("OPENROUTER_API_KEY not found! Please set it in .env")
        exit(1)

    if not openweather_key:
        logger.warning("OPENWEATHER_API_KEY not found. Using mock weather data.")

    logger.info("🚀 Starting Weather Agent with DeepSeek v3.1...")
    logger.info(f"🤖 Model: deepseek/deepseek-chat-v3.1 via OpenRouter")
    logger.info(f"🌤️ Weather API: {'Connected' if openweather_key else 'Mock data'}")

    uvicorn.run(
        "working_weather_agent:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )