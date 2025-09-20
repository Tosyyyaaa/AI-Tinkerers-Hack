#!/usr/bin/env python3

import asyncio
import os
import logging
import json
from typing import Dict, Any
import aiohttp
try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent, CallToolResult, ListToolsResult
except ImportError:
    # Fallback for different MCP package structures
    try:
        from mcp import Server, Tool, TextContent, CallToolResult, ListToolsResult
    except ImportError:
        print("⚠️ MCP package not found. Please install with: pip install model-context-protocol")
        exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Weather condition mapping to buckets
WEATHER_CONDITION_TO_BUCKET = {
    # Clear sky
    800: "sunny",

    # Clouds
    801: "cloudy",  # few clouds
    802: "cloudy",  # scattered clouds
    803: "cloudy",  # broken clouds
    804: "cloudy",  # overcast clouds

    # Rain
    500: "rainy",  # light rain
    501: "rainy",  # moderate rain
    502: "rainy",  # heavy intensity rain
    503: "rainy",  # very heavy rain
    504: "rainy",  # extreme rain
    511: "rainy",  # freezing rain
    520: "rainy",  # light intensity shower rain
    521: "rainy",  # shower rain
    522: "rainy",  # heavy intensity shower rain
    531: "rainy",  # ragged shower rain

    # Drizzle
    300: "rainy",
    301: "rainy",
    302: "rainy",
    310: "rainy",
    311: "rainy",
    312: "rainy",
    313: "rainy",
    314: "rainy",
    321: "rainy",

    # Thunderstorm
    200: "rainy",
    201: "rainy",
    202: "rainy",
    210: "rainy",
    211: "rainy",
    212: "rainy",
    221: "rainy",
    230: "rainy",
    231: "rainy",
    232: "rainy",

    # Snow
    600: "cloudy",  # treat snow as cloudy
    601: "cloudy",
    602: "cloudy",
    611: "cloudy",
    612: "cloudy",
    613: "cloudy",
    615: "cloudy",
    616: "cloudy",
    620: "cloudy",
    621: "cloudy",
    622: "cloudy",

    # Atmosphere (fog, haze, etc.)
    701: "cloudy",  # mist
    711: "cloudy",  # smoke
    721: "cloudy",  # haze
    731: "windy",   # sand/dust whirls
    741: "cloudy",  # fog
    751: "windy",   # sand
    761: "windy",   # dust
    762: "cloudy",  # volcanic ash
    771: "windy",   # squalls
    781: "windy",   # tornado
}

class WeatherMCPServer:
    def __init__(self):
        self.server = Server("weather-mcp-server")
        self.api_key = os.getenv("OPENWEATHER_API_KEY")

        if not self.api_key:
            logger.warning("OPENWEATHER_API_KEY not found. Weather data will be mocked.")

        # Register tools
        self.server.list_tools = self.list_tools
        self.server.call_tool = self.call_tool

    async def list_tools(self) -> ListToolsResult:
        """List available tools"""
        tools = [
            Tool(
                name="get_weather",
                description="Get current weather for a city and return a weather bucket (sunny/cloudy/rainy/windy/night)",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "City name (e.g., 'London', 'New York', 'Tokyo')"
                        }
                    },
                    "required": ["city"]
                }
            )
        ]
        return ListToolsResult(tools=tools)

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> CallToolResult:
        """Handle tool calls"""
        if name == "get_weather":
            return await self._get_weather(arguments)
        else:
            raise ValueError(f"Unknown tool: {name}")

    async def _get_weather(self, arguments: Dict[str, Any]) -> CallToolResult:
        """Get weather data and return bucket"""
        try:
            city = arguments.get("city")
            if not city:
                return CallToolResult(
                    content=[TextContent(type="text", text="City parameter is required")],
                    isError=True
                )

            weather_bucket = await self._fetch_weather_bucket(city)

            return CallToolResult(
                content=[TextContent(
                    type="text",
                    text=json.dumps({"bucket": weather_bucket})
                )],
                isError=False
            )

        except Exception as e:
            logger.error(f"Error getting weather: {e}")
            return CallToolResult(
                content=[TextContent(type="text", text=f"Error getting weather: {str(e)}")],
                isError=True
            )

    async def _fetch_weather_bucket(self, city: str) -> str:
        """Fetch weather data from OpenWeather API and return bucket"""
        if not self.api_key:
            # Mock data for development
            logger.info(f"Mocking weather data for {city}")
            return "sunny"

        try:
            url = f"https://api.openweathermap.org/data/2.5/weather"
            params = {
                "q": city,
                "appid": self.api_key,
                "units": "metric"
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        logger.error(f"OpenWeather API error: {response.status}")
                        return "cloudy"  # Default fallback

                    data = await response.json()

                    # Extract weather condition
                    weather_id = data["weather"][0]["id"]

                    # Check if it's nighttime
                    current_time = data["dt"]
                    sunrise = data["sys"]["sunrise"]
                    sunset = data["sys"]["sunset"]

                    if current_time < sunrise or current_time > sunset:
                        return "night"

                    # Check wind speed (if very windy, prioritize that)
                    wind_speed = data.get("wind", {}).get("speed", 0)
                    if wind_speed > 10:  # 10 m/s is quite windy
                        return "windy"

                    # Map weather condition to bucket
                    return WEATHER_CONDITION_TO_BUCKET.get(weather_id, "cloudy")

        except Exception as e:
            logger.error(f"Error fetching weather: {e}")
            return "cloudy"  # Default fallback

    async def run(self):
        """Run the MCP server"""
        logger.info("Starting Weather MCP Server...")

        # Get stdin/stdout for MCP communication
        async with self.server.stdio() as (read_stream, write_stream):
            await self.server.run(read_stream, write_stream)

async def main():
    """Main entry point"""
    server = WeatherMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())