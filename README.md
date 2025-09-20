# AI Tinkerers Hack — Music & Vibe Platform

This repository now centres on a **music-first AgentOS backend** powered by the
Agno framework and ElevenLabs' music generation API, together with the
**Next.js DJBuddy frontend** that collects webcam/audio statistics to request
personalised soundtracks.

> ⚠️ The older weather MCP agent has been retired. All Python utilities that
> referenced `mcp_weather_server.py` now point to the new ElevenLabs tooling or
> display helpful deprecation messages.

## 🎵 ElevenLabs Music MCP Agent (Backend)

- **Entry point**: `elevenlabs_agentos.py`
- **MCP server**: `mcp_elevenlabs_server.py` exposes the `generate_music` tool
- **Model**: DeepSeek v3.1 via OpenRouter (Agno handles the LLM flow)
- **Music**: ElevenLabs Music API (mock mode when `ELEVENLABS_API_KEY` absent)
- **Integration tests**:
  - `test_integration.py` — direct handler smoke test
  - `test_mcp_server.py` — stdio transport test (matches AgentOS runtime)
  - `test_final_integration.py` — multi-style end-to-end exercise

### Architecture

```
┌──────────────────┐     ┌─────────────────┐     ┌────────────────────────┐
│ Next.js API      │ ──▶ │ AgentOS (Agno) │ ──▶ │ ElevenLabs MCP Server │
│ /api/generate-…  │     │ elevenlabs_…   │     │ generate_music tool    │
└──────────────────┘     └─────────────────┘     └──────────┬──────────────┘
                                                             ▼
                                                 ElevenLabs Music API
                                                 (mocked when no key)
```

- The frontend sends sensor stats to `/api/generate-vibe-music`
- The API proxies the payload to `AgentOS /api/vibe/generate-music`
- AgentOS instructs the MCP tool to create a short track and returns metadata

### Environment

```bash
# Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Required variables
export OPENROUTER_API_KEY=sk-...
export ELEVENLABS_API_KEY=sk-...  # optional: enables real audio

# Launch AgentOS (served at http://localhost:7777)
python elevenlabs_agentos.py
```

Mock responses are produced automatically when `ELEVENLABS_API_KEY` is missing,
so development can continue without the external service.

## 🎛️ DJBuddy Frontend (Next.js 14)

- **Location**: `app/` + `lib/`
- **Sensors**: webcam + audio analytics via `useVibeSensors`
- **Weather**: handled client-side with WeatherAPI.com via `app/api/weather`
- **Music bridge**: `app/api/generate-vibe-music/route.ts`

```bash
npm install
npm run dev
# http://localhost:3000/vibe
```

When the frontend has fresh sensor statistics it POSTs to
`/api/generate-vibe-music`. The API packages the payload (including optional
prompt metadata) and forwards it to the AgentOS backend.

### Key Frontend Modules

- `lib/vibe/interpretVibe.ts` — blends audio & visual metrics into vibe labels
- `lib/mcp/vibeTools.ts` — MCP-style wrappers for future desktop integrations
- `lib/audio/*` — Spotify/local playback helpers
- `app/vibe/page.tsx` — main UI orchestrating sensors, vibe loop, and music

## ✅ Testing & Verification

| Script | Purpose |
| --- | --- |
| `test_integration.py` | Direct async calls to MCP handlers (no subprocess) |
| `test_mcp_server.py` | Launch MCP server via stdio and request one track |
| `test_final_integration.py` | Multi-style generation with latency reporting |
| `verification_summary.py` | High-level confirmation of tooling & env |
| `test_as_agno_agent.py` | Simulated AgentOS-to-MCP conversation |

Legacy scripts that referenced weather now raise informative errors so that old
instructions fail fast with guidance.

## 📂 Repository Guide

```
mcps for hack vibe/
├── elevenlabs_agentos.py        # AgentOS backend entry point
├── mcp_elevenlabs_server.py     # MCP server exposing generate_music
├── test_integration.py          # Handler smoke test
├── test_mcp_server.py           # stdio transport test
├── app/                         # Next.js frontend (App Router)
│   ├── api/
│   │   ├── generate-vibe-music/ # Backend proxy to AgentOS
│   │   └── weather/             # WeatherAPI.com bridge
│   └── vibe/page.tsx            # DJBuddy interface
└── lib/                         # Shared frontend libraries
```

## 🕰️ Legacy Weather Stack

The original weather MCP tooling has been fully retired. Files such as
`weather_agentos.py`, `test_weather.py`, etc., now raise exceptions explaining
that the feature set was removed. The Next.js weather API continues to offer
weather data to the frontend without involving MCP.

## 🙌 Contributing

1. Run the modern tests (`python test_integration.py`, etc.) before changes
2. Keep documentation aligned with the music-first architecture
3. When adding new tests, prefer the existing helper scripts as templates
4. Ensure frontend/backend contracts stay in sync (see prompt metadata payload)

Happy hacking! 🎶
