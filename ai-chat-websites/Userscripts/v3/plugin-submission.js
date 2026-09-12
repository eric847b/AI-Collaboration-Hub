/**
 * Plugin Submission & Analytics (Q4 2026 #8 — submission/review workflow +
 * plugin usage analytics).
 * Client-side submission form validation, review checklist, and anonymized
 * usage tracking (local-only, privacy-first).
 */

(function (global) {
  const REQUIRED_FIELDS = ['id', 'name', 'version', 'description', 'author', 'downloadUrl', 'permissions'];
  const REVIEW_CHECKLIST = [
    'manifest present with id/name/version',
    'permissions declared and minimal',
    'no eval() / new Function',
    'no network calls beyond declared @connect',
    'source validated with node --check',
    'changelog entry added'
  ];
  const USAGE_KEY = 'unifiedsuite_plugin_usage';

  class PluginSubmission {
    constructor() {
      this._mem = {};
    }

    validate(manifest) {
      const missing = REQUIRED_FIELDS.filter(f => {
        const v = manifest[f];
        if (Array.isArray(v)) return false;
        return !v || String(v).trim() === '';
      });
      const errors = missing.map(f => 'missing required field: ' + f);
      if (manifest.permissions && !Array.isArray(manifest.permissions)) {
        errors.push('permissions must be an array');
      }
      if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        errors.push('version must be semver (x.y.z)');
      }
      return { ok: errors.length === 0, errors };
    }

    reviewChecklist() {
      return REVIEW_CHECKLIST.slice();
    }

    /** Record a plugin usage event (local-only). */
    track(pluginId, action) {
      try {
        const usage = JSON.parse(global.localStorage.getItem(USAGE_KEY) || '{}');
        const day = new Date().toISOString().split('T')[0];
        const key = pluginId + '|' + day;
        usage[key] = usage[key] || { pluginId, day, actions: {}, installs: 0, uses: 0 };
        usage[key].actions[action] = (usage[key].actions[action] || 0) + 1;
        if (action === 'install') usage[key].installs += 1;
        if (action === 'use') usage[key].uses += 1;
        global.localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
        this._mem = usage;
        return true;
      } catch {
        return false;
      }
    }

    /** Aggregate usage report. */
    report() {
      try {
        const usage = JSON.parse(global.localStorage.getItem(USAGE_KEY) || '{}');
        const byPlugin = {};
        Object.values(usage).forEach(rec => {
          byPlugin[rec.pluginId] = byPlugin[rec.pluginId] || { uses: 0, installs: 0, days: 0 };
          byPlugin[rec.pluginId].uses += rec.uses;
          byPlugin[rec.pluginId].installs += rec.installs;
          byPlugin[rec.pluginId].days += 1;
        });
        return byPlugin;
      } catch {
        return {};
      }
    }
  }

  global.PluginSubmission = PluginSubmission;
  if (typeof module !== 'undefined' && module.exports) module.exports = { PluginSubmission };
})(typeof window !== 'undefined' ? window : globalThis);