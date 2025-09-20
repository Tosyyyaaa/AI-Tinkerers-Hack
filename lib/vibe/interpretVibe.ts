'use client';

import { RoomStats, VibeDecision, MCPVibeTools, MCPTool } from '@/lib/types/vibe';

export interface InterpretVibeOptions {
  timeout?: number; // Request timeout in milliseconds
  retries?: number; // Number of retry attempts
  fallbackEnabled?: boolean; // Enable fallback interpretation
}

const DEFAULT_OPTIONS: Required<InterpretVibeOptions> = {
  timeout: 5000, // 5 seconds
  retries: 2,
  fallbackEnabled: true,
};

// MCP (Model Context Protocol) tool definitions
// These provide interfaces for external tools to call our vibe functions
export const MCP_VIBE_TOOLS: MCPVibeTools = {
  interpretVibe: {
    name: 'interpret_vibe',
    description: 'Analyse room statistics and return vibe decision with music recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        stats: {
          type: 'object',
          properties: {
            faces: { type: 'number', minimum: 0, maximum: 50 },
            smiles: { type: 'number', minimum: 0, maximum: 50 },
            avgBrightness: { type: 'number', minimum: 0, maximum: 1 },
            colorTempK: { type: 'number', minimum: 1000, maximum: 10000 },
            motionLevel: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['faces', 'smiles', 'avgBrightness', 'colorTempK', 'motionLevel'],
        },
      },
      required: ['stats'],
    },
  },
  speakCoach: {
    name: 'speak_coach',
    description: 'Convert text to speech using ElevenLabs TTS for coaching tips',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', maxLength: 1000 },
        voiceId: { type: 'string', optional: true },
        modelId: { type: 'string', optional: true },
      },
      required: ['text'],
    },
  },
  adaptPlayback: {
    name: 'adapt_playback',
    description: 'Adapt music playback based on vibe decision (Spotify or local player)',
    inputSchema: {
      type: 'object',
      properties: {
        decision: {
          type: 'object',
          properties: {
            vibeLabel: { type: 'string', enum: ['party', 'chill', 'focused', 'bored'] },
            suggestedBPM: { type: 'number', minimum: 60, maximum: 200 },
            suggestedVolume: { type: 'number', minimum: 0, maximum: 1 },
            spokenTip: { type: 'string', maxLength: 200 },
            action: { type: 'string', enum: ['keep', 'skip', 'drop'], optional: true },
          },
          required: ['vibeLabel', 'suggestedBPM', 'suggestedVolume', 'spokenTip'],
        },
        preferSpotify: { type: 'boolean', optional: true },
      },
      required: ['decision'],
    },
  },
};

// Fallback vibe interpretation using simple heuristics
function generateFallbackDecision(stats: RoomStats): VibeDecision {
  const { 
    faces, smiles, avgBrightness, colorTempK, motionLevel,
    audioVolume, audioEnergy, noiseLevel, speechProbability, pitch, spectralCentroid
  } = stats;

  // Enhanced rules including audio analysis
  let vibeLabel: VibeDecision['vibeLabel'];
  let suggestedBPM: number;
  let suggestedVolume: number;
  let action: VibeDecision['action'] = 'keep';

  // PARTY: High visual motion + faces OR high audio energy + volume
  if ((motionLevel > 0.6 && faces >= 2) || (audioEnergy > 0.7 && audioVolume > 0.5)) {
    vibeLabel = 'party';
    suggestedBPM = 124 + Math.floor(Math.random() * 12); // 124-136
    suggestedVolume = 0.75 + Math.random() * 0.15; // 0.75-0.9
  } 
  // CHILL: Low brightness + motion OR quiet, clean audio environment
  else if ((avgBrightness < 0.25 && motionLevel < 0.3) || (audioVolume < 0.2 && noiseLevel < 0.3)) {
    vibeLabel = 'chill';
    suggestedBPM = 80 + Math.floor(Math.random() * 25); // 80-105
    suggestedVolume = 0.55 + Math.random() * 0.15; // 0.55-0.7
  } 
  // FOCUSED: Smiles + moderate motion OR high speech probability + moderate audio energy
  else if ((smiles >= 1 && motionLevel >= 0.3 && motionLevel <= 0.6) || 
           (speechProbability > 0.6 && audioEnergy >= 0.3 && audioEnergy <= 0.6)) {
    vibeLabel = 'focused';
    suggestedBPM = 95 + Math.floor(Math.random() * 25); // 95-120
    suggestedVolume = 0.6 + Math.random() * 0.15; // 0.6-0.75
  } 
  // BORED: Low activity across both visual and audio
  else {
    vibeLabel = 'bored';
    suggestedBPM = 120 + Math.floor(Math.random() * 20); // 120-140 (higher energy)
    suggestedVolume = 0.8;
    // More likely to skip if both audio and visual are very low
    if (audioVolume < 0.1 && motionLevel < 0.2) {
      action = 'skip';
    }
  }

  // Generate contextual spoken tips based on audio + visual analysis
  const tips = {
    party: audioEnergy > 0.7 ? [
      "High energy detected! The audio's pumping!",
      "Great party vibes - music and movement in sync!",
      "Everyone's active - perfect dance energy!",
    ] : [
      "Visual party energy detected! Let's get loud!",
      "Great movement - adding some audio energy!",
      "Party vibes building - turn it up!",
    ],
    chill: audioVolume < 0.2 && noiseLevel < 0.3 ? [
      "Quiet, clean space detected - perfect for relaxation.",
      "Low noise environment - ideal for chilling.",
      "Peaceful, undisturbed vibes - great for unwinding.",
    ] : [
      "Cosy visual atmosphere - keeping it mellow.",
      "Relaxed lighting - perfect for background music.",
      "Chill vibes detected - staying low-key.",
    ],
    focused: speechProbability > 0.6 ? [
      "Conversation detected - maintaining focus music.",
      "Speech activity - perfect concentration environment.",
      "Meeting mode - keeping the background steady.",
    ] : [
      "Good focus energy - visual concentration detected!",
      "Balanced atmosphere for productivity.",
      "Steady vibes - perfect for getting things done.",
    ],
    bored: audioVolume < 0.1 && motionLevel < 0.2 ? [
      "Very quiet space - time for an energy boost!",
      "Low activity detected - let's wake things up!",
      "Silent room needs some life - switching tracks!",
    ] : noiseLevel > 0.7 ? [
      "Noisy environment detected - adding clear, energetic music!",
      "Background noise present - boosting the signal!",
      "Cutting through the noise with better vibes!",
    ] : [
      "Low engagement detected - adding some energy!",
      "Time to shake things up a bit!",
      "Let's bring some excitement to the room!",
    ],
  };

  const spokenTip = tips[vibeLabel][Math.floor(Math.random() * tips[vibeLabel].length)];

  return {
    vibeLabel,
    suggestedBPM,
    suggestedVolume: Math.min(1, Math.max(0, suggestedVolume)),
    spokenTip,
    action,
  };
}

// Main interpretation function
export async function interpretVibe(
  stats: RoomStats,
  options: InterpretVibeOptions = {}
): Promise<VibeDecision> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate input stats
  if (!stats || typeof stats !== 'object') {
    throw new Error('Invalid room stats provided');
  }

  const { 
    faces, smiles, avgBrightness, colorTempK, motionLevel,
    audioVolume, audioEnergy, noiseLevel, speechProbability, pitch, spectralCentroid
  } = stats;
  
  if (
    typeof faces !== 'number' || faces < 0 ||
    typeof smiles !== 'number' || smiles < 0 ||
    typeof avgBrightness !== 'number' || avgBrightness < 0 || avgBrightness > 1 ||
    typeof colorTempK !== 'number' || colorTempK < 1000 || colorTempK > 10000 ||
    typeof motionLevel !== 'number' || motionLevel < 0 || motionLevel > 1 ||
    // Audio metrics (optional but must be valid if present)
    (audioVolume !== undefined && (typeof audioVolume !== 'number' || audioVolume < 0 || audioVolume > 1)) ||
    (audioEnergy !== undefined && (typeof audioEnergy !== 'number' || audioEnergy < 0 || audioEnergy > 1)) ||
    (noiseLevel !== undefined && (typeof noiseLevel !== 'number' || noiseLevel < 0 || noiseLevel > 1)) ||
    (speechProbability !== undefined && (typeof speechProbability !== 'number' || speechProbability < 0 || speechProbability > 1)) ||
    (pitch !== undefined && (typeof pitch !== 'number' || pitch < 0 || pitch > 8000)) ||
    (spectralCentroid !== undefined && (typeof spectralCentroid !== 'number' || spectralCentroid < 0 || spectralCentroid > 8000))
  ) {
    throw new Error('Room stats contain invalid values');
  }

  // Try AI interpretation with retries
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      const response = await fetch('/api/interpret-vibe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stats }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.decision) {
        throw new Error('No decision returned from API');
      }

      // Validate the returned decision
      const decision = data.decision as VibeDecision;
      if (
        !['party', 'chill', 'focused', 'bored'].includes(decision.vibeLabel) ||
        typeof decision.suggestedBPM !== 'number' ||
        typeof decision.suggestedVolume !== 'number' ||
        typeof decision.spokenTip !== 'string'
      ) {
        throw new Error('Invalid decision format from API');
      }

      return decision;

    } catch (error) {
      console.warn(`Vibe interpretation attempt ${attempt + 1} failed:`, error);
      
      // If this is the last attempt and fallback is enabled, use fallback
      if (attempt === opts.retries && opts.fallbackEnabled) {
        console.log('Using fallback vibe interpretation');
        return generateFallbackDecision(stats);
      }
      
      // If this is not the last attempt, continue to retry
      if (attempt < opts.retries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      
      // If fallback is disabled and all retries failed, throw error
      throw error;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Unexpected error in vibe interpretation');
}

// TTS function wrapper
export async function speakCoachingTip(
  text: string,
  voiceId?: string,
  modelId?: string
): Promise<ArrayBuffer> {
  if (!text || text.length === 0) {
    throw new Error('No text provided for TTS');
  }

  if (text.length > 1000) {
    throw new Error('Text too long for TTS (max 1000 characters)');
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        voiceId,
        modelId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `TTS API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    if (audioBuffer.byteLength === 0) {
      throw new Error('Empty audio response from TTS API');
    }

    return audioBuffer;

  } catch (error) {
    console.error('TTS error:', error);
    throw error;
  }
}

// Complete vibe check workflow
export async function performVibeCheck(
  stats: RoomStats,
  options: InterpretVibeOptions = {}
): Promise<{
  decision: VibeDecision;
  audioBuffer?: ArrayBuffer;
  error?: string;
}> {
  try {
    // Get vibe decision
    const decision = await interpretVibe(stats, options);
    
    // Get TTS audio for the spoken tip
    let audioBuffer: ArrayBuffer | undefined;
    try {
      audioBuffer = await speakCoachingTip(decision.spokenTip);
    } catch (ttsError) {
      console.warn('TTS failed, continuing without audio:', ttsError);
      // Don't fail the whole vibe check if TTS fails
    }

    return {
      decision,
      audioBuffer,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Vibe check failed:', errorMessage);
    
    return {
      decision: generateFallbackDecision(stats),
      error: errorMessage,
    };
  }
}

// MCP tool handler (for external tools to call)
// TODO: Wire this up to actual MCP server when implementing full MCP integration
export function handleMCPToolCall(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'interpret_vibe':
      return interpretVibe(args.stats);
    
    case 'speak_coach':
      return speakCoachingTip(args.text, args.voiceId, args.modelId);
    
    case 'adapt_playback':
      // This would integrate with Spotify or local player
      // Implementation depends on which player is available
      return Promise.resolve({ success: true, message: 'Playback adapted' });
    
    default:
      return Promise.reject(new Error(`Unknown MCP tool: ${toolName}`));
  }
}
