#!/usr/bin/env node
// git-health.mjs — Workspace git health diagnostics and lightweight fix
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(process.argv[1] || 'C:\\Users\\Eric\\OneDrive\\Documents\\GitHub\\tools\\git-health.mjs');
const ROOT = path.resolve(__dirname, '..');

function runGit(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function getBranchInfo() {
  try {
    const out = runGit(['status', '--porcelain=v2', '--branch']);
    const lines = out.split(/\r?\n/);
    let branch = 'main';
    let detached = false;
    let ahead = 0;
    let behind = 0;
    
    for (const line of lines) {
      if (line.startsWith('# branch.head ')) {
        const b = line.slice('# branch.head '.length).trim();
        if (b === '(detached)') detached = true;
        else branch = b;
      } else if (line.startsWith('# branch.upstream ')) {
        // noop
      } else if (line.startsWith('# branch.oid ')) {
        // noop
      }
    }
    
    // Count ahead/behind from branch.ab
    for (const line of lines) {
      if (line.startsWith('# branch.ab ')) {
        const ab = line.slice('# branch.ab '.length).trim();
        const parts = ab.split(' ');
        ahead = parseInt(parts[0]) || 0;
        behind = parseInt(parts[1]) || 0;
      }
    }
    
    return { branch, detached, ahead, behind };
  } catch (e) {
    return { branch: 'unknown', detached: false, ahead: 0, behind: 0 };
  }
}

function getUncommittedChanges() {
  try {
    const out = runGit(['status', '--porcelain=v2']);
    const lines = out.split(/\r?\n/).filter(l => l);
    const modified = [];
    const added = [];
    const deleted = [];
    
    for (const line of lines) {
      const status = line.slice(0, 2);
      const file = line.slice(3);
      if (status[0] === 'M') modified.push(file);
      else if (status[0] === 'A') added.push(file);
      else if (status[0] === 'D') deleted.push(file);
    }
    
    return { modified, added, deleted, count: modified.length + added.length + deleted.length };
  } catch (e) {
    return { modified: [], added: [], deleted: [], count: 0 };
  }
}

function getWorkflowStatus() {
  try {
    const workflowsDir = path.join(ROOT, '.github', 'workflows');
    if (!fs.existsSync(workflowsDir)) return { count: 0, issues: [] };
    
    const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    const issues = [];
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
      // Check for common issues
      if (content.includes(': ')) {
        // bare colon in step names - just note it
      }
    }
    
    return { count: files.length, issues };
  } catch (e) {
    return { count: 0, issues: [] };
  }
}

function main() {
  console.log('=== Workspace Git Health Diagnostics ===\\n');
  
  const { branch, detached, ahead, behind } = getBranchInfo();
  console.log(`Branch: ${branch}`);
  console.log(`Detached: ${detached}`);
  if (ahead > 0 || behind > 0) {
    console.log(`Ahead: ${ahead}, Behind: ${behind}`);
  }
  
  const { modified, added, deleted, count } = getUncommittedChanges();
  console.log(`\\nUncommitted changes: ${count}`);
  if (modified.length > 0) console.log(`  Modified: ${modified.length} files`);
  if (added.length > 0) console.log(`  Added: ${added.length} files`);
  if (deleted.length > 0) console.log(`  Deleted: ${deleted.length} files`);
  
  if (count > 0) {
    console.log('\\n  Modified files:');
    for (const f of modified.slice(0, 10)) {
      console.log(`    - ${f}`);
    }
    if (modified.length > 10) console.log(`    ... and ${modified.length - 10} more`);
  }
  
  const { count: wfCount, issues: wfIssues } = getWorkflowStatus();
  console.log(`\\nGitHub Workflows: ${wfCount}`);
  
  console.log('\\n=== Suggestions ===');
  if (count > 0) console.log('  `git add` or `git commit` to clean up uncommitted changes');
  if (behind > 0) console.log('  Pull remote changes with `git pull`');
  if (ahead > 0) console.log('  Push local commits with `git push`');
  if (detached) console.log('  Check out a named branch');
  
  process.exit(0);
}

const isMain = process.argv[1] && process.argv[1] === __filename;
if (isMain) main();