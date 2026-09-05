// Smoke test: 019-consensus-engine runConsensus() + failure-aware planning
// Runs in Node with mocked window/GM to validate the consensus pipeline end-to-end.
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
function assert(name, cond, extra) {
    if (cond) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}

async function main() {
    console.log('== loading 021-failure-recovery ==');
    loadModule('00-Core/021-failure-recovery.module.user.js');
    const F = window.__NEXUS_FAILURE__;
    assert('__NEXUS_FAILURE__ exported', !!F);
    assert('failure getHealth() healthy', F && typeof F.getHealth === 'function' && F.getHealth().healthy === true);

    console.log('== loading 019-consensus-engine ==');
    loadModule('00-Core/019-consensus-engine.module.user.js');
    const C = window.__NEXUS_CONSENSUS__;
    assert('__NEXUS_CONSENSUS__ exported', !!C);
    assert('runConsensus is function', typeof (C && C.runConsensus) === 'function');
    assert('getFailureContext is function', typeof (C && C.getFailureContext) === 'function');
    assert('module global registered', !!window['consensus-engineModule']);
    assert('getHealth() healthy after init', C.getHealth().healthy === true);

    console.log('== consensus: clean refactor task ==');
    const c1 = C.runConsensus('refactor the module loader');
    assert('approved', c1.approved === true);
    assert('confidence high (no risks)', c1.confidence === 'high', c1.confidence);
    assert('planner refactor steps', c1.roles.planner.steps.join('|').includes('Analyze current code'));
    assert('forge actions match steps', c1.roles.forge.actions.length === c1.roles.planner.steps.length);
    assert('echo summary mentions plan', /Plan: \d+ steps/.test(c1.roles.echo));
    assert('timestamp ISO', !isNaN(Date.parse(c1.timestamp)));

    console.log('== consensus: risky fix task ==');
    const c2 = C.runConsensus('fix network auth issue');
    const risks = c2.roles.researcher.risks;
    assert('network risk flagged', risks.some(r => r.includes('Network failures')));
    assert('auth risk flagged', risks.some(r => r.includes('Token expiry')));
    assert('confidence medium (risks>0)', c2.confidence === 'medium', c2.confidence);
    assert('planner fix steps first', c2.roles.planner.steps[0] === 'Identify root cause');

    console.log('== failure-aware planning integration ==');
    F.record('test_failure', 'boom', { src: 'smoke' });
    const summary = F.getFailureSummary();
    assert('failure recorded in summary', summary.some(f => f.type === 'test_failure' && f.count === 1));
    const c3 = C.runConsensus('fix the bug');
    assert('planner reviews failures', c3.roles.planner.steps[0].includes('Review 1 recent failure(s): test_failure'), c3.roles.planner.steps[0]);
    assert('researcher notes active failures', c3.roles.researcher.risks.some(r => r.includes('known failure type(s) active')));
    assert('researcher deps list failure', c3.roles.researcher.deps.some(d => d.startsWith('test_failure (')));

    console.log('== getFailureContext fallback ==');
    const saved = window.__NEXUS_FAILURE__;
    delete window.__NEXUS_FAILURE__;
    assert('fallback returns [] without 021', Array.isArray(C.getFailureContext()) && C.getFailureContext().length === 0);
    window.__NEXUS_FAILURE__ = saved;

    console.log('== critic/echo blocked path (role isolation) ==');
    const blocked = C.Roles.Critic.analyze('task', { steps: [] }, { risks: [] });
    assert('critic blocks empty plan', blocked.approve === false && blocked.blockers.length > 0);
    const echo = C.Roles.Echo.analyze('task', { steps: [] }, { risks: [] }, blocked, { actions: [] });
    assert('echo BLOCKED string', typeof echo === 'string' && echo.startsWith('BLOCKED:'));

    console.log('== history persistence + cap ==');
    let hist = JSON.parse(store['consensus_history']);
    assert('history persisted (3 records)', hist.length === 3, hist.length);
    for (let i = 0; i < 52; i++) C.runConsensus('bulk task ' + i);
    hist = JSON.parse(store['consensus_history']);
    assert('history capped at 50', hist.length === 50, hist.length);

    console.log('== task truncation ==');
    const cLong = C.runConsensus('x'.repeat(300));
    assert('task truncated to 200', cLong.task.length === 200, cLong.task.length);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
