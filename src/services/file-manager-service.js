const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

class FileManagerService {
  resolveSpecialPath(userPath) {
    if (!userPath) return os.homedir();
    const clean = userPath.trim();
    const home = os.homedir();

    if (clean.toLowerCase() === 'desktop' || clean.toLowerCase().startsWith('desktop/')) {
      return path.join(home, 'Desktop', clean.slice(7));
    }
    if (clean.toLowerCase() === 'downloads' || clean.toLowerCase().startsWith('downloads/')) {
      return path.join(home, 'Downloads', clean.slice(9));
    }
    if (clean.toLowerCase() === 'documents' || clean.toLowerCase().startsWith('documents/')) {
      return path.join(home, 'Documents', clean.slice(9));
    }
    if (clean.startsWith('~')) {
      return path.join(home, clean.slice(1));
    }
    return path.resolve(clean);
  }

  /**
   * Create directory
   */
  async createFolder(dirPath) {
    const fullPath = this.resolveSpecialPath(dirPath);
    try {
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        return { success: true, path: fullPath, message: `Created folder at "${fullPath}".` };
      }
      return { success: true, path: fullPath, message: `Folder already exists at "${fullPath}".` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * List recent files in a folder (Downloads, Desktop, Documents, etc.)
   */
  async listRecentFiles(folder = 'downloads', limit = 10) {
    const fullPath = this.resolveSpecialPath(folder);
    try {
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `Directory "${fullPath}" not found.` };
      }

      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        try {
          const filePath = path.join(fullPath, entry.name);
          const stat = fs.statSync(filePath);
          files.push({
            name: entry.name,
            path: filePath,
            isDir: entry.isDirectory(),
            sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
            modified: stat.mtime
          });
        } catch (e) {}
      }

      files.sort((a, b) => b.modified - a.modified);
      const topFiles = files.slice(0, limit);

      return {
        success: true,
        directory: fullPath,
        count: topFiles.length,
        files: topFiles,
        summary: `Found ${topFiles.length} recent item(s) in ${path.basename(fullPath)}: ${topFiles.map(f => f.name).join(', ')}`
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Compress or expand zip archive
   */
  async archive(action = 'compress', sourcePath, targetPath) {
    const src = this.resolveSpecialPath(sourcePath);
    const dest = this.resolveSpecialPath(targetPath);

    return new Promise((resolve) => {
      const psCommand = action === 'extract'
        ? `Expand-Archive -Path '${src}' -DestinationPath '${dest}' -Force`
        : `Compress-Archive -Path '${src}' -DestinationPath '${dest}' -Force`;

      execFile('powershell.exe', ['-NoProfile', '-Command', psCommand], (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({
            success: true,
            action,
            source: src,
            target: dest,
            message: `${action === 'extract' ? 'Extracted' : 'Compressed'} successfully.`
          });
        }
      });
    });
  }
}

module.exports = new FileManagerService();
