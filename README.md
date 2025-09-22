# AI Tinkerers Hack — Music & Vibe Platform

This project pairs a **sensor-aware Next.js front of house** with a **compact
AgentOS backend** that orchestrates ElevenLabs Music. Room stats from the
browser drive a creative brief, the agent generates (or fakes) a soundtrack, and
local playback keeps the vibe alive even when external audio is unavailable. A
Firecrawl-powered extractor can mirror the ambience of external event pages or
venue listings to seed the vibe manually.

> New in this build: pick **Catch the Vibe + Weather** (live sensors) or **Catch
> the Place + Weather** (Firecrawl + weather) to seed the soundtrack.

## ✨ Features
- Landing deck offers two modes: **Catch the Vibe + Weather** (sensors) and
  **Catch the Place + Weather** (URL intelligence)
- Real-time webcam & audio analysis streams into `useVibeSensors`
- Firecrawl `/scrape` ingests event and place URLs (Luma, Eventbrite, Google
  Maps, Yelp, bespoke venue sites) for manual seeding
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
- `FIRECRAWL_API_KEY` for event/venue vibe extraction (server-side only)
- *(Optional)* `WEATHERAPI_KEY` for premium weather detail — without it we fall
  back to Open-Meteo via the server

### 1. Backend (AgentOS + ElevenLabs)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

./scripts/start-backend.sh  # serves http://localhost:7777
```
The launcher automatically sources `.env` (if present) so your
`OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `FIRECRAWL_API_KEY`, etc. load every
time. Pass additional flags straight through
(`./scripts/start-backend.sh --reload`).
The backend exposes `/api/vibe/generate-music`. Without `ELEVENLABS_API_KEY` it
returns mocked tracks plus a structured fallback plan so the UI can stay musical.

### 2. Frontend (Next.js 14)
```bash
npm install
npm run dev
```
Open http://localhost:3000/ (auto-redirects to the deck) and choose your flow:
- **Catch the Vibe + Weather** – grant camera/mic access when prompted
- **Catch the Place + Weather** – paste an event or place URL (requires
  `FIRECRAWL_API_KEY`)

Create an
`.env.local` if you need to supply keys or point at a different agent instance:
```bash
AGNO_AGENT_URL=http://localhost:7777
FIRECRAWL_API_KEY=fc-...
```

### 3. Useful scripts
```bash
npm run build   # production bundle
npm run lint    # ESLint / TypeScript / Tailwind checks
```

## 🧭 Usage Flows
- **Catch the Vibe + Weather**: Allows camera + mic access, taps *Catch the
  Vibe*, and watches live metrics react to motion, smiles, and brightness while
  weather nudges warmth and tempo.
- **Catch the Place + Weather**: Pastes an event/venue link, Firecrawl extracts
  vibe metadata, and a single click on *Catch this Vibe* pushes the summary into
  the music pipeline (no camera required).

## 🔐 Security Notes
- Browser code never references third-party secrets; all keys live in server-only
  environment variables (`FIRECRAWL_API_KEY`, `WEATHERAPI_KEY`, etc.). When
  those keys are absent or rejected, the server quietly swaps to Open-Meteo so
  the UI still shows a forecast.
- The frontend talks only to our Next.js API routes (`/api/generate-vibe-music`,
  `/api/extract-event`, `/api/weather`), which proxy outbound calls on the
  server and filter error payloads before returning to the client.
- When keys are unset, the API routes return explicit 5xx errors instead of
  falling back to insecure defaults.

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

## 🌐 Firecrawl Event & Venue Extraction
- Endpoint: `POST /api/extract-event`
- Input: `{ "url": "https://..." }` where the URL is an event page (Eventbrite, Resident Advisor, etc.) or a place listing (Google Maps, Yelp, venue site)
- The API submits the URL to Firecrawl `/scrape` using the FIRE-1 agent with a schema that captures vibe cues, crowd details, and suggested BPM/volume.
- Responses always include a `success` flag and `eventData` payload compatible with the vibe UI. Places are normalised to the same structure (e.g. `entityType: "place"`, `placeName`, `vibeDescription`).
- Tip: Firecrawl works best with shareable URLs (e.g. Google Maps "Share" links). Short dynamic links that return HTTP 404 are surfaced as errors so you can adjust the source.

To try it manually:
```bash
curl -X POST http://localhost:3000/api/extract-event \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.eventbrite.com/..."}'
```
Ensure `FIRECRAWL_API_KEY` is loaded in your environment before calling the endpoint or using the **Catch the Place + Weather** flow in the UI.

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
