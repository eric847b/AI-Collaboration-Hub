#!/usr/bin/env node
/**
 * Inspects the production build output (dist/assets) and reports the total
 * bundle size plus the largest chunks. Dependency-free (Node core only) so it
 * runs anywhere npm runs.
 *
 * Usage: node scripts/report-bundle-size.mjs [patterns...]
 *   - No args: scans dist/assets/*.js
 *   - Optional glob-like substrings filter which chunks are counted (e.g. "index", "chart").
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";

const dist = resolve(process.cwd(), "dist", "assets");
const filters = process.argv.slice(2);

if (!exists(dist)) {
  console.error("No production build found. Run 'npm run build' first.");
  process.exit(1);
}

function exists(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

const gzipSize = (p) => gzipSync(readFileSync(p)).length;

const files = readdirSync(dist)
  .filter((f) => f.endsWith(".js"))
  .map((f) => {
    const p = join(dist, f);
    const size = statSync(p).size;
    const gzip = gzipSize(p);
    return { name: f, size, gzip };
  })
  .filter((f) => filters.length === 0 || filters.some((s) => f.name.includes(s)))
  .sort((a, b) => b.size - a.size);

if (files.length === 0) {
  console.error("No matching chunk files found in dist/assets.");
  process.exit(1);
}

const human = (n) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(2)} MB` : `${(n / 1024).toFixed(2)} kB`);

const total = files.reduce((s, f) => s + f.size, 0);
const totalGzip = files.reduce((s, f) => s + f.gzip, 0);

console.log("Bundle size report (dist/assets):");
console.log("---------------------------------");
for (const f of files) {
  console.log(`${human(f.size).padStart(9)}  (gzip ${human(f.gzip).padStart(9)})  ${f.name}`);
}
console.log("---------------------------------");
console.log(`${human(total).padStart(9)}  (gzip ${human(totalGzip).padStart(9)})  TOTAL (${files.length} chunks)`);