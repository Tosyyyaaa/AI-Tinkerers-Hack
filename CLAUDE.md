# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This repository contains two AI-powered music projects developed for hackathons:

### 1. ElevenLabs Music MCP Agent
A music-only agent system built around ElevenLabs' music generation API:

- **Backend**: Python-based MCP server (`mcp_elevenlabs_server.py`) exposing the `generate_music` tool
- **Agent Framework**: Agno/PhiData with OpenRouter DeepSeek model (`elevenlabs_agentos.py`)
- **MCP Integration**: `mcp.json` configured for Claude Desktop / MCP clients

### 1a. Legacy Weather MCP Agent (Removed)
The weather MCP implementation was deleted. Any remaining scripts now raise a
runtime error explaining the deprecation.

### 2. DJBuddy - Webcam Vibe Check
A Next.js application with real-time computer vision and audio analysis:

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and App Router
- **Computer Vision**: MediaPipe Face Detection, TensorFlow.js fallback
- **Audio Analysis**: Web Audio API with FFT analysis and pitch detection
- **AI Integration**: Anthropic Claude API for vibe interpretation
- **Music Integration**: Spotify Web Playback SDK and local audio playback

## Development Commands

### ElevenLabs Music MCP Agent (Python)

**Environment Setup:**
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# OR use quick install script
chmod +x install.sh && ./install.sh
```

**Configuration:**
```bash
# Copy environment template
cp .env.example .env
# Edit .env with your API keys (OpenRouter, ElevenLabs)
```

**Running Services:**
```bash
# Test MCP server integration
python test_integration.py

# Start ElevenLabs Music AgentOS interface (recommended)
python elevenlabs_agentos.py
# Opens at http://localhost:7777

# Legacy scripts such as `weather_agentos.py` now raise runtime errors that
# explain the deprecation.
```

**Testing:**
```bash
# Test individual components
python test_mcp_server.py         # MCP server functionality (stdio transport)
python test_integration.py        # Handler-level integration
python test_final_integration.py  # Multi-style end-to-end workflow
```

### DJBuddy Vibe Check (Next.js)

**Development:**
```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Opens at http://localhost:3000

# Production build
npm run build
npm start

# Linting
npm run lint
```

**Environment Variables:**
Create `.env.local` with:
- `ANTHROPIC_API_KEY`: Required for vibe interpretation
- `ELEVEN_API_KEY`: Required for text-to-speech
- `WEATHERAPI_KEY`: Optional for the frontend weather widget
- `SPOTIFY_CLIENT_ID` & `SPOTIFY_CLIENT_SECRET`: Optional for Spotify features

## Key Technical Components

### MCP (Model Context Protocol) Integration
- **Server**: `mcp_elevenlabs_server.py` - Implements ElevenLabs music generation tools
- **Configuration**: `mcp.json` - Tool definitions and schema
- **Tools Available**:
  - `generate_music(style, description, duration_seconds)`: AI music generation with style control

### Music Style System
Music generation supports 10 different styles:
- `upbeat`: Energetic, positive music perfect for parties and celebrations
- `chill`: Relaxed ambient vibes great for studying or relaxing
- `cozy`: Warm, intimate music perfect for quiet moments
- `dynamic`: Powerful, driving music with strong energy
- `ambient`: Atmospheric, meditative sounds for deep focus
- `classical`: Beautiful orchestral arrangements and compositions
- `rock`: Guitar-driven music with strong rhythm and attitude
- `jazz`: Sophisticated improvised melodies and harmonies
- `electronic`: Modern synthesized music with digital beats
- `acoustic`: Natural, organic sounds with real instruments

### Agent Framework (Agno/PhiData)
- **Model**: DeepSeek v3.1 via OpenRouter
- **Tools**: MCP bridge for ElevenLabs music generation
- **Interface**: AgentOS web UI for chat interaction

### Computer Vision Pipeline (DJBuddy)
Located in `lib/vibe/`:
- **Frame Analysis**: Brightness, motion detection, color temperature
- **Face Detection**: MediaPipe with TensorFlow.js fallback
- **Audio Analysis**: Volume, energy, pitch detection, spectral analysis
- **Vibe Classification**: Party/Chill/Focused/Bored based on audio-visual data

### API Structure
- **Music Agent**: Direct MCP tool integration for music generation
- **Vibe Interpretation**: `/api/interpret-vibe` - Anthropic Claude integration (DJBuddy)
- **Text-to-Speech**: `/api/tts` - ElevenLabs voice synthesis (DJBuddy)
- **Weather Widget**: `/api/weather?city={city}` - Direct WeatherAPI.com bridge for the frontend

## File Organization

### Python Backend Files
- `elevenlabs_agentos.py`: Main ElevenLabs Music AgentOS application entry point
- `mcp_elevenlabs_server.py`: MCP server implementation with ElevenLabs music generation
- `test_*.py`: Test suite for various components

### Next.js Frontend Structure
- `app/`: Next.js App Router pages and API routes
- `lib/`: Utility libraries (audio, vibe, weather, spotify, mcp)
- `components/`: React components (if any)

### Configuration Files
- `mcp.json`: MCP server configuration and tool definitions
- `requirements.txt`: Python dependencies
- `package.json`: Node.js dependencies and scripts
- `.env.example`/`.env`: Environment variables template

## Development Workflow

1. **ElevenLabs Music Agent Development**: Start with `elevenlabs_agentos.py`
2. **MCP Tool Testing**: Use `test_integration.py` / `test_mcp_server.py`
3. **Frontend Development**: `npm run dev`
4. **Cross-platform Testing**: Exercise Next.js → AgentOS → MCP flow

## API Keys Required

**For ElevenLabs Music Agent:**
- `OPENROUTER_API_KEY`: Required for AI agent (DeepSeek model)
- `ELEVENLABS_API_KEY`: Optional (falls back to mock music generation)

**For DJBuddy:**
- `ANTHROPIC_API_KEY`: Required for vibe interpretation
- `ELEVEN_API_KEY`: Required for text-to-speech
- Others optional with graceful fallbacks

## Privacy & Security
- DJBuddy processes all video/audio locally in browser
- No media data is uploaded to servers
- API keys should never be committed to version control
- Environment variables are properly isolated between projects
