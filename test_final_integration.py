#!/usr/bin/env python3
"""
End-to-end integration test for the ElevenLabs MCP tooling used by the
Agno AgentOS backend. This script mirrors the workflow the frontend expects:
1. Connect to the MCP server via stdio (matching AgentOS behaviour)
2. Request a short music clip for a curated list of vibe presets
3. Surface a concise summary that can be used for manual verification
"""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

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

VIBE_PRESETS = [
    ("upbeat", "High-energy party vibe with bright lighting and dense crowd."),
    ("chill", "Low-light lounge environment with relaxed motion and warm colours."),
    ("ambient", "Night-time focused workspace with minimal movement and soft audio."),
]


async def run_full_integration() -> bool:
    """Exercise the MCP server for a handful of vibe presets."""
    print("🌐 ElevenLabs MCP Final Integration Test")
    print("=" * 54)
    print()

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if api_key:
        print("🔑 ELEVENLABS_API_KEY detected – real music generation enabled")
    else:
        print("🔑 ELEVENLABS_API_KEY missing – running in mock response mode")
    print()

    server_params = StdioServerParameters(
        command="python3",
        args=["mcp_elevenlabs_server.py"],
        env={"ELEVENLABS_API_KEY": api_key} if api_key else {},
    )

    success = True

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            print("🛠️ Discovering tools…")
            tools = await session.list_tools()
            tool_names = [tool.name for tool in tools.tools]
            print(f"   Tools available: {tool_names}\n")

            if "generate_music" not in tool_names:
                raise RuntimeError("generate_music tool not exposed by MCP server")

            for style, description in VIBE_PRESETS:
                print(f"🎛️  Vibe preset → {style}")
                print(f"   Description : {description}")
                start = time.time()
                result = await session.call_tool(
                    "generate_music",
                    arguments={
                        "style": style,
                        "description": description,
                        "duration_seconds": 12,
                    },
                )
                duration = time.time() - start

                if result.isError:
                    print("   ❌ Tool returned error payload")
                    success = False
                    continue

                payload = json.loads(result.content[0].text)
                status = payload.get("status", "unknown")
                message = payload.get("message", "(no message)")
                file_path = payload.get("music_file")

                print(f"   Status      : {status}")
                print(f"   Message     : {message}")
                print(f"   Latency     : {duration:.1f}s")
                if file_path:
                    file_exists = Path(file_path).exists()
                    print(f"   File        : {file_path} ({'exists' if file_exists else 'missing'})")
                else:
                    print("   File        : (mock mode – no file returned)")
                print()

    return success


if __name__ == "__main__":
    asyncio.run(run_full_integration())
