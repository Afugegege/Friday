const { ipcMain, desktopCapturer, screen } = require('electron');
const aiOrchestrator = require('../services/ai-orchestrator');
const windowManager = require('./window-manager');
const screenService = require('../services/screen-service');
const config = require('../config/config');

function setupIpcHandlers() {
  // Register native desktop capturer for vision and computer use
  screenService.setNativeCapturer(async () => {
    let bounds = { width: 1920, height: 1080 };
    try {
      const primary = screen.getPrimaryDisplay();
      if (primary && primary.bounds) {
        bounds = primary.bounds;
      }
    } catch (e) {
      console.warn('Could not query primary display bounds:', e.message);
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: bounds.width, height: bounds.height }
    });
    if (sources && sources.length > 0) {
      return {
        base64: sources[0].thumbnail.toDataURL(),
        width: bounds.width,
        height: bounds.height
      };
    }
    return null;
  });

  ipcMain.on('friday:hide-pill', () => {
    windowManager.hidePill();
  });

  ipcMain.on('friday:show-pill', () => {
    windowManager.showPill();
  });

  ipcMain.on('friday:drag-window', (_event, { deltaX, deltaY }) => {
    windowManager.movePill(deltaX, deltaY);
  });

  ipcMain.on('friday:save-position', () => {
    windowManager.savePillPosition();
  });

  ipcMain.on('friday:set-ignore-mouse', (_event, ignore) => {
    if (windowManager.pillWindow && !windowManager.pillWindow.isDestroyed()) {
      windowManager.pillWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  ipcMain.handle('friday:process-command', async (_event, text, options) => {
    return await aiOrchestrator.processCommand(text, options, (status) => {
      if (windowManager.pillWindow && !windowManager.pillWindow.isDestroyed()) {
        windowManager.pillWindow.webContents.send('friday:status-update', status);
      }
    });
  });

  ipcMain.handle('friday:transcribe-audio', async (_event, arrayBuffer, mimeType) => {
    const buffer = Buffer.from(arrayBuffer);
    return await aiOrchestrator.transcribeAudio(buffer, mimeType);
  });

  ipcMain.handle('friday:synthesize-speech', async (_event, text) => {
    return await aiOrchestrator.synthesizeSpeech(text);
  });

  ipcMain.handle('friday:get-config', () => {
    return {
      openaiApiKey: config.openaiApiKey ? '••••••••' + config.openaiApiKey.slice(-4) : '',
      hasApiKey: Boolean(config.openaiApiKey),
      voice: config.voice,
      language: config.language,
      wakeWordEnabled: config.wakeWordEnabled,
      autoHideDelayMs: config.autoHideDelayMs,
      isMuted: config.isMuted
    };
  });

  ipcMain.handle('friday:save-config', (_event, newCfg) => {
    if (newCfg.openaiApiKey && !newCfg.openaiApiKey.includes('••••')) {
      config.openaiApiKey = newCfg.openaiApiKey;
      process.env.OPENAI_API_KEY = newCfg.openaiApiKey;
    }
    if (newCfg.voice) config.voice = newCfg.voice;
    if (newCfg.language) config.language = newCfg.language;
    if (newCfg.wakeWordEnabled !== undefined) config.wakeWordEnabled = newCfg.wakeWordEnabled;
    if (newCfg.autoHideDelayMs) config.autoHideDelayMs = newCfg.autoHideDelayMs;
    if (newCfg.isMuted !== undefined) config.isMuted = newCfg.isMuted;

    config.saveUserConfig(newCfg);
    return { success: true };
  });
}

module.exports = { setupIpcHandlers };
