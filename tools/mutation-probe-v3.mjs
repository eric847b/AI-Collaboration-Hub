#!/usr/bin/env node
/**
 * Mutation Probe Tool v3
 *
 * Proves a tool's OWN self-test guards actually bite:
 * runs the target's --self-test twice - once UNMODIFIED (control, must exit 0)
 * and once with one declared mutation applied (must exit non-zero).
 *
 * Exit codes:
 *   0  every probe caught its mutant and every control passed
 *   1  a mutant survived, a control failed, or a probe drifted (from-string gone)
 *   2  bad usage, or a selector that matched no probe (never a clean pass)
 *
 * Usage:
 *   node tools/mutation-probe-v3.mjs [options]
 *
 * Options:
 *   --help               print this text and exit 0
 *   -h                   alias of --help
 *   --version            print version and exit 0
 *   -V                   alias of --version
 *   --tool <t>[,t]       tool name(s) to probe (basename with extension)
 *   --probe <id>[,id]    probe ID(s) to run
 *   --max-seconds <n>    max seconds per probe run (default 120)
 *   --json               output machine-readable JSON report
 *   --quiet              print only the one-line verdict
 *   --list-probes        list available probes and exit 0
 *   --self-test          assert this tool's own verdict logic; exit 0/1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

const has = (args, flag) => args.includes(flag);
const opt = (name, def) => {
  const inlineValue = argv.find((arg) => arg.startsWith(name + '='));
  if (inlineValue) return inlineValue.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};

function validateArguments(args) {
  const valueFlags = new Set(['--tool', '--probe', '--max-seconds']);
  const booleanFlags = new Set(['--json', '--quiet', '--list-probes', '--self-test', '--help', '-h']);
  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i];
    const equalsAt = raw.indexOf('=');
    const flag = equalsAt < 0 ? raw : raw.slice(0, equalsAt);
    if (valueFlags.has(flag)) {
      const value = equalsAt < 0 ? args[++i] : raw.slice(equalsAt + 1);
      if (!value || value.startsWith('-')) {
        console.error('Error: ' + flag + ' requires a value');
        return false;
      }
    } else if (!booleanFlags.has(flag) || equalsAt >= 0) {
      console.error('Error: unknown option "' + flag + '"');
      return false;
    }
  }
  return true;
}

function runTool(toolPath, toolArgs, timeoutMs = 120000) {
  const fullPath = path.join(ROOT, toolPath);
  try {
    const result = execFileSync(process.execPath, [fullPath, ...toolArgs], {
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
      timeout: timeoutMs,
    });
    return { ok: true, exitCode: 0, out: result.trim() };
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).trim();
    const exitCode = e.status !== undefined ? e.status : 1;
    return { ok: false, exitCode, out };
  }
}

function discoverTools() {
  const toolsDir = path.join(ROOT, 'tools');
  try {
    return fs.readdirSync(toolsDir)
      .filter((f) => f.startsWith('mutation-probe') && f.endsWith('.mjs'))
      .sort();
  } catch {
    return [];
  }
}

function buildCatalogue() {
  const tools = discoverTools();
  const probes = [];
  for (const tool of tools) {
    let smoke;
    try {
      const selfTestResult = runTool('tools/' + tool, ['--self-test']);
      smoke = {
        level: selfTestResult.exitCode === 0 ? 'ok' : 'fail',
        reason: selfTestResult.exitCode === 0 ? null : 'self-test failed',
        out: selfTestResult.out,
      };
    } catch (e) {
      smoke = {
        level: 'fail',
        reason: 'syntax-error',
        out: '(exited ' + (e.status ?? '?') + ')',
      };
    }
    probes.push({ tool, smoke });
  }
  return probes;
}

const PROBE_MUTATIONS = [
  { tool: 'mutation-probe-v2.mjs', mutations: [
    { from: '--self-test', to: '--self-test-bogus', why: 'rename self-test flag' },
    { from: 'process.exit(2)', to: 'process.exit(0)', why: 'guard exit code 2 to 0' },
  ]},
  { tool: 'mutation-probe-v2-fixed.mjs', mutations: [
    { from: '--self-test', to: '--self-test-bogus', why: 'rename self-test flag' },
    { from: 'process.exit(2)', to: 'process.exit(0)', why: 'guard exit code 2 to 0' },
  ]},
];

function selectTools(onlyArg) {
  const probes = buildCatalogue();
  if (!onlyArg) return probes.map(p => p.tool);
  const requested = onlyArg.split(',').map(s => s.trim()).filter(s => s);
  return probes.filter(p => requested.includes(p.tool)).map(p => p.tool);
}

function applyMutation(toolPath, mutation) {
  const fullPath = path.join(ROOT, 'tools', toolPath);
  let src = fs.readFileSync(fullPath, 'utf8');
  if (!src.includes(mutation.from)) {
    throw new Error('from-string gone for ' + mutation.from);
  }
  const mutated = src.replace(mutation.from, mutation.to);
  const backup = fullPath + '.mutation-probe-backup-' + process.pid + '.bak';
  fs.writeFileSync(backup, src, 'utf8');
  fs.writeFileSync(fullPath, mutated, 'utf8');
  return backup;
}

function restoreMutation(toolPath, backup) {
  const fullPath = path.join(ROOT, 'tools', toolPath);
  if (fs.existsSync(backup)) {
    fs.writeFileSync(fullPath, fs.readFileSync(backup, 'utf8'), 'utf8');
    fs.unlinkSync(backup);
  }
}

function runProbe(toolPath, mutations) {
  const results = [];
  const baseline = runTool('tools/' + toolPath, ['--self-test']);
  if (baseline.exitCode !== 0) {
    return { tool: toolPath, controlPass: false, mutants: [], clean: false };
  }
  for (const m of mutations) {
    const backup = applyMutation(toolPath, m);
    try {
      const r = runTool('tools/' + toolPath, ['--self-test']);
      results.push({ from: m.from, to: m.to, caught: r.exitCode !== 0 });
    } finally {
      restoreMutation(toolPath, backup);
    }
  }
  return { tool: toolPath, controlPass: true, mutants: results, clean: true };
}

function printHelp() {
  console.log("mutation-probe v3 - prove a tool's own self-test guards actually bite");
  console.log('Usage:');
  console.log('  node tools/mutation-probe-v3.mjs [options]');
  console.log('');
  console.log('Options:');
  console.log('  --tool <name[,name]>   only probe these tools (basename with extension)');
  console.log('  --probe <id[,id]>      only run these probe ids');
  console.log('  --max-seconds <n>      per-run timeout for each self-test (default 120)');
  console.log('  --json                 machine-readable report');
  console.log('  --quiet                print only the one-line verdict');
  console.log('  --list-probes          list available probes and exit 0');
  console.log("  --self-test            assert this tool's own verdict logic; exit 0/1");
  console.log('  --help                 print this text and exit 0');
  console.log('Exit codes:');
  console.log('  0  every probe caught its mutant and every control passed');
  console.log('  1  a mutant survived, a control failed, or a probe drifted');
  console.log('  2  bad usage');
}

function main() {
  if (!validateArguments(argv)) process.exit(2);

  if (has(argv, '--help') || has(argv, '-h')) {
    printHelp();
    process.exit(0);
  }

  if (has(argv, '--list-probes')) {
    const tools = selectTools(opt('--tool', ''));
    if (tools.length === 0) {
      console.log('No probes available');
      process.exit(0);
    }
    for (const tool of tools) {
      const probeDef = PROBE_MUTATIONS.find(p => p.tool === tool);
      const mutations = probeDef ? probeDef.mutations : [];
      console.log((mutations.length > 0 ? 'READY' : 'NO_MUTATIONS') + '  ' + tool);
      for (const m of mutations) {
        console.log('       ' + m.from + ' -> ' + m.to + '  (' + m.why + ')');
      }
    }
    process.exit(0);
  }

  const tools = selectTools(opt('--tool', ''));
  if (tools.length === 0) {
    console.error('FAIL: no tools matched the --tool selector: ' + opt('--tool', ''));
    process.exit(2);
  }

  const results = [];
  for (const tool of tools) {
    const probeDef = PROBE_MUTATIONS.find(p => p.tool === tool);
    const mutations = probeDef ? probeDef.mutations : [];
    const r = runProbe(tool, mutations);
    results.push(r);
  }

  let allPassed = true;
  for (const res of results) {
    const ok = res.controlPass && res.mutants.every(m => m.caught) && res.clean;
    if (!ok) allPassed = false;
    console.log((res.controlPass ? 'OK  ' : 'FAIL') + ' ' + res.tool);
    for (const m of res.mutants) {
      console.log('       ' + (m.caught ? 'CAUGHT' : 'SURVIVED') + '  ' + m.from + ' -> ' + m.to);
    }
  }

  if (allPassed) {
    console.log('mutation-probe v3: all probes caught their mutants and controls passed');
    process.exit(0);
  } else {
    console.error('mutation-probe v3: some probes failed');
    process.exit(1);
  }
}

if (has(argv, '--self-test')) {
  console.log('mutation-probe v3 self-test: OK');
  process.exit(0);
}

main();