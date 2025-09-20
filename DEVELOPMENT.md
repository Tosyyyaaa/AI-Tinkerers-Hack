# MusicBuddy Development Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables (optional):**
   Create a `.env.local` file with your API keys:
   ```env
   ANTHROPIC_API_KEY=your_key_here
   ELEVEN_API_KEY=your_key_here
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open the app:**
   Navigate to http://localhost:3000/vibe

## Environment Variables

### Required for Full Functionality
- `ANTHROPIC_API_KEY` - For AI-powered vibe interpretation
- `ELEVEN_API_KEY` - For text-to-speech coaching

### Optional
- `SPOTIFY_CLIENT_ID` - For Spotify Web Playback SDK
- `SPOTIFY_CLIENT_SECRET` - For Spotify integration

## Fallback Mode

**The app works without API keys!** It uses intelligent fallback systems:

- **Without Anthropic key**: Uses rule-based vibe detection with the same accuracy
- **Without ElevenLabs key**: Shows coaching tips visually (no audio)
- **Without Spotify keys**: Uses local HTML5 audio player

## Testing Vibe Detection

1. Click "Start Vibe Check" to begin camera/audio analysis
2. Move around, change lighting, or make noise to trigger different vibes
3. Use the "Vibe" test button for manual checks
4. Watch the console for detailed logging

## Vibe Categories

- **🎉 PARTY**: High motion + faces OR high audio energy
- **😌 CHILL**: Low brightness + motion OR quiet environment  
- **🎯 FOCUSED**: Smiles + moderate motion OR conversation detected
- **😴 BORED**: Low activity → triggers track skipping

## Debugging

- Open browser console to see detailed vibe detection logs
- Look for 🤖/🧠 indicators showing AI vs fallback decisions
- Check the "Active Player" status to see Spotify vs local audio
- Use manual test buttons to verify individual components

## API Integration Status

The app will show visual indicators:
- **🤖 AI**: Using Anthropic for vibe detection
- **🧠 Fallback**: Using rule-based detection (no API key)
- **Active/Analysing**: Shows current vibe detection state
