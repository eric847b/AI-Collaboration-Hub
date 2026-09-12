/**
 * Team Collaboration Manager (Q2 2027 #16 — scaffold).
 * Dependency-free WebSocket session sync for shared AI workspaces:
 * presence, cursor movement, and generation lifecycle events.
 *
 * Usage:
 *   const collab = new CollabManager({ url: 'wss://api.ai-collab.com' });
 *   collab.join('session-123');
 *   collab.on('cursor', (evt) => { ... });
 *   collab.broadcast('cursor', { x, y });
 */

(function (global) {
  const DEFAULTS = {
    url: 'wss://api.ai-collab.com',
    reconnectBaseDelayMs: 1000,
    reconnectMaxDelayMs: 30000,
    heartbeatMs: 25000
  };

  class CollabManager {
    constructor(options) {
      this.options = Object.assign({}, DEFAULTS, options);
      this.ws = null;
      this.sessionId = null;
      this.peerId = this.options.peerId || ('peer-' + Date.now().toString(36));
      this.listeners = {};
      this.pending = [];
      this.reconnectAttempt = 0;
      this.reconnectTimer = null;
      this.heartbeatTimer = null;
      this.connected = false;
      this.available = typeof WebSocket !== 'undefined';
    }

    on(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
      return this;
    }

    off(type, handler) {
      if (!this.listeners[type]) return this;
      this.listeners[type] = this.listeners[type].filter(h => h !== handler);
      return this;
    }

    emit(type, data) {
      (this.listeners[type] || []).forEach(h => {
        try {
          h(data);
        } catch (err) {
          if (console && console.warn) console.warn('collab handler error', err);
        }
      });
    }

    join(sessionId) {
      this.sessionId = sessionId;
      if (!this.available) {
        this.emit('unavailable', { reason: 'no-websocket' });
        return this;
      }
      this.connect();
      return this;
    }

    connect() {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
      const url = this.options.url.replace(/\/$/, '') + '/sessions/' + encodeURIComponent(this.sessionId || 'default');
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        this.emit('error', err);
        return;
      }
      this.ws = ws;

      ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempt = 0;
        this.emit('open', { sessionId: this.sessionId, peerId: this.peerId });
        this.send('presence', { action: 'join' });
        this.startHeartbeat();
        const queued = this.pending.splice(0);
        queued.forEach(m => this.send(m.type, m.data));
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        this.handleMessage(msg);
      };

      ws.onerror = () => this.emit('error', { message: 'websocket error' });
      ws.onclose = () => {
        this.connected = false;
        this.stopHeartbeat();
        this.emit('close', { sessionId: this.sessionId });
        this.scheduleReconnect();
      };
    }

    scheduleReconnect() {
      if (this.reconnectTimer || !this.sessionId) return;
      const delay = Math.min(
        this.options.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempt),
        this.options.reconnectMaxDelayMs
      );
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    }

    startHeartbeat() {
      this.stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (this.connected) this.sendRaw(JSON.stringify({ type: 'ping', peerId: this.peerId, ts: Date.now() }));
      }, this.options.heartbeatMs);
    }

    stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }

    sendRaw(payload) {
      if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(payload);
    }

    broadcast(type, data) {
      if (!this.connected) {
        this.pending.push({ type, data });
        this.emit('queued', { type });
        return;
      }
      this.send(type, data);
    }

    send(type, data) {
      this.sendRaw(JSON.stringify({
        type,
        peerId: this.peerId,
        sessionId: this.sessionId,
        data,
        ts: Date.now()
      }));
    }

    handleMessage(msg) {
      switch (msg.type) {
        case 'presence': this.emit('presence', msg.data); break;
        case 'cursor-move': this.emit('cursor', msg.data); break;
        case 'generation-start': this.emit('gen-start', msg.data); break;
        case 'generation-complete': this.emit('gen-complete', msg.data); break;
        case 'pong': this.emit('pong', { ts: msg.ts }); break;
        default: this.emit('message', msg);
      }
    }

    leave() {
      this.send('presence', { action: 'leave' });
      this.sessionId = null;
      this.disconnect();
    }

    disconnect() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.stopHeartbeat();
      if (this.ws) {
        try { this.ws.close(); } catch {}
        this.ws = null;
      }
      this.connected = false;
      this.emit('close', { sessionId: null });
    }
  }

  global.CollabManager = CollabManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = { CollabManager };
})(typeof window !== 'undefined' ? window : globalThis);