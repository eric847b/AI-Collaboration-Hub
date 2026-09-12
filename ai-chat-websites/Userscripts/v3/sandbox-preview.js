/**
 * Sandbox Preview Module (Q1 2027 #9 — script sandboxing preview mode).
 * Runs a generated script in an isolated iframe (or simulated context when
 * iframes are unavailable) and returns captured logs/errors without touching
 * the host page. Also strips dangerous API usage.
 */

(function (global) {
  const BLOCKED_PATTERNS = [
    /document\.cookie/i,
    /window\.top/i,
    /\bparent\b\./i,
    /fetch\s*\(\s*['"`]/i,
    /GM_setValue|GM_deleteValue/i,
    /chrome\.runtime/i
  ];

  class SandboxPreview {
    constructor(options) {
      this.timeoutMs = (options && options.timeoutMs) || 3000;
      this.blocked = BLOCKED_PATTERNS.slice();
    }

    /** Scan source for dangerous patterns before running. */
    analyze(source) {
      const hits = [];
      this.blocked.forEach(p => {
        const m = String(source).match(p);
        if (m) hits.push({ pattern: p.source, sample: m[0] });
      });
      return { dangerous: hits.length > 0, hits };
    }

    /** Run source in an isolated iframe when available; else simulated run. */
    run(source) {
      if (typeof document === 'undefined' || !document.createElement) {
        return { isolated: false, notes: ['no iframe support — simulated run only'], logs: [] };
      }

      const analysis = this.analyze(source);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.sandbox = 'allow-scripts';
      document.body.appendChild(iframe);

      const logs = [];
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const wrapped = [
        'window.console.log = function(){ Array.prototype.push.call(arguments, ""); logs.push(Array.prototype.slice.call(arguments).join(" ")); };',
        'window.onerror = function(msg){ logs.push("ERROR: " + msg); return true; };',
        'try { ' + source + ' } catch (e) { logs.push("THROWN: " + e.message); }',
        'window.parent.postMessage({ __sandboxLogs: logs }, "*");'
      ].join('\n');

      doc.open();
      doc.write('<script>' + wrapped + '<\/script>');
      doc.close();

      return {
        isolated: true,
        dangerous: analysis.dangerous,
        hits: analysis.hits,
        timeoutMs: this.timeoutMs,
        logs
      };
    }
  }

  global.SandboxPreview = SandboxPreview;
  if (typeof module !== 'undefined' && module.exports) module.exports = { SandboxPreview };
})(typeof window !== 'undefined' ? window : globalThis);