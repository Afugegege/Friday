const webSearchService = require('./web-search-service');
const memoryService = require('./memory-service');
const fileManagerService = require('./file-manager-service');
const fs = require('fs');
const path = require('path');

class ResearchService {
  /**
   * Conducts structured web research, aggregates source pages, and organizes citations
   */
  async conductResearch(topic, searchCount = 4) {
    if (!topic) return { success: false, error: 'No research topic provided.' };

    try {
      const searchResults = await webSearchService.search(topic, searchCount);
      if (!searchResults || searchResults.length === 0) {
        return {
          success: false,
          topic,
          error: `No search results found for "${topic}".`
        };
      }

      const sources = [];
      for (const res of searchResults) {
        sources.push({
          title: res.title,
          url: res.link,
          snippet: res.snippet
        });
      }

      return {
        success: true,
        topic,
        sourcesFound: sources.length,
        sources,
        summary: `Retrieved ${sources.length} sources for "${topic}". Ready to synthesize summary and key concepts.`
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Saves synthesized research notes to disk and knowledge memory
   */
  async saveResearchNotes(topic, markdownContent, targetFolder = 'documents', category = 'research') {
    const safeTopic = topic.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);
    const filename = `${safeTopic}_notes.md`;
    const resolvedDir = fileManagerService.resolveSpecialPath(targetFolder);

    try {
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }

      const filePath = path.join(resolvedDir, filename);
      fs.writeFileSync(filePath, markdownContent, 'utf8');

      // Also persist in Knowledge Memory for instant voice retrieval
      memoryService.addNote(markdownContent, category, topic, [filePath]);

      return {
        success: true,
        topic,
        filePath,
        category,
        message: `Saved research notes on "${topic}" to "${filePath}" and stored in Knowledge Memory.`
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = new ResearchService();
