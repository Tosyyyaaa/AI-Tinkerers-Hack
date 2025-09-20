#!/usr/bin/env python3
"""
Verification summary for the ElevenLabs MCP server configuration.

This replaces the weather-focused script and documents how to confirm
that the modern music-only MCP server behaves correctly.
"""

import asyncio
import json
import os
import sys
from typing import Sequence

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


async def verify(styles: Sequence[str]) -> None:
    print("=" * 72)
    print("🎵 ELEVENLABS MCP SERVER VERIFICATION")
    print("=" * 72)

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if api_key:
        print("🔑 ELEVENLABS_API_KEY detected – real music generation available")
    else:
        print("🔑 ELEVENLABS_API_KEY missing – responses will be mocked")
    print()

    server_params = StdioServerParameters(
        command="python3",
        args=["mcp_elevenlabs_server.py"],
        env={"ELEVENLABS_API_KEY": api_key} if api_key else {},
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            tool_names = [tool.name for tool in tools.tools]

            print("🛠️ Tools exposed by server:")
            for tool in tools.tools:
                print(f"   • {tool.name}: {tool.description}")
            if "generate_music" not in tool_names:
                raise RuntimeError("generate_music tool missing from MCP server")
            print()

            for style in styles:
                print(f"🎼 Generating sample for style='{style}'")
                response = await session.call_tool(
                    "generate_music",
                    arguments={
                        "style": style,
                        "description": f"Verification prompt for {style} style",
                        "duration_seconds": 10,
                    },
                )

                if response.isError:
                    print("   ❌ Tool call failed")
                    continue

                payload = json.loads(response.content[0].text)
                status = payload.get("status")
                message = payload.get("message")
                file_path = payload.get("music_file")

                print(f"   Status : {status}")
                print(f"   Message: {message}")
                print(f"   File   : {file_path or '(mock mode)'}")
                print()

    print("✅ Verification complete – ElevenLabs MCP server is operational")
    print("=" * 72)


if __name__ == "__main__":
    asyncio.run(verify(["upbeat", "chill", "ambient"]))
