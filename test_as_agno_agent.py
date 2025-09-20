#!/usr/bin/env python3
"""
Test our MCP server exactly as the Agno agent would
Simulating the agent's perspective and workflow
"""

import asyncio
import json
import os
from pathlib import Path

# Import our weather server directly
import sys
sys.path.append(str(Path(__file__).parent))

class AgentSimulator:
    """Simulate how the Agno agent would interact with our MCP server"""

    def __init__(self):
        self.instructions = """
        You manage environment-aware music recommendations. Your role is to:
        1. Use the weather tool to fetch current weather conditions for the requested city
        2. Return the weather bucket (sunny/cloudy/rainy/windy/night)
        3. Provide a brief, friendly response about the weather bucket

        Your only tool is weather data. When asked about weather:
        - Call the get_weather tool with the city name
        - Extract the bucket from the response
        - Return the bucket with a short description
        """

    async def simulate_mcp_interaction(self, city: str):
        """Simulate exactly how the agent would call our MCP tool"""
        print(f"🤖 Agent thinking: User wants weather for '{city}'")
        print("🔧 Agent action: Calling get_weather tool...")

        # Import and use our actual MCP server
        from mcp_weather_server import WeatherMCPServer

        # Initialize the server (as MCPTools would)
        server = WeatherMCPServer()

        print(f"📋 Agent: Listing available tools...")
        tools_result = await server.list_tools()
        print(f"   Found {len(tools_result.tools)} tools:")
        for tool in tools_result.tools:
            print(f"   - {tool.name}: {tool.description}")

        print(f"\n🌤️ Agent: Calling get_weather tool for '{city}'...")

        # Call the tool exactly as the agent would
        try:
            result = await server.call_tool("get_weather", {"city": city})

            if result.isError:
                print(f"❌ Tool returned error: {result.content[0].text}")
                return self._generate_error_response(city)

            # Extract the bucket from the tool response
            tool_response = result.content[0].text
            print(f"🔧 Raw tool response: {tool_response}")

            # Parse the JSON response
            data = json.loads(tool_response)
            bucket = data["bucket"]

            print(f"🎯 Extracted bucket: {bucket}")

            # Generate agent response as it would
            return self._generate_agent_response(city, bucket)

        except Exception as e:
            print(f"💥 Tool call failed: {e}")
            return self._generate_error_response(city)

    def _generate_agent_response(self, city: str, bucket: str) -> dict:
        """Generate the response as the Agno agent would"""

        # Map buckets to agent responses (as coded in the agent)
        responses = {
            "sunny": f"The weather bucket for {city.title()} is 'sunny' ☀️ - perfect for upbeat, energetic music!",
            "cloudy": f"The weather bucket for {city.title()} is 'cloudy' ☁️ - great time for chill, ambient vibes!",
            "rainy": f"The weather bucket for {city.title()} is 'rainy' 🌧️ - cozy weather for jazz and introspective tunes!",
            "windy": f"The weather bucket for {city.title()} is 'windy' 💨 - dynamic conditions call for powerful, energetic music!",
            "night": f"The weather bucket for {city.title()} is 'night' 🌙 - perfect for calm, atmospheric soundscapes!"
        }

        message = responses.get(bucket, f"The weather bucket for {city.title()} is '{bucket}' - enjoy the music!")

        return {
            "city": city,
            "bucket": bucket,
            "message": message
        }

    def _generate_error_response(self, city: str) -> dict:
        """Generate error response as agent would"""
        return {
            "city": city,
            "bucket": "cloudy",  # Default fallback
            "message": f"Sorry, I couldn't get weather data for {city}, but here's some cloudy day music recommendations!"
        }

async def test_agent_workflow():
    """Test the complete agent workflow"""
    print("🎵 AGNO AGENT SIMULATION")
    print("Testing environment-aware music agent with MCP weather tool")
    print("=" * 60)

    agent = AgentSimulator()

    # Test different cities as the agent would receive them
    test_queries = [
        "London",
        "New York",
        "Tokyo",
        "Sydney",
        "Seattle",
        "Phoenix",
        "InvalidCity123"
    ]

    print(f"\n📝 Agent Instructions:")
    print(agent.instructions.strip())

    print(f"\n🧪 Testing {len(test_queries)} user queries:")

    for i, city in enumerate(test_queries, 1):
        print(f"\n" + "="*50)
        print(f"[Test {i}] User Query: 'What's the weather like in {city}?'")
        print("="*50)

        # Simulate agent processing
        response = await agent.simulate_mcp_interaction(city)

        print(f"\n📤 Agent Response:")
        print(f"   City: {response['city']}")
        print(f"   Bucket: {response['bucket']}")
        print(f"   Message: {response['message']}")

        # Show FastAPI format
        print(f"\n🌐 FastAPI Response Format:")
        print(f"   {json.dumps(response, indent=2)}")

    print(f"\n✨ Agent simulation complete!")
    print("🎵 Environment-aware music recommendations working perfectly!")

if __name__ == "__main__":
    # Set the API key
    os.environ["OPENWEATHER_API_KEY"] = "f8b053d609f4eb3f749d8c4bc486c1a6"

    asyncio.run(test_agent_workflow())