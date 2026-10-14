const path = require('path');
const os = require('os');

class SecurityService {
  constructor() {
    this.userHome = os.homedir();
    this.projectRoot = path.resolve(process.cwd());

    // Restricted system directories
    this.restrictedRoots = [
      'c:\\windows',
      'c:\\program files',
      'c:\\program files (x86)',
      'c:\\system volume information',
      'c:\\recovery'
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
      /\bdrop\s+database\b/i,
      /\bdiskpart\b/i,
      /\bnet\s+user\b.*\/delete/i,
      /\bvssadmin\s+delete/i,
      /\bbcdedit\b/i
    ];

    // Suspicious prompt injection vectors commonly encountered in untrusted web pages or OCR
    this.injectionPatterns = [
      /ignore\s+(?:all\s+)?previous\s+instructions/i,
      /disregard\s+(?:all\s+)?prior\s+prompts/i,
      /you\s+are\s+now\s+(?:unrestricted|in\s+developer\s+mode|dan)/i,
      /system\s+prompt\s+override/i,
      /reveal\s+(?:your\s+)?system\s+instructions/i
    ];
  }

  /**
   * Validate whether a file path is within authorized boundaries and not a system-critical folder
   */
  isPathAllowed(targetPath) {
    if (!targetPath) return false;
    const resolved = path.resolve(targetPath).toLowerCase();

    for (const restricted of this.restrictedRoots) {
      if (resolved.startsWith(restricted)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate file operation permissions
   */
  validateFileOperation(operation, filePath) {
    if (!filePath) {
      return { allowed: false, reason: 'File path cannot be empty.' };
    }

    if (!this.isPathAllowed(filePath)) {
      return {
        allowed: false,
        requiresConfirmation: true,
        reason: `Operation "${operation}" targets restricted system path: ${filePath}`
      };
    }

    if (operation === 'delete' || operation === 'overwrite') {
      const ext = path.extname(filePath).toLowerCase();
      const protectedExts = ['.sys', '.dll', '.exe', '.bat', '.cmd', '.ps1', '.vbs'];
      if (protectedExts.includes(ext)) {
        return {
          allowed: false,
          requiresConfirmation: true,
          reason: `Modifying executable/system extension (${ext}) requires explicit user confirmation.`
        };
      }
    }

    return { allowed: true };
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
          reason: `Command blocked by security policy (matches restricted destructive pattern: ${pattern.toString()})`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Sanitizes untrusted text (web content, OCR results, clipboard) to neutralize prompt injection attacks
   */
  sanitizeUntrustedText(text) {
    if (!text || typeof text !== 'string') return '';
    let sanitized = text;

    for (const pattern of this.injectionPatterns) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '[SUSPICIOUS INSTRUCTION REMOVED BY FRIDAY SECURITY]');
      }
    }

    return sanitized;
  }
}

module.exports = new SecurityService();
