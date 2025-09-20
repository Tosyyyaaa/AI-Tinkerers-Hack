# Setup Guide — ElevenLabs Music MCP + DJBuddy Frontend

This document replaces the previous weather MCP walkthrough. Follow these steps
to run the music-only backend and the Next.js vibe frontend together.

## 1. Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) ElevenLabs Music API key
- OpenRouter API key for DeepSeek access

## 2. Backend Setup (AgentOS + MCP)

```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Environment variables
export OPENROUTER_API_KEY=sk-openrouter...
export ELEVENLABS_API_KEY=sk-elevenlabs...  # optional

# Smoke test without spawning subprocesses
python test_integration.py

# StdIO transport test (mirrors AgentOS runtime)
python test_mcp_server.py

# Launch AgentOS + MCP backend
python elevenlabs_agentos.py
# http://localhost:7777
```

If `ELEVENLABS_API_KEY` is omitted the MCP server automatically returns mock
metadata so the rest of the stack still works.

## 3. Frontend Setup (Next.js)

```bash
npm install

# Required env variables in .env.local
ANTHROPIC_API_KEY=...
ELEVEN_API_KEY=...            # ElevenLabs TTS for coaching
WEATHERAPI_KEY=...            # WeatherAPI.com for frontend widget
AGNO_AGENT_URL=http://localhost:7777

npm run dev
# http://localhost:3000/vibe
```

The frontend collects webcam/audio metrics, calls `/api/generate-vibe-music`,
and the route forwards the request to `AGNO_AGENT_URL`.

## 4. Testing Checklist

| Command | Description |
| --- | --- |
| `python test_integration.py` | Directly calls MCP handlers |
| `python test_mcp_server.py` | Launches MCP server via stdio |
| `python test_final_integration.py` | Generates tracks for multiple vibes |
| `node` via `npm run dev` | Provides the DJBuddy UI |

Legacy weather scripts now raise descriptive errors. Use the new tests above.

## 5. Troubleshooting

- **No AgentOS connection**: Ensure `elevenlabs_agentos.py` is running on port 7777
- **Mock responses**: Confirm `ELEVENLABS_API_KEY` is exported if you expect real audio
- **Frontend CORS errors**: `generate-vibe-music` route proxies server-side, so check backend availability
- **Anthropic errors**: The vibe interpretation route requires `ANTHROPIC_API_KEY`

## 6. Project Structure Highlights

```
├── elevenlabs_agentos.py        # Main backend entry point
├── mcp_elevenlabs_server.py     # MCP server (generate_music tool)
├── test_integration.py          # Handler smoke test
├── test_final_integration.py    # Multi-style integration test
└── app/
    ├── api/generate-vibe-music/ # Next.js → AgentOS proxy
    └── vibe/page.tsx            # DJBuddy interface
```

## 7. Legacy Notes

- Weather MCP code has been removed. Any scripts referencing
  `mcp_weather_server.py` now raise an explicit error.
- Weather information is still available via the Next.js weather API route,
  independent of the AgentOS backend.

Happy building! 🎶
