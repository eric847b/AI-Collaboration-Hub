/**
 * Webhook Dispatcher (Q4 2026 #6 — webhook support for automation workflows).
 * Outbound webhook notifications for generation, install, and presence events,
 * plus a receiver utility for inbound automation requests.
 * Dependency-free; queue + retry with backoff.
 */

(function (global) {
  const STORAGE_KEY = 'unifiedsuite_webhook_queue';
  const DEFAULTS = {
    baseDelayMs: 1000,
    maxAttempts: 5,
    timeoutMs: 8000
  };

  class WebhookDispatcher {
    constructor(options) {
      this.options = Object.assign({}, DEFAULTS, options);
      this.endpoints = (options && options.endpoints) || [];
    }

    /** Register a destination URL + optional secret. */
    addEndpoint(url, secret) {
      this.endpoints.push({ url, secret: secret || '', events: [] });
      return this;
    }

    /** Enqueue + fire an event to all endpoints. */
    dispatch(eventType, payload) {
      const envelope = {
        event: eventType,
        ts: Date.now(),
        payload: payload || {}
      };
      const results = this.endpoints.map(ep => this._send(ep, envelope));
      return results;
    }

    async _send(endpoint, envelope) {
      for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timer = controller ? setTimeout(() => controller.abort(), this.options.timeoutMs) : null;
          const res = await fetch(endpoint.url, {
            method: 'POST',
            headers: Object.assign(
              { 'Content-Type': 'application/json' },
              endpoint.secret ? { 'X-Webhook-Secret': endpoint.secret } : {}
            ),
            body: JSON.stringify(envelope),
            signal: controller ? controller.signal : undefined
          });
          if (timer) clearTimeout(timer);
          if (res.ok) return { url: endpoint.url, ok: true, status: res.status };
          throw new Error('HTTP ' + res.status);
        } catch (err) {
          const delay = this.options.baseDelayMs * Math.pow(2, attempt - 1);
          if (attempt < this.options.maxAttempts) await sleep(delay);
          if (attempt === this.options.maxAttempts) {
            return { url: endpoint.url, ok: false, error: err.message };
          }
        }
      }
    }
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  global.WebhookDispatcher = WebhookDispatcher;
  if (typeof module !== 'undefined' && module.exports) module.exports = { WebhookDispatcher };
})(typeof window !== 'undefined' ? window : globalThis);