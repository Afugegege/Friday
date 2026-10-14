const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class ActivityLogger {
  constructor() {
    this.maxLines = 350; // Rolling limit of lines for checkup, improve, upgrade
    // Primary log in project root for easy developer inspection
    this.primaryLogPath = path.resolve(__dirname, '../../activity.log');
    // Backup log in appDataDir
    this.backupLogPath = path.join(config.appDataDir, 'activity.log');
    this.counter = 0;
  }

  /**
   * Log an interaction turn with input, executed actions, and output
   * @param {object} entry { input, actions, output, durationMs, status }
   */
  logTurn({ input, actions = [], output, durationMs = 0, status = 'OK' }) {
    this.counter++;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').slice(0, 19);

    const separator = '═'.repeat(60);
    const actionStr = actions.length > 0
      ? actions.map(a => `  • ${a.name || a.tool}(${JSON.stringify(a.args || {})}) -> ${JSON.stringify(a.result || {})}`).join('\n')
      : '  • None (Direct reasoning)';

    const entryText = [
      separator,
      `[${timeStr}] TURN #${this.counter} | DURATION: ${durationMs}ms | STATUS: ${status}`,
      `INPUT:  "${input}"`,
      `ACTION:`,
      actionStr,
      `OUTPUT: "${output}"`,
      ''
    ].join('\n');

    this._appendAndRotate(this.primaryLogPath, entryText);
    this._appendAndRotate(this.backupLogPath, entryText);
  }

  _appendAndRotate(filePath, entryText) {
    try {
      let currentContent = '';
      if (fs.existsSync(filePath)) {
        currentContent = fs.readFileSync(filePath, 'utf8');
      }

      const combined = currentContent + entryText + '\n';
      const lines = combined.split('\n');

      if (lines.length > this.maxLines) {
        // Keep only the most recent maxLines
        const trimmed = lines.slice(-this.maxLines).join('\n');
        fs.writeFileSync(filePath, trimmed, 'utf8');
      } else {
        fs.appendFileSync(filePath, entryText + '\n', 'utf8');
      }
    } catch (err) {
      console.warn('ActivityLogger write notice:', err.message);
    }
  }

  getRecentLogs(lineCount = 100) {
    try {
      if (fs.existsSync(this.primaryLogPath)) {
        const text = fs.readFileSync(this.primaryLogPath, 'utf8');
        const lines = text.split('\n');
        return lines.slice(-lineCount).join('\n');
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  clearLogs() {
    try {
      if (fs.existsSync(this.primaryLogPath)) fs.writeFileSync(this.primaryLogPath, '', 'utf8');
      if (fs.existsSync(this.backupLogPath)) fs.writeFileSync(this.backupLogPath, '', 'utf8');
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new ActivityLogger();
