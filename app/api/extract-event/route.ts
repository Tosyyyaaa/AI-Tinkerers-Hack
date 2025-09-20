import { NextRequest, NextResponse } from 'next/server';

interface EventVibeData {
  eventTitle: string;
  eventDescription: string;
  vibeLabel: 'party' | 'chill' | 'focused' | 'bored' | 'energetic' | 'relaxed' | 'festive' | 'intimate';
  vibeDescription: string;
  suggestedBPM: number;
  suggestedVolume: number;
  eventDate?: string;
  eventLocation?: string;
  eventType?: string;
  atmosphere?: string;
  expectedCrowd?: string;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    urlContextMetadata?: {
      urlMetadata: Array<{
        retrievedUrl: string;
        urlRetrievalStatus: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function POST(request: NextRequest) {
  console.log('🌐 URL Context API called');

  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      console.warn('⚠️ GEMINI_API_KEY not set, cannot extract event data');
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log('🔍 Extracting event data from URL:', url);

    const prompt = `IMPORTANT: Return ONLY a JSON object, no explanations or additional text.

Analyze the event information from the provided URL and return this exact JSON structure:

{
  "eventTitle": "Name of the event",
  "eventDescription": "Brief description of what the event is about",
  "vibeLabel": "Choose one: party, chill, focused, bored, energetic, relaxed, festive, intimate",
  "vibeDescription": "Detailed description of the expected atmosphere and vibe (2-3 sentences)",
  "suggestedBPM": 120,
  "suggestedVolume": 0.7,
  "eventDate": "Date of the event if available",
  "eventLocation": "Location if available", 
  "eventType": "Type of event (conference, party, concert, etc.)",
  "atmosphere": "Expected atmosphere description",
  "expectedCrowd": "Description of expected attendees/crowd"
}

Vibe classification rules:
- "party": High-energy events, clubs, festivals, celebrations
- "chill": Relaxed events, casual meetups, lounges, coffee shops
- "focused": Work events, conferences, workshops, study sessions
- "energetic": Sports events, fitness classes, active gatherings
- "festive": Holidays, celebrations, cultural events
- "intimate": Small gatherings, date nights, private events
- "relaxed": Spa events, meditation, wellness activities
- "bored": Low-energy or potentially uninteresting events

BPM ranges: 80-100 (chill/relaxed), 100-120 (focused/intimate), 120-140 (energetic/party), 140+ (high-energy party)
Volume ranges: 0.4-0.6 (intimate/focused), 0.6-0.8 (normal), 0.8-1.0 (party/energetic)

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: `${prompt}\n\nURL to analyze: ${url}` }
          ]
        }
      ],
      tools: [
        {
          url_context: {}
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      }
    };

    console.log('📡 Calling Gemini API with URL context...');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data: GeminiResponse = await response.json();
    console.log('📊 Gemini API response received');

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No candidates in Gemini response');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('No content in Gemini response');
    }

    const responseText = candidate.content.parts[0].text;
    console.log('🎯 Raw Gemini response:', responseText);

    // Try to parse JSON from the response
    let eventData: EventVibeData;
    try {
      // Clean up the response text (remove markdown code blocks if present)
      let cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Try to extract JSON if the response contains explanatory text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      // If the response doesn't start with {, it's likely explanatory text
      if (!cleanedText.startsWith('{')) {
        throw new Error('Response does not contain valid JSON structure');
      }
      
      eventData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini JSON response:', parseError);
      console.log('Raw response text:', responseText);
      
      // Fallback: try to extract basic info
      eventData = {
        eventTitle: 'Event from URL',
        eventDescription: 'Event extracted from provided URL',
        vibeLabel: 'focused',
        vibeDescription: 'Unable to determine specific vibe from the URL content.',
        suggestedBPM: 110,
        suggestedVolume: 0.7,
      };
    }

    // Validate required fields
    if (!eventData.vibeLabel || !['party', 'chill', 'focused', 'bored', 'energetic', 'relaxed', 'festive', 'intimate'].includes(eventData.vibeLabel)) {
      eventData.vibeLabel = 'focused';
    }

    // Ensure numeric values are within valid ranges
    eventData.suggestedBPM = Math.max(60, Math.min(180, eventData.suggestedBPM || 110));
    eventData.suggestedVolume = Math.max(0.1, Math.min(1.0, eventData.suggestedVolume || 0.7));

    console.log('✅ Event data extracted successfully:', {
      title: eventData.eventTitle,
      vibe: eventData.vibeLabel,
      bpm: eventData.suggestedBPM,
      volume: eventData.suggestedVolume,
    });

    // Include URL retrieval metadata if available
    const metadata = candidate.urlContextMetadata ? {
      retrievedUrls: candidate.urlContextMetadata.urlMetadata?.map(meta => ({
        url: meta.retrievedUrl,
        status: meta.urlRetrievalStatus,
      })) || [],
    } : undefined;

    return NextResponse.json({
      success: true,
      eventData,
      metadata,
      usage: data.usageMetadata,
    });

  } catch (error) {
    console.error('❌ Error in extract-event API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to extract event data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check API status
export async function GET() {
  return NextResponse.json({
    service: 'Event URL Context Extractor',
    status: 'active',
    powered_by: 'Google Gemini API',
    supported_content: ['HTML pages', 'Event pages', 'PDF documents'],
    api_key_configured: !!GEMINI_API_KEY,
  });
}
