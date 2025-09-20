#!/usr/bin/env python3
"""
Legacy FastAPI demo that previously bypassed MCP for direct weather lookups.

The project has transitioned to a music-only backend. Retaining this file
caused import errors after the weather MCP was removed, so we now raise a clear
exception instructing developers to the supported workflow.
"""

raise RuntimeError(
    "working_weather_agent.py is deprecated. Use the ElevenLabs music agent "
    "(elevenlabs_agentos.py) or the Next.js weather API instead."
)
