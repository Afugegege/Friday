const https = require('https');
const http = require('http');
const { URL } = require('url');

class WebSearchService {
  /**
   * Performs an internet search using DuckDuckGo HTML / Instant Answer endpoints
   * @param {string} query Search terms
   * @param {number} maxResults Max number of results (default: 5)
   * @returns {Promise<Array<{title: string, link: string, snippet: string}>>}
   */
  async search(query, maxResults = 5) {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query must be a non-empty string');
    }

    try {
      // 1. First try DuckDuckGo Instant Answer API for quick facts/definitions
      const instantResults = await this._searchInstantAnswer(query);
      if (instantResults && instantResults.length > 0) {
        return instantResults.slice(0, maxResults);
      }

      // 2. Fall back to DuckDuckGo HTML search
      const htmlResults = await this._searchDuckDuckGoHtml(query);
      if (htmlResults && htmlResults.length > 0) {
        return htmlResults.slice(0, maxResults);
      }

      // 3. Fall back to Wikipedia Search API (great for history, science, concepts, definitions)
      const wikiResults = await this._searchWikipedia(query);
      if (wikiResults && wikiResults.length > 0) {
        return wikiResults.slice(0, maxResults);
      }

      return [{
        title: `Search for "${query}"`,
        link: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `No direct summary found. You can search directly online for "${query}".`
      }];
    } catch (err) {
      console.error('WebSearchService error:', err.message);
      return [{
        title: `Search error`,
        link: '',
        snippet: `Unable to complete web search: ${err.message}`
      }];
    }
  }

  async _searchInstantAnswer(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    try {
      const data = await this._fetchJson(url);
      const results = [];

      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          link: data.AbstractURL || '',
          snippet: data.AbstractText
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 40),
              link: topic.FirstURL,
              snippet: topic.Text
            });
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  async _searchDuckDuckGoHtml(query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const html = await this._fetchText(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7'
        }
      });

      const results = [];
      // Match result blocks: <a class="result__url" href="..."><h2 class="result__title">...
      // Or regex for result__snippet and result__title
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      const titleRegex = /<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<a[^>]*class="result__title"[^>]*>([\s\S]*?)<\/a>/g;

      // Alternative simpler regex for duckduckgo html
      const blockRegex = /<div class="result__body">([\s\S]*?)<\/div>/g;
      let match;
      while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
        const block = match[1];
        const titleMatch = /<a class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
        const snippetMatch = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

        let link = '';
        let title = '';
        if (titleMatch) {
          link = titleMatch[1] || titleMatch[3] || '';
          title = this._cleanHtml(titleMatch[2] || titleMatch[4] || '');
        }
        let snippet = snippetMatch ? this._cleanHtml(snippetMatch[1]) : '';

        // Decode uddg redirect URL if present
        if (link.includes('uddg=')) {
          const m = link.match(/uddg=([^&]+)/);
          if (m) link = decodeURIComponent(m[1]);
        }

        if (title || snippet) {
          results.push({
            title: title || query,
            link: link.startsWith('//') ? 'https:' + link : link,
            snippet: snippet || title
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  async _searchWikipedia(query) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    try {
      const data = await this._fetchJson(url);
      if (data && data.query && data.query.search) {
        return data.query.search.map(item => ({
          title: item.title,
          link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          snippet: this._cleanHtml(item.snippet)
        }));
      }
    } catch {
      return [];
    }
    return [];
  }

  /**
   * Fetches text content from a web page URL and strips tags
   */
  async fetchPageContent(pageUrl, maxLength = 3000) {
    try {
      const html = await this._fetchText(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const clean = this._cleanHtml(html);
      return clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean;
    } catch (e) {
      return `Failed to fetch page: ${e.message}`;
    }
  }

  _cleanHtml(html) {
    if (!html) return '';
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  _fetchText(targetUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(targetUrl, options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(this._fetchText(res.headers.location, options));
        }
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    });
  }

  _fetchJson(targetUrl) {
    return this._fetchText(targetUrl, {
      headers: { 'Accept': 'application/json' }
    }).then(text => JSON.parse(text));
  }
}

module.exports = new WebSearchService();
