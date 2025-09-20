export type RoomStats = {
  // Visual metrics
  avgBrightness: number;   // 0..1
  colorTempK: number;      // estimated white balance
  motionLevel: number;     // 0..1, overall motion intensity
  faces?: number;          // detected faces count (optional sensor metric)
  smiles?: number;         // detected smiles count (optional sensor metric)
  // New style detection metrics
  motionZones: number[];   // 0..1 for each zone (left, center, right, top, bottom)
  crowdDensity: number;    // 0..1, estimated number of people based on motion patterns
  styleIndicator: "formal" | "casual" | "party" | "professional" | "mixed"; // detected clothing/environment style
  dominantColors: string[]; // hex colors of dominant colors in scene
  colorVariance: number;   // 0..1, how varied colors are (casual=high, formal=low)
  lightingPattern: "steady" | "dynamic" | "strobe" | "dim"; // lighting environment type
  // Audio metrics (soundDevice-style)
  audioVolume: number;     // 0..1, overall audio level
  audioEnergy: number;     // 0..1, audio energy/RMS
  noiseLevel: number;      // 0..1, background noise estimation
  speechProbability: number; // 0..1, likelihood of speech
  pitch: number;           // Hz, fundamental frequency
  spectralCentroid: number; // Hz, brightness of sound
};

export type VibeDecision = {
  vibeLabel: "party" | "chill" | "focused" | "bored";
  suggestedBPM: number;
  suggestedVolume: number; // 0..1
  spokenTip: string;
  action?: "keep" | "skip" | "drop";
};

export type VibeCheckState = {
  isActive: boolean;
  hasPermission: boolean;
  error: string | null;
  stats: RoomStats | null;
  decision: VibeDecision | null;
};

// MCP (Model Context Protocol) tool interfaces
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPVibeTools {
  interpretVibe: MCPTool;
  speakCoach: MCPTool;
  adaptPlayback: MCPTool;
}

// ElevenLabs TTS types
export type TTSRequest = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

export type TTSResponse = {
  audio: ArrayBuffer;
  contentType: string;
};

// Agno agent communication types
export type AgnoVibeRequest = {
  stats: RoomStats;
  context?: {
    timestamp: number;
    sessionId?: string;
    previousVibe?: string;
  };
  promptMetadata?: {
    style?: string;
    description?: string;
  };
};

export type AgnoMusicResponse = {
  success: boolean;
  music?: {
    url: string;
    filename: string;
    style: string;
    description: string;
    duration: number;
    localPath?: string;
    mimeType?: string;
    sizeBytes?: number;
    audioBase64?: string;
    dataUrl?: string;
    source?: 'elevenlabs';
    generatedAt?: number;
  };
  error?: string;
  vibeDescription?: string;
};
