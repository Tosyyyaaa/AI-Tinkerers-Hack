import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { AgnoVibeRequest, AgnoMusicResponse } from '@/lib/types/vibe';

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

// Map vibe characteristics to music style and description
function generateMusicPrompt(request: AgnoVibeRequest): { style: string; description: string } {
  const stats = request.stats;
  const {
    styleIndicator,
    crowdDensity,
    motionLevel,
    lightingPattern,
    dominantColors,
    colorVariance,
    audioEnergy,
    avgBrightness
  } = stats;

  // Determine music style based on detected environment
  let style = 'ambient'; // default
  let energy = 'medium';
  let mood = 'neutral';

  // Style mapping logic
  if (styleIndicator === 'party' || (crowdDensity > 0.6 && motionLevel > 0.5)) {
    style = 'upbeat';
    energy = 'high';
    mood = 'energetic';
  } else if (styleIndicator === 'formal' || styleIndicator === 'professional') {
    style = 'classical';
    energy = 'low';
    mood = 'sophisticated';
  } else if (lightingPattern === 'dim' || avgBrightness < 0.3) {
    style = 'chill';
    energy = 'low';
    mood = 'relaxed';
  } else if (motionLevel > 0.4 && audioEnergy > 0.3) {
    style = 'dynamic';
    energy = 'medium-high';
    mood = 'active';
  } else if (styleIndicator === 'casual' && colorVariance > 0.4) {
    style = 'acoustic';
    energy = 'medium';
    mood = 'friendly';
  } else if (crowdDensity < 0.2 && motionLevel < 0.2) {
    // BORED scenario: low activity detected, generate energetic music to boost the mood
    style = 'upbeat';
    energy = 'high';
    mood = 'energetic boost';
  } else if (audioEnergy < 0.2 && motionLevel < 0.3) {
    // Additional BORED scenario: low audio and motion, need energy boost
    style = 'dynamic';
    energy = 'high';
    mood = 'energetic boost';
  }

  // Enhance style based on lighting and colors
  if (lightingPattern === 'strobe' || lightingPattern === 'dynamic') {
    if (style === 'upbeat') style = 'electronic';
    energy = 'high';
  }

  // Generate description based on analysis
  const colorDescription = dominantColors.length > 0 ?
    `with ${dominantColors.length > 2 ? 'vibrant and varied' : 'harmonious'} color palette` :
    'with natural lighting';

  const crowdDescription = crowdDensity > 0.6 ? 'bustling crowd energy' :
                          crowdDensity > 0.3 ? 'moderate social activity' :
                          'intimate and personal atmosphere';

  const lightingDescription = lightingPattern === 'strobe' ? 'dynamic flashing lights' :
                             lightingPattern === 'dynamic' ? 'shifting ambient lighting' :
                             lightingPattern === 'dim' ? 'soft dim lighting' :
                             'steady bright lighting';

  let description = `${energy} energy ${style} music for a ${mood} environment with ${crowdDescription}, ${lightingDescription}, and ${colorDescription}. Motion level: ${Math.round(motionLevel * 100)}%, Audio energy: ${Math.round(audioEnergy * 100)}%`;

  // Special description for bored/low activity scenarios
  if (mood === 'energetic boost') {
    description = `${energy} energy ${style} music to energize a quiet environment and boost the mood. Low activity detected (motion: ${Math.round(motionLevel * 100)}%, crowd: ${Math.round(crowdDensity * 100)}%) - generating uplifting music to create excitement and engagement`;
  }

  return { style, description };
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

    const { style: promptStyle, description: promptDescription } = generateMusicPrompt(body);

    let agentData: any;
    let agentAvailable = true;

    try {
      // Call the Agno agent's specialized vibe music endpoint
      const agentResponse = await fetch(`${AGNO_AGENT_URL}/api/vibe/generate-music`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(
              {
                  ...body,
                  stats: {
                      ...body.stats,
                  },
                  promptMetadata: {
                      style: promptStyle,
                      description: promptDescription,
                  },
              }
          ),
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
        vibeDescription: `Music agent offline. Using ${promptStyle} style for current vibe.`,
        music: null // No generated music when agent is offline
      };
    }

    // Prepare base response
    const response: AgnoMusicResponse = {
      success: agentData.success || false,
      music: agentData.music ? { ...agentData.music } : undefined,
      vibeDescription: agentData.vibeDescription || (agentAvailable ? 'Music generation completed' : 'Music agent offline - using fallback playlist'),
      error: agentData.error,
      agentAvailable
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
      response.music.style = response.music.style || promptStyle;
      const sanitizedSummary = agentData.music?.displaySummary
        || `AI-generated ${response.music.style || promptStyle} track tailored to the detected vibe.`;

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
