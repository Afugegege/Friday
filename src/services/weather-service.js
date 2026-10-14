const https = require('https');

class WeatherService {
  /**
   * Fetches real-time weather and forecast for any city or location
   */
  async getWeather(location = '') {
    const locEnc = encodeURIComponent(location.trim() || '');
    const url = `https://wttr.in/${locEnc}?format=j1`;

    return new Promise((resolve) => {
      const req = https.get(url, { headers: { 'User-Agent': 'curl/7.68.0' }, timeout: 6000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const current = json.current_condition && json.current_condition[0] ? json.current_condition[0] : {};
            const nearest = json.nearest_area && json.nearest_area[0] ? json.nearest_area[0] : {};
            const areaName = nearest.areaName && nearest.areaName[0] ? nearest.areaName[0].value : location;
            const country = nearest.country && nearest.country[0] ? nearest.country[0].value : '';
            const weatherDesc = current.weatherDesc && current.weatherDesc[0] ? current.weatherDesc[0].value : 'Unknown';

            // Today's forecast min/max
            const today = json.weather && json.weather[0] ? json.weather[0] : {};
            const minTempC = today.mintempC || current.temp_C;
            const maxTempC = today.maxtempC || current.temp_C;

            resolve({
              success: true,
              location: `${areaName}${country ? ', ' + country : ''}`,
              tempC: `${current.temp_C}°C`,
              tempF: `${current.temp_F}°F`,
              feelsLikeC: `${current.FeelsLikeC}°C`,
              condition: weatherDesc,
              humidity: `${current.humidity}%`,
              windSpeedKm: `${current.windspeedKmph} km/h`,
              precipitationMm: `${current.precipMM} mm`,
              todayRange: `${minTempC}°C - ${maxTempC}°C`,
              summary: `Current weather in ${areaName}: ${weatherDesc}, ${current.temp_C}°C (feels like ${current.FeelsLikeC}°C). Humidity ${current.humidity}%, Wind ${current.windspeedKmph} km/h.`
            });
          } catch (e) {
            resolve({
              success: false,
              error: `Unable to parse weather data for "${location}".`
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          error: `Weather lookup failed: ${err.message}`
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Weather lookup timed out.'
        });
      });
    });
  }
}

module.exports = new WeatherService();
