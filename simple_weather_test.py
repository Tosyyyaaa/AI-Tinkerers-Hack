#!/usr/bin/env python3
"""
Simplified weather server test that doesn't require MCP packages
This demonstrates the core weather logic and API integration
"""

import asyncio
import json
import os
import aiohttp
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Weather condition mapping to buckets (same as in MCP server)
WEATHER_CONDITION_TO_BUCKET = {
    # Clear sky
    800: "sunny",
    # Clouds
    801: "cloudy", 802: "cloudy", 803: "cloudy", 804: "cloudy",
    # Rain
    500: "rainy", 501: "rainy", 502: "rainy", 503: "rainy", 504: "rainy",
    511: "rainy", 520: "rainy", 521: "rainy", 522: "rainy", 531: "rainy",
    # Drizzle
    300: "rainy", 301: "rainy", 302: "rainy", 310: "rainy", 311: "rainy",
    312: "rainy", 313: "rainy", 314: "rainy", 321: "rainy",
    # Thunderstorm
    200: "rainy", 201: "rainy", 202: "rainy", 210: "rainy", 211: "rainy",
    212: "rainy", 221: "rainy", 230: "rainy", 231: "rainy", 232: "rainy",
    # Snow (treated as cloudy)
    600: "cloudy", 601: "cloudy", 602: "cloudy", 611: "cloudy", 612: "cloudy",
    613: "cloudy", 615: "cloudy", 616: "cloudy", 620: "cloudy", 621: "cloudy", 622: "cloudy",
    # Atmosphere
    701: "cloudy", 711: "cloudy", 721: "cloudy", 731: "windy", 741: "cloudy",
    751: "windy", 761: "windy", 762: "cloudy", 771: "windy", 781: "windy",
}

async def get_weather_bucket(city: str, api_key: str = None) -> str:
    """Get weather bucket for a city"""
    if not api_key:
        logger.info(f"No API key - returning mock data for {city}")
        return "sunny"

    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": city, "appid": api_key, "units": "metric"}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    logger.error(f"OpenWeather API error: {response.status}")
                    return "cloudy"

                data = await response.json()

                # Extract weather condition
                weather_id = data["weather"][0]["id"]

                # Check if it's nighttime
                current_time = data["dt"]
                sunrise = data["sys"]["sunrise"]
                sunset = data["sys"]["sunset"]

                if current_time < sunrise or current_time > sunset:
                    return "night"

                # Check wind speed
                wind_speed = data.get("wind", {}).get("speed", 0)
                if wind_speed > 10:  # Very windy
                    return "windy"

                # Map weather condition to bucket
                bucket = WEATHER_CONDITION_TO_BUCKET.get(weather_id, "cloudy")

                logger.info(f"Weather for {city}: condition={weather_id}, bucket={bucket}")
                return bucket

    except Exception as e:
        logger.error(f"Error fetching weather for {city}: {e}")
        return "cloudy"

async def test_weather_logic():
    """Test the weather bucket logic"""
    print("🧪 Testing Weather Bucket Logic")
    print("=" * 40)

    # Load API key from environment
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if api_key:
        print(f"✅ Using OpenWeather API key: {api_key[:10]}...")
    else:
        print("⚠️  No API key found - using mock data")

    # Test cities
    test_cities = ["London", "New York", "Tokyo", "Sydney", "Paris"]

    print(f"\n🌍 Testing {len(test_cities)} cities:")

    for city in test_cities:
        try:
            bucket = await get_weather_bucket(city, api_key)
            print(f"  {city:12} → {bucket}")
        except Exception as e:
            print(f"  {city:12} → ERROR: {e}")

    print("\n✨ Weather bucket test completed!")

def test_weather_mapping():
    """Test weather condition to bucket mapping"""
    print("\n📋 Testing Weather Condition Mapping:")

    test_conditions = [
        (800, "Clear sky"),
        (801, "Few clouds"),
        (500, "Light rain"),
        (200, "Thunderstorm"),
        (600, "Snow"),
        (701, "Mist"),
        (781, "Tornado"),
        (999, "Unknown condition")  # Test fallback
    ]

    for condition_id, description in test_conditions:
        bucket = WEATHER_CONDITION_TO_BUCKET.get(condition_id, "cloudy")
        print(f"  {condition_id:3} ({description:15}) → {bucket}")

if __name__ == "__main__":
    print("🚀 Simple Weather Logic Test")
    print("This tests the core weather bucket logic without MCP dependencies")
    print()

    # Test the mapping logic
    test_weather_mapping()

    # Test the async weather fetching
    asyncio.run(test_weather_logic())

    print(f"\n🎵 Weather buckets available: {sorted(set(WEATHER_CONDITION_TO_BUCKET.values()))}")
    print("Ready for environment-aware music recommendations!")