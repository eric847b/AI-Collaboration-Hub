'use strict';
/**
 * Continuous free-AI runner (Node).
 * Usage:
 *   npx node run-ai.js            # runs default task once across the pool
 *   npm run ai -- "task one" "task two"   # runs each step, rotating as needed
 *
 * Real usage requires a free API key, e.g. Groq free tier:
 *   set GROQ_API_KEY=...   (Windows) / export GROQ_API_KEY=...
 * Then fallback rotation between providers keeps running without pause.
 */
const { FreeAIRotator } = require('./src/rotator');

// Node transport using the built-in global fetch (Node 18+).
async function nodeRequest(url, { method, headers, body }) {
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* keep {} */ }
  return { status: res.status, json, text };
}

async function main() {
  const rotator = new FreeAIRotator({ request: nodeRequest });
  const steps = process.argv.slice(2).filter(Boolean);
  const task = { steps: steps.length ? steps : ['State in one line: what is the most useful thing you can do for me right now?'] };

  const started = Date.now();
  const results = await rotator.run(task, (r, i) => {
    console.log(`\n[🔄 step ${i + 1}] provider=${r.provider} (calls=${r.tally.calls}, rotations=${r.tally.rotations})`);
    console.log('  ' + (r.text || '(empty)'));
  });
  console.log(`\nDone in ${Date.now() - started}ms → ${results.length} step(s), ${rotator.tally.calls} call(s), ${rotator.tally.rotations} rotation(s).`);
}

main().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});