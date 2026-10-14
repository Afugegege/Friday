const memoryService = require('./memory-service');

class ActionEngine {
  constructor() {
    this.currentTask = null;
    this.statusListeners = new Set();
  }

  onStatus(fn) {
    this.statusListeners.add(fn);
  }

  notify(statusText) {
    for (const listener of this.statusListeners) {
      try {
        listener(statusText);
      } catch (e) {}
    }
  }

  /**
   * Initializes a multi-step mission with explicit tracking states
   */
  startMission(objective, steps = []) {
    this.currentTask = {
      id: `mission_${Date.now().toString(36)}`,
      objective,
      status: 'Planning', // Pending | Planning | Running | Waiting for approval | Completed | Failed | Cancelled
      steps: steps.map((s, idx) => ({
        index: idx + 1,
        title: s,
        status: 'pending',
        result: null,
        verified: false
      })),
      currentStepIndex: 1,
      startedAt: new Date().toISOString(),
      cancelled: false
    };

    memoryService.setActiveObjective(objective, steps);
    this.notify(`Mission initiated: ${objective}`);
    return this.currentTask;
  }

  updateStep(stepIndex, status, result = null, verified = false) {
    if (!this.currentTask) return;
    const step = this.currentTask.steps.find(s => s.index === stepIndex);
    if (step) {
      step.status = status;
      step.result = result;
      step.verified = verified;
      memoryService.updatePlanStep(stepIndex, status, result);
    }
  }

  advanceStep() {
    if (!this.currentTask) return;
    this.currentTask.currentStepIndex++;
    if (this.currentTask.currentStepIndex > this.currentTask.steps.length) {
      this.currentTask.status = 'Completed';
      this.currentTask.completedAt = new Date().toISOString();
      this.notify(`Mission completed: ${this.currentTask.objective}`);
    } else {
      this.currentTask.status = 'Running';
    }
  }

  failMission(reason) {
    if (!this.currentTask) return;
    this.currentTask.status = 'Failed';
    this.currentTask.error = reason;
    this.notify(`Mission failed: ${reason}`);
  }

  cancelMission() {
    if (!this.currentTask) return { success: false, error: 'No active mission.' };
    this.currentTask.status = 'Cancelled';
    this.currentTask.cancelled = true;
    memoryService.clearActiveObjective();
    this.notify('Mission cancelled by user.');
    return { success: true, message: 'Mission cancelled.' };
  }

  getCurrentState() {
    return this.currentTask;
  }
}

module.exports = new ActionEngine();
