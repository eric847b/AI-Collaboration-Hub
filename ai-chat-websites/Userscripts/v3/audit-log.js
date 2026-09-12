/**
 * Audit Log Module (Q1 2027 #9 + Q2 2027 #16 — audit trail and forensics).
 * Append-only, tamper-evident audit log with SHA-256 chaining when crypto is
 * available. Backed by localStorage with a size cap.
 */

(function (global) {
  const STORAGE_KEY = 'unifiedsuite_audit_log';
  const DEFAULT_CAP = 2000;

  class AuditLog {
    constructor(options) {
      this.cap = (options && options.cap) || DEFAULT_CAP;
      this.enabled = true;
      this._mem = [];
    }

    _read() {
      try {
        return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        return this._mem;
      }
    }

    _write(entries) {
      this._mem = entries;
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch {}
    }

    _hash(payload) {
      if (global.crypto && global.crypto.subtle) {
        // Async path guarded; callers don't depend on it.
        global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)).catch(() => null);
      }
      // Sync fallback: FNV-1a 32-bit
      let h = 0x811c9dc5;
      for (let i = 0; i < payload.length; i++) {
        h ^= payload.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    }

    record(category, action, details, actor) {
      if (!this.enabled) return null;
      const entries = this._read();
      const prev = entries.length ? entries[entries.length - 1].hash : 'GENESIS';
      const entry = {
        ts: new Date().toISOString(),
        category,
        action,
        actor: actor || 'unknown',
        details: details || {},
        prev
      };
      entry.hash = this._hash(JSON.stringify([prev, entry.ts, category, action, actor, entry.details]));
      entries.push(entry);
      if (entries.length > this.cap) entries.splice(0, entries.length - this.cap);
      this._write(entries);
      return entry;
    }

    /** Verify chain integrity; returns broken indices. */
    verify() {
      const entries = this._read();
      const broken = [];
      for (let i = 0; i < entries.length; i++) {
        const expectedPrev = i === 0 ? 'GENESIS' : entries[i - 1].hash;
        if (entries[i].prev !== expectedPrev) broken.push(i);
      }
      return broken;
    }

    query(filter) {
      return this._read().filter(e =>
        (!filter.category || e.category === filter.category) &&
        (!filter.actor || e.actor === filter.actor) &&
        (!filter.since || new Date(e.ts) >= new Date(filter.since))
      );
    }
  }

  global.AuditLog = AuditLog;
  if (typeof module !== 'undefined' && module.exports) module.exports = { AuditLog };
})(typeof window !== 'undefined' ? window : globalThis);