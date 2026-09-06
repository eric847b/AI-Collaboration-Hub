#!/usr/bin/env node
/**
 * fix-deps.cjs — patches transitive dependencies in lockfiles to clear Dependabot alerts.
 * Strategy: override vulnerable packages in each project's package.json, regenerate lockfile.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECTS = [
  'ai-chat-websites',
  'nexus-infinity-hub',
  'self-evolve-dash',
  'third-door-blink-controller',
  'collabhub-modules',
];

// Vulnerability -> minimum safe version (from advisory + npm registry)
const PATCHES = {
  'browserslist': { min: '4.28.8', reason: 'GHSA-4xv5-c3qv-439h / GHSA-35jh-r3h4-6jhm (memory/crash)' },
  '@xmldom/xmldom': { min: '0.9.10', reason: 'GHSA-2g95-8v37-5wqr (XML injection)' },
  'decode-uri-component': { min: '0.4.1', reason: 'GHSA-xvfj-2w4c-3x4g (ReDoS)' },
  'image-size': { min: '2.0.0', reason: 'GHSA-79xx-gg7c-7w6f / GHSA-8c44-4c72-8w7c (infinite loops)' },
};

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

function addOverride(pkgJson, name, version) {
  if (!pkgJson.overrides) pkgJson.overrides = {};
  if (!pkgJson.overrides[name] || pkgJson.overrides[name] !== `>=${version}`) {
    pkgJson.overrides[name] = `>=${version}`;
    return true;
  }
  return false;
}

let changes = [];
for (const proj of PROJECTS) {
  const pkgPath = path.join(proj, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = readJson(pkgPath);
  let modified = false;
  for (const [name, info] of Object.entries(PATCHES)) {
    if (addOverride(pkg, name, info.min)) {
      modified = true;
      changes.push(`${proj}: override ${name} >= ${info.min}`);
    }
  }
  if (modified) {
    writeJson(pkgPath, pkg);
    console.log(`Updated ${pkgPath}`);
  }
}

if (changes.length === 0) {
  console.log('No overrides needed.');
} else {
  console.log('\nNow run `npm install` in each updated project to regenerate lockfiles.');
  console.log('\nChanges:');
  changes.forEach(c => console.log('  ' + c));
}
