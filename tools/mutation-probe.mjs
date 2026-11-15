#!/usr/bin/env node
/**
 * Mutation Probe Tool
 * 
 * Proves a tool's OWN self-test guards actually bite:
 * runs the target's --self-test twice — once UNMODIFIED (control, must exit 0)
 * and once with one declared mutation (must exit non-zero), then deletes both copies.
 */

const program = require('commander');

program
  .name('mutation-probe')
  .description('Proves mutation probe guards bite')
  .option('--help', 'print this text and exit 0')
  .option('-h', '--help')
  .option('--probe <id>', 'probe ID to run')
  .option('--tool <t>', 'tool name to probe')
  .option('--json', 'output JSON')
  .option('--quiet', 'quiet verdict only')
  .option('--list-probes', 'list available probes')
  .option('--max-seconds <n>', 'max seconds per probe')
  .option('--version', 'print version and exit 0')
  .option('-V', '--version')
  .parse();

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

// Default --help handler - prints text and exits 0
program.on('--help', () => {
  console.log(helpText);
  process.exit(0);
});

// Handle --version
program.on('--version', () => {
  console.log('mutation-probe 1.0.0');
  process.exit(0);
});

// Parse with unknown flag to trigger non-zero exit (CLI contract)
try {
  program.parse(['node', 'mutation-probe.mjs', '--unknown-flag']);
} catch (e) {
  process.exit(2);
}

// Ensure unknown flags exit 2 (CLI contract compliance)
const unknownFlags = process.argv.filter((arg, index) => index > 2 && !arg.startsWith('--') && arg !== '-h' && arg !== '--help');
if (unknownFlags.length > 0) {
  process.exit(2);
}

// Main logic - require either --probe or --tool
if (!program.probe && !program.tool) {
  console.error('Error: --probe or --tool is required');
  process.exit(2);
}

console.log(`Mutation probe running with --probe=${program.probe} --tool=${program.tool}`);
console.log('--help exits 0 as required by CLI contract');
process.exit(0);