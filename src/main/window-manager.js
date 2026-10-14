const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const config = require('../config/config');

class WindowManager {
  constructor() {
    this.pillWindow = null;
    this.settingsWindow = null;
  }

  createPillWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;

    const pillWidth = 380;
    const pillHeight = 90;

    // Default position: top center
    let initialX = Math.round((screenWidth - pillWidth) / 2);
    let initialY = 40;

    if (config.windowPosition && typeof config.windowPosition.x === 'number') {
      initialX = config.windowPosition.x;
      initialY = config.windowPosition.y;
    }

    this.pillWindow = new BrowserWindow({
      width: pillWidth,
      height: pillHeight,
      x: initialX,
      y: initialY,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false, // Prevents stealing keyboard focus
      hasShadow: false,
      resizable: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    });

    // Keep always on top even across full-screen or screen-saver level
    this.pillWindow.setAlwaysOnTop(true, 'screen-saver');
    this.pillWindow.setVisibleOnAllWorkspaces(true);

    this.pillWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    this.pillWindow.on('closed', () => {
      this.pillWindow = null;
    });

    return this.pillWindow;
  }

  showPill() {
    if (!this.pillWindow || this.pillWindow.isDestroyed()) {
      this.createPillWindow();
    }
    // Crucial: showInactive prevents stealing focus from active window
    this.pillWindow.showInactive();
    this.pillWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  hidePill() {
    if (this.pillWindow && !this.pillWindow.isDestroyed()) {
      this.pillWindow.hide();
    }
  }

  movePill(deltaX, deltaY) {
    if (!this.pillWindow || this.pillWindow.isDestroyed()) return;
    const [curX, curY] = this.pillWindow.getPosition();
    const newX = curX + deltaX;
    const newY = curY + deltaY;
    this.pillWindow.setPosition(newX, newY);
  }

  savePillPosition() {
    if (!this.pillWindow || this.pillWindow.isDestroyed()) return;
    const [x, y] = this.pillWindow.getPosition();
    config.saveUserConfig({ windowPosition: { x, y } });
  }

  createSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 550,
      height: 650,
      title: 'FRIDAY Settings',
      autoHideMenuBar: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    this.settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }
}

module.exports = new WindowManager();
