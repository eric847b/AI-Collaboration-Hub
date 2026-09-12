/**
 * Voice Input Module (Q4 2027 #7).
 * Web Speech API voice input for the generator + NL editor.
 * Gracefully reports availability and falls back to text-only mode.
 */

(function (global) {
  const SpeechRecognition =
    global.SpeechRecognition ||
    global.webkitSpeechRecognition ||
    global.mozSpeechRecognition ||
    null;

  class VoiceInput {
    constructor(options) {
      this.lang = (options && options.lang) || 'en-US';
      this.continuous = !!(options && options.continuous);
      this.interim = !!(options && options.interimResults);
      this.recognition = null;
      this.listening = false;
    }

    get available() {
      return Boolean(SpeechRecognition);
    }

    start() {
      if (!this.available || this.listening) return false;
      const SR = SpeechRecognition;
      const rec = new SR();
      rec.lang = this.lang;
      rec.continuous = this.continuous;
      rec.interimResults = this.interim;

      rec.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
        }
        if (transcript) this._emit('result', { transcript });
      };
      rec.onerror = (event) => this._emit('error', { error: event.error });
      rec.onend = () => {
        this.listening = false;
        this._emit('end', {});
      };

      this.recognition = rec;
      try {
        rec.start();
        this.listening = true;
        this._emit('start', {});
        return true;
      } catch {
        return false;
      }
    }

    stop() {
      if (this.recognition) {
        try { this.recognition.stop(); } catch {}
        this.recognition = null;
      }
      this.listening = false;
    }

    on(type, handler) {
      (this._listeners = this._listeners || {})[type] = (this._listeners[type] || []).concat(handler);
      return this;
    }

    _emit(type, data) {
      (this._listeners && this._listeners[type] || []).forEach(h => {
        try { h(data); } catch {}
      });
    }
  }

  global.VoiceInput = VoiceInput;
  if (typeof module !== 'undefined' && module.exports) module.exports = { VoiceInput };
})(typeof window !== 'undefined' ? window : globalThis);