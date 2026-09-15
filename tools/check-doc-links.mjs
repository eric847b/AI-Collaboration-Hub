import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * check-doc-links.mjs — verifies that every relative link in tracked Markdown files
 * resolves to a real file in this workspace. Catches stale doc references after
 * moves/renames/deletions (the exact failure mode of the 2026-09 doc consolidation).
 *
 *   node tools/check-doc-links.mjs            # report + exit 1 on broken links
 *   node tools/check-doc-links.mjs --quiet    # only print broken links
 *
 * Skips: node_modules/.git/build/dist/.venv/docs/api (generated), external URLs, pure anchors.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quiet = process.argv.includes('--quiet');
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', '.venv', '.output', 'AppData',
  'docs/api', '.vexp', '.renitor', '.pytest_cache', '.ruff_cache',
  'modular-hub-modernization',
]);
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isMarkdown(file) {
  return /\.(md|mdx)$/i.test(file);
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const rel = path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/');
      if (SKIP_DIRS.has(e.name) || SKIP_DIRS.has(rel) || e.name.startsWith('.')) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && isMarkdown(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

const files = walk(ROOT, []);
let broken = 0;
let checked = 0;
for (const file of files) {
  const relFile = path.relative(ROOT, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('#') || /^[a-z]+:/i.test(raw)) continue; // anchors, http(s):, mailto:, etc.
    const target = decodeURIComponent(raw.split('#')[0]);
    if (!target) continue;
    checked += 1;
    const abs = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(abs)) {
      broken += 1;
      console.log(`BROKEN  ${relFile}  ->  ${raw}`);
    }
  }
}
if (!quiet) console.log(`\ncheck-doc-links: ${files.length} markdown files, ${checked} relative links checked, ${broken} broken`);
process.exit(broken > 0 ? 1 : 0);
