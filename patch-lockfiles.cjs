#!/usr/bin/env node
/**
 * patch-lockfiles.cjs — patches vulnerable transitive deps in lockfiles.
 * Fetches correct integrity/tarball from npm registry for each bump.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const LOCKFILES = [
  'ai-chat-websites/package-lock.json',
  'nexus-infinity-hub/package-lock.json',
  'self-evolve-dash/package-lock.json',
  'third-door-blink-controller/package-lock.json',
  'collabhub-modules/package-lock.json',
];

// Vulnerable package -> minimum patched version
const PATCHES = {
  'node_modules/browserslist': '4.28.8',
  'node_modules/update-browserslist-db': '1.2.4',
  'node_modules/@xmldom/xmldom': '0.9.10',
  'node_modules/decode-uri-component': '0.4.1',
  'node_modules/image-size': '2.0.0',
};

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function getPkgMeta(name, ver) {
  const url = `https://registry.npmjs.org/${name}/${ver}`;
  const j = await httpGetJson(url);
  return {
    version: j.version,
    integrity: j.dist?.integrity || '',
    shasum: j.dist?.shasum || '',
    tarball: j.dist?.tarball || '',
  };
}

function semverGte(v1, v2) {
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

async function main() {
  const metaCache = {};
  let totalChanges = 0;

  for (const lf of LOCKFILES) {
    if (!fs.existsSync(lf)) continue;
    const data = JSON.parse(fs.readFileSync(lf, 'utf8'));
    const packages = data.packages || {};
    let changes = 0;

    for (const [pkgPath, minVer] of Object.entries(PATCHES)) {
      const pkg = packages[pkgPath];
      if (!pkg) continue;
      if (semverGte(pkg.version, minVer)) continue;

      const pkgName = pkgPath.replace('node_modules/', '').replace(/\\/g, '/');
      const cacheKey = `${pkgName}@${minVer}`;
      if (!metaCache[cacheKey]) {
        try {
          metaCache[cacheKey] = await getPkgMeta(pkgName, minVer);
        } catch (e) {
          console.error(`  FAIL fetch ${cacheKey}: ${e.message}`);
          continue;
        }
      }
      const meta = metaCache[cacheKey];
      if (!meta || !meta.version) continue;

      console.log(`${lf}: ${pkgPath} ${pkg.version} -> ${meta.version}`);
      pkg.version = meta.version;
      if (meta.integrity) pkg.integrity = meta.integrity;
      if (meta.shasum && !meta.integrity) pkg.integrity = `sha1-${meta.shasum}`;
      if (meta.tarball) pkg.resolved = meta.tarball;
      changes++;
    }

    if (changes > 0) {
      fs.writeFileSync(lf, JSON.stringify(data, null, 2) + '\n');
      totalChanges += changes;
      console.log(`  wrote ${lf} (${changes} patches)`);
    }
  }

  console.log(`\nDone. ${totalChanges} total patches applied.`);
}

main().catch(e => { console.error(e); process.exit(1); });
