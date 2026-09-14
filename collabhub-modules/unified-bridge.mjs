// collabhub-modules -> unified-core bridge (ESM). Node >= 18, zero deps.
// Re-exports the single source of truth; no rotation logic here.
// Source of truth: <repo-root>/unified-core/orchestrator.mjs
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = join(dirname(fileURLToPath(import.meta.url)), '..', 'unified-core', 'orchestrator.mjs');

let unified = null;
try {
  unified = await import(pathToFileURL(CORE).href);
} catch (e) {
  console.warn(`[unified-bridge] unified-core not reachable (${e.message}); running degraded.`);
}

function guard(fn) {
  return (...args) => {
    if (!unified) throw new Error('[unified-bridge] unified-core not linked — cannot ' + fn);
    return unified[fn](...args);
  };
}

export const VERSION = unified ? unified.VERSION : 'unlinked';
export const selectProvider = guard('selectProvider');
export const callAI = guard('callAI');
export const swarm = guard('swarm');
export const UsageLedger = unified ? unified.UsageLedger : undefined;
export const loadManifest = unified ? unified.loadManifest : undefined;
export default unified;
