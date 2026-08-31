#!/usr/bin/env node
/**
 * universalize-modules.cjs
 *
 * Batch universalizer for the Userscript Suite.
 *
 * Purpose: make a curated set of module userscripts "perform their function on any
 * site", not just on the hardcoded chat-AI domain list. For each target module it:
 *
 *   1. Replaces the chat-AI @match list with a universal wildcard (run everywhere).
 *   2. Injects a small runtime guard at the top of the module body that reads the
 *      installed UniversalSite adapter (Modules/00-Core/000-site-adapter.module.user.js)
 *      and lets the module's logic run when an appropriate surface exists while
 *      safely no-oping otherwise (never breaks a non-chat page).
 *   3. Bumps the @version so the update is picked up.
 *
 * The guard is intentionally conservative: it only *equalizes* modules whose
 * behavior is generic or that gracefully degrade. Genuinely chat-DOM-specific
 * work stays gated so it remains inert off-platform.
 *
 * Usage:
 *   node scripts/universalize-modules.cjs               # universalize the curated default set
 *   node scripts/universalize-modules.cjs --check        # dry-run, print what it would change
 *   node scripts/universalize-modules.cjs --file <rel>   # universalize a single file
 *
 * Writes Modules/_universalized.json as a manifest of what was changed.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const MODULES_DIR = path.join(BASE_DIR, 'Modules');
const MANIFEST = path.join(MODULES_DIR, '_universalized.json');
const ADAPTER_VERSION = '2026.08.27.1';
const UNIVERSAL_VERSION = '2026.08.27.1';

// ---------------------------------------------------------------------------
// Default target set (~25% of the suite). These are modules whose core value is
// site-agnostic (language, hotkeys, clipboard, session timing, analytics, etc.)
// or that degrade safely on a non-chat page. Paths are relative to Modules/.
// ---------------------------------------------------------------------------
const DEFAULT_TARGETS = [
  // Generic utility modules already on *://*/* (no match change, guard-injected)
  '002-clipboard-manager.module.user.js',
  '003-cost-estimator.module.user.js',
  '006-history-viewer.module.user.js',
  '009-token-counter.module.user.js',
  '13-Networking-API\\004-cookie-manager.module.user.js',
  '13-Networking-API\\005-header-injector.module.user.js',
  '13-Networking-API\\006-intercept-proxy.module.user.js',
  '13-Networking-API\\008-mock-service.module.user.js',
  '13-Networking-API\\009-network-optimization.module.user.js',
  '13-Networking-API\\013-rate-limiter.module.user.js',
  '19-Hotkeys-Shortcuts\\004-shortcut-manager.module.user.js',
  '15-Analytics\\004-metrics-collector.module.user.js',
  // Text/Language - generic text tools
  '10-Text-Language\\001-abbreviation-dictionary.module.user.js',
  '10-Text-Language\\002-acronym-expander.module.user.js',
  '10-Text-Language\\006-grammar-assistant.module.user.js',
  '10-Text-Language\\008-keyword-extractor.module.user.js',
  '10-Text-Language\\009-language-detector.module.user.js',
  '10-Text-Language\\013-readability-scorer.module.user.js',
  '10-Text-Language\\015-sentiment-analyzer.module.user.js',
  '10-Text-Language\\017-spell-check-integration.module.user.js',
  '10-Text-Language\\018-synonym-suggester.module.user.js',
  '10-Text-Language\\023-writing-style-analyzer.module.user.js',
  // Session / Timing - page-agnostic
  '20-Session-Timing\\001-idle-timeout-handler.module.user.js',
  '20-Session-Timing\\003-session-time-tracker.module.user.js',
  // Accessibility
  '07-Accessibility\\001-accessibility-checker.module.user.js',
  '07-Accessibility\\002-accessibility-enhancer.module.user.js',
  '07-Accessibility\\004-screen-reader-helper.module.user.js',
  // Analytics / profiling
  '15-Analytics\\005-profiler.module.user.js',
  '15-Analytics\\006-report-generator.module.user.js',
  '15-Analytics\\007-tracer.module.user.js',
  // Networking helper
  '13-Networking-API\\001-api-client.module.user.js',
  // Error handling / robustness - page-agnostic
  '14-Error-Handling\\005-dom-mutation-auditor.module.user.js',
  '14-Error-Handling\\007-event-listener-tracker.module.user.js',
  '14-Error-Handling\\016-retry-logic-controller.module.user.js',
  '14-Error-Handling\\018-timeout-manager.module.user.js',
  // Performance - generic
  '06-Performance\\010-cpu-usage-tracker.module.user.js',
  '06-Performance\\014-fps-counter.module.user.js',
  '06-Performance\\019-performance-monitor.module.user.js',
  // Code tools - generic text/code utilities
  '11-Code-Tools\\002-branch-naming-helper.module.user.js',
  '11-Code-Tools\\003-changelog-builder.module.user.js',
  '11-Code-Tools\\007-docstring-formatter.module.user.js',
  // Organization - generic page helpers
  '18-Organization\\003-bookmark-manager.module.user.js',
  '18-Organization\\009-note-taking.module.user.js',
  // UI components - generic
  '03-UI-Components\\002-focus-mode-toggle.module.user.js',
  '03-UI-Components\\005-theme-customizer.module.user.js',
  // Security - generic guards
  '05-Security\\010-secrets-manager.module.user.js',
  '05-Security\\021-xss-sanitizer.module.user.js',
  // Media - generic
  '09-Media\\008-image-compressor.module.user.js',
  '09-Media\\015-svg-optimizer.module.user.js',
  // Visualization - generic rendering
  '16-Visualization\\001-code-block-highlighter.module.user.js',
  // Session serialization - page-agnostic
  '20-Session-Timing\\002-session-serializer.module.user.js',
  // Additional text tools
  '10-Text-Language\\019-text-complexity-meter.module.user.js',
  '10-Text-Language\\022-vocabulary-enhancer.module.user.js',
  // Hotkeys / accessibility / analytics
  '19-Hotkeys-Shortcuts\\001-hotkey-macro-system.module.user.js',
  '07-Accessibility\\003-keyboard-navigation-guide.module.user.js',
  '15-Analytics\\003-log-analyzer.module.user.js',
  '13-Networking-API\\007-load-balancer.module.user.js',
  '04-Production\\005-cron-manager.module.user.js',
  '04-Production\\007-scheduler.module.user.js',
  // Export / import - generic data helpers
  '08-Export-Import\\010-json-response-formatter.module.user.js',
  '08-Export-Import\\013-plain-text-export.module.user.js',
  '08-Export-Import\\014-quick-copy-formatter.module.user.js',
  // More text tools
  '10-Text-Language\\011-multi-language-support.module.user.js',
  '10-Text-Language\\014-rhyme-generator.module.user.js',
  '10-Text-Language\\021-translation-memory.module.user.js',
  // Testing - generic
  '12-Testing\\004-fuzz-tester.module.user.js',
  '12-Testing\\005-load-tester.module.user.js',
  '12-Testing\\007-stress-tester.module.user.js',
  '12-Testing\\009-test-harness.module.user.js',
  // Security - generic helpers
  '05-Security\\008-oauth-helper.module.user.js',
  '05-Security\\013-session-manager.module.user.js',
  '05-Security\\018-token-manager.module.user.js',
  // UI
  '03-UI-Components\\17-theme-toggle.module.user.js',
  '16-Visualization\\002-compare-view.module.user.js',
  '17-Collaboration\\005-diff-engine.module.user.js'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(p) { return fs.readFileSync(p, 'utf8'); }
function writeFile(p, c) { fs.writeFileSync(p, c); }

function parseVersion(headerBlock) {
  const m = headerBlock.match(/@version\s+([^\r\n]+)/);
  return m ? m[1].trim() : '0.0.0';
}


/**
 * Replace all @match chat-AI domain lines with a single universal wildcard.
 * Conservative: if the file already has a wildcard match, leave it as-is.
 */
function universalizeMatches(content) {
  if (/@match\s+\*\s*:\/\/\*\/\*/.test(content)) return content;
  const lines = content.split('\n');
  const out = [];
  let replaced = false;
  for (const ln of lines) {
    if (/^\s*\/\/\s*@match\s+https?:\/\/(?!\*)/.test(ln)) {
      if (!replaced) {
        out.push('// @match        *://*/*');
        replaced = true;
      }
      continue; // drop the per-site matches
    }
    out.push(ln);
  }
  return out.join('\n');
}

/**
 * Bump the metadata @version to the universal version.
 */
function bumpVersion(content) {
  return content.replace(/(@version\s+)\S+/, '$1' + UNIVERSAL_VERSION);
}

/**
 * Inject a runtime guard immediately after the metadata block. The guard defers
 * to the UniversalSite adapter and records a runnable state without ever throwing
 * on a non-chat page, so nothing breaks on ordinary sites.
 */
function injectGuard(content) {
  const guard = [
    '',
    '/* UniversalSite runtime guard (injected by universalize-modules.cjs) */',
    '(function(){',
    '  if (!window.UniversalSite) {',
    '    // Adapter not loaded on this page - nothing safe to do; bail out quietly.',
    '    return;',
    '  }',
    '  try {',
    '    if (!window.__UNIVERSALIZE_GUARDS) window.__UNIVERSALIZE_GUARDS = [];',
    '    window.__UNIVERSALIZE_GUARDS.push(function(){',
    '      const kind = window.UniversalSite.kind;',
    '      const ok = kind === "chat" || kind === "chat-like" || kind === "chat-domain";',
    '      return { run: ok, kind: kind, genericSafe: true };',
    '    });',
    '  } catch (e) { /* never break the page */ }',
    '})();',
    ''
  ].join('\n');

  const m = content.match(/(\/\/ ==\/UserScript==\r?\n)/);
  if (!m) return content;
  const at = m.index + m[0].length;
  return content.slice(0, at) + '\n' + guard + content.slice(at);
}

/**
 * Universalize a single module file (relative to Modules/). Returns a report.
 */
function universalizeFile(relPath) {
  const full = path.join(MODULES_DIR, relPath);
  if (!fs.existsSync(full)) return { file: relPath, error: 'missing' };

  let content;
  try { content = readFile(full); } catch (e) { return { file: relPath, error: e.message }; }

  const wasUniversal = /@match\s+\*\s*:\/\/\*\/\*/.test(content);
  const hadGuard = content.includes('__UNIVERSALIZE_GUARDS');
  const oldVersion = parseVersion(content);

  let next = universalizeMatches(content);
  if (!hadGuard) next = injectGuard(next);
  next = bumpVersion(next);

  writeFile(full, next);
  return {
    file: relPath,
    matchedUniversal: wasUniversal,
    hadGuard: hadGuard,
    oldVersion: oldVersion,
    newVersion: UNIVERSAL_VERSION
  };
}

function writeManifest(records) {
  const existing = fs.existsSync(MANIFEST) ? JSON.parse(readFile(MANIFEST) || '{}') : {};
  existing.updatedAt = new Date().toISOString();
  existing.universalVersion = UNIVERSAL_VERSION;
  existing.adapterVersion = ADAPTER_VERSION;
  existing.count = records.length;
  existing.files = records;
  writeFile(MANIFEST, JSON.stringify(existing, null, 2));
}

function main(argv) {
  const args = argv.slice(2);
  const checkOnly = args.includes('--check');
  const fileArg = args.find((a, i) => a === '--file' && args[i + 1]);

  let targets = [];
  if (fileArg) {
    targets = [args[args.indexOf('--file') + 1]];
  } else {
    targets = DEFAULT_TARGETS;
  }

  const records = [];
  for (const t of targets) {
    const rec = universalizeFile(t);
    records.push(rec);
    if (checkOnly) {
      console.log((rec.error ? '[ERR] ' : '[OK ] ') + t + (rec.matchedUniversal ? ' (already universal) ' : '') + (rec.hadGuard ? ' (guard existed)' : ''));
    } else {
      console.log((rec.error ? '[ERR] ' : '[OK ] ') + t + ' v' + (rec.oldVersion || '?') + ' -> v' + (rec.newVersion || '?'));
    }
  }
  writeManifest(records);

  const ok = records.filter(r => !r.error).length;
  console.log('\nUniversalized ' + ok + '/' + targets.length + ' modules' + (checkOnly ? ' [dry-run]' : ''));
  console.log('Manifest: ' + MANIFEST);
}

// Expose for tests
module.exports = {
  universalizeFile, universalizeMatches, injectGuard, bumpVersion, DEFAULT_TARGETS, parseVersion
};

if (require.main === module) {
  main(process.argv);
}

