const express = require('express');
const axios = require('axios');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get weather for a specific city
router.get('/:city', optionalAuth, async (req, res) => {
  try {
    const { city } = req.params;
    const { units = 'metric', lang = 'en' } = req.query;

    if (!city) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'City parameter is required'
      });
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Weather API key not configured'
      });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const params = {
      q: city,
      appid: apiKey,
      units,
      lang
    };

    const response = await axios.get(url, { params });
    const weatherData = response.data;

    // Transform the data for our API
    const transformedData = {
      city: weatherData.name,
      country: weatherData.sys.country,
      coordinates: {
        lat: weatherData.coord.lat,
        lon: weatherData.coord.lon
      },
      weather: {
        main: weatherData.weather[0].main,
        description: weatherData.weather[0].description,
        icon: weatherData.weather[0].icon
      },
      temperature: {
        current: weatherData.main.temp,
        feels_like: weatherData.main.feels_like,
        min: weatherData.main.temp_min,
        max: weatherData.main.temp_max
      },
      humidity: weatherData.main.humidity,
      pressure: weatherData.main.pressure,
      wind: {
        speed: weatherData.wind.speed,
        direction: weatherData.wind.deg
      },
      visibility: weatherData.visibility,
      clouds: weatherData.clouds.all,
      sunrise: new Date(weatherData.sys.sunrise * 1000),
      sunset: new Date(weatherData.sys.sunset * 1000),
      timestamp: new Date(weatherData.dt * 1000)
    };

    res.json({
      success: true,
      data: transformedData,
      units: units === 'metric' ? 'Celsius' : units === 'imperial' ? 'Fahrenheit' : 'Kelvin'
    });

  } catch (error) {
    console.error('Weather API error:', error);

    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 404) {
        return res.status(404).json({
          error: 'City not found',
          message: 'The specified city could not be found'
        });
      }
      
      if (status === 401) {
        return res.status(500).json({
          error: 'API configuration error',
          message: 'Weather API key is invalid'
        });
      }
      
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests to weather API'
        });
      }
    }

    res.status(500).json({
      error: 'Weather service error',
      message: 'Failed to fetch weather data'
    });
  }
});

// Get weather forecast for a city
router.get('/:city/forecast', optionalAuth, async (req, res) => {
  try {
    const { city } = req.params;
    const { units = 'metric', lang = 'en', cnt = 5 } = req.query;

    if (!city) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'City parameter is required'
      });
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Weather API key not configured'
      });
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast`;
    const params = {
      q: city,
      appid: apiKey,
      units,
      lang,
      cnt: Math.min(Math.max(parseInt(cnt), 1), 40) // Limit between 1 and 40
    };

    const response = await axios.get(url, { params });
    const forecastData = response.data;

    // Transform the forecast data
    const transformedData = {
      city: forecastData.city.name,
      country: forecastData.city.country,
      coordinates: {
        lat: forecastData.city.coord.lat,
        lon: forecastData.city.coord.lon
      },
      forecast: forecastData.list.map(item => ({
        timestamp: new Date(item.dt * 1000),
        weather: {
          main: item.weather[0].main,
          description: item.weather[0].description,
          icon: item.weather[0].icon
        },
        temperature: {
          current: item.main.temp,
          feels_like: item.main.feels_like,
          min: item.main.temp_min,
          max: item.main.temp_max
        },
        humidity: item.main.humidity,
        pressure: item.main.pressure,
        wind: {
          speed: item.wind.speed,
          direction: item.wind.deg
        },
        clouds: item.clouds.all,
        pop: item.pop // Probability of precipitation
      }))
    };

    res.json({
      success: true,
      data: transformedData,
      units: units === 'metric' ? 'Celsius' : units === 'imperial' ? 'Fahrenheit' : 'Kelvin'
    });

  } catch (error) {
    console.error('Weather forecast API error:', error);

    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 404) {
        return res.status(404).json({
          error: 'City not found',
          message: 'The specified city could not be found'
        });
      }
      
      if (status === 401) {
        return res.status(500).json({
          error: 'API configuration error',
          message: 'Weather API key is invalid'
        });
      }
      
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests to weather API'
        });
      }
    }

    res.status(500).json({
      error: 'Weather service error',
      message: 'Failed to fetch weather forecast'
    });
  }
});

// Get weather by coordinates
router.get('/coordinates/:lat/:lon', optionalAuth, async (req, res) => {
  try {
    const { lat, lon } = req.params;
    const { units = 'metric', lang = 'en' } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Latitude and longitude parameters are required'
      });
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Weather API key not configured'
      });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const params = {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      appid: apiKey,
      units,
      lang
    };

    const response = await axios.get(url, { params });
    const weatherData = response.data;

    // Transform the data (same as city endpoint)
    const transformedData = {
      city: weatherData.name,
      country: weatherData.sys.country,
      coordinates: {
        lat: weatherData.coord.lat,
        lon: weatherData.coord.lon
      },
      weather: {
        main: weatherData.weather[0].main,
        description: weatherData.weather[0].description,
        icon: weatherData.weather[0].icon
      },
      temperature: {
        current: weatherData.main.temp,
        feels_like: weatherData.main.feels_like,
        min: weatherData.main.temp_min,
        max: weatherData.main.temp_max
      },
      humidity: weatherData.main.humidity,
      pressure: weatherData.main.pressure,
      wind: {
        speed: weatherData.wind.speed,
        direction: weatherData.wind.deg
      },
      visibility: weatherData.visibility,
      clouds: weatherData.clouds.all,
      sunrise: new Date(weatherData.sys.sunrise * 1000),
      sunset: new Date(weatherData.sys.sunset * 1000),
      timestamp: new Date(weatherData.dt * 1000)
    };

    res.json({
      success: true,
      data: transformedData,
      units: units === 'metric' ? 'Celsius' : units === 'imperial' ? 'Fahrenheit' : 'Kelvin'
    });

  } catch (error) {
    console.error('Weather coordinates API error:', error);

    if (error.response) {
      const { status } = error.response;
      
      if (status === 400) {
        return res.status(400).json({
          error: 'Invalid coordinates',
          message: 'The provided coordinates are invalid'
        });
      }
      
      if (status === 401) {
        return res.status(500).json({
          error: 'API configuration error',
          message: 'Weather API key is invalid'
        });
      }
      
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests to weather API'
        });
      }
    }

    res.status(500).json({
      error: 'Weather service error',
      message: 'Failed to fetch weather data'
    });
  }
});

// Get supported languages
router.get('/languages', (req, res) => {
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh_cn', name: 'Chinese Simplified' },
    { code: 'zh_tw', name: 'Chinese Traditional' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' }
  ];

  res.json({
    success: true,
    languages
  });
});

// Get supported units
router.get('/units', (req, res) => {
  const units = [
    { code: 'metric', name: 'Metric (Celsius, m/s)', description: 'Temperature in Celsius, wind speed in m/s' },
    { code: 'imperial', name: 'Imperial (Fahrenheit, mph)', description: 'Temperature in Fahrenheit, wind speed in mph' },
    { code: 'kelvin', name: 'Kelvin (K, m/s)', description: 'Temperature in Kelvin, wind speed in m/s' }
  ];

  res.json({
    success: true,
    units
  });
});

module.exports = router; 