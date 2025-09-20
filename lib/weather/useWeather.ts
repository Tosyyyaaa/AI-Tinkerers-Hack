'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WeatherData } from '@/app/api/weather/route';

export interface WeatherConfig {
  updateInterval: number; // ms between weather updates
  defaultCity?: string; // fallback city if geolocation fails
  units: 'metric' | 'imperial';
  autoRefresh: boolean;
}

export interface WeatherState {
  data: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  hasLocationPermission: boolean;
}

const DEFAULT_CONFIG: WeatherConfig = {
  updateInterval: 600000, // 10 minutes
  defaultCity: 'London', // fallback city
  units: 'metric',
  autoRefresh: true,
};

export function useWeather(config: Partial<WeatherConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [weatherState, setWeatherState] = useState<WeatherState>({
    data: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    hasLocationPermission: false,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  // Get user's current position
  const getCurrentPosition = useCallback((): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          lastLocationRef.current = coords;
          setWeatherState(prev => ({ ...prev, hasLocationPermission: true }));
          resolve(coords);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setWeatherState(prev => ({ ...prev, hasLocationPermission: false }));
          
          let errorMessage = 'Location access denied';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes cache
        }
      );
    });
  }, []);

  // Fetch weather data
  const fetchWeather = useCallback(async (location?: { lat: number; lon: number } | string) => {
    setWeatherState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let url: string;
      
      if (typeof location === 'string') {
        // City name
        url = `/api/weather?city=${encodeURIComponent(location)}&units=${fullConfig.units}`;
      } else if (location) {
        // Coordinates
        url = `/api/weather?lat=${location.lat}&lon=${location.lon}&units=${fullConfig.units}`;
      } else {
        // Try to get current location
        try {
          const coords = await getCurrentPosition();
          url = `/api/weather?lat=${coords.lat}&lon=${coords.lon}&units=${fullConfig.units}`;
        } catch (locationError) {
          // Fall back to default city
          console.warn('Using fallback city:', fullConfig.defaultCity);
          url = `/api/weather?city=${encodeURIComponent(fullConfig.defaultCity!)}&units=${fullConfig.units}`;
        }
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.weather) {
        throw new Error('Invalid weather response');
      }

      setWeatherState(prev => ({
        ...prev,
        data: data.weather,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch weather';
      console.error('Weather fetch error:', errorMessage);
      
      setWeatherState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [fullConfig.units, fullConfig.defaultCity, getCurrentPosition]);

  // Refresh weather data
  const refreshWeather = useCallback(async () => {
    if (lastLocationRef.current) {
      await fetchWeather(lastLocationRef.current);
    } else {
      await fetchWeather();
    }
  }, [fetchWeather]);

  // Fetch weather for specific city
  const fetchWeatherForCity = useCallback(async (city: string) => {
    await fetchWeather(city);
  }, [fetchWeather]);

  // Start auto-refresh
  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (fullConfig.autoRefresh) {
      intervalRef.current = setInterval(refreshWeather, fullConfig.updateInterval);
    }
  }, [fullConfig.autoRefresh, fullConfig.updateInterval, refreshWeather]);

  // Stop auto-refresh
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Initialize weather data on mount
  useEffect(() => {
    fetchWeather();
    startAutoRefresh();

    return () => {
      stopAutoRefresh();
    };
  }, [fetchWeather, startAutoRefresh, stopAutoRefresh]);

  // Get weather icon URL
  const getWeatherIconUrl = useCallback((iconCode: string, size: '2x' | '4x' = '2x') => {
    // WeatherAPI.com provides direct icon URLs, but we'll construct them from the icon code
    const sizeNum = size === '4x' ? 128 : 64;
    return `https://cdn.weatherapi.com/weather/${sizeNum}x${sizeNum}/${iconCode}.png`;
  }, []);

  // Get wind direction text
  const getWindDirection = useCallback((degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }, []);

  // Check if weather data is stale
  const isStale = useCallback(() => {
    if (!weatherState.lastUpdated) return true;
    return Date.now() - weatherState.lastUpdated > fullConfig.updateInterval;
  }, [weatherState.lastUpdated, fullConfig.updateInterval]);

  // Get weather emoji based on conditions
  const getWeatherEmoji = useCallback((iconCode: string) => {
    // WeatherAPI.com icon codes mapping
    const emojiMap: { [key: string]: string } = {
      // Day icons
      '113': '☀️', // Sunny
      '116': '⛅', // Partly cloudy
      '119': '☁️', // Cloudy
      '122': '☁️', // Overcast
      '143': '🌫️', // Mist
      '176': '🌦️', // Patchy rain possible
      '179': '🌨️', // Patchy snow possible
      '182': '🌧️', // Patchy sleet possible
      '185': '🌧️', // Patchy freezing drizzle possible
      '200': '⛈️', // Thundery outbreaks possible
      '227': '❄️', // Blowing snow
      '230': '❄️', // Blizzard
      '248': '🌫️', // Fog
      '260': '🌫️', // Freezing fog
      '263': '🌦️', // Patchy light drizzle
      '266': '🌧️', // Light drizzle
      '281': '🌧️', // Freezing drizzle
      '284': '🌧️', // Heavy freezing drizzle
      '293': '🌦️', // Patchy light rain
      '296': '🌧️', // Light rain
      '299': '🌧️', // Moderate rain at times
      '302': '🌧️', // Moderate rain
      '305': '🌧️', // Heavy rain at times
      '308': '🌧️', // Heavy rain
      '311': '🌧️', // Light freezing rain
      '314': '🌧️', // Moderate or heavy freezing rain
      '317': '🌧️', // Light sleet
      '320': '🌧️', // Moderate or heavy sleet
      '323': '🌨️', // Patchy light snow
      '326': '❄️', // Light snow
      '329': '❄️', // Patchy moderate snow
      '332': '❄️', // Moderate snow
      '335': '❄️', // Patchy heavy snow
      '338': '❄️', // Heavy snow
      '350': '🌧️', // Ice pellets
      '353': '🌦️', // Light rain shower
      '356': '🌧️', // Moderate or heavy rain shower
      '359': '🌧️', // Torrential rain shower
      '362': '🌧️', // Light sleet showers
      '365': '🌧️', // Moderate or heavy sleet showers
      '368': '🌨️', // Light snow showers
      '371': '❄️', // Moderate or heavy snow showers
      '374': '🌧️', // Light showers of ice pellets
      '377': '🌧️', // Moderate or heavy showers of ice pellets
      '386': '⛈️', // Patchy light rain with thunder
      '389': '⛈️', // Moderate or heavy rain with thunder
      '392': '⛈️', // Patchy light snow with thunder
      '395': '⛈️', // Moderate or heavy snow with thunder
    };
    return emojiMap[iconCode] || '🌤️';
  }, []);

  return {
    ...weatherState,
    refreshWeather,
    fetchWeatherForCity,
    startAutoRefresh,
    stopAutoRefresh,
    getWeatherIconUrl,
    getWindDirection,
    isStale: isStale(),
    getWeatherEmoji,
    config: fullConfig,
  };
}
