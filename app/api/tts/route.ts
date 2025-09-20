import { NextRequest, NextResponse } from 'next/server';
import { TTSRequest } from '@/lib/types/vibe';

// Available ElevenLabs voices for coaching
const COACHING_VOICES = {
  'adam': 'pNInz6obpgDQGcFmaJgB', // Adam - warm, friendly
  'bella': 'EXAVITQu4vr4xnSDxMaL', // Bella - confident, energetic
  'callum': 'N2lVS1w4EtoT3dr4eOWO', // Callum - professional, clear
  'charlie': 'IKne3meq5aSn9XLyUdCD', // Charlie - upbeat, motivational
  'emily': 'LcfcDJNUP1GQjkzn1xUU', // Emily - supportive, calm
} as const;

const DEFAULT_VOICE_ID = COACHING_VOICES.charlie; // Motivational voice for coaching
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5'; // Faster, optimised model

// Validate TTS request
function validateTTSRequest(data: any): TTSRequest | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const { text, voiceId, modelId } = data;

  // Validate required text field
  if (typeof text !== 'string' || text.length === 0 || text.length > 1000) {
    return null;
  }

  // Validate optional fields
  if (voiceId && (typeof voiceId !== 'string' || voiceId.length > 50)) {
    return null;
  }

  if (modelId && (typeof modelId !== 'string' || modelId.length > 50)) {
    return null;
  }

  // Resolve voice name to ID if needed
  const resolvedVoiceId = voiceId ? 
    (COACHING_VOICES[voiceId as keyof typeof COACHING_VOICES] || voiceId) : 
    DEFAULT_VOICE_ID;

  return {
    text: text.trim(),
    voiceId: resolvedVoiceId,
    modelId: modelId || DEFAULT_MODEL_ID,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.ELEVEN_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const ttsRequest = validateTTSRequest(body);
    
    if (!ttsRequest) {
      return NextResponse.json(
        { error: 'Invalid TTS request. Text must be 1-1000 characters.' },
        { status: 400 }
      );
    }

    const { text, voiceId, modelId } = ttsRequest;

    try {
      // Call ElevenLabs TTS API
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVEN_API_KEY,
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, errorText);
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Invalid ElevenLabs API key');
        } else if (response.status === 429) {
          throw new Error('ElevenLabs API rate limit exceeded');
        } else if (response.status === 400) {
          throw new Error('Invalid request to ElevenLabs API');
        } else {
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }
      }

      // Get the audio data
      const audioBuffer = await response.arrayBuffer();
      
      if (audioBuffer.byteLength === 0) {
        throw new Error('Empty audio response from ElevenLabs');
      }

      // Return the audio data with proper headers
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (elevenLabsError) {
      console.error('ElevenLabs TTS error:', elevenLabsError);
      
      const errorMessage = elevenLabsError instanceof Error 
        ? elevenLabsError.message 
        : 'Unknown ElevenLabs API error';

      return NextResponse.json(
        { 
          error: 'Text-to-speech failed',
          details: errorMessage,
          fallback: 'Consider using browser speech synthesis as fallback'
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('TTS route error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process TTS request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// GET endpoint for voice options and capabilities
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'voices') {
    // Return available coaching voices
    return NextResponse.json({
      voices: Object.entries(COACHING_VOICES).map(([name, id]) => ({
        name,
        id,
        description: getVoiceDescription(name),
      })),
      default: {
        name: 'charlie',
        id: DEFAULT_VOICE_ID,
        model: DEFAULT_MODEL_ID,
      },
    });
  }

  if (action === 'stream' && process.env.ELEVEN_API_KEY) {
    // For WebSocket streaming, we'd need to upgrade the connection
    // For now, return streaming capability info
    return NextResponse.json({
      streaming: {
        supported: true,
        method: 'http_chunks',
        note: 'WebSocket streaming available via separate endpoint'
      }
    });
  }

  return NextResponse.json({
    error: 'Invalid action. Use ?action=voices or ?action=stream'
  }, { status: 400 });
}

function getVoiceDescription(voiceName: string): string {
  const descriptions = {
    adam: 'Warm and friendly - great for encouraging tips',
    bella: 'Confident and energetic - perfect for party vibes',
    callum: 'Professional and clear - ideal for focused sessions',
    charlie: 'Upbeat and motivational - default coaching voice',
    emily: 'Supportive and calm - excellent for chill moments',
  };
  return descriptions[voiceName as keyof typeof descriptions] || 'Professional coaching voice';
}
