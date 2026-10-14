const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class MemoryService {
  constructor() {
    this.memoryFilePath = path.join(config.appDataDir, 'memory.json');
    this.data = {
      // 1. Working Memory (active tasks, intermediate state)
      workingMemory: {
        activeTask: null, // Scoped active task object
        pendingTasks: [], // Suspended or background tasks
        activeObjective: null, // Legacy compatibility
        activePlan: [],        // Legacy compatibility
        taskVariables: {},     // Legacy compatibility
        lastError: null
      },
      // 2. Persistent Preferences (language, approved folders, UI settings)
      preferences: {
        preferredLanguage: 'en',
        preferredVoice: 'alloy',
        approvedFolders: ['Documents', 'Desktop', 'Downloads'],
        frequentApps: []
      },
      // 3. Knowledge Memory (notes, research summaries, revision materials)
      knowledge: [],
      // Rolling conversation turns
      conversationHistory: []
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.memoryFilePath)) {
        const raw = fs.readFileSync(this.memoryFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          workingMemory: { 
            activeTask: null,
            pendingTasks: [],
            activeObjective: null,
            activePlan: [],
            taskVariables: {},
            lastError: null,
            ...(parsed.workingMemory || {}) 
          },
          preferences: { ...this.data.preferences, ...(parsed.preferences || {}) },
          knowledge: parsed.knowledge || parsed.notes || [],
          conversationHistory: parsed.conversationHistory || []
        };
      }
    } catch (e) {
      console.warn('MemoryService: failed to load memory, starting fresh:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.memoryFilePath, JSON.stringify(this.data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('MemoryService: failed to save memory:', e.message);
      return false;
    }
  }

  // ─── ACTIVE TASK & LIFECYCLE MANAGEMENT (PHASES 3, 4, 6) ───────────────────
  startActiveTask(objective, domain = 'general', initialContext = {}) {
    const taskId = `task_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const task = {
      id: taskId,
      objective,
      domain, // 'travel' | 'quiz' | 'code' | 'research' | 'system' | 'general'
      status: 'PLANNING', // PENDING | PLANNING | AWAITING_INFORMATION | AWAITING_APPROVAL | RUNNING | VERIFYING | COMPLETED | FAILED | CANCELLED
      context: { ...initialContext },
      missingInfo: [],
      steps: [],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null
    };

    // If an existing uncompleted task exists, archive it into pendingTasks
    if (this.data.workingMemory.activeTask && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(this.data.workingMemory.activeTask.status)) {
      this.data.workingMemory.pendingTasks.push(this.data.workingMemory.activeTask);
      if (this.data.workingMemory.pendingTasks.length > 5) {
        this.data.workingMemory.pendingTasks.shift();
      }
    }

    this.data.workingMemory.activeTask = task;
    // Keep legacy fields in sync
    this.data.workingMemory.activeObjective = objective;
    this.data.workingMemory.activePlan = [];
    this.data.workingMemory.taskVariables = { ...initialContext };

    this.save();
    return task;
  }

  getActiveTask() {
    return this.data.workingMemory.activeTask;
  }

  hasActiveTask() {
    const task = this.data.workingMemory.activeTask;
    return Boolean(task && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status));
  }

  updateActiveTask(updates = {}) {
    if (!this.data.workingMemory.activeTask) return null;
    const task = this.data.workingMemory.activeTask;

    if (updates.status) task.status = updates.status;
    if (updates.context) task.context = { ...task.context, ...updates.context };
    if (updates.missingInfo !== undefined) task.missingInfo = updates.missingInfo;
    if (updates.steps !== undefined) task.steps = updates.steps;
    if (updates.currentStepIndex !== undefined) task.currentStepIndex = updates.currentStepIndex;
    if (updates.error !== undefined) task.error = updates.error;
    task.updatedAt = new Date().toISOString();

    // Sync legacy
    if (updates.context) {
      this.data.workingMemory.taskVariables = { ...this.data.workingMemory.taskVariables, ...updates.context };
    }

    this.save();
    return task;
  }

  cancelActiveTask(reason = 'User cancelled task.') {
    if (!this.data.workingMemory.activeTask) {
      return { success: false, message: 'No active task to cancel.' };
    }
    const task = this.data.workingMemory.activeTask;
    task.status = 'CANCELLED';
    task.error = reason;
    task.updatedAt = new Date().toISOString();

    // Clear active objective so subsequent unrelated turns don't inherit it
    this.data.workingMemory.activeObjective = null;
    this.data.workingMemory.activePlan = [];
    this.save();
    return { success: true, message: `Task "${task.objective}" has been cancelled.` };
  }

  clearActiveTask() {
    this.data.workingMemory.activeTask = null;
    this.data.workingMemory.activeObjective = null;
    this.data.workingMemory.activePlan = [];
    this.data.workingMemory.taskVariables = {};
    this.save();
  }

  getPendingTasks() {
    return this.data.workingMemory.pendingTasks || [];
  }

  resumeTask(taskId) {
    const pending = this.data.workingMemory.pendingTasks || [];
    const index = pending.findIndex(t => t.id === taskId);
    if (index === -1) return null;

    // Put current active into pending if needed
    if (this.data.workingMemory.activeTask) {
      this.data.workingMemory.pendingTasks.push(this.data.workingMemory.activeTask);
    }

    const [resumed] = pending.splice(index, 1);
    resumed.status = resumed.status === 'CANCELLED' ? 'PLANNING' : resumed.status;
    resumed.updatedAt = new Date().toISOString();
    this.data.workingMemory.activeTask = resumed;
    this.save();
    return resumed;
  }

  // ─── LEGACY COMPATIBILITY ─────────────────────────────────────────────────
  setActiveObjective(objective, steps = []) {
    const plan = steps.map((s, idx) => ({
      index: idx + 1,
      description: s,
      status: 'pending'
    }));
    const task = this.startActiveTask(objective, 'general', {});
    task.steps = plan.map(s => ({
      index: s.index,
      title: s.description,
      status: 'PENDING'
    }));
    this.data.workingMemory.activeObjective = objective;
    this.data.workingMemory.activePlan = plan;
    this.data.workingMemory.activeTask = task;
    this.save();
    return this.data.workingMemory;
  }

  getActiveObjective() {
    if (this.data.workingMemory.activeObjective) {
      return {
        ...this.data.workingMemory,
        activePlan: this.data.workingMemory.activePlan || []
      };
    }
    return this.data.workingMemory.activeTask;
  }

  updatePlanStep(stepIndex, status, result = null) {
    if (!this.data.workingMemory.activeTask && !this.data.workingMemory.activePlan) return;
    const task = this.data.workingMemory.activeTask;
    if (task && task.steps) {
      const step = task.steps.find(s => s.index === stepIndex);
      if (step) {
        step.status = status;
        if (result) step.result = result;
      }
    }
    if (this.data.workingMemory.activePlan) {
      const step = this.data.workingMemory.activePlan.find(s => s.index === stepIndex);
      if (step) {
        step.status = status;
        if (result) step.result = result;
      }
    }
    this.save();
  }

  clearActiveObjective() {
    this.clearActiveTask();
  }

  // ─── PERSISTENT PREFERENCES ───────────────────────────────────────────────
  setPreference(key, value) {
    this.data.preferences[key] = value;
    this.save();
  }

  getPreference(key, defaultValue = null) {
    return this.data.preferences[key] !== undefined ? this.data.preferences[key] : defaultValue;
  }

  // ─── KNOWLEDGE MEMORY & STUDY REVISION ────────────────────────────────────
  addNote(content, category = 'general', title = '', sources = []) {
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: title || (content.length > 50 ? content.slice(0, 47) + '...' : content),
      content,
      category,
      sources,
      createdAt: new Date().toISOString()
    };
    this.data.knowledge.unshift(item);
    this.save();
    return item;
  }

  getNotes(filter = '') {
    if (!filter) return this.data.knowledge;
    return this.searchKnowledge(filter);
  }

  searchKnowledge(query, limit = 10) {
    if (!query) return this.data.knowledge.slice(0, limit);
    const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    const scored = this.data.knowledge.map(item => {
      let score = 0;
      const tLower = (item.title || '').toLowerCase();
      const cLower = (item.content || '').toLowerCase();
      const catLower = (item.category || '').toLowerCase();

      for (const token of qTokens) {
        if (tLower.includes(token)) score += 3;
        if (cLower.includes(token)) score += 1;
        if (catLower.includes(token)) score += 2;
      }
      return { item, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.item)
      .slice(0, limit);
  }

  deleteNote(id) {
    const initialLen = this.data.knowledge.length;
    this.data.knowledge = this.data.knowledge.filter(n => n.id !== id);
    if (this.data.knowledge.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // ─── CONVERSATION ROLLING MEMORY & CONTEXT ISOLATION ───────────────────────
  addConversationTurn(role, text, domain = 'general', taskId = null) {
    this.data.conversationHistory.push({
      role,
      content: text,
      domain, // 'travel' | 'quiz' | 'code' | 'general'
      taskId,
      timestamp: new Date().toISOString()
    });
    // Rolling capped window (last 40 turns)
    if (this.data.conversationHistory.length > 40) {
      this.data.conversationHistory = this.data.conversationHistory.slice(-40);
    }
    this.save();
  }

  /**
   * Retrieves conversation history filtered to prevent context contamination.
   * If currentDomain is provided, only includes turns from that domain and 'general' turns,
   * completely suppressing unrelated domain turns (e.g. omitting 'travel' when taking a 'quiz').
   */
  getFilteredConversation(currentDomain = 'general', limit = 6) {
    if (!currentDomain || currentDomain === 'all') {
      return this.data.conversationHistory.slice(-limit);
    }

    const filtered = this.data.conversationHistory.filter(turn => {
      // Include if it matches current domain, or is neutral general dialogue
      if (!turn.domain || turn.domain === 'general' || turn.domain === currentDomain) {
        return true;
      }
      return false;
    });

    return filtered.slice(-limit);
  }

  getRecentConversation(limit = 10) {
    return this.data.conversationHistory.slice(-limit);
  }

  clearHistory() {
    this.data.conversationHistory = [];
    this.save();
  }
}

module.exports = new MemoryService();
