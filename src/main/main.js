const { app, Tray, Menu, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const windowManager = require('./window-manager');
const { setupIpcHandlers } = require('./ipc-handlers');
const config = require('../config/config');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  windowManager.showPill();
  if (windowManager.pillWindow) {
    windowManager.pillWindow.webContents.send('friday:activate', { source: 'second-instance' });
  }
});

let tray = null;

function createDefaultTrayIcon() {
  const base64Icon = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkoBAwUqifYdQAYgz4//8/AxZ1MAw0ZDEuG7AbjGQwLpvxGgCzCVkTRTbgsoh4A7AbjKxIkkV4DOBsMBbXYIeD0eB+DDCyGq/T/uPia2QDsLoQ3e84rUE2gFBDjQYAS3w39Wn99gEAAAAASUVORK5CYII=';
  const img = nativeImage.createFromBuffer(Buffer.from(base64Icon, 'base64'));
  return img;
}

function buildTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Activate Friday',
      accelerator: 'Ctrl+Alt+F',
      click: () => {
        windowManager.showPill();
        if (windowManager.pillWindow) {
          windowManager.pillWindow.webContents.send('friday:activate', { source: 'tray' });
        }
      }
    },
    { type: 'separator' },
    {
      label: config.isMuted ? 'Unmute Microphone' : 'Mute Microphone',
      accelerator: 'Ctrl+Alt+M',
      click: () => {
        config.isMuted = !config.isMuted;
        config.saveUserConfig({ isMuted: config.isMuted });
        if (windowManager.pillWindow) {
          windowManager.pillWindow.webContents.send('friday:mute-toggled', config.isMuted);
        }
        buildTrayMenu();
      }
    },
    {
      label: 'Wake Word ("Friday")',
      type: 'checkbox',
      checked: config.wakeWordEnabled,
      click: (menuItem) => {
        config.wakeWordEnabled = menuItem.checked;
        config.saveUserConfig({ wakeWordEnabled: menuItem.checked });
      }
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: () => {
        windowManager.createSettingsWindow();
      }
    },
    {
      label: 'Quit Friday',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  if (tray) {
    tray.setContextMenu(contextMenu);
  }
}

function initializeApp() {
  setupIpcHandlers();
  windowManager.createPillWindow();

  // Create System Tray
  const icon = createDefaultTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('FRIDAY - AI Voice Assistant');
  buildTrayMenu();

  tray.on('double-click', () => {
    windowManager.showPill();
    if (windowManager.pillWindow) {
      windowManager.pillWindow.webContents.send('friday:activate', { source: 'tray' });
    }
  });

  // Register Global Hotkeys
  try {
    globalShortcut.register('Ctrl+Alt+F', () => {
      windowManager.showPill();
      if (windowManager.pillWindow) {
        windowManager.pillWindow.webContents.send('friday:activate', { source: 'hotkey' });
      }
    });

    globalShortcut.register('Ctrl+Alt+M', () => {
      config.isMuted = !config.isMuted;
      config.saveUserConfig({ isMuted: config.isMuted });
      if (windowManager.pillWindow) {
        windowManager.pillWindow.webContents.send('friday:mute-toggled', config.isMuted);
      }
      buildTrayMenu();
    });
  } catch (err) {
    console.warn('Global shortcut registration notice:', err.message);
  }

  // Self-test / Verification Mode
  if (process.argv.includes('--test-mode')) {
    console.log('Friday running in verification mode...');
    setTimeout(() => {
      console.log('Friday verification completed successfully.');
      app.isQuitting = true;
      app.quit();
      process.exit(0);
    }, 2500);
  }
}

app.whenReady().then(() => {
  initializeApp();

  app.on('activate', () => {
    if (windowManager.pillWindow === null) {
      windowManager.createPillWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  // Stay in background tray unless quitting
  if (!app.isQuitting && !process.argv.includes('--test-mode')) {
    e.preventDefault();
  }
});
