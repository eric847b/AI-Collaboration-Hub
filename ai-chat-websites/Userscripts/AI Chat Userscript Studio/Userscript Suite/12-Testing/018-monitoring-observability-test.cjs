#!/usr/bin/env node
/**
 * 018-monitoring-observability-test.cjs — smoke test for 029-monitoring-observability
 * (ROADMAP 341-360). Loads the REAL module in a vm sandbox with stubbed GM_*,
 * host WebCrypto, and a capturing fetch.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '029-monitoring-observability.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

console.log('=== 029-monitoring-observability test ===\n');

// --- sandbox with capturing fetch ---
const storage = {};
const fetchCalls = [];
const sandbox = {
  console: { log() {} },
  GM_setValue: (k, v) => { storage[k] = v; },
  GM_getValue: (k, d) => (k in storage ? storage[k] : d),
  crypto: require('crypto').webcrypto || globalThis.crypto,
  fetch: async (url, opts) => {
    fetchCalls.push({ url, opts, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { status: 202, ok: true, json: async () => ({ ok: true }) };
  },
  document: { readyState: 'complete' },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: '029-monitoring-observability.module.user.js' });
const O = sandbox.window.__NEXUS_OBSERVABILITY__;

console.log('Test 1: Module load + file validity');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  assert(!!O, 'module self-registered on window.__NEXUS_OBSERVABILITY__');
  assert(O.metadata && O.metadata.name === 'monitoring-observability', 'metadata exported');
  assert(O.getHealth().healthy === true, 'init() ran and reports healthy');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const items = [
    341, 342, 343, 344, 345, 346, 347, 348, 349, 350,
    351, 352, 353, 354, 355, 356, 357, 358, 359, 360,
  ];
  for (const item of items) {
    assert(src.includes(String(item)), `ROADMAP ${item} referenced`);
  }
}

console.log('\nTest 2: Distributed tracing (341)');
{
  const root = O.startSpan('root-op');
  const child = O.startSpan('child-op', root);
  const grandchild = O.startSpan('grandchild-op', child);
  O.finishSpan(grandchild, 'ok', { step: 'serialize' });
  O.finishSpan(child, 'ok');
  O.finishSpan(root, 'error', { reason: 'demo' });
  const trace = O.getTrace(root.traceId);
  assert(trace.length === 3, 'all three spans recorded under one traceId');
  assert(child.parentSpanId === root.spanId && grandchild.parentSpanId === child.spanId, 'parent-child linkage correct');
  assert(root.traceId.length === 32 && root.spanId.length === 16, 'traceId/spanId are OTLP-sized hex');
  assert(root.durationMs !== null && root.status === 'error', 'root span finished with error status');
  assert(grandchild.attributes.step === 'serialize', 'attributes attached on finish');
  assert(O.listTraces().includes(root.traceId), 'trace listed in registry');
  O.clearTraces();
  assert(O.listTraces().length === 0, 'clearTraces empties registry');
}

async function test3() {
  console.log('\nTest 3: OTLP, Jaeger, Zipkin exporters (342/343/344)');
  const root = O.startSpan('http-request');
  const child = O.startSpan('db-query', root);
  O.finishSpan(child, 'ok', { table: 'users' });
  O.finishSpan(root, 'ok', { route: '/api/users' });
  const otlp = O.toOtlpSpans(root.traceId);
  const otlpSpan = otlp.resourceSpans[0].scopeSpans[0].spans[0];
  assert(otlpSpan.traceId === root.traceId && otlpSpan.spanId === root.spanId, 'OTLP span identity preserved');
  assert(otlpSpan.startTimeUnixNano.length === 19, 'unix nano timestamps are 19-digit strings');
  assert(otlpSpan.attributes[0].key === 'route' && otlpSpan.attributes[0].value.stringValue === '/api/users', 'OTLP attribute encoding');
  assert(otlp.resourceSpans[0].resource.attributes[0].value.stringValue === 'userscript-suite', 'OTLP resource service.name');
  const jaeger = O.jaegerPayload(root.traceId);
  const jSpan = jaeger.data[0].spans[0];
  assert(jSpan.operationName === 'http-request' && jSpan.duration === root.durationMs * 1000, 'Jaeger span durations in microseconds');
  assert(jaeger.data[0].processes.p1.serviceName === 'userscript-suite', 'Jaeger process service name');
  const zipkin = O.zipkinPayload(root.traceId);
  assert(zipkin.length === 2 && zipkin[1].parentId === root.spanId, 'Zipkin spans keep parent linkage');
  assert(zipkin[0].localEndpoint.serviceName === 'userscript-suite', 'Zipkin localEndpoint service name');
  const posted = await O.exportToJaeger(null, root.traceId);
  assert(posted.ok === true && fetchCalls.length === 1, 'exportToJaeger posts via fetch');
  assert(fetchCalls[0].url.includes('/api/traces') && fetchCalls[0].body.data[0].traceID === root.traceId, 'Jaeger POST URL + trace payload');
  O.clearTraces();
}

async function test6() {
  console.log('\nTest 6: Incident integrations (348/349/350/351)');
  {
    const pd = O.pagerDutyPayload({ routingKey: 'rk-123' }, 'suite down', 'critical', 'dedup-1');
    assert(pd.routing_key === 'rk-123' && pd.event_action === 'trigger', 'PagerDuty Events v2 envelope');
    assert(pd.dedup_key === 'dedup-1' && pd.payload.severity === 'critical', 'PagerDuty dedup + severity');
    const sent = await O.notifyPagerDuty({ routingKey: 'rk-123' }, 'suite down', 'critical', 'dedup-2');
    assert(sent.ok === true, 'notifyPagerDuty posts via capturing fetch');
    const last = fetchCalls[fetchCalls.length - 1];
    assert(last.url === 'https://events.pagerduty.com/v2/enqueue' && last.body.routing_key === 'rk-123', 'PagerDuty POST URL + routing key');
    const og = O.opsgeniePayload({ responders: [] }, 'high latency', 'critical');
    assert(og.priority === 'P1' && og.alias === 'high latency', 'Opsgenie alert payload');
    const vo = O.victorOpsPayload({ routingKey: 'rk-9' }, 'disk 90%', 'warning', 'entity-1');
    assert(vo.message_type === 'WARNING' && vo.entity_id === 'entity-1', 'VictorOps payload');
    const sn = O.serviceNowPayload({ instanceUrl: 'https://x.service-now.com' }, 'cert expiring', 'critical');
    assert(sn.severity === 1 && sn.impact === 1, 'ServiceNow incident severity mapping');
  }
}

async function test7() {
  console.log('\nTest 7: Log shippers (352/353/354/355/356)');
  {
    const splunk = O.splunkPayload({ msg: 'cache miss' }, { sourcetype: 'perf' });
    assert(splunk.event.msg === 'cache miss' && splunk.sourcetype === 'perf' && typeof splunk.time === 'number', 'Splunk HEC payload');
    const elk = O.elkPayload('suite-logs', { level: 'warn', msg: 'slow op' });
    assert(elk.index === 'suite-logs' && elk.document.msg === 'slow op' && elk['@timestamp'], 'ELK doc payload');
    const dd = O.dataDogPayload('op finished', 'info', ['env:prod']);
    assert(dd.status === 'info' && dd.ddtags === 'env:prod', 'DataDog log payload');
    const series = O.dataDogSeries('suite_latency', [[0, 12], [10, 15]], ['env:prod']);
    assert(series.series[0].metric === 'suite_latency' && series.series[0].points.length === 2, 'DataDog metric series');
    assert(series.series[0].points[1][1] === 15, 'DataDog points carry values');
    const nr = O.newRelicPayload([{ eventType: 'SuiteOp', durationMs: 20 }], { host: 'local' });
    assert(nr[0].common.attributes.host === 'local' && nr[0].events[0].eventType === 'SuiteOp', 'New Relic events envelope');
    const hc = O.honeycombPayload('suite', { op: 'render', ms: 12 });
    assert(hc.dataset === 'suite' && hc.data.ms === 12, 'Honeycomb event payload');
  }
}

async function test8() {
  console.log('\nTest 8: Error trackers (357/358/359/360)');
  {
    const err = new Error('boom');
    err.name = 'TypeError';
    err.stack = [
      'TypeError: boom',
      '    at handler (/bundle/app.js:42:13)',
      '    at /bundle/app.js:100:1',
    ].join('\n');
    const frames = O.parseStackTrace(err);
    assert(frames.length === 2, 'stack parsed into 2 frames');
    assert(frames[0].function === 'handler' && frames[0].file === '/bundle/app.js' && frames[0].line === 42, 'V8 frame parsed (function/file/line)');
    assert(frames[1].function === 'anonymous', 'anonymous frame handled');
    const hb = O.honeybadgerPayload(err, { userId: 'u1' });
    assert(hb.error.class === 'TypeError' && hb.error.backtrace[0].number === 42, 'Honeybadger backtrace');
    assert(hb.context.userId === 'u1', 'Honeybadger context attached');
    const sentry = O.sentryPayload(err);
    assert(sentry.event_id.length === 36 && sentry.platform === 'javascript', 'Sentry event id + platform');
    const sValues = sentry.exception.values[0];
    assert(sValues.type === 'TypeError' && sValues.value === 'boom', 'Sentry exception values');
    assert(sValues.stacktrace.frames[1].lineno === 42, 'Sentry frames innermost-last order');
    const bug = O.bugsnagPayload(err);
    assert(bug.events[0].exceptions[0].errorClass === 'TypeError', 'Bugsnag exception class');
    assert(bug.events[0].exceptions[0].stacktrace[0].lineNumber === 42, 'Bugsnag stacktrace');
    const rb = O.rollbarPayload(err, 'staging');
    assert(rb.data.environment === 'staging' && rb.data.body.trace.exception.class === 'TypeError', 'Rollbar trace body');
    assert(rb.data.body.trace.frames[0].lineno === 42, 'Rollbar frames');
  }
}

async function test9() {
  console.log('\nTest 9: Persistence + health');
  {
    O.configureObservability({ serviceName: 'suite-test' });
    const raw = JSON.parse(storage.monitoring_observability_config);
    assert(raw && raw.settings && raw.settings.serviceName === 'suite-test', 'settings persisted to GM storage');
    const health = O.getHealth();
    assert(health.healthy === true && health.details.includes('metrics'), 'getHealth reports module status');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exitCode = failed > 0 ? 1 : 0;
}

async function main() {
  await test3();
  await test4();
  await test6();
  await test7();
  await test8();
  await test9();
}

main().catch((e) => {
  console.error('FATAL:', e && e.message ? e.message : e);
  process.exitCode = 1;
});


async function test4() {
  console.log('\nTest 4: Prometheus metrics (345)');
  {
    O.registerMetric({ name: 'suite_requests_total', type: 'counter', help: 'Total suite requests' });
    O.registerMetric({ name: 'suite_active', type: 'gauge', help: 'Active operations' });
    O.registerMetric({
      name: 'suite_op_duration_seconds', type: 'histogram', help: 'Operation durations',
      labels: ['op'], buckets: [0.1, 0.5, 1],
    });
    O.incCounter('suite_requests_total');
    O.incCounter('suite_requests_total');
    O.incCounter('suite_requests_total', { route: '/api' }, 5);
    assert(O.incCounter('suite_requests_total') === 3, 'counter increments to 3 for unlabeled series');
    O.setGauge('suite_active', 2);
    O.setGauge('suite_active', 5);
    O.setGauge('suite_active', 1, { region: 'eu' });
    O.observeHistogram('suite_op_duration_seconds', 0.3, { op: 'db' });
    O.observeHistogram('suite_op_duration_seconds', 0.8, { op: 'db' });
    O.observeHistogram('suite_op_duration_seconds', 7, { op: 'db' });
    let threw = false;
    try { O.incCounter('suite_active'); } catch (e) { threw = true; }
    assert(threw, 'wrong metric type rejected');
    const text = O.prometheusText();
    assert(text.includes('# HELP suite_requests_total Total suite requests'), 'HELP line rendered');
    assert(text.includes('# TYPE suite_requests_total counter'), 'TYPE line rendered');
    assert(text.includes('suite_requests_total{route="/api"} 5'), 'labeled counter series rendered');
    assert(text.includes('suite_active 5') && text.includes('suite_active{region="eu"} 1'), 'gauge series rendered');
    assert(text.includes('suite_op_duration_seconds_bucket{le="0.5",op="db"} 1'), 'histogram bucket le=0.5 counts 1');
    assert(text.includes('suite_op_duration_seconds_bucket{le="1",op="db"} 2'), 'histogram bucket le=1 counts 2');
    assert(text.includes('suite_op_duration_seconds_bucket{le="+Inf",op="db"} 3'), 'histogram +Inf bucket equals count');
    assert(text.includes('suite_op_duration_seconds_sum{op="db"} 8.1'), 'histogram sum accumulated');
    assert(text.includes('suite_op_duration_seconds_count{op="db"} 3'), 'histogram count rendered');
  }

  console.log('\nTest 5: Grafana + Alertmanager (346/347)');
  {
    const dash = O.grafanaDashboard('Suite Overview', ['suite_requests_total', 'suite_active']);
    assert(dash.dashboard.title === 'Suite Overview' && dash.dashboard.panels.length === 2, 'dashboard panels built per metric');
    assert(dash.dashboard.panels[0].targets[0].expr === 'suite_requests_total', 'panel target expr from metric name');
    const ann = O.grafanaAnnotation('deploy v1.7.0', ['deploy']);
    assert(ann.tags.includes('deploy') && typeof ann.time === 'number', 'annotation payload built');
    const rules = O.alertmanagerRule('suite-alerts', [
      { alert: 'HighErrorRate', expr: 'rate(errors_total[5m]) > 0.05', severity: 'critical', summary: 'error rate above 5%' },
    ]);
    assert(rules.includes('groups:') && rules.includes('  - name: suite-alerts'), 'rule group header rendered');
    assert(rules.includes('- alert: HighErrorRate') && rules.includes('expr: rate(errors_total[5m]) > 0.05'), 'alert rule rendered');
    assert(rules.includes('severity: critical') && rules.includes('for: 5m'), 'severity + duration labels rendered');
  }
}


