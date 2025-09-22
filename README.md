# AI Tinkerers Hack — Music & Vibe Platform

This project pairs a **sensor-aware Next.js front of house** with a **compact
AgentOS backend** that orchestrates ElevenLabs Music. Room stats from the
browser drive a creative brief, the agent generates (or fakes) a soundtrack, and
local playback keeps the vibe alive even when external audio is unavailable.

> The earlier weather-focused tooling has been sunset. What remains is the
> streamlined music experience that we demoed at AI Tinkerers.

## ✨ Features
- Real-time webcam & audio analysis streams into `useVibeSensors`
- Creative briefs describe the room (energy, warmth, instrumentation hints)
- AgentOS bridges those briefs to ElevenLabs Music via OpenRouter
- Automatic local fallback playlist kicks in when the agent cannot return audio
- Browser-based player (`lib/audio/localPlayer`) supervises volume ramps & state

## 🚀 Quick Start

### Requirements
- Node.js 18+
- Python 3.10+
- `OPENROUTER_API_KEY` (required for the agent to launch)
- *(Optional)* `ELEVENLABS_API_KEY` for live music instead of the built-in mocks

### 1. Backend (AgentOS + ElevenLabs)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

export OPENROUTER_API_KEY=sk-openrouter...
export ELEVENLABS_API_KEY=sk-elevenlabs...  # optional, enables real audio

python elevenlabs_agentos.py  # serves http://localhost:7777
```
The backend exposes `/api/vibe/generate-music`. Without `ELEVENLABS_API_KEY` it
returns mocked tracks plus a structured fallback plan so the UI can stay musical.

### 2. Frontend (Next.js 14)
```bash
npm install
npm run dev
```
Open http://localhost:3000/vibe and approve camera/mic access. Create an
`.env.local` if you need to point at a different agent instance:
```bash
AGNO_AGENT_URL=http://localhost:7777
```

### 3. Useful scripts
```bash
npm run build   # production bundle
npm run lint    # ESLint / TypeScript / Tailwind checks
```

## 🔄 How the stack talks
1. The UI captures a snapshot of room stats and interprets a vibe decision.
2. `/api/generate-vibe-music` merges stats, decision, and weather into a brief.
3. The AgentOS service asks ElevenLabs for a track; failure yields a fallback plan.
4. The browser loads the returned audio (or fallback) and starts playback.

```
Next.js ↔︎ AgentOS ↔︎ ElevenLabs
   ▲            │
   └── local fallback playlist keeps playing when ElevenLabs is quiet
```

## 🎵 Fallback Safety Net
When the backend responds with `fallback`, `app/vibe/page.tsx` now:
- Builds a local track descriptor that mirrors the requested vibe
- Loads it into `localPlayer` **and immediately calls `play()`**
- Locks the style for 60s to avoid thrashing between genres
- Surfaces autoplay warnings so users can tap Play if the browser blocks audio

That change guarantees continuous music during outages—the review regression is
resolved by ensuring playback starts the moment the fallback queues up.

## 📡 Request Payload (abridged)
```jsonc
{
  "stats": { /* live RoomStats */ },
  "decision": {
    "vibeLabel": "chill",
    "suggestedBPM": 92,
    "suggestedVolume": 0.62,
    "spokenTip": "Chill vibes detected."
  },
  "weather": { /* optional snapshot */ },
  "promptMetadata": { /* descriptive summary for humans */ },
  "brief": {
    "style": "cozy",
    "energy": 0.42,
    "warmth": 0.78,
    "percussionIntensity": 0.28,
    "vocalsAllowed": "off",
    "instrumentationHints": ["warm piano", "upright bass"],
    "transition": { "previousStyle": "ambient", "smoothness": 0.9 }
  }
}
```
The backend can echo generated music metadata plus an optional `fallback`
contract (`strategy`, `reason`, `suggestedStyle`).

## 📁 Repository Layout
```
mcps for hack vibe/
├── app/                     # Next.js App Router frontend
│   ├── api/generate-vibe-music/route.ts
│   └── vibe/page.tsx        # Primary DJBuddy experience
├── lib/                     # Shared frontend logic (audio, sensors, briefs)
├── elevenlabs_agentos.py    # AgentOS entry point that talks to ElevenLabs
├── package.json
├── requirements.txt
└── README.md                # You are here
```

## ✅ Dev Checklist
- `npm run lint` before shipping UI updates
- Manually run a vibe check to ensure fallback playback starts instantly
- Keep environment keys in `.env.local` / shell exports; never commit secrets

## 🙌 Contributing
1. Align new features with the music-first scope (vibe sensing + playback)
2. Update this README if contracts or launch steps change
3. Use concise commit messages (`Fix fallback playback` style)

Happy hacking! 🎶
