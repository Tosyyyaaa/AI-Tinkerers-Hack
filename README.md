# DJBuddy - Webcam Vibe Check

AI-powered webcam vibe analysis with music adaptation using computer vision, Anthropic Claude, ElevenLabs TTS, and Spotify Web Playback SDK.

## Features

- **Real-time Computer Vision**: Webcam analysis for brightness, motion, face detection, and smile recognition
- **Advanced Audio Analysis**: soundDevice-inspired audio processing for volume, energy, noise detection, speech recognition, and spectral analysis
- **Live Weather Integration**: Real-time weather data with geolocation support and manual city selection
- **AI Vibe Interpretation**: Uses Anthropic Claude to interpret combined audio-visual stats and suggest music adaptations
- **Text-to-Speech Coaching**: ElevenLabs TTS provides spoken tips based on detected vibes
- **Music Integration**: Supports both Spotify Web Playback SDK and local audio playback
- **Privacy-First**: All video and audio analysis happens locally - no media leaves your device
- **Modern UI**: Beautiful, responsive 4-column interface built with Next.js 14 and Tailwind CSS

## Vibe Classifications

Enhanced with audio-visual analysis:

- **Party**: (High motion + multiple faces) OR (high audio energy + volume) → Upbeat music (124-136 BPM)
- **Chill**: (Low brightness + minimal motion) OR (quiet audio + low noise) → Relaxed music (80-105 BPM)  
- **Focused**: (Smiles + moderate motion) OR (speech detection + moderate audio energy) → Concentration music (95-120 BPM)
- **Bored**: Low engagement across both visual and audio → Energy boost music + skip action

## Technology Stack

- **Framework**: Next.js 14 with App Router, React, TypeScript
- **Styling**: Tailwind CSS with custom animations
- **Computer Vision**: MediaPipe Face Detection, TensorFlow.js (fallback)
- **Audio Analysis**: Web Audio API with FFT analysis, pitch detection, spectral analysis (inspired by soundDevice)
- **AI Integration**: Anthropic Claude API for audio-visual vibe interpretation
- **Audio**: 
  - ElevenLabs TTS API for speech synthesis
  - Spotify Web Playback SDK for premium users
  - Web Audio API for local playback with dynamics compression
- **Privacy**: Client-side only audio/video analysis, no server-side ML

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file with your API keys:

```env
# Required: Anthropic API for vibe interpretation
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Required: ElevenLabs API for text-to-speech
ELEVEN_API_KEY=your_elevenlabs_api_key_here

# OpenWeatherMap API for weather data
OPENWEATHER_API_KEY=your_openweather_api_key_here

# Optional: Spotify Web API credentials (for premium features)
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

### 3. Get API Keys

#### Anthropic API Key
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an account and add credits
3. Generate an API key in the API Keys section

#### ElevenLabs API Key
1. Visit [elevenlabs.io](https://elevenlabs.io)
2. Sign up for an account (free tier available)
3. Go to Profile → API Key to generate your key

#### OpenWeatherMap API Key
1. Visit [openweathermap.org](https://openweathermap.org/api)
2. Sign up for a free account (1000 calls/day free tier)
3. Generate an API key in your account dashboard

#### Spotify Credentials (Optional)
1. Visit [developer.spotify.com](https://developer.spotify.com)
2. Create an app in your dashboard
3. Note your Client ID and Client Secret
4. Add `http://localhost:3000` to redirect URIs

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

1. **Grant Camera Permission**: Click "Start Vibe Check" and allow webcam access
2. **Live Analysis**: Watch real-time metrics for brightness, motion, faces, and smiles
3. **Vibe Detection**: AI interprets your room's vibe every 1-2 seconds
4. **Music Adaptation**: Volume and track selection adapt based on detected vibe
5. **Voice Coaching**: Hear AI-generated tips through ElevenLabs TTS

## Testing Features

- **Test Spotify**: Enter an access token to test Spotify Web Playback SDK integration
- **Test TTS**: Verify ElevenLabs text-to-speech functionality
- **Privacy Mode**: All video analysis happens locally on your device

## Architecture

### Client-Side Components
- `useVibeSensors`: Webcam capture and computer vision analysis
- `SpotifyClient`: Web Playback SDK integration with volume control
- `LocalAudioPlayer`: Web Audio API with gain control and compression
- `interpretVibe`: Client wrapper for AI vibe interpretation

### Server-Side APIs
- `/api/interpret-vibe`: Anthropic Claude integration for vibe analysis
- `/api/tts`: ElevenLabs text-to-speech conversion

### Audio-Visual Analysis Pipeline

**Computer Vision:**
1. **Frame Capture**: 640x480 webcam feed at ~1 FPS analysis rate
2. **Brightness**: RGB → Luma conversion with rolling average smoothing
3. **Motion Detection**: Frame difference with exponential moving average
4. **Colour Temperature**: R/B ratio estimation (2500K-6500K range)
5. **Face Detection**: MediaPipe Face Detection (with basic fallback)

**Audio Analysis (soundDevice-inspired):**
1. **Audio Capture**: Microphone input with Web Audio API
2. **Volume/Energy**: RMS calculation for overall and spectral energy
3. **Pitch Detection**: Autocorrelation-based fundamental frequency estimation
4. **Spectral Analysis**: FFT-based spectral centroid and rolloff calculation
5. **Speech Detection**: Heuristic-based speech probability estimation
6. **Noise Floor**: Adaptive background noise level estimation

### Privacy & Safety
- **No Upload**: Video frames and audio never leave your device
- **Local Processing**: All computer vision and audio analysis runs in your browser
- **Microphone Privacy**: Explicit permission required, audio analysis is local-only
- **Input Validation**: All API inputs are sanitised and validated
- **Rate Limiting**: Built-in debouncing for API calls and music changes

## Browser Compatibility

- **Chrome/Edge**: Full support including MediaPipe
- **Firefox**: Supported with basic face detection fallback
- **Safari**: Supported with Web Audio API compatibility layer
- **Mobile**: Responsive design, works on tablets and phones

## Troubleshooting

### Camera Issues
- Ensure browser has camera permission
- Try refreshing the page if video doesn't appear
- Check if other applications are using the camera

### API Issues
- Verify API keys are correctly set in `.env.local`
- Check browser console for detailed error messages
- Ensure you have credits/quota remaining for paid APIs

### Audio Issues
- Click anywhere on the page to enable Web Audio (browser requirement)
- Check browser audio permissions
- Ensure speakers/headphones are connected

## Development

### Code Quality
- TypeScript strict mode enabled
- ESLint configuration included
- Zero lint errors required
- Comprehensive error handling

### Performance
- Optimised computer vision (samples every 4th-16th pixel)
- Debounced API calls (volume changes, track skips)
- Efficient React hooks with proper cleanup
- Web Audio API for low-latency audio processing

### Extensibility
- MCP (Model Context Protocol) tool interfaces defined
- Modular architecture for easy feature additions
- Configurable analysis parameters
- Plugin-ready audio system

## License

This project is for demonstration purposes. Please ensure you comply with all API terms of service for Anthropic, ElevenLabs, and Spotify.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper TypeScript types
4. Ensure zero lint errors
5. Test thoroughly across browsers
6. Submit a pull request

## Acknowledgements

- **MediaPipe** for face detection models
- **Anthropic** for Claude AI integration  
- **ElevenLabs** for high-quality text-to-speech
- **Spotify** for Web Playback SDK
- **Next.js & Vercel** for the amazing development framework
