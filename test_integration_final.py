#!/usr/bin/env python3
"""
Compatibility shim that re-uses the new ElevenLabs MCP integration test.

Historically this project shipped multiple entry points named similarly. To keep
existing documentation functional we delegate to `test_final_integration.py`.
"""

from test_final_integration import run_full_integration

if __name__ == "__main__":
    import asyncio

    asyncio.run(run_full_integration())
