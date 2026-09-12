/**
 * CSP Compliance Validator (Q1 2027 #9).
 * Validates a Content-Security-Policy string against a baseline security
 * profile. Reports violations with severity and line hints.
 */

(function (global) {
  const HARD_FAILS = [
    { pattern: /(^|;)\s*script-src[^;]*['"]unsafe-eval['"]/i, note: 'unsafe-eval weakens script integrity' },
    { pattern: /(^|;)\s*default-src[^;]*\*[^;]*/i, note: 'default-src * is an open policy' },
    { pattern: /(^|;)\s*script-src[^;]*\*[^;]*/i, note: 'script-src * allows any script source' },
    { pattern: /(^|;)\s*object-src\s+(?!['"]none['"])/i, note: 'object-src must be none' }
  ];
  const WARNINGS = [
    { pattern: /(^|;)\s*script-src[^;]*'unsafe-inline'/i, note: 'inline scripts allowed' },
    { pattern: /(^|;)\s*frame-ancestors/i, note: 'frame-ancestors should be explicitly set' },
    { pattern: /(^|;)\s*upgrade-insecure-requests/i, note: 'good — consider base-uri too' }
  ];

  class CSPValidator {
    /** @returns {{ok:boolean, errors:Array, warnings:Array}} */
    validate(policy) {
      const text = String(policy || '').trim();
      const errors = [];
      const warnings = [];

      if (!text) {
        return { ok: false, errors: [{ severity: 'error', note: 'empty CSP policy' }], warnings };
      }

      for (const rule of HARD_FAILS) {
        if (rule.pattern.test(text)) errors.push({ severity: 'error', note: rule.note });
      }
      for (const rule of WARNINGS) {
        if (rule.pattern.test(text)) warnings.push({ severity: 'warning', note: rule.note });
      }

      // Required directives
      for (const dir of ['default-src', 'script-src', 'object-src']) {
        if (!new RegExp('(^|;)\\s*' + dir + '\\s+', 'i').test(text)) {
          errors.push({ severity: 'error', note: 'missing required directive: ' + dir });
        }
      }

      return { ok: errors.length === 0, errors, warnings };
    }
  }

  global.CSPValidator = CSPValidator;
  if (typeof module !== 'undefined' && module.exports) module.exports = { CSPValidator };
})(typeof window !== 'undefined' ? window : globalThis);