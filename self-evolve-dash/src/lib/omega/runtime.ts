/**
 * ΩCore∞ Autonomous Runtime System v2
 * Persistent, self-optimizing, stealth-capable evolution engine.
 *
 * Public API: window.Ω (also exported)
 *   Ω.r          modules registry
 *   Ω.f          deduplicated function pool (hash -> fn source)
 *   Ω.ingest()   add/normalize a module
 *   Ω.inject()   load external script text and ingest
 *   Ω.evolve()   run one evolution pass
 *   Ω.start()    start background loop
 *   Ω.stop()     stop background loop
 *   Ω.restore()  load persisted state
 *   Ω.persist()  save current state
 *   Ω.history    evolution snapshots
 *   Ω.config     { interval, aggressiveness, log, stealth }
 */

export type OmegaModule = {
  id: string;
  fns: Record<string, string>; // name -> hash
  meta?: Record<string, unknown>;
};

export type OmegaSnapshot = {
  t: number;
  version: number;
  size: number;
  modules: number;
  uniqueFns: number;
  totalFns: number;
  dedupRate: number;
  stable: boolean;
};

type Cfg = {
  interval: number;
  aggressiveness: number; // 0..1
  log: boolean;
  stealth: boolean;
  storageKey: string;
};

const DEFAULT_CFG: Cfg = {
  interval: 5000,
  aggressiveness: 0.5,
  log: false,
  stealth: true,
  storageKey: "ΩCore.v2",
};

// --- Stable hash (FNV-1a 32-bit, hex) ------------------------------------
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// --- Function source normalization ---------------------------------------
// Strips comments, whitespace, and renames identifiers to detect logic
// equivalence across cosmetic differences.
function normalizeFnSource(src: string): string {
  let s = src
    // strip block comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // strip line comments
    .replace(/\/\/.*$/gm, "")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Extract param list and body
  const arrowMatch = s.match(/^(?:function\s*\w*)?\s*\(([^)]*)\)\s*(?:=>)?\s*\{?([\s\S]*?)\}?$/);
  let params: string[] = [];
  let body = s;
  if (arrowMatch) {
    params = arrowMatch[1].split(",").map((p) => p.trim()).filter(Boolean);
    body = arrowMatch[2] || s;
  }

  // Rename params -> $0,$1,...
  const renamed = body.replace(/\b([A-Za-z_$][\w$]*)\b/g, (m) => {
    const idx = params.indexOf(m);
    if (idx >= 0) return `$${idx}`;
    return m;
  });
  return `(${params.length})${renamed}`;
}

// --- Deterministic execution probe ---------------------------------------
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return false;
      if (!deepEqual((a as Record<string, unknown>)[ka[i]], (b as Record<string, unknown>)[kb[i]])) return false;
    }
    return true;
  }
  return false;
}

function probeEquivalent(srcA: string, srcB: string): boolean {
  if (srcA === srcB) return true;
  // Try a few sample inputs; only meaningful for pure numeric/array fns.
  const samples = [[], [0], [1], [-1, 2], ["a"], [[1, 2, 3]]];
  let fa: Function, fb: Function;
  try {
    fa = reconstruct(srcA);
    fb = reconstruct(srcB);
  } catch {
    return false;
  }
  for (const args of samples) {
    let ra: unknown, rb: unknown, ea = false, eb = false;
    try { ra = fa(...args); } catch { ea = true; }
    try { rb = fb(...args); } catch { eb = true; }
    if (ea !== eb) return false;
    if (!ea && !deepEqual(ra, rb)) return false;
  }
  return true;
}

// --- Safe-ish reconstruction (no direct eval) ----------------------------
// Uses Function constructor — still dynamic, but avoids `eval` and runs in
// the global lexical scope, preventing local-scope leakage.
function reconstruct(src: string): Function {
  const trimmed = src.trim();
  // Arrow or function expression
  // Wrap in parens and return.
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${trimmed});`)();
}

// --- Storage abstraction (localStorage, IDB-ready) -----------------------
const storage = {
  get(key: string): string | null {
    try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null; }
    catch { return null; }
  },
  set(key: string, val: string): void {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(key, val); } catch { /* quota */ }
  },
};

// --- Core state ----------------------------------------------------------
class OmegaCore {
  r: Record<string, OmegaModule> = {};
  f: Record<string, string> = {}; // hash -> normalized source
  fSrc: Record<string, string> = {}; // hash -> original source (for reconstruct)
  history: OmegaSnapshot[] = [];
  version = 0;
  config: Cfg = { ...DEFAULT_CFG };
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastStableState: string | null = null;

  constructor(cfg?: Partial<Cfg>) {
    if (cfg) Object.assign(this.config, cfg);
    this.restore();
  }

  // --- logging ----------------------------------------------------------
  private log(...a: unknown[]) {
    if (this.config.log && !this.config.stealth) console.debug("[Ω]", ...a);
    else if (this.config.log) console.debug("[Ω]", ...a);
  }

  // --- ingestion --------------------------------------------------------
  ingest(id: string, fns: Record<string, Function | string>, meta?: Record<string, unknown>): OmegaModule {
    const mod: OmegaModule = { id, fns: {}, meta };
    for (const [name, fn] of Object.entries(fns)) {
      const src = typeof fn === "string" ? fn : fn.toString();
      const norm = normalizeFnSource(src);
      const hash = fnv1a(norm);
      if (!this.f[hash]) {
        this.f[hash] = norm;
        this.fSrc[hash] = src;
      } else {
        // Equivalence verification before collapsing
        if (!probeEquivalent(this.fSrc[hash], src)) {
          // hash collision on normalization but behavior differs — keep separate
          const altHash = fnv1a(norm + "|" + src);
          this.f[altHash] = norm;
          this.fSrc[altHash] = src;
          mod.fns[name] = altHash;
          continue;
        }
      }
      mod.fns[name] = hash;
    }
    this.r[id] = mod;
    this.log("ingest", id, Object.keys(fns).length);
    return mod;
  }

  /** Inject and normalize an external script payload. Expects a CommonJS-ish
   *  object literal: `{ fnA: function(){...}, fnB: (x)=>x }`. */
  inject(id: string, scriptText: string, meta?: Record<string, unknown>): OmegaModule | null {
    try {
      const obj = reconstruct(scriptText);
      if (!obj || typeof obj !== "object") return null;
      return this.ingest(id, obj as Record<string, Function>, meta);
    } catch (e) {
      this.log("inject failed", id, e);
      return null;
    }
  }

  /** Reconstruct a callable from a hash. */
  call(hash: string): Function | null {
    const src = this.fSrc[hash];
    if (!src) return null;
    try { return reconstruct(src); } catch { return null; }
  }

  // --- evolution --------------------------------------------------------
  evolve(): OmegaSnapshot {
    const before = this.snapshot();
    const aggressiveness = Math.max(0, Math.min(1, this.config.aggressiveness));

    // Pass 1: re-check duplicates by deeper probe across the pool.
    const hashes = Object.keys(this.fSrc);
    const merged = new Map<string, string>(); // oldHash -> canonicalHash
    for (let i = 0; i < hashes.length; i++) {
      const a = hashes[i];
      if (merged.has(a)) continue;
      for (let j = i + 1; j < hashes.length; j++) {
        const b = hashes[j];
        if (merged.has(b)) continue;
        // skip expensive probe if aggressiveness low
        if (aggressiveness < 0.3 && this.f[a] !== this.f[b]) continue;
        if (this.f[a] === this.f[b] || probeEquivalent(this.fSrc[a], this.fSrc[b])) {
          merged.set(b, a);
        }
      }
    }
    if (merged.size > 0) {
      for (const [oldH, newH] of merged) {
        delete this.f[oldH];
        delete this.fSrc[oldH];
        for (const mod of Object.values(this.r)) {
          for (const k of Object.keys(mod.fns)) {
            if (mod.fns[k] === oldH) mod.fns[k] = newH;
          }
        }
      }
    }

    this.version++;
    const after = this.snapshot();

    // Stability check: ensure module->fn mapping still resolves.
    const stable = Object.values(this.r).every((m) =>
      Object.values(m.fns).every((h) => !!this.fSrc[h])
    );
    after.stable = stable;

    if (!stable) {
      // rollback
      this.log("rollback: instability detected");
      if (this.lastStableState) {
        this.loadStateString(this.lastStableState);
        return before;
      }
    } else {
      this.lastStableState = this.serializeState();
    }

    this.history.push(after);
    if (this.history.length > 200) this.history.shift();
    this.persist();
    this.log("evolve", `v${this.version}`, "dedup", merged.size, "rate", after.dedupRate.toFixed(3));
    return after;
  }

  // --- snapshots / metrics ---------------------------------------------
  private snapshot(): OmegaSnapshot {
    const totalFns = Object.values(this.r).reduce((n, m) => n + Object.keys(m.fns).length, 0);
    const uniqueFns = Object.keys(this.f).length;
    const size = JSON.stringify({ r: this.r, f: this.f, s: this.fSrc }).length;
    return {
      t: Date.now(),
      version: this.version,
      size,
      modules: Object.keys(this.r).length,
      uniqueFns,
      totalFns,
      dedupRate: totalFns ? 1 - uniqueFns / totalFns : 0,
      stable: true,
    };
  }

  // --- evolution loop ---------------------------------------------------
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try { this.evolve(); } catch (e) { this.log("evolve error", e); }
    }, this.config.interval);
    this.log("started", this.config.interval);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.log("stopped");
  }

  // --- persistence ------------------------------------------------------
  private serializeState(): string {
    return JSON.stringify({
      v: this.version,
      r: this.r,
      f: this.f,
      s: this.fSrc,
      h: this.history,
      c: this.config,
    });
  }

  private loadStateString(raw: string): void {
    try {
      const o = JSON.parse(raw);
      this.version = o.v || 0;
      this.r = o.r || {};
      this.f = o.f || {};
      this.fSrc = o.s || {};
      this.history = o.h || [];
      if (o.c) Object.assign(this.config, o.c);
    } catch { /* corrupt state — ignore */ }
  }

  persist(): void {
    storage.set(this.config.storageKey, this.serializeState());
  }

  restore(): void {
    const raw = storage.get(this.config.storageKey);
    if (raw) {
      this.loadStateString(raw);
      this.lastStableState = raw;
      this.log("restored v" + this.version);
    }
  }

  reset(): void {
    this.r = {}; this.f = {}; this.fSrc = {}; this.history = []; this.version = 0;
    this.lastStableState = null;
    this.persist();
  }
}

// --- Singleton + window binding ------------------------------------------
export const Ω = new OmegaCore();
export default Ω;

if (typeof window !== "undefined") {
  // Stealth: attach but do not announce.
  (window as unknown as Record<string, unknown>).Ω = Ω;
  (window as unknown as Record<string, unknown>).OmegaCore = Ω;
}
