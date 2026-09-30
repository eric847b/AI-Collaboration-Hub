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
 *   node tools/telemetry-export.mjs sync-fleet --into <dir> [--app <id>] [--commit]
 *       Batch channel for the ephemeral GitHub Actions fleet: groups the whole
 *       collector sink into one {appId, entries[]} batch per app and writes
 *       telemetry-<stamp>-<n>events.json into --into (a directory OUTSIDE this
 *       repo — typically the autonomous-github-agent clone). --commit records
 *       the file there locally; the push is ALWAYS left to resilient-git.
 *   node tools/telemetry-export.mjs --self-test | --help
 *
 * Safety: loopback bind is not configurable; CORS defaults to the local Vite
 * origins, extendable with --allow-origin. Entries keep the hook's own caps;
 * anything the hook could not have produced is rejected by the collector.
 * sync-fleet never touches the network and refuses in-repo --into targets.
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
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
    '  node tools/telemetry-export.mjs dump --into <dumpfile> [--out <sink>] [--app <id>] [--json]',
    '      (JSONL sink -> re-ingestible batch dump; feed it back via push --file)',
    '  node tools/telemetry-export.mjs sync-fleet --into <dir> [--out <sink>] [--app <id>] [--commit] [--json]',
    '      (ship the whole sink to a fleet inbox as batch files; push stays with resilient-git)',
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
  opts.mode = ['serve', 'push', 'snippet', 'dump', 'sync-fleet'].includes(mode) ? mode : null;
  opts.port = DEFAULT_PORT;
  opts.allowOrigin = [...DEFAULT_ALLOW];
  opts.app = null;
  opts.file = null;
  opts.into = null;
  opts.commit = false;
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
      case '--into': opts.into = next(); break;
      case '--commit': opts.commit = true; break;
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
  if (opts.mode === 'sync-fleet' && !opts.into) throw new ExportError('sync-fleet requires --into <fleet inbox dir>');
  if (opts.mode === 'dump' && !opts.into) throw new ExportError('dump requires --into <dumpfile>');
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
  // A dump file (or a sync-fleet batch file) is an ARRAY of {appId, entries[]}
  // batches — ingest each through the same collector so validation, rate-limit
  // and dedupe span the whole file exactly as they would per HTTP POST.
  let raw = null;
  try { raw = JSON.parse(text); } catch { /* wrapDump reports the canonical error */ }
  const isBatchList = Array.isArray(raw) && raw.length > 0
    && raw.every((b) => b && typeof b === 'object' && !Array.isArray(b)
      && Array.isArray(b.entries) && typeof b.appId === 'string' && b.appId.length > 0);
  if (isBatchList) {
    let status = 202;
    const payload = { ok: true, batches: raw.length, accepted: 0, duplicates: 0, dropped: 0 };
    for (const batch of raw) {
      const r = collector.ingest(JSON.stringify(batch), { origin: 'file-export' });
      if (r.status !== 202) {
        status = r.status;
        payload.ok = false;
        payload.error = r.payload && r.payload.error;
        break;
      }
      payload.accepted += r.payload.accepted ?? 0;
      payload.duplicates += r.payload.duplicates ?? 0;
      payload.dropped += r.payload.dropped ?? 0;
    }
    return { result: { status, payload }, sink: collector.outPath };
  }
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

/**
 * Group sink events into re-ingestible collector batches, one per appId.
 * Malformed lines are skipped (a corrupt sink line must never block a ship);
 * entries keep exactly the keys the hook emits so the fleet's own collector
 * copy validates them unchanged. --app narrows the shipment to one app.
 */
export function buildFleetBatches(sinkText, { app = null } = {}) {
  const byApp = new Map();
  for (const line of String(sinkText || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== 'object') continue;
    const appId = typeof e.appId === 'string' && e.appId.length > 0 ? e.appId : APP_ID_FALLBACK;
    if (app && appId !== app) continue;
    if (!byApp.has(appId)) byApp.set(appId, []);
    const ent = {
      ts: typeof e.ts === 'string' ? e.ts : (typeof e.receivedAt === 'string' ? e.receivedAt : new Date(0).toISOString()),
      kind: e.kind || 'error',
      message: typeof e.message === 'string' ? e.message : String(e.message ?? ''),
      path: e.path || '/',
    };
    if (typeof e.stack === 'string' && e.stack) ent.stack = e.stack;
    byApp.get(appId).push(ent);
  }
  return [...byApp.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([appId, entries]) => ({ appId, version: null, sentAt: new Date().toISOString(), entries }));
}

/**
 * Ship the sink to a fleet inbox as JSON batch files (array of batches).
 * GitHub Actions runners are ephemeral, so the fleet channel is git, not HTTP:
 * files land in --into (typically the autonomous-github-agent clone); --commit
 * records them locally there, and the PUSH is always left to resilient-git.
 */
export function runSyncFleet(options) {
  const sink = path.isAbsolute(options.out) ? options.out : path.resolve(ROOT, options.out);
  const into = path.resolve(options.into);
  if (!fs.existsSync(into) || !fs.statSync(into).isDirectory()) {
    throw new ExportError(`--into is not an existing directory: ${into}`);
  }
  const rel = path.relative(ROOT, into);
  if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    throw new ExportError('--into must live outside this repo (telemetry batches belong to the fleet clone, not here)');
  }
  const batches = buildFleetBatches(fs.existsSync(sink) ? fs.readFileSync(sink, 'utf8') : '', { app: options.app });
  const total = batches.reduce((n, b) => n + b.entries.length, 0);
  if (total === 0) {
    if (options.json) console.log(JSON.stringify({ shipped: 0, batches: 0, into }));
    else console.log('telemetry-export sync-fleet: sink has no events — nothing to ship');
    return 0;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const file = path.join(into, `telemetry-${stamp}-${total}events.json`);
  fs.writeFileSync(file, `${JSON.stringify(batches, null, 2)}\n`, 'utf8');
  if (options.commit) {
    if (!fs.existsSync(path.join(into, '.git'))) {
      throw new ExportError(`--commit needs a git repo at --into: ${into} (file was written; commit manually or drop --commit)`);
    }
    const relFile = path.relative(into, file);
    execFileSync('git', ['-C', into, 'add', '--', relFile], { stdio: 'pipe' });
    execFileSync('git', ['-C', into, 'commit', '-m', `telemetry: batch ${stamp} (${total} events, ${batches.length} app${batches.length === 1 ? '' : 's'})`], { stdio: 'pipe' });
  }
  if (options.json) console.log(JSON.stringify({ shipped: total, batches: batches.length, file, committed: options.commit }));
  else {
    console.log(`telemetry-export sync-fleet: wrote ${batches.length} batch(es), ${total} event(s) -> ${file}`);
    if (options.commit) console.log('  committed locally in the target repo');
    console.log('  push is intentionally NOT done here — run resilient-git.ps1 sync in the target repo');
  }
  return 0;
}

/**
 * Export the sink as a re-ingestible batch dump (array of {appId, version,
 * sentAt, entries[]} batches — the same shape sync-fleet ships and push now
 * accepts via --file). Reuses buildFleetBatches so dump/push/sync-fleet share
 * one batch contract; corrupt sink lines are skipped, never fatal. `--out`
 * stays the collector's sink everywhere; `--into` is the dump destination.
 */
export function runDump(options) {
  const sink = path.isAbsolute(options.out) ? options.out : path.resolve(ROOT, options.out);
  const into = path.resolve(options.into);
  if (into === sink) throw new ExportError('dump --into must differ from the sink (--out)');
  const text = fs.existsSync(sink) ? fs.readFileSync(sink, 'utf8') : '';
  const batches = buildFleetBatches(text, { app: options.app });
  fs.mkdirSync(path.dirname(into), { recursive: true });
  fs.writeFileSync(into, `${JSON.stringify(batches, null, 2)}\n`, 'utf8');
  const events = batches.reduce((n, b) => n + b.entries.length, 0);
  if (options.json) console.log(JSON.stringify({ out: into, apps: batches.length, events, sink }));
  else {
    console.log(`telemetry-export dump: ${events} event(s) in ${batches.length} batch(es) -> ${into}`);
    console.log(`  sink    : ${sink}`);
    console.log(`  reingest: node tools/telemetry-export.mjs push --file ${into}`);
  }
  return 0;
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

  // -- sync-fleet ----------------------------------------------------------
  const noInto = (() => { try { parseExportArgs(['sync-fleet']); return false; } catch (e) { return e instanceof ExportError; } })();
  check('sync-fleet without --into refused', noInto);
  const fleetParse = parseExportArgs(['sync-fleet', '--into', 'X', '--commit']);
  check('sync-fleet parses --into/--commit', fleetParse.mode === 'sync-fleet' && fleetParse.into === 'X' && fleetParse.commit === true);
  const insideReject = (() => { try { runSyncFleet({ out: path.join(tmp, 's.jsonl'), into: path.join(ROOT, 'docs'), app: null, commit: false }); return false; } catch (e) { return e instanceof ExportError; } })();
  check('--into inside this repo refused', insideReject);
  const missingInto = (() => { try { runSyncFleet({ out: path.join(tmp, 's.jsonl'), into: path.join(tmp, 'ghost'), app: null, commit: false }); return false; } catch (e) { return e instanceof ExportError; } })();
  check('--into missing dir refused', missingInto);
  const fleetSink = path.join(tmp, 'sink-fixture.jsonl');
  fs.writeFileSync(fleetSink, [
    JSON.stringify({ appId: 'nexus', kind: 'error', message: 'boom', path: '/a', ts: '2026-01-01T00:00:00.000Z' }),
    'NOT-JSON-CORRUPT-LINE',
    JSON.stringify({ appId: 'dash', kind: 'console', message: 'meh', path: '/', receivedAt: '2026-01-02T00:00:00.000Z' }),
  ].join('\n'));
  const inbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetbox-'));
  const shipCode = runSyncFleet({ out: fleetSink, into: inbox, app: null, commit: false, json: true });
  const shipped = fs.readdirSync(inbox);
  const batches = JSON.parse(fs.readFileSync(path.join(inbox, shipped[0]), 'utf8'));
  check('sync-fleet ships 2 batches / 2 events, corrupt line skipped',
    shipCode === 0 && shipped.length === 1 && batches.length === 2 && batches.reduce((n, b) => n + b.entries.length, 0) === 2);
  check('fleet batches re-ingest clean through the collector', collector.ingest(JSON.stringify(batches[0]), {}).status === 202);
  const noOp = runSyncFleet({ out: path.join(tmp, 'absent-sink.jsonl'), into: inbox, app: null, commit: false, json: true });
  check('no-events sink is a clean no-op', noOp === 0 && fs.readdirSync(inbox).length === 1);
  const commitNoRepo = (() => { try { runSyncFleet({ out: fleetSink, into: inbox, app: null, commit: true, json: true }); return false; } catch (e) { return e instanceof ExportError; } })();
  check('--commit without a git repo refused', commitNoRepo);
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetrepo-'));
  execFileSync('git', ['init', '-q', repoDir], { stdio: 'pipe' });
  for (const k of ['GIT_AUTHOR_NAME', 'GIT_COMMITTER_NAME']) process.env[k] = 'telemetry-selftest';
  for (const k of ['GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_EMAIL']) process.env[k] = 'selftest@local';
  const commitLanded = (() => {
    runSyncFleet({ out: fleetSink, into: repoDir, app: 'nexus', commit: true, json: true });
    return execFileSync('git', ['-C', repoDir, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim() === '1';
  })();
  check('--commit records the batch in the target repo', commitLanded);

  // -- dump (sink -> batch file -> push round-trip) ----------------------------
  const dumpNoInto = (() => { try { parseExportArgs(['dump']); return false; } catch (e) { return e instanceof ExportError; } })();
  check('dump without --into refused', dumpNoInto);
  const dumpFile = path.join(tmp, 'dump.json');
  const dumpCode = runDump({ out: fleetSink, into: dumpFile, app: null, json: true });
  const dumpBatches = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
  check('dump emits sync-fleet-shaped batches (corrupt line skipped)',
    dumpCode === 0 && dumpBatches.length === 2 && dumpBatches.reduce((n, b) => n + b.entries.length, 0) === 2);
  const dumpPush = pushDump(fs.readFileSync(dumpFile, 'utf8'), { ...baseOpts, out: path.join(tmp, 'dump-push.jsonl') });
  check('push --file accepts a dump file (both batches ingested)',
    dumpPush.result.status === 202 && dumpPush.result.payload.batches === 2 && dumpPush.result.payload.accepted === 2);
  const sinkClobber = (() => { try { runDump({ out: fleetSink, into: fleetSink, app: null, json: true }); return false; } catch (e) { return e instanceof ExportError; } })();
  check('dump --into refused when it would overwrite the sink', sinkClobber);
  const emptyDump = runDump({ out: path.join(tmp, 'absent-sink.jsonl'), into: path.join(tmp, 'empty-dump.json'), app: null, json: true });
  check('empty sink dumps a clean [] file', emptyDump === 0 && JSON.parse(fs.readFileSync(path.join(tmp, 'empty-dump.json'), 'utf8')).length === 0);
  fs.rmSync(inbox, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });

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
  if (options.mode === 'dump') return runDump(options);
  if (options.mode === 'sync-fleet') return runSyncFleet(options);
  await startExportServer(options);
  return 0; // keep the event loop alive; Ctrl+C to stop
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => { if (code !== 0) process.exitCode = code; }).catch((err) => {
    console.error(`telemetry-export: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  });
}


