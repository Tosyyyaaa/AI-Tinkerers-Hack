# MusicBuddy Vibe Detection Integrations

## Overview

This document summarises the comprehensive vibe detection integrations implemented for MusicBuddy, providing AI-powered music adaptation based on real-time webcam and audio analysis.

## 🔧 Completed Integrations

### 1. Anthropic (Claude) Integration ✅

**Implementation**: `app/api/interpret-vibe/route.ts`

- **Model**: `claude-3-5-sonnet-latest` 
- **Input**: Raw room statistics (visual + audio metrics)
- **Output**: Structured vibe decision JSON with music recommendations
- **Features**:
  - Comprehensive input sanitisation and validation
  - Fallback decision generation for offline scenarios
  - Enhanced prompts with audio context understanding
  - Robust error handling with retry logic

**Prompt Template**:
```
System: You are DJBuddy's vibe coach. Analyse room stats and provide music adaptation decisions.
User: [JSON stats] + Enhanced rules for party/chill/focused/bored detection
```

### 2. ElevenLabs TTS Integration ✅

**Implementation**: `app/api/tts/route.ts`

- **Model**: `eleven_turbo_v2_5` (optimised for speed)
- **Voice Options**: 5 coaching-specific voices (Adam, Bella, Callum, Charlie, Emily)
- **Features**:
  - HTTP streaming for immediate audio delivery
  - Voice name resolution (e.g., 'charlie' → voice ID)
  - Comprehensive error handling for rate limits, authentication
  - GET endpoint for voice capabilities and options
  - Audio caching with proper headers

**Voice Personalities**:
- **Charlie** (default): Upbeat, motivational coaching
- **Bella**: Confident, energetic for party vibes  
- **Emily**: Supportive, calm for chill moments
- **Adam**: Warm, friendly encouragement
- **Callum**: Professional, clear for focused sessions

### 3. Spotify Web Playback SDK + Local Audio Fallback ✅

**Implementation**: `lib/audio/adaptivePlayer.ts`

**Adaptive Player Logic**:
1. **Priority 1**: Spotify Web Playback SDK (if authenticated and available)
2. **Priority 2**: Local HTML5 Audio with Web Audio API (fallback)
3. **Seamless switching**: Automatic fallback on Spotify errors

**Features**:
- Intelligent player selection based on availability
- Volume ramping for smooth transitions
- Track skipping with debouncing (10s cooldown)
- Separate TTS audio path (always uses local for immediacy)
- Comprehensive state management and error recovery

**Spotify Integration**:
- Device management with ready/not-ready states
- OAuth token handling with refresh capability
- Real-time playback state synchronisation
- Volume control with smooth ramping

**Local Player Integration**:
- Web Audio API with gain nodes and dynamic compression
- Cross-origin audio support with proper CORS handling
- Automatic track advancement and playlist looping
- TTS audio mixing (separate from music stream)

### 4. MCP (Model Context Protocol) Tool Interfaces ✅

**Implementation**: `lib/mcp/vibeTools.ts`

**Available Tools**:

1. **`interpret_vibe`**: Analyse room stats → vibe decision
2. **`speak_coach`**: Text → TTS audio with voice selection  
3. **`adapt_playback`**: Apply vibe decision to music playback
4. **`vibe_check`**: Complete workflow (analyse + speak + adapt)

**Daedalus Labs Integration Example**:
```javascript
// Register tools with MCP server
const tools = getMCPToolDefinitions();
mcpServer.registerTools(tools);

// Handle tool calls
mcpServer.onToolCall(async (toolName, input) => {
  return await mcpToolCall(toolName, input);
});

// Usage from external MCP client
const result = await mcpClient.callTool('vibe_check', {
  stats: {
    faces: 2, smiles: 1, avgBrightness: 0.7,
    motionLevel: 0.8, audioVolume: 0.6, audioEnergy: 0.7
  }
});
```

### 5. Comprehensive Error Handling & Logging ✅

**Implementation**: `lib/utils/logger.ts`

**Features**:
- Structured logging with levels (DEBUG, INFO, WARN, ERROR)
- Component-specific logging methods for each integration
- Performance monitoring with operation timing
- Error boundary utilities with fallback support
- Log storage with configurable retention
- Export capabilities for debugging

**Integration-Specific Loggers**:
```typescript
logger.anthropic('Vibe interpretation completed', { vibeLabel, bpm });
logger.elevenlabs('TTS generated', { voiceId, textLength });
logger.spotify('Volume adjusted', { oldVolume, newVolume });
logger.mcp('Tool called', { toolName, success });
```

## 🎵 Vibe Detection Logic

### Enhanced Audio-Visual Analysis

**Visual Metrics**:
- Face count and smile detection
- Motion level from frame differencing
- Brightness and colour temperature analysis

**Audio Metrics**:
- Volume and energy (RMS) levels
- Noise floor estimation and speech probability
- Spectral analysis (centroid, pitch detection)

**Vibe Categories**:

1. **PARTY** 🎉
   - Triggers: High motion (>0.6) + multiple faces (≥2) OR high audio energy (>0.7) + volume (>0.5)
   - Music: BPM 124-136, volume 0.75-0.9, action "keep"

2. **CHILL** 😌
   - Triggers: Low brightness (<0.25) + minimal motion (<0.3) OR quiet clean audio (<0.2 volume, <0.3 noise)
   - Music: BPM 80-105, volume 0.55-0.7, action "keep"

3. **FOCUSED** 🎯
   - Triggers: Smiles + moderate motion (0.3-0.6) OR high speech probability (>0.6) + moderate audio energy
   - Music: BPM 95-120, volume 0.6-0.75, action "keep"

4. **BORED** 😴
   - Triggers: Low activity across visual and audio metrics
   - Music: Higher energy BPM (120-140), volume 0.8, action "skip"

## 🚀 Usage Examples

### Basic Vibe Check
```typescript
import { performVibeCheck } from '@/lib/vibe/interpretVibe';

const result = await performVibeCheck(roomStats, {
  timeout: 8000,
  retries: 1,
  fallbackEnabled: true
});

// Result includes: decision, audioBuffer, error
```

### Adaptive Player Control
```typescript
import { getAdaptivePlayer } from '@/lib/audio/adaptivePlayer';

const player = getAdaptivePlayer({
  onPlayerChange: (type) => console.log(`Now using: ${type}`),
  onPlayStateChange: (playing) => updateUI(playing)
});

// Initialize Spotify (optional)
await player.initializeSpotify(accessToken);

// Load local fallback playlist
await player.loadLocalPlaylist(tracks);

// Apply vibe-based adaptations
await player.adaptPlayback(vibeDecision);
```

### MCP Tool Integration
```typescript
import { mcpToolCall } from '@/lib/mcp/vibeTools';

// Complete vibe check workflow
const result = await mcpToolCall('vibe_check', {
  stats: roomStats,
  options: {
    speakTip: true,
    adaptPlayback: true,
    voiceId: 'charlie'
  }
});
```

## 🔒 Security & Privacy

- **Local Processing**: Face detection and audio analysis happen client-side
- **Input Sanitisation**: All API inputs are validated and clamped to safe ranges  
- **Rate Limiting**: Built-in debouncing for API calls and player actions
- **Error Isolation**: Failures in one integration don't crash the entire system
- **Fallback Systems**: Multiple layers of fallback for resilient operation

## 📊 Performance Optimisations

- **Debouncing**: Volume changes (100ms), track skips (10s), vibe checks (1.5s)
- **Caching**: TTS responses cached with proper HTTP headers
- **Connection Pooling**: Reused HTTP connections for API calls
- **Lazy Loading**: Spotify SDK loaded on-demand
- **Memory Management**: Proper cleanup of audio contexts and intervals

## 🔧 Configuration

### Environment Variables Required
```env
ANTHROPIC_API_KEY=your_anthropic_key
ELEVEN_API_KEY=your_elevenlabs_key
SPOTIFY_CLIENT_ID=your_spotify_id (optional)
SPOTIFY_CLIENT_SECRET=your_spotify_secret (optional)
```

### Default Configuration
- **Vibe Check Interval**: 2 seconds
- **AI Model**: claude-3-5-sonnet-latest
- **TTS Voice**: Charlie (motivational)
- **TTS Model**: eleven_turbo_v2_5
- **Fallback**: Always enabled with heuristic-based decisions

## 🎯 Next Steps

The integration is now complete and production-ready. The system provides:

✅ **Real-time vibe analysis** with AI-powered decision making  
✅ **Adaptive music control** with Spotify/local fallback  
✅ **Voice coaching** with multiple personality options  
✅ **MCP compatibility** for external tool integration  
✅ **Comprehensive logging** for monitoring and debugging  
✅ **Robust error handling** with graceful degradation  

The MusicBuddy vibe detection system is now fully operational and ready to provide intelligent, responsive music adaptation based on real-time room analysis!
