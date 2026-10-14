const https = require('https');
const windowsAutomation = require('./windows-automation');
const config = require('../config/config');

class SpotifyService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  hasApiCredentials() {
    return Boolean(config.spotifyClientId && config.spotifyClientSecret);
  }

  /**
   * Play a track by query or resume playback
   */
  async play(trackQuery = '') {
    // If no specific query is given, resume playback instantly
    if (!trackQuery || !trackQuery.trim()) {
      const mediaRes = await windowsAutomation.sendMediaKey('play');
      return {
        success: mediaRes.success,
        mode: 'media_key',
        message: 'Resumed playback'
      };
    }

    const cleanQuery = trackQuery.trim();
    let track = null;

    if (this.hasApiCredentials()) {
      try {
        track = await this.searchTrack(cleanQuery);
      } catch (err) {
        console.warn('Spotify search notice:', err.message);
      }
    }

    if (track && track.id) {
      // Launch Spotify directly with the exact track URI for instant playback
      await windowsAutomation.launchApp(`spotify:track:${track.id}`);
      
      // Send play media key after brief delay to guarantee playback begins
      setTimeout(() => {
        windowsAutomation.sendMediaKey('play');
      }, 400);

      return {
        success: true,
        mode: 'desktop_track',
        track: `${track.name} by ${track.artists}`,
        message: `Playing ${track.name} by ${track.artists}`
      };
    }

    // Fallback: Launch Spotify and search track query
    await windowsAutomation.launchApp(`spotify:search:${encodeURIComponent(cleanQuery)}`);
    setTimeout(() => {
      windowsAutomation.sendMediaKey('play');
    }, 600);

    return {
      success: true,
      mode: 'desktop_app',
      track: cleanQuery,
      message: `Playing "${cleanQuery}" in Spotify`
    };
  }

  /**
   * Pause playback
   */
  async pause() {
    const res = await windowsAutomation.sendMediaKey('pause');
    return { success: res.success, message: 'Paused media playback' };
  }

  /**
   * Skip to next track
   */
  async next() {
    const res = await windowsAutomation.sendMediaKey('next');
    return { success: res.success, message: 'Skipped to next track' };
  }

  /**
   * Previous track
   */
  async previous() {
    const res = await windowsAutomation.sendMediaKey('previous');
    return { success: res.success, message: 'Returned to previous track' };
  }

  /**
   * Search for a track on Spotify using Client Credentials (super fast)
   */
  async searchTrack(query) {
    const token = await this._getAccessToken();
    if (!token) return null;

    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
    return new Promise((resolve) => {
      const req = https.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 2500
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.tracks && parsed.tracks.items && parsed.tracks.items.length > 0) {
              const item = parsed.tracks.items[0];
              resolve({
                id: item.id,
                name: item.name,
                uri: item.uri,
                artists: item.artists.map(a => a.name).join(', ')
              });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  async _getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }
    if (!config.spotifyClientId || !config.spotifyClientSecret) {
      return null;
    }

    return new Promise((resolve) => {
      const auth = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64');
      const payload = 'grant_type=client_credentials';

      const req = https.request({
        hostname: 'accounts.spotify.com',
        path: '/api/token',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 3000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.access_token) {
              this.accessToken = data.access_token;
              this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
              resolve(this.accessToken);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = new SpotifyService();
