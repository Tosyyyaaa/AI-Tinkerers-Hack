#!/usr/bin/env python3
"""
Simple test to verify phidata + OpenRouter + DeepSeek setup
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_api_keys():
    """Test that API keys are properly loaded"""
    print("🔑 API Key Status:")

    openweather_key = os.getenv("OPENWEATHER_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    print(f"   OPENWEATHER_API_KEY: {'✅ Set' if openweather_key else '❌ Missing'}")
    print(f"   OPENROUTER_API_KEY:  {'✅ Set' if openrouter_key else '❌ Missing'}")

    if openweather_key:
        print(f"   OpenWeather key: {openweather_key[:10]}...")
    if openrouter_key:
        print(f"   OpenRouter key: {openrouter_key[:15]}...")

def test_phidata_imports():
    """Test phidata imports"""
    print("\n📦 Testing phidata imports:")

    try:
        from phi.agent import Agent
        print("   ✅ phi.agent.Agent imported successfully")
    except ImportError as e:
        print(f"   ❌ Failed to import Agent: {e}")

    try:
        from phi.model.openrouter import OpenRouter
        print("   ✅ phi.model.openrouter.OpenRouter imported successfully")
    except ImportError as e:
        print(f"   ❌ Failed to import OpenRouter: {e}")
        # Try alternative import path
        try:
            from phi.model.openai import OpenAI
            print("   ℹ️  OpenAI model available as fallback")
        except ImportError:
            print("   ❌ No model imports available")

def test_simple_agent():
    """Test creating a simple agent"""
    print("\n🤖 Testing simple agent creation:")

    try:
        from phi.agent import Agent

        # Try to create a simple agent without OpenRouter first
        agent = Agent(
            name="Test Agent",
            instructions="You are a test agent. Respond with 'Hello from phidata!'",
        )
        print("   ✅ Basic agent created successfully")

        # Test if we can set up OpenRouter
        try:
            # Check if OpenRouter is available
            from phi.model.openrouter import OpenRouter

            openrouter_model = OpenRouter(
                id="deepseek/deepseek-chat-v3.1",
                api_key=os.getenv("OPENROUTER_API_KEY")
            )

            agent_with_openrouter = Agent(
                name="Weather Agent",
                model=openrouter_model,
                instructions="You manage environment-aware music recommendations.",
            )
            print("   ✅ Agent with OpenRouter + DeepSeek created successfully")

        except ImportError:
            print("   ⚠️  OpenRouter not available, will use default model")
        except Exception as e:
            print(f"   ❌ Error setting up OpenRouter: {e}")

    except ImportError as e:
        print(f"   ❌ Failed to create agent: {e}")

def show_next_steps():
    """Show next steps for setup"""
    print("\n🚀 Next Steps:")
    print("   1. If imports fail, the phidata package structure may be different")
    print("   2. Check phi documentation for correct import paths")
    print("   3. We can create a simpler version without full MCP integration")
    print("   4. Or use direct HTTP calls to OpenRouter API")

if __name__ == "__main__":
    print("🧪 Phidata + OpenRouter + DeepSeek Test")
    print("=" * 40)

    test_api_keys()
    test_phidata_imports()
    test_simple_agent()
    show_next_steps()

    print("\n✨ Test complete!")