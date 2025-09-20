#!/usr/bin/env python3
"""
Legacy entry point for the weather-aware AgentOS demo.

The weather MCP server has been removed from the project in favour of the
music-only ElevenLabs workflow. This file is kept so that older documentation
still has a target, but it now raises a clear error directing developers to the
new entry point.
"""

raise RuntimeError(
    "weather_agentos.py has been deprecated. Use elevenlabs_agentos.py for the "
    "current music-generation AgentOS backend."
)
