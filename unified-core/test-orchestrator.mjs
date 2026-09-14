// unified-core test harness — run: node unified-core/test-orchestrator.mjs
// Zero dependencies (node:assert + top-level await, Node >= 18).
import assert from 'node:assert/strict';
import {
  VERSION, MODEL_LADDER, dateStamp, UsageLedger, selectProvider,
  callAI, swarm, loadManifest, modulesByRole,
} from './orchestrator.mjs';

const tests = [];
const t = (name, fn) => tests.push([name, fn]);

console.log(`unified-core ${VERSION} — test-orchestrator.mjs`);

// --- pure helpers -------------------------------------------------------
t('dateStamp returns YYYY-MM-DD', () => {
  assert.equal(dateStamp(new Date('2026-09-27T12:00:00Z')), '2026-09-27');
});

t('UsageLedger record/used accumulates', () => {
  const l = new UsageLedger();
  l.record('cline');
  l.record('cline', 2);
  assert.equal(l.used('cline'), 3);
});

t('UsageLedger rollover resets counts on new day (clock-driven)', () => {
  const l = new UsageLedger({ cline: 50 }, '2026-01-01', () => '2026-01-02');
  l.rollover();
  assert.equal(l.used('cline'), 0);
  assert.equal(l.today, '2026-01-02');
});

t('UsageLedger explicit rollover(date) resets and stays pinned', () => {
  const l = new UsageLedger({ cline: 50 }, '2026-01-01', () => '2026-01-01');
  l.rollover('2026-01-02');
  assert.equal(l.today, '2026-01-02');
  assert.equal(l.counts.cline, 0);
  l.record('cline');
  assert.equal(l.used('cline'), 1);
});

// --- selection ----------------------------------------------------------
t('selectProvider skips capped providers', () => {
  const l = new UsageLedger({ cline: 100 });
  assert.equal(selectProvider({ ledger: l }).entry.id, 'huggingface');
});

t('selectProvider respects usable()', () => {
  const pick = selectProvider({ ledger: new UsageLedger(), usable: (id) => id === 'gemini' });
  assert.equal(pick.entry.id, 'gemini');
});

t('selectProvider rotates with startAt', () => {
  assert.equal(selectProvider({ startAt: 3 }).entry.id, 'openrouter');
});

t('selectProvider returns null when exhausted', () => {
  const full = Object.fromEntries(MODEL_LADDER.map((e) => [e.id, e.cap]));
  assert.equal(selectProvider({ ledger: new UsageLedger(full) }), null);
});

// --- callAI contract ----------------------------------------------------
t('callAI success contract (groq_wrapper-compatible)', async () => {
  const ledger = new UsageLedger();
  const r = await callAI('ping', { ledger, transports: { gemini: async () => '  pong  ' } });
  assert.equal(r.ok, true);
  assert.equal(r.response, 'pong');
  assert.equal(r.provider, 'gemini');
  assert.equal(r.model, 'gemini-2.5-flash');
  assert.equal(r.error, null);
  assert.equal(ledger.used('gemini'), 1);
});

t('callAI absorbs transport failure, walks full ladder (never raises)', async () => {
  const r = await callAI('ping', {
    transports: { gemini: async () => { throw new Error('kaput'); } },
  });
  assert.equal(r.ok, false);
  assert.equal(r.fallback, true);
  assert.ok(r.response.startsWith('[offline-fallback]'));
  assert.equal(r.error, 'kaput'); // first non-skip failure is surfaced
  assert.equal(r.errors.length, MODEL_LADDER.length); // every rung visited
});

t('callAI pins ledger clock (testability)', async () => {
  const l = new UsageLedger({}, '2026-01-01', () => '2026-01-01');
  l.record('cline', 9);
  assert.equal(l.used('cline'), 9);
  assert.equal(l.today, '2026-01-01');
});

t('callAI offline-fallback when exhausted', async () => {
  const full = Object.fromEntries(MODEL_LADDER.map((e) => [e.id, e.cap]));
  const r = await callAI('ping', { ledger: new UsageLedger(full), transports: {} });
  assert.equal(r.ok, false);
  assert.ok(r.response.startsWith('[offline-fallback]'));
});

t('callAI records empty response as error', async () => {
  const r = await callAI('ping', { transports: { gemini: async () => '   ' } });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'empty response');
});

// --- swarm --------------------------------------------------------------
t('swarm fans out node_i keys', async () => {
  const nodes = await swarm(['a', 'b'], { transports: { cline: async (p) => p.toUpperCase() } });
  assert.deepEqual(Object.keys(nodes), ['node_0', 'node_1']);
  assert.equal(nodes.node_0.response, 'A');
  assert.equal(nodes.node_1.response, 'B');
});

// --- manifest parity ----------------------------------------------------
t('manifest model_ladder mirrors MODEL_LADDER exactly', () => {
  const m = loadManifest();
  assert.deepEqual(m.model_ladder, MODEL_LADDER.map(({ id, model, cap }) => ({ id, model, cap })));
});

t('modulesByRole resolves governance -> unified-core', () => {
  const m = loadManifest();
  assert.deepEqual(modulesByRole(m, 'governance'), ['unified-core']);
});

t('manifest cross_training bridges all exist on disk', async () => {
  const { stat } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const bridges = Object.values(loadManifest().cross_training.bridges);
  for (const rel of bridges) await stat(join(root, rel)); // throws -> FAIL
});

// --- runner -------------------------------------------------------------
let passed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${passed}/${tests.length} tests passed`);
