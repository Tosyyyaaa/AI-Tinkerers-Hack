'use client';

import { RoomStats, VibeDecision } from '@/lib/types/vibe';
import { interpretVibe, speakCoachingTip, performVibeCheck } from '@/lib/vibe/interpretVibe';
import { getAdaptivePlayer } from '@/lib/audio/adaptivePlayer';

/**
 * MCP (Model Context Protocol) Tool Definitions for Daedalus Labs Integration
 * 
 * This module provides standardized tool interfaces that can be called by external
 * MCP-compatible systems like Daedalus Labs tools.
 * 
 * Each tool follows the MCP specification:
 * - name: Unique identifier for the tool
 * - description: Human-readable description of what the tool does
 * - inputSchema: JSON Schema defining expected input parameters
 * - handler: Function that executes the tool logic
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Tool 1: Interpret Vibe from Room Statistics
export const INTERPRET_VIBE_TOOL: MCPTool = {
  name: 'interpret_vibe',
  description: 'Analyze room statistics from webcam/audio sensors and return vibe decision with music recommendations',
  inputSchema: {
    type: 'object',
    properties: {
      stats: {
        type: 'object',
        properties: {
          faces: { 
            type: 'number', 
            minimum: 0, 
            maximum: 50,
            description: 'Number of faces detected in the video feed'
          },
          smiles: { 
            type: 'number', 
            minimum: 0, 
            maximum: 50,
            description: 'Number of smiling faces detected'
          },
          avgBrightness: { 
            type: 'number', 
            minimum: 0, 
            maximum: 1,
            description: 'Average brightness level of the video feed (0-1)'
          },
          colorTempK: { 
            type: 'number', 
            minimum: 1000, 
            maximum: 10000,
            description: 'Color temperature in Kelvin (lighting warmth/coolness)'
          },
          motionLevel: { 
            type: 'number', 
            minimum: 0, 
            maximum: 1,
            description: 'Amount of motion detected in the video feed (0-1)'
          },
          audioVolume: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Overall audio volume level (optional)'
          },
          audioEnergy: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Audio energy/RMS level (optional)'
          },
          noiseLevel: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Background noise estimation (optional)'
          },
          speechProbability: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Likelihood of speech content (optional)'
          },
          pitch: {
            type: 'number',
            minimum: 0,
            maximum: 8000,
            description: 'Fundamental frequency in Hz (optional)'
          },
          spectralCentroid: {
            type: 'number',
            minimum: 0,
            maximum: 8000,
            description: 'Brightness of sound in Hz (optional)'
          },
        },
        required: ['faces', 'smiles', 'avgBrightness', 'colorTempK', 'motionLevel'],
        description: 'Room statistics from webcam and audio analysis'
      },
      options: {
        type: 'object',
        properties: {
          timeout: { type: 'number', minimum: 1000, maximum: 30000 },
          retries: { type: 'number', minimum: 0, maximum: 5 },
          fallbackEnabled: { type: 'boolean' },
        },
        description: 'Optional configuration for vibe interpretation'
      }
    },
    required: ['stats'],
  },
};

export async function handleInterpretVibe(input: any): Promise<MCPToolResult> {
  try {
    const { stats, options = {} } = input;
    
    // Validate input stats
    if (!stats || typeof stats !== 'object') {
      return {
        success: false,
        error: 'Invalid stats object provided',
      };
    }

    // Call the vibe interpretation function
    const decision = await interpretVibe(stats as RoomStats, options);
    
    return {
      success: true,
      data: {
        decision,
        timestamp: Date.now(),
        playerType: getAdaptivePlayer().getActivePlayerType(),
      },
      metadata: {
        model: 'claude-3-5-sonnet-latest',
        processingTime: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in vibe interpretation',
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

// Tool 2: Text-to-Speech for Coaching Tips
export const SPEAK_COACH_TOOL: MCPTool = {
  name: 'speak_coach',
  description: 'Convert coaching text to speech using ElevenLabs TTS and play it through the audio system',
  inputSchema: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        minLength: 1,
        maxLength: 1000,
        description: 'Text to convert to speech (1-1000 characters)'
      },
      voiceId: { 
        type: 'string',
        enum: ['adam', 'bella', 'callum', 'charlie', 'emily'],
        description: 'Voice to use for TTS (optional, defaults to charlie)'
      },
      modelId: { 
        type: 'string',
        description: 'ElevenLabs model ID to use (optional)'
      },
      playImmediately: {
        type: 'boolean',
        description: 'Whether to play the audio immediately (default: true)'
      },
    },
    required: ['text'],
  },
};

export async function handleSpeakCoach(input: any): Promise<MCPToolResult> {
  try {
    const { text, voiceId, modelId, playImmediately = true } = input;
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        success: false,
        error: 'Invalid text provided for TTS',
      };
    }

    // Generate TTS audio
    const audioBuffer = await speakCoachingTip(text.trim(), voiceId, modelId);
    
    let playbackSuccess = false;
    if (playImmediately) {
      // Play the audio through the adaptive player
      const player = getAdaptivePlayer();
      playbackSuccess = await player.playTTS(audioBuffer);
    }
    
    return {
      success: true,
      data: {
        text: text.trim(),
        voiceId: voiceId || 'charlie',
        audioBufferSize: audioBuffer.byteLength,
        playbackSuccess: playImmediately ? playbackSuccess : null,
      },
      metadata: {
        timestamp: Date.now(),
        ttsProvider: 'elevenlabs',
        audioFormat: 'mp3',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in TTS generation',
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

// Tool 3: Adapt Music Playback Based on Vibe
export const ADAPT_PLAYBACK_TOOL: MCPTool = {
  name: 'adapt_playback',
  description: 'Adapt music playback (volume, track selection) based on vibe decision using Spotify or local player',
  inputSchema: {
    type: 'object',
    properties: {
      decision: {
        type: 'object',
        properties: {
          vibeLabel: { 
            type: 'string', 
            enum: ['party', 'chill', 'focused', 'bored'],
            description: 'The detected vibe category'
          },
          suggestedBPM: { 
            type: 'number', 
            minimum: 60, 
            maximum: 200,
            description: 'Recommended beats per minute for the music'
          },
          suggestedVolume: { 
            type: 'number', 
            minimum: 0, 
            maximum: 1,
            description: 'Recommended volume level (0-1)'
          },
          spokenTip: { 
            type: 'string', 
            maxLength: 200,
            description: 'Coaching tip text'
          },
          action: { 
            type: 'string', 
            enum: ['keep', 'skip', 'drop'],
            description: 'Action to take with current track (optional)'
          },
        },
        required: ['vibeLabel', 'suggestedBPM', 'suggestedVolume', 'spokenTip'],
        description: 'Vibe decision object with music recommendations'
      },
      forcePlayer: {
        type: 'string',
        enum: ['spotify', 'local', 'auto'],
        description: 'Force a specific player type (optional, defaults to auto)'
      },
    },
    required: ['decision'],
  },
};

export async function handleAdaptPlayback(input: any): Promise<MCPToolResult> {
  try {
    const { decision, forcePlayer = 'auto' } = input;
    
    if (!decision || typeof decision !== 'object') {
      return {
        success: false,
        error: 'Invalid decision object provided',
      };
    }

    // Validate decision structure
    const requiredFields = ['vibeLabel', 'suggestedBPM', 'suggestedVolume', 'spokenTip'];
    for (const field of requiredFields) {
      if (!(field in decision)) {
        return {
          success: false,
          error: `Missing required field: ${field}`,
        };
      }
    }

    // Get the adaptive player
    const player = getAdaptivePlayer();
    const currentState = player.getCurrentState();
    
    // Apply the playback adaptation
    const success = await player.adaptPlayback(decision as VibeDecision);
    const newState = player.getCurrentState();
    
    return {
      success,
      data: {
        vibeLabel: decision.vibeLabel,
        appliedChanges: {
          volumeChanged: Math.abs(currentState.currentVolume - newState.currentVolume) > 0.01,
          trackChanged: currentState.currentTrack?.id !== newState.currentTrack?.id,
          playerUsed: newState.activePlayer,
        },
        currentState: newState,
      },
      metadata: {
        timestamp: Date.now(),
        playerType: newState.activePlayer,
        spotifyAvailable: currentState.isSpotifyAvailable,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in playback adaptation',
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

// Tool 4: Complete Vibe Check Workflow
export const VIBE_CHECK_TOOL: MCPTool = {
  name: 'vibe_check',
  description: 'Perform complete vibe check workflow: analyze stats, generate decision, speak tip, and adapt playback',
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
          audioVolume: { type: 'number', minimum: 0, maximum: 1 },
          audioEnergy: { type: 'number', minimum: 0, maximum: 1 },
          noiseLevel: { type: 'number', minimum: 0, maximum: 1 },
          speechProbability: { type: 'number', minimum: 0, maximum: 1 },
          pitch: { type: 'number', minimum: 0, maximum: 8000 },
          spectralCentroid: { type: 'number', minimum: 0, maximum: 8000 },
        },
        required: ['faces', 'smiles', 'avgBrightness', 'colorTempK', 'motionLevel'],
      },
      options: {
        type: 'object',
        properties: {
          speakTip: { type: 'boolean', description: 'Whether to speak the coaching tip' },
          adaptPlayback: { type: 'boolean', description: 'Whether to adapt music playback' },
          voiceId: { type: 'string', enum: ['adam', 'bella', 'callum', 'charlie', 'emily'] },
        },
      },
    },
    required: ['stats'],
  },
};

export async function handleVibeCheck(input: any): Promise<MCPToolResult> {
  try {
    const { stats, options = {} } = input;
    const { speakTip = true, adaptPlayback = true, voiceId } = options;
    
    // Perform complete vibe check workflow
    const result = await performVibeCheck(stats as RoomStats, {
      timeout: 8000,
      retries: 1,
      fallbackEnabled: true,
    });

    let ttsSuccess = false;
    let playbackSuccess = false;

    // Speak the coaching tip if requested and audio is available
    if (speakTip && result.audioBuffer) {
      const player = getAdaptivePlayer();
      ttsSuccess = await player.playTTS(result.audioBuffer);
    }

    // Adapt playback if requested
    if (adaptPlayback) {
      const player = getAdaptivePlayer();
      playbackSuccess = await player.adaptPlayback(result.decision);
    }

    return {
      success: true,
      data: {
        decision: result.decision,
        ttsSuccess,
        playbackSuccess,
        hasAudio: !!result.audioBuffer,
        error: result.error,
      },
      metadata: {
        timestamp: Date.now(),
        playerType: getAdaptivePlayer().getActivePlayerType(),
        workflow: 'complete',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in vibe check workflow',
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

// MCP Tool Registry
export const MCP_TOOLS: Record<string, MCPTool> = {
  interpret_vibe: INTERPRET_VIBE_TOOL,
  speak_coach: SPEAK_COACH_TOOL,
  adapt_playback: ADAPT_PLAYBACK_TOOL,
  vibe_check: VIBE_CHECK_TOOL,
};

// MCP Tool Handler Registry
export const MCP_HANDLERS: Record<string, (input: any) => Promise<MCPToolResult>> = {
  interpret_vibe: handleInterpretVibe,
  speak_coach: handleSpeakCoach,
  adapt_playback: handleAdaptPlayback,
  vibe_check: handleVibeCheck,
};

/**
 * Main MCP tool dispatcher
 * This function would be called by the MCP server when a tool is invoked
 * 
 * Example usage from Daedalus Labs:
 * ```
 * const result = await mcpToolCall('interpret_vibe', {
 *   stats: {
 *     faces: 2,
 *     smiles: 1,
 *     avgBrightness: 0.7,
 *     colorTempK: 3000,
 *     motionLevel: 0.8,
 *     audioVolume: 0.6,
 *     audioEnergy: 0.7
 *   }
 * });
 * ```
 */
export async function mcpToolCall(toolName: string, input: any): Promise<MCPToolResult> {
  const handler = MCP_HANDLERS[toolName];
  
  if (!handler) {
    return {
      success: false,
      error: `Unknown MCP tool: ${toolName}`,
      metadata: {
        availableTools: Object.keys(MCP_TOOLS),
        timestamp: Date.now(),
      },
    };
  }

  try {
    return await handler(input);
  } catch (error) {
    return {
      success: false,
      error: `MCP tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        toolName,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Get tool definitions for MCP server registration
 * This would be called during MCP server initialization
 */
export function getMCPToolDefinitions(): MCPTool[] {
  return Object.values(MCP_TOOLS);
}

/**
 * Example MCP integration comment for Daedalus Labs:
 * 
 * To integrate with Daedalus Labs MCP system:
 * 
 * 1. Register tools during server startup:
 * ```javascript
 * import { getMCPToolDefinitions } from './lib/mcp/vibeTools';
 * 
 * const tools = getMCPToolDefinitions();
 * mcpServer.registerTools(tools);
 * ```
 * 
 * 2. Handle tool calls:
 * ```javascript
 * import { mcpToolCall } from './lib/mcp/vibeTools';
 * 
 * mcpServer.onToolCall(async (toolName, input) => {
 *   return await mcpToolCall(toolName, input);
 * });
 * ```
 * 
 * 3. Example tool usage from external MCP client:
 * ```javascript
 * // Perform vibe analysis
 * const vibeResult = await mcpClient.callTool('interpret_vibe', {
 *   stats: roomStats
 * });
 * 
 * // Speak coaching tip
 * const ttsResult = await mcpClient.callTool('speak_coach', {
 *   text: "Great energy in the room! Let's keep it going!",
 *   voiceId: 'charlie'
 * });
 * 
 * // Adapt playback
 * const playbackResult = await mcpClient.callTool('adapt_playback', {
 *   decision: vibeResult.data.decision
 * });
 * ```
 */
