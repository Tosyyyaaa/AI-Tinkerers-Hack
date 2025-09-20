#!/usr/bin/env python3
"""
Live weather test with real API data showing complete functionality
"""

import asyncio
import aiohttp
import json
from datetime import datetime

# Same mapping as our MCP server
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

async def get_detailed_weather(city: str) -> dict:
    """Get detailed weather with bucket mapping"""
    api_key = "f8b053d609f4eb3f749d8c4bc486c1a6"

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": api_key, "units": "metric"}

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            if response.status != 200:
                return {"error": f"API Error: {response.status}"}

            data = await response.json()

            # Extract key information
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
                time_status = "night"
            else:
                time_status = "day"

                # Check wind speed
                wind_speed = wind.get("speed", 0)
                if wind_speed > 10:
                    bucket = "windy"
                else:
                    bucket = WEATHER_CONDITION_TO_BUCKET.get(weather_id, "cloudy")

            return {
                "city": city,
                "weather_id": weather_id,
                "condition": weather["main"],
                "description": weather["description"],
                "temperature": main["temp"],
                "feels_like": main["feels_like"],
                "humidity": main["humidity"],
                "wind_speed": wind.get("speed", 0),
                "wind_direction": wind.get("deg", 0),
                "time_status": time_status,
                "bucket": bucket,
                "icon": weather["icon"]
            }

async def test_live_weather():
    """Test with live weather data"""
    print("🌍 LIVE Weather MCP Agent Test")
    print("Using real OpenWeather API data!")
    print("=" * 50)

    cities = ["London", "New York", "Tokyo", "Sydney", "Mumbai", "São Paulo"]

    print(f"\n📡 Testing {len(cities)} cities with real weather data:")
    print()

    results = []
    for city in cities:
        try:
            weather_data = await get_detailed_weather(city)
            if "error" in weather_data:
                print(f"❌ {city:12}: {weather_data['error']}")
                continue

            results.append(weather_data)

            bucket = weather_data["bucket"]
            temp = weather_data["temperature"]
            desc = weather_data["description"]
            wind = weather_data["wind_speed"]
            time_status = weather_data["time_status"]

            # Music recommendation
            music_map = {
                "sunny": "🎵 Upbeat pop, energetic electronic",
                "cloudy": "🎵 Chill ambient, lo-fi hip hop",
                "rainy": "🎵 Cozy jazz, introspective indie",
                "windy": "🎵 Dynamic rock, powerful orchestral",
                "night": "🎵 Calm electronic, nocturne classical"
            }
            music = music_map.get(bucket, "🎵 Relaxing music")

            print(f"✅ {city:12}: {temp:5.1f}°C | {desc:20} | {bucket:6} | {time_status:5}")
            print(f"   Wind: {wind:4.1f}m/s | {music}")
            print()

        except Exception as e:
            print(f"💥 {city:12}: Exception - {e}")

    # Summary
    print("\n📊 Bucket Distribution:")
    bucket_counts = {}
    for result in results:
        bucket = result["bucket"]
        bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1

    for bucket, count in sorted(bucket_counts.items()):
        print(f"   {bucket:6}: {count} cities")

    # Show MCP tool responses
    print("\n🔧 MCP Tool Response Examples:")
    for result in results[:3]:  # Show first 3
        response = {"bucket": result["bucket"]}
        print(f"   get_weather('{result['city']}') → {json.dumps(response)}")

    print(f"\n✨ {len(results)} cities successfully processed!")
    print("🎵 Environment-aware music recommendations ready!")

if __name__ == "__main__":
    asyncio.run(test_live_weather())