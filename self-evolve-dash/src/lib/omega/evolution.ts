// Ω∞ Autonomous Compression Core — Evolution Engine
// Lossless mutation, validation (sandboxed exec), fitness scoring.

export type MutationKind =
  | "rename-vars"
  | "strip-comments"
  | "collapse-whitespace"
  | "inline-const"
  | "shorten-keywords"
  | "merge-declarations"
  | "remove-blocks"
  | "arrow-convert";

export interface Mutation {
  kind: MutationKind;
  label: string;
  delta: number; // chars saved
}

export interface Genome {
  id: string;
  code: string;
  size: number;
  execMs: number;
  memBytes: number;
  outputHash: string;
  fitness: number;
  parentId?: string;
  mutations: Mutation[];
  generation: number;
  checksum: string;
  createdAt: number;
  valid: boolean;
}

export interface Generation {
  index: number;
  candidates: Genome[];
  best: Genome;
  improvement: number; // % size reduction vs prev best
}

// ----- Hashing -----
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function checksum(code: string): string {
  return `Ω${fnv1a(code)}-${fnv1a(code.split("").reverse().join(""))}`;
}

// ----- Sandbox executor -----
// Captures console.log + return value as behavior signature.
export interface ExecResult {
  hash: string;
  ms: number;
  mem: number;
  ok: boolean;
  error?: string;
  output: string;
}

export function sandboxExec(code: string, input?: unknown): ExecResult {
  const logs: string[] = [];
  const fakeConsole = {
    log: (...a: unknown[]) => logs.push(a.map(safeStr).join(" ")),
    warn: (...a: unknown[]) => logs.push("warn:" + a.map(safeStr).join(" ")),
    error: (...a: unknown[]) => logs.push("err:" + a.map(safeStr).join(" ")),
  };
  const start = performance.now();
  let memBefore = 0, memAfter = 0;
  // @ts-expect-error perf.memory non-standard
  if (performance.memory) memBefore = performance.memory.usedJSHeapSize;
  let ok = true;
  let error: string | undefined;
  let result: unknown = undefined;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("console", "input", `"use strict";\n${code}\n;return typeof __main==='function'?__main(input):undefined;`);
    result = fn(fakeConsole, input);
  } catch (e) {
    ok = false;
    error = (e as Error).message;
  }
  const ms = performance.now() - start;
  // @ts-expect-error perf.memory non-standard
  if (performance.memory) memAfter = performance.memory.usedJSHeapSize;
  const output = logs.join("\n") + "::" + safeStr(result);
  return {
    hash: fnv1a(output),
    ms,
    mem: Math.max(0, memAfter - memBefore),
    ok,
    error,
    output,
  };
}

function safeStr(v: unknown): string {
  try {
    if (typeof v === "function") return "[fn]";
    return JSON.stringify(v);
  } catch { return String(v); }
}

// ----- Mutation operators (lossless-targeted) -----

const RESERVED = new Set([
  "if","else","for","while","do","return","var","let","const","function","true","false","null",
  "undefined","new","this","typeof","instanceof","in","of","break","continue","switch","case",
  "default","try","catch","finally","throw","class","extends","super","import","export","from",
  "as","async","await","yield","void","delete","console","log","Math","JSON","Object","Array",
  "String","Number","Boolean","Date","__main","input","performance","window","document",
]);

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function collapseWhitespace(code: string): string {
  return code
    .replace(/[ \t]+/g, " ")
    .replace(/ ?([{}();,=+\-*/<>!&|?:])\s*/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim();
}

function renameVars(code: string): string {
  // Find identifiers declared via let/const/var and rename to short tokens.
  const decl = /\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = decl.exec(code))) if (!RESERVED.has(m[1])) names.add(m[1]);
  // Also function params
  const fn = /function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g;
  while ((m = fn.exec(code))) {
    m[1].split(",").map(s => s.trim()).forEach(n => {
      if (n && /^[A-Za-z_$][\w$]*$/.test(n) && !RESERVED.has(n)) names.add(n);
    });
  }
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let i = 0;
  const map: Record<string, string> = {};
  for (const n of sorted) {
    let s = "";
    let x = i++;
    do { s = alphabet[x % 26] + s; x = Math.floor(x / 26) - 1; } while (x >= 0);
    if (!RESERVED.has(s) && s.length < n.length) map[n] = s;
  }
  let out = code;
  for (const [from, to] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }
  return out;
}

function mergeDeclarations(code: string): string {
  // const a=1; const b=2; -> const a=1,b=2;
  return code.replace(
    /\b(let|const|var)\s+([^;]+);\s*\1\s+([^;]+);/g,
    (_, k, a, b) => `${k} ${a},${b};`
  );
}

function arrowConvert(code: string): string {
  // function name(args){return X;} -> const name=(args)=>X;
  return code.replace(
    /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{\s*return\s+([^;}]+);?\s*\}/g,
    (_, n, a, body) => `const ${n}=(${a})=>${body.trim()};`
  );
}

function removeEmptyBlocks(code: string): string {
  return code.replace(/\{\s*\}/g, "{}").replace(/;\s*;/g, ";");
}

function inlineConst(code: string): string {
  // const X = "literal"; replace usages if used <=2 times.
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)\s*;/g;
  let out = code;
  let m: RegExpExecArray | null;
  const decls: { name: string; val: string; full: string }[] = [];
  while ((m = re.exec(code))) decls.push({ name: m[1], val: m[2], full: m[0] });
  for (const d of decls) {
    const usage = new RegExp(`\\b${d.name}\\b`, "g");
    const count = (out.match(usage) || []).length;
    // count includes declaration itself
    if (count <= 3 && d.val.length + 1 <= d.name.length * (count - 1)) {
      out = out.replace(d.full, "");
      out = out.replace(usage, d.val);
    }
  }
  return out;
}

function shortenKeywords(code: string): string {
  // 'return true' -> 'return!0' style is risky; keep safe ones:
  return code
    .replace(/\breturn\s+true\b/g, "return!0")
    .replace(/\breturn\s+false\b/g, "return!1")
    .replace(/\b!==\s*null\s*&&\s*\w+\s*!==\s*undefined\b/g, (s) => s); // noop placeholder
}

const OPS: { kind: MutationKind; label: string; fn: (s: string) => string }[] = [
  { kind: "strip-comments", label: "strip comments", fn: stripComments },
  { kind: "collapse-whitespace", label: "collapse whitespace", fn: collapseWhitespace },
  { kind: "merge-declarations", label: "merge declarations", fn: mergeDeclarations },
  { kind: "arrow-convert", label: "arrow conversion", fn: arrowConvert },
  { kind: "remove-blocks", label: "remove empty blocks", fn: removeEmptyBlocks },
  { kind: "inline-const", label: "inline constants", fn: inlineConst },
  { kind: "shorten-keywords", label: "shorten keywords", fn: shortenKeywords },
  { kind: "rename-vars", label: "rename variables", fn: renameVars },
];

// Generate N candidate variants by applying random subsets of operators in random order.
export function generateVariants(code: string, count = 6): { code: string; mutations: Mutation[] }[] {
  const variants: { code: string; mutations: Mutation[] }[] = [];
  for (let i = 0; i < count; i++) {
    const order = [...OPS].sort(() => Math.random() - 0.5);
    const subset = order.slice(0, 3 + Math.floor(Math.random() * (OPS.length - 3)));
    let cur = code;
    const muts: Mutation[] = [];
    for (const op of subset) {
      const before = cur.length;
      const next = op.fn(cur);
      const delta = before - next.length;
      if (delta > 0 || Math.random() < 0.2) {
        muts.push({ kind: op.kind, label: op.label, delta });
        cur = next;
      }
    }
    variants.push({ code: cur, mutations: muts });
  }
  return variants;
}

// ----- Genome construction & fitness -----
export interface FitnessWeights { size: number; speed: number; mem: number; }
export const DEFAULT_WEIGHTS: FitnessWeights = { size: 0.7, speed: 0.2, mem: 0.1 };

export function buildGenome(opts: {
  code: string;
  baselineHash: string;
  baselineSize: number;
  baselineMs: number;
  parentId?: string;
  mutations: Mutation[];
  generation: number;
  weights?: FitnessWeights;
}): Genome {
  const { code, baselineHash, baselineSize, baselineMs, parentId, mutations, generation } = opts;
  const w = opts.weights ?? DEFAULT_WEIGHTS;
  const exec = sandboxExec(code);
  const valid = exec.ok && exec.hash === baselineHash;
  const sizeScore = baselineSize > 0 ? Math.max(0, (baselineSize - code.length) / baselineSize) : 0;
  const speedScore = baselineMs > 0 ? Math.max(0, Math.min(1, (baselineMs - exec.ms) / baselineMs + 0.5)) : 0.5;
  const memScore = exec.mem > 0 ? 0.5 : 1;
  const fitness = valid ? sizeScore * w.size + speedScore * w.speed + memScore * w.mem : -1;
  return {
    id: crypto.randomUUID(),
    code,
    size: code.length,
    execMs: +exec.ms.toFixed(3),
    memBytes: exec.mem,
    outputHash: exec.hash,
    fitness: +fitness.toFixed(4),
    parentId,
    mutations,
    generation,
    checksum: checksum(code),
    createdAt: Date.now(),
    valid,
  };
}

// Run a generation cycle starting from `parent`, return new generation record.
export function evolveOnce(parent: Genome, baselineHash: string, baselineSize: number, baselineMs: number, generationIndex: number, weights = DEFAULT_WEIGHTS, candidateCount = 6): Generation {
  const variants = generateVariants(parent.code, candidateCount);
  const candidates = variants.map(v =>
    buildGenome({
      code: v.code,
      baselineHash,
      baselineSize,
      baselineMs,
      parentId: parent.id,
      mutations: v.mutations,
      generation: generationIndex,
      weights,
    })
  );
  // Always include parent as floor
  candidates.push({ ...parent, generation: generationIndex });
  const valid = candidates.filter(c => c.valid);
  const pool = valid.length ? valid : candidates;
  const best = pool.reduce((a, b) => (b.fitness > a.fitness ? b : a));
  const improvement = parent.size > 0 ? ((parent.size - best.size) / parent.size) * 100 : 0;
  return {
    index: generationIndex,
    candidates,
    best,
    improvement: +improvement.toFixed(2),
  };
}

// Sample seed code (acts as the kernel itself, in compressible form)
export const SEED_KERNEL = `// Ω∞ Sample Kernel — fibonacci & sum demo
function __main(input) {
  // Compute sum of first N fibonacci numbers
  const n = (input && input.n) || 12;
  let prev = 0;
  let curr = 1;
  let total = 0;
  for (let i = 0; i < n; i = i + 1) {
    total = total + curr;
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
  console.log("fib-sum", n, total);
  return { n: n, total: total };
}`;
