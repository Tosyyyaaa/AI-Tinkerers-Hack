#!/usr/bin/env python3
"""
Simple test script to verify the weather MCP server works
Run this to test the MCP server directly without the full Agno setup
"""

import asyncio
import json
import os
from mcp_weather_server import WeatherMCPServer

async def test_weather_server():
    """Test the weather server directly"""
    print("🧪 Testing Weather MCP Server...")

    server = WeatherMCPServer()

    # Test list tools
    print("\n📋 Testing list_tools...")
    tools_result = await server.list_tools()
    print(f"Available tools: {len(tools_result.tools)}")
    for tool in tools_result.tools:
        print(f"  - {tool.name}: {tool.description}")

    # Test weather call
    print("\n🌤️  Testing get_weather tool...")
    test_cities = ["London", "New York", "Tokyo", "InvalidCity123"]

    for city in test_cities:
        print(f"\nTesting city: {city}")
        try:
            result = await server.call_tool("get_weather", {"city": city})
            if result.isError:
                print(f"  ❌ Error: {result.content[0].text}")
            else:
                response_data = json.loads(result.content[0].text)
                bucket = response_data.get("bucket", "unknown")
                print(f"  ✅ Bucket: {bucket}")
        except Exception as e:
            print(f"  💥 Exception: {e}")

    print("\n✨ Weather MCP Server test completed!")

async def test_api_integration():
    """Test that we can mock the OpenWeather API response"""
    print("\n🌍 Testing OpenWeather API integration...")

    api_key = os.getenv("OPENWEATHER_API_KEY")
    if api_key:
        print(f"  ✅ API key found: {api_key[:10]}...")
    else:
        print("  ⚠️  No API key found - will use mock data")

    # Test actual weather fetching
    server = WeatherMCPServer()
    bucket = await server._fetch_weather_bucket("London")
    print(f"  Weather bucket for London: {bucket}")

if __name__ == "__main__":
    print("🚀 Weather MCP Agent Test Suite")
    print("=" * 40)

    asyncio.run(test_weather_server())
    asyncio.run(test_api_integration())