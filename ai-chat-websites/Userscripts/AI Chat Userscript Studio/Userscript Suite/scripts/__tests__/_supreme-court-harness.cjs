'use strict';
/* Harness for Modules/24-Supreme-Court/001-supreme-court-dashboard */
const PATH = require('path').join(__dirname,'..','..','Modules','24-Supreme-Court','001-supreme-court-dashboard.module.user.js');
let pass=0,fail=0;
function ok(c,m){ if(c){pass++;console.log('PASS '+m);} else {fail++;console.log('FAIL '+m);} }
function eq(a,b,m){ ok(a===b,m+' [got '+JSON.stringify(a)+', want '+JSON.stringify(b)+']'); }

/* ---- minimal browser mocks ---- */
function mkEl(tag){return{tag:tag,style:{},children:[],_txt:'',
  addEventListener:function(){},appendChild:function(c){this.children.push(c);return c;},
  get textContent(){return this._txt;},set textContent(v){this._txt=(v==null?'':String(v));}};}
const store={};
global.localStorage={getItem:function(k){return k in store?store[k]:null;},
  setItem:function(k,v){store[k]=String(v);},removeItem:function(k){delete store[k];},
  key:function(i){return Object.keys(store)[i]||null;},
  get length(){return Object.keys(store).length;}};
global.window={addEventListener:function(){},tqg_api:null,dsg_api:null,rlb_api:null,dcp_api:null,atoll_api:null,pcp_api:null};
global.document={readyState:'complete',createElement:mkEl,addEventListener:function(){},
  documentElement:mkEl('html')};

function installSiblings(){
  window.tqg_api={stats:function(){return{tokens:12000,pctUsed:80,budget:15000};}};
  window.dsg_api={sentCountToday:function(){return 4;}};
  window.rlb_api={stats:function(){return{estSavedToday:900,appendsToday:3};}};
  window.dcp_api={stats:function(){return{cyclesMs:300000,tasks:12};}};
  window.atoll_api={stats:function(){return{usdToday:1.239,creditsToday:40,eventsToday:6,mode:'monitor'};}};
  window.pcp_api={compressText:function(t){return t;}};
}
function clearSiblings(){window.tqg_api=null;window.dsg_api=null;window.rlb_api=null;window.dcp_api=null;window.atoll_api=null;window.pcp_api=null;}

clearSiblings();
require(PATH);
/* Grab the handle the module publishes onto window — robust under both CJS and
   ESM interpretation of `.user.js` (module.exports is unreliable here). */
const M = global.window.__sc_internals;

/* ---- totals math ---- */
installSiblings();
const cAll = M.collectRows();
eq(cAll.rows.length, 6, 'six collector seats exist');
eq(cAll.sources, 6, 'all six courts in session');
const bill = M.buildBill(cAll);
eq(bill.totals.spentTok, 12000, 'spentTok aggregated');
eq(bill.totals.sends, 4, 'sends aggregated');
eq(bill.totals.savedTok, 900, 'savedTok aggregated');
eq(bill.totals.earnMin, Math.round((300000 / 60000) * 10) / 10, 'earnMin derived from cyclesMs');
eq(bill.totals.taxedCr, 40, 'taxedCr aggregated');
eq(bill.totals.taxedUsd, Math.round(1.239 * 100) / 100, 'taxedUsd rounded to cents');
eq(bill.budgetPct, 80, 'budgetPct plumbed through');
ok(typeof bill.verdict === 'string' && bill.verdict.length > 0, 'verdict produced');

/* ---- verdict branches ---- */
ok(/red line/i.test(bill.verdict), '80% -> near-red-line verdict');
ok(/overrun/i.test(M.verdictFor(bill.totals, 100, 6)), '100% -> overrun verdict');
ok(/No courts/i.test(M.verdictFor(bill.totals, null, 0)), 'zero sources -> empty-docket verdict');
ok(/credit/i.test(M.verdictFor({ savedTok: 5, taxedUsd: 1, taxedCr: 0 }, 50, 3)), 'saved+taxed -> citizen-in-credit');

/* ---- missing siblings ---- */
clearSiblings();
const cNone = M.collectRows();
eq(cNone.sources, 0, 'no siblings -> zero sources');
ok(cNone.rows.every(function (r) { return r.value === '\u2014'; }), 'absent seats show dash');

/* ---- bill persistence ---- */
installSiblings();
const tk = M.todayKey();
const bToday = M.buildBill(M.collectRows());
M.persistBill(bToday);
eq(JSON.parse(localStorage.getItem('sc:bill:' + tk)).totals.spentTok, 12000, 'persistBill writes day key');

/* ---- rollover: stale archived/corrupt dropped/today kept ---- */
localStorage.setItem('sc:bill:2000-01-01', JSON.stringify({ date: '2000-01-01', totals: { spentTok: 7 } }));
localStorage.setItem('sc:bill:zz-corrupt', '{not json!!');
const moved = M.rollOverIfNeeded(tk);
eq(moved, 1, 'only VALID stale bills counted as archived');
eq(localStorage.getItem('sc:bill:2000-01-01'), null, 'stale valid bill key removed');
eq(localStorage.getItem('sc:bill:zz-corrupt'), null, 'corrupt bill key removed');
ok(localStorage.getItem('sc:bill:' + tk) !== null, "today's bill survives rollover");
const led = M.loadLedger();
ok(led.some(function (e) { return e.date === '2000-01-01' && e.totals.spentTok === 7; }), 'valid stale bill landed in ledger');
eq(led.filter(function (e) { return e.date === undefined; }).length, 0, 'corrupt bill never entered ledger');

/* ---- ledger ops ---- */
M.saveLedger(led.concat([
  { date: '2026-08-19', totals: { spentTok: 1 } },
  { date: '2026-08-25', totals: { savedTok: 9 } }
]));
eq(M.loadLedger().length, led.length + 2, 'saveLedger appends');
const tail = M.lastArchived(2);
eq(tail.length, 2, 'lastArchived(n) slices tail');
ok(tail.some(function (e) { return e.date === '2026-08-25'; }), 'tail contains newest pushed day');
const big = M.loadLedger().concat(Array.from({ length: 40 }, function (_, i) {
  return { date: '2025-01-' + String(10 + (i % 10)).padStart(2, '0'), totals: {} };
}));
M.saveLedger(big);
eq(M.loadLedger().length, 30, 'ledger pruned to 30 days');

/* ---- UI renders archived rows fully (regression: '+' swallowed ternary) ---- */
M.saveLedger([
  { date: '2026-08-25', totals: { spentTok: 9, savedTok: 0, taxedUsd: 2 } },
  { date: '2026-08-26', totals: { spentTok: 50, savedTok: 5, taxedUsd: 0.75 } }
]);
M.setOpen(true);
const foundFull = (function scan(n) {
  if (!n) return false;
  if (typeof n._txt === 'string' && n._txt.indexOf('2026-08-26') >= 0 &&
      n._txt.indexOf('spent') >= 0 && n._txt.indexOf('$') >= 0) return true;
  const kids = n.children || [];
  for (let i = 0; i < kids.length; i++) if (scan(kids[i])) return true;
  return false;
})(global.document.documentElement);
M.setOpen(false);
ok(foundFull, 'archived row shows date + spent + $toll together (no truncation)');

/* ---- public API surface ---- */
ok(global.window.sc_api && typeof global.window.sc_api.bill === 'function', 'sc_api exposed');
eq(global.window.sc_api.bill().totals.spentTok, 12000, 'sc_api.bill() live aggregate works');

console.log('\nTOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
