const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ScreenService {
  constructor() {
    this.tempScreenshotPath = path.join(os.tmpdir(), 'friday_screen_capture.png');
    this.scriptPath = path.join(__dirname, 'powershell-scripts', 'capture-screen.ps1');
    this.inputScriptPath = path.join(__dirname, 'powershell-scripts', 'mouse-keyboard.ps1');
    this.nativeCapturer = null;
  }

  setNativeCapturer(fn) {
    this.nativeCapturer = fn;
  }

  /**
   * Captures the primary display screen using Electron native capturer or PowerShell fallback
   */
  async captureScreen() {
    if (typeof this.nativeCapturer === 'function') {
      try {
        const nativeResult = await this.nativeCapturer();
        if (nativeResult && nativeResult.base64) {
          const base64Data = nativeResult.base64.replace(/^data:image\/\w+;base64,/, '');
          fs.writeFileSync(this.tempScreenshotPath, Buffer.from(base64Data, 'base64'));
          return {
            success: true,
            filePath: this.tempScreenshotPath,
            base64: nativeResult.base64
          };
        }
      } catch (err) {
        console.warn('Native screen capturer notice:', err.message);
      }
    }

    return new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.scriptPath,
        '-OutputPath', this.tempScreenshotPath
      ], (err, stdout, stderr) => {
        if (err || !fs.existsSync(this.tempScreenshotPath)) {
          resolve({
            success: false,
            error: err ? (stderr || err.message) : 'Screenshot capture unavailable'
          });
          return;
        }

        try {
          const imageBuffer = fs.readFileSync(this.tempScreenshotPath);
          const base64 = imageBuffer.toString('base64');
          resolve({
            success: true,
            filePath: this.tempScreenshotPath,
            base64: `data:image/png;base64,${base64}`
          });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });
  }

  /**
   * Click mouse at coordinate (x, y)
   */
  async clickMouse(x, y) {
    return new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.inputScriptPath,
        '-Action', 'click',
        '-X', Math.round(x).toString(),
        '-Y', Math.round(y).toString()
      ], (err, stdout) => {
        if (err || (stdout && stdout.includes('Error'))) {
          resolve({ success: false, error: err ? err.message : stdout });
        } else {
          resolve({ success: true, message: `Clicked at (${Math.round(x)}, ${Math.round(y)})` });
        }
      });
    });
  }

  /**
   * Double click mouse at coordinate (x, y)
   */
  async doubleClick(x, y) {
    return new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.inputScriptPath,
        '-Action', 'double_click',
        '-X', Math.round(x).toString(),
        '-Y', Math.round(y).toString()
      ], (err, stdout) => {
        if (err || (stdout && stdout.includes('Error'))) {
          resolve({ success: false, error: err ? err.message : stdout });
        } else {
          resolve({ success: true, message: `Double-clicked at (${Math.round(x)}, ${Math.round(y)})` });
        }
      });
    });
  }

  /**
   * Right click mouse at coordinate (x, y)
   */
  async rightClick(x, y) {
    return new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.inputScriptPath,
        '-Action', 'right_click',
        '-X', Math.round(x).toString(),
        '-Y', Math.round(y).toString()
      ], (err, stdout) => {
        if (err || (stdout && stdout.includes('Error'))) {
          resolve({ success: false, error: err ? err.message : stdout });
        } else {
          resolve({ success: true, message: `Right-clicked at (${Math.round(x)}, ${Math.round(y)})` });
        }
      });
    });
  }

  /**
   * Scroll mouse wheel (positive = up, negative = down)
   */
  async scroll(amount = -120) {
    return new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.inputScriptPath,
        '-Action', 'scroll',
        '-ScrollAmount', amount.toString()
      ], (err, stdout) => {
        if (err || (stdout && stdout.includes('Error'))) {
          resolve({ success: false, error: err ? err.message : stdout });
        } else {
          resolve({ success: true, message: `Scrolled mouse wheel (${amount})` });
        }
      });
    });
  }

  /**
   * Type text via Windows SendKeys
   */
  async sendKeyboardText(text) {
    return new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.inputScriptPath,
        '-Action', 'type',
        '-Text', text
      ], (err, stdout) => {
        if (err || (stdout && stdout.includes('Error'))) {
          resolve({ success: false, error: err ? err.message : stdout });
        } else {
          resolve({ success: true, message: `Typed: "${text}"` });
        }
      });
    });
  }

  /**
   * Press special keyboard key
   */
  async sendKey(key) {
    return new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.inputScriptPath,
        '-Action', 'key',
        '-Text', key
      ], (err, stdout) => {
        if (err || (stdout && stdout.includes('Error'))) {
          resolve({ success: false, error: err ? err.message : stdout });
        } else {
          resolve({ success: true, message: `Pressed key: ${key}` });
        }
      });
    });
  }
}

module.exports = new ScreenService();
