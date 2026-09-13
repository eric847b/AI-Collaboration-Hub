/**
 * Custom Fine-Tuning Integration (Q2 2027 #15).
 * Prepares, queues, and exports fine-tuning datasets/jobs for any
 * OpenAI-compatible endpoint — without shipping training data off-device
 * until the user explicitly exports. Formats: jsonl / chat / messages.
 *
 * Local-first: datasets, jobs, and hyperparameters stay in memory; the
 * caller decides when to hand a formatted export to a training API.
 */

(function (global) {
  'use strict';

  const FORMATS = ['jsonl', 'chat', 'messages'];
  const DEFAULTS = {
    maxDatasetEntries: 2000,
    hyperparams: { epochs: 3, learningRate: 2e-5, batchSize: 4, maxTokens: 2048 }
  };
  const STATUSES = new Set(['queued', 'running', 'completed', 'cancelled', 'failed']);

  class FineTuningManager {
    constructor(options) {
      this.options = Object.assign({}, DEFAULTS, options);
      this._datasets = new Map();
      this._jobs = new Map();
      this._seq = 0;
    }

    _next(prefix) { return prefix + '-' + (++this._seq); }

    /** Create a dataset from {text|prompt, completion} entries. */
    createDataset({ id, name, entries } = {}) {
      const dsId = id || this._next('ds');
      if (this._datasets.has(dsId)) throw new Error('dataset exists: ' + dsId);
      if (!Array.isArray(entries) || entries.length === 0) throw new Error('entries[] (non-empty) required');
      if (entries.length > this.options.maxDatasetEntries) {
        throw new Error('too many entries (max ' + this.options.maxDatasetEntries + ')');
      }
      const cleaned = entries.map((e, i) => {
        if (!e || typeof e !== 'object') throw new Error('entry #' + i + ' must be an object');
        const text = String(e.text || e.prompt || '').trim();
        const completion = String(e.completion || '').trim();
        if (!text || !completion) throw new Error('entry #' + i + ' missing text/prompt + completion');
        return { text, completion };
      });
      const dataset = {
        id: dsId,
        name: String(name || dsId).slice(0, 120),
        entries: cleaned,
        createdAt: new Date().toISOString()
      };
      this._datasets.set(dsId, dataset);
      return dataset;
    }

    getDataset(id) { return this._datasets.get(id); }

    listDatasets() {
      return Array.from(this._datasets.values())
        .map(d => ({ id: d.id, name: d.name, count: d.entries.length }));
    }

    /** Format a dataset for a training provider. */
    exportDataset(id, format) {
      const d = this._datasets.get(id);
      if (!d) throw new Error('unknown dataset: ' + id);
      return this._format(d.entries, FORMATS.includes(format) ? format : 'jsonl');
    }

    _format(entries, fmt) {
      if (fmt === 'jsonl') {
        return entries.map(e => JSON.stringify({ prompt: e.text, completion: e.completion })).join('\n');
      }
      if (fmt === 'chat') {
        return JSON.stringify(entries.map(e => ({
          messages: [
            { role: 'user', content: e.text },
            { role: 'assistant', content: e.completion }
          ]
        })), null, 2);
      }
      return JSON.stringify(entries.map(e => ({ text: e.text, completion: e.completion })), null, 2);
    }

    /** Queue a training job against a dataset + base model. */
    createJob({ id, dataset, baseModel, hyperparams } = {}) {
      if (!this._datasets.has(dataset)) throw new Error('unknown dataset: ' + dataset);
      if (!baseModel) throw new Error('baseModel required');
      const jobId = id || this._next('job');
      const job = {
        id: jobId,
        dataset,
        baseModel: String(baseModel),
        hyperparams: Object.assign({}, DEFAULTS.hyperparams, hyperparams || {}),
        status: 'queued',
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        metrics: null
      };
      this._jobs.set(jobId, job);
      return job;
    }

    getJob(id) { return this._jobs.get(id); }

    listJobs() {
      return Array.from(this._jobs.values())
        .map(j => ({ id: j.id, dataset: j.dataset, baseModel: j.baseModel, status: j.status }));
    }

    startJob(id) {
      const j = this._jobs.get(id);
      if (!j) throw new Error('unknown job: ' + id);
      if (j.status !== 'queued') return false;
      j.status = 'running';
      j.startedAt = new Date().toISOString();
      return true;
    }

    completeJob(id, metrics) {
      const j = this._jobs.get(id);
      if (!j) throw new Error('unknown job: ' + id);
      if (j.status !== 'running') return false;
      j.status = 'completed';
      j.finishedAt = new Date().toISOString();
      j.metrics = metrics && typeof metrics === 'object' ? metrics : {};
      return true;
    }

    failJob(id, reason) {
      const j = this._jobs.get(id);
      if (!j) return false;
      j.status = 'failed';
      j.finishedAt = new Date().toISOString();
      j.metrics = { error: String(reason).slice(0, 300) };
      return true;
    }

    cancelJob(id) {
      const j = this._jobs.get(id);
      if (!j) return false;
      if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') return false;
      j.status = 'cancelled';
      return true;
    }

    /** Estimated training cost before firing a provider (tokens x epochs). */
    estimateCost(jobId, per1kTokensUsd) {
      const j = this._jobs.get(jobId);
      if (!j) return null;
      const ds = this._datasets.get(j.dataset);
      const tokens = ds ? ds.entries.reduce((acc, e) => acc + Math.ceil((e.text.length + e.completion.length) / 4), 0) : 0;
      const totalTokens = Math.ceil(tokens * (j.hyperparams.epochs || 1));
      const rate = per1kTokensUsd && per1kTokensUsd > 0 ? per1kTokensUsd : 0.002;
      return {
        tokens,
        totalTokens,
        epochs: j.hyperparams.epochs,
        estUsd: Math.round(totalTokens * rate / 1000 * 10000) / 10000
      };
    }

    /** Intrinsic quality proxy (placeholder until a training backend lands). */
    evaluate(jobId, heldOut) {
      const j = this._jobs.get(jobId);
      if (!j) return null;
      const ds = this._datasets.get(j.dataset);
      const base = ds ? ds.entries : [];
      let match = 0;
      for (const h of heldOut || []) {
        if (base.some(e => e.text === (h.text || h.prompt))) match += 1;
      }
      const ratio = heldOut && heldOut.length ? match / heldOut.length : 0;
      return { jobId, dataset: j.dataset, heldOutSamples: (heldOut || []).length, overlapRatio: ratio };
    }
  }

  global.FineTuningManager = FineTuningManager;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FineTuningManager, FORMATS };
  }
})(typeof window !== 'undefined' ? window : globalThis);