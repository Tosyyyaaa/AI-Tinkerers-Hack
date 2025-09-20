#!/usr/bin/env python3
"""
Interactive test for the ElevenLabs MCP server using the stdio transport.

This mirrors how AgentOS connects to the MCP server and validates that the
`generate_music` tool responds as expected.
"""

import asyncio
import json
import os
import sys

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ModuleNotFoundError as exc:  # pragma: no cover
    missing = exc.name or "mcp"
    print(f"❌ Missing dependency: {missing}")
    print("💡 Install Python requirements: pip install -r requirements.txt")
    sys.exit(1)

from dotenv import load_dotenv

load_dotenv()


async def test_mcp_server() -> None:
    """Connect to the MCP server and exercise the generate_music tool."""
    print("🧪 Testing ElevenLabs MCP Server over stdio…")

    env = {}
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if api_key:
        env["ELEVENLABS_API_KEY"] = api_key
        print("🔑 ELEVENLABS_API_KEY detected – real audio generation available")
    else:
        print("🔑 ELEVENLABS_API_KEY not set – responses will be mocked")

    server_params = StdioServerParameters(
        command="python3",
        args=["mcp_elevenlabs_server.py"],
        env=env,
    )

    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                print("🔄 Initialising MCP session…")
                await session.initialize()
                print("✅ Session initialised\n")

                print("📋 Available tools:")
                tools = await session.list_tools()
                for tool in tools.tools:
                    print(f"   • {tool.name}: {tool.description}")

                if not any(tool.name == "generate_music" for tool in tools.tools):
                    raise RuntimeError("generate_music tool missing from MCP server")

                print("\n🎼 Requesting sample track (style='chill')…")
                result = await session.call_tool(
                    "generate_music",
                    arguments={
                        "style": "chill",
                        "description": "Smooth late-night lounge soundtrack for integration test",
                        "duration_seconds": 10,
                    },
                )

                if result.isError:
                    raise RuntimeError("MCP tool call returned an error payload")

                payload = json.loads(result.content[0].text)
                status = payload.get("status", "unknown")
                message = payload.get("message", "(no message)")
                file_path = payload.get("music_file")

                print(f"   Status: {status}")
                print(f"   Message: {message}")
                if file_path:
                    print(f"   File: {file_path}")
                else:
                    print("   Mock mode – no file path available")

    finally:
        print("\n🔌 Closing MCP session")


if __name__ == "__main__":
    asyncio.run(test_mcp_server())
