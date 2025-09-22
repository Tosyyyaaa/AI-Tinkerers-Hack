import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { AgnoVibeRequest, AgnoMusicResponse } from '@/lib/types/vibe';
import { buildCreativeMusicBrief, BRIEF_VERSION } from '@/lib/vibe/musicBrief';

export const runtime = 'nodejs';

const AGNO_AGENT_URL = process.env.AGNO_AGENT_URL || 'http://localhost:7777';

const DEFAULT_AUDIO_MIME = 'audio/mpeg';

function inferMimeType(filePath?: string): string {
  if (!filePath) return DEFAULT_AUDIO_MIME;
  const extension = extname(filePath).toLowerCase();

  switch (extension) {
    case '.mp3':
    case '.mpeg':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.aac':
      return 'audio/aac';
    case '.m4a':
    case '.mp4':
      return 'audio/mp4';
    default:
      return DEFAULT_AUDIO_MIME;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AgnoVibeRequest = await request.json();

    if (!body.stats) {
      return NextResponse.json({
        success: false,
        error: 'Missing stats in request body'
      }, { status: 400 });
    }

    const { brief, promptMetadata } = buildCreativeMusicBrief(body);

    const enrichedRequest: AgnoVibeRequest = {
      ...body,
      context: {
        ...body.context,
        briefVersion: BRIEF_VERSION,
      },
      promptMetadata,
      brief,
    };

    let agentData: any;
    let agentAvailable = true;

    try {
      // Call the Agno agent's specialized vibe music endpoint
      const agentResponse = await fetch(`${AGNO_AGENT_URL}/api/vibe/generate-music`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(enrichedRequest),
          signal: AbortSignal.timeout(180000) // 3 minute timeout for music generation
      });

      if (!agentResponse.ok) {
        throw new Error(`Agno agent responded with status: ${agentResponse.status}`);
      }

      agentData = await agentResponse.json();
    } catch (agentError) {
      console.warn('Agno agent unavailable, providing fallback response:', agentError);
      agentAvailable = false;

      // Provide fallback response when agent is unavailable
      agentData = {
        success: true,
        vibeDescription: `Music agent offline. Using ${brief.style} style for current vibe.`,
        music: null, // No generated music when agent is offline
        fallback: {
          strategy: 'local_playlist',
          reason: 'agent_offline',
          suggestedStyle: brief.style,
        },
      };
    }

    // Prepare base response
    const response: AgnoMusicResponse = {
      success: agentData.success || false,
      music: agentData.music ? { ...agentData.music } : undefined,
      vibeDescription: agentData.vibeDescription || (agentAvailable ? 'Music generation completed' : 'Music agent offline - using fallback playlist'),
      error: agentData.error,
      agentAvailable,
      fallback: agentData.fallback,
    };

    // Attach playable audio data when available
    if (response.music?.url) {
      const filePath: string = response.music.url;

      try {
        const fileBuffer = await readFile(filePath);
        const mimeType = inferMimeType(filePath || response.music.filename);
        const audioBase64 = fileBuffer.toString('base64');

        response.music.localPath = filePath;
        response.music.mimeType = mimeType;
        response.music.sizeBytes = fileBuffer.byteLength;
        response.music.audioBase64 = audioBase64;
        response.music.dataUrl = `data:${mimeType};base64,${audioBase64}`;
      } catch (fileError) {
        console.error('Failed to read generated music file:', fileError);
      }
    }

    if (response.music) {
      response.music.style = response.music.style || brief.style;
      const sanitizedSummary = agentData.music?.displaySummary
        || `AI-generated ${response.music.style || brief.style} track tailored to the detected vibe.`;

      response.music.description = sanitizedSummary;
      response.music.source = 'elevenlabs';
      response.music.generatedAt = Date.now();

      // Remove any internal prompt fields before sending to the client
      if ('prompt' in response.music) {
        delete (response.music as Record<string, unknown>).prompt;
      }
      if ('rawPrompt' in response.music) {
        delete (response.music as Record<string, unknown>).rawPrompt;
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Vibe music generation error:', error);

    const errorResponse: AgnoMusicResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Vibe music generation endpoint',
    methods: ['POST'],
    description: 'Send vibe statistics to generate appropriate music using AI agent'
  });
}
