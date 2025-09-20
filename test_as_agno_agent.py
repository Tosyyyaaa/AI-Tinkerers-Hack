#!/usr/bin/env python3
"""
Simulate how the Agno Agent interacts with the ElevenLabs music MCP server.

This replaces the historical weather simulation and mirrors the behaviour of
`elevenlabs_agentos.py` without needing API keys.
"""

import asyncio
import json
import sys
from dataclasses import dataclass

try:
    from mcp_elevenlabs_server import handle_call_tool, handle_list_tools
except ModuleNotFoundError as exc:  # pragma: no cover
    missing = exc.name or "dependency"
    print(f"❌ Missing dependency: {missing}")
    print("💡 Install Python requirements: pip install -r requirements.txt")
    sys.exit(1)


@dataclass
class AgentSimulator:
    """Minimal stand-in for the AgentOS logic."""

    async def simulate(self, vibe_label: str) -> dict:
        style_map = {
            "party": "upbeat",
            "chill": "chill",
            "focused": "ambient",
            "bored": "dynamic",
        }
        style = style_map.get(vibe_label, "ambient")
        description = f"Simulated request for {vibe_label} vibe mapped to {style} style"

        print(f"🤖 Agent: vibe='{vibe_label}' → style='{style}'")

        result = await handle_call_tool(
            "generate_music",
            {
                "style": style,
                "description": description,
                "duration_seconds": 8,
            },
        )

        payload = json.loads(result[0].text)
        return {
            "vibe": vibe_label,
            "style": style,
            "message": payload.get("message"),
            "music_file": payload.get("music_file"),
            "status": payload.get("status"),
        }


async def run_demo() -> None:
    print("🎵 AGNO AGENT MUSIC SIMULATION")
    print("=" * 38)

    tools = await handle_list_tools()
    print(f"Available tools: {[tool.name for tool in tools]}")

    agent = AgentSimulator()
    for vibe in ["party", "chill", "focused"]:
        print(f"\n=== Vibe: {vibe} ===")
        response = await agent.simulate(vibe)
        print(json.dumps(response, indent=2))

    print("\n✅ Simulation complete")


if __name__ == "__main__":
    asyncio.run(run_demo())
