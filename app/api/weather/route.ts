import { NextRequest, NextResponse } from 'next/server';

// Weather data types
export interface WeatherData {
  location: string;
  temperature: number; // Celsius
  feelsLike: number; // Celsius
  humidity: number; // Percentage
  pressure: number; // hPa
  visibility: number; // km
  uvIndex: number; // UV index
  windSpeed: number; // km/h
  windDirection: number; // degrees
  description: string; // Weather description
  icon: string; // Weather icon code
  sunrise: number; // Unix timestamp
  sunset: number; // Unix timestamp
  cloudiness: number; // Percentage
  timestamp: number; // Unix timestamp
}

export interface WeatherRequest {
  lat?: number;
  lon?: number;
  city?: string;
  units?: 'metric' | 'imperial';
}

// WeatherAPI.com configuration (never expose to the client)
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY || process.env.OPENWEATHER_API_KEY || '';
const WEATHERAPI_BASE_URL = 'https://api.weatherapi.com/v1';

// Validate weather request
function validateWeatherRequest(data: any): WeatherRequest | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const { lat, lon, city, units } = data;

  // Must have either coordinates or city name
  if ((!lat || !lon) && !city) {
    return null;
  }

  // Validate coordinates if provided
  if (lat !== undefined || lon !== undefined) {
    if (
      typeof lat !== 'number' || lat < -90 || lat > 90 ||
      typeof lon !== 'number' || lon < -180 || lon > 180
    ) {
      return null;
    }
  }

  // Validate city if provided
  if (city && (typeof city !== 'string' || city.length > 100)) {
    return null;
  }

  // Validate units
  if (units && !['metric', 'imperial'].includes(units)) {
    return null;
  }

  return {
    lat: typeof lat === 'number' ? lat : undefined,
    lon: typeof lon === 'number' ? lon : undefined,
    city: typeof city === 'string' ? city.trim() : undefined,
    units: units || 'metric',
  };
}

// Convert WeatherAPI.com response to our format
function transformWeatherData(data: any): WeatherData {
  const current = data.current;
  const location = data.location;
  const astronomy = data.forecast?.forecastday?.[0]?.astro;
  
  // Convert sunrise/sunset to Unix timestamps
  const today = new Date().toISOString().split('T')[0];
  const sunriseTime = astronomy?.sunrise ? new Date(`${today} ${astronomy.sunrise}`).getTime() / 1000 : 0;
  const sunsetTime = astronomy?.sunset ? new Date(`${today} ${astronomy.sunset}`).getTime() / 1000 : 0;
  
  return {
    location: `${location.name}, ${location.country}`,
    temperature: Math.round(current.temp_c),
    feelsLike: Math.round(current.feelslike_c),
    humidity: current.humidity,
    pressure: Math.round(current.pressure_mb),
    visibility: Math.round(current.vis_km),
    uvIndex: current.uv || 0,
    windSpeed: Math.round(current.wind_kph),
    windDirection: current.wind_degree || 0,
    description: current.condition.text,
    icon: current.condition.icon.split('/').pop()?.replace('.png', '') || 'unknown', // Extract icon code
    sunrise: sunriseTime,
    sunset: sunsetTime,
    cloudiness: current.cloud || 0,
    timestamp: current.last_updated_epoch,
  };
}

// Get weather by coordinates
async function getWeatherByCoords(lat: number, lon: number, units: string): Promise<WeatherData> {
  // WeatherAPI.com includes astronomy data by default with forecast
  const url = `${WEATHERAPI_BASE_URL}/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Fetch astronomy data separately for sunrise/sunset
  const astroUrl = `${WEATHERAPI_BASE_URL}/astronomy.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&dt=${new Date().toISOString().split('T')[0]}`;
  try {
    const astroResponse = await fetch(astroUrl);
    if (astroResponse.ok) {
      const astroData = await astroResponse.json();
      data.forecast = {
        forecastday: [{
          astro: astroData.astronomy.astro
        }]
      };
    }
  } catch (astroError) {
    console.warn('Failed to fetch astronomy data:', astroError);
  }
  
  return transformWeatherData(data);
}

// Get weather by city name
async function getWeatherByCity(city: string, units: string): Promise<WeatherData> {
  const url = `${WEATHERAPI_BASE_URL}/current.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(city)}&aqi=no`;
  
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error?.message?.includes('No matching location found')) {
        throw new Error('City not found');
      }
    }
    throw new Error(`Weather API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Fetch astronomy data separately for sunrise/sunset
  const astroUrl = `${WEATHERAPI_BASE_URL}/astronomy.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(city)}&dt=${new Date().toISOString().split('T')[0]}`;
  try {
    const astroResponse = await fetch(astroUrl);
    if (astroResponse.ok) {
      const astroData = await astroResponse.json();
      data.forecast = {
        forecastday: [{
          astro: astroData.astronomy.astro
        }]
      };
    }
  } catch (astroError) {
    console.warn('Failed to fetch astronomy data:', astroError);
  }
  
  return transformWeatherData(data);
}

// GET endpoint for weather data
export async function GET(request: NextRequest) {
  try {
    // Check API key
    if (!WEATHERAPI_KEY) {
      return NextResponse.json(
        { error: 'Weather API key not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const city = searchParams.get('city');
    const units = searchParams.get('units') || 'metric';

    // Validate request parameters
    const weatherRequest = validateWeatherRequest({
      lat: lat ? parseFloat(lat) : undefined,
      lon: lon ? parseFloat(lon) : undefined,
      city,
      units,
    });

    if (!weatherRequest) {
      return NextResponse.json(
        { error: 'Invalid weather request. Provide either lat/lon coordinates or city name.' },
        { status: 400 }
      );
    }

    let weatherData: WeatherData;

    try {
      // Get weather data
      if (weatherRequest.lat !== undefined && weatherRequest.lon !== undefined) {
        weatherData = await getWeatherByCoords(
          weatherRequest.lat,
          weatherRequest.lon,
          weatherRequest.units!
        );
      } else if (weatherRequest.city) {
        weatherData = await getWeatherByCity(weatherRequest.city, weatherRequest.units!);
      } else {
        throw new Error('No valid location provided');
      }

      return NextResponse.json({ weather: weatherData });

    } catch (weatherError) {
      console.error('Weather API error:', weatherError);
      
      const errorMessage = weatherError instanceof Error 
        ? weatherError.message 
        : 'Unknown weather API error';

      return NextResponse.json(
        { 
          error: 'Failed to fetch weather data',
          details: errorMessage
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Weather route error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process weather request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint for weather data (same functionality, different method)
export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!WEATHERAPI_KEY) {
      return NextResponse.json(
        { error: 'Weather API key not configured' },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const weatherRequest = validateWeatherRequest(body);
    
    if (!weatherRequest) {
      return NextResponse.json(
        { error: 'Invalid weather request. Provide either lat/lon coordinates or city name.' },
        { status: 400 }
      );
    }

    let weatherData: WeatherData;

    try {
      // Get weather data
      if (weatherRequest.lat !== undefined && weatherRequest.lon !== undefined) {
        weatherData = await getWeatherByCoords(
          weatherRequest.lat,
          weatherRequest.lon,
          weatherRequest.units!
        );
      } else if (weatherRequest.city) {
        weatherData = await getWeatherByCity(weatherRequest.city, weatherRequest.units!);
      } else {
        throw new Error('No valid location provided');
      }

      return NextResponse.json({ weather: weatherData });

    } catch (weatherError) {
      console.error('Weather API error:', weatherError);
      
      const errorMessage = weatherError instanceof Error 
        ? weatherError.message 
        : 'Unknown weather API error';

      return NextResponse.json(
        { 
          error: 'Failed to fetch weather data',
          details: errorMessage
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Weather route error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process weather request',
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
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
