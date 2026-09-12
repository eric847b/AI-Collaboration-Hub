/**
 * Monitor & Error Tracker (Ongoing Infrastructure — performance monitoring,
 * alerting, and privacy-first error tracking).
 * Samples runtime metrics (FPS, load, memory) and captures errors locally,
 * never exfiltrating personally identifiable data.
 */

(function (global) {
  const STORAGE_KEY = 'unifiedsuite_metrics';
  const DEFAULTS = {
    sampleWindowMs: 60000,
    maxSamples: 1000,
    alertThresholds: { fps: 20, errorRate: 0.1 }
  };

  class Monitor {
    constructor(options) {
      this.options = Object.assign({}, DEFAULTS, options);
      this.samples = [];
      this.alerts = [];
      this._memErrors = [];
    }

    _now() { return Date.now(); }

    /** Record a metric sample. */
    sample(metric, value, tags) {
      const now = this._now();
      this.samples = this.samples.filter(s => now - s.ts <= this.options.sampleWindowMs);
      this.samples.push({ metric, value, tags: tags || {}, ts: now });
      if (this.samples.length > this.options.maxSamples) {
        this.samples.splice(0, this.samples.length - this.options.maxSamples);
      }
      this._maybeAlert(metric, value);
      return value;
    }

    _maybeAlert(metric, value) {
      const threshold = this.options.alertThresholds[metric];
      if (threshold === undefined) return;
      const over = metric === 'fps' ? value < threshold : value > threshold;
      if (over) {
        this.alerts.push({ metric, value, threshold, ts: this._now() });
        this._notify(metric, value, threshold);
      }
    }

    _notify(metric, value, threshold) {
      if (global.console && console.warn) {
        console.warn('[monitor] alert ' + metric + '=' + value + ' (threshold ' + threshold + ')');
      }
    }

    summary() {
      const recent = this.samples.slice(-100);
      const byMetric = {};
      recent.forEach(s => {
        byMetric[s.metric] = byMetric[s.metric] || { count: 0, sum: 0, min: Infinity, max: -Infinity };
        const m = byMetric[s.metric];
        m.count += 1; m.sum += s.value;
        if (s.value < m.min) m.min = s.value;
        if (s.value > m.max) m.max = s.value;
      });
      return Object.entries(byMetric).map(([metric, m]) => ({
        metric,
        avg: Math.round((m.sum / m.count) * 100) / 100,
        min: m.min, max: m.max, samples: m.count
      }));
    }

    /** Privacy-first error tracking: store locally only, no PII. */
    captureError(err, context) {
      const entry = {
        message: String((err && err.message) || err).slice(0, 300),
        context: (context || '').toString().slice(0, 100),
        ts: this._now()
      };
      try {
        const log = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
        log.push(entry);
        if (log.length > 200) log.splice(0, log.length - 200);
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
        this._memErrors = log;
      } catch {
        this._memErrors.push(entry);
      }
      this._maybeAlert('errorRate', 1);
      return entry;
    }

    getErrors() {
      try {
        return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        return this._memErrors;
      }
    }
  }

  global.Monitor = Monitor;
  if (typeof module !== 'undefined' && module.exports) module.exports = { Monitor };
})(typeof window !== 'undefined' ? window : globalThis);