#!/usr/bin/env node
/**
 * 016-security-hardening-test.cjs — smoke test for 027-security-hardening (ROADMAP 141-170)
 * Loads the REAL module in a vm sandbox with stubbed GM_*, host WebCrypto, and
 * stubbed fetch/navigator/window/document.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '027-security-hardening.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

console.log('=== 027-security-hardening test ===\n');

// --- sandbox with host WebCrypto + web platform stubs ---
const webcrypto = require('crypto').webcrypto || globalThis.crypto;
const storage = {};
const sandbox = {
  console: { log() {} },
  GM_setValue: (k, v) => { storage[k] = v; },
  GM_getValue: (k, d) => (k in storage ? storage[k] : d),
  crypto: webcrypto,
  TextEncoder,
  TextDecoder,
  btoa,
  atob,
  fetch: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ Answer: [{ name: 'example.com.', type: 1, data: '93.184.216.34', TTL: 3600 }] }),
  }),
  navigator: { permissions: { query: async () => ({ state: 'granted' }) } },
  document: {
    readyState: 'complete',
    querySelectorAll: (sel) =>
      sel.indexOf('img') === 0 ? [{ tagName: 'IMG', src: 'http://insecure.example/x.png' }] : [],
  },
};
sandbox.window = sandbox;
sandbox.window.top = { hijacked: true };
sandbox.window.self = sandbox;
sandbox.window.isSecureContext = true;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: '027-security-hardening.module.user.js' });
const S = sandbox.window.__NEXUS_SECURITY__;

console.log('Test 1: Module load + file validity');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  assert(!!S, 'module self-registered on window.__NEXUS_SECURITY__');
  assert(S.metadata && S.metadata.name === 'security-hardening', 'metadata exported');
  assert(S.getHealth().healthy === true, 'init() ran and reports healthy');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const items = [
    141, 142, 143, 146, 147, 148, 149, 150, 151, 152, 153, 154,
    155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166,
    167, 168, 169, 170,
  ];
  for (const item of items) {
    assert(src.includes(String(item)), `ROADMAP ${item} referenced`);
  }
}

console.log('\nTest 2: Policy builders (141/142/148/149/147)');
{
  const csp = S.buildCsp({ 'default-src': ["'self'"], 'script-src': ["'self'", "'nonce-abc'"], 'frame-ancestors': "'none'" });
  assert(csp.includes("default-src 'self'") && csp.includes('frame-ancestors'), 'CSP directives joined with ;');
  const n1 = S.generateNonce();
  const n2 = S.generateNonce();
  assert(n1.length === 24 && n2.length === 24, 'nonces are 16 bytes base64 (24 chars)');
  assert(n1 !== n2, 'nonces are unique per call');
  const rp = S.referrerPolicy('strict-origin-when-cross-origin');
  assert(rp.meta.includes('strict-origin-when-cross-origin'), 'referrer policy meta tag built');
  let threw = false;
  try { S.referrerPolicy(' totally-bogus '); } catch (e) { threw = true; }
  assert(threw, 'invalid referrer policy rejected');
  const pp = S.permissionsPolicy({ camera: ['self'], geolocation: [] });
  assert(pp.includes('camera=(self)') && pp.includes('geolocation=()'), 'permissions policy string built');
  const mh = S.mimeSniffingHeaders();
  assert(mh['X-Content-Type-Options'] === 'nosniff', 'MIME sniffing protection headers');
  const verdict = S.validateResponseHeaders({ 'x-content-type-options': 'nosniff' }, { https: true });
  assert(!verdict.ok && verdict.issues.length === 2, 'missing CSP + HSTS flagged by header validator');
  assert(S.validateResponseHeaders(
    { 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'", 'strict-transport-security': 'max-age=31536000' },
    { https: true }
  ).ok === true, 'complete header set validates clean');
}

console.log('\nTest 3: Browser checks (146/151/152/153/154/155/156/157)');
{
  const cj = S.clickjackingDefense();
  assert(cj.framed === true && cj.script.includes('window.top.location'), 'framed page detected + framebust script');
  const sc = S.secureContextReport();
  assert(sc.secure === true, 'secure context reported via window.isSecureContext');
  const pinned = S.configurePins('api.example.com', ['aa'.repeat(32), 'bb'.repeat(32)]);
  assert(pinned.length === 2, 'certificate pins stored per domain');
  assert(S.validatePin('api.example.com', 'bb'.repeat(32)).valid === true, 'matching pin accepted');
  assert(S.validatePin('api.example.com', 'cc'.repeat(32)).valid === false, 'wrong pin rejected');
  assert(S.validatePin('unknown.example.com', 'dd'.repeat(32)).pinned === false, 'unpinned domain reported');
  const r1 = S.enforceHttps('http://example.com/path');
  assert(r1.redirected === true && r1.url === 'https://example.com/path', 'http URL rewritten to https');
  assert(S.enforceHttps('https://example.com').redirected === false, 'https URL left alone');
  const mc = S.scanMixedContent([
    { tag: 'img', src: 'http://cdn.example/a.png' },
    { tag: 'img', src: 'https://cdn.example/b.png' },
    { tag: 'script', src: 'http://cdn.example/x.js' },
  ]);
  assert(mc.count === 2 && mc.insecure[0].tag === 'img', 'mixed-content scanner flags http resources');
  const dom = S.scanDomMixedContent();
  assert(dom.count === 1 && dom.insecure[0].src.indexOf('http://') === 0, 'DOM scan finds insecure img');
  const hstsOk = S.hstsPreloadCheck(31536000, true, true);
  const hstsBad = S.hstsPreloadCheck(86400, false, false);
  assert(hstsOk.eligible === true && hstsOk.header.includes('includeSubDomains'), 'HSTS preload eligible');
  assert(hstsBad.eligible === false, 'short HSTS without preload rejected');
  S.certificateTransparencyRecord('sct-token-1');
  assert(S.certificateTransparencyCheck().compliant === true, 'CT SCT recorded -> compliant');
  const ocsp = S.ocspStalenessCheck(Date.now() - 10 * 86400000, 7);
  assert(ocsp.fresh === false && ocsp.ageDays === 10, 'OCSP check staleness computed');
}

async function main() {
  console.log('\nTest 4: Digests, SRI, KDF, password hashing (143/165/166/167/168)');
  {
    const sri = await S.computeSri('alert(1)', 'SHA-256');
    const digestHex = Array.from(
      new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('alert(1)')))
    ).map((b) => b.toString(16).padStart(2, '0')).join('');
    const wantB64 = Buffer.from(digestHex, 'hex').toString('base64');
    assert(sri === 'sha256-' + wantB64, 'SRI digest matches independent WebCrypto computation');
    assert(sri.startsWith('sha256-'), 'SRI format prefix correct');
    const salt = S.generateSalt(16);
    assert(salt.length === 32 && /^[0-9a-f]+$/.test(salt), 'salt is 16 bytes of hex');
    const k1 = await S.deriveKeyBits('password1', salt, 1000, 256);
    const k2 = await S.deriveKeyBits('password1', salt, 1000, 256);
    const k3 = await S.deriveKeyBits('password2', salt, 1000, 256);
    assert(k1 === k2 && k1.length === 64, 'PBKDF2 deterministic for same inputs (256-bit hex)');
    assert(k1 !== k3, 'PBKDF2 diverges for different passwords');
    const stored = await S.hashPassword('hunter2', { iterations: 1000 });
    assert(stored.startsWith('pbkdf2-sha256$1000$'), 'password hash envelope format');
    assert(await S.verifyPassword('hunter2', stored) === true, 'correct password verifies');
    assert(await S.verifyPassword('hunter3', stored) === false, 'wrong password rejected');
    S.setPepper('host-side-pepper');
    const peppered = await S.hashPassword('hunter2', { iterations: 1000 });
    assert(await S.verifyPassword('hunter2', peppered) === true, 'peppered hash round-trips');
    assert(peppered.split('$')[3] !== stored.split('$')[3], 'pepper changes the digest');
    S.setPepper('');
  }

  console.log('\nTest 5: E2EE + key rotation (162/163)');
  {
    const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const key1 = toHex(webcrypto.getRandomValues(new Uint8Array(32)));
    const key2 = toHex(webcrypto.getRandomValues(new Uint8Array(32)));
    S.configureKeyring(key1);
    const sealed1 = await S.sealedEncrypt({ secret: 'v1-data' });
    assert(sealed1.keyVersion === 1 && sealed1.iv && sealed1.ct, 'sealed envelope tagged with key version 1');
    assert(await S.sealedDecrypt(sealed1).then((o) => o.secret) === 'v1-data', 'v1 envelope decrypts');
    const v2 = S.rotateKey(key2);
    assert(v2 === 2, 'rotateKey bumps active version');
    const sealed2 = await S.sealedEncrypt({ secret: 'v2-data' });
    assert(sealed2.keyVersion === 2, 'new envelope uses key version 2');
    assert(await S.sealedDecrypt(sealed1).then((o) => o.secret) === 'v1-data', 'old envelope still decrypts (retained key)');
    const direct = await S.e2eeEncrypt({ msg: 'roundtrip' }, key1);
    assert(await S.e2eeDecrypt(direct, key1).then((o) => o.msg) === 'roundtrip', 'raw e2ee AES-GCM roundtrip');
    void key1;
  }

  console.log('\nTest 6: PFS via ECDH P-256 (164)');
  {
    const alice = await S.createEphemeralSession();
    const bob = await S.createEphemeralSession();
    const keyA = await S.deriveSharedKey(alice, bob.publicKeyHex);
    const keyB = await S.deriveSharedKey(bob, alice.publicKeyHex);
    const env = await S.encryptWithKey(keyA, 'pfs-hello');
    const out = new TextDecoder().decode(await S.decryptWithKey(keyB, env));
    assert(out === 'pfs-hello', 'both sides derive the same shared key (mutual decrypt)');
  }

  console.log('\nTest 7: Commitments, DoH, permissions (161/158/150)');
  {
    const c = await S.createCommitment('my-secret');
    assert(c.commit.length === 64 && c.blinding.length === 32, 'commitment + 16-byte blinding factor');
    assert(await S.verifyCommitment('my-secret', c.blinding, c.commit) === true, 'commitment verifies for holder');
    assert(await S.verifyCommitment('wrong', c.blinding, c.commit) === false, 'commitment fails for wrong secret');
    const dns = await S.resolveDoH('example.com');
    assert(dns.answers.length === 1 && dns.answers[0].data === '93.184.216.34', 'DoH answer parsed from JSON');
    const perm = await S.queryPermission('notifications');
    assert(perm.state === 'granted', 'Permissions API wrapper returns state');
    const caps = S.hashingAlgorithmCapabilities();
    assert(caps.pbkdf2 === true && caps.argon2 === false, 'capability report: PBKDF2 yes, Argon2 absent');
    const ech = S.encryptedSniSupport();
    assert(ech.ech === false && typeof ech.note === 'string', 'ECH/ESNI capability flags reported');
    const pq = S.postQuantumReadiness();
    assert(Array.isArray(pq.checklist) && pq.checklist.length === 3, 'PQ readiness checklist present');
  }

  console.log('\nTest 8: Persistence');
  {
    const raw = JSON.parse(storage.security_hardening_config);
    assert(raw && raw.pins && raw.pins['api.example.com'], 'pins persisted to GM storage');
    assert(raw.keyring && raw.keyring.active === 2, 'keyring versions persisted');
    assert(raw.scts && raw.scts.length === 1, 'SCT records persisted');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('FATAL:', e && e.message ? e.message : e);
  process.exitCode = 1;
});



