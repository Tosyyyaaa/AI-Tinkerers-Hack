import { NextRequest, NextResponse } from 'next/server';
import http from 'node:http';
import https from 'node:https';

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
const HAS_WEATHERAPI_KEY = Boolean(WEATHERAPI_KEY);

// Open-Meteo fallback (no key required)
// We rely on Node's native http/https modules instead of fetch for Open-Meteo
// because undici occasionally fails the TLS handshake in local sandboxes.
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

async function fetchJsonViaNode(url: string) {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise<any>((resolve, reject) => {
    const req = client.request(
      parsedUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'vibe-weather-fallback/1.0',
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          const status = res.statusCode || 0;
          if (status < 200 || status >= 300) {
            reject(new Error(`HTTP ${status}`));
            return;
          }

          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (error) {
            reject(new Error('Failed to parse weather JSON'));
          }
        });
      }
    );

    req.on('error', (error) => reject(error));
    req.setTimeout(10000, () => {
      req.destroy(new Error('Weather request timed out'));
    });
    req.end();
  });
}

// Map WMO weather codes to human-readable descriptions
const WMO_CODE_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

// Map WMO codes to WeatherAPI icon codes so the UI keeps working
const WMO_TO_WEATHERAPI_ICON: Record<number, string> = {
  0: '113',
  1: '116',
  2: '116',
  3: '119',
  45: '143',
  48: '143',
  51: '266',
  53: '293',
  55: '299',
  56: '281',
  57: '284',
  61: '296',
  63: '302',
  65: '308',
  66: '311',
  67: '314',
  71: '323',
  73: '326',
  75: '329',
  77: '332',
  80: '353',
  81: '356',
  82: '359',
  85: '365',
  86: '368',
  95: '389',
  96: '392',
  99: '395',
};

function mapWmoToWeatherData({
  latitude,
  longitude,
  timezone,
  current,
  daily,
  city,
  units,
}: {
  latitude: number;
  longitude: number;
  timezone: string;
  current: any;
  daily?: any;
  city?: string;
  units: 'metric' | 'imperial';
}): WeatherData {
  const code: number = typeof current.weather_code === 'number' ? current.weather_code : 0;
  const description = WMO_CODE_DESCRIPTIONS[code] || 'Weather update';
  const icon = WMO_TO_WEATHERAPI_ICON[code] || '119';

  const sunrise = daily?.sunrise?.[0] ?? 0;
  const sunset = daily?.sunset?.[0] ?? 0;

  const windSpeedValue = Math.round(current.wind_speed_10m ?? 0);

  const rawVisibility = typeof current.visibility === 'number' ? current.visibility : 0;
  const visibilityInKm = rawVisibility / 1000;
  const visibility = units === 'imperial'
    ? Math.round(visibilityInKm * 0.621371)
    : Math.round(visibilityInKm);

  const location = city
    ? city
    : `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)} (${timezone})`;

  return {
    location,
    temperature: Math.round(current.temperature_2m ?? 0),
    feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    pressure: Math.round(current.pressure_msl ?? 0),
    visibility,
    uvIndex: Math.max(0, Math.round(current.uv_index ?? 0)),
    windSpeed: windSpeedValue,
    windDirection: Math.round(current.wind_direction_10m ?? 0),
    description,
    icon,
    sunrise,
    sunset,
    cloudiness: Math.round(current.cloud_cover ?? 0),
    timestamp: current.time ?? Math.floor(Date.now() / 1000),
  };
}

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

async function geocodeCity(city: string): Promise<{ lat: number; lon: number; label: string }> {
  const geoUrl = new URL(OPEN_METEO_GEOCODING_URL);
  geoUrl.searchParams.set('name', city);
  geoUrl.searchParams.set('count', '1');
  geoUrl.searchParams.set('language', 'en');
  geoUrl.searchParams.set('format', 'json');

  const response = await fetch(geoUrl.toString(), {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000) // 8 second timeout
  });
  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`);
  }

  const data = await response.json();
  const result = data.results?.[0];
  if (!result) {
    throw new Error('City not found');
  }

  const labelParts = [result.name, result.country].filter(Boolean);

  return {
    lat: result.latitude,
    lon: result.longitude,
    label: labelParts.join(', '),
  };
}

async function getWeatherByCoordsOpenMeteo(
  lat: number,
  lon: number,
  units: 'metric' | 'imperial',
  cityLabel?: string,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,visibility,weather_code,uv_index',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '1',
    temperature_unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
    windspeed_unit: units === 'imperial' ? 'mph' : 'kmh',
    precipitation_unit: 'mm',
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
  const data = await fetchJsonViaNode(url);

  if (!data?.current) {
    throw new Error('Invalid Open-Meteo response');
  }

  return mapWmoToWeatherData({
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    current: data.current,
    daily: data.daily,
    city: cityLabel,
    units,
  });
}

async function getWeatherByCityOpenMeteo(city: string, units: 'metric' | 'imperial'): Promise<WeatherData> {
  const { lat, lon, label } = await geocodeCity(city);
  return getWeatherByCoordsOpenMeteo(lat, lon, units, label);
}

async function fetchWeatherByCoords(lat: number, lon: number, units: 'metric' | 'imperial') {
  if (HAS_WEATHERAPI_KEY) {
    try {
      return await getWeatherByCoords(lat, lon, units);
    } catch (error) {
      console.warn('WeatherAPI coords lookup failed, falling back to Open-Meteo:', error);
    }
  }

  try {
    return await getWeatherByCoordsOpenMeteo(lat, lon, units);
  } catch (error) {
    console.error('Open-Meteo coords lookup failed:', error);
    // Return basic fallback data
    return {
      location: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      temperature: 20,
      feelsLike: 20,
      humidity: 50,
      pressure: 1013,
      visibility: 10,
      uvIndex: 3,
      windSpeed: 5,
      windDirection: 180,
      description: 'Weather data unavailable',
      icon: 'unknown',
      sunrise: Date.now() / 1000,
      sunset: Date.now() / 1000 + 43200,
      cloudiness: 50,
      timestamp: Date.now() / 1000,
    };
  }
}

async function fetchWeatherByCity(city: string, units: 'metric' | 'imperial') {
  if (HAS_WEATHERAPI_KEY) {
    try {
      return await getWeatherByCity(city, units);
    } catch (error) {
      console.warn('WeatherAPI city lookup failed, falling back to Open-Meteo:', error);
    }
  }

  try {
    return await getWeatherByCityOpenMeteo(city, units);
  } catch (error) {
    console.error('Open-Meteo city lookup failed:', error);
    // Return basic fallback data
    return {
      location: city,
      temperature: 20,
      feelsLike: 20,
      humidity: 50,
      pressure: 1013,
      visibility: 10,
      uvIndex: 3,
      windSpeed: 5,
      windDirection: 180,
      description: 'Weather data unavailable',
      icon: 'unknown',
      sunrise: Date.now() / 1000,
      sunset: Date.now() / 1000 + 43200,
      cloudiness: 50,
      timestamp: Date.now() / 1000,
    };
  }
}

// Get weather by coordinates
async function getWeatherByCoords(lat: number, lon: number, units: string): Promise<WeatherData> {
  // WeatherAPI.com includes astronomy data by default with forecast
  const url = `${WEATHERAPI_BASE_URL}/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no`;

  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10000) // 10 second timeout
  });
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Try to fetch astronomy data, but don't fail if it doesn't work
  try {
    const astroUrl = `${WEATHERAPI_BASE_URL}/astronomy.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&dt=${new Date().toISOString().split('T')[0]}`;
    const astroResponse = await fetch(astroUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (astroResponse.ok) {
      const astroData = await astroResponse.json();
      data.forecast = {
        forecastday: [{
          astro: astroData.astronomy.astro
        }]
      };
    }
  } catch (astroError) {
    console.warn('Failed to fetch astronomy data, using defaults:', astroError);
    // Set reasonable defaults for sunrise/sunset
    const now = new Date();
    const sunrise = new Date(now);
    sunrise.setHours(6, 30, 0, 0);
    const sunset = new Date(now);
    sunset.setHours(18, 30, 0, 0);

    data.forecast = {
      forecastday: [{
        astro: {
          sunrise: sunrise.toTimeString().slice(0, 5),
          sunset: sunset.toTimeString().slice(0, 5)
        }
      }]
    };
  }
  
  return transformWeatherData(data);
}

// Get weather by city name
async function getWeatherByCity(city: string, units: string): Promise<WeatherData> {
  const url = `${WEATHERAPI_BASE_URL}/current.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(city)}&aqi=no`;

  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10000) // 10 second timeout
  });
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
  
  // Try to fetch astronomy data, but don't fail if it doesn't work
  try {
    const astroUrl = `${WEATHERAPI_BASE_URL}/astronomy.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(city)}&dt=${new Date().toISOString().split('T')[0]}`;
    const astroResponse = await fetch(astroUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (astroResponse.ok) {
      const astroData = await astroResponse.json();
      data.forecast = {
        forecastday: [{
          astro: astroData.astronomy.astro
        }]
      };
    }
  } catch (astroError) {
    console.warn('Failed to fetch astronomy data, using defaults:', astroError);
    // Set reasonable defaults for sunrise/sunset
    const now = new Date();
    const sunrise = new Date(now);
    sunrise.setHours(6, 30, 0, 0);
    const sunset = new Date(now);
    sunset.setHours(18, 30, 0, 0);

    data.forecast = {
      forecastday: [{
        astro: {
          sunrise: sunrise.toTimeString().slice(0, 5),
          sunset: sunset.toTimeString().slice(0, 5)
        }
      }]
    };
  }
  
  return transformWeatherData(data);
}

// GET endpoint for weather data
export async function GET(request: NextRequest) {
  try {
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
        weatherData = await fetchWeatherByCoords(
          weatherRequest.lat,
          weatherRequest.lon,
          weatherRequest.units!
        );
      } else if (weatherRequest.city) {
        weatherData = await fetchWeatherByCity(weatherRequest.city, weatherRequest.units!);
      } else {
        throw new Error('No valid location provided');
      }

      return NextResponse.json({
        weather: weatherData,
        source: HAS_WEATHERAPI_KEY ? 'weatherapi' : 'open-meteo',
      });

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
        weatherData = await fetchWeatherByCoords(
          weatherRequest.lat,
          weatherRequest.lon,
          weatherRequest.units!
        );
      } else if (weatherRequest.city) {
        weatherData = await fetchWeatherByCity(weatherRequest.city, weatherRequest.units!);
      } else {
        throw new Error('No valid location provided');
      }

      return NextResponse.json({
        weather: weatherData,
        source: HAS_WEATHERAPI_KEY ? 'weatherapi' : 'open-meteo',
      });

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
