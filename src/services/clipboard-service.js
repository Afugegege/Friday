const { execFile } = require('child_process');

class ClipboardService {
  /**
   * Reads current text from Windows clipboard
   */
  async readClipboard() {
    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard'], (err, stdout) => {
        if (err) {
          resolve({ success: false, error: 'Could not read clipboard.' });
        } else {
          const text = stdout ? stdout.trim() : '';
          resolve({
            success: true,
            hasText: text.length > 0,
            text,
            length: text.length,
            preview: text.slice(0, 150) + (text.length > 150 ? '...' : '')
          });
        }
      });
    });
  }

  /**
   * Sets text to Windows clipboard
   */
  async writeClipboard(text) {
    if (!text) return { success: false, error: 'No text provided to copy.' };
    return new Promise((resolve) => {
      const ps = `Set-Clipboard -Value @'\n${text}\n'@`;
      execFile('powershell.exe', ['-NoProfile', '-Command', ps], (err) => {
        if (err) {
          resolve({ success: false, error: 'Failed to write to clipboard.' });
        } else {
          resolve({
            success: true,
            length: text.length,
            message: `Copied ${text.length} characters to clipboard.`
          });
        }
      });
    });
  }
}

module.exports = new ClipboardService();
