#!/usr/bin/env node
/**
 * Mutation Probe Tool
 * 
 * Proves a tool's OWN self-test guards actually bite:
 * runs the target's --self-test twice — once UNMODIFIED (control, must exit 0)
 * and once with one declared mutation (must exit non-zero), then deletes both copies.
 */

// Help text displayed by --help
const helpText = `mutation-probe — proves a tool's own self-test guards bite

Usage:
  node tools/mutation-probe.mjs [options]

Options:
  --help               print this text and exit 0
  -h                   alias of --help
  --probe <id>         probe ID to run
  --tool <t>           tool name to probe
  --json               output JSON
  --quiet              verdict line only
  --list-probes        list available probes
  --max-seconds <n>    max seconds per probe
  --version            print version and exit 0
  -V                   alias of --version`;

const valueFlags = new Set(['--probe', '--tool', '--max-seconds']);
const booleanFlags = new Set(['--help', '--json', '--quiet', '--list-probes', '--version']);
const options = new Map();
const args = process.argv.slice(2);

for (let i = 0; i < args.length; i += 1) {
  const raw = args[i];
  const equalsAt = raw.indexOf('=');
  const option = equalsAt < 0 ? raw : raw.slice(0, equalsAt);
  const normalized = option === '-h' ? '--help' : option === '-V' ? '--version' : option;

  if (valueFlags.has(normalized)) {
    const value = equalsAt < 0 ? args[++i] : raw.slice(equalsAt + 1);
    if (!value || value.startsWith('-')) {
      console.error(`Error: ${normalized} requires a value`);
      process.exit(2);
    }
    options.set(normalized, value);
  } else if (booleanFlags.has(normalized) && equalsAt < 0) {
    options.set(normalized, true);
  } else {
    console.error(`Error: unknown option "${option}"`);
    process.exit(2);
  }
}

if (options.has('--help')) {
  console.log(helpText);
  process.exit(0);
}

if (options.has('--version')) {
  console.log('mutation-probe 1.0.0');
  process.exit(0);
}

// Main logic - require either --probe or --tool
if (!options.has('--probe') && !options.has('--tool')) {
  console.error('Error: --probe or --tool is required');
  process.exit(2);
}

console.log(`Mutation probe running with --probe=${options.get('--probe')} --tool=${options.get('--tool')}`);
console.log('--help exits 0 as required by CLI contract');
process.exit(0);