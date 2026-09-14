// unified-core v1.0.0 — single model-governance ladder for the whole fleet.
// Fuses three upstream patterns (cross-trained):
//   - model-governor.ps1  : cap-aware FREE-provider rotation + usage ledger
//   - singularity-operator/groq_wrapper.py : offline-fallback result contract
//   - nexus-core/registry.json : module manifest + roles
// Zero dependencies. Node >= 18. Source of truth for the ladder lives HERE;
// manifest.json mirrors it for humans and cross-language twins.

export const VERSION = '1.0.0';

export const MODEL_LADDER = Object.freeze([
  { id: 'cline', model: 'stealth/ox-alpha', cap: 100 },
  { id: 'huggingface', model: 'deepseek-ai/DeepSeek-V4-Flash-0731', cap: 50 },
  { id: 'gemini', model: 'gemini-2.5-flash', cap: 200 },
  { id: 'openrouter', model: 'nvidia/nemotron-3.5-lightning:free', cap: 45 },
  { id: 'openai-compatible', model: 'qwen2.5-coder:3b', cap: 9999 },
]);

export function dateStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// Today-scoped usage ledger (mirrors model-governor's model-usage.json shape).
// `clock` is injectable (-> 'YYYY-MM-DD') so tests and ledger replays can pin
// a date; production callers get the real date via the default.
export class UsageLedger {
  constructor(initial = {}, today = dateStamp(), clock = dateStamp) {
    this.today = today;
    this.clock = clock;
    this.counts = { ...Object.fromEntries(MODEL_LADDER.map((e) => [e.id, 0])), ...initial };
  }
  rollover(today = this.clock()) {
    if (today !== this.today) {
      this.today = today;
      for (const e of MODEL_LADDER) this.counts[e.id] = 0;
    }
    return this;
  }
  record(id, amount = 1) {
    this.rollover();
    this.counts[id] = (this.counts[id] || 0) + amount;
    return this.counts[id];
  }
  used(id) {
    this.rollover();
    return this.counts[id] || 0;
  }
  toJSON() {
    return { date: this.today, counts: { ...this.counts } };
  }
}

// Pick the first usable provider under its daily cap, starting at startAt.
// usable(id) -> boolean (key present, provider wired). Returns null when exhausted.
export function selectProvider({ ledger = new UsageLedger(), usable = () => true, startAt = 0 } = {}) {
  for (let i = 0; i < MODEL_LADDER.length; i++) {
    const idx = (startAt + i) % MODEL_LADDER.length;
    const entry = MODEL_LADDER[idx];
    if (!usable(entry.id)) continue;
    if (ledger.used(entry.id) >= entry.cap) continue;
    return { entry, index: idx };
  }
  return null;
}

// Unified call contract (twin-identical with unified_orchestrator.py):
// { response, provider, model, latency_s, error, ok, fallback, errors }
// Absorb-and-continue ladder: any transport failure/empty output skips to the
// next provider; result is ok:false + fallback:true only when ALL are gone.
export async function callAI(prompt, { transports = {}, ledger = new UsageLedger(), usable, startAt = 0, temperature, maxTokens, system } = {}) {
  const t0 = Date.now();
  const usableFn = usable || ((id) => id in transports);
  const errors = [];
  for (let i = 0; i < MODEL_LADDER.length; i++) {
    const idx = (startAt + i) % MODEL_LADDER.length;
    const entry = MODEL_LADDER[idx];
    if (!usableFn(entry.id)) { errors.push({ provider: entry.id, error: 'unusable' }); continue; }
    if (ledger.used(entry.id) >= entry.cap) { errors.push({ provider: entry.id, error: 'cap-exhausted' }); continue; }
    const transport = transports[entry.id];
    ledger.record(entry.id, 1); // every attempt counts against the cap
    if (!transport) { errors.push({ provider: entry.id, error: 'no transport' }); continue; }
    try {
      const response = String((await transport(prompt, entry.model, { temperature, maxTokens, system })) ?? '').trim();
      if (!response) { errors.push({ provider: entry.id, error: 'empty response' }); continue; }
      return { response, provider: entry.id, model: entry.model, latency_s: (Date.now() - t0) / 1000, error: null, ok: true, fallback: false, errors };
    } catch (e) {
      errors.push({ provider: entry.id, error: String((e && e.message) || e) });
    }
  }
  // Most informative failure: first transport-level error, else last skip reason.
  const SKIP_KINDS = new Set(['unusable', 'no transport', 'cap-exhausted']);
  const meaningful = errors.find((e) => !SKIP_KINDS.has(e.error));
  const last = meaningful ? meaningful.error
    : (errors.length ? errors[errors.length - 1].error : 'all providers exhausted or unusable');
  return {
    response: '[offline-fallback] no free slot with remaining capacity.',
    provider: 'offline', model: 'none', latency_s: (Date.now() - t0) / 1000,
    error: last, ok: false, fallback: true, errors,
  };
}

// Swarm fan-out (multi_ai_orchestrator.py parity): node_i -> result per prompt.
export async function swarm(prompts, opts = {}) {
  const out = {};
  for (let i = 0; i < prompts.length; i++) {
    out[`node_${i}`] = await callAI(prompts[i], opts);
  }
  return out;
}

// Manifest helpers (read-only view over unified-core/manifest.json).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function loadManifest(manifestPath = join(dirname(fileURLToPath(import.meta.url)), 'manifest.json')) {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

export function modulesByRole(manifest, role) {
  return (manifest.modules || []).filter((m) => m.role === role).map((m) => m.name);
}
