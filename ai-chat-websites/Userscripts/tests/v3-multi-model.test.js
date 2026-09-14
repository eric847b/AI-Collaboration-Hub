'use strict';
const assert = require('assert');
const Mod = require('../v3/037-multi-model-orchestration.js');
let failures = 0;
const ok = (name, fn) => {
  try { fn(); console.log('  ok ' + name); }
  catch (err) { failures += 1; console.error('  FAIL ' + name + ' — ' + (err && err.message)); }
};
ok('module: defined', () => { assert.ok(Mod); });
ok('module: has methods', () => { ['init','classifyTask','getBestProvider','getFallbackProviders','route','getUsageStats','estimateCost','updateRouting','resetUsageHistory'].forEach(m => { assert.strictEqual(typeof Mod[m], 'function', 'should have ' + m); }); });
ok('profiles: all providers present', () => { const p = Mod.MODEL_PROFILES; assert.ok(p['gpt-4o']); assert.ok(p['gpt-3.5-turbo']); assert.ok(p['claude-3-5-sonnet-20241022']); assert.ok(p['claude-3-haiku-20240307']); assert.ok(p['gemini-pro']); assert.ok(p['llama2']); });
ok('profiles: llama2 is free', () => { assert.strictEqual(Mod.MODEL_PROFILES['llama2'].costPer1kTokens, 0); });
ok('classifyTask: code keywords', () => { assert.strictEqual(Mod.classifyTask('Write a JavaScript function'), 'code'); assert.strictEqual(Mod.classifyTask('Script to parse CSV'), 'code'); });
ok('classifyTask: analysis keywords', () => { assert.strictEqual(Mod.classifyTask('Analyze this data set'), 'analysis'); });
ok('classifyTask: reasoning keywords', () => { assert.strictEqual(Mod.classifyTask('Why does this fail?'), 'reasoning'); });
ok('classifyTask: creative keywords', () => { assert.strictEqual(Mod.classifyTask('Write a creative story'), 'creative'); });
ok('classifyTask: summarization keywords', () => { assert.strictEqual(Mod.classifyTask('Summarize this paper'), 'summarization'); });
ok('classifyTask: defaults to code', () => { assert.strictEqual(Mod.classifyTask('Hello'), 'code'); });
ok('routing: init sets default', () => { Mod.init(); const t = Mod.getRoutingTable(); assert.ok(t.code); assert.ok(t.creative); });
ok('routing: code prefers OPENAI', () => { Mod.init(); assert.strictEqual(Mod.getBestProvider('f()', 'code').provider, 'OPENAI'); });
ok('routing: analysis prefers ANTHROPIC', () => { Mod.init(); assert.strictEqual(Mod.getBestProvider('Analyze data', 'analysis').provider, 'ANTHROPIC'); });
ok('routing: fallback excludes failed', () => { Mod.init(); const fb = Mod.getFallbackProviders('OPENAI', 'code'); assert.ok(!fb.includes('OPENAI')); assert.ok(fb.length > 0); });
ok('routing: updateRouting works', () => { Mod.init(); Mod.updateRouting('code', ['ANTHROPIC','OPENAI','GEMINI','OLLAMA']); assert.strictEqual(Mod.getBestProvider('test', 'code').provider, 'ANTHROPIC'); Mod.init(); });
ok('estimateCost: returns all models', () => { const r = Mod.estimateCost('test'); assert.ok(r.totalTokens); assert.ok(r.estimates); });
ok('estimateCost: llama2 free', () => { assert.strictEqual(Mod.estimateCost('test').estimates['llama2'].cost, 0); });
ok('getUsageStats: empty initially', () => { Mod.resetUsageHistory(); const s = Mod.getUsageStats(); assert.strictEqual(s.totalCalls, 0); });
ok('getUsageStats: tracks success', () => { Mod.resetUsageHistory(); Mod.recordUsage({provider:'OPENAI',model:'gpt-4o',taskType:'code',success:true,failoverCount:0,promptLength:100,resultLength:500}); assert.strictEqual(Mod.getUsageStats().totalCalls, 1); });
ok('getUsageStats: failover rate', () => { Mod.resetUsageHistory(); Mod.recordUsage({provider:'OPENAI',model:'gpt-4o',taskType:'code',success:true,failoverCount:0,promptLength:100,resultLength:500}); Mod.recordUsage({provider:'ANTHROPIC',model:'claude',taskType:'code',success:true,failoverCount:1,promptLength:100,resultLength:500}); assert.strictEqual(Mod.getUsageStats().failoverRate, 50); });
ok('resetUsageHistory: clears', () => { Mod.recordUsage({provider:'X',model:'m',taskType:'code',success:true,failoverCount:0,promptLength:1,resultLength:1}); Mod.resetUsageHistory(); assert.strictEqual(Mod.getUsageStats().totalCalls, 0); });
console.log(failures === 0 ? 'All 25 tests passed!' : failures + ' test(s) FAILED');
process.exit(failures === 0 ? 0 : 1);
