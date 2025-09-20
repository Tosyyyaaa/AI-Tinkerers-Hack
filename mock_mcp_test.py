#!/usr/bin/env python3
"""
Mock MCP workflow that demonstrates how the new music-only tool is used by the
Agno agent. This keeps the developer experience from the previous weather demo
while reflecting the updated architecture.
"""

import asyncio
import json
from dataclasses import dataclass
from typing import Dict


@dataclass
class MockMCPMusicTool:
    name: str = "generate_music"
    description: str = "Generate AI music for a given style and description"

    async def call(self, style: str, description: str, duration: int = 12) -> Dict[str, str]:
        print(f"🔧 MCP Tool Called: generate_music(style='{style}', duration={duration})")
        print(f"   Prompt: {description}")

        return {
            "status": "success",
            "style": style,
            "duration_seconds": duration,
            "prompt": description,
            "music_file": f"/tmp/elevenlabs_music/mock_{style}.mp3",
            "message": f"Mock track generated for {style} vibe",
            "recommendation": f"Play more {style} tracks with similar energy.",
        }


class MockAgnoMusicAgent:
    """Simplified agent logic that mirrors AgentOS behaviour."""

    STYLE_MAP = {
        "party": "upbeat",
        "chill": "chill",
        "focused": "ambient",
        "bored": "dynamic",
    }

    def __init__(self, music_tool: MockMCPMusicTool) -> None:
        self.music_tool = music_tool
        self.instructions = "Use the generate_music tool to craft tracks based on vibe stats."

    async def run(self, vibe_label: str, description: str) -> Dict[str, str]:
        style = self.STYLE_MAP.get(vibe_label, "ambient")
        print(f"🤖 Agent: detected vibe '{vibe_label}', mapping to style '{style}'")
        result = await self.music_tool.call(style, description, duration=10)

        response = {
            "vibe": vibe_label,
            "style": style,
            "message": (
                f"Generated {style} track for {vibe_label} vibe – "
                f"{result['message']}"
            ),
            "music": result,
        }
        return response


async def simulate_workflow() -> None:
    print("🚀 Mock MCP Music Agent Workflow")
    print("=" * 46)

    tool = MockMCPMusicTool()
    agent = MockAgnoMusicAgent(tool)

    queries = [
        ("party", "Crowded dance floor with strobe lighting"),
        ("chill", "Late night lounge with soft lighting"),
        ("focused", "Quiet workspace with minimal distractions"),
    ]

    for vibe, description in queries:
        print(f"\n🎛️  Simulating vibe: {vibe}")
        response = await agent.run(vibe, description)
        print(json.dumps(response, indent=2))

    print("\n✅ Mock workflow complete – ready for real MCP integration")


if __name__ == "__main__":
    asyncio.run(simulate_workflow())
