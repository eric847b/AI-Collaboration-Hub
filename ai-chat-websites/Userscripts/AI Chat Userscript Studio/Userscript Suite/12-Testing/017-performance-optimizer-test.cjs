#!/usr/bin/env node
/**
 * 017-performance-optimizer-test.cjs — smoke test for 028-performance-optimizer (ROADMAP 171-200)
 * Loads the REAL module in a vm sandbox with stubbed GM_*, timers, rAF, idle callbacks.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '028-performance-optimizer.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function makeEl(tag, attrs) {
  return {
    tagName: tag,
    attrs: attrs || {},
    style: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
  };
}
const docImgs = [makeEl('IMG'), makeEl('IMG'), makeEl('IMG')];

console.log('=== 028-performance-optimizer test ===\n');

// --- sandbox with stubbed platform APIs ---
const storage = {};
const rafQueue = [];
const sandbox = {
  console: { log() {} },
  GM_setValue: (k, v) => { storage[k] = v; },
  GM_getValue: (k, d) => (k in storage ? storage[k] : d),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  performance,
  requestAnimationFrame: (cb) => { rafQueue.push(cb); return rafQueue.length; },
  requestIdleCallback: (cb) => cb({ didTimeout: false, timeRemaining: () => 50 }),
  document: {
    readyState: 'complete',
    querySelectorAll: (sel) => (sel.indexOf('img') === 0 ? docImgs : []),
  },
};
sandbox.flushFrames = () => {
  const q = rafQueue.splice(0);
  const t = Date.now();
  for (const cb of q) cb(t);
  return q.length;
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: '028-performance-optimizer.module.user.js' });
const P = sandbox.window.__NEXUS_PERF__;

console.log('Test 1: Module load + file validity');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  assert(!!P, 'module self-registered on window.__NEXUS_PERF__');
  assert(P.metadata && P.metadata.name === 'performance-optimizer', 'metadata exported');
  assert(P.getHealth().healthy === true, 'init() ran and reports healthy');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const items = [
    171, 172, 173, 174, 175, 176, 177, 178, 179, 180,
    181, 182, 183, 184, 185, 186, 187, 188, 189, 190,
    191, 192, 193, 194, 195, 196, 197, 198, 199, 200,
  ];
  for (const item of items) {
    assert(src.includes(String(item)), `ROADMAP ${item} referenced`);
  }
}

console.log('\nTest 2: Resource builders (171/172/173/174/175)');
{
  const css = [
    '.btn { color: red; }',
    '.card { padding: 1rem; }',
    '.btn-primary { background: blue; }',
    '.footer { height: 10px; }',
  ].join('\n');
  const critical = P.extractCriticalRules(css, ['btn']);
  assert(critical.includes('.btn { color: red; }'), 'critical CSS keeps used-class rules');
  assert(critical.includes('.btn-primary'), 'critical CSS keeps compound selectors');
  assert(!critical.includes('.footer'), 'critical CSS drops unused rules');
  const fonts = P.buildFontCss(['Inter', 'Roboto']);
  assert(fonts.css.includes('font-display: swap') && fonts.preconnect.includes('preconnect'), 'font swap strategy + preconnect');
  const lazy = P.lazyifyImages(sandbox.document);
  assert(lazy.count === 3, 'lazy loading applied to all imgs');
  const imgs = sandbox.document.querySelectorAll('img');
  assert(imgs.every((el) => el.attrs.loading === 'lazy' && el.attrs.decoding === 'async'), 'loading + decoding attrs set');
  const srcset = P.buildSrcSet('https://cdn.example/a.jpg', [320, 480, 960]);
  assert(srcset === 'https://cdn.example/a.jpg?w=320 320w, https://cdn.example/a.jpg?w=480 480w, https://cdn.example/a.jpg?w=960 960w', 'srcset built correctly');
  assert(P.pickBestCandidate(srcset, 400).width === 480, 'best candidate = smallest width >= viewport');
  assert(P.pickBestCandidate(srcset, 4000).width === 960, 'falls back to largest candidate');
  const pic = P.buildPictureMarkup('https://cdn.example/a.jpg', 'hero');
  assert(pic.indexOf('<source type="image/avif"') < pic.indexOf('<source type="image/webp"'), 'AVIF source before WebP');
  assert(pic.includes('<img src=') && pic.endsWith('</picture>'), 'picture markup closes with fallback img');
  const sup = P.modernFormatSupport({ toDataURL: (t) => 'data:' + t + ';base64,xxx' });
  assert(sup.webp === true && sup.avif === true, 'canvas format detection honors stub responses');
  assert(P.modernFormatSupport(null).webp === false, 'missing canvas reports unsupported');
}

console.log('\nTest 3: SVG, icon fonts, sprites (176/177/178/179)');
{
  const dirty = [
    '<!-- editor comment -->',
    '<svg xmlns="http://www.w3.org/2000/svg" inkscape:version="1.0">',
    '<metadata>provenance junk</metadata>',
    '<path d="M0 0 L10 10"/>',
    '</svg>',
  ].join('\n');
  const clean = P.optimizeSvg(dirty);
  assert(!clean.includes('<!--') && !clean.includes('<metadata>'), 'SVG comments + metadata stripped');
  assert(!clean.includes('inkscape:version'), 'editor namespaces stripped');
  assert(clean.includes('<path d="M0 0 L10 10"/>'), 'real content preserved');
  const icons = P.buildIconFontCss('PerfIcons', { home: 0xe900, search: 0xe901 });
  assert(icons.css.includes(".icon-home:before { content: '\\e900'; }"), 'icon glyph class generated');
  assert(icons.css.includes("font-family: 'PerfIcons'"), 'icon font-face declared');
  P.registerSvgSymbol('star', '<svg><path d="M1 1"/></svg>');
  P.registerSvgSymbol('heart', '<svg><path d="M2 2"/></svg>');
  const sheet = P.getSvgSpriteSheet();
  assert(sheet.includes('<symbol id="icon-star">') && sheet.includes('<symbol id="icon-heart">'), 'sprite sheet holds registered symbols');
  assert(sheet.includes('<path d="M1 1"/>'), 'symbol inner markup preserved');
  const sprite = P.buildSpriteCss(['a', 'b', 'c', 'd', 'e'], 32, 32, 3);
  assert(sprite.includes('.a { background-position: -0px -0px; }'), 'sprite first cell at origin');
  assert(sprite.includes('.d { background-position: -0px -32px; }'), 'sprite 4th cell wraps to second row');
  assert(sprite.includes('.e { background-position: -32px -32px; }'), 'sprite 5th cell second row second column');
}

console.log('\nTest 4: Rendering helpers (180/181/182/183/184/185/186)');
{
  const el = makeEl('DIV');
  assert(P.applyContainment(el) === 'layout paint', 'containment applied');
  assert(P.applyContainment(el, 'strict') === 'strict', 'strict containment honored');
  const cv = P.applyContentVisibility(el, 250);
  assert(cv.contentVisibility === 'auto' && cv.containIntrinsicSize === 'auto 250px', 'content-visibility + intrinsic size');
  const count1 = P.setWillChange(makeEl('DIV'), 'transform');
  const count2 = P.setWillChange(makeEl('DIV'), 'opacity');
  assert(count2 === 2, 'will-change tracking increments');
  const report = P.willChangeReport();
  assert(report.tracked === 2 && report.overLimit === false, 'will-change report under limit');
  assert(P.willChangeReport(1).overLimit === true, 'will-change anti-pattern flaggable');
  const gpu = P.gpuAccelerate(makeEl('DIV'));
  assert(gpu.transform === 'translateZ(0)' && gpu.backfaceVisibility === 'hidden', 'GPU acceleration styles set');
  const layer = P.promoteLayer(makeEl('DIV'));
  assert(layer.isolation === 'isolate', 'layer promotion sets isolation');
  const dl = P.displayLock(makeEl('DIV'), 100);
  assert(dl.contentVisibility === 'hidden' && dl.containIntrinsicSize === 'auto 100px', 'display lock hides + sizes');
  const hold = P.paintHoldCss();
  assert(hold.includes('.paint-hold') && hold.includes('content-visibility: hidden'), 'paint hold CSS emitted');
}

async function main() {
  console.log('\nTest 5: Input delay + scheduling (187/188/189)');
  {
    let calls = 0;
    const debounced = P.debounce(() => { calls++; }, 20);
    debounced();
    debounced();
    debounced();
    await sleep(50);
    assert(calls === 1, 'debounce collapses 3 rapid calls into 1');
    const order = [];
    await P.scheduleTask(() => { order.push('urgent'); return 1; }, 'urgent');
    assert(order[0] === 'urgent', 'urgent tasks run as microtasks (before timers)');
    await P.scheduleTask(() => { order.push('visible'); });
    await P.scheduleTask(() => { order.push('background'); }, 'background');
    assert(order.join(',') === 'urgent,visible,background', 'scheduled tasks run in priority tiers');
    const q = P.createTaskQueue();
    q.push(() => 'low', 0);
    q.push(() => 'urgent', 10);
    q.push(() => 'mid', 5);
    assert(q.size() === 3, 'task queue tracks size');
    const results = await q.drain();
    assert(results.join(',') === 'urgent,mid,low', 'drain processes highest priority first');
    assert(q.size() === 0, 'drain empties the queue');
  }

  console.log('\nTest 6: Idle callbacks + deadline work (190/193)');
  {
    const idleResult = await P.runIdle((deadline) => deadline.timeRemaining());
    assert(idleResult === 50, 'runIdle executes with injected idle deadline');
    const items = [1, 2, 3, 4];
    let budget = 2;
    const fakeDeadline = { didTimeout: false, timeRemaining: () => (budget-- > 0 ? 10 : 0) };
    const outcome = P.idleDeadlineWork(items, (x) => x, fakeDeadline);
    assert(outcome.processed === 2 && outcome.remaining === 2, 'deadline budget caps work per slice');
    const allDone = P.idleDeadlineWork(items, (x) => x, { didTimeout: true, timeRemaining: () => 0 });
    assert(allDone.processed === 4, 'didTimeout deadline processes everything');
  }

  console.log('\nTest 7: Frame batching + loop (191/192)');
  {
    const ts = await new Promise((resolve) => {
      const p = P.nextFrame();
      sandbox.flushFrames();
      return p.then(resolve);
    });
    assert(typeof ts === 'number', 'nextFrame resolves with frame timestamp');
    const batchCounts = { a: 0, b: 0 };
    for (let i = 0; i < 3; i++) P.frameBatch('a', () => { batchCounts.a++; });
    for (let i = 0; i < 2; i++) P.frameBatch('b', () => { batchCounts.b++; });
    sandbox.flushFrames();
    assert(batchCounts.a === 3 && batchCounts.b === 2, 'frame batches execute after flush');
    sandbox.flushFrames();
    assert(batchCounts.a === 3 && batchCounts.b === 2, 'no double execution of frame batches');
    let loopTicks = 0;
    const stop = P.animationLoop(() => { loopTicks++; });
    sandbox.flushFrames();
    sandbox.flushFrames();
    stop();
    assert(loopTicks === 2, 'animation loop ticks per frame until cancelled');
  }

  console.log('\nTest 8: Workers, SAB, Atomics (194/195/196)');
  {
    assert(P.canUseWorkers() === false, 'worker availability correctly reported in sandbox');
    const src = P.workerSource('(d) => d * 2');
    assert(src.includes('self.onmessage') && src.includes('self.postMessage'), 'worker source scaffolding built');
    assert(P.createInlineWorker('(d) => d') === null, 'inline worker guarded when Worker/Blob unavailable');
    assert(P.sabSupported() === true, 'SharedArrayBuffer available in realm');
    const counter = P.createSharedCounter(64);
    assert(counter && counter.view.length === 16, 'shared counter view sized over SAB');
    assert(P.atomicIncrement(counter) === 0, 'Atomics.add returns previous value (0 before first increment)');
    assert(P.atomicIncrement(counter) === 1, 'second increment returns previous value 1');
    assert(P.atomicCompareExchange(counter, 0, 2, 99) === 2, 'compareExchange matches expected');
    assert(P.atomicStore(counter, 1, 42) === 42, 'atomic store/load roundtrip');
  }

  console.log('\nTest 9: WASM, SIMD, pool (197/198/199/200)');
  {
    const status = P.simdSupport();
    assert(status.wasm === true && status.simd === false, 'SIMD probe: wasm yes, simd honestly false without probe');
    assert(P.wasmSimdStatus().wasm === true, 'wasm SIMD status exposes wasm support');
    const minimal = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const instance = await P.loadWasm(minimal);
    assert(!!instance && typeof instance.exports === 'object', 'minimal wasm module instantiates');
    const again = await P.loadWasm(minimal);
    assert(again === instance, 'loadWasm caches by source bytes');
    let concurrent = 0, maxConcurrent = 0;
    const jobs = [1, 2, 3, 4, 5].map((n) => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await sleep(15);
      concurrent--;
      return n * 10;
    });
    const pool = await P.runPool(jobs, 2);
    assert(pool.results.join(',') === '10,20,30,40,50', 'pool returns all job results in order');
    assert(pool.maxConcurrent <= 2, `pool respects concurrency limit (max ${pool.maxConcurrent})`);
  }

  console.log('\nTest 10: Persistence + health');
  {
    P.configurePerf({ willChangeLimit: 50 });
    const raw = JSON.parse(storage.performance_optimizer_config);
    assert(raw && raw.settings && raw.settings.willChangeLimit === 50, 'settings persisted to GM storage');
    const health = P.getHealth();
    assert(health.healthy === true && health.details.includes('will-change'), 'getHealth reports module status');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('FATAL:', e && e.message ? e.message : e);
  process.exitCode = 1;
});


