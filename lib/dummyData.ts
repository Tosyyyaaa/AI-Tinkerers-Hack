
import { VibeDecision } from './types/vibe';

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  imageUrl: string;
  uri: string;
  audioFeatures: {
    danceability: number;
    energy: number;
    valence: number;
    tempo: number;
  };
}

export interface SessionEvent {
  timestamp: number;
  type: 'vibe_decision' | 'track_played' | 'dj_action';
  data: VibeDecision | SpotifyTrack | { action: 'skip' | 'keep' | 'drop' };
}

export interface WrappedSession {
  id: string;
  date: string;
  durationMinutes: number;
  events: SessionEvent[];
}

export const DUMMY_WRAPPED_DATA: WrappedSession[] = [
  {
    id: 'session-1',
    date: '2025-09-15',
    durationMinutes: 120,
    events: [
      {
        timestamp: Date.now() - 120 * 60 * 1000,
        type: 'vibe_decision',
        data: {
          vibeLabel: 'chill',
          suggestedBPM: 90,
          suggestedVolume: 0.6,
          spokenTip: 'The crowd is mellow, keep it smooth.',
          action: 'keep',
        },
      },
      {
        timestamp: Date.now() - 110 * 60 * 1000,
        type: 'track_played',
        data: {
          id: 'track-1',
          name: 'Smooth Operator',
          artist: 'Sade',
          album: 'Diamond Life',
          imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e22222222222222222222222',
          uri: 'spotify:track:1zC200dJc00dJc00dJc00dJc',
          audioFeatures: { danceability: 0.7, energy: 0.4, valence: 0.8, tempo: 110 },
        },
      },
      {
        timestamp: Date.now() - 90 * 60 * 1000,
        type: 'vibe_decision',
        data: {
          vibeLabel: 'focused',
          suggestedBPM: 115,
          suggestedVolume: 0.7,
          spokenTip: 'Energy is building, consider a slight tempo increase.',
          action: 'keep',
        },
      },
      {
        timestamp: Date.now() - 80 * 60 * 1000,
        type: 'track_played',
        data: {
          id: 'track-2',
          name: 'Get Lucky',
          artist: 'Daft Punk',
          album: 'Random Access Memories',
          imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e33333333333333333333333',
          uri: 'spotify:track:2zC200dJc00dJc00dJc00dJc',
          audioFeatures: { danceability: 0.8, energy: 0.7, valence: 0.9, tempo: 120 },
        },
      },
      {
        timestamp: Date.now() - 75 * 60 * 1000,
        type: 'dj_action',
        data: { action: 'keep' },
      },
      {
        timestamp: Date.now() - 60 * 60 * 1000,
        type: 'vibe_decision',
        data: {
          vibeLabel: 'party',
          suggestedBPM: 128,
          suggestedVolume: 0.85,
          spokenTip: 'The dance floor is heating up! Keep the energy high!',
          action: 'keep',
        },
      },
      {
        timestamp: Date.now() - 50 * 60 * 1000,
        type: 'track_played',
        data: {
          id: 'track-3',
          name: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'After Hours',
          imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e44444444444444444444444',
          uri: 'spotify:track:3zC200dJc00dJc00dJc00dJc',
          audioFeatures: { danceability: 0.7, energy: 0.8, valence: 0.8, tempo: 171 },
        },
      },
      {
        timestamp: Date.now() - 40 * 60 * 1000,
        type: 'dj_action',
        data: { action: 'skip' },
      },
      {
        timestamp: Date.now() - 30 * 60 * 1000,
        type: 'vibe_decision',
        data: {
          vibeLabel: 'bored',
          suggestedBPM: 135,
          suggestedVolume: 0.9,
          spokenTip: 'Crowd engagement is dropping. Time for a banger!',
          action: 'skip',
        },
      },
      {
        timestamp: Date.now() - 20 * 60 * 1000,
        type: 'track_played',
        data: {
          id: 'track-4',
          name: 'Levels',
          artist: 'Avicii',
          album: 'Levels',
          imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e55555555555555555555555',
          uri: 'spotify:track:4zC200dJc00dJc00dJc00dJc',
          audioFeatures: { danceability: 0.6, energy: 0.9, valence: 0.7, tempo: 126 },
        },
      },
    ],
  },
  {
    id: 'session-2',
    date: '2025-09-18',
    durationMinutes: 90,
    events: [
      {
        timestamp: Date.now() - 90 * 60 * 1000,
        type: 'vibe_decision',
        data: {
          vibeLabel: 'chill',
          suggestedBPM: 85,
          suggestedVolume: 0.5,
          spokenTip: 'Relaxed atmosphere, keep the tunes smooth.',
          action: 'keep',
        },
      },
      {
        timestamp: Date.now() - 70 * 60 * 1000,
        type: 'track_played',
        data: {
          id: 'track-5',
          name: 'Summertime',
          artist: 'Ella Fitzgerald',
          album: 'Porgy and Bess',
          imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e66666666666666666666666',
          uri: 'spotify:track:5zC200dJc00dJc00dJc00dJc',
          audioFeatures: { danceability: 0.3, energy: 0.2, valence: 0.6, tempo: 70 },
        },
      },
      {
        timestamp: Date.now() - 50 * 60 * 1000,
        type: 'vibe_decision',
        data: {
          vibeLabel: 'focused',
          suggestedBPM: 100,
          suggestedVolume: 0.6,
          spokenTip: 'A few people are concentrating, maintain a steady rhythm.',
          action: 'keep',
        },
      },
      {
        timestamp: Date.now() - 30 * 60 * 1000,
        type: 'track_played',
        data: {
          id: 'track-6',
          name: 'Blue in Green',
          artist: 'Miles Davis',
          album: 'Kind of Blue',
          imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e77777777777777777777777',
          uri: 'spotify:track:6zC200dJc00dJc00dJc00dJc',
          audioFeatures: { danceability: 0.2, energy: 0.1, valence: 0.4, tempo: 80 },
        },
      },
    ],
  },
];

export const DUMMY_WRAPPED_SUMMARY = {
  totalSessions: 47,
  totalDurationMinutes: 3420, // 57 hours
  mostCommonVibe: 'party',
  vibeDistribution: {
    party: 40,
    chill: 30,
    focused: 20,
    bored: 10,
  },
  totalTracks: 287,
  uniqueArtists: 45,
  totalVibeChecks: 1243,
  mostActiveHour: '22:00',
  longestSession: 180, // minutes
  danceabilityScore: 0.78,
  topTracks: [
    {
      id: 'track-3',
      name: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      imageUrl: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
      uri: 'spotify:track:3zC200dJc00dJc00dJc00dJc',
      playCount: 15,
    },
    {
      id: 'track-2',
      name: 'Get Lucky',
      artist: 'Daft Punk',
      album: 'Random Access Memories',
      imageUrl: 'https://i.scdn.co/image/ab67616d0000b273c83b0e3d50ad3362ba9f97a7',
      uri: 'spotify:track:2zC200dJc00dJc00dJc00dJc',
      playCount: 12,
    },
    {
      id: 'track-4',
      name: 'Levels',
      artist: 'Avicii',
      album: 'Levels',
      imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e317b4300d9fb9b7cec9ce6f',
      uri: 'spotify:track:4zC200dJc00dJc00dJc00dJc',
      playCount: 10,
    },
    {
      id: 'track-5',
      name: 'One More Time',
      artist: 'Daft Punk',
      album: 'Discovery',
      imageUrl: 'https://i.scdn.co/image/ab67616d0000b273b33d46dfa2635a47eebf63b2',
      uri: 'spotify:track:5zC200dJc00dJc00dJc00dJc',
      playCount: 8,
    },
    {
      id: 'track-6',
      name: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up, We\'re Dreaming',
      imageUrl: 'https://i.scdn.co/image/ab67616d0000b273191d68d4de72362a3aa85e8b',
      uri: 'spotify:track:6zC200dJc00dJc00dJc00dJc',
      playCount: 7,
    },
  ],
  djPersona: 'The Adaptable Maestro',
  mostCommonTip: 'Keep the energy high!',
  averageBPM: 120,
  averageVolume: 0.75,
  totalSkips: 5,
  totalKeeps: 20,
};
