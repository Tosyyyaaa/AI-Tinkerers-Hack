import { NextRequest, NextResponse } from 'next/server';
import { RoomStats, VibeDecision } from '@/lib/types/vibe';

// Enhanced vibe analysis function using heuristics
function analyzeVibeFromStats(stats: RoomStats): VibeDecision {
  // PARTY: High motion and crowd density OR high audio energy and volume
  if ((stats.motionLevel > 0.6 && stats.crowdDensity > 0.5) ||
      (stats.audioEnergy > 0.7 && stats.audioVolume > 0.5)) {
    return {
      vibeLabel: 'party',
      suggestedBPM: 124 + Math.floor(Math.random() * 13), // 124-136
      suggestedVolume: 0.75 + (Math.random() * 0.15), // 0.75-0.9
      spokenTip: 'Party vibes detected! Keep the energy high!',
      action: 'keep',
    };
  }

  // CHILL: Low brightness and motion OR low audio activity
  if ((stats.avgBrightness < 0.25 && stats.motionLevel < 0.3) ||
      (stats.audioVolume < 0.2 && stats.noiseLevel < 0.3)) {
    return {
      vibeLabel: 'chill',
      suggestedBPM: 80 + Math.floor(Math.random() * 26), // 80-105
      suggestedVolume: 0.55 + (Math.random() * 0.15), // 0.55-0.7
      spokenTip: 'Chill vibes detected. Perfect for relaxation.',
      action: 'keep',
    };
  }

  // FOCUSED: Moderate crowd density and motion OR high speech probability
  if ((stats.crowdDensity >= 0.3 && stats.motionLevel >= 0.3 && stats.motionLevel <= 0.6) ||
      (stats.speechProbability > 0.6 && stats.audioEnergy >= 0.3 && stats.audioEnergy <= 0.6)) {
    return {
      vibeLabel: 'focused',
      suggestedBPM: 95 + Math.floor(Math.random() * 26), // 95-120
      suggestedVolume: 0.6 + (Math.random() * 0.15), // 0.6-0.75
      spokenTip: 'Focus mode activated. Great for productivity!',
      action: 'keep',
    };
  }

  // BORED: Default case, especially low activity
  return {
    vibeLabel: 'bored',
    suggestedBPM: 120 + Math.floor(Math.random() * 16), // 120-135 (energy boost)
    suggestedVolume: 0.8,
    spokenTip: 'Things seem quiet. Let\'s boost the energy!',
    action: 'skip',
  };
}

// Validate and sanitise input stats
function validateStats(data: any): RoomStats | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const {
    avgBrightness, colorTempK, motionLevel, motionZones, crowdDensity, styleIndicator, lightingPattern,
    audioVolume, audioEnergy, noiseLevel, speechProbability, pitch, spectralCentroid
  } = data;

  // Type and range validation for visual metrics
  if (
    typeof crowdDensity !== 'number' || crowdDensity < 0 || crowdDensity > 1 ||
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

  // Clamp values to safe ranges and provide defaults for new fields
  return {
    avgBrightness: Math.max(0, Math.min(1, avgBrightness)),
    colorTempK: Math.max(2000, Math.min(8000, colorTempK)),
    motionLevel: Math.max(0, Math.min(1, motionLevel)),
    // New style detection metrics - provide defaults
    motionZones: [0, 0, 0, 0, 0], // Default to no motion in zones
    crowdDensity: Math.max(0, Math.min(1, motionLevel * 0.5)), // Estimate from motion
    styleIndicator: 'mixed' as const,
    dominantColors: [],
    colorVariance: 0.5,
    lightingPattern: avgBrightness > 0.5 ? 'steady' as const : 'dim' as const,
    // Audio metrics
    audioVolume: validAudioVolume,
    audioEnergy: validAudioEnergy,
    noiseLevel: validNoiseLevel,
    speechProbability: validSpeechProbability,
    pitch: validPitch,
    spectralCentroid: validSpectralCentroid,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const stats = validateStats(body.stats);

    if (!stats) {
      return NextResponse.json(
        { error: 'Invalid room stats provided' },
        { status: 400 }
      );
    }

    // Use enhanced heuristic-based vibe detection
    const decision = analyzeVibeFromStats(stats);

    return NextResponse.json({ decision });

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