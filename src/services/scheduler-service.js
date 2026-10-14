const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { exec } = require('child_process');

class SchedulerService {
  constructor() {
    this.schedulerFile = path.join(config.appDataDir, 'scheduler.json');
    this.tasks = [];
    this.timerHandles = new Map();
    this.notificationHandler = null;
    this.load();
    this.initTimers();
  }

  setNotificationHandler(fn) {
    this.notificationHandler = fn;
  }

  load() {
    try {
      if (fs.existsSync(this.schedulerFile)) {
        const raw = fs.readFileSync(this.schedulerFile, 'utf8');
        this.tasks = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('SchedulerService: failed to load tasks:', e.message);
      this.tasks = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.schedulerFile, JSON.stringify(this.tasks, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('SchedulerService: failed to save tasks:', e.message);
      return false;
    }
  }

  initTimers() {
    const now = Date.now();
    for (const task of this.tasks) {
      if (task.status === 'pending') {
        const remaining = task.targetTime - now;
        if (remaining <= 0) {
          // Missed during shutdown/sleep -> trigger or mark overdue
          this.executeTask(task.id);
        } else {
          this.scheduleExecution(task.id, remaining);
        }
      }
    }
  }

  scheduleExecution(id, delayMs) {
    const handle = setTimeout(() => {
      this.executeTask(id);
    }, delayMs);
    this.timerHandles.set(id, handle);
  }

  /**
   * Schedule a reminder or task
   */
  scheduleTask(description, delayMinutes, isRecurring = false) {
    const now = Date.now();
    const delayMs = Math.round(parseFloat(delayMinutes) * 60 * 1000);
    const targetTime = now + delayMs;

    const task = {
      id: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      description,
      createdAt: new Date().toISOString(),
      targetTime,
      targetTimeFormatted: new Date(targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      delayMinutes,
      isRecurring,
      status: 'pending'
    };

    this.tasks.push(task);
    this.save();
    this.scheduleExecution(task.id, delayMs);

    return {
      success: true,
      taskId: task.id,
      description,
      scheduledFor: task.targetTimeFormatted,
      summary: `Scheduled task: "${description}" for ${task.targetTimeFormatted}.`
    };
  }

  executeTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    this.timerHandles.delete(id);
    this.save();

    // Play reminder audio alert
    exec('powershell.exe -NoProfile -Command "[System.Media.SystemSounds]::Exclamation.Play()"');

    if (typeof this.notificationHandler === 'function') {
      this.notificationHandler(task);
    }
  }

  listScheduledTasks() {
    const pending = this.tasks.filter(t => t.status === 'pending');
    return {
      success: true,
      count: pending.length,
      tasks: pending,
      summary: pending.length === 0
        ? 'No scheduled tasks pending.'
        : `Scheduled tasks: ${pending.map(t => `"${t.description}" at ${t.targetTimeFormatted}`).join('; ')}`
    };
  }

  cancelTask(id) {
    const handle = this.timerHandles.get(id);
    if (handle) {
      clearTimeout(handle);
      this.timerHandles.delete(id);
    }

    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.status = 'cancelled';
      this.save();
      return { success: true, message: `Cancelled task: "${task.description}".` };
    }
    return { success: false, error: 'Task not found.' };
  }
}

module.exports = new SchedulerService();
