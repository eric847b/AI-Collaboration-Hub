#!/usr/bin/env node
// git-health.mjs — Workspace git health diagnostics and lightweight fix
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');

function runGit(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function getBranchInfo() {
  const lines = runGit(['status', '--porcelain=v2', '--branch']).split(/\r?\n/);
  const head = lines.find(line => line.startsWith('# branch.head '));
  const aheadBehind = lines.find(line => line.startsWith('# branch.ab '));
  const branch = head?.slice('# branch.head '.length).trim() ?? 'unknown';
  const counts = aheadBehind?.match(/^# branch\.ab \+(\d+) -(\d+)$/);

  return {
    branch,
    detached: branch === '(detached)',
    ahead: counts ? Number(counts[1]) : 0,
    behind: counts ? Number(counts[2]) : 0,
  };
}

function getUncommittedChanges() {
  const lines = runGit(['status', '--short', '--untracked-files=all'])
    .split(/\r?\n/)
    .filter(Boolean);
  const changes = { modified: [], added: [], deleted: [] };

  for (const line of lines) {
    const status = line.slice(0, 2);
    const file = line.slice(3);
    if (status.includes('D')) changes.deleted.push(file);
    else if (status.includes('A') || status === '??') changes.added.push(file);
    else changes.modified.push(file);
  }

  return {
    ...changes,
    count: changes.modified.length + changes.added.length + changes.deleted.length,
  };
}

function getWorkflowStatus() {
  const workflowsDir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) return 0;
  return fs.readdirSync(workflowsDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .length;
}

function main() {
  console.log('=== Workspace Git Health Diagnostics ===\n');

  const { branch, detached, ahead, behind } = getBranchInfo();
  console.log(`Branch: ${branch}`);
  console.log(`Detached: ${detached}`);
  if (ahead > 0 || behind > 0) {
    console.log(`Ahead: ${ahead}, Behind: ${behind}`);
  }

  const { modified, added, deleted, count } = getUncommittedChanges();
  console.log(`\nUncommitted changes: ${count}`);
  if (modified.length > 0) console.log(`  Modified: ${modified.length} files`);
  if (added.length > 0) console.log(`  Added: ${added.length} files`);
  if (deleted.length > 0) console.log(`  Deleted: ${deleted.length} files`);

  if (count > 0) {
    console.log('\n  Changed files:');
    for (const file of [...modified, ...added, ...deleted].slice(0, 10)) {
      console.log(`    - ${file}`);
    }
    const remaining = count - 10;
    if (remaining > 0) console.log(`    ... and ${remaining} more`);
  }

  const wfCount = getWorkflowStatus();
  console.log(`\nGitHub Workflows: ${wfCount}`);

  console.log('\n=== Suggestions ===');
  if (count > 0) console.log('  `git add` or `git commit` to clean up uncommitted changes');
  if (behind > 0) console.log('  Sync this branch with its upstream');
  if (ahead > 0) console.log('  Push local commits to the configured upstream');
  if (detached) console.log('  Check out a named branch');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    main();
  } else if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log('Usage: node tools/git-health.mjs');
    console.log('Prints repository branch, working-tree, and workflow-count diagnostics.');
  } else {
    console.error(`Unknown argument: ${args[0]}`);
    console.error('Use --help for usage.');
    process.exitCode = 2;
  }
}