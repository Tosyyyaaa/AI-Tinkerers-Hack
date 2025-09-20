# ElevenLabs MCP Integration Notes

This document summarises the modern music-only workflow that replaced the
weather+music hybrid. It highlights how the AgentOS backend, MCP server, and
Next.js frontend interact.

## Overview

- **AgentOS backend** (`elevenlabs_agentos.py`) hosts an Agno agent configured
  with DeepSeek via OpenRouter
- **MCP server** (`mcp_elevenlabs_server.py`) provides the `generate_music` tool
- **Frontend** (`app/api/generate-vibe-music/route.ts`) proxies vibe stats to the
  AgentOS REST endpoint

## Data Flow

1. Browser captures webcam/audio stats (`useVibeSensors`)
2. Frontend posts payload to `/api/generate-vibe-music`
3. Route forwards the request to `AGNO_AGENT_URL/api/vibe/generate-music`
4. AgentOS calls the MCP `generate_music` tool
5. Response is returned to the browser with music metadata and prompt summary

## MCP Tool Contract

```json
{
  "name": "generate_music",
  "description": "Generate custom AI music using ElevenLabs",
  "arguments": {
    "style": "upbeat | chill | cozy | dynamic | ambient | classical | rock | jazz | electronic | acoustic",
    "description": "Free-form prompt describing the vibe",
    "duration_seconds": "5-30"
  }
}
```

Responses include `status`, `message`, `music_file` (when real API available),
and `recommendation`. In mock mode the file path is omitted.

## Prompt Metadata

The Next.js route enriches the payload with `promptMetadata` containing the
initial style/description suggestion. The backend honours it but still applies
its own heuristics based on the provided sensors.

## Testing

- `test_integration.py` — handler-only smoke test
- `test_mcp_server.py` — stdio transport (mirrors AgentOS runtime)
- `test_final_integration.py` — multi-style generation with latency output
- `test_as_agno_agent.py` — high-level agent simulation

Run these tests inside the Python virtual environment. Real audio requires
`ELEVENLABS_API_KEY`; otherwise the MCP server returns structured mock data.

## Legacy Weather Stack

All Python scripts that previously imported `mcp_weather_server.py` now raise a
clear `RuntimeError` describing the deprecation. Weather data is served directly
by the Next.js API (`app/api/weather/route.ts`).
