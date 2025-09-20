#!/usr/bin/env python3
"""
Integration smoke test for the ElevenLabs MCP server.

This script exercises the `generate_music` MCP tool directly via the
module-level handlers that back the new AgentOS music backend.
"""

import asyncio
import json
import os
import sys
from typing import Iterable

try:
    from mcp_elevenlabs_server import handle_call_tool, handle_list_tools
except ModuleNotFoundError as exc:  # pragma: no cover - provides friendly message
    missing = exc.name or "dependency"
    print("❌ Unable to import mcp_elevenlabs_server (missing dependency: " f"{missing})")
    print("💡 Install Python requirements: pip install -r requirements.txt")
    sys.exit(1)


async def run_integration(styles: Iterable[str]) -> None:
    """Call the music MCP tool for a handful of styles and report results."""
    print("🎵 ElevenLabs MCP Integration Test")
    print("=" * 40)

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if api_key:
        print("🔑 ElevenLabs API Key: ✅ detected (real generation mode)")
    else:
        print("🔑 ElevenLabs API Key: ⚠️ missing (mock generation will be used)")
    print()

    print("🛠️ Listing available MCP tools...")
    tools = await handle_list_tools()
    tool_names = [tool.name for tool in tools]
    print(f"   Tools: {tool_names}")
    if "generate_music" not in tool_names:
        raise RuntimeError("generate_music tool not advertised by server")
    print()

    print("🎚️ Generating sample tracks...")
    for style in styles:
        prompt = (
            f"Automated integration prompt for {style} style. "
            "Describe a short soundtrack that matches a modern lounge environment."
        )
        arguments = {
            "style": style,
            "description": prompt,
            "duration_seconds": 12,
        }

        result = await handle_call_tool("generate_music", arguments)
        if not result:
            raise RuntimeError(f"No content returned for style '{style}'")

        payload = json.loads(result[0].text)
        status = payload.get("status", "unknown")
        message = payload.get("message", "(no message)")
        file_path = payload.get("music_file")

        print(f"   🎶 {style.capitalize():<10} → {status}")
        print(f"      ↳ {message}")
        if file_path:
            print(f"      💾 File: {file_path}")
        else:
            print("      💡 Mock mode (no file produced)")
        print()

    print("✅ Integration smoke test completed.")


if __name__ == "__main__":
    asyncio.run(
        run_integration([
            "upbeat",
            "chill",
            "ambient",
        ])
    )
