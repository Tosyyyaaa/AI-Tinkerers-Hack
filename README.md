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

When the frontend completes a vibe check it POSTs to
`/api/generate-vibe-music`. The API now forwards:

- The **raw sensor snapshot** (`RoomStats`) captured by `useVibeSensors`
- The **interpreted vibe decision** (label/BPM/volume/tip)
- An optional **weather snapshot** (location + conditions)
- A derived **creative brief** (style, tempo target, energy/warmth/formality axes, vocals policy)

All of that context is merged into a creative brief so the AgentOS backend and
ElevenLabs hear the same story the UI shows, and the fallback playlist knows
which vibe to hold when the API declines to generate audio.

### Vibe Payload Contract

```jsonc
{
  "stats": { /* RoomStats: audio + visual metrics */ },
  "decision": {
    "vibeLabel": "chill",
    "suggestedBPM": 92,
    "suggestedVolume": 0.62,
    "spokenTip": "Chill vibes detected. Perfect for relaxation."
  },
  "weather": {
    "location": "London, UK",
    "description": "light rain",
    "temperature": 17
  },
  "context": {
    "timestamp": 1737532800000,
    "sessionId": "vibe-check-session",
    "previousVibe": "party",
    "previousStyle": "upbeat",
    "styleLockExpiresAt": 1737532860000
  },
  "promptMetadata": {
    "style": "cozy",
    "description": "Compose cozy music that feels intimate. Energy 42%.",
    "vibeLabel": "chill",
    "weatherSummary": "London, light rain, 17°C",
    "targetBpm": 92,
    "energy": 0.42,
    "warmth": 0.78,
    "formality": 0.35,
    "focus": 0.56,
    "vocalsAllowed": "off",
    "instrumentationHints": ["warm piano", "brush kit"],
    "briefVersion": "v1.0.0"
  },
  "brief": {
    "style": "cozy",
    "vibeLabel": "chill",
    "targetBpm": 92,
    "energy": 0.42,
    "warmth": 0.78,
    "formality": 0.35,
    "focus": 0.56,
    "acousticRatio": 0.71,
    "percussionIntensity": 0.28,
    "dynamics": 0.33,
    "vocalsAllowed": "off",
    "instrumentationHints": ["warm piano", "upright bass"],
    "environmentSummary": "motion 24% | crowd 18% | lighting dim",
    "weatherSummary": "London, light rain, 17°C",
    "transition": { "previousStyle": "ambient", "smoothness": 0.9 }
  }
}
```

Downstream, `app/api/generate-vibe-music` keeps the brief as-is and forwards it
to the AgentOS backend. If ElevenLabs declines to deliver audio the backend now
returns `fallback` instructions so the frontend can keep a local playlist in
sync with the same vibe axes.

### Creative Brief Axes

`lib/vibe/musicBrief.ts` produces the axes used across the stack:

- `energy`, `warmth`, `formality`, `focus` — continuous controls derived from sensors
- `acousticRatio`, `percussionIntensity`, `dynamics` — instrumentation & punch
- `vocalsAllowed` — always `off` (instrumental-only policy)
- `instrumentationHints`, `moodKeywords` — short descriptors surfaced to the agent
- `transition.previousStyle` + a style lock timestamp keeps one vibe for at least a full track

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
