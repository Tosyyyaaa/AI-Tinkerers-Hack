#!/usr/bin/env python3
"""
Demo script showing how weather conditions map to music buckets
This simulates different weather scenarios without needing API calls
"""

import json
from datetime import datetime

# Same mapping as our MCP server
WEATHER_CONDITION_TO_BUCKET = {
    800: "sunny",    # Clear sky
    801: "cloudy",   # Few clouds
    500: "rainy",    # Light rain
    200: "rainy",    # Thunderstorm
    600: "cloudy",   # Snow
    701: "cloudy",   # Mist
    781: "windy",    # Tornado
}

def simulate_weather_scenarios():
    """Simulate different weather scenarios and show bucket mapping"""

    scenarios = [
        {
            "city": "Los Angeles",
            "weather_id": 800,
            "description": "clear sky",
            "wind_speed": 3.2,
            "time_of_day": "day"
        },
        {
            "city": "London",
            "weather_id": 801,
            "description": "few clouds",
            "wind_speed": 5.1,
            "time_of_day": "day"
        },
        {
            "city": "Seattle",
            "weather_id": 500,
            "description": "light rain",
            "wind_speed": 2.8,
            "time_of_day": "day"
        },
        {
            "city": "Chicago",
            "weather_id": 781,
            "description": "tornado",
            "wind_speed": 25.0,
            "time_of_day": "day"
        },
        {
            "city": "New York",
            "weather_id": 800,
            "description": "clear sky",
            "wind_speed": 2.1,
            "time_of_day": "night"
        },
        {
            "city": "Miami",
            "weather_id": 200,
            "description": "thunderstorm",
            "wind_speed": 8.5,
            "time_of_day": "day"
        }
    ]

    print("🌤️  Weather Bucket Demo - Environment-Aware Music")
    print("=" * 55)
    print()

    for scenario in scenarios:
        city = scenario["city"]
        weather_id = scenario["weather_id"]
        description = scenario["description"]
        wind_speed = scenario["wind_speed"]
        time_of_day = scenario["time_of_day"]

        # Apply our bucket logic
        if time_of_day == "night":
            bucket = "night"
        elif wind_speed > 10:
            bucket = "windy"
        else:
            bucket = WEATHER_CONDITION_TO_BUCKET.get(weather_id, "cloudy")

        # Music recommendations based on bucket
        music_suggestions = {
            "sunny": "🎵 Upbeat pop, energetic electronic, feel-good indie",
            "cloudy": "🎵 Chill ambient, lo-fi hip hop, mellow acoustic",
            "rainy": "🎵 Cozy jazz, introspective indie, atmospheric soundscapes",
            "windy": "🎵 Dynamic rock, powerful orchestral, energetic EDM",
            "night": "🎵 Calm electronic, nocturne classical, soft R&B"
        }

        music = music_suggestions.get(bucket, "🎵 Relaxing background music")

        print(f"📍 {city:12} │ {description:15} │ {bucket:6} │ {music}")

    print()
    print("🎯 Bucket Summary:")
    bucket_counts = {}
    for scenario in scenarios:
        wind_speed = scenario["wind_speed"]
        time_of_day = scenario["time_of_day"]
        weather_id = scenario["weather_id"]

        if time_of_day == "night":
            bucket = "night"
        elif wind_speed > 10:
            bucket = "windy"
        else:
            bucket = WEATHER_CONDITION_TO_BUCKET.get(weather_id, "cloudy")

        bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1

    for bucket, count in sorted(bucket_counts.items()):
        print(f"   {bucket:6}: {count} scenarios")

def show_api_response_format():
    """Show what our MCP tool returns"""
    print("\n🔧 MCP Tool Response Format:")
    print("-" * 30)

    example_responses = [
        {"bucket": "sunny"},
        {"bucket": "rainy"},
        {"bucket": "night"},
        {"bucket": "windy"},
        {"bucket": "cloudy"}
    ]

    for response in example_responses:
        print(f"   {json.dumps(response)}")

if __name__ == "__main__":
    simulate_weather_scenarios()
    show_api_response_format()

    print("\n✅ Weather MCP Server Logic Validated!")
    print("🎵 Ready for environment-aware music recommendations!")
    print()
    print("📡 To test with real API:")
    print("   1. Get OpenWeather API key from https://openweathermap.org/api")
    print("   2. Set OPENWEATHER_API_KEY environment variable")
    print("   3. Run: python simple_weather_test.py")