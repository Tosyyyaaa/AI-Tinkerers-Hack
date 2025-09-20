export type RoomStats = {
  faces: number;
  smiles: number;
  avgBrightness: number;   // 0..1
  colorTempK: number;      // estimated white balance
  motionLevel: number;     // 0..1, from frame diffs / optical flow-lite
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
