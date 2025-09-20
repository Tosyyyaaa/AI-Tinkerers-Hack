import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { RoomStats, VibeDecision } from '@/lib/types/vibe';

// Initialise Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompt for DJBuddy vibe coach
const SYSTEM_PROMPT = `You are DJBuddy's vibe coach. You receive noisy, smoothed room stats from a webcam.
Decide the room vibe and how to adapt music and coaching.
Keep outputs concise and safe. Always return the JSON schema exactly.`;

// User prompt template
const createUserPrompt = (stats: RoomStats): string => {
  return `Stats JSON:
${JSON.stringify(stats, null, 2)}

Enhanced Rules (using visual + audio data):
- PARTY: (motion > 0.6 AND faces >= 2) OR (audioEnergy > 0.7 AND audioVolume > 0.5) → "party"
- CHILL: (brightness < 0.25 AND motion < 0.3) OR (audioVolume < 0.2 AND noiseLevel < 0.3) → "chill"  
- FOCUSED: (smiles >= 1 AND motion 0.3–0.6) OR (speechProbability > 0.6 AND audioEnergy 0.3–0.6) → "focused"
- BORED: Otherwise, especially if audioVolume < 0.1 AND motion < 0.2 → "bored"

Audio context:
- High audioEnergy + audioVolume = active/energetic environment
- High speechProbability = conversation/meeting mode
- High noiseLevel = noisy/distracting background environment
- Low noiseLevel = clean audio environment with little background interference
- Low audioVolume overall = quiet/inactive space
- Pitch and spectralCentroid help distinguish music vs speech vs noise

Music adaptation:
For "party": BPM 124–136, volume 0.75–0.9, action "keep".
For "chill": BPM 80–105, volume 0.55–0.7, action "keep".
For "focused": BPM 95–120, volume 0.6–0.75, action "keep".
For "bored": BPM +10 over current or jump to energy track, volume 0.8, action "skip".

Return JSON:
{ "vibeLabel": "...", "suggestedBPM": 0, "suggestedVolume": 0, "spokenTip": "...", "action": "keep|skip|drop" }`;
};

// Validate and sanitise input stats
function validateStats(data: any): RoomStats | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const { 
    faces, smiles, avgBrightness, colorTempK, motionLevel,
    audioVolume, audioEnergy, noiseLevel, speechProbability, pitch, spectralCentroid
  } = data;

  // Type and range validation for visual metrics
  if (
    typeof faces !== 'number' || faces < 0 || faces > 50 ||
    typeof smiles !== 'number' || smiles < 0 || smiles > faces ||
    typeof avgBrightness !== 'number' || avgBrightness < 0 || avgBrightness > 1 ||
    typeof colorTempK !== 'number' || colorTempK < 1000 || colorTempK > 10000 ||
    typeof motionLevel !== 'number' || motionLevel < 0 || motionLevel > 1
  ) {
    return null;
  }

  // Audio metrics validation (optional - default to 0 if missing)
  const validAudioVolume = typeof audioVolume === 'number' ? Math.max(0, Math.min(1, audioVolume)) : 0;
  const validAudioEnergy = typeof audioEnergy === 'number' ? Math.max(0, Math.min(1, audioEnergy)) : 0;
  const validNoiseLevel = typeof noiseLevel === 'number' ? Math.max(0, Math.min(1, noiseLevel)) : 0;
  const validSpeechProbability = typeof speechProbability === 'number' ? Math.max(0, Math.min(1, speechProbability)) : 0;
  const validPitch = typeof pitch === 'number' ? Math.max(0, Math.min(8000, pitch)) : 0;
  const validSpectralCentroid = typeof spectralCentroid === 'number' ? Math.max(0, Math.min(8000, spectralCentroid)) : 0;

  // Clamp values to safe ranges
  return {
    faces: Math.floor(Math.max(0, Math.min(20, faces))),
    smiles: Math.floor(Math.max(0, Math.min(faces, smiles))),
    avgBrightness: Math.max(0, Math.min(1, avgBrightness)),
    colorTempK: Math.max(2000, Math.min(8000, colorTempK)),
    motionLevel: Math.max(0, Math.min(1, motionLevel)),
    audioVolume: validAudioVolume,
    audioEnergy: validAudioEnergy,
    noiseLevel: validNoiseLevel,
    speechProbability: validSpeechProbability,
    pitch: validPitch,
    spectralCentroid: validSpectralCentroid,
  };
}

// Validate vibe decision response
function validateVibeDecision(data: any): VibeDecision | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const { vibeLabel, suggestedBPM, suggestedVolume, spokenTip, action } = data;

  // Validate required fields
  if (
    !['party', 'chill', 'focused', 'bored'].includes(vibeLabel) ||
    typeof suggestedBPM !== 'number' || suggestedBPM < 60 || suggestedBPM > 200 ||
    typeof suggestedVolume !== 'number' || suggestedVolume < 0 || suggestedVolume > 1 ||
    typeof spokenTip !== 'string' || spokenTip.length > 200
  ) {
    return null;
  }

  // Validate optional action field
  if (action && !['keep', 'skip', 'drop'].includes(action)) {
    return null;
  }

  return {
    vibeLabel: vibeLabel as 'party' | 'chill' | 'focused' | 'bored',
    suggestedBPM: Math.max(60, Math.min(200, Math.round(suggestedBPM))),
    suggestedVolume: Math.max(0, Math.min(1, suggestedVolume)),
    spokenTip: spokenTip.slice(0, 200), // Truncate if too long
    action: action as 'keep' | 'skip' | 'drop' | undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const stats = validateStats(body.stats);
    
    if (!stats) {
      return NextResponse.json(
        { error: 'Invalid room stats provided' },
        { status: 400 }
      );
    }

    // Create prompts
    const userPrompt = createUserPrompt(stats);

    try {
      // Call Anthropic API
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 300,
        temperature: 0.3, // Low temperature for consistent responses
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extract response text
      const responseText = response.content[0]?.type === 'text' 
        ? response.content[0].text 
        : '';

      if (!responseText) {
        throw new Error('No response text from Anthropic');
      }

      // Parse JSON response
      let vibeData: any;
      try {
        // Try to extract JSON from response (in case there's extra text)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
        vibeData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse Anthropic response:', responseText);
        throw new Error('Invalid JSON response from AI');
      }

      // Validate and sanitise the response
      const decision = validateVibeDecision(vibeData);
      if (!decision) {
        throw new Error('Invalid vibe decision format');
      }

      return NextResponse.json({ decision });

    } catch (anthropicError) {
      console.error('Anthropic API error:', anthropicError);
      
      // Provide fallback decision based on simple heuristics
      const fallbackDecision: VibeDecision = {
        vibeLabel: stats.motionLevel > 0.6 && stats.faces >= 2 ? 'party' :
                   stats.avgBrightness < 0.25 && stats.motionLevel < 0.3 ? 'chill' :
                   stats.smiles >= 1 && stats.motionLevel >= 0.3 && stats.motionLevel <= 0.6 ? 'focused' : 'bored',
        suggestedBPM: stats.motionLevel > 0.6 ? 130 :
                      stats.avgBrightness < 0.25 ? 90 :
                      stats.smiles >= 1 ? 110 : 120,
        suggestedVolume: stats.motionLevel > 0.6 ? 0.85 :
                         stats.avgBrightness < 0.25 ? 0.6 :
                         stats.smiles >= 1 ? 0.7 : 0.8,
        spokenTip: 'AI temporarily unavailable, using basic vibe detection.',
        action: 'keep',
      };

      return NextResponse.json({ 
        decision: fallbackDecision,
        warning: 'Using fallback vibe analysis'
      });
    }

  } catch (error) {
    console.error('Vibe interpretation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to interpret vibe',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle CORS for client-side requests
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
