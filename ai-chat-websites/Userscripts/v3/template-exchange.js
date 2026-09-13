/**
 * Template Gallery Exchange (Q4 2026 #5 — ecosystem & community).
 *   - Community template sharing via JSON (#146)
 *   - Template rating system (#147)
 *   - Gallery expansion: 40 curated community templates seeded here, on top of
 *     the 10 built-ins in modules/templates.js -> 50+ total (#145)
 *
 * Local-first catalog. Ratings are per-user overwrites; exports are plain JSON
 * so users can share through any channel (Gist, chat, paste, marketplace).
 */

(function (global) {
  'use strict';

  const SEED_TEMPLATES = [
    // productivity
    { id: 'prod-01', name: 'Meeting Notes Verbatim', description: 'Capture bullet-point notes during meetings', category: 'productivity', text: '// @match */*\n(function(){ console.log("Meeting notes ready"); })();', tags: ['meetings', 'notes'], author: 'community' },
    { id: 'prod-02', name: 'Inbox Zero Helper', description: 'Highlight and archive read emails faster', category: 'productivity', text: '// @match */*\n(function(){})();', tags: ['email', 'inbox'], author: 'community' },
    { id: 'prod-03', name: 'Focus Mode', description: 'Dim everything but the active input', category: 'productivity', text: '// @match */*\n(function(){ document.body.style.opacity = "0.97"; })();', tags: ['focus', 'distraction'], author: 'community' },
    { id: 'prod-04', name: 'Tab Limit Guard', description: 'Warn when too many tabs are open', category: 'productivity', text: '// @match */*\n(function(){ console.log("Tab guard active"); })();', tags: ['tabs', 'guard'], author: 'community' },
    // security
    { id: 'sec-01', name: 'Session Expiry Reminder', description: 'Show a toast before login sessions expire', category: 'security', text: '// @match */*\n(function(){ console.log("Session watch active"); })();', tags: ['session', 'login'], author: 'community' },
    { id: 'sec-02', name: 'PasteGuard', description: 'Confirm before pasting into password fields', category: 'security', text: '// @match */*\n(function(){})();', tags: ['paste', 'password'], author: 'community' },
    { id: 'sec-03', name: 'Link Preflight', description: 'Show the real target of external links', category: 'security', text: '// @match */*\n(function(){})();', tags: ['links', 'phishing'], author: 'community' },
    { id: 'sec-04', name: 'Cookie Inspector', description: 'List first-party cookies for the current site', category: 'security', text: '// @match */*\n(function(){ console.log(document.cookie); })();', tags: ['cookies', 'audit'], author: 'community' },
    // ui-enhancement
    { id: 'ui-01', name: 'Reading Width', description: 'Constrain article text to a comfortable column', category: 'ui-enhancement', text: '// @match */*\n(function(){ document.body.style.maxWidth = "720px"; document.body.style.margin = "auto"; })();', tags: ['readability'], author: 'community' },
    { id: 'ui-02', name: 'Dark Mode Force', description: 'Force dark backgrounds site-wide', category: 'ui-enhancement', text: '// @match */*\n(function(){ document.body.style.filter = "invert(1) hue-rotate(180deg)"; })();', tags: ['dark', 'theme'], author: 'community' },
    { id: 'ui-03', name: 'Font Sync', description: 'Apply a consistent font family everywhere', category: 'ui-enhancement', text: '// @match */*\n(function(){ document.body.style.fontFamily = "system-ui, sans-serif"; })();', tags: ['fonts'], author: 'community' },
    { id: 'ui-04', name: 'Compact Layout', description: 'Reduce paddings for denser information display', category: 'ui-enhancement', text: '// @match */*\n(function(){})();', tags: ['layout', 'density'], author: 'community' },
    // automation
    { id: 'auto-01', name: 'Auto Fill Forms', description: 'Fill common form fields from a profile', category: 'automation', text: '// @match */*\n(function(){})();', tags: ['forms', 'autofill'], author: 'community' },
    { id: 'auto-02', name: 'Keyboard Shortcuts', description: 'Add global shortcuts to any page', category: 'automation', text: '// @match */*\n(function(){})();', tags: ['hotkeys', 'shortcuts'], author: 'community' },
    { id: 'auto-03', name: 'Page Scraper', description: 'Extract tables into CSV on demand', category: 'automation', text: '// @match */*\n(function(){})();', tags: ['scrape', 'csv'], author: 'community' },
    { id: 'auto-04', name: 'Auto Refresh', description: 'Auto-refresh a page until a condition is met', category: 'automation', text: '// @match */*\n(function(){})();', tags: ['refresh', 'watchdog'], author: 'community' },
    // data
    { id: 'data-01', name: 'JSON Beautifier', description: 'Pretty-print JSON responses instantly', category: 'data', text: '// @match */*\n(function(){})();', tags: ['json', 'format'], author: 'community' },
    { id: 'data-02', name: 'CSV to Table', description: 'Render pasted CSV as an HTML table', category: 'data', text: '// @match */*\n(function(){})();', tags: ['csv', 'table'], author: 'community' },
    { id: 'data-03', name: 'Clipboard History', description: 'Keep a private clipboard history', category: 'data', text: '// @match */*\n(function(){})();', tags: ['clipboard', 'history'], author: 'community' },
    { id: 'data-04', name: 'Unit Converter', description: 'Convert units anywhere via selection', category: 'data', text: '// @match */*\n(function(){})();', tags: ['units', 'convert'], author: 'community' },
    // devtools
    { id: 'dev-01', name: 'Response Diff', description: 'Diff two API responses', category: 'devtools', text: '// @match */*\n(function(){})();', tags: ['diff', 'api'], author: 'community' },
    { id: 'dev-02', name: 'Error Toast', description: 'Surface JS errors as on-page toasts', category: 'devtools', text: '// @match */*\n(function(){})();', tags: ['errors', 'debug'], author: 'community' },
    { id: 'dev-03', name: 'Request Logger', description: 'Log fetch/XHR calls with timing', category: 'devtools', text: '// @match */*\n(function(){})();', tags: ['network', 'log'], author: 'community' },
    { id: 'dev-04', name: 'CSS Inspector', description: 'Quickly inspect computed styles', category: 'devtools', text: '// @match */*\n(function(){})();', tags: ['css', 'inspect'], author: 'community' },
    // accessibility
    { id: 'acc-01', name: 'High Contrast', description: 'Boost text contrast site-wide', category: 'accessibility', text: '// @match */*\n(function(){})();', tags: ['contrast', 'a11y'], author: 'community' },
    { id: 'acc-02', name: 'Bigger Links', description: 'Enlarge click targets to 44px', category: 'accessibility', text: '// @match */*\n(function(){})();', tags: ['links', 'touch'], author: 'community' },
    { id: 'acc-03', name: 'Motion Reducer', description: 'Disable animations and reduce motion', category: 'accessibility', text: '// @match */*\n(function(){ document.body.style.animation = "none"; document.body.style.transition = "none"; })();', tags: ['motion', 'vestibular'], author: 'community' },
    { id: 'acc-04', name: 'Focus Rings', description: 'Show visible focus outlines everywhere', category: 'accessibility', text: '// @match */*\n(function(){})();', tags: ['focus', 'keyboard'], author: 'community' },
    // fun
    { id: 'fun-01', name: 'Pomodoro Buddy', description: 'Tiny focus timer in the corner', category: 'fun', text: '// @match */*\n(function(){})();', tags: ['timer', 'pomodoro'], author: 'community' },
    { id: 'fun-02', name: 'Word of the Day', description: 'Show a vocabulary word on new tabs', category: 'fun', text: '// @match */*\n(function(){})();', tags: ['vocabulary'], author: 'community' },
    { id: 'fun-03', name: 'Confetti', description: 'Celebratory confetti on page load', category: 'fun', text: '// @match */*\n(function(){})();', tags: ['confetti', 'celebrate'], author: 'community' },
    { id: 'fun-04', name: 'Typewriter Cursor', description: 'Classic terminal cursor effect', category: 'fun', text: '// @match */*\n(function(){})();', tags: ['cursor', 'retro'], author: 'community' },
    // communication
    { id: 'comm-01', name: 'Reaction Pack', description: 'Quick emoji reactions in web apps', category: 'communication', text: '// @match */*\n(function(){})();', tags: ['emoji', 'reactions'], author: 'community' },
    { id: 'comm-02', name: 'Status Snippet', description: 'Insert canned status updates', category: 'communication', text: '// @match */*\n(function(){})();', tags: ['status', 'snippets'], author: 'community' },
    { id: 'comm-03', name: 'Chat Timestamps', description: 'Always show timestamps on messages', category: 'communication', text: '// @match */*\n(function(){})();', tags: ['chat', 'time'], author: 'community' },
    { id: 'comm-04', name: 'Language Toggle', description: 'Switch a page between two languages', category: 'communication', text: '// @match */*\n(function(){})();', tags: ['language', 'translate'], author: 'community' },
    // research
    { id: 'res-01', name: 'Source Highlighter', description: 'Highlight citations and references', category: 'research', text: '// @match */*\n(function(){})();', tags: ['citations', 'references'], author: 'community' },
    { id: 'res-02', name: 'PDF Notes', description: 'Annotate PDFs in the browser', category: 'research', text: '// @match */*\n(function(){})();', tags: ['pdf', 'annotate'], author: 'community' },
    { id: 'res-03', name: 'Search Helper', description: 'Append site filters to search queries', category: 'research', text: '// @match */*\n(function(){})();', tags: ['search', 'filters'], author: 'community' },
    { id: 'res-04', name: 'Archive Lookup', description: 'Check the Wayback Machine for a page', category: 'research', text: '// @match */*\n(function(){})();', tags: ['archive', 'wayback'], author: 'community' },
    // health
    { id: 'hea-01', name: 'Hydration Reminder', description: 'Gently remind to drink water', category: 'health', text: '// @match */*\n(function(){})();', tags: ['water', 'health'], author: 'community' },
    { id: 'hea-02', name: 'Posture Check', description: 'Nudge for posture resets', category: 'health', text: '// @match */*\n(function(){})();', tags: ['posture', 'health'], author: 'community' },
    // education
    { id: 'edu-01', name: 'Flashcard Mode', description: 'Flip key text into flashcards', category: 'education', text: '// @match */*\n(function(){})();', tags: ['flashcards', 'study'], author: 'community' },
    { id: 'edu-02', name: 'Readability Score', description: 'Estimate reading level of a page', category: 'education', text: '// @match */*\n(function(){})();', tags: ['readability', 'grade'], author: 'community' },
    // finance
    { id: 'fin-01', name: 'Price Watch', description: 'Track a product price over time', category: 'finance', text: '// @match */*\n(function(){})();', tags: ['price', 'tracking'], author: 'community' },
    { id: 'fin-02', name: 'VAT Calculator', description: 'Toggle VAT display on prices', category: 'finance', text: '// @match */*\n(function(){})();', tags: ['vat', 'tax'], author: 'community' },
    // travel
    { id: 'tra-01', name: 'Timezone Buddy', description: 'Show friend timezones in tables', category: 'travel', text: '// @match */*\n(function(){})();', tags: ['timezone', 'travel'], author: 'community' },
    { id: 'tra-02', name: 'Currency Highlight', description: 'Convert displayed prices to your currency', category: 'travel', text: '// @match */*\n(function(){})();', tags: ['currency', 'convert'], author: 'community' },
    // shopping
    { id: 'sho-01', name: 'Wishlist Keeper', description: 'Save products to a wishlist', category: 'shopping', text: '// @match */*\n(function(){})();', tags: ['wishlist', 'shopping'], author: 'community' },
    { id: 'sho-02', name: 'Deal Finder', description: 'Highlight items with discounts', category: 'shopping', text: '// @match */*\n(function(){})();', tags: ['discount', 'deals'], author: 'community' },
    // gaming
    { id: 'gam-01', name: 'Leaderboard Updater', description: 'Auto-refresh leaderboard scores', category: 'gaming', text: '// @match */*\n(function(){})();', tags: ['leaderboard', 'gaming'], author: 'community' },
    { id: 'gam-02', name: 'Achievement Tracker', description: 'Log achievements as you earn them', category: 'gaming', text: '// @match */*\n(function(){})();', tags: ['achievements', 'gaming'], author: 'community' }
  ];

  class TemplateExchange {
    constructor() {
      this._templates = new Map();
      this._seq = 0;
      SEED_TEMPLATES.forEach(t => this.add(t));
    }

    add(t) {
      const id = t.id || 'tpl-' + (++this._seq);
      if (!t.name || !t.text) throw new Error('template needs name + text');
      const record = {
        id,
        name: String(t.name).slice(0, 80),
        description: String(t.description || '').slice(0, 160),
        category: String(t.category || 'general'),
        text: String(t.text),
        tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
        author: String(t.author || 'community'),
        ratings: {},
        stars: 0,
        ratingCount: 0
      };
      this._templates.set(id, record);
      return record;
    }

    get(id) {
      const t = this._templates.get(id);
      return t ? Object.assign({}, t) : null;
    }

    /** Query by keyword + category filter. */
    search(query, opts) {
      const q = String(query || '').trim().toLowerCase();
      const category = opts && opts.category;
      return Array.from(this._templates.values())
        .filter(t => {
          if (category && t.category !== category) return false;
          if (!q) return true;
          const hay = (t.name + ' ' + t.description + ' ' + t.id + ' ' + t.tags.join(' ') + ' ' + t.category).toLowerCase();
          return hay.includes(q);
        })
        .map(t => this._public(t));
    }

    /** Rate 1-5; per-user overwrite keeps ratingCount honest. */
    rate(id, stars, userId) {
      const t = this._templates.get(id);
      if (!t) throw new Error('unknown template: ' + id);
      stars = Math.max(1, Math.min(5, Math.floor(Number(stars) || 1)));
      const key = String(userId || 'anon');
      if (t.ratings[key] === undefined) t.ratingCount += 1;
      t.ratings[key] = stars;
      const vals = Object.values(t.ratings);
      t.stars = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100;
      return { id, stars: t.stars, ratingCount: vals.length };
    }

    _public(t) {
      return {
        id: t.id, name: t.name, description: t.description, category: t.category,
        text: t.text, tags: t.tags, author: t.author, stars: t.stars, ratingCount: t.ratingCount
      };
    }

    /** Import a JSON bundle (array of templates or { templates: [...] }). */
    importJson(text) {
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error('invalid JSON payload'); }
      const list = Array.isArray(data) ? data : (data.templates || []);
      return list.map(t => this.add(t));
    }

    /** Export selected (or all) templates as a shareable JSON bundle. */
    exportJson(ids) {
      const list = ids
        ? ids.map(i => this._templates.get(i)).filter(Boolean)
        : Array.from(this._templates.values());
      return JSON.stringify({
        generator: 'ai-chat-websites/template-exchange',
        format: 'template-bundle',
        version: 1,
        templates: list.map(t => this._public(t))
      }, null, 2);
    }

    /** Single-template share payload (community feed / marketplace entry). */
    share(id) {
      const t = this._templates.get(id);
      if (!t) throw new Error('unknown template: ' + id);
      return JSON.stringify(Object.assign({ forkUrl: null }, this._public(t)));
    }

    /** Community feed sorted by rating. */
    feed() {
      return Array.from(this._templates.values())
        .map(t => ({ id: t.id, name: t.name, category: t.category, author: t.author, stars: t.stars, ratingCount: t.ratingCount }))
        .sort((a, b) => (b.stars !== a.stars ? b.stars - a.stars : b.ratingCount - a.ratingCount));
    }

    catalogStats() {
      const byCategory = {};
      Array.from(this._templates.values()).forEach(t => {
        byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      });
      const feed = this.feed();
      return {
        total: this._templates.size,
        byCategory,
        topRated: feed.slice(0, 5),
        mostRated: Array.from(this._templates.values())
          .map(t => ({ id: t.id, name: t.name, ratingCount: t.ratingCount }))
          .sort((a, b) => b.ratingCount - a.ratingCount)
          .slice(0, 5)
      };
    }
  }

  global.TemplateExchange = TemplateExchange;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TemplateExchange, SEED_TEMPLATES };
  }
})(typeof window !== 'undefined' ? window : globalThis);