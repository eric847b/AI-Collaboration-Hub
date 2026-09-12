/**
 * Natural Language Editor (Q4 2027 #7).
 * Applies natural-language edit directives to generated scripts:
 *   "rename function foo to bar", "remove the debug block", "add error handling",
 *   "extract x into a function", "increase the retry timeout to 5 seconds".
 * Deterministic, rule-based, dependency-free.
 */

(function (global) {
  const DEFAULTS = {
    timeoutPattern: /(\d+)\s*(seconds?|ms|milliseconds?)/i,
    retryHint: /retry/i,
    timeoutHint: /timeout|wait|delay/i
  };

  class NLEditor {
    apply(source, directive) {
      const text = String(directive || '').trim();
      if (!text) return { source, applied: false, edits: [] };
      const edits = [];

      // rename function <name> to <new>
      let m = text.match(/rename (?:function |the )?([a-zA-Z_$][\w$]*)\s+to\s+([a-zA-Z_$][\w$]*)/i);
      if (m) {
        const [, from, to] = m;
        source = source.replace(new RegExp('\\b' + from + '\\b', 'g'), to);
        edits.push('renamed ' + from + ' -> ' + to);
      }

      // remove the <x> block / line containing <x>
      m = text.match(/remove (?:the |any )?([a-zA-Z0-9_ -]+)\s*(?:block|line|section|comment)?/i);
      if (m) {
        const target = m[1].trim();
        const before = source;
        source = source
          .split('\n')
          .filter(line => !line.toLowerCase().includes(target.toLowerCase()))
          .join('\n');
        if (source !== before) edits.push('removed lines mentioning "' + target + '"');
      }

      // add error handling: wrap risky calls in try/catch
      if (/add (?:some |basic )?error handling/i.test(text)) {
        const hasTry = /try\s*\{/.test(source);
        if (!hasTry) {
          source =
            'try {\n' +
            source.split('\n').map(l => '  ' + l).join('\n') +
            '\n} catch (err) {\n  console.error("generated error:", err);\n  throw err;\n}';
          edits.push('wrapped body in try/catch');
        } else {
          edits.push('error handling already present');
        }
      }

      // extract <x> into a function
      m = text.match(/extract (.{2,60}) into a function/i);
      if (m) {
        const marker = m[1].trim();
        const regex = new RegExp('([^;\\n]*)' + escapeRegExp(marker) + '([^;\\n]*)', 'i');
        const match = source.match(regex);
        if (match) {
          const name = 'extracted_' + marker.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 20);
          source = source.replace(match[0], name + '()');
          source += '\n\nfunction ' + name + '() {\n  ' + match[0].trim() + '\n}';
          edits.push('extracted "' + marker + '" into ' + name + '()');
        }
      }

      // adjust numeric value for timeout/retry/delay
      m = text.match(/(increase|decrease|set) (?:the )?(retry|timeout|delay|wait).*?(\d+)\s*(seconds?|ms|milliseconds?)?/i);
      if (m) {
        const kind = m[2].toLowerCase();
        const value = parseInt(m[3], 10);
        const unit = (m[4] || 'ms').toLowerCase();
        const ms = unit.startsWith('sec') ? value * 1000 : value;
        const operator = /increase/.test(text) ? 1 : -1;
        const anchor = /retry/.test(kind) ? /(retries?|maxRetries?|attempts?)\s*[:=]\s*\d+/i : /(timeout|delay|wait)\s*[:=]\s*\d+/i;
        source = source.replace(anchor, (hit) => hit.replace(/(\d+)/, (n) => Math.max(0, parseInt(n, 10) + operator * Math.round(ms / (anchor.source.includes('retries') ? 1 : 1)))));
        edits.push(kind + ' adjusted by ' + operator + Math.round(ms) + 'ms');
      }

      return { source, applied: edits.length > 0, edits };
    }
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  global.NLEditor = NLEditor;
  if (typeof module !== 'undefined' && module.exports) module.exports = { NLEditor };
})(typeof window !== 'undefined' ? window : globalThis);