// ==UserScript==
// @name         Free-AI Seamless Rotator
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Never-ending free AI: rotates across a pool of free endpoints on 429/5xx/exhaustion so work never pauses.
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.groq.com
// @connect      generativelanguage.googleapis.com
// @connect      api.together.xyz
// @connect      openrouter.ai
// @connect      huggingface.co
// ==/UserScript==
/* globals GM_getValue, GM_setValue, GM_setClipboard, GM_registerMenuCommand, GM_xmlhttpRequest */
(function () {
  'use strict';
  const NS = 'freeai_rot_';

  // ---- Provider pool (free tiers). Keys per provider in GM storage, never hardcoded. ----
  function providers() {
    // Permanent-free LOCAL providers (your own hardware, no key, never expires).
    // If a local server is off, failover is instant to the next lane.
    return [
      {
        name: 'ollama',
        endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
        model: 'phi3:mini',
        headers: () => ({ 'Content-Type': 'application/json' }),
        body: (text) => ({
          model: 'phi3:mini',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
        }),
        extract: (o) => (o.choices && o.choices[0] && o.choices[0].message.content) || '',
      },
      {
        name: 'lmstudio',
        endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
        model: 'phi-3-mini-4k',
        headers: () => ({ 'Content-Type': 'application/json' }),
        body: (text) => ({
          model: 'phi-3-mini-4k',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
        }),
        extract: (o) => (o.choices && o.choices[0] && o.choices[0].message.content) || '',
      },
      {
        name: 'localai',
        endpoint: 'http://127.0.0.1:8080/v1/chat/completions',
        model: 'phi-3-mini-4k',
        headers: () => ({ 'Content-Type': 'application/json' }),
        body: (text) => ({
          model: 'phi-3-mini-4k',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
        }),
        extract: (o) => (o.choices && o.choices[0] && o.choices[0].message.content) || '',
      },
      // Hugging Face Inference API (free public models; needs a free HF_API_KEY).
      {
        name: 'hf-free',
        endpoint:
          'https://api-inference.huggingface.co/models/' +
          (GM_getValue(NS + 'hf_model', '') || 'mistralai/Mistral-7B-Instruct-v0.2'),
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        headers: () => ({
          Authorization: 'Bearer ' + (GM_getValue(NS + 'hf', '') || ''),
          'Content-Type': 'application/json',
        }),
        body: (text) => ({
          inputs: text,
          parameters: { max_new_tokens: 512, return_full_text: false },
        }),
        extract: (o) => (Array.isArray(o) ? o[0] && o[0].generated_text : o.generated_text) || '',
      },
      {
        name: 'groq-free',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        headers: () => ({ Authorization: 'Bearer ' + (GM_getValue(NS + 'groq', '') || '') }),
        body: (text) => ({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
        }),
        extract: (o) => (o.choices && o.choices[0] && o.choices[0].message.content) || '',
      },
      {
        name: 'gemini-free',
        endpoint:
          'https://generativelanguage.googleapis.com/v1beta/models/' +
          'gemini-1.5-flash:generateContent?key=' +
          (GM_getValue(NS + 'google', '') || ''),
        model: 'gemini-1.5-flash',
        headers: () => ({ 'Content-Type': 'application/json' }),
        body: (text) => ({ contents: [{ role: 'user', parts: [{ text }] }] }),
        extract: (o) =>
          (o.candidates &&
            o.candidates[0] &&
            o.candidates[0].content.parts[0] &&
            o.candidates[0].content.parts[0].text) ||
          '',
      },
      {
        name: 'together-free',
        endpoint: 'https://api.together.xyz/v1/chat/completions',
        model: 'meta-llama/Meta-Llama-3.1-8b-instruct-turbo',
        headers: () => ({
          Authorization: 'Bearer ' + (GM_getValue(NS + 'together', '') || ''),
          'Content-Type': 'application/json',
        }),
        body: (text) => ({
          model: 'meta-llama/Meta-Llama-3.1-8b-instruct-turbo',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
          max_tokens: 512,
        }),
        extract: (o) => (o.choices && o.choices[0] && o.choices[0].message.content) || '',
      },
      {
        name: 'openrouter-free',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'meta-llama/llama-3-8b:free',
        headers: () => ({
          Authorization: 'Bearer ' + (GM_getValue(NS + 'openrouter', '') || ''),
          'HTTP-Referer': 'https://collabhub.local',
          'X-Title': 'CollabHub',
          'Content-Type': 'application/json',
        }),
        body: (text) => ({
          model: 'meta-llama/llama-3-8b:free',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
          max_tokens: 512,
        }),
        extract: (o) => (o.choices && o.choices[0] && o.choices[0].message.content) || '',
      },
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
        onload: (res) => {
          try {
            resolve({ status: res.status, json: JSON.parse(res.responseText) });
          } catch {
            resolve({ status: res.status, json: {} });
          }
        },
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
    markFailed(p) {
      this.failCooldowns.set(p.name, Date.now() + this.cooldownMs);
      this.tally.failures++;
      this.tally.rotations++;
    },
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
        if (!p) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        } // minimal wait, then retry
        this.tally.calls++;
        try {
          const res = await gmRequest(p.endpoint, {
            method: 'POST',
            headers: p.headers(),
            body: JSON.stringify(p.body(text)),
          });
          if (res.status >= 200 && res.status < 300) {
            const out = p.extract(res.json);
            if (out) return { text: out, provider: p.name, tally: { ...this.tally } };
          }
          this.markFailed(p);
        } catch (e) {
          this.markFailed(p);
        }
      }
      throw new Error('All free AI providers exhausted this round');
    },
  };

  // ---- Page injection: floating button -> docked result card ----
  function attachUI() {
    if (document.getElementById('freeai-rotator-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'freeai-rotator-btn';
    btn.textContent = '💬 FreeAI';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: 2147483647,
      padding: '8px 10px',
      borderRadius: '8px',
      border: 'none',
      background: '#2563eb',
      color: '#fff',
      font: '600 13px/1 sans-serif',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    });
    btn.addEventListener('click', () => askAndRender());
    document.body.appendChild(btn);
  }
  function pageContext() {
    const title = document.title || '';
    const sel = window.getSelection ? window.getSelection().toString().trim() : '';
    const head = title ? 'Page: ' + title : '';
    if (sel) {
      return (head + '\nSelected text:\n' + sel).trim();
    }
    return (
      (head + '\nSummarize the selected text, or answer anything.').trim() ||
      'Summarize the selected text, or answer anything.'
    );
  }
  function askAndRender(promptText) {
    const text = promptText != null ? promptText : window.prompt('FreeAI prompt:', pageContext());
    if (!text) return;
    btnBusy(true);
    hideCard();
    rotator
      .complete(text)
      .then((r) => {
        GM_setValue(NS + 'last', '[' + r.provider + '] ' + r.text);
        showCard(r.text, r.provider, r.tally);
      })
      .catch((e) => showCard('✗ ' + e.message, '—', null))
      .finally(() => btnBusy(false));
  }
  function btnBusy(on) {
    const btn = document.getElementById('freeai-rotator-btn');
    if (btn) {
      btn.textContent = on ? '⏳...' : '💬 FreeAI';
      btn.disabled = on;
    }
  }
  function hideCard() {
    const c = document.getElementById('freeai-rotator-card');
    if (c) c.remove();
  }
  function showCard(text, provider, tally) {
    hideCard();
    const card = document.createElement('div');
    card.id = 'freeai-rotator-card';
    card.style.cssText = 'position:fixed;right:16px;bottom:56px;z-index:2147483647;';
    const inner = document.createElement('div');
    inner.style.cssText =
      'font:inherit;padding:10px 12px;border-radius:10px;background:#fff;' +
      'border:1px solid #d1d5db;max-width:90%;max-height:40vh;overflow:auto;';
    const title = document.createElement('div');
    title.style.cssText = 'font:700 12px/1.4 sans-serif;color:#1e40af;';
    title.textContent = 'FreeAI · ' + provider;
    inner.appendChild(title);
    const body = document.createElement('div');
    body.style.cssText =
      'font:400 12px/1.5 sans-serif;margin-top:4px;white-space:pre-wrap;word-break:break-word;';
    body.textContent = text;
    inner.appendChild(body);
    if (tally) {
      const meta = document.createElement('div');
      meta.style.cssText = 'font:400 11px/1 sans-serif;color:#6b7280;margin-top:4px;';
      meta.textContent = 'calls=' + tally.calls + ' rotations=' + tally.rotations;
      inner.appendChild(meta);
    }
    const copy = document.createElement('button');
    copy.id = 'freeai-copy';
    copy.textContent = 'Copy';
    copy.style.cssText =
      'float:right;margin-top:6px;padding:4px 8px;border:none;border-radius:6px;' +
      'background:#2563eb;color:#fff;cursor:pointer;font:inherit;';
    copy.addEventListener('click', () => GM_setClipboard(text, true));
    inner.appendChild(copy);
    card.appendChild(inner);
    document.body.appendChild(card);
  }

  // ---- Menu: set key, run prompt ----
  function runPrompt() {
    const p = prompt('Prompt (TypeScript. Empty = default):', 'State what you are, in one line.');
    if (p === null) return;
    rotator
      .complete(p)
      .then((r) => {
        GM_setValue(NS + 'last', r.provider + ': ' + r.text);
        alert('[' + r.provider + '] ' + r.text);
      })
      .catch((e) => alert('✗ ' + e.message));
  }

  GM_registerMenuCommand('⚙ Set Groq Free API Key', () => {
    const k = prompt('Groq API key:', GM_getValue(NS + 'groq', ''));
    if (k) GM_setValue(NS + 'groq', k);
  });
  GM_registerMenuCommand('⚙ Set Google (Gemini) Free API Key', () => {
    const k = prompt('Google API key:', GM_getValue(NS + 'google', ''));
    if (k) GM_setValue(NS + 'google', k);
  });
  GM_registerMenuCommand('⚙ Set Together Free API Key', () => {
    const k = prompt('Together API key:', GM_getValue(NS + 'together', ''));
    if (k) GM_setValue(NS + 'together', k);
  });
  GM_registerMenuCommand('⚙ Set OpenRouter Free API Key', () => {
    const k = prompt('OpenRouter API key:', GM_getValue(NS + 'openrouter', ''));
    if (k) GM_setValue(NS + 'openrouter', k);
  });
  GM_registerMenuCommand('⚙ Set Hugging Face API Key', () => {
    const k = prompt('Hugging Face API key:', GM_getValue(NS + 'hf', ''));
    if (k) GM_setValue(NS + 'hf', k);
  });
  GM_registerMenuCommand('⚙ Set Hugging Face Model', () => {
    const m = prompt('HF model (optional):', GM_getValue(NS + 'hf_model', ''));
    if (m) GM_setValue(NS + 'hf_model', m);
  });
  GM_registerMenuCommand('🤖 Run prompt (seamless rotation)', runPrompt);

  attachUI();

  console.log(
    '[FreeAI Rotator] ready. 💬 button injected; set a free key via the menu, then click it.'
  );
  console.log('[FreeAI Rotator] ready. Use the userscript menu (⚙ / 🤖).');
})();
