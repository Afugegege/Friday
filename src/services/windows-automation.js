const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class WindowsAutomation {
  constructor() {
    this.userHome = os.homedir();
    this.scriptsDir = path.join(__dirname, 'powershell-scripts');
    this.searchFolders = [
      path.join(this.userHome, 'Documents'),
      path.join(this.userHome, 'Desktop'),
      path.join(this.userHome, 'Downloads'),
      path.join(this.userHome, 'Documents', 'Projects')
    ];
  }

  /**
   * Launch an application safely
   */
  async launchApp(appNameOrPath) {
    return new Promise((resolve) => {
      const lower = appNameOrPath.toLowerCase().trim();

      const aliases = {
        'spotify': 'start spotify:',
        'chrome': 'start chrome',
        'browser': 'start msedge',
        'edge': 'start msedge',
        'vscode': 'code',
        'code': 'code',
        'notepad': 'notepad',
        'terminal': 'start wt',
        'cmd': 'start cmd',
        'powershell': 'start powershell',
        'calculator': 'calc',
        'calc': 'calc',
        'explorer': 'explorer',
        'files': 'explorer',
        'settings': 'start ms-settings:',
        'taskmgr': 'start taskmgr',
        'task manager': 'start taskmgr'
      };

      const command = aliases[lower] || `start "" "${appNameOrPath}"`;

      exec(command, (error) => {
        if (error) {
          exec(`start ${appNameOrPath}`, (err2) => {
            if (err2) {
              resolve({ success: false, error: `Could not launch ${appNameOrPath}: ${err2.message}` });
            } else {
              resolve({ success: true, message: `Launched ${appNameOrPath}` });
            }
          });
        } else {
          resolve({ success: true, message: `Launched ${appNameOrPath}` });
        }
      });
    });
  }

  /**
   * Open any URL in the user's default web browser
   */
  async openUrl(url) {
    return new Promise((resolve) => {
      let target = url.trim();
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `https://${target}`;
      }
      exec(`start "" "${target}"`, (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, message: `Opened ${target}` });
        }
      });
    });
  }

  /**
   * Execute approved system action (lock, minimize all, sleep, volume, battery)
   */
  async systemAction(action) {
    const act = action.toLowerCase().trim();
    return new Promise((resolve) => {
      if (act === 'lock' || act === 'lock_workstation') {
        exec('rundll32.exe user32.dll,LockWorkStation', (err) => {
          resolve({ success: !err, message: 'Workstation locked' });
        });
      } else if (act === 'minimize_all' || act === 'show_desktop') {
        const ps = `(New-Object -ComObject Shell.Application).MinimizeAll()`;
        exec(`powershell -NoProfile -Command "${ps}"`, (err) => {
          resolve({ success: !err, message: 'Minimized all windows' });
        });
      } else if (act === 'undo_minimize') {
        const ps = `(New-Object -ComObject Shell.Application).UndoMinimizeALL()`;
        exec(`powershell -NoProfile -Command "${ps}"`, (err) => {
          resolve({ success: !err, message: 'Restored windows' });
        });
      } else if (act === 'battery') {
        const ps = `Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json -Compress`;
        exec(`powershell -NoProfile -Command "${ps}"`, (err, stdout) => {
          if (err || !stdout.trim()) {
            resolve({ success: true, message: 'On AC Power (Desktop or fully charged)' });
          } else {
            try {
              const b = JSON.parse(stdout);
              resolve({ success: true, batteryPercent: b.EstimatedChargeRemaining, message: `Battery is at ${b.EstimatedChargeRemaining}%` });
            } catch {
              resolve({ success: true, message: 'Battery status normal' });
            }
          }
        });
      } else if (act === 'volume_up' || act === 'volume_down' || act === 'mute') {
        this.sendMediaKey(act).then(resolve);
      } else {
        resolve({ success: false, error: `Unknown system action: ${action}` });
      }
    });
  }

  /**
   * Send keyboard shortcuts (e.g., "Alt+Tab", "Win+D", "Ctrl+W")
   */
  async sendKeyboardShortcut(keys) {
    return new Promise((resolve) => {
      // Map common shortcut names to Windows SendKeys
      const keyMap = {
        'ctrl+c': '^c',
        'ctrl+v': '^v',
        'ctrl+z': '^z',
        'ctrl+w': '^w',
        'ctrl+t': '^t',
        'alt+f4': '%{F4}',
        'enter': '{ENTER}',
        'escape': '{ESC}',
        'space': ' '
      };

      const mapped = keyMap[keys.toLowerCase().trim()] || keys;
      const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${mapped}')`;
      exec(`powershell -NoProfile -Command "${ps}"`, (err) => {
        resolve({ success: !err, message: `Executed shortcut: ${keys}` });
      });
    });
  }

  /**
   * Execute raw PowerShell command for advanced automation
   */
  async executeShell(command) {
    return new Promise((resolve) => {
      exec(`powershell -NoProfile -Command "${command.replace(/"/g, '\"')}"`, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message });
        } else {
          resolve({ success: true, output: stdout.trim() });
        }
      });
    });
  }

  /**
   * List currently running processes with active windows
   */
  async getRunningWindows() {
    return new Promise((resolve) => {
      const script = path.join(this.scriptsDir, 'list-windows.ps1');
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', script
      ], (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve([]);
          return;
        }
        try {
          const list = JSON.parse(stdout.trim());
          resolve(Array.isArray(list) ? list : [list]);
        } catch {
          resolve([]);
        }
      });
    });
  }

  /**
   * Send native Windows Media Key events
   */
  async sendMediaKey(action) {
    return new Promise((resolve) => {
      const script = path.join(this.scriptsDir, 'media-key.ps1');
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Action', action
      ], (err, stdout) => {
        if (err || (stdout && stdout.includes('Error'))) {
          resolve({ success: false, error: err ? err.message : stdout });
        } else {
          resolve({ success: true, action });
        }
      });
    });
  }

  /**
   * Search for files by query string or extension
   */
  async searchFiles(query, maxResults = 10) {
    return new Promise((resolve) => {
      const script = path.join(this.scriptsDir, 'search-files.ps1');
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Query', query,
        '-MaxResults', maxResults.toString()
      ], (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const items = Array.isArray(parsed) ? parsed : [parsed];
          resolve(items.map(item => ({
            name: item.Name,
            path: item.FullName,
            size: item.Length,
            modified: item.LastWriteTime
          })));
        } catch {
          resolve([]);
        }
      });
    });
  }

  /**
   * Open a file in its default associated Windows application
   */
  async openFile(filePath) {
    return new Promise((resolve) => {
      if (!fs.existsSync(filePath)) {
        resolve({ success: false, error: `File not found: ${filePath}` });
        return;
      }
      exec(`start "" "${filePath}"`, (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, message: `Opened ${path.basename(filePath)}` });
        }
      });
    });
  }

  /**
   * Read file preview/content
   */
  async readFileContent(filePath, maxBytes = 4000) {
    return new Promise((resolve) => {
      if (!fs.existsSync(filePath)) {
        resolve({ success: false, error: 'File does not exist' });
        return;
      }
      fs.open(filePath, 'r', (err, fd) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        const buf = Buffer.alloc(maxBytes);
        fs.read(fd, buf, 0, maxBytes, 0, (readErr, bytesRead) => {
          fs.close(fd, () => {});
          if (readErr) {
            resolve({ success: false, error: readErr.message });
            return;
          }
          const text = buf.slice(0, bytesRead).toString('utf8');
          resolve({ success: true, content: text, bytesRead });
        });
      });
    });
  }

  /**
   * Save a note or document to the user's Friday Notes directory
   */
  async saveDocument(filename, content) {
    const notesDir = path.join(this.userHome, 'Documents', 'Friday Notes');
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
    const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_');
    const target = path.join(notesDir, safeName.endsWith('.txt') || safeName.endsWith('.md') ? safeName : `${safeName}.md`);
    fs.writeFileSync(target, content, 'utf8');
    return { success: true, filePath: target };
  }
}

module.exports = new WindowsAutomation();
