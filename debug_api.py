#!/usr/bin/env python3
"""Debug the OpenWeather API call"""

import requests
import json

def test_with_requests():
    """Test with simple requests library"""
    api_key = "f8b053d609f4eb3f749d8c4bc486c1a6"

    print("🔍 Debugging OpenWeather API Call")
    print(f"API Key: {api_key}")
    print()

    # Try different API endpoints
    endpoints = [
        "https://api.openweathermap.org/data/2.5/weather",
        "http://api.openweathermap.org/data/2.5/weather"  # Try HTTP instead of HTTPS
    ]

    for endpoint in endpoints:
        print(f"Testing endpoint: {endpoint}")

        url = f"{endpoint}?q=London&appid={api_key}&units=metric"
        print(f"Full URL: {url}")

        try:
            response = requests.get(url, timeout=10)
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Response Text: {response.text[:500]}...")

            if response.status_code == 200:
                data = response.json()
                print("✅ SUCCESS!")
                print(f"Weather: {data['weather'][0]['main']}")
                print(f"Temperature: {data['main']['temp']}°C")
                return True

        except Exception as e:
            print(f"Exception: {e}")

        print("-" * 50)

    # Try with a test call to verify the key format
    print("\n🔑 Testing API key format...")
    print(f"Key length: {len(api_key)}")
    print(f"Key format: {'✅ Valid' if len(api_key) == 32 else '❌ Invalid (should be 32 chars)'}")

    return False

if __name__ == "__main__":
    success = test_with_requests()

    if not success:
        print("\n💡 Possible issues:")
        print("1. API key needs activation (can take up to 2 hours)")
        print("2. API key might be expired or invalid")
        print("3. Network connectivity issues")
        print("4. Rate limiting")
        print("\n🔗 Get a new free API key at: https://openweathermap.org/api")
        print("📚 API key activation info: https://openweathermap.org/faq#error401")