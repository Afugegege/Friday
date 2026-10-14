const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

class DeveloperService {
  /**
   * Run git status, diff, or branch inspection on a directory
   */
  async gitInspection(repoPath = process.cwd(), command = 'status') {
    const validCommands = ['status', 'diff', 'branch', 'log', 'show'];
    const gitCmd = validCommands.includes(command.toLowerCase()) ? command.toLowerCase() : 'status';

    const args = gitCmd === 'log' 
      ? ['log', '-n', '5', '--oneline'] 
      : (gitCmd === 'status' ? ['status', '-s'] : [gitCmd]);

    return new Promise((resolve) => {
      execFile('git', args, { cwd: repoPath, timeout: 6000 }, (err, stdout, stderr) => {
        if (err) {
          resolve({
            success: false,
            error: `Git command failed: ${stderr || err.message}`
          });
        } else {
          resolve({
            success: true,
            repoPath,
            command: gitCmd,
            output: stdout ? stdout.trim() : 'Working tree clean.',
            summary: stdout ? `Git ${gitCmd}:\n${stdout.slice(0, 300)}` : 'Clean working directory.'
          });
        }
      });
    });
  }

  /**
   * Scans a project directory for build error logs or code files (C++, JS, Python, Rust)
   */
  async findProjectErrors(projectPath = process.cwd(), filePattern = '') {
    const fullPath = path.resolve(projectPath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `Directory "${fullPath}" does not exist.` };
    }

    // Look for common build logs or compile errors
    const errorLogFiles = ['build.log', 'compile.log', 'make.log', 'output.txt', 'error.log'];
    let foundLogContent = '';

    for (const logName of errorLogFiles) {
      const p = path.join(fullPath, logName);
      if (fs.existsSync(p)) {
        foundLogContent = fs.readFileSync(p, 'utf8').slice(-1500);
        break;
      }
    }

    return {
      success: true,
      projectPath: fullPath,
      hasErrorLog: Boolean(foundLogContent),
      errorSnippet: foundLogContent || 'No compiler log files found in directory.',
      summary: foundLogContent 
        ? `Found compile output in project. Recent errors:\n${foundLogContent.slice(0, 400)}`
        : `Inspected project at "${fullPath}". Ready for specific error query.`
    };
  }
}

module.exports = new DeveloperService();
