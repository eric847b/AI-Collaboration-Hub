'use strict';
/**
 * Free-AI seamless rotator (transport-agnostic core)
 * -------------------------------------------------
 * Maintains a pool of AI endpoints (free tiers) and rotates through them
 * so that work never pauses: when a provider is rate-limited (429), errors,
 * or is exhausted, the next available provider is used immediately.
 *
 * Works in Node (inject `fetch`) and in Tampermonkey userscripts
 * (inject a GM_xmlhttpRequest wrapper). Reuse this one core everywhere.
 *
 * Example:
 *   const { FreeAIRotator } = require('./src/rotator');
 *   const rotator = new FreeAIRotator({ providers, request: myFetcher });
 *   const out = await rotator.complete('summarize this');
 */

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Default free-tier provider shapes. Keys should come from env/secure storage,
// never hardcoded. `free: true` marks endpoints that rotate (best-effort).
function defaultProviders() {
  return [
    {
      name: 'groq-free',
      free: true,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      headers: () => ({ Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}` }),
      body: (text, model) => ({
        model: model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: text }],
        temperature: 0.7,
      }),
      extract: (body) => body.choices?.[0]?.message?.content || '',
    },
    // Add more free endpoints below (same shape) — the rotator will round-robin
    // and fail over between all of them seamlessly.
  ];
}

class FreeAIRotator {
  /**
   * @param {Object} opts
   * @param {Array}  opts.providers          [{name, free, endpoint, headers, body, extract}]
   * @param {Function} opts.request          (url, {method, headers, body}) => Promise<{status, json, text}>
   * @param {number} opts.collectionPeriodMs cooldown after a provider fails (default 60s)
   * @param {number} opts.maxAttempts        max attempts before throwing (default 3 * providers count)
   */
  constructor({ providers = defaultProviders(), request, collectionPeriodMs = 60000, maxAttempts } = {}) {
    if (typeof request !== 'function') {
      throw new Error('FreeAIRotator requires `request` (url, opts) => Promise<response>');
    }
    this.providers = providers || [];
    this.request = request;
    this.collectionPeriodMs = collectionPeriodMs;
    this.maxAttempts = maxAttempts || Math.max(2, this.providers.length * 1);
    this.failCooldowns = new Map(); // provider name -> cooldown expiry
    this.tally = { calls: 0, failures: 0, rotations: 0 };
    this.idx = 0;
  }

  // Round-robin next provider that is not cooling down (skip without waste).
  _next() {
    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[(this.idx++) % this.providers.length];
      if (!p || p.enabled === false) continue;
      const cooldownUntil = this.failCooldowns.get(p.name) || 0;
      if (Date.now() < cooldownUntil) continue; // still cooling → rotate on
      return p;
    }
    return null; // all providers cooling; caller waits a short time then retries
  }

  _markFailed(p) {
    this.failCooldowns.set(p.name, Date.now() + this.collectionPeriodMs);
    this.tally.failures++;
    this.tally.rotations++;
  }

  /**
   * Complete a single prompt, rotating providers seamlessly on failure.
   * @param {string} text
   * @param {Object} [opts] { model }
   * @returns {Promise<{text, provider, tally}>}
   */
  async complete(text, { model } = {}) {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const p = this._next();
      if (!p) {
        // Everything cooling: wait the shortest cooldown, then retry — no pause,
        // just the minimum necessary to let a provider recover.
        await delay(this.collectionPeriodMs);
        continue;
      }
      this.tally.calls++;
      try {
        const res = await this.request(p.endpoint, {
          method: 'POST',
          headers: p.headers ? p.headers() : {},
          body: p.body ? JSON.stringify(p.body(text, model || p.model)) : JSON.stringify({ prompt: text }),
        });
        const json =
          typeof res.json === 'function'
            ? res.json()
            : res.text
              ? (() => { try { return JSON.parse(res.text); } catch { return {}; } })()
              : {};
        if (res.status !== undefined ? (res.status >= 200 && res.status < 300) : true) {
          const out = p.extract ? p.extract(json) : (json.text || json.output || '');
          if (out) return { text: out, provider: p.name, tally: { ...this.tally } };
        }
        this._markFailed(p); // non-2xx or empty → fail over NOW
      } catch (err) {
        this._markFailed(p); // network error → fail over NOW
      }
    }
    throw new Error(
      `All free AI providers exhausted this round (${this.tally.rotations} rotations, ${this.tally.calls} calls)`
    );
  }

  /**
   * Run a list/series of steps (a long task) continuously, rotating between
   * providers; results accumulate so no progress is lost on failover.
   * @param {{steps: (string|{text:string})[]} | string} task
   * @param {Function} [onStep]  optional callback (result, index)
   * @returns {Promise<Array>}
   */
  async run(task, onStep) {
    const steps = task && task.steps ? task.steps : [task];
    const results = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const text = typeof step === 'string' ? step : step.text;
      const result = await this.complete(text);
      results.push(result);
      if (onStep) onStep(result, i);
    }
    return results;
  }
}

module.exports = { FreeAIRotator, defaultProviders, delay };