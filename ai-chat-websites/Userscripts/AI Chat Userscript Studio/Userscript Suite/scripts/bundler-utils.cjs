const fs = require('fs');
const path = require('path');

const USERSCRIPT_HEADER_BLOCK_RE = /\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/m;
const META_LINE_RE = /^\s*\/\/\s*@([a-zA-Z:]+)\s+(.*)$/gm;
const META_ORDER = ['name', 'version', 'description', 'author', 'match', 'grant', 'require'];
const SINGLE_VALUE_KEYS = new Set(['name', 'version', 'description', 'author']);

function defaultHeader() {
  return [
    '// ==UserScript==',
    '// @name         AI Chat Userscript Suite Bundle',
    '// @version      1.0.0',
    '// ==/UserScript=='
  ].join('\n');
}

function normalizeMetaEntry(entry) {
  return String(entry || '')
    .trim()
    .replace(/^\/\/\s*@/, '')
    .replace(/^@/, '')
    .trim();
}

function extractMetaEntries(header) {
  const entries = [];
  let match;

  while ((match = META_LINE_RE.exec(header)) !== null) {
    const [key, value] = match.slice(1);
    entries.push(`${key.toLowerCase()} ${value.trim()}`);
  }

  META_LINE_RE.lastIndex = 0;
  return entries;
}

function buildMetadataMap(entries) {
  const metadata = {};

  entries.forEach(entry => {
    const normalized = normalizeMetaEntry(entry);
    if (!normalized) {
      return;
    }

    const firstSpace = normalized.indexOf(' ');
    const key = (firstSpace === -1 ? normalized : normalized.slice(0, firstSpace)).toLowerCase();
    const value = firstSpace === -1 ? '' : normalized.slice(firstSpace + 1).trim();

    if (!metadata[key]) {
      metadata[key] = [];
    }

    metadata[key].push(value);
  });

  Object.keys(metadata).forEach(key => {
    if (metadata[key].length === 1) {
      const [singleValue] = metadata[key];
      metadata[key] = singleValue;
    }
  });

  return metadata;
}

function formatHeaderLine(key, value) {
  return `// @${key} ${value}`;
}

const utils = {
  extractHeader(content) {
    const match = content.match(USERSCRIPT_HEADER_BLOCK_RE);
    return match ? match[0].trim() : defaultHeader();
  },

  extractCode(content) {
    return content.replace(USERSCRIPT_HEADER_BLOCK_RE, '').trim();
  },

  parseUserScriptHeader(content) {
    const headerMatch = content.match(USERSCRIPT_HEADER_BLOCK_RE);
    const header = headerMatch ? headerMatch[0].trim() : defaultHeader();
    const meta = headerMatch ? extractMetaEntries(header) : [];

    return {
      hasHeader: Boolean(headerMatch),
      header,
      meta,
      metadata: buildMetadataMap(meta)
    };
  },

  buildMergedHeader(entries) {
    const seen = new Set();
    const orderedEntries = new Map();
    const overflowEntries = [];

    entries.forEach(entry => {
      const normalized = normalizeMetaEntry(entry);
      if (!normalized || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);

      const firstSpace = normalized.indexOf(' ');
      const key = (firstSpace === -1 ? normalized : normalized.slice(0, firstSpace)).toLowerCase();
      const value = firstSpace === -1 ? '' : normalized.slice(firstSpace + 1).trim();

      if (META_ORDER.includes(key)) {
        if (!orderedEntries.has(key)) {
          orderedEntries.set(key, []);
        }
        if (!SINGLE_VALUE_KEYS.has(key) || orderedEntries.get(key).length === 0) {
          orderedEntries.get(key).push(value);
        }
      } else {
        overflowEntries.push({ key, value });
      }
    });

    const lines = ['// ==UserScript=='];

    META_ORDER.forEach(key => {
      const values = orderedEntries.get(key) || [];
      values.forEach(value => {
        lines.push(formatHeaderLine(key, value));
      });
    });

    overflowEntries.forEach(({ key, value }) => {
      lines.push(formatHeaderLine(key, value));
    });

    lines.push('// ==/UserScript==');
    return lines.join('\n');
  },

  mergeHeaders(headers) {
    const metaEntries = headers.flatMap(header => extractMetaEntries(header));
    return this.buildMergedHeader(metaEntries);
  },

  wrapInIIFE(code) {
    const trimmed = code.trim();
    if (trimmed.startsWith('(function') || trimmed.startsWith('function')) {
      return trimmed;
    }
    return `(function(){\n  'use strict';\n  ${trimmed}\n})();`;
  },

  getModuleFiles(modulesDir) {
    if (!fs.existsSync(modulesDir)) {
      throw new Error(`Modules directory not found: ${modulesDir}`);
    }

    return fs.readdirSync(modulesDir)
      .filter(fileName => fileName.endsWith('.user.js') && !fileName.includes('test'))
      .map(fileName => path.join(modulesDir, fileName))
      .sort();
  },

  getModuleFilesRecursive(modulesDir) {
    const results = [];
    if (!fs.existsSync(modulesDir)) return results;

    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === '_archive' || entry.name === '_scratch') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith('.module.user.js')) {
          results.push(fullPath);
        }
      }
    };

    walk(modulesDir);
    return results;
  },

  log(message, level = 'info') {
    const time = new Date().toLocaleTimeString();
    const prefix = {
      info: '[INFO]',
      warn: '[WARN]',
      error: '[ERROR]',
      success: '[OK]'
    }[level] || '[INFO]';

    const output = `[${time}] ${prefix} ${message}`;

    if (level === 'warn') {
      console.warn(output);
      return;
    }

    if (level === 'error') {
      console.error(output);
      return;
    }

    console.info(output);
  },

  warn(message) {
    this.log(message, 'warn');
  },

  error(message) {
    this.log(message, 'error');
  },

  success(message) {
    this.log(message, 'success');
  },

  validateFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return true;
  },

  validateHeader(header) {
    const required = ['@name', '@version'];
    const missing = required.filter(field => !header.includes(field));

    if (missing.length > 0) {
      this.warn(`Header missing fields: ${missing.join(', ')}`);
      return false;
    }

    return true;
  },

  parseHeader(headerOrContent) {
    const source = headerOrContent.includes('==UserScript==')
      ? this.extractHeader(headerOrContent)
      : headerOrContent;

    return buildMetadataMap(extractMetaEntries(source));
  },

  minify(code) {
    // Context-aware minifier: single-pass tokenizer that strips comments and
    // collapses whitespace ONLY in normal (non-literal) state. String, template
    // and regex literals are emitted verbatim, so 'https://…' URLs and similar
    // content can never be corrupted (the old regex chain broke every URL and
    // even edited punctuation inside strings). ASI-restricted statements
    // (return/break/continue/yield) keep their ';' when a newline separated
    // them from the next token. The suite-check parse gate re-verifies every
    // minified artifact, so any regression fails the build loudly.
    //
    // ASI safety: restricted productions (return/break/continue/yield) keep
    // their ';' when a newline separated them from the next token. Any OTHER
    // load-bearing line terminator is preserved verbatim as '\n' — e.g.
    // `}\n(function…` relies on ASI and becomes a syntax error if collapsed
    // to `} (function…`. Only pure space/tab runs may collapse to ' '.
    //
    // Performance contract (learned on the 1.7 MB merged bundle): output is
    // accumulated as chunks in an array and NEVER random-accessed. Trailing
    // context is tracked incrementally in O(1) — `lastChar` (last emitted
    // char) and `tail` (trailing identifier run). The previous version kept
    // `out` as a growing string and inspected its tail per token; every
    // charCodeAt/index access forced V8 to re-flatten the cons-string chain,
    // an O(n²) trap that pushed minification past the 30 s harness ceiling.
    try {
      const n = code.length;
      const KEYWORDS_ASI = new Set(['return', 'break', 'continue', 'yield']);
      const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await']);
      const PUNCT_BEFORE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^']);
      const parts = [];
      let tail = '';
      let lastChar = '';
      let i = 0;
      let pendingSpace = false;
      let pendingNewline = false;
      const isWord = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 36 || c === 95;
      const push = (s) => {
        if (!s) return;
        parts.push(s);
        lastChar = s[s.length - 1];
        for (let k = 0; k < s.length; k += 1) {
          if (isWord(s.charCodeAt(k))) tail += s[k];
          else tail = '';
        }
        if (tail.length > 96) tail = tail.slice(tail.length - 96);
      };
      const regexAllowed = () => {
        if (parts.length === 0) return true;
        const prev = lastChar;
        if (PUNCT_BEFORE_REGEX.has(prev)) return true;
        if (/[A-Za-z0-9_$)\]'"]/.test(prev)) return KEYWORDS_BEFORE_REGEX.has(tail);
        return false;
      };
      const flushSpace = (nextCh) => {
        if (!pendingSpace) return;
        pendingSpace = false;
        const nl = pendingNewline;
        pendingNewline = false;
        if (nl && KEYWORDS_ASI.has(tail)) { push(';'); return; }
        if (nextCh === '}' || nextCh === ')' || nextCh === ';' || nextCh === ',') return;
        const prev = lastChar;
        if (prev === ';' || prev === '{' || prev === ',' || prev === '(' || prev === '[') return;
        // Line terminator is load-bearing (see header comment): preserve '\n'
        // whenever the run contained one and no drop-guard above applied.
        if (nl) { push('\n'); return; }
        push(' ');
      };
      const scanString = (quote) => {
        // Verbatim scan to the closing quote; emitted as ONE chunk so literal
        // interiors (URLs, punctuation, spaces) are untouchable by design.
        let j = i + 1;
        while (j < n) {
          const c = code[j];
          if (c === '\\') { j += 2; continue; }
          if (c === quote) { j += 1; break; }
          j += 1;
        }
        push(code.slice(i, Math.min(j, n)));
        i = j;
      };
      while (i < n) {
        const ch = code[i];
        const next = i + 1 < n ? code[i + 1] : '';
        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
          if (ch === '\n') pendingNewline = true;
          pendingSpace = true; i += 1; continue;
        }
        if (ch === '/' && next === '/') {
          while (i < n && code[i] !== '\n') i += 1;
          pendingSpace = true; continue;
        }
        if (ch === '/' && next === '*') {
          i += 2;
          while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
            if (code[i] === '\n') pendingNewline = true;
            i += 1;
          }
          i = Math.min(n, i + 2);
          pendingSpace = true; continue;
        }
        if (ch === '\'' || ch === '"') { flushSpace(ch); scanString(ch); continue; }
        if (ch === '`') {
          // Template literal: verbatim scan with escape support; ${…}
          // interpolations keep brace depth so nested strings stay intact.
          flushSpace('`');
          push('`'); i += 1;
          let depth = 0;
          while (i < n) {
            const c = code[i];
            if (c === '\\') { push(c); i += 1; if (i < n) { push(code[i]); i += 1; } continue; }
            if (depth === 0) {
              if (c === '`') { push(c); i += 1; break; }
              if (c === '$' && code[i + 1] === '{') { push('${'); i += 2; depth = 1; continue; }
              push(c); i += 1; continue;
            }
            if (c === '\'' || c === '"') { scanString(c); continue; }
            if (c === '`') { scanString('`'); continue; }
            if (c === '{') { depth += 1; push(c); i += 1; continue; }
            if (c === '}') { depth -= 1; push(c); i += 1; continue; }
            push(c); i += 1;
          }
          continue;
        }
        if (ch === '/' && next !== '/' && next !== '*' && regexAllowed()) {
          // Regex literal: verbatim scan honoring character classes.
          flushSpace('/');
          push('/'); i += 1;
          let inClass = false;
          while (i < n) {
            const c = code[i];
            push(c); i += 1;
            if (c === '\\') { if (i < n) { push(code[i]); i += 1; } continue; }
            if (c === '[') { inClass = true; continue; }
            if (c === ']') { inClass = false; continue; }
            if (c === '/' && !inClass) break;
            if (c === '\n') break;
          }
          while (i < n && /[a-z]/i.test(code[i])) { push(code[i]); i += 1; }
          continue;
        }
        flushSpace(ch);
        push(ch); i += 1;
      }
      return parts.join('').trim();
    } catch (err) {
      this.warn(`Minification failed: ${err.message}`);
      return code;
    }
  },

  getFileHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let hash = 0;

    for (let i = 0; i < content.length; i += 1) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }

    return hash.toString(16);
  },

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.log(`Created directory: ${dirPath}`);
    }
  },

  getFileSizeKB(filePath) {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2);
  },

  backupFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const backupPath = `${filePath}.backup`;
    fs.copyFileSync(filePath, backupPath);
    this.log(`Backed up: ${path.basename(filePath)} -> ${path.basename(backupPath)}`);
  }
};

utils.parseUserScriptHeader = utils.parseUserScriptHeader.bind(utils);
utils.buildMergedHeader = utils.buildMergedHeader.bind(utils);
utils.defaultHeader = defaultHeader;
utils.getModuleFiles = utils.getModuleFiles.bind(utils);
utils.getModuleFilesRecursive = utils.getModuleFilesRecursive.bind(utils);

module.exports = utils;
