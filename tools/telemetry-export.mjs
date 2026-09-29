#!/usr/bin/env node
/**
 * telemetry-export — loopback bridge from the browser to the telemetry sink.
 *
 * The runtime hook (`<app>/src/lib/telemetry.ts`) keeps its ring buffer in
 * `localStorage["telemetry:errors"]` and stays local-only unless an endpoint
 * is configured. That is the right default for public builds, but it leaves a
 * gap: in dev the buffered errors never reach `telemetry-collector` unless you
 * remember to set `window.TELEMETRY_ENDPOINT` before they happen. This tool
 * closes the gap WITHOUT changing the hook: one fetch line in the devtools
 * console (or a bookmarklet) pushes everything that has accumulated — including
 * errors from previous sessions — into the collector's JSONL sink.
 *
 * It reuses `telemetry-collector.mjs` wholesale: validation, per-app rate
 * limiting, de-duplication and the sink live there, so this file adds only
 * translation (localStorage dump -> batch) and a loopback HTTP surface.
 *
 *   node tools/telemetry-export.mjs serve [--port <n>] [--out <file>] [--app <id>]
 *       Loopback bridge. POST raw localStorage["telemetry:errors"] (a JSON
 *       array, or a full {appId, entries[]} batch) to http://127.0.0.1:<port>/
 *       and it is wrapped + ingested into the collector sink. GET / prints the
 *       exact console snippet; GET /healthz for probes. Binds 127.0.0.1 only.
 *   node tools/telemetry-export.mjs push --file <dump.json> [--app <id>]
 *       Offline path: same payloads read from a file (DevTools -> copy value ->
 *       save), ingested once, result printed. No network at all.
 *   node tools/telemetry-export.mjs snippet [--port <n>] [--app <id>]
 *       Print the one-liner to paste into the app's devtools console.
 *   node tools/telemetry-export.mjs --self-test | --help
 *
 * Safety: loopback bind is not configurable; CORS defaults to the local Vite
 * origins, extendable with --allow-origin. Entries keep the hook's own caps;
 * anything the hook could not have produced is rejected by the collector.
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { PayloadError, createCollector, parseArgs } from './telemetry-collector.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const DEFAULT_PORT = 8790;
const APP_ID_FALLBACK = 'export-bridge';
const DEFAULT_ALLOW = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
];

/** Standalone error for bridge-level problems (distinct from collector 400s). */
export class ExportError extends Error {}

function usage() {
  return [
    'telemetry-export — push the browser localStorage telemetry buffer into the collector sink',
    '',
    'Usage:',
    '  node tools/telemetry-export.mjs serve [--port <n>] [--out <file>] [--app <id>]',
    `      [--max-body <bytes>] [--allow-origin <origin>]...   (default port ${DEFAULT_PORT})`,
    '  node tools/telemetry-export.mjs push --file <dump.json> [--out <file>] [--app <id>] [--json]',
    '  node tools/telemetry-export.mjs snippet [--port <n>] [--app <id>] [--storage-key <key>]',
    '  node tools/telemetry-export.mjs --self-test | --help',
    '',
    'Payloads accepted (POST body or --file): a JSON array of entries straight from',
    'localStorage["telemetry:errors"], or a full {appId, version, sentAt, entries[]} batch.',
    `Arrays need an appId from the batch or --app (default "${APP_ID_FALLBACK}").`,
    'Everything is validated/deduped by telemetry-collector before hitting the sink.',
  ].join('\n');
}


function intIn(raw, min, max, flag) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ExportError(`${flag} expects an integer ${min}..${max}`);
  return n;
}

/**
 * Collector defaults (sink path, budgets) layered with bridge-specific flags.
 * parseArgs(['serve']) supplies defaults only; every flag here is owned by the
 * bridge so an unknown one fails fast instead of silently hitting the network.
 */
export function parseExportArgs(argv) {
  const opts = parseArgs(['serve']);
  const rest = argv.slice();
  const mode = rest.shift() ?? 'serve';
  opts.mode = ['serve', 'push', 'snippet'].includes(mode) ? mode : null;
  opts.port = DEFAULT_PORT;
  opts.allowOrigin = [...DEFAULT_ALLOW];
  opts.app = null;
  opts.file = null;
  opts.json = false;
  opts.storageKey = 'telemetry:errors';
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    const next = () => {
      const v = rest[i + 1];
      if (v === undefined) throw new ExportError(`${flag} requires a value`);
      i += 1;
      return v;
    };
    switch (flag) {
      case '--port': opts.port = intIn(next(), 1, 65535, flag); break;
      case '--out': opts.out = next(); break;
      case '--app': opts.app = next(); break;
      case '--file': opts.file = next(); break;
      case '--allow-origin': opts.allowOrigin.push(next()); break;
      case '--storage-key': opts.storageKey = next(); break;
      case '--max-body': opts.maxBody = intIn(next(), 1024, 64 * 1024 * 1024, flag); break;
      case '--max-entries': opts.maxEntries = intIn(next(), 1, 10000, flag); break;
      case '--max-events-per-min': opts.maxEventsPerMin = intIn(next(), 1, 100000, flag); break;
      case '--dedupe-window': opts.dedupeWindow = intIn(next(), 0, 3600, flag); break;
      case '--json': opts.json = true; break;
      case '--host': throw new ExportError('--host is not supported: the bridge always binds 127.0.0.1');
      default:
        if (flag.startsWith('--')) throw new ExportError(`unknown flag: ${flag}`);
        throw new ExportError(`unexpected argument: ${flag}`);
    }
  }
  if (!opts.mode) throw new ExportError(`unknown command: ${mode} (try --help)`);
  if (opts.mode === 'push' && !opts.file) throw new ExportError('push requires --file <dump.json>');
  return opts;
}

/**
 * Translate a localStorage dump into the collector's batch wire format.
 * Accepts a bare entries array (localStorage value) or a pre-wrapped batch;
 * appId precedence: batch body -> --app -> APP_ID_FALLBACK.
 */
export function wrapDump(text, { app = null } = {}) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ExportError('payload is not valid JSON (expected the localStorage array or a batch object)');
  }
  const isArray = Array.isArray(raw);
  const asBatch = !isArray && raw !== null && typeof raw === 'object';
  if (!isArray && !asBatch) throw new ExportError('payload must be a JSON array or an {appId, entries[]} object');
  const entries = isArray ? raw : raw.entries;
  if (!Array.isArray(entries)) throw new ExportError('payload must contain an entries array');
  const appId = (asBatch && typeof raw.appId === 'string' && raw.appId.length > 0)
    ? raw.appId
    : (app && app.length > 0 ? app : APP_ID_FALLBACK);
  return JSON.stringify({
    appId,
    version: asBatch && typeof raw.version === 'string' ? raw.version : null,
    sentAt: new Date().toISOString(),
    entries,
  });
}

/** The exact snippet a developer pastes into the running app's devtools console. */
export function buildSnippet({ port = DEFAULT_PORT, storageKey = 'telemetry:errors' } = {}) {
  return [
    `fetch('http://127.0.0.1:${port}/', {`,
    `  method: 'POST',`,
    `  headers: { 'Content-Type': 'text/plain' },`,
    `  body: localStorage.getItem('${storageKey}') || '[]',`,
    `}).then((r) => r.json()).then((r) => console.log('telemetry-export:', r))`,
  ].join(' ');
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(`${JSON.stringify(payload)}\n`);
}

/**
 * HTTP surface (all bodies are JSON unless noted):
 *   POST /        localStorage dump -> wrap -> collector.ingest (202/400/429)
 *   GET  /        the console snippet, plain text (so `curl` is self-documenting)
 *   GET  /healthz liveness probe
 *   OPTIONS *     CORS preflight for allow-listed dev origins
 */
export function createExportHandler({ collector, options }) {
  const allow = new Set(options.allowOrigin);
  return function handle(req, res) {
    const origin = req.headers.origin ?? null;
    const corsOk = origin === null || allow.has(origin) || allow.has('*');
    if (req.method === 'OPTIONS') {
      if (origin !== null && corsOk) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'content-type');
        res.setHeader('Access-Control-Max-Age', '600');
      }
      res.writeHead(204);
      res.end();
      return;
    }
    if (origin !== null && corsOk) res.setHeader('Access-Control-Allow-Origin', origin);
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'GET' && url === '/healthz') {
      json(res, 200, { ok: true, service: 'telemetry-export', sink: collector.outPath });
      return;
    }
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`${buildSnippet({ port: options.port, storageKey: options.storageKey })}\n`);
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST / with the localStorage telemetry array (or GET / for the snippet)' });
      return;
    }
    if (!corsOk) {
      json(res, 403, { ok: false, error: `origin not allowed: ${origin} (extend with --allow-origin)` });
      return;
    }
    let body = '';
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > options.maxBody) {
        aborted = true;
        json(res, 413, { ok: false, error: 'payload exceeds --max-body' });
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const wrapped = wrapDump(body, { app: options.app });
        const result = collector.ingest(wrapped, { origin });
        json(res, result.status, result.payload);
      } catch (e) {
        if (e instanceof ExportError || e instanceof PayloadError) {
          json(res, 400, { ok: false, error: e.message });
          return;
        }
        throw e;
      }
    });
  };
}

export function startExportServer(options) {
  const collector = createCollector(options);
  const server = http.createServer(createExportHandler({ collector, options }));
  return new Promise((resolve) => {
    // Loopback-only by construction: the bind address is never configurable.
    server.listen(options.port, '127.0.0.1', () => {
      const at = server.address();
      console.log(`telemetry-export: listening on http://127.0.0.1:${at.port}/ -> ${collector.outPath}`);
      console.log('telemetry-export: POST the localStorage["telemetry:errors"] value; GET / prints the snippet. Ctrl+C to stop.');
      resolve(server);
    });
  });
}

/** Shared push core: file text -> wrap -> ingest. Returns the ingest result. */
export function pushDump(text, options) {
  const collector = createCollector(options);
  const wrapped = wrapDump(text, { app: options.app });
  const result = collector.ingest(wrapped, { origin: 'file-export' });
  return { result, sink: collector.outPath };
}

export function runPush(options) {
  const file = path.resolve(ROOT, options.file);
  if (!fs.existsSync(file)) throw new ExportError(`--file not found: ${file}`);
  const { result, sink } = pushDump(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), options);
  if (options.json) console.log(JSON.stringify({ ...result.payload, sink }));
  else {
    console.log(`telemetry-export: ${result.status === 202 ? 'ingested' : 'rejected'} via ${path.relative(ROOT, file)}`);
    console.log(`  sink    : ${path.relative(ROOT, sink)}`);
    console.log(`  payload : ${JSON.stringify(result.payload)}`);
  }
  return result.status === 202 ? 0 : 1;
}


// ---- self-test -------------------------------------------------------------

function entry(message, kind = 'error', pathName = '/selftest') {
  return { ts: new Date().toISOString(), kind, message, path: pathName };
}

/**
 * Offline contract test: tmp-dir sink, ephemeral loopback port, no external
 * network. Mirrors telemetry-collector's own self-test style so both files can
 * be verified with `npm run tools:verify` without touching the real sink.
 */
export async function runSelfTest() {
  const results = [];
  const check = (name, ok) => { results.push([name, ok === true]); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'telex-'));
  const baseOpts = parseArgs(['serve']);
  baseOpts.out = path.join(tmp, 'events.jsonl');
  baseOpts.dedupeWindow = 60;
  baseOpts.maxEventsPerMin = 500;
  baseOpts.maxBody = 64 * 1024;
  baseOpts.allowOrigin = [...DEFAULT_ALLOW];
  baseOpts.app = null;
  baseOpts.port = 0;
  baseOpts.storageKey = 'telemetry:errors';

  // -- wrapping ---------------------------------------------------------------
  const wrappedArray = JSON.parse(wrapDump(JSON.stringify([entry('boom'), entry('meh', 'console')]), { app: 'nexus' }));
  check('bare array wraps with --app id', wrappedArray.appId === 'nexus' && wrappedArray.entries.length === 2);
  check('wrap adds sentAt', typeof wrappedArray.sentAt === 'string' && wrappedArray.sentAt.length > 0);
  const wrappedBatch = JSON.parse(wrapDump(JSON.stringify({ appId: 'dash', version: '9.9', entries: [entry('x')] })));
  check('batch passthrough keeps appId+version', wrappedBatch.appId === 'dash' && wrappedBatch.version === '9.9');
  check('array without --app falls back', JSON.parse(wrapDump('[]')).appId === APP_ID_FALLBACK);
  const badThrows = ['nope', '{"entries":42}', '"a string"', '{"appId":"x"}']
    .every((bad) => { try { wrapDump(bad); return false; } catch (e) { return e instanceof ExportError; } });
  check('malformed payloads throw ExportError', badThrows);

  // -- ingest through the shared collector -------------------------------------
  const collector = createCollector(baseOpts);
  const r1 = collector.ingest(wrapDump(JSON.stringify([entry('first')])), {});
  check('first export accepted', r1.status === 202 && r1.payload.accepted === 1);
  const r2 = collector.ingest(wrapDump(JSON.stringify([entry('first')])), {});
  check('repeat suppressed as duplicate', r2.status === 202 && r2.payload.accepted === 0 && r2.payload.duplicates === 1);
  const r3 = collector.ingest(wrapDump(JSON.stringify([entry('mixed'), { kind: 'bogus', message: 'x' }])), {});
  check('invalid entries dropped, valid kept', r3.status === 202 && r3.payload.accepted === 1 && r3.payload.dropped === 1);
  const r4 = collector.ingest(wrapDump(JSON.stringify([{ kind: 'error', message: '' }])), {});
  check('all-invalid batch rejected 400', r4.status === 400);
  const lines = fs.readFileSync(baseOpts.out, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  check('sink holds accepted events only', lines.length === 2);
  check('sink lines carry appId', lines.every((l) => JSON.parse(l).appId === APP_ID_FALLBACK));

  // -- rate limiting flows through the bridge ----------------------------------
  const tightOpts = { ...baseOpts, out: path.join(tmp, 'tight.jsonl'), maxEventsPerMin: 2, dedupeWindow: 0 };
  const tight = createCollector(tightOpts);
  const ok1 = tight.ingest(wrapDump(JSON.stringify([entry('r1')])));
  const ok2 = tight.ingest(wrapDump(JSON.stringify([entry('r2')])));
  const limited = tight.ingest(wrapDump(JSON.stringify([entry('r3')])));
  check('budget admits two', ok1.status === 202 && ok2.status === 202);
  check('third batch rate-limited 429', limited.status === 429);

  // -- HTTP surface (loopback, ephemeral port) ---------------------------------
  const server = http.createServer(createExportHandler({ collector, options: { ...baseOpts, port: DEFAULT_PORT } }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const health = await fetch(`http://127.0.0.1:${port}/healthz`).then((r) => r.json());
  check('healthz ok', health.ok === true && health.service === 'telemetry-export');
  const snippetRes = await fetch(`http://127.0.0.1:${port}/`);
  const snippetText = await snippetRes.text();
  check('GET / returns console snippet', snippetRes.status === 200 && snippetText.includes("localStorage.getItem('telemetry:errors')"));
  const post = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Origin: 'http://localhost:5173' },
    body: JSON.stringify([entry('from-browser')]),
  });
  const postBody = await post.json();
  check('POST localStorage array ingested', post.status === 202 && postBody.accepted === 1);
  const cors = await fetch(`http://127.0.0.1:${port}/`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
  check('preflight answered 204', cors.status === 204);
  const evil = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', headers: { Origin: 'http://evil.example' }, body: '[]' });
  check('unknown origin rejected 403', evil.status === 403);
  const method405 = await fetch(`http://127.0.0.1:${port}/`, { method: 'PUT', body: '[]' });
  check('PUT rejected 405', method405.status === 405);
  server.close();

  // -- flag hygiene -------------------------------------------------------------
  const hostReject = (() => { try { parseExportArgs(['serve', '--host', '0.0.0.0']); return false; } catch (e) { return e instanceof ExportError; } })();
  check('--host override refused (loopback-only)', hostReject);
  const pushRequiresFile = (() => { try { parseExportArgs(['push']); return false; } catch (e) { return e instanceof ExportError; } })();
  check('push without --file refused', pushRequiresFile);

  fs.rmSync(tmp, { recursive: true, force: true });
  const passed = results.filter(([, ok]) => ok).length;
  for (const [name, ok] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  console.log(`telemetry-export self-test: ${passed}/${results.length} passed`);
  return passed === results.length ? 0 : 1;
}

// ---- main ------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return 0;
  }
  if (argv.includes('--self-test')) return runSelfTest();
  let options;
  try {
    options = parseExportArgs(argv);
  } catch (e) {
    if (e instanceof ExportError) {
      console.error(`telemetry-export: ${e.message}`);
      return 2;
    }
    throw e;
  }
  if (options.mode === 'snippet') {
    console.log(buildSnippet({ port: options.port, storageKey: options.storageKey }));
    return 0;
  }
  if (options.mode === 'push') return runPush(options);
  await startExportServer(options);
  return 0; // keep the event loop alive; Ctrl+C to stop
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => { if (code !== 0) process.exitCode = code; }).catch((err) => {
    console.error(`telemetry-export: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  });
}


