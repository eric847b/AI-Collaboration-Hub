#!/usr/bin/env node
'use strict';
/* v6 — self-contained pipeline (alerts -> fetch -> patch); obsoletes v5 (external tmp-fetch-alerts.cjs), v4 (no runner), v3 finalize-security-fixes.cjs. Closes npm Dependabot alerts
 * by patching lockfiles with CORRECT semantics:
 *   - per-copy target selection: target = first_patched of an alert whose
 *     vulnerable range CONTAINS the current version (not "max for the name")
 *   - parent-range gate with a strict 0.x-correct semver checker
 *   - NEVER rewrites parent ranges
 *   - rewrites version + resolved + integrity from the live npm registry
 *   - canonical single-line JSON writer, byte-verified after write
 * Usage: node fix-security-alerts.cjs alerts   (network gh CLI -> tmp-alerts.json)
 *        node fix-security-alerts.cjs fetch   (network -> tmp-reg-meta.json)
 *        node fix-security-alerts.cjs patch   (pure local compute+write+verify)
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const ALERTS = path.join(ROOT, 'tmp-alerts.json');
const REGMETA = path.join(ROOT, 'tmp-reg-meta.json');
const LOCKS = [
  'ai-chat-websites/package-lock.json',
  'nexus-infinity-hub/package-lock.json',
  'self-evolve-dash/package-lock.json',
  'third-door-blink-controller/package-lock.json',
];

/* ---------- strict semver (0.x-correct caret/tilde, x-ranges, ||, hyphen) ---------- */
function cmp(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1; }
  return 0;
}
function comparatorToRange(c) {
  const m = c.trim().match(/^(\^|~|>=|<=|>|<|=)?\s*(.+)$/);
  const op = m && m[1] ? m[1] : '';
  let spec = (m ? m[2] : c).trim();
  if (spec === '*' || spec === '' || spec === 'x' || spec === 'X') return { lo: '0.0.0', hi: null };
  const parts = spec.split('.');
  const fill = (i) => (parts[i] && parts[i] !== 'x' && parts[i] !== 'X' && parts[i] !== '*' ? parts[i] : undefined);
  const onePart = fill(1) === undefined;
  let maj = fill(0), min = fill(1), pat = fill(2);
  if (min === undefined) { if (op === '^' || op === '~' || op === '>' || op === '>=' || op === '<' || op === '<=') { min = 0; } else { return { lo: `${maj}.0.0`, hi: `${+maj + 1}.0.0` }; } }
  if (pat === undefined) {
    if (op === '') return { lo: `${maj}.${min}.0`, hi: `${maj}.${+min + 1}.0` };
    if (op === '^') return +maj > 0 ? { lo: `${maj}.${min}.0`, hi: `${+maj + 1}.0.0` } : +min > 0 ? { lo: `0.${min}.0`, hi: `0.${+min + 1}.0` } : { lo: '0.0.0', hi: '0.1.0' };
    if (op === '~') return { lo: `${maj}.${min}.0`, hi: `${maj}.${+min + 1}.0` };
    if (op === '>=') return { lo: `${maj}.${min}.0`, hi: null };
    if (op === '>') return onePart ? { lo: `${+maj + 1}.0.0`, hi: null } : { lo: `${maj}.${+min + 1}.0`, hi: null }; // npm: ">1" === ">=2.0.0", ">1.4" === ">=1.5.0"
    if (op === '<=') return onePart ? { lo: '0.0.0', hi: `${+maj + 1}.0.0` } : { lo: '0.0.0', hi: `${maj}.${+min + 1}.0` }; // npm: "<=1" === "<2.0.0", "<=1.4" === "<1.5.0"
    if (op === '<') return { lo: '0.0.0', hi: `${maj}.${min}.0` };
    return { lo: `${maj}.${min}.0`, hi: null };
  }
  const v = `${maj}.${min}.${pat}`;
  if (op === '^') return +maj > 0 ? { lo: v, hi: `${+maj + 1}.0.0` } : +min > 0 ? { lo: v, hi: `0.${+min + 1}.0` } : { lo: v, hi: `0.0.${+pat + 1}` };
  if (op === '~') return { lo: v, hi: `${maj}.${+min + 1}.0` };
  if (op === '>=') return { lo: v, hi: null };
  if (op === '>') return { lo: v, hi: null, loMode: 'gt' }; // strict lower bound: v === lo excluded
  if (op === '<=') return { lo: '0.0.0', hi: v, hiMode: 'le' }; // inclusive upper bound
  if (op === '<') return { lo: '0.0.0', hi: v }; // exclusive upper bound (default hiMode 'lt')
  return { lo: v, hi: v, hiMode: 'le' }; // = or bare -> exact match
}
function checkOne(v, c) {
  if (!c || c.trim() === '' || c.trim() === '*') return true;
  if (!/^\d+\.\d+\.\d+$/.test(v)) return false; // ignore prereleases
  const r = comparatorToRange(c);
  if (r.loMode === 'gt' ? cmp(v, r.lo) <= 0 : cmp(v, r.lo) < 0) return false;
  if (r.hi !== null) {
    // hiMode 'le' -> v <= hi (inclusive: "<= 0.8.14" contains 0.8.14); default 'lt' -> v < hi (first-excluded, as for caret/tilde)
    const c2 = cmp(v, r.hi);
    if (r.hiMode === 'le' ? c2 > 0 : c2 >= 0) return false;
  }
  return true;
}
function sat(v, range) {
  if (!range) return false;
  return String(range).split('||').some(alt => {
    let s = alt.trim().replace(/,\s*/g, ' '); // alert style ">= a, <= b" -> space-joined AND
    if (s === '' || s === '*') return true;
    const hy = s.match(/^(\d+\.[^\s]+)\s+-\s+(\d+[^\s]*)$/);
    if (hy) return checkOne(v, '>=' + hy[1]) && checkOne(v, '<=' + hy[2]);
    // Pair each operator with ITS version: ">= 0.7.0 <= 0.8.14" -> ['>=0.7.0', '<=0.8.14'].
    // Naive whitespace split yields bare '>=' / '0.7.0' tokens and the AND of exacts is always false.
    const toks = s.match(/(>=|<=|>|<|=|\^|~)?\s*[\d][^\s]*/g);
    if (!toks) return false;
    return toks.every(t => checkOne(v, t.replace(/\s+/g, '')));
  });
}
const lt = (a, b) => cmp(a, b) < 0;

/* ---------- canonical format (verified byte-exact recipe) ---------- */
function canon(obj, original) {
  const hasNewline = /\n/.test(original);
  if (hasNewline) return JSON.stringify(obj, null, 2) + '\n';
  return JSON.stringify(obj, null, 2).replace(/\n/g, '');
}

/* ---------- alert loading ---------- */
function loadTargets() {
  if (!fs.existsSync(ALERTS)) throw new Error('missing tmp-alerts.json cache');
  const alerts = JSON.parse(fs.readFileSync(ALERTS, 'utf8'));
  // targets[lockfile][pkg] = [{num, vr, fp}] — ranges live in security_advisory.vulnerabilities[],
  // matched to THIS alert's package only (advisories may list sibling packages, e.g. legacy "xmldom").
  // Manifest path normalized against LOCKS so any prefix form still matches.
  const t = {};
  for (const a of alerts) {
    if (a.state && a.state !== 'open') continue;
    const name = a.dependency.package.name;
    const mp = LOCKS.find(l => (a.dependency.manifest_path || '').endsWith(l));
    if (!mp) continue;
    const vulns = (a.security_advisory && a.security_advisory.vulnerabilities) || [];
    for (const vv of vulns) {
      if (!vv.package || vv.package.name !== name) continue;
      if (!vv.first_patched_version || !vv.first_patched_version.identifier) continue; // no patch -> documented skip
      (t[mp] = t[mp] || {}); (t[mp][name] = t[mp][name] || []);
      t[mp][name].push({ num: a.number, vr: vv.vulnerable_version_range || '', fp: vv.first_patched_version.identifier });
    }
  }
  return t;
}
function pickTarget(rules, current) {
  // ONLY bump when an alert's vulnerable range actually CONTAINS the current version.
  // No same-major fallback: that fallback is exactly what produced the bogus 0.8.x -> 0.9.12 xmldom bump.
  const hits = rules.filter(r => r.fp && r.vr && sat(current, r.vr)).map(r => r.fp);
  if (!hits.length) return null;
  return hits.reduce((m, v) => (lt(m, v) ? v : m));
}

/* ---------- selftest: the exact cases that killed v3 must pass ---------- */
function selftest() {
  const cases = [
    ['0.8.13', '>= 0.7.0, <= 0.8.14', true],
    ['0.8.14', '>= 0.7.0, <= 0.8.14', true],   // inclusive upper bound
    ['0.8.15', '>= 0.7.0, <= 0.8.14', false],
    ['0.9.10', '>= 0.9.0, <= 0.9.11', true],
    ['0.9.12', '>= 0.9.0, <= 0.9.11', false],
    ['0.8.12', '< 0.9.0', true],               // 3-part exclusive hi
    ['0.9.0', '< 0.9.0', false],
    ['1.4.0', '>1.4', false],                  // npm: ">1.4" === ">=1.5.0"
    ['1.5.0', '>1.4', true],
    ['0.8.13', '^0.8.8', true],                // 0.x caret pinned to minor
    ['0.9.12', '^0.8.8', false],               // THE case that killed v3
    ['0.9.12', '^0.9.10', true],
    ['0.9.9', '^0.9.10', false],
    ['1.2.9', '^1.2.3', true],
    ['2.0.0', '^1.2.3', false],
    ['1.2.9', '~1.2.3', true],
    ['1.9.0', '~1.2.3', false],
    ['3.13.0', '>= 3.13.0, < 4', true],
    ['3.1.2', '>= 3.13.0, < 4', false],
    ['3.4.0', '3.4.0 - 3.9.9', true],          // hyphen range (uses inclusive <=)
    ['3.10.0', '3.4.0 - 3.9.9', false],
    ['4.1.0', '>=4.0.0 <5.0.0 || ^3.11.0', true],
    ['2.9.9', '>=4.0.0 <5.0.0 || ^3.11.0', false],
    ['0.8.13', '< 0.8.14', true],               // exclusive upper bound keeps predecessor
    ['0.8.14', '< 0.8.14', false],
    ['1.2.3', '= 1.2.3', true],                 // exact via '='
    ['1.2.4', '= 1.2.3', false],
    ['1.2.3', '1.2.3', true],                   // bare exact
    ['1.2.4', '1.2.3', false],
    ['1.2.4', '> 1.2.3', true],                 // strict lower bound
    ['1.2.3', '> 1.2.3', false],
    ['1.4.9', '<= 1.4', true],                  // npm: "<=1.4" === "<1.5.0"
    ['1.5.0', '<= 1.4', false],
    ['2.9.9', '<= 2', true],                    // npm: "<=2" === "<3.0.0"
    ['3.0.0', '<= 2', false],
    ['3.0.0', '> 2', true],                     // npm: ">2" === ">=3.0.0"
    ['2.9.9', '> 2', false],
  ];
  const bad = cases.filter(([v, r, want]) => sat(v, r) !== want);
  if (bad.length) { console.error('SELFTEST FAIL: ' + JSON.stringify(bad)); process.exit(1); }
  console.log('selftest: ' + cases.length + '/' + cases.length + ' semver cases pass');
}

/* ---------- lockfile tree walk ---------- */
function readLock(rel) {
  const abs = path.join(ROOT, rel);
  const original = fs.readFileSync(abs, 'utf8');
  return { abs, original, obj: JSON.parse(original) };
}
function pkgName(key) {
  const i = key.lastIndexOf('node_modules/');
  return i < 0 ? null : key.slice(i + 'node_modules/'.length);
}
function depRanges(entry, name) {
  const out = [];
  for (const sec of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (entry && entry[sec] && entry[sec][name] != null) out.push(String(entry[sec][name]));
  }
  return out;
}
function declaringRanges(lockObj, name) {
  const out = [];
  const pkgs = lockObj.packages || {};
  for (const key of Object.keys(pkgs)) out.push(...depRanges(pkgs[key], name));
  return out;
}
function findCopies(lockObj, name) {
  const out = [];
  const pkgs = lockObj.packages || {};
  for (const key of Object.keys(pkgs)) {
    if (pkgName(key) !== name) continue;
    const e = pkgs[key];
    if (!e || typeof e.version !== 'string' || !(e.resolved || e.integrity)) continue; // links/workspaces
    out.push({ key, entry: e, current: e.version });
  }
  return out;
}
/* Pure + deterministic: identical output in fetch and patch phases (same inputs). */
function computeEdits() {
  const targets = loadTargets();
  const plan = [];
  for (const rel of LOCKS) {
    const { abs, original, obj } = readLock(rel);
    if (!obj.packages) { console.error('UNSUPPORTED lockfile (no packages map): ' + rel); process.exit(1); }
    const names = Object.keys(targets[rel] || {});
    const edits = [], skips = [];
    for (const name of names) {
      const rules = targets[rel][name];
      const fixable = rules.filter(r => r.fp);
      const copies = findCopies(obj, name);
      if (!fixable.length) {
        for (const c of copies) skips.push({ name, key: c.key, current: c.current, reason: 'no patched release exists (alert #' + rules.map(r => r.num).join(',#') + ')' });
        continue;
      }
      for (const copy of copies) {
        const { key, current } = copy;
        const target = pickTarget(fixable, current);
        if (!target) continue; // healthy copy: no alert range contains this version
        const rs = declaringRanges(obj, name).filter(r => sat(current, r));
        if (!rs.length) { skips.push({ name, key, current, target, reason: 'no declaring range found (safety gate)' }); continue; }
        const rejectors = rs.filter(r => !sat(target, r));
        if (rejectors.length) { skips.push({ name, key, current, target, reason: 'parent-range conflict: ' + rejectors.join(' | ') }); continue; }
        edits.push({ name, key, current, target, alerts: fixable.filter(r => sat(current, r.vr)).map(r => '#' + r.num) });
      }
    }
    plan.push({ rel, abs, original, obj, lv: obj.lockfileVersion, edits, skips });
  }
  return plan;
}

/* ---------- registry metadata (fetch phase) ---------- */
const REG = 'https://registry.npmjs.org';
const https = require('https');
function regUrl(name) { return REG + '/' + encodeURIComponent(name); }
function httpsGetJson(url, redirects) {
  return new Promise((resolve, reject) => {
    const hop = redirects || 0;
    if (hop > 5) return reject(new Error('too many redirects: ' + url));
    const req = https.get(url, { headers: { accept: 'application/json', 'user-agent': 'fix-security-alerts/5' }, timeout: 30000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(httpsGetJson(new URL(res.headers.location, url).toString(), hop + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' for ' + url)); }
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', d => { buf += d; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('bad JSON from ' + url + ': ' + e.message)); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout: ' + url)));
    req.on('error', reject);
  });
}
async function fetchMeta() {
  const plan = computeEdits(); // deterministic: exactly the (name,target) pairs patch will ask for
  const names = [...new Set(plan.flatMap(p => p.edits.map(e => e.name)))];
  const pairs = new Set(plan.flatMap(p => p.edits.map(e => e.name + '@' + e.target)));
  console.log('fetch: ' + names.length + ' package(s), ' + pairs.size + ' pinned version(s)');
  const meta = {};
  for (const name of names) {
    meta[name] = {};
    const doc = await httpsGetJson(regUrl(name));
    for (const p of plan) for (const e of p.edits) {
      if (e.name !== name) continue;
      const v = doc.versions && doc.versions[e.target];
      if (!v || !v.dist || !v.dist.tarball || !v.dist.integrity) throw new Error('registry metadata missing dist for ' + name + '@' + e.target);
      meta[name][e.target] = { resolved: v.dist.tarball, integrity: v.dist.integrity };
    }
    console.log('  ok ' + name + ' -> ' + Object.keys(meta[name]).join(', '));
  }
  fs.writeFileSync(REGMETA, JSON.stringify(meta), 'utf8');
  console.log('fetch: wrote ' + REGMETA + ' (' + fs.statSync(REGMETA).size + ' bytes)');
}

/* ---------- patch phase (pure local compute + write + verify) ---------- */
function loadMeta() {
  if (!fs.existsSync(REGMETA)) { console.error('missing ' + REGMETA + ' — run: node fix-security-alerts.cjs fetch'); process.exit(1); }
  return JSON.parse(fs.readFileSync(REGMETA, 'utf8'));
}
function applyPlan() {
  const meta = loadMeta();
  const plan = computeEdits();
  let applied = 0, written = 0, skipped = 0;
  for (const p of plan) {
    for (const e of p.edits) {
      const m = meta[e.name] && meta[e.name][e.target];
      if (!m) throw new Error('registry metadata missing for ' + e.name + '@' + e.target + ' — re-run fetch');
      const entry = p.obj.packages[e.key];
      if (!entry || entry.version !== e.current) throw new Error('lockfile drifted under us: ' + e.key + ' expected ' + e.current);
      entry.version = e.target;
      entry.resolved = m.resolved;
      entry.integrity = m.integrity;
      applied++;
      console.log('  edit [' + p.rel + '] ' + e.key + ': ' + e.current + ' -> ' + e.target + ' (alerts ' + e.alerts.join(',') + ')');
    }
    for (const s of p.skips) { skipped++; console.log('  skip [' + p.rel + '] ' + s.name + (s.key ? ' (' + s.key + ')' : '') + (s.current ? ' @' + s.current : '') + ': ' + s.reason); }
    if (!p.edits.length) continue;
    const out = canon(p.obj, p.original);
    fs.writeFileSync(p.abs, out, 'utf8');
    const back = fs.readFileSync(p.abs, 'utf8'); // byte-verify
    if (back !== out) throw new Error('byte verify failed (re-read mismatch): ' + p.rel);
    const reparsed = JSON.parse(back);
    for (const e of p.edits) {
      const entry = reparsed.packages[e.key];
      if (!entry || entry.version !== e.target || entry.resolved !== meta[e.name][e.target].resolved || entry.integrity !== meta[e.name][e.target].integrity)
        throw new Error('byte verify failed (edit not applied): ' + p.rel + ' ' + e.key);
    }
    written++;
    console.log('  wrote [' + p.rel + '] byte-verified (' + back.length + ' bytes)');
  }
  console.log('patch: ' + applied + ' edit(s) across ' + written + ' lockfile(s), ' + skipped + ' documented skip(s)');
  const residual = computeEdits(); // re-plan against the NEW lockfiles
  const left = residual.flatMap(p => p.edits.map(e => p.rel + ' ' + e.key + ' -> ' + e.target));
  if (left.length) { console.error('RESIDUAL FIXABLE VULNERABLE COPIES:\n' + left.join('\n')); process.exit(1); }
  console.log('verify: residual fixable copies = 0');
}

/* ---------- alerts phase (gh CLI -> ALERTS cache; obsoletes tmp-fetch-alerts.cjs) ---------- */
function ghRepo() {
  const { execFileSync } = require('child_process');
  const url = execFileSync('git', ['-C', ROOT, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  const m = url.match(/github\.com[:/]+([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error('origin is not a github repo: ' + url);
  return m[1] + '/' + m[2];
}
function fetchAlerts() {
  const { execFileSync } = require('child_process');
  const slug = ghRepo();
  let raw;
  try {
    raw = execFileSync('gh', ['api', '--paginate', 'repos/' + slug + '/dependabot/alerts?state=open&per_page=100'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.error('GH FETCH FAILED: ' + ((e.stderr || e.message || '') + '').slice(0, 500));
    process.exit(2);
  }
  let alerts;
  try { alerts = JSON.parse(raw); }
  catch (e) { alerts = JSON.parse('[' + raw.replace(/]\s*\[/g, ',') + ']'); } // --paginate may emit concatenated arrays
  fs.writeFileSync(ALERTS, JSON.stringify(alerts, null, 2), 'utf8');
  console.log('alerts: ' + slug + ' -> wrote ' + ALERTS + ' (' + fs.statSync(ALERTS).size + ' bytes, ' + alerts.length + ' open alert(s))');
  for (const a of alerts) {
    const dep = a.dependency || {}, pkg = dep.package || {}, vuln = a.security_vulnerability || {}, adv = a.security_advisory || {};
    console.log('  #' + a.number + ' ' + (pkg.name || '?') + ' vuln=' + (vuln.vulnerable_version_range || '?') + ' fixed=' + ((vuln.first_patched_version && vuln.first_patched_version.identifier) || 'NONE') + ' ghsa=' + (adv.ghsa_id || '?') + ' ' + (dep.manifest_path || '?'));
  }
  const t = loadTargets();
  const n = Object.keys(t).reduce((s, k) => s + Object.keys(t[k]).length, 0);
  console.log('alerts: actionable rules -> ' + Object.keys(t).length + ' lockfile(s), ' + n + ' package(s)');
}

/* ---------- dispatch ---------- */
const USAGE = [
  'Usage: node fix-security-alerts.cjs <command>',
  '  selftest  semver selftest, no writes',
  '  fetch     npm registry metadata for planned targets -> tmp-reg-meta.json (network)',
  '  alerts    gh dependabot alerts -> tmp-alerts.json (network, gh CLI)',
  '  patch     apply edits to lockfiles + verify (local only; requires fetch first)',
].join('\n');
const cmd = process.argv[2];
if (cmd === 'selftest') selftest();
else if (cmd === 'fetch') fetchMeta().catch(e => { console.error('FETCH FAILED: ' + e.message); process.exit(1); });
else if (cmd === 'alerts') fetchAlerts();
else if (cmd === 'patch') { try { applyPlan(); } catch (e) { console.error('PATCH FAILED: ' + e.message); process.exit(1); } }
else { console.error(USAGE); process.exit(1); }
