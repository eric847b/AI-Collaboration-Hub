/**
 * Script Optimizer (Q2 2027 #15 — automated optimization suggestions).
 * Static analysis that suggests concrete, safe optimizations for generated
 * scripts: dead code, repeated lookups, unused vars, blocking patterns.
 */

(function (global) {
  class ScriptOptimizer {
    analyze(source) {
      const text = String(source || '');
      const suggestions = [];

      // Dead code: unreachable after return/throw at top level of a function
      const deadMatches = text.match(/return[^;]*;\s*(?:\/\/.*)?\n\s*[^\s}\/]/g);
      if (deadMatches) suggestions.push({
        severity: 'info',
        title: 'possible dead code after return',
        detail: deadMatches.length + ' spot(s) found',
        fix: 'remove statements following an unconditional return'
      });

      // Repeated document lookups
      const repeated = {};
      (text.match(/document\.getElementById\(['"`]([^'"`]+)['"`]\)/g) || []).forEach(hit => {
        repeated[hit] = (repeated[hit] || 0) + 1;
      });
      const hot = Object.entries(repeated).filter(([, n]) => n >= 3);
      if (hot.length) suggestions.push({
        severity: 'warning',
        title: 'repeated DOM lookups',
        detail: hot.map(([h, n]) => h + ' x' + n).join(', '),
        fix: 'cache the element in a const once, then reuse'
      });

      // Unused variables (declared with let/const but never referenced)
      const declared = new Set();
      (text.match(/(?:let|const)\s+([a-zA-Z_$][\w$]*)/g) || []).forEach(d => declared.add(d.split(/\s+/)[1]));
      const unused = Array.from(declared).filter(name => {
        const occurrences = text.match(new RegExp('\\b' + name + '\\b', 'g')) || [];
        return occurrences.length === 1;
      });
      if (unused.length) suggestions.push({
        severity: 'info',
        title: 'unused variable(s)',
        detail: unused.join(', '),
        fix: 'remove declarations that are never referenced'
      });

      // Blocking sync loop hint
      if (/\bwhile\s*\(true\)/.test(text)) suggestions.push({
        severity: 'warning',
        title: 'infinite while(true)',
        detail: 'potential main-thread freeze',
        fix: 'add a bounded condition or break'
      });

      return {
        score: Math.max(0, 100 - suggestions.length * 10),
        suggestions
      };
    }
  }

  global.ScriptOptimizer = ScriptOptimizer;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ScriptOptimizer };
})(typeof window !== 'undefined' ? window : globalThis);