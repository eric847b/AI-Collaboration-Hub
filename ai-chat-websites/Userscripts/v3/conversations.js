/**
 * Conversations Module (Q4 2027 #7 — multi-turn + context retention).
 * Maintains multi-turn conversation memory across generations and persists
 * session context so users can refine scripts conversationally.
 * Dependency-free; uses localStorage when available.
 */

(function (global) {
  const STORAGE_KEY = 'unifiedsuite_conversations';

  class ConversationStore {
    constructor(options) {
      this.maxTurns = (options && options.maxTurns) || 40;
      this.maxSessions = (options && options.maxSessions) || 20;
      this._mem = {};
    }

    _read() {
      try {
        return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}');
      } catch {
        return this._mem;
      }
    }

    _write(data) {
      this._mem = data;
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }

    /** Start or resume a named conversation. */
    session(id) {
      const all = this._read();
      if (!all[id]) {
        all[id] = { id, createdAt: Date.now(), updatedAt: Date.now(), turns: [] };
        this._write(all);
      }
      return all[id];
    }

    /** Append a user/assistant turn with context retention metadata. */
    addTurn(sessionId, role, content, meta) {
      const all = this._read();
      const s = all[sessionId] || (all[sessionId] = { id: sessionId, createdAt: Date.now(), turns: [] });
      s.turns.push({ role, content, meta: meta || {}, ts: Date.now() });
      s.updatedAt = Date.now();
      if (s.turns.length > this.maxTurns) s.turns = s.turns.slice(-this.maxTurns);
      this._trim(all);
      this._write(all);
      return s.turns.length;
    }

    _trim(all) {
      const ids = Object.keys(all).sort((a, b) => all[b].updatedAt - all[a].updatedAt);
      ids.slice(this.maxSessions).forEach(id => delete all[id]);
    }

    /** Full transcript for a session. */
    transcript(sessionId) {
      return (this._read()[sessionId] || { turns: [] }).turns;
    }

    /** Recent turns only, ready to send as an API messages array. */
    toMessages(sessionId, tail) {
      const turns = this.transcript(sessionId);
      const slice = tail ? turns.slice(-tail) : turns;
      return slice.map(t => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.content }));
    }

    /** Compact summary (first + last N turns) for context retention across sessions. */
    contextSummary(sessionId, keep = 6) {
      const turns = this.transcript(sessionId);
      if (turns.length <= keep) return turns;
      const head = turns.slice(0, Math.ceil(keep / 2));
      const tail = turns.slice(-Math.floor(keep / 2));
      return head.concat([{ role: 'system', content: '[… context truncated …]' }]).concat(tail);
    }

    clear(sessionId) {
      const all = this._read();
      delete all[sessionId];
      this._write(all);
    }

    listSessions() {
      const all = this._read();
      return Object.keys(all)
        .map(id => ({ id, turns: all[id].turns.length, updatedAt: all[id].updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }
  }

  global.ConversationStore = ConversationStore;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ConversationStore };
})(typeof window !== 'undefined' ? window : globalThis);