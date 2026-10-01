#!/usr/bin/env node
/**
 * agent_telemetry_intake — fleet-side ingestion for the telemetry git inbox.
 *
 * Hub-side `telemetry-export.mjs sync-fleet` batch-ships collector sinks to
 * this repo as telemetry/inbox/*.json commits (ephemeral GH Actions runners
 * cannot host a persistent HTTP endpoint, so git IS the transport). This
 * script closes the loop inside the repo: every inbox batch is ingested
 * through the mirrored `telemetry_collector.mjs` — same validator, rate
 * limiter, dedupe cache and JSONL sink, never reimplemented — and the batch
 * is archived so it can never be double-counted. Rejected batches are parked
 * next to a reason file instead of blocking healthy shipments.
 *
 *   node .github/agent_telemetry_intake.mjs [--inbox <dir>] [--sink <file>]
 *       ingest every telemetry/inbox/*.json batch, print a JSON summary
 *   node .github/agent_telemetry_intake.mjs --self-test
 *       offline contract test in temp dirs (no network, no repo writes)
 *
 * Invoked by .github/workflows/telemetry-intake.yml on inbox pushes and on a
 * weekly safety net; committing results back stays with the workflow.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createCollector } from './telemetry_collector.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

export function parseArgv(argv) {
  const opts = {
    inbox: path.join(REPO, 'telemetry', 'inbox'),
    sink: path.join(REPO, 'telemetry', 'sink.jsonl'),
    selfTest: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--self-test') { opts.selfTest = true; continue; }
    if (flag === '--help' || flag === '-h') { opts.help = true; continue; }
    const val = argv[i + 1];
    if (val === undefined) throw new Error(`${flag} requires a value`);
    i += 1;
    if (flag === '--inbox') opts.inbox = path.resolve(val);
    else if (flag === '--sink') opts.sink = path.resolve(val);
    else throw new Error(`unknown flag: ${flag}`);
  }
  return opts;
}

/**
 * Ingest every *.json batch in `inbox`. Zero batches is a healthy no-op (the
 * workflow also runs on schedules). A shipment file may hold one batch or an
 * array of batches (sync-fleet output). Successes move to telemetry/ingested/
 * so an archive listing is the audit trail; failures move to
 * telemetry/rejected/ beside a .reason.txt and never block other files.
 */
export function ingestInbox({ inbox, sink }) {
  const summary = { batches: 0, accepted: 0, rejected: 0, archived: [], parked: [] };
  if (!fs.existsSync(inbox)) return summary;
  const files = fs.readdirSync(inbox).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) return summary;
  fs.mkdirSync(path.dirname(sink), { recursive: true });
  const archive = path.join(path.dirname(inbox), 'ingested');
  const rejected = path.join(path.dirname(inbox), 'rejected');
  for (const file of files) {
    const src = path.join(inbox, file);
    let text;
    try { text = fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, ''); } catch { continue; }
    summary.batches += 1;
    let units = [text];
    try {
      const raw = JSON.parse(text);
      if (Array.isArray(raw)) units = raw.map((b) => JSON.stringify(b));
    } catch { /* leave raw; the collector validator produces the error text */ }
    let batchAccepted = 0;
    let lastError = '';
    let ok = true;
    for (const unit of units) {
      const collector = createCollector({ out: sink });
      const res = collector.ingest(unit, { origin: 'git-inbox' });
      if (res.status === 202) batchAccepted += (res.payload.accepted ?? 0);
      else { ok = false; lastError = JSON.stringify(res.payload ?? { error: `status ${res.status}` }); break; }
    }
    if (ok) {
      fs.mkdirSync(archive, { recursive: true });
      fs.renameSync(src, path.join(archive, file));
      summary.accepted += batchAccepted;
      summary.archived.push(file);
    } else {
      fs.mkdirSync(rejected, { recursive: true });
      fs.renameSync(src, path.join(rejected, file));
      fs.writeFileSync(path.join(rejected, `${file}.reason.txt`), `${new Date().toISOString()} ${lastError}\n`, 'utf8');
      summary.rejected += 1;
      summary.parked.push(file);
    }
  }
  return summary;
}

function runSelfTest() {
  const results = [];
  const check = (name, ok) => results.push([name, ok === true]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-'));
  const inbox = path.join(tmp, 'inbox');
  const sink = path.join(tmp, 'sink.jsonl');
  fs.mkdirSync(inbox, { recursive: true });
  const now = new Date().toISOString();
  const batch = (appId, msg) => JSON.stringify([{ appId, version: null, sentAt: now, entries: [{ ts: now, kind: 'error', message: msg, path: '/intake' }] }]);
  fs.writeFileSync(path.join(inbox, 'telemetry-a.json'), batch('nexus', 'alpha'));
  fs.writeFileSync(path.join(inbox, 'telemetry-b.json'), JSON.stringify({ appId: 'dash', version: null, sentAt: now, entries: [{ ts: now, kind: 'console', message: 'beta', path: '/' }] }));
  const s1 = ingestInbox({ inbox, sink });
  check('two inbox files ingested (array + single batch)', s1.batches === 2 && s1.accepted === 2 && s1.rejected === 0);
  check('inbox drained', fs.readdirSync(inbox).filter((f) => f.endsWith('.json')).length === 0);
  check('batches archived', fs.readdirSync(path.join(tmp, 'ingested')).length === 2);
  check('sink holds both events', fs.readFileSync(sink, 'utf8').trim().split(/\r?\n/).length === 2);
  check('empty inbox is a healthy no-op', ingestInbox({ inbox, sink }).batches === 0);
  fs.writeFileSync(path.join(inbox, 'telemetry-bad.json'), 'not even json');
  const s3 = ingestInbox({ inbox, sink });
  check('reject parked with reason, not fatal', s3.rejected === 1 && fs.existsSync(path.join(tmp, 'rejected', 'telemetry-bad.json.reason.txt')));
  check('archived file never re-ingested', ingestInbox({ inbox, sink }).batches === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
  const passed = results.filter(([, ok]) => ok).length;
  for (const [name, ok] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  console.log(`telemetry-intake self-test: ${passed}/${results.length} passed`);
  return passed === results.length ? 0 : 1;
}

function usage() {
  return [
    'agent_telemetry_intake — ingest telemetry batch shipments from the git inbox',
    '',
    'Usage:',
    '  node .github/agent_telemetry_intake.mjs [--inbox <dir>] [--sink <file>]',
    '  node .github/agent_telemetry_intake.mjs --self-test | --help',
    '',
    'Reads telemetry/inbox/*.json (one batch or an array of batches per file),',
    'ingests each through the mirrored telemetry_collector.mjs into',
    'telemetry/sink.jsonl, archives successes to telemetry/ingested/ and parks',
    'rejections with a reason file in telemetry/rejected/.',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const opts = parseArgv(process.argv.slice(2));
    if (opts.help) console.log(usage());
    else if (opts.selfTest) process.exitCode = runSelfTest();
    else console.log(JSON.stringify(ingestInbox(opts)));
  } catch (err) {
    console.error(`telemetry-intake: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  }
}