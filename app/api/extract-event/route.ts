import { NextRequest, NextResponse } from 'next/server';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2';
const FIRECRAWL_SCRAPE_URL = `${FIRECRAWL_BASE_URL}/scrape`;

const VIBE_LABEL_LIST = [
  'party',
  'chill',
  'focused',
  'bored',
  'energetic',
  'relaxed',
  'festive',
  'intimate',
] as const;

const VIBE_LABELS = new Set<string>(VIBE_LABEL_LIST);

type VibeLabel = typeof VIBE_LABEL_LIST[number];

interface FirecrawlScrapeFormatResult {
  json?: Record<string, unknown>;
  metadata?: Record<string, unknown> & {
    title?: string;
    description?: string;
    sourceURL?: string;
    statusCode?: number;
    creditsUsed?: number;
    error?: string;
  };
}

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: FirecrawlScrapeFormatResult;
  error?: string;
}

interface ExtractedVibeData {
  entityType: 'event' | 'place';
  eventTitle: string;
  eventDescription: string;
  vibeLabel: VibeLabel;
  vibeDescription: string;
  suggestedBPM: number;
  suggestedVolume: number;
  eventDate?: string;
  eventLocation?: string;
  eventType?: string;
  atmosphere?: string;
  expectedCrowd?: string;
  placeName?: string;
  placeAddress?: string;
  placeType?: string;
  placeHours?: string;
  placeActivities?: string;
  notes?: string;
  sourceUrl: string;
}

const extractionSchema = {
  type: 'object',
  properties: {
    entityType: {
      type: 'string',
      enum: ['event', 'place'],
      description: 'Whether the URL describes a scheduled event or a venue/place',
    },
    name: {
      type: 'string',
      description: 'Primary name of the event or place',
    },
    eventTitle: {
      type: 'string',
      description: 'Specific event title if applicable',
    },
    eventDescription: {
      type: 'string',
      description: 'Summary of what happens at the event',
    },
    placeName: {
      type: 'string',
      description: 'Venue name when the URL refers to a place or business',
    },
    description: {
      type: 'string',
      description: 'Free-form description of the atmosphere',
    },
    vibeLabel: {
      type: 'string',
      enum: VIBE_LABEL_LIST,
      description: 'One of the supported vibe labels used by the app',
    },
    vibeDescription: {
      type: 'string',
      description: 'Two to three sentences describing the ambience in plain language',
    },
    suggestedBPM: {
      type: 'number',
      description: 'Recommended tempo aligned with the vibe',
    },
    suggestedVolume: {
      type: 'number',
      description: 'Recommended playback volume 0.1 - 1.0',
    },
    eventDate: { type: 'string' },
    eventLocation: { type: 'string' },
    eventType: { type: 'string' },
    atmosphere: { type: 'string' },
    expectedCrowd: { type: 'string' },
    placeAddress: { type: 'string' },
    placeType: { type: 'string' },
    placeHours: { type: 'string' },
    placeActivities: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['entityType', 'vibeLabel', 'vibeDescription'],
} as const;

const extractionPrompt = `You are a music and hospitality analyst.
Review the provided URL and decide whether it represents a specific event (scheduled and time-bound)
or a venue/place (bar, club, restaurant, gallery, Google Maps listing, etc.).
Return JSON that matches the schema exactly and follow these rules:

- entityType must be "event" or "place".
- Provide either eventTitle (for events) or placeName (for venues). Always include a general name field.
- vibeLabel must be lowercase and chosen from: party, chill, focused, bored, energetic, relaxed, festive, intimate.
- suggestedBPM must be between 60 and 180. suggestedVolume between 0.1 and 1.0.
- vibeDescription should be 1-3 sentences describing atmosphere, energy, and crowd.
- For places include placeHours, placeActivities, and expectedCrowd when the page hints at them.
- Never invent facts; omit fields you cannot verify from the page.
- Keep text concise with plain sentences (no markdown bullets).
`;

function ensureString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    const lowered = trimmed.toLowerCase();
    if (lowered === 'null' || lowered === 'undefined' || lowered === 'n/a' || lowered === 'none') {
      return undefined;
    }

    return trimmed;
  }
  return undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (Number.isFinite(numeric)) {
    return Math.max(min, Math.min(max, numeric));
  }
  return fallback;
}

function coerceVibeLabel(...labels: unknown[]): VibeLabel {
  for (const label of labels) {
    const candidate = ensureString(label)?.toLowerCase();
    if (candidate && VIBE_LABELS.has(candidate)) {
      return candidate as VibeLabel;
    }

    if (candidate) {
      // Lightweight mapping for common synonyms
      if (candidate.includes('party') || candidate.includes('festival')) return 'party';
      if (candidate.includes('chill') || candidate.includes('laid-back')) return 'chill';
      if (candidate.includes('focus') || candidate.includes('work')) return 'focused';
      if (candidate.includes('energetic') || candidate.includes('high-energy')) return 'energetic';
      if (candidate.includes('relax') || candidate.includes('calm')) return 'relaxed';
      if (candidate.includes('intimate') || candidate.includes('date')) return 'intimate';
      if (candidate.includes('festive') || candidate.includes('holiday')) return 'festive';
      if (candidate.includes('bored') || candidate.includes('slow')) return 'bored';
    }
  }

  // If we still have no match fall back to neutral focus
  return 'focused';
}

function coerceEntityType(value: unknown): 'event' | 'place' {
  const candidate = ensureString(value)?.toLowerCase();
  if (candidate === 'place') {
    return 'place';
  }
  if (candidate === 'event') {
    return 'event';
  }
  return 'event';
}

function parseStatusCode(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return 'focused';
}

function normaliseExtractedData(raw: Record<string, unknown>, sourceUrl: string): ExtractedVibeData {
  const entityType = coerceEntityType(raw.entityType);
  const nameCandidates = [
    ensureString(raw.name),
    ensureString(raw.eventTitle),
    ensureString(raw.eventName),
    ensureString(raw.placeName),
    ensureString(raw.title),
  ];
  const primaryName = nameCandidates.find(Boolean) || 'Event or Venue';

  const vibeDescription = ensureString(raw.vibeDescription)
    || ensureString(raw.description)
    || ensureString(raw.eventDescription)
    || ensureString(raw.atmosphere)
    || `Ambience inspired by ${primaryName}.`;

  const eventTitle = ensureString(raw.eventTitle) || primaryName;
  const placeName = ensureString(raw.placeName) || (entityType === 'place' ? primaryName : undefined);

  return {
    entityType,
    eventTitle,
    eventDescription: ensureString(raw.eventDescription)
      || ensureString(raw.description)
      || vibeDescription,
    vibeLabel: coerceVibeLabel(raw.vibeLabel, raw.vibe, raw.vibeSummary, raw.mood, raw.theme),
    vibeDescription,
    suggestedBPM: clampNumber(raw.suggestedBPM ?? raw.suggestedBpm ?? raw.bpm, 60, 180, 110),
    suggestedVolume: clampNumber(raw.suggestedVolume ?? raw.volume, 0.1, 1, 0.7),
    eventDate: ensureString(raw.eventDate) || ensureString(raw.date) || ensureString(raw.schedule),
    eventLocation: ensureString(raw.eventLocation)
      || ensureString(raw.location)
      || ensureString(raw.placeAddress)
      || ensureString(raw.address),
    eventType: ensureString(raw.eventType)
      || ensureString(raw.category)
      || ensureString(raw.placeType),
    atmosphere: ensureString(raw.atmosphere)
      || ensureString(raw.ambience)
      || ensureString(raw.mood),
    expectedCrowd: ensureString(raw.expectedCrowd) || ensureString(raw.crowd) || ensureString(raw.capacityDescription),
    placeName,
    placeAddress: ensureString(raw.placeAddress) || ensureString(raw.address),
    placeType: ensureString(raw.placeType) || ensureString(raw.venueType),
    placeHours: ensureString(raw.placeHours) || ensureString(raw.hours) || ensureString(raw.openingHours),
    placeActivities: ensureString(raw.placeActivities)
      || ensureString(raw.activities)
      || ensureString(raw.programming),
    notes: ensureString(raw.notes),
    sourceUrl,
  };
}

async function scrapeWithFirecrawl(url: string, signal?: AbortSignal): Promise<{
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | undefined;
}> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY environment variable is not configured');
  }

  const response = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      maxAge: 0,
      location: {
        country: 'US',
        languages: ['en'],
      },
      formats: [
        {
          type: 'json',
          schema: extractionSchema,
          prompt: extractionPrompt,
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl scrape error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as FirecrawlScrapeResponse;

  if (!data.success) {
    throw new Error(data.error || 'Firecrawl scrape call was not successful');
  }

  const formatResult = data.data ?? {};
  const payload = (formatResult.json ?? {}) as Record<string, unknown>;
  const metadata = formatResult.metadata;

  const statusCode = parseStatusCode(metadata?.statusCode);
  if (statusCode && statusCode >= 400) {
    const reason = ensureString(metadata?.error) || `Source returned HTTP status ${statusCode}`;
    throw new Error(reason);
  }

  if (!payload || Object.keys(payload).length === 0) {
    throw new Error('Firecrawl scrape returned an empty result');
  }

  return { payload, metadata };
}

export async function POST(request: NextRequest) {
  console.log('🌐 Firecrawl extractor called');

  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!FIRECRAWL_API_KEY) {
      console.warn('⚠️ FIRECRAWL_API_KEY not set, cannot extract data');
      return NextResponse.json({ error: 'Firecrawl API key not configured' }, { status: 500 });
    }

    console.log('🔍 Extracting vibe data from URL:', url);

    const { payload, metadata } = await scrapeWithFirecrawl(url);

    const eventData = normaliseExtractedData(payload, url);

    const metaTitle = ensureString(metadata?.title);
    if (metaTitle && (eventData.eventTitle === 'Event or Venue' || !eventData.eventTitle)) {
      eventData.eventTitle = metaTitle;
    }

    const metaDescription = ensureString(metadata?.description);
    if (metaDescription && (!eventData.eventDescription || eventData.eventDescription === `Ambience inspired by ${eventData.eventTitle}.`)) {
      eventData.eventDescription = metaDescription;
    }

    console.log('✅ Firecrawl extraction succeeded', {
      entityType: eventData.entityType,
      vibe: eventData.vibeLabel,
      bpm: eventData.suggestedBPM,
      volume: eventData.suggestedVolume,
    });

    return NextResponse.json({
      success: true,
      eventData,
      metadata: {
        sourceTitle: metadata?.title,
        sourceDescription: metadata?.description,
        sourceUrl: metadata?.sourceURL ?? url,
        statusCode: metadata?.statusCode,
        creditsUsed: metadata?.creditsUsed,
      },
    });
  } catch (error) {
    console.error('❌ Error in Firecrawl extract-event API:', error);

    return NextResponse.json(
      {
        error: 'Failed to extract event data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Event & Venue Extractor',
    status: 'active',
    powered_by: 'Firecrawl Scrape API',
    supported_content: ['Event pages', 'Venue listings', 'Google Maps place URLs'],
    api_key_configured: !!FIRECRAWL_API_KEY,
  });
}
