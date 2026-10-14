const { exec } = require('child_process');

class TimerService {
  constructor() {
    this.activeTimers = new Map();
    this.timerCounter = 1;
    this.notifyCallback = null;
  }

  setNotifyCallback(fn) {
    this.notifyCallback = fn;
  }

  /**
   * Set a countdown timer for N minutes or seconds
   */
  setTimer(durationMinutes, label = 'Timer') {
    const totalMs = Math.round(parseFloat(durationMinutes) * 60 * 1000);
    if (isNaN(totalMs) || totalMs <= 0) {
      return { success: false, error: 'Invalid duration specified.' };
    }

    const id = `timer_${this.timerCounter++}`;
    const startTime = Date.now();
    const endTime = startTime + totalMs;

    const timeoutHandle = setTimeout(() => {
      this.triggerTimerAlert(id, label);
    }, totalMs);

    const timerObj = {
      id,
      label,
      durationMinutes,
      startTime,
      endTime,
      timeoutHandle
    };

    this.activeTimers.set(id, timerObj);

    const prettyDuration = durationMinutes >= 1 
      ? `${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}` 
      : `${Math.round(durationMinutes * 60)} seconds`;

    return {
      success: true,
      timerId: id,
      label,
      duration: prettyDuration,
      summary: `Timer set for ${prettyDuration} (${label}).`
    };
  }

  /**
   * Triggers alert when timer expires
   */
  triggerTimerAlert(id, label) {
    this.activeTimers.delete(id);

    // Play pleasant Windows system chime
    exec('powershell.exe -NoProfile -Command "[System.Media.SystemSounds]::Exclamation.Play()"');

    if (typeof this.notifyCallback === 'function') {
      this.notifyCallback({
        id,
        label,
        message: `Your timer for "${label}" is up!`
      });
    }
  }

  /**
   * List all currently running timers
   */
  listTimers() {
    const now = Date.now();
    const timers = [];

    for (const [id, t] of this.activeTimers.entries()) {
      const remainingSecs = Math.max(0, Math.round((t.endTime - now) / 1000));
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      timers.push({
        id,
        label: t.label,
        remaining: `${mins}m ${secs}s`,
        remainingSeconds: remainingSecs
      });
    }

    return {
      success: true,
      count: timers.length,
      timers,
      summary: timers.length === 0 
        ? 'No active timers running.' 
        : `Active timers: ${timers.map(t => `${t.label} (${t.remaining} left)`).join(', ')}`
    };
  }

  /**
   * Cancel an existing timer
   */
  cancelTimer(id) {
    if (!id) {
      // Cancel all if unspecified
      let count = 0;
      for (const [tid, t] of this.activeTimers.entries()) {
        clearTimeout(t.timeoutHandle);
        count++;
      }
      this.activeTimers.clear();
      return { success: true, message: `Cancelled all ${count} active timers.` };
    }

    const timer = this.activeTimers.get(id);
    if (!timer) {
      return { success: false, error: `Timer "${id}" not found.` };
    }

    clearTimeout(timer.timeoutHandle);
    this.activeTimers.delete(id);
    return { success: true, message: `Timer "${timer.label}" cancelled.` };
  }
}

module.exports = new TimerService();
