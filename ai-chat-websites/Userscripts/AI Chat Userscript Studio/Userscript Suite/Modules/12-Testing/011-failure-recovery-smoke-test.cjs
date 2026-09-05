// Smoke test: 021-failure-recovery — record/summary, ErrorBoundary, retryWithBackoff, selfHeal + escalation
// Runs in Node with mocked window/GM to validate the critical failure-recovery module end-to-end.
const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..'); // 12-Testing/.. = Modules

// --- Minimal GM mocks ---
const store = {};
globalThis.GM_setValue = (k, v) => { store[k] = v; };
globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
globalThis.GM_log = (...a) => console.log(...a);

// --- Minimal window with location ---
globalThis.window = globalThis;
globalThis.location = { hostname: 'chatgpt.com', href: 'https://chatgpt.com/' };
globalThis.document = { readyState: 'complete', addEventListener() {} };

function loadModule(rel) {
    const file = path.join(MODULES_DIR, rel);
    const code = fs.readFileSync(file, 'utf8');
    const fn = new Function('window', 'GM_setValue', 'GM_getValue', 'GM_log', 'location', 'document', code);
    fn(globalThis, GM_setValue, GM_getValue, GM_log, location, document);
}

let pass = 0, fail = 0;
function assert(name, cond, extra) {
    if (cond) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}
function readStore() { try { return JSON.parse(store['failure_recovery_data'] || '{}'); } catch (e) { return {}; } }

async function main() {
    console.log('== load & export ==');
    loadModule('00-Core/021-failure-recovery.module.user.js');
    const F = window.__NEXUS_FAILURE__;
    assert('__NEXUS_FAILURE__ exported', !!F);
    assert('getHealth healthy (clean store)', F && typeof F.getHealth === 'function' && F.getHealth().healthy === true);
    assert('metadata critical + self-evolution dep', F.metadata.critical === true && F.metadata.dependencies.includes('self-evolution-engine'));
    assert('module global registered', !!window['failure-recoveryModule']);
    assert('RETRY_POLICIES exported (fatal = 0 retries)', F.RETRY_POLICIES.fatal.maxRetries === 0);
    assert('getPolicy fallback to transient', F.getPolicy('nope') === F.RETRY_POLICIES.transient && F.getPolicy('storage') === F.RETRY_POLICIES.storage);

    console.log('== record + getFailureSummary ==');
    const r1 = F.record('api_timeout', 'boom-1', { src: 'smoke' });
    assert('record returns entry count=1', r1.count === 1);
    assert('first_seen ISO', !isNaN(Date.parse(r1.first_seen)));
    F.record('api_timeout', 'boom-2');
    F.record('render_crash', 'boom-3');
    const sum = F.getFailureSummary();
    assert('summary has 2 types', sum.length === 2, sum.length);
    assert('summary sorted desc by count', sum[0].type === 'api_timeout' && sum[0].count === 2, JSON.stringify(sum));
    assert('last_seen ISO', !isNaN(Date.parse(sum[0].last_seen)));
    assert('getHealth unhealthy after records', F.getHealth().healthy === false);
    assert('health details tallies occurrences', F.getHealth().details.includes('3 total occurrences'), F.getHealth().details);

    console.log('== occurrence cap (50) ==');
    for (let i = 0; i < 55; i++) F.record('noisy', 'n' + i);
    const noisy = readStore()['noisy'];
    assert('occurrences capped at 50', noisy.occurrences.length === 50, noisy.occurrences.length);
    assert('newest occurrence kept (n54)', noisy.occurrences[49].message === 'n54', noisy.occurrences[49].message);
    assert('count tracks all 55 records', noisy.count === 55, noisy.count);

    console.log('== ErrorBoundary ==');
    const b1 = F.createBoundary('smoke-a');
    assert('boundary singleton per name', b1 === F.createBoundary('smoke-a'));
    assert('distinct names distinct instances', F.createBoundary('smoke-b') !== b1);
    const entry = b1.catch(new Error('boundary-boom'), { op: 'test' });
    assert('catch returns entry with name', entry.boundary === 'smoke-a');
    assert('entry error string', entry.error.includes('boundary-boom'));
    assert('entry timestamp ISO', !isNaN(Date.parse(entry.timestamp)));
    assert('entry stack captured', typeof entry.stack === 'string');
    const bh = b1.getHealth();
    assert('boundary unhealthy after catch', bh.healthy === false && bh.error_count === 1);
    assert('last_error recorded', bh.last_error && bh.last_error.error.includes('boundary-boom'));
    const wEntry = b1.wrap(() => { throw new Error('wrapped-boom'); }, { op: 'wrap' })();
    assert('wrap swallows throw -> entry', wEntry && wEntry.error.includes('wrapped-boom'));
    assert('wrap passthrough on success', b1.wrap(() => 42)() === 42);
    const aEntry = await b1.wrapAsync(async () => { throw new Error('async-boom'); })();
    assert('wrapAsync catches rejection', aEntry && aEntry.error.includes('async-boom'));

    console.log('== retryWithBackoff: success after retries ==');
    const attempts = [];
    const result = await F.retryWithBackoff(async (i) => {
        attempts.push(i);
        if (i < 2) throw new Error('flaky-' + i);
        return 'ok:' + i;
    }, { policy: 'render', type: 'flaky_op', boundary: 'retry-smoke' });
    assert('returns final value', result === 'ok:2', result);
    assert('fn receives 0-based attempt indices', attempts.join(',') === '0,1,2', attempts.join(','));
    assert('failures recorded per attempt (flaky_op=2)', readStore()['flaky_op'].count === 2, readStore()['flaky_op'].count);
    assert('retry boundary captured 2 errors', F.createBoundary('retry-smoke').errors.length === 2);

    console.log('== retryWithBackoff: throws on exhaust ==');
    let exhaustCalls = 0, threw = null;
    try {
        await F.retryWithBackoff(async () => { exhaustCalls++; throw new Error('always-fails'); }, { policy: 'fatal', type: 'fatal_op' });
    } catch (e) { threw = e; }
    assert('throws lastErr on exhaust', threw && threw.message === 'always-fails', threw && threw.message);
    assert('fatal policy = exactly 1 call (no retries)', exhaustCalls === 1, exhaustCalls);
    const fatalRec = readStore()['fatal_op'];
    assert('failure recorded with attempt context', fatalRec && fatalRec.count === 1 && fatalRec.occurrences[0].context.attempt === 0, JSON.stringify(fatalRec));
    assert("default 'retry' boundary got fatal error", F.createBoundary('retry').errors.length === 1);

    console.log('== selfHeal: success path ==');
    const evo = { verified: [], fixes: [] };
    window.__NEXUS_EVOLUTION__ = {
        markVerified: (t) => evo.verified.push(t),
        recordFix: (...a) => evo.fixes.push(a),
    };
    let reinitCalls = 0;
    const healOk = await F.selfHeal('mod-ok', async () => { reinitCalls++; }, { policy: 'fatal' });
    assert('healed true + moduleName', healOk.healed === true && healOk.moduleName === 'mod-ok', JSON.stringify(healOk));
    assert('reinit called once', reinitCalls === 1, reinitCalls);
    assert('markVerified called with default type', evo.verified.length === 1 && evo.verified[0] === 'module_reinit');
    assert('recovery recorded (:recovered key)', !!readStore()['module_reinit:recovered']);

    console.log('== selfHeal: exhaustion + escalation ==');
    const healFail = await F.selfHeal('mod-bad', async () => { throw new Error('init-crash'); }, { policy: 'fatal', type: 'module_reinit' });
    assert('healed false + escalated flag', healFail.healed === false && healFail.escalated === true, JSON.stringify(healFail));
    assert('error surfaced in result', healFail.error.includes('init-crash'));
    assert('recordFix(problemType, msg, details) called', evo.fixes.length === 1 && evo.fixes[0][0] === 'module_reinit' && evo.fixes[0][1].includes('mod-bad'));
    assert('no markVerified on failure', evo.verified.length === 1, evo.verified.length);

    console.log('== selfHeal: in-flight guard ==');
    let slowResolve;
    const slow = new Promise(res => { slowResolve = res; });
    const p1 = F.selfHeal('mod-slow', () => slow, { policy: 'fatal' });
    await new Promise(r => setTimeout(r, 30));
    const p2 = await F.selfHeal('mod-slow', () => slow, { policy: 'fatal' });
    assert('concurrent heal rejected (already-healing)', p2.healed === false && p2.reason === 'already-healing', JSON.stringify(p2));
    slowResolve();
    const p1res = await p1;
    assert('first heal completes after release', p1res.healed === true, JSON.stringify(p1res));

    console.log('== escalate without evolution engine ==');
    delete window.__NEXUS_EVOLUTION__;
    let orphan = null;
    try { orphan = await F.selfHeal('mod-orphan', async () => { throw new Error('x'); }, { policy: 'fatal' }); }
    catch (e) { orphan = { threw: String(e) }; }
    assert('no-throw on missing engine (warn path)', orphan && orphan.healed === false && orphan.escalated === true, JSON.stringify(orphan));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
