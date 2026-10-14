const memoryService = require('./memory-service');

/**
 * ActionEngine: Autonomous Task Planner & Multi-Step Execution Lifecycle Engine
 *
 * Lifecycle States:
 *   PENDING
 *   PLANNING
 *   AWAITING_INFORMATION
 *   AWAITING_APPROVAL
 *   RUNNING
 *   VERIFYING
 *   COMPLETED
 *   FAILED
 *   CANCELLED
 */
class ActionEngine {
  constructor() {
    this.statusListeners = new Set();
    this.activeAbortController = null;
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

  getAbortSignal() {
    if (!this.activeAbortController) {
      this.activeAbortController = new AbortController();
    }
    return this.activeAbortController.signal;
  }

  isCancelled() {
    return this.activeAbortController ? this.activeAbortController.signal.aborted : false;
  }

  /**
   * Initializes a new multi-step task with full lifecycle tracking
   */
  createTask(objective, domain = 'general', initialContext = {}, steps = []) {
    // Reset abort controller for new task
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();

    const formattedSteps = steps.map((s, idx) => ({
      index: idx + 1,
      title: typeof s === 'string' ? s : s.title,
      description: typeof s === 'string' ? s : (s.description || s.title),
      tool: s.tool || null,
      args: s.args || {},
      status: 'PENDING', // PENDING | RUNNING | VERIFYING | COMPLETED | FAILED | SKIPPED
      result: null,
      verified: false
    }));

    const task = memoryService.startActiveTask(objective, domain, initialContext);
    task.steps = formattedSteps;
    task.currentStepIndex = formattedSteps.length > 0 ? 1 : 0;
    task.status = formattedSteps.length > 0 ? 'PLANNING' : 'AWAITING_INFORMATION';
    memoryService.updateActiveTask(task);

    this.notify(`Initiated task: ${objective}`);
    return task;
  }

  /**
   * Analyzes an incoming user goal to determine if it requires progressive planning
   */
  assessComplexGoal(userText) {
    const text = userText.trim();
    const lower = text.toLowerCase();

    // 1. Travel Planning Intent (e.g. "plan me a trip to Greece", "travel to Japan")
    const travelMatch = lower.match(/(?:plan(?:\s+me)?\s+a\s+trip\s+to|travel\s+to|vacation\s+in|visit|trip\s+to|holiday\s+in)\s+([a-zA-Z\s]+)/i);
    if (travelMatch) {
      const destination = travelMatch[1].replace(/(?:for\s+me|please|with\s+my\s+friends).*$/i, '').trim();
      return {
        isComplex: true,
        domain: 'travel',
        objective: `Plan trip to ${destination}`,
        initialContext: {
          destination,
          departureCity: null,
          dates: null,
          durationDays: null,
          budget: null,
          preferredPlatform: null,
          interests: []
        },
        missingKeys: ['departureCity', 'durationDays', 'preferredPlatform']
      };
    }

    // 2. Research & Documentation Intent (e.g. "research cybersecurity internships in Ireland and save")
    const researchMatch = lower.match(/(?:research|find|investigate|compare)\s+(.+?)\s+and\s+(?:save|prepare|write)/i);
    if (researchMatch) {
      const topic = researchMatch[1].trim();
      return {
        isComplex: true,
        domain: 'research',
        objective: `Research ${topic} and save synthesis`,
        initialContext: {
          topic,
          sources: [],
          keyPoints: []
        },
        missingKeys: []
      };
    }

    // 3. Coding & Diagnostics Intent (e.g. "explain this error and fix it")
    if (lower.includes('explain this error') || lower.includes('diagnose project') || lower.includes('fix the build')) {
      return {
        isComplex: true,
        domain: 'code',
        objective: 'Diagnose and fix project issue',
        initialContext: {
          errorSnippet: null,
          targetFile: null
        },
        missingKeys: []
      };
    }

    return { isComplex: false };
  }

  /**
   * Progressively handles follow-up answers for an active task
   */
  processTaskFollowUp(userText, task) {
    const lower = userText.toLowerCase();
    const ctx = task.context || {};

    if (task.domain === 'travel') {
      // Detect platform preferences
      if (lower.includes('google flight') || lower.includes('flights')) ctx.preferredPlatform = 'google_flights';
      else if (lower.includes('skyscanner')) ctx.preferredPlatform = 'skyscanner';
      else if (lower.includes('booking')) ctx.preferredPlatform = 'booking';
      else if (lower.includes('airbnb')) ctx.preferredPlatform = 'airbnb';
      else if (lower.includes('notes') || lower.includes('itinerary')) ctx.preferredPlatform = 'notes';

      // Detect duration (e.g. "7 days", "2 weeks", "a week", "10 days")
      const durMatch = lower.match(/(\d+)\s*(?:days?|weeks?)/i) || (lower.includes('a week') ? ['a week', '7'] : null);
      if (durMatch) {
        ctx.durationDays = durMatch[0].includes('week') ? parseInt(durMatch[1] || '1', 10) * 7 : parseInt(durMatch[1], 10);
      }

      // Detect departure (e.g. "from London", "departing Singapore", "from JFK")
      const depMatch = lower.match(/(?:from|departing(?:\s+from)?|out of)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
      if (depMatch) {
        let rawCity = depMatch[1].trim();
        rawCity = rawCity.replace(/\s+(?:for|in|on|with|and|during|to).*$/i, '').trim();
        ctx.departureCity = rawCity.charAt(0).toUpperCase() + rawCity.slice(1);
      }

      // Detect budget (e.g. "cheap", "luxury", "moderate", "$2000", "budget")
      if (lower.includes('cheap') || lower.includes('budget') || lower.includes('affordable')) ctx.budget = 'budget';
      else if (lower.includes('luxury') || lower.includes('high end')) ctx.budget = 'luxury';
      else if (lower.includes('moderate') || lower.includes('mid-range')) ctx.budget = 'moderate';
      const amountMatch = lower.match(/(\$|€|£|usd|eur|gbp)?\s*(\d{3,5})/i);
      if (amountMatch) ctx.budgetAmount = amountMatch[2];

      memoryService.updateActiveTask({ context: ctx });

      // Determine next progressive question
      if (!ctx.departureCity) {
        memoryService.updateActiveTask({ status: 'AWAITING_INFORMATION' });
        return {
          requiresAnswer: true,
          question: `Understood. Where will you be departing from for ${ctx.destination}?`
        };
      }

      if (!ctx.durationDays) {
        memoryService.updateActiveTask({ status: 'AWAITING_INFORMATION' });
        return {
          requiresAnswer: true,
          question: `How many days do you plan to spend in ${ctx.destination}, and do you have a target month?`
        };
      }

      if (!ctx.preferredPlatform) {
        memoryService.updateActiveTask({ status: 'AWAITING_INFORMATION' });
        return {
          requiresAnswer: true,
          question: `I have the essentials: ${ctx.durationDays} days in ${ctx.destination} departing from ${ctx.departureCity}. Which platform would you prefer to search with: Google Flights, Skyscanner, Booking.com, or Airbnb?`
        };
      }

      // All key information collected! Build structured plan
      const planSteps = [
        { index: 1, title: `Research top highlights in ${ctx.destination}`, tool: 'web_search', args: { query: `best places to visit in ${ctx.destination}` }, status: 'PENDING' },
        { index: 2, title: `Search flight options from ${ctx.departureCity} to ${ctx.destination}`, tool: 'travel_search', args: { destination: ctx.destination, origin: ctx.departureCity, service: ctx.preferredPlatform }, status: 'PENDING' },
        { index: 3, title: `Find accommodations in ${ctx.destination}`, tool: 'travel_search', args: { destination: ctx.destination, service: 'booking' }, status: 'PENDING' },
        { index: 4, title: `Compile ${ctx.durationDays}-day structured itinerary`, tool: 'save_note', args: { title: `${ctx.destination} Travel Itinerary` }, status: 'PENDING' }
      ];

      memoryService.updateActiveTask({
        status: 'RUNNING',
        steps: planSteps,
        currentStepIndex: 1
      });

      return {
        readyToExecute: true,
        planSteps,
        confirmation: `Excellent. Initiating structured travel research for ${ctx.destination} departing from ${ctx.departureCity} via ${ctx.preferredPlatform.replace('_', ' ')}.`
      };
    }

    return { readyToExecute: true };
  }

  /**
   * Updates status of a specific step
   */
  updateStep(stepIndex, status, result = null, verified = false) {
    const task = memoryService.getActiveTask();
    if (!task || !task.steps) return;

    const step = task.steps.find(s => s.index === stepIndex);
    if (step) {
      step.status = status;
      step.result = result;
      step.verified = verified;
      memoryService.updateActiveTask(task);
      this.notify(`Step ${stepIndex} (${step.title}): ${status}`);
    }
  }

  /**
   * Advances task to next step or completes it
   */
  advanceStep() {
    const task = memoryService.getActiveTask();
    if (!task || !task.steps) return null;

    task.currentStepIndex++;
    if (task.currentStepIndex > task.steps.length) {
      task.status = 'COMPLETED';
      task.completedAt = new Date().toISOString();
      memoryService.updateActiveTask(task);
      this.notify(`Task completed: ${task.objective}`);
    } else {
      task.status = 'RUNNING';
      memoryService.updateActiveTask(task);
    }
    return task;
  }

  failTask(reason) {
    const task = memoryService.getActiveTask();
    if (!task) return;
    task.status = 'FAILED';
    task.error = reason;
    memoryService.updateActiveTask(task);
    this.notify(`Task failed: ${reason}`);
  }

  cancelTask(reason = 'User requested cancellation.') {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    const res = memoryService.cancelActiveTask(reason);
    this.notify('Task cancelled.');
    return res;
  }

  getActiveTask() {
    return memoryService.getActiveTask();
  }

  // Legacy compatibility
  startMission(objective, steps = []) {
    return this.createTask(objective, 'general', {}, steps);
  }

  failMission(reason) {
    return this.failTask(reason);
  }

  cancelMission() {
    return this.cancelTask();
  }

  getCurrentState() {
    return memoryService.getActiveTask();
  }
}

module.exports = new ActionEngine();
