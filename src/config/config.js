const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env from project root if present
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// Config file directory in User profile
const userHome = process.env.USERPROFILE || process.env.HOME || '';
const appDataDir = path.join(userHome, '.friday');
if (!fs.existsSync(appDataDir)) {
  try {
    fs.mkdirSync(appDataDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create appDataDir:', err);
  }
}

const configFilePath = path.join(appDataDir, 'config.json');

function loadUserConfig() {
  if (fs.existsSync(configFilePath)) {
    try {
      const data = fs.readFileSync(configFilePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse user config:', e.message);
    }
  }
  return {};
}

function saveUserConfig(cfg) {
  try {
    const existing = loadUserConfig();
    const updated = { ...existing, ...cfg };
    fs.writeFileSync(configFilePath, JSON.stringify(updated, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to save user config:', e.message);
    return false;
  }
}

const userConfig = loadUserConfig();

const config = {
  appDataDir,
  configFilePath,
  openaiApiKey: process.env.OPENAI_API_KEY || userConfig.openaiApiKey || '',
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || userConfig.spotifyClientId || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || userConfig.spotifyClientSecret || '',
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI || userConfig.spotifyRedirectUri || 'http://localhost:8888/callback',
  voice: process.env.FRIDAY_VOICE || userConfig.voice || 'alloy',
  language: process.env.FRIDAY_LANGUAGE || userConfig.language || 'en',
  wakeWordEnabled: userConfig.wakeWordEnabled !== undefined ? userConfig.wakeWordEnabled : true,
  autoHideDelayMs: userConfig.autoHideDelayMs || 4000,
  windowPosition: userConfig.windowPosition || null,
  isMuted: userConfig.isMuted || false,
  saveUserConfig,
  loadUserConfig
};

module.exports = config;
