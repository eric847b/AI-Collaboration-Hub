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
    try {
      let minified = code.replace(/\/\/[^\n]*/g, '');
      minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
      minified = minified.replace(/\s+/g, ' ');
      minified = minified.replace(/\s*([{};,=+\-*/<>!&|?:])\s*/g, '$1');
      return minified.trim();
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
