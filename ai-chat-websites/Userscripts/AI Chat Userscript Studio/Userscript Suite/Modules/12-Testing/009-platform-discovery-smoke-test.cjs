// Smoke test: 020-module-registry discoverPlatforms() + 13-Chat-Platforms modules
// Runs in Node with mocked window/GM to validate the auto-discovery wiring.
const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..'); // 12-Testing/.. = Modules

// --- Minimal GM mocks ---
const store = {};
globalThis.GM_setValue = (k, v) => { store[k] = v; };
globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
globalThis.GM_log = (...a) => console.log(...a);
globalThis.GM_deleteValue = (k) => { delete store[k]; };

// --- Minimal window with location ---
globalThis.window = globalThis;
globalThis.location = { hostname: 'chatgpt.com', href: 'https://chatgpt.com/' };
globalThis.document = { readyState: 'complete', addEventListener() {} };

function loadModule(rel) {
    const file = path.join(MODULES_DIR, rel);
    const code = fs.readFileSync(file, 'utf8');
    // Run in a fresh context to mimic a userscript sandbox
    const fn = new Function('window', 'GM_setValue', 'GM_getValue', 'GM_log', 'location', 'document', code);
    fn(globalThis, GM_setValue, GM_getValue, GM_log, location, document);
}

let pass = 0, fail = 0;
function assert(name, cond) {
    if (cond) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name); }
}

async function main() {
    console.log('== loading 020-module-registry ==');
    loadModule('00-Core/020-module-registry.module.user.js');
    assert('registry exported', typeof window.__NEXUS_REGISTRY__ === 'object');

    console.log('== loading 001-platform-detector ==');
    loadModule('13-Chat-Platforms/001-platform-detector.module.user.js');
    assert('detector registered in __NEXUS_MODULES__', !!window.__NEXUS_MODULES__['platform-detector']);
    assert('__NEXUS_PLATFORMS__ exported', !!window.__NEXUS_PLATFORMS__);
    const d = window.__NEXUS_PLATFORMS__.detect();
    assert('detect() returns chatgpt on chatgpt.com', d.id === 'chatgpt', 'got ' + d.id);
    assert('detect() caps non-empty', Array.isArray(d.caps) && d.caps.length > 0);

    console.log('== loading 002-platform-adapters ==');
    loadModule('13-Chat-Platforms/002-platform-adapters.module.user.js');
    assert('adapter registered in __NEXUS_MODULES__', !!window.__NEXUS_MODULES__['platform-adapters']);
    assert('__NEXUS_ADAPTERS__.buildAdapter() is function', typeof window.__NEXUS_ADAPTERS__.buildAdapter === 'function');
    const adapter = window.__NEXUS_PLATFORMS__.adapter;
    assert('adapter exposed on __NEXUS_PLATFORMS__.adapter', !!adapter);
    assert('adapter has sendMessage/getInput/getReply', adapter && typeof adapter.sendMessage === 'function' && typeof adapter.getInput === 'function' && typeof adapter.getReply === 'function');

    console.log('== running discoverPlatforms() ==');
    const found = window.__NEXUS_REGISTRY__.discoverPlatforms();
    assert('discoverPlatforms found 2 modules', Array.isArray(found) && found.length === 2, JSON.stringify(found));
    assert('registry now has 2+ modules', window.__NEXUS_REGISTRY__.getStats().total >= 2);

    const det = window.__NEXUS_REGISTRY__.getByName('platform-detector');
    assert('platform-detector registered with category 13-Chat-Platforms', det && det.category === '13-Chat-Platforms', det && det.category);
    const adp = window.__NEXUS_REGISTRY__.getByName('platform-adapters');
    assert('platform-adapters registered with role execution', adp && adp.role === 'execution', adp && adp.role);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });