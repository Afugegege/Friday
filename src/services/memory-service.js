const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class MemoryService {
  constructor() {
    this.memoryFilePath = path.join(config.appDataDir, 'memory.json');
    this.data = {
      // 1. Working Memory (active tasks, intermediate state)
      workingMemory: {
        activeObjective: null,
        activePlan: [],
        taskVariables: {},
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
          workingMemory: { ...this.data.workingMemory, ...(parsed.workingMemory || {}) },
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

  // ─── WORKING MEMORY ───────────────────────────────────────────────────────
  setActiveObjective(objective, steps = []) {
    this.data.workingMemory.activeObjective = objective;
    this.data.workingMemory.activePlan = steps.map((s, idx) => ({
      index: idx + 1,
      description: s,
      status: 'pending'
    }));
    this.data.workingMemory.startedAt = new Date().toISOString();
    this.save();
    return this.data.workingMemory;
  }

  getActiveObjective() {
    return this.data.workingMemory.activeObjective ? this.data.workingMemory : null;
  }

  updatePlanStep(stepIndex, status, result = null) {
    if (!this.data.workingMemory.activePlan) return;
    const step = this.data.workingMemory.activePlan.find(s => s.index === stepIndex);
    if (step) {
      step.status = status;
      if (result) step.result = result;
      this.save();
    }
  }

  clearActiveObjective() {
    this.data.workingMemory.activeObjective = null;
    this.data.workingMemory.activePlan = [];
    this.data.workingMemory.taskVariables = {};
    this.save();
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

  // ─── CONVERSATION ROLLING MEMORY ──────────────────────────────────────────
  addConversationTurn(role, text) {
    this.data.conversationHistory.push({
      role,
      content: text,
      timestamp: new Date().toISOString()
    });
    // Rolling capped window (last 40 turns)
    if (this.data.conversationHistory.length > 40) {
      this.data.conversationHistory = this.data.conversationHistory.slice(-40);
    }
    this.save();
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
