#!/usr/bin/env node
// cline-prompt-queue.mjs - manage the autopilot prompt queue
// Usage: node tools/cline-prompt-queue.mjs [add "prompt" | list | clear | remove <n> | stats | json]
//        node tools/cline-prompt-queue.mjs --help | --version
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = path.join(ROOT, '.renitor', 'autopilot-queue.txt');

function readLines() {
  if (!fs.existsSync(QUEUE)) return [];
  return fs.readFileSync(QUEUE, 'utf8').split(/\r?\n/);
}
function writeLines(lines) { fs.writeFileSync(QUEUE, lines.join('\n') + '\n', 'utf8'); }
function tasks() {
  return readLines().map((l, i) => ({ l, i })).filter(x => { const t = x.l.trim(); return t !== '' && !t.startsWith('#'); });
}

const argv = process.argv.slice(2);
const BOOLEAN_FLAGS = new Set(['--help', '-h', '--version', '--count']);
let flags = {};
let positionals = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--help' || a === '-h') { flags['--help'] = true; continue; }
  if (a === '--version') { flags['--version'] = true; continue; }
  if (!a.startsWith('-')) { positionals.push(a); continue; }
  const eq = a.indexOf('=');
  const key = eq >= 0 ? a.slice(0, eq) : a;
  if (!BOOLEAN_FLAGS.has(key) && !VALUE_FLAGS.has(key)) {
    console.error(`cline-prompt-queue: unknown flag "${key}" — see \`node tools/cline-prompt-queue.mjs --help\``);
    process.exit(2);
  }
  if (BOOLEAN_FLAGS.has(key)) {
    if (eq >= 0) { console.error(`cline-prompt-queue: boolean flag "${key}" does not take a value`); process.exit(2); }
    flags[key] = true;
    continue;
  }
  const value = eq >= 0 ? a.slice(eq + 1) : argv[++i];
  if (value === undefined || value === '') { console.error(`cline-prompt-queue: "${key}" requires a value`); process.exit(2); }
  flags[key] = value;
}

if (flags['--help']) {
  console.log(`cline-prompt-queue.mjs — manage the autopilot prompt queue

Usage:
  node tools/cline-prompt-queue.mjs [command] [args]
  node tools/cline-prompt-queue.mjs --help
  node tools/cline-prompt-queue.mjs --version

Commands:
  list              print queued prompts (default)
  json              print queue as JSON
  stats             print queue statistics
  add "prompt"      append a prompt
  clear             reset the queue
  remove <n>        remove the nth prompt (1-based)

Flags:
  --help, -h        show this help and exit 0
  --version         print version and exit 0
  --count           print only the number of queued prompts and exit 0
`);
  process.exit(0);
}
if (flags['--version']) { console.log('cline-prompt-queue 1.1.0'); process.exit(0); }
if (flags['--count']) { console.log(tasks().length); process.exit(0); }

const cmd = positionals[0] || 'list';
const arg = positionals.slice(1).join(' ');

if (cmd === 'list') {
  const t = tasks();
  if (t.length === 0) { console.log('(empty queue)'); process.exit(0); }
  t.forEach((x, n) => console.log(`${n + 1}. ${x.l.trim()}`));
} else if (cmd === 'json') {
  const t = tasks().map(x => x.l.trim());
  console.log(JSON.stringify({ count: t.length, prompts: t }, null, 2));
} else if (cmd === 'stats') {
  const raw = readLines();
  const t = tasks();
  const comments = raw.filter(l => l.trim().startsWith('#')).length;
  const blanks = raw.filter(l => l.trim() === '').length;
  console.log(`total lines: ${raw.length}`);
  console.log(`prompts:     ${t.length}`);
  console.log(`comments:    ${comments}`);
  console.log(`blank:       ${blanks}`);
} else if (cmd === 'add') {
  if (!arg) { console.error('usage: add "prompt"'); process.exit(2); }
  const lines = readLines();
  lines.push(arg);
  writeLines(lines);
  console.log('added:', arg);
} else if (cmd === 'clear') {
  writeLines(['# Autopilot prompt queue']);
  console.log('cleared');
} else if (cmd === 'remove') {
  const idx = parseInt(arg, 10);
  const t = tasks();
  if (!Number.isFinite(idx) || idx < 1 || idx > t.length) { console.error('usage: remove <n> (1..' + t.length + ')'); process.exit(2); }
  const lines = readLines();
  const target = t[idx - 1];
  lines.splice(target.i, 1);
  writeLines(lines);
  console.log('removed:', target.l.trim());
} else {
  console.error('unknown command:', cmd);
  console.error('usage: node tools/cline-prompt-queue.mjs [list|json|stats|add|clear|remove]');
  process.exit(2);
}
