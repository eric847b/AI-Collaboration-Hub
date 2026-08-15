// ==UserScript==
// @name         Free-AI Seamless Rotator
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Never-ending free AI: rotates across a pool of free endpoints on 429/5xx/exhaustion so work never pauses.
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.groq.com
// ==/UserScript==

(function () {
  'use strict';
  const NS = 'freeai_rot_';

  // ---- Provider pool (free tiers). Keys per provider in GM storage, never hardcoded. ----
  function providers() {
    return [
      {
        name: 'groq-free',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        headers: () => ({ Authorization: 'Bearer ' + (GM_getValue(NS + 'groq', '') || '') }),
        body: (text) => ({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: text }], temperature: 0.7 }),
        extract: (o) => o.choices && o.choices[0] && o.choices[0].message.content || '',
      },
      // Add more free endpoints with the same shape below.
    ];
  }

  // ---- Transport: GM_xmlhttpRequest → {status, json} ----
  function gmRequest(url, { method, headers, body }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: body,
        onload: (res) => { try { resolve({ status: res.status, json: JSON.parse(res.responseText) }); } catch { resolve({ status: res.status, json: {} }); } },
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error('timeout')),
        timeout: 20000,
      });
    });
  }

  // ---- Core rotator (seamless failover, no pause) ----
  const rotator = {
    failCooldowns: new Map(),
    tally: { calls: 0, failures: 0, rotations: 0 },
    idx: 0,
    cooldownMs: 60000,
    markFailed(p) { this.failCooldowns.set(p.name, Date.now() + this.cooldownMs); this.tally.failures++; this.tally.rotations++; },
    next() {
      const pool = providers();
      for (let i = 0; i < pool.length; i++) {
        const p = pool[this.idx++ % pool.length];
        if (Date.now() < (this.failCooldowns.get(p.name) || 0)) continue;
        return p;
      }
      return null;
    },
    async complete(text) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const p = this.next();
        if (!p) { await new Promise((r) => setTimeout(r, 500)); continue; } // minimal wait, then retry
        this.tally.calls++;
        try {
          const res = await gmRequest(p.endpoint, { method: 'POST', headers: p.headers(), body: JSON.stringify(p.body(text)) });
          if (res.status >= 200 && res.status < 300) {
            const out = p.extract(res.json);
            if (out) return { text: out, provider: p.name, tally: { ...this.tally } };
          }
          this.markFailed(p);
        } catch (e) { this.markFailed(p); }
      }
      throw new Error('All free AI providers exhausted this round');
    },
  };

  // ---- Menu: set key, run prompt ----
  function runPrompt() {
    const p = prompt('Prompt (TypeScript. Empty = default):', 'State what you are, in one line.');
    if (p === null) return;
    rotator.complete(p)
      .then((r) => { GM_setValue(NS + 'last', r.provider + ': ' + r.text); alert('[' + r.provider + '] ' + r.text); })
      .catch((e) => alert('✗ ' + e.message));
  }

  GM_registerMenuCommand('⚙ Set Groq Free API Key', () => { const k = prompt('Groq API key:', GM_getValue(NS + 'groq', '')); if (k) GM_setValue(NS + 'groq', k); });
  GM_registerMenuCommand('🤖 Run prompt (seamless rotation)', runPrompt);

  console.log('[FreeAI Rotator] ready. Use the userscript menu (⚙ / 🤖).');
})();