#!/usr/bin/env python3
"""
Direct test of OpenWeather API with the provided key
"""

import asyncio
import aiohttp
import json

async def test_openweather_api():
    """Test the OpenWeather API directly"""
    api_key = "30b48e2a83906c4bcd018b7ef2e7549c"

    print("🌤️ Testing OpenWeather API directly")
    print(f"API Key: {api_key}")
    print()

    # Test a simple API call
    url = "https://api.openweathermap.org/data/2.5/weather"

    test_cities = ["London", "New York", "Tokyo"]

    for city in test_cities:
        print(f"Testing {city}...")

        params = {
            "q": city,
            "appid": api_key,
            "units": "metric"
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    print(f"  Status Code: {response.status}")

                    if response.status == 200:
                        data = await response.json()
                        weather = data["weather"][0]
                        main = data["main"]
                        wind = data.get("wind", {})

                        print(f"  ✅ Success!")
                        print(f"     Weather: {weather['main']} - {weather['description']}")
                        print(f"     Temperature: {main['temp']}°C")
                        print(f"     Wind Speed: {wind.get('speed', 0)} m/s")
                        print(f"     Weather ID: {weather['id']}")

                        # Show our bucket mapping
                        weather_id = weather['id']
                        if weather_id == 800:
                            bucket = "sunny"
                        elif weather_id in [801, 802, 803, 804]:
                            bucket = "cloudy"
                        elif weather_id in range(500, 600):
                            bucket = "rainy"
                        elif wind.get('speed', 0) > 10:
                            bucket = "windy"
                        else:
                            bucket = "cloudy"

                        print(f"     🎵 Music Bucket: {bucket}")

                    else:
                        error_text = await response.text()
                        print(f"  ❌ Error: {response.status}")
                        print(f"     Response: {error_text}")

        except Exception as e:
            print(f"  💥 Exception: {e}")

        print()

if __name__ == "__main__":
    asyncio.run(test_openweather_api())