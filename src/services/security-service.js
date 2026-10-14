const path = require('path');
const os = require('os');

class SecurityService {
  constructor() {
    this.allowedRootPaths = [
      os.homedir(),
      path.resolve(process.cwd())
    ];

    // Potentially destructive or sensitive command patterns
    this.destructivePatterns = [
      /\brmdir\b\s+\/[sq]/i,
      /\bdel\b\s+\/[sqf]/i,
      /\bformat\b\s+[a-z]:/i,
      /\bshutdown\b/i,
      /\brestart-computer\b/i,
      /\bstop-computer\b/i,
      /\breg\b\s+delete/i,
      /\bdrop\s+database\b/i
    ];
  }

  /**
   * Validate whether a file path is within authorized boundaries
   */
  isPathAllowed(targetPath) {
    if (!targetPath) return false;
    const resolved = path.resolve(targetPath);
    // Block system-critical roots like C:\Windows or C:\Program Files writes unless explicitly targeted
    const lower = resolved.toLowerCase();
    if (lower.startsWith('c:\\windows') || lower.startsWith('c:\\system volume information')) {
      return false;
    }
    return true;
  }

  /**
   * Validate PowerShell or shell command before execution
   */
  validateCommand(cmd) {
    if (!cmd || typeof cmd !== 'string') {
      return { allowed: false, reason: 'Command is empty or invalid.' };
    }

    for (const pattern of this.destructivePatterns) {
      if (pattern.test(cmd)) {
        return {
          allowed: false,
          requiresConfirmation: true,
          reason: `Command matches restricted destructive pattern: ${pattern.toString()}`
        };
      }
    }

    return { allowed: true };
  }
}

module.exports = new SecurityService();
