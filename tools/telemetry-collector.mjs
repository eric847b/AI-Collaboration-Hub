#!/usr/bin/env node
/**
 * telemetry-collector — zero-dependency, self-hosted receiver + reporter for the
 * runtime error-telemetry hook (`<app>/src/lib/telemetry.ts`).
 *
 * The hook stays completely inert until an endpoint is configured. Point an app
 * at this collector (`window.TELEMETRY_ENDPOINT = "http://127.0.0.1:8787/v1/telemetry"`)
 * and every batch flush — `{ appId, version, sentAt, entries[] }` — is validated,
 * de-duplicated and appended to a JSONL file you own. Nothing leaves the machine.
 *
 * Usage:
 *   node tools/telemetry-collector.mjs serve  [flags]   # receive batches (default)
 *   node tools/telemetry-collector.mjs report [flags]   # summarize the JSONL sink
 *   node tools/telemetry-collector.mjs prune  --keep <n>  # trim sink to its newest n events
 *   node tools/telemetry-collector.mjs --self-test      # offline contract tests
 *   node tools/telemetry-collector.mjs --help
 *
 * Flags (serve):
 *   --port <n>                 listen port                        (default 8787)
 *   --host <addr>              bind address                       (default 127.0.0.1)
 *   --path <p>                 POST path accepted                 (default /v1/telemetry)
 *   --out <file>               JSONL sink                         (default tools/.tmp/telemetry/events.jsonl)
 *   --max-body <bytes>         request body cap                   (default 262144)
 *   --max-entries <n>          entries honoured per batch         (default 200)
 *   --max-events-per-min <n>   per-appId budget                   (default 600)
 *   --dedupe-window <seconds>  identical-event suppression window (default 5)
 *   --allow-origin <origin>    repeatable CORS allow-list entry   (defaults: local Vite ports)
 * Flags (report):
 *   --out <file>  --limit <n>  --json
 * Flags (prune):
 *   --keep <n>                 newest events to retain (required)
 *   --out <file>               JSONL sink                       --dry-run  --json
 * Common flags: --json  --quiet  --self-test  -h/--help
 *
 * Exit codes: 0 ok · 1 self-test failure · 2 usage/setup error · 3 serve error.
 * The sink is written only by `serve` (append) and `prune` (atomic rewrite); every
 * other command is read-only. No command reads stdin or prompts for input.
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = 'tools/.tmp/telemetry/events.jsonl';
/** Kind set mirrored from `<app>/src/lib/telemetry.ts` (`TelemetryKind`). */
const KINDS = new Set(['error', 'unhandledrejection', 'console', 'react', 'manual']);
const MESSAGE_CAP = 300;
const STACK_CAP = 1200;
const PATH_CAP = 300;
const APP_ID_CAP = 80;
/** Local dev origins the Vite dev/preview servers use; override with --allow-origin. */
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
];

const USAGE = [
  'telemetry-collector — self-hosted receiver/reporter for the runtime telemetry hook',
  '',
  'Usage: node tools/telemetry-collector.mjs serve  [flags]',
  '       node tools/telemetry-collector.mjs report [flags]',
  '       node tools/telemetry-collector.mjs prune  --keep <n> [--dry-run]',
  '       node tools/telemetry-collector.mjs --self-test',
  '',
  'serve flags: --port <n> --host <addr> --path <p> --out <file> --max-body <bytes>',
  '             --max-entries <n> --max-events-per-min <n> --dedupe-window <seconds>',
  '             --allow-origin <origin> (repeatable) --quiet',
  'report flags: --out <file> --limit <n> --json',
  'prune flags: --keep <n> (required) --out <file> --dry-run --json',
  'common: --json --quiet --self-test -h/--help',
  '',
  `Defaults: port 8787 · host 127.0.0.1 · path /v1/telemetry · out ${DEFAULT_OUT}`,
  'Exit codes: 0 ok · 1 self-test failure · 2 usage/setup error · 3 serve error',
  'No command reads stdin; prune rewrites the sink atomically (temp file + rename).',
].join('\n');

class UsageError extends Error {}

export class PayloadError extends Error {}

function intFlag(name, raw, min, max) {
  if (raw === undefined) throw new UsageError(`${name} needs a value`);
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new UsageError(`${name} must be an integer in [${min}, ${max}] (got "${raw}")`);
  }
  return n;
}

function strFlag(name, raw) {
  if (raw === undefined || raw.startsWith('--')) throw new UsageError(`${name} needs a value`);
  return raw;
}

function capText(value, max) {
  return value.length > max ? value.slice(0, max) : value;
}

function asString(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Parse argv into `{ command, ...flags }`. Unknown flags are a usage error —
 * a silent typo in CI is worse than a loud failure.
 */
export function parseArgs(argv) {
  const opts = {
    command: 'serve',
    port: 8787,
    host: '127.0.0.1',
    path: '/v1/telemetry',
    out: DEFAULT_OUT,
    maxBody: 262144,
    maxEntries: 200,
    maxEventsPerMin: 600,
    dedupeWindow: 5,
    allowOrigin: [],
    limit: 10,
    keep: null,
    dryRun: false,
    json: false,
    quiet: false,
    selfTest: false,
    help: false,
  };
  // Round 12 D CLI contract: accept `--flag=value` as well as `--flag value`.
  // The switch below dispatches on the exact space-separated token and reads the
  // value from the NEXT argv slot, so normalizing `--flag=value` into two tokens
  // up front makes every case handle both forms with no per-case change (this is
  // how telemetry-export.mjs's parseExportArgs behaves). `--flag=` with an empty
  // value is intentionally left as a single token so it still reaches the
  // "needs a value" path rather than silently becoming an empty value.
  const norm = [];
  for (const a of argv) {
    const m = typeof a === 'string' ? a.match(/^(--[a-z0-9][a-z0-9-]*)=([\s\S]*)$/) : null;
    if (m && m[2] !== '') norm.push(m[1], m[2]);
    else norm.push(a);
  }


  let i = 0;
  if (norm[0] && !norm[0].startsWith('-')) {
    const cmd = norm[0];
    if (!['serve', 'report', 'prune', 'self-test'].includes(cmd)) {
      throw new UsageError(`unknown command "${cmd}" (expected serve|report|prune|self-test)`);
    }
    opts.command = cmd === 'self-test' ? 'serve' : cmd;
    if (cmd === 'self-test') opts.selfTest = true;
    i = 1;
  }

  for (; i < norm.length; i += 1) {
    const arg = norm[i];
    const next = norm[i + 1];
    switch (arg) {
      case '--port':
        opts.port = intFlag('--port', next, 0, 65535);
        i += 1;
        break;
      case '--host':
        opts.host = strFlag('--host', next);
        i += 1;
        break;
      case '--path': {
        const p = strFlag('--path', next);
        opts.path = p.startsWith('/') ? p : `/${p}`;
        i += 1;
        break;
      }
      case '--out':
        opts.out = strFlag('--out', next);
        i += 1;
        break;
      case '--max-body':
        opts.maxBody = intFlag('--max-body', next, 1024, 8 * 1024 * 1024);
        i += 1;
        break;
      case '--max-entries':
        opts.maxEntries = intFlag('--max-entries', next, 1, 1000);
        i += 1;
        break;
      case '--max-events-per-min':
        opts.maxEventsPerMin = intFlag('--max-events-per-min', next, 1, 100000);
        i += 1;
        break;
      case '--dedupe-window':
        opts.dedupeWindow = intFlag('--dedupe-window', next, 0, 3600);
        i += 1;
        break;
      case '--allow-origin':
        opts.allowOrigin.push(strFlag('--allow-origin', next));
        i += 1;
        break;
      case '--limit':
        opts.limit = intFlag('--limit', next, 1, 1000);
        i += 1;
        break;
      case '--keep':
        opts.keep = intFlag('--keep', next, 0, 1000000);
        i += 1;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--quiet':
        opts.quiet = true;
        break;
      case '--self-test':
        opts.selfTest = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        throw new UsageError(`unknown flag "${arg}"`);
    }
  }

  // `--self-test` is a standalone mode: it must not silently shadow a command.
  if (opts.selfTest && opts.command !== 'serve') {
    throw new UsageError('--self-test is standalone — drop the command and other flags');
  }
  // Command-scoped flag contract: a silently ignored flag in CI is worse than a
  // loud usage error (mirrors the sync-parity explicit-flag rule).
  if (opts.command === 'prune' && opts.keep === null) {
    throw new UsageError('prune requires --keep <n> (how many newest events to retain)');
  }
  if (opts.command !== 'prune' && (opts.keep !== null || opts.dryRun)) {
    throw new UsageError('--keep/--dry-run are only valid with the prune command');
  }
  if (opts.allowOrigin.length === 0) opts.allowOrigin = DEFAULT_ORIGINS.slice();
  return opts;
}

/**
 * Validate + normalize one client entry. Returns `null` for anything the hook
 * could never have produced (non-object, unknown kind, empty message) so one
 * malformed entry can never poison an otherwise good batch.
 */
export function normalizeEntry(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const kind = asString(raw.kind);
  if (!KINDS.has(kind)) return null;
  const message = capText(asString(raw.message), MESSAGE_CAP);
  if (message.length === 0) return null;
  const entry = {
    ts: capText(asString(raw.ts), 40) || new Date(0).toISOString(),
    kind,
    message,
    path: capText(asString(raw.path) || '/', PATH_CAP),
  };
  const stack = asString(raw.stack);
  if (stack.length > 0) entry.stack = capText(stack, STACK_CAP);
  return entry;
}

/**
 * Validate + normalize a whole POST body. Throws `PayloadError` for shapes the
 * hook cannot emit; per-entry problems are reported as counts instead.
 */
export function normalizeBatch(raw, { maxEntries = 200 } = {}) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new PayloadError('body must be a JSON object');
  }
  const appId = capText(asString(raw.appId), APP_ID_CAP);
  if (appId.length === 0) throw new PayloadError('body.appId is required');
  if (!Array.isArray(raw.entries)) throw new PayloadError('body.entries must be an array');

  const entries = [];
  let droppedEntries = 0;
  for (const candidate of raw.entries) {
    if (entries.length >= maxEntries) {
      droppedEntries += 1;
      continue;
    }
    const entry = normalizeEntry(candidate);
    if (entry === null) droppedEntries += 1;
    else entries.push(entry);
  }
  if (entries.length === 0 && droppedEntries > 0) {
    throw new PayloadError('no valid entries in batch');
  }

  return {
    appId,
    version: capText(asString(raw.version), APP_ID_CAP) || null,
    sentAt: capText(asString(raw.sentAt), 40) || null,
    entries,
    droppedEntries,
  };
}

/** Identity of an event for de-duplication: kind + message + path (ts excluded). */
export function dedupeKey(entry) {
  return `${entry.kind}\u0000${entry.message}\u0000${entry.path}`;
}

/**
 * Fixed-window budget per key. Browser flush retries and hot error loops are
 * the realistic abuse case here, so this is a safety rail, not a quota system.
 */
export function createRateLimiter({ maxPerWindow, windowMs }) {
  const buckets = new Map();
  return {
    /** @returns {boolean} true while the caller is inside budget. */
    allow(key, nowMs) {
      const bucket = buckets.get(key);
      if (!bucket || nowMs - bucket.start >= windowMs) {
        buckets.set(key, { start: nowMs, count: 1 });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= maxPerWindow;
    },
    size() {
      return buckets.size;
    },
  };
}

/** De-dupe cache with a bounded map: expired entries are swept before eviction. */
export function createDedupeCache({ windowMs, maxKeys = 5000 }) {
  const seen = new Map();
  return {
    /** @returns {boolean} true when this key was already seen inside the window. */
    isDuplicate(key, nowMs) {
      const at = seen.get(key);
      if (at !== undefined && nowMs - at < windowMs) return true;
      seen.set(key, nowMs);
      if (seen.size > maxKeys) {
        for (const [k, ts] of seen) {
          if (nowMs - ts >= windowMs) seen.delete(k);
        }
        let excess = seen.size - maxKeys;
        for (const k of seen.keys()) {
          if (excess <= 0) break;
          seen.delete(k);
          excess -= 1;
        }
      }
      return false;
    },
    size() {
      return seen.size;
    },
  };
}

/**
 * Collector state machine: validate → rate-limit → de-dupe → append JSONL.
 * Pure-ish: `deps.now` is injectable so the self-test can drive the windows.
 */
/**
 * The per-app rate-limit window, in ms.
 *
 * Named (and asserted in --self-test) because the limiter's BEHAVIOUR is not
 * enough to pin it down: the self-test drives events through an injectable
 * clock, so a window wrongly set to ~27 hours still lets the limiter trip and
 * the suite stays green - while in production the bucket would never reset and
 * every later event from that app would be dropped.
 */
export const RATE_WINDOW_MS = 60 * 1000;

export function createCollector(options, deps = {}) {
  const now = deps.now ?? (() => Date.now());
  const outPath = path.resolve(ROOT, options.out);
  const dedupe = createDedupeCache({
    windowMs: options.dedupeWindow * 1000,
    maxKeys: 5000,
  });
  const limiter = createRateLimiter({
    maxPerWindow: options.maxEventsPerMin,
    windowMs: RATE_WINDOW_MS,
  });
  const stats = {
    startedAt: new Date().toISOString(),
    batches: 0,
    received: 0,
    accepted: 0,
    duplicates: 0,
    droppedEntries: 0,
    rateLimited: 0,
    rejectedBatches: 0,
  };

  /** @returns {{ status: number, payload: object }} */
  function ingest(bodyText, { origin = null } = {}) {
    stats.batches += 1;
    let raw;
    try {
      raw = JSON.parse(bodyText);
    } catch {
      stats.rejectedBatches += 1;
      return { status: 400, payload: { ok: false, error: 'body is not valid JSON' } };
    }

    let batch;
    try {
      batch = normalizeBatch(raw, { maxEntries: options.maxEntries });
    } catch (e) {
      stats.rejectedBatches += 1;
      const error = e instanceof PayloadError ? e.message : 'invalid payload';
      return { status: 400, payload: { ok: false, error } };
    }

    const at = now();
    if (!limiter.allow(batch.appId, at)) {
      stats.rateLimited += 1;
      stats.rejectedBatches += 1;
      return {
        status: 429,
        payload: { ok: false, error: `rate limit exceeded for ${batch.appId}` },
      };
    }

    const kept = [];
    let duplicates = 0;
    for (const entry of batch.entries) {
      if (dedupe.isDuplicate(dedupeKey(entry), at)) duplicates += 1;
      else kept.push(entry);
    }

    stats.received += batch.entries.length;
    stats.duplicates += duplicates;
    stats.droppedEntries += batch.droppedEntries;
    stats.accepted += kept.length;

    if (kept.length > 0) {
      const lines = kept
        .map((entry) =>
          JSON.stringify({
            receivedAt: new Date(at).toISOString(),
            origin,
            appId: batch.appId,
            version: batch.version,
            ...entry,
          }),
        )
        .join('\n');
      try {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.appendFileSync(outPath, `${lines}\n`, 'utf8');
      } catch (e) {
        stats.rejectedBatches += 1;
        return { status: 500, payload: { ok: false, error: `sink write failed: ${e.message}` } };
      }
    }

    return {
      status: 202,
      payload: {
        ok: true,
        appId: batch.appId,
        accepted: kept.length,
        duplicates,
        dropped: batch.droppedEntries,
      },
    };
  }

  return { ingest, stats, outPath, dedupe, limiter };
}

/** HTTP surface: CORS preflight, POST <path>, GET /healthz, everything else 404. */
export function createRequestHandler({ collector, options }) {
  const allow = new Set(options.allowOrigin);

  return function handle(req, res) {
    const origin = req.headers.origin ?? null;
    const corsAllowed = origin !== null && (allow.has(origin) || allow.has('*'));
    if (corsAllowed) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'origin');
      res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');
      res.setHeader('access-control-allow-headers', 'content-type');
      res.setHeader('access-control-max-age', '600');
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const send = (status, payload) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'cache-control': 'no-store',
      });
      res.end(body);
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(corsAllowed ? 204 : 403);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/healthz') {
      send(200, { ok: true, out: path.relative(ROOT, collector.outPath), ...collector.stats });
      return;
    }

    if (req.method !== 'POST') {
      send(405, { ok: false, error: 'method not allowed' });
      return;
    }

    if (url.pathname !== options.path) {
      send(404, { ok: false, error: `POST ${url.pathname} is not a telemetry endpoint` });
      return;
    }

    // sendBeacon posts text/plain, fetch posts application/json — never gate on
    // content-type, only on the body itself.
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > options.maxBody) {
        // Respond instead of destroying the socket so the client actually reads
        // the 413; the still-attached 'data' listener drains the rest.
        aborted = true;
        chunks.length = 0;
        send(413, { ok: false, error: `body exceeds ${options.maxBody} bytes` });
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', () => {
      aborted = true;
    });
    req.on('end', () => {
      if (aborted) return;
      const result = collector.ingest(Buffer.concat(chunks).toString('utf8'), { origin });
      send(result.status, result.payload);
    });
  };
}

/** Start listening. Resolves once bound so the self-test can use port 0. */
export function startServer(options, collector) {
  const server = http.createServer(createRequestHandler({ collector, options }));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => resolve(server));
  });
}

/**
 * Tolerant JSONL reader: a torn last line (killed mid-append) or a hand-edited
 * row degrades to a `malformed` count, never a crash.
 */
export function readEvents(file) {
  const abs = path.resolve(ROOT, file);
  if (!fs.existsSync(abs)) return { abs, missing: true, malformed: 0, events: [] };
  const events = [];
  let malformed = 0;
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) events.push(parsed);
      else malformed += 1;
    } catch {
      malformed += 1;
    }
  }
  return { abs, missing: false, malformed, events };
}

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toRanked(map, limit) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Aggregate the sink into ops-actionable counts. Pure — safe to unit test. */
export function summarize(events, { limit = 10 } = {}) {
  const apps = new Map();
  const kinds = new Map();
  const messages = new Map();
  const paths = new Map();
  let firstAt = null;
  let lastAt = null;

  for (const event of events) {
    const appId = typeof event.appId === 'string' && event.appId ? event.appId : '<unknown>';
    bump(apps, appId);
    bump(kinds, typeof event.kind === 'string' ? event.kind : '<unknown>');
    const message = typeof event.message === 'string' ? event.message : '<unknown>';
    bump(messages, message);
    bump(paths, typeof event.path === 'string' ? event.path : '<unknown>');
    const ts = typeof event.receivedAt === 'string' ? event.receivedAt : event.ts;
    if (typeof ts === 'string') {
      if (firstAt === null || ts < firstAt) firstAt = ts;
      if (lastAt === null || ts > lastAt) lastAt = ts;
    }
  }

  return {
    total: events.length,
    firstAt,
    lastAt,
    apps: toRanked(apps, limit),
    kinds: toRanked(kinds, limit),
    messages: toRanked(messages, limit),
    paths: toRanked(paths, limit),
  };
}

function renderReport(summary, fileInfo) {
  const rows = [];
  rows.push('# telemetry report');
  rows.push('');
  if (fileInfo.missing) {
    rows.push(`Sink ${path.relative(ROOT, fileInfo.abs)} does not exist yet — nothing collected.`);
    rows.push('');
    rows.push('Start the collector: node tools/telemetry-collector.mjs serve');
    return rows.join('\n');
  }
  rows.push(`Sink: ${path.relative(ROOT, fileInfo.abs)}`);
  rows.push(`Events: ${summary.total}${fileInfo.malformed > 0 ? ` (${fileInfo.malformed} malformed lines skipped)` : ''}`);
  if (summary.total === 0) {
    rows.push('');
    rows.push('Sink is empty — no batches received yet.');
    return rows.join('\n');
  }
  if (summary.firstAt || summary.lastAt) {
    rows.push(`Window: ${summary.firstAt ?? '?'} → ${summary.lastAt ?? '?'}`);
  }
  const table = (title, entries) => {
    if (entries.length === 0) return;
    rows.push('');
    rows.push(`## ${title}`);
    rows.push('');
    rows.push('| Value | Count |');
    rows.push('|-------|-------|');
    for (const { label, count } of entries) {
      rows.push(`| ${label.replace(/\|/g, '\\|').slice(0, 120)} | ${count} |`);
    }
  };
  table('By app', summary.apps);
  table('By kind', summary.kinds);
  table('Top messages', summary.messages);
  table('Top paths', summary.paths);
  return rows.join('\n');
}

async function runServe(opts) {
  const collector = createCollector(opts);
  let server;
  try {
    server = await startServer(opts, collector);
  } catch (e) {
    const code = e && e.code === 'EADDRINUSE' ? 'port already in use' : e.message;
    console.error(`telemetry-collector: cannot listen on ${opts.host}:${opts.port} — ${code}`);
    console.error('hint: pass --port 0 for an ephemeral port, or stop the process holding it.');
    return 3;
  }
  const bound = server.address();
  const shown = typeof bound === 'object' && bound ? `${opts.host}:${bound.port}` : `${opts.host}:${opts.port}`;
  console.log(`[telemetry] listening http://${shown}${opts.path}`);
  console.log(`[telemetry] sink      ${path.relative(ROOT, collector.outPath)}`);
  console.log(`[telemetry] cors      ${opts.allowOrigin.join(', ')}`);
  console.log(
    `[telemetry] limits    body<=${opts.maxBody}B entries<=${opts.maxEntries} per-app<=${opts.maxEventsPerMin}/min dedupe=${opts.dedupeWindow}s`,
  );
  console.log('[telemetry] point an app at it with window.TELEMETRY_ENDPOINT (see docs/TELEMETRY.md)');
  console.log('[telemetry] Ctrl+C to stop');

  return new Promise((resolve) => {
    const stop = () => {
      const s = collector.stats;
      console.log(
        `\n[telemetry] stopping — batches=${s.batches} received=${s.received} accepted=${s.accepted} duplicates=${s.duplicates} dropped=${s.droppedEntries} rateLimited=${s.rateLimited} rejected=${s.rejectedBatches}`,
      );
      server.close(() => resolve(0));
      setTimeout(() => resolve(0), 1500).unref();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}

function runReport(opts) {
  const fileInfo = readEvents(opts.out);
  const summary = summarize(fileInfo.events, { limit: opts.limit });
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          sink: path.relative(ROOT, fileInfo.abs),
          missing: fileInfo.missing,
          malformed: fileInfo.malformed,
          ...summary,
        },
        null,
        2,
      ),
    );
    return 0;
  }
  console.log(renderReport(summary, fileInfo));
  return 0;
}

/**
 * Trim the sink to its newest `keep` events (unparseable lines are dropped in
 * passing). Writes via temp-file + rename so an interrupted prune can never
 * leave a half-written ledger — the previous sink survives until the rename
 * succeeds. `--dry-run` previews and touches nothing; nothing ever prompts.
 */
export function pruneSink(fileInfo, keep, { dryRun = false } = {}) {
  const total = fileInfo.events.length;
  const retained = keep >= total ? fileInfo.events.slice() : fileInfo.events.slice(total - keep);
  const text = retained.length === 0 ? '' : `${retained.map((e) => JSON.stringify(e)).join('\n')}\n`;
  const bytesBefore = fileInfo.missing ? 0 : fs.statSync(fileInfo.abs).size;
  const result = {
    sink: path.relative(ROOT, fileInfo.abs),
    missing: fileInfo.missing,
    dryRun,
    keep,
    before: total,
    after: retained.length,
    dropped: total - retained.length,
    malformedDropped: fileInfo.malformed,
    bytesBefore,
    bytesAfter: Buffer.byteLength(text),
    written: false,
  };
  const needsWrite = !fileInfo.missing && (result.dropped > 0 || fileInfo.malformed > 0);
  if (dryRun || !needsWrite) return result;

  const tmp = `${fileInfo.abs}.prune-${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(fileInfo.abs), { recursive: true });
  fs.writeFileSync(tmp, text);
  try {
    fs.renameSync(tmp, fileInfo.abs);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  result.written = true;
  return result;
}

/** Human-readable prune summary (JSON mode is rendered by `runPrune`). */
function renderPrune(result) {
  const rows = [`# telemetry prune${result.dryRun ? ' (dry run)' : ''}`, ''];
  if (result.missing) {
    rows.push(`Sink ${result.sink} does not exist yet — nothing to prune.`);
    return rows.join('\n');
  }
  rows.push(`Sink: ${result.sink}`);
  rows.push(`Events: ${result.before} → ${result.after} (dropped ${result.dropped})`);
  if (result.malformedDropped > 0) rows.push(`Malformed lines dropped: ${result.malformedDropped}`);
  rows.push(`Bytes: ${result.bytesBefore} → ${result.bytesAfter}`);
  const verdict = result.dryRun
    ? 'Dry run — sink untouched. Re-run without --dry-run to apply.'
    : result.written
      ? 'Sink rewritten atomically.'
      : 'Nothing to do — already within --keep and free of malformed lines.';
  rows.push(verdict);
  return rows.join('\n');
}

function runPrune(opts) {
  const fileInfo = readEvents(opts.out);
  const result = pruneSink(fileInfo, opts.keep, { dryRun: opts.dryRun });
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  console.log(renderPrune(result));
  return 0;
}

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`telemetry-collector: ${e.message}`);
      console.error(USAGE);
      return 2;
    }
    throw e;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (opts.selfTest) return runSelfTest();
  if (opts.command === 'report') return runReport(opts);
  if (opts.command === 'prune') return runPrune(opts);
  return runServe(opts);
}

function createCheckRunner() {
  const state = { checks: 0, failures: 0 };
  const lines = [];
  const check = (name, condition, detail = '') => {
    state.checks += 1;
    if (!condition) {
      state.failures += 1;
      lines.push(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };
  const throws = (name, fn, matcher) => {
    try {
      fn();
      check(name, false, 'expected a throw');
    } catch (e) {
      const ok = matcher === undefined || matcher(e);
      check(name, ok, ok ? '' : `wrong error: ${e && e.message}`);
    }
  };
  return { state, lines, check, throws };
}

function reportSelfTest(state, lines) {
  if (state.failures > 0) {
    for (const line of lines) console.error(line);
    console.error(`telemetry-collector self-test: ${state.checks - state.failures}/${state.checks} passed`);
    return 1;
  }
  console.log(`telemetry-collector self-test: ${state.checks}/${state.checks} passed`);
  return 0;
}

/** Offline contract tests: loopback HTTP only, writes confined to os.tmpdir(). */
async function runSelfTest() {
  const { state, lines, check, throws } = createCheckRunner();

  // --- arg parsing ---------------------------------------------------------
  const defaults = parseArgs([]);
  check('defaults.command', defaults.command === 'serve', defaults.command);
  check('defaults.port', defaults.port === 8787, String(defaults.port));
  check('defaults.host', defaults.host === '127.0.0.1', defaults.host);
  check('defaults.path', defaults.path === '/v1/telemetry', defaults.path);
  check('defaults.out', defaults.out === DEFAULT_OUT, defaults.out);
  check('defaults.allowOrigin', defaults.allowOrigin.length === DEFAULT_ORIGINS.length);
  check('defaults.notSelfTest', defaults.selfTest === false);
  // Pins the limiter WINDOW, not just the limiter. Behaviour alone cannot: the
  // self-test drives an injectable clock, so a window set to ~27 hours still
  // trips the limiter and stays green while production would never reset it.
  check('rate window is one minute', RATE_WINDOW_MS === 60000, String(RATE_WINDOW_MS));

  const parsed = parseArgs(['serve', '--port', '0', '--allow-origin', 'http://example.test', '--quiet']);
  check('parse.ephemeralPort', parsed.port === 0, String(parsed.port));
  check('parse.allowOriginOverride', parsed.allowOrigin.join(',') === 'http://example.test');
  check('parse.quiet', parsed.quiet === true);
  check('parse.pathNormalized', parseArgs(['--path', 'v1/t']).path === '/v1/t');
  check('parse.selfTestCommand', parseArgs(['self-test']).selfTest === true);
  check('parse.reportCommand', parseArgs(['report', '--limit', '3']).command === 'report');
  throws('parse.unknownFlag', () => parseArgs(['--nope']), (e) => e instanceof UsageError);
  throws('parse.unknownCommand', () => parseArgs(['bogus']), (e) => e instanceof UsageError);
  throws('parse.portNotNumber', () => parseArgs(['--port', 'abc']), (e) => e instanceof UsageError);
  throws('parse.portOutOfRange', () => parseArgs(['--port', '70000']), (e) => e instanceof UsageError);
  throws('parse.missingValue', () => parseArgs(['--out']), (e) => e instanceof UsageError);

  // prune flag contract (Round 12): command-scoped flags, strict usage errors.
  const pruneParsed = parseArgs(['prune', '--keep', '5', '--dry-run', '--json']);
  check(
    'parse.pruneCommand',
    pruneParsed.command === 'prune' && pruneParsed.keep === 5 && pruneParsed.dryRun === true,
    JSON.stringify({ c: pruneParsed.command, k: pruneParsed.keep, d: pruneParsed.dryRun }),
  );
  check('parse.pruneKeepZero', parseArgs(['prune', '--keep', '0']).keep === 0);
  check('parse.pruneDefaultNoDryRun', parseArgs(['prune', '--keep', '1']).dryRun === false);
  throws('parse.pruneNeedsKeep', () => parseArgs(['prune']), (e) => e instanceof UsageError);
  throws('parse.pruneNeedsSelfTest', () => parseArgs(['prune', '--self-test']), (e) => e instanceof UsageError);
  throws('parse.keepOnlyForPrune', () => parseArgs(['report', '--keep', '5']), (e) => e instanceof UsageError);
  throws('parse.dryRunOnlyForPrune', () => parseArgs(['serve', '--dry-run']), (e) => e instanceof UsageError);
  throws('parse.keepNotNumber', () => parseArgs(['prune', '--keep', 'x']), (e) => e instanceof UsageError);

  // --- entry / batch validation -------------------------------------------
  const good = { ts: '2026-09-26T10:00:00.000Z', kind: 'error', message: 'boom', path: '/a' };
  const norm = normalizeEntry(good);
  check('entry.valid', norm !== null && norm.kind === 'error' && norm.message === 'boom');
  check('entry.noUndefinedStack', norm !== null && !('stack' in norm));
  check('entry.stackKept', normalizeEntry({ ...good, stack: 'x' }).stack === 'x');
  check('entry.badKind', normalizeEntry({ ...good, kind: 'silly' }) === null);
  check('entry.emptyMessage', normalizeEntry({ ...good, message: '' }) === null);
  check('entry.notObject', normalizeEntry(null) === null && normalizeEntry([]) === null);
  check('entry.junkTs', normalizeEntry({ ...good, ts: 42 }).ts === new Date(0).toISOString());
  check('entry.messageCap', normalizeEntry({ ...good, message: 'm'.repeat(500) }).message.length === MESSAGE_CAP);
  check('entry.stackCap', normalizeEntry({ ...good, stack: 's'.repeat(5000) }).stack.length === STACK_CAP);

  const batch = normalizeBatch({ appId: 'app', version: '1.0.0', sentAt: 'now', entries: [good, good] });
  check('batch.twoEntries', batch.entries.length === 2);
  check('batch.noDrops', batch.droppedEntries === 0);
  check('batch.version', batch.version === '1.0.0');
  const mixed = normalizeBatch({ appId: 'app', entries: [good, { kind: 'nope' }] });
  check('batch.dropsBadEntry', mixed.entries.length === 1 && mixed.droppedEntries === 1);
  const capped = normalizeBatch({ appId: 'app', entries: [good, good, good] }, { maxEntries: 1 });
  check('batch.entryCap', capped.entries.length === 1 && capped.droppedEntries === 2);
  throws('batch.needsAppId', () => normalizeBatch({ entries: [good] }), (e) => e instanceof PayloadError);
  throws(
    'batch.needsEntryArray',
    () => normalizeBatch({ appId: 'app', entries: 'x' }),
    (e) => e instanceof PayloadError,
  );
  throws(
    'batch.rejectsOnlyJunk',
    () => normalizeBatch({ appId: 'app', entries: [{ kind: 'nope' }] }),
    (e) => e instanceof PayloadError,
  );
  throws('batch.rejectsArray', () => normalizeBatch([1, 2, 3]), (e) => e instanceof PayloadError);

  // --- de-dupe + rate limiting --------------------------------------------
  check('dedupeKey.pathSensitive', dedupeKey(good) !== dedupeKey({ ...good, path: '/b' }));
  const cache = createDedupeCache({ windowMs: 1000 });
  check('dedupe.first', cache.isDuplicate('k', 0) === false);
  check('dedupe.second', cache.isDuplicate('k', 500) === true);
  check('dedupe.expired', cache.isDuplicate('k', 1500) === false);
  check('dedupe.distinct', cache.isDuplicate('other', 1500) === false);
  const bounded = createDedupeCache({ windowMs: 10000, maxKeys: 10 });
  for (let i = 0; i < 50; i += 1) bounded.isDuplicate(`k${i}`, 0);
  check('dedupe.bounded', bounded.size() <= 10, String(bounded.size()));

  const limiter = createRateLimiter({ maxPerWindow: 2, windowMs: 60000 });
  check('limit.first', limiter.allow('app', 0) === true);
  check('limit.second', limiter.allow('app', 1) === true);
  check('limit.thirdDenied', limiter.allow('app', 2) === false);
  check('limit.otherKey', limiter.allow('other', 2) === true);
  check('limit.windowReset', limiter.allow('app', 60000) === true);

  if (state.failures > 0) return reportSelfTest(state, lines);
  return runSelfTestIO(state, lines, check);
}

/** Filesystem + loopback-HTTP half of the self-test; always cleans up its tmpdir. */
async function runSelfTestIO(state, lines, check) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-collector-selftest-'));
  const out = path.join(tmpDir, 'events.jsonl');
  let clock = 1_800_000_000_000;
  const opts = {
    out,
    dedupeWindow: 5,
    maxEntries: 5,
    maxEventsPerMin: 100,
    maxBody: 4096,
    path: '/v1/telemetry',
    allowOrigin: ['http://localhost:5173'],
    host: '127.0.0.1',
  };

  try {
    const collector = createCollector(opts, { now: () => clock });
    const payload = JSON.stringify({
      appId: 'selftest',
      version: '1.0.0',
      sentAt: '2026-09-26T10:00:00.000Z',
      entries: [{ ts: '2026-09-26T10:00:00.000Z', kind: 'error', message: 'boom', path: '/a', stack: 's' }],
    });

    let result = collector.ingest(payload, { origin: 'http://localhost:5173' });
    check('io.firstAccepted', result.status === 202 && result.payload.accepted === 1, JSON.stringify(result.payload));

    // --- hook parity guard: extract TelemetryKind from canonical hook -------
    const hookSrcPath = path.join(ROOT, 'nexus-infinity-hub', 'src', 'lib', 'telemetry.ts');
    if (fs.existsSync(hookSrcPath)) {
      const hookSrc = fs.readFileSync(hookSrcPath, 'utf8');
      const match = hookSrc.match(/export\s+type\s+TelemetryKind\s*=\s*([^;]+);/);
      check('parity.hookHasKindUnion', Boolean(match));
      if (match) {
        const kinds = Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g)).map((m) => m[1]);
        check('parity.kindsMatchAllowed', kinds.length === KINDS.size && kinds.every((k) => KINDS.has(k)), JSON.stringify({ hook: kinds, allowed: Array.from(KINDS) }));
      }
      check('parity.hookDocumentsEnvEndpoint', hookSrc.includes('VITE_TELEMETRY_ENDPOINT'));
    }

    clock += 1000;
    result = collector.ingest(payload);
    check(
      'io.duplicateSuppressed',
      result.status === 202 && result.payload.accepted === 0 && result.payload.duplicates === 1,
      JSON.stringify(result.payload),
    );

    clock += 6000;
    result = collector.ingest(payload);
    check('io.afterWindowAccepted', result.status === 202 && result.payload.accepted === 1);

    check('io.rejectsBadJson', collector.ingest('{oops').status === 400);
    check('io.rejectsNoAppId', collector.ingest(JSON.stringify({ entries: [] })).status === 400);
    check('io.rejectsNonObject', collector.ingest('"nope"').status === 400);

    const tight = createCollector({ ...opts, out: path.join(tmpDir, 'tight.jsonl'), maxEventsPerMin: 1 }, {
      now: () => 1_800_000_000_000,
    });
    const mk = (message) =>
      JSON.stringify({ appId: 'tight', entries: [{ ts: 'now', kind: 'manual', message, path: '/' }] });
    check('io.tightFirstOk', tight.ingest(mk('one')).status === 202);
    const limited = tight.ingest(mk('two'));
    check('io.tightSecondLimited', limited.status === 429, JSON.stringify(limited.payload));
    check('io.tightCountsLimit', tight.stats.rateLimited === 1 && tight.stats.accepted === 1);

    const read = readEvents(out);
    check('io.sinkExists', read.missing === false);
    check('io.sinkLines', read.events.length === 2, String(read.events.length));
    check('io.sinkMalformed', read.malformed === 0, String(read.malformed));
    check('io.sinkAppId', read.events[0].appId === 'selftest', String(read.events[0].appId));
    check('io.sinkVersion', read.events[0].version === '1.0.0', String(read.events[0].version));
    check('io.sinkStamped', typeof read.events[0].receivedAt === 'string' && read.events[0].kind === 'error');
    check('io.sinkFirstOrigin', read.events[0].origin === 'http://localhost:5173', String(read.events[0].origin));
    check('io.sinkSecondNoOrigin', read.events[1].origin === null, String(read.events[1].origin));

    const summary = summarize(read.events, { limit: 1 });
    check('io.summaryTotal', summary.total === 2, String(summary.total));
    check('io.summaryApps', summary.apps.length === 1 && summary.apps[0].label === 'selftest', JSON.stringify(summary.apps));
    check('io.summaryKinds', summary.kinds.length === 1 && summary.kinds[0].label === 'error');
    check('io.summaryWindow', typeof summary.firstAt === 'string' && typeof summary.lastAt === 'string');

    const mixedSummary = summarize([
      { appId: 'a', kind: 'error', message: 'x', path: '/', ts: '2026-01-01T00:00:00.000Z' },
      { appId: 'a', kind: 'error', message: 'x', path: '/', ts: '2026-01-02T00:00:00.000Z' },
      { kind: 'console', message: 'y', path: '/b', receivedAt: '2026-01-03T00:00:00.000Z' },
    ]);
    check('io.summaryUnknownApp', mixedSummary.apps.at(-1).label === '<unknown>');
    check('io.summaryRanked', mixedSummary.apps[0].label === 'a' && mixedSummary.apps[0].count === 2);
    check('io.summaryLimit', summarize([{ appId: 'a' }, { appId: 'b' }], { limit: 1 }).apps.length === 1);
    check('io.summaryLastAt', mixedSummary.lastAt === '2026-01-03T00:00:00.000Z', String(mixedSummary.lastAt));

    // --- prune: newest-N retention, malformed cleanup, dry-run, atomicity ----
    const prunePath = path.join(tmpDir, 'prune.jsonl');
    const pruneRows = [1, 2, 3, 4, 5].map((n) =>
      JSON.stringify({
        appId: 'pruner',
        ts: `2026-09-26T10:00:0${n}.000Z`,
        kind: 'error',
        message: `m${n}`,
        path: '/',
      }),
    );
    fs.writeFileSync(prunePath, `${pruneRows.join('\n')}\n{not json\n`);

    const dryRun = pruneSink(readEvents(prunePath), 2, { dryRun: true });
    check(
      'prune.dryRunCounts',
      dryRun.before === 5 && dryRun.after === 2 && dryRun.dropped === 3,
      JSON.stringify({ b: dryRun.before, a: dryRun.after, d: dryRun.dropped }),
    );
    check(
      'prune.dryRunNoWrite',
      dryRun.written === false && fs.readFileSync(prunePath, 'utf8').includes('{not json'),
    );
    check('prune.renderDryRun', renderPrune(dryRun).includes('Dry run'));

    const applied = pruneSink(readEvents(prunePath), 2);
    const pruned = readEvents(prunePath);
    check('prune.appliedWrote', applied.written === true && applied.malformedDropped === 1);
    check(
      'prune.keepsNewest',
      pruned.events.length === 2 && pruned.events[1].message === 'm5',
      JSON.stringify(pruned.events.map((e) => e.message)),
    );
    check('prune.malformedCleared', pruned.malformed === 0, String(pruned.malformed));
    check('prune.shrinksBytes', applied.bytesAfter < applied.bytesBefore);
    check('prune.noTempLeftBehind', fs.readdirSync(tmpDir).every((f) => !f.endsWith('.tmp')));

    const underKeep = pruneSink(readEvents(prunePath), 99);
    check('prune.noopUnderKeep', underKeep.dropped === 0 && underKeep.written === false);

    const missingPrune = pruneSink(readEvents(path.join(tmpDir, 'absent.jsonl')), 1);
    check(
      'prune.missingGraceful',
      missingPrune.missing === true && missingPrune.after === 0 && missingPrune.written === false,
    );
    check('prune.renderMissing', renderPrune(missingPrune).includes('nothing to prune'));

    const emptied = pruneSink(readEvents(prunePath), 0);
    check('prune.keepZeroEmpties', emptied.after === 0 && readEvents(prunePath).events.length === 0);

    return runSelfTestHttp(state, lines, check, opts, collector, read);
  } catch (e) {
    state.failures += 1;
    lines.push(`FAIL  io.threw — ${e && e.stack ? e.stack.split('\n')[0] : e}`);
    return reportSelfTest(state, lines);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}

/** Loopback HTTP half: mirrors what the browser transport actually does. */
async function runSelfTestHttp(state, lines, check, opts, collector) {
  const server = await startServer({ ...opts, port: 0 }, collector);
  const bound = server.address();
  const base = `http://127.0.0.1:${bound.port}`;
  const post = (body, headers = {}) => fetch(`${base}${opts.path}`, { method: 'POST', body, headers });
  const stub = (message, kind = 'manual') =>
    JSON.stringify({ appId: 'http', entries: [{ ts: 'now', kind, message, path: '/p' }] });

  try {
    // sendBeacon always posts text/plain — the collector must not gate on content-type.
    let res = await post(stub('beacon one'), { 'content-type': 'text/plain;charset=UTF-8' });
    check('http.beaconStyleAccepted', res.status === 202, String(res.status));
    check('http.beaconStyleBody', (await res.json()).accepted === 1);

    res = await post(stub('json two'), { 'content-type': 'application/json' });
    check('http.jsonAccepted', res.status === 202, String(res.status));

    res = await post(stub('beacon one'), { 'content-type': 'text/plain' });
    const replay = await res.json();
    check('http.replayDeduplicated', res.status === 202 && replay.duplicates === 1, JSON.stringify(replay));

    res = await post('{bad');
    check('http.badJson400', res.status === 400, String(res.status));

    res = await post(JSON.stringify({ entries: [] }));
    check('http.missingAppId400', res.status === 400, String(res.status));

    res = await post('x'.repeat(5000));
    check('http.oversize413', res.status === 413, String(res.status));

    res = await fetch(`${base}/nope`, { method: 'POST', body: '{}' });
    check('http.wrongPath404', res.status === 404, String(res.status));

    res = await fetch(`${base}${opts.path}`);
    check('http.getOnEndpoint405', res.status === 405, String(res.status));

    res = await fetch(`${base}/healthz`);
    const health = await res.json();
    check('http.healthzOk', res.status === 200 && health.ok === true);
    check('http.healthzStats', health.batches >= 6 && health.accepted >= 2, JSON.stringify(health));
    check('http.healthzRejected', health.rejectedBatches >= 4, String(health.rejectedBatches));

    res = await fetch(`${base}${opts.path}`, { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } });
    check('http.preflightAllowed', res.status === 204, String(res.status));
    check(
      'http.preflightHeader',
      res.headers.get('access-control-allow-origin') === 'http://localhost:5173',
      String(res.headers.get('access-control-allow-origin')),
    );

    res = await fetch(`${base}${opts.path}`, { method: 'OPTIONS', headers: { origin: 'http://evil.test' } });
    check('http.preflightDenied', res.status === 403, String(res.status));
    check('http.preflightNoHeader', res.headers.get('access-control-allow-origin') === null);

    res = await post(stub('cors three'), { origin: 'http://localhost:5173' });
    const corsBody = await res.json();
    check('http.corsPostAccepted', res.status === 202, JSON.stringify(corsBody));
    check(
      'http.corsResponseHeader',
      res.headers.get('access-control-allow-origin') === 'http://localhost:5173',
      String(res.headers.get('access-control-allow-origin')),
    );

    const missing = readEvents(path.join(os.tmpdir(), `telemetry-missing-${process.pid}.jsonl`));
    check('report.missingGraceful', missing.missing === true && missing.events.length === 0);
    check('report.missingText', renderReport(summarize([]), missing).includes('does not exist'));
    check('report.emptyText', renderReport(summarize([]), readEvents(path.join(os.tmpdir(), 'nope.jsonl'))).includes('does not exist'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  return reportSelfTest(state, lines);
}


const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(`telemetry-collector: unexpected failure — ${err && err.stack ? err.stack : err}`);
      process.exitCode = 2;
    },
  );
}
