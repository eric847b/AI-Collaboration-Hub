// ==UserScript==
// @name         monitoring-observability
// @namespace    AI-Chat-Userscript-Studio
// @version      2026.09.26.1
// @description  Observability: tracing, OTLP, Jaeger/Zipkin, Prometheus, alerting (ROADMAP 341-360)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Monitoring & Observability v1.0 - ROADMAP items 341-360
 * 341 tracing, 342 OTLP, 343 Jaeger, 344 Zipkin, 345 Prometheus, 346 Grafana,
 * 347 Alertmanager, 348 PagerDuty, 349 Opsgenie, 350 VictorOps, 351 ServiceNow,
 * 352 Splunk, 353 ELK, 354 DataDog, 355 New Relic, 356 Honeycomb, 357 Honeybadger,
 * 358 Sentry, 359 Bugsnag, 360 Rollbar. Builders are pure; senders guard fetch.
 */
(() => {
    "use strict";
    const MODULE_NAME = "monitoring-observability";
    const CONFIG_KEY = "monitoring_observability_config";
    const metadata = {
        name: MODULE_NAME,
        version: "2026.09.26.1",
        dependencies: [],
        critical: false,
        category: "00-Core",
    };
    const state = {
        initialized: false,
        spans: {}, // 341 traceId -> [spans]
        metrics: {}, // 345 metric registry
        settings: {
            serviceName: "userscript-suite",
            jaegerEndpoint: "http://localhost:14268/api/traces",
            zipkinEndpoint: "http://localhost:9411/api/v2/spans",
        },
    };
    const PERSISTED_KEYS = ["settings"];

    function load() {
        try {
            const raw = JSON.parse(GM_getValue(CONFIG_KEY, "{}")) || {};
            for (const key of PERSISTED_KEYS) if (raw[key] !== undefined) state[key] = raw[key];
        } catch (e) {
            /* corrupt storage -> start fresh */
        }
    }
    function save() {
        try {
            const out = {};
            for (const key of PERSISTED_KEYS) out[key] = state[key];
            GM_setValue(CONFIG_KEY, JSON.stringify(out));
        } catch (e) {
            /* storage unavailable -> keep in memory */
        }
    }
    function getInternalState() {
        return state;
    }
    function configureObservability(patch) {
        Object.assign(state.settings, patch || {});
        save();
        return { ...state.settings };
    }

    // --- id/byte helpers ---
    function webcrypto() {
        if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto;
        if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.getRandomValues) {
            return globalThis.crypto;
        }
        throw new Error("WebCrypto unavailable");
    }
    function randomBytes(n) {
        const out = new Uint8Array(n);
        webcrypto().getRandomValues(out);
        return out;
    }
    function bytesToHex(bytes) {
        return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }
    function randomHex(bytes) {
        return bytesToHex(randomBytes(bytes));
    }
    function uuid() {
        const b = randomBytes(16);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const hex = bytesToHex(b);
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    }

    // --- 341 distributed tracing ---
    function startSpan(name, parentSpan) {
        const traceId = parentSpan ? parentSpan.traceId : randomHex(16);
        const span = {
            traceId,
            spanId: randomHex(8),
            parentSpanId: parentSpan ? parentSpan.spanId : null,
            name,
            start: Date.now(),
            end: null,
            durationMs: null,
            attributes: {},
            status: "unset",
            kind: "internal",
        };
        if (!state.spans[traceId]) state.spans[traceId] = [];
        state.spans[traceId].push(span);
        return span;
    }
    function finishSpan(span, status, attributes) {
        span.end = Date.now();
        span.durationMs = span.end - span.start;
        if (status) span.status = status;
        if (attributes) Object.assign(span.attributes, attributes);
        return span;
    }
    function getTrace(traceId) {
        return (state.spans[traceId] || []).slice();
    }
    function listTraces() {
        return Object.keys(state.spans);
    }
    function clearTraces() {
        state.spans = {};
    }

    // --- 342 OpenTelemetry (OTLP/JSON) ---
    function toOtlpSpans(traceId) {
        const spans = getTrace(traceId);
        return {
            resourceSpans: [
                {
                    resource: {
                        attributes: [{ key: "service.name", value: { stringValue: state.settings.serviceName } }],
                    },
                    scopeSpans: [
                        {
                            scope: { name: MODULE_NAME, version: metadata.version },
                            spans: spans.map((s) => ({
                                traceId: s.traceId,
                                spanId: s.spanId,
                                parentSpanId: s.parentSpanId || undefined,
                                name: s.name,
                                kind: 1,
                                startTimeUnixNano: String(s.start) + "000000",
                                endTimeUnixNano: String(s.end || s.start) + "000000",
                                attributes: Object.entries(s.attributes).map(([k, v]) => ({
                                    key: k,
                                    value: { stringValue: String(v) },
                                })),
                                status: { code: s.status === "error" ? 2 : 1 },
                            })),
                        },
                    ],
                },
            ],
        };
    }

    // --- 343 Jaeger (jaeger-query JSON) ---
    function jaegerPayload(traceId) {
        const spans = getTrace(traceId);
        return {
            data: [
                {
                    traceID: traceId,
                    spans: spans.map((s) => ({
                        traceID: s.traceId,
                        spanID: s.spanId,
                        parentSpanID: s.parentSpanId || undefined,
                        operationName: s.name,
                        startTime: s.start * 1000,
                        duration: (s.durationMs || 0) * 1000,
                        tags: Object.entries(s.attributes).map(([k, v]) => ({
                            key: k,
                            type: "string",
                            value: String(v),
                        })),
                        processID: "p1",
                    })),
                    processes: { p1: { serviceName: state.settings.serviceName, tags: [] } },
                },
            ],
        };
    }
    async function exportToJaeger(endpoint, traceId) {
        return postJson(endpoint || state.settings.jaegerEndpoint, jaegerPayload(traceId));
    }

    // --- 344 Zipkin (v2 JSON) ---
    function zipkinPayload(traceId) {
        return getTrace(traceId).map((s) => ({
            id: s.spanId,
            traceId: s.traceId,
            parentId: s.parentSpanId || undefined,
            name: s.name,
            kind: "INTERNAL",
            timestamp: s.start * 1000,
            duration: (s.durationMs || 0) * 1000,
            localEndpoint: { serviceName: state.settings.serviceName },
            tags: Object.fromEntries(Object.entries(s.attributes).map(([k, v]) => [k, String(v)])),
        }));
    }

    // --- 345 Prometheus metrics ---
    function registerMetric(spec) {
        const metric = {
            name: spec.name,
            type: spec.type, // counter | gauge | histogram
            help: spec.help || "",
            labels: spec.labels || [],
            values: {},
            buckets: spec.type === "histogram" ? spec.buckets || [0.1, 0.5, 1, 5, 10] : null,
            hist: spec.type === "histogram" ? {} : null,
        };
        state.metrics[spec.name] = metric;
        return metric;
    }
    function labelKey(labels) {
        if (!labels) return "";
        return Object.keys(labels)
            .sort()
            .map((k) => k + "=" + labels[k])
            .join(",");
    }
    function parseLabelKey(key) {
        if (!key) return {};
        const out = {};
        for (const pair of key.split(",")) {
            const idx = pair.indexOf("=");
            out[pair.slice(0, idx)] = pair.slice(idx + 1);
        }
        return out;
    }
    function renderLabels(extra) {
        const keys = Object.keys(extra || {}).sort();
        if (!keys.length) return "";
        return "{" + keys.map((k) => k + '="' + String(extra[k]).replace(/"/g, '\\"') + '"').join(",") + "}";
    }
    function incCounter(name, labels, value) {
        const m = state.metrics[name];
        if (!m || m.type !== "counter") throw new Error("unknown counter: " + name);
        const key = labelKey(labels);
        m.values[key] = (m.values[key] || 0) + (value === undefined ? 1 : value);
        return m.values[key];
    }
    function setGauge(name, value, labels) {
        const m = state.metrics[name];
        if (!m || m.type !== "gauge") throw new Error("unknown gauge: " + name);
        m.values[labelKey(labels)] = value;
        return value;
    }
    function observeHistogram(name, value, labels) {
        const m = state.metrics[name];
        if (!m || m.type !== "histogram") throw new Error("unknown histogram: " + name);
        const key = labelKey(labels);
        if (!m.hist[key]) m.hist[key] = { counts: m.buckets.map(() => 0), sum: 0, count: 0 };
        const h = m.hist[key];
        h.sum += value;
        h.count += 1;
        for (let i = 0; i < m.buckets.length; i++) {
            if (value <= m.buckets[i]) h.counts[i] += 1;
        }
        return h;
    }
    function prometheusText() {
        const lines = [];
        for (const name of Object.keys(state.metrics)) {
            const m = state.metrics[name];
            lines.push("# HELP " + name + " " + m.help);
            lines.push("# TYPE " + name + " " + m.type);
            if (m.type === "histogram") {
                for (const [key, h] of Object.entries(m.hist)) {
                    const base = parseLabelKey(key);
                    m.buckets.forEach((bucket, i) => {
                        lines.push(name + "_bucket" + renderLabels({ ...base, le: String(bucket) }) + " " + h.counts[i]);
                    });
                    lines.push(name + "_bucket" + renderLabels({ ...base, le: "+Inf" }) + " " + h.count);
                    lines.push(name + "_sum" + renderLabels(base) + " " + h.sum);
                    lines.push(name + "_count" + renderLabels(base) + " " + h.count);
                }
            } else {
                for (const [key, value] of Object.entries(m.values)) {
                    lines.push(name + renderLabels(parseLabelKey(key)) + " " + value);
                }
            }
        }
        return lines.join("\n");
    }

    // --- 346 Grafana dashboards ---
    function grafanaDashboard(title, metricNames) {
        return {
            dashboard: {
                title,
                schemaVersion: 39,
                panels: (metricNames || []).map((metric, i) => ({
                    id: i + 1,
                    type: "timeseries",
                    title: metric,
                    targets: [{ expr: metric, refId: "A" }],
                    gridPos: { x: (i % 2) * 12, y: Math.floor(i / 2) * 8, w: 12, h: 8 },
                })),
            },
            overwrite: true,
        };
    }
    function grafanaAnnotation(text, tags) {
        return { time: Date.now(), text, tags: tags || ["userscript-suite"] };
    }

    // --- 347 Alertmanager rules ---
    function alertmanagerRule(groupName, alerts) {
        const lines = ["groups:", "  - name: " + groupName, "    rules:"];
        for (const a of alerts || []) {
            lines.push("      - alert: " + a.alert);
            lines.push("        expr: " + a.expr);
            lines.push("        for: " + (a.for || "5m"));
            lines.push("        labels:");
            lines.push("          severity: " + (a.severity || "warning"));
            lines.push("        annotations:");
            lines.push("          summary: " + (a.summary || a.alert));
        }
        return lines.join("\n");
    }

    // --- shared sender (guarded fetch; tests may inject) ---
    async function postJson(url, body, headers, fetchImpl) {
        const f = fetchImpl || (typeof fetch === "function" ? fetch : null);
        if (!f) throw new Error("fetch unavailable");
        const res = await f(url, {
            method: "POST",
            headers: { "content-type": "application/json", ...(headers || {}) },
            body: JSON.stringify(body),
        });
        return { status: res.status, ok: res.ok };
    }

    // --- 348 PagerDuty ---
    function pagerDutyPayload(config, summary, severity, dedupKey) {
        return {
            routing_key: config.routingKey,
            event_action: "trigger",
            dedup_key: dedupKey || "userscript-" + Date.now(),
            payload: {
                summary,
                source: state.settings.serviceName,
                severity: severity || "warning",
                timestamp: new Date().toISOString(),
            },
        };
    }
    async function notifyPagerDuty(config, summary, severity, dedupKey) {
        return postJson(
            "https://events.pagerduty.com/v2/enqueue",
            pagerDutyPayload(config, summary, severity, dedupKey)
        );
    }

    // --- 349 Opsgenie ---
    function opsgeniePayload(config, message, severity, alias) {
        return {
            message,
            alias: alias || message.slice(0, 64),
            description: message,
            priority: severity === "critical" ? "P1" : "P3",
            responders: config.responders || [],
        };
    }
    async function notifyOpsgenie(config, message, severity) {
        return postJson(
            "https://api.opsgenie.com/v2/alerts",
            opsgeniePayload(config, message, severity),
            { Authorization: "GenieKey " + (config.apiKey || "") }
        );
    }

    // --- 350 VictorOps (Splunk On-Call) ---
    function victorOpsPayload(config, message, severity, entityId) {
        return {
            message_type: severity === "critical" ? "CRITICAL" : "WARNING",
            entity_id: entityId || "userscript-" + Date.now(),
            state_message: message,
            routing_key: config.routingKey,
        };
    }
    async function notifyVictorOps(config, message, severity, entityId) {
        return postJson(
            "https://alert.victorops.com/integrations/generic/20131114/alert/" + (config.routingKey || ""),
            victorOpsPayload(config, message, severity, entityId)
        );
    }

    // --- 351 ServiceNow ---
    function serviceNowPayload(config, summary, severity) {
        return {
            short_description: summary,
            severity: severity === "critical" ? 1 : 3,
            impact: severity === "critical" ? 1 : 2,
            caller_id: config.callerId || "userscript-suite",
        };
    }
    async function notifyServiceNow(config, summary, severity) {
        return postJson(
            config.instanceUrl + "/api/now/table/incident",
            serviceNowPayload(config, summary, severity),
            { Authorization: "Basic " + (config.auth || "") }
        );
    }

    // --- 352 Splunk (HEC) ---
    function splunkPayload(event, opts) {
        return {
            event,
            time: Date.now() / 1000,
            sourcetype: (opts && opts.sourcetype) || "userscript",
            index: (opts && opts.index) || "main",
        };
    }

    // --- 353 ELK (single doc) ---
    function elkPayload(index, doc) {
        return { index, "@timestamp": new Date().toISOString(), document: doc };
    }

    // --- 354 DataDog ---
    function dataDogPayload(message, status, tags) {
        return {
            message,
            status: status || "info",
            ddsource: "userscript",
            ddtags: (tags || []).join(","),
        };
    }
    function dataDogSeries(metric, points, tags) {
        return {
            series: [
                {
                    metric,
                    points: points.map(([offsetSec, value]) => [Date.now() / 1000 + offsetSec, value]),
                    type: "gauge",
                    tags: tags || [],
                },
            ],
        };
    }

    // --- 355 New Relic ---
    function newRelicPayload(events, commonAttributes) {
        return [{ common: { attributes: commonAttributes || {} }, events }];
    }

    // --- 356 Honeycomb ---
    function honeycombPayload(dataset, data) {
        return { dataset, time: new Date().toISOString(), data };
    }

    // --- stack parsing shared by error trackers (357-360) ---
    function parseStackTrace(error) {
        const frames = [];
        const lines = String((error && error.stack) || "").split("\n");
        for (const line of lines) {
            const v8 = line.match(/at\s+(.*?)\s*\(?([^\s()]+?):(\d+):(\d+)\)?\s*$/);
            const sm = v8 || line.match(/^(.*?)@([^\s()]+?):(\d+):(\d+)\s*$/);
            if (!sm) continue;
            const fn = (sm[1] || "").replace(/^at\s+/, "").trim();
            frames.push({
                function: fn || "anonymous",
                file: sm[2],
                line: parseInt(sm[3], 10),
                column: parseInt(sm[4], 10),
            });
        }
        return frames;
    }

    // --- 357 Honeybadger ---
    function honeybadgerPayload(error, context) {
        return {
            error: {
                class: (error && error.name) || "Error",
                message: String(error && error.message ? error.message : error),
                backtrace: parseStackTrace(error).map((f) => ({
                    file: f.file,
                    number: f.line,
                    method: f.function,
                })),
            },
            context: context || {},
        };
    }

    // --- 358 Sentry ---
    function sentryPayload(error, level) {
        const message = String(error && error.message ? error.message : error);
        return {
            event_id: uuid(),
            platform: "javascript",
            level: level || "error",
            message,
            timestamp: new Date().toISOString(),
            exception: {
                values: [
                    {
                        type: (error && error.name) || "Error",
                        value: message,
                        stacktrace: {
                            frames: parseStackTrace(error)
                                .slice()
                                .reverse()
                                .map((f) => ({ filename: f.file, function: f.function, lineno: f.line, colno: f.column })),
                        },
                    },
                ],
            },
        };
    }

    // --- 359 Bugsnag ---
    function bugsnagPayload(error, severity) {
        return {
            notifier: { name: MODULE_NAME, version: metadata.version },
            events: [
                {
                    severity: severity || "warning",
                    exceptions: [
                        {
                            errorClass: (error && error.name) || "Error",
                            message: String(error && error.message ? error.message : error),
                            stacktrace: parseStackTrace(error).map((f) => ({
                                file: f.file,
                                lineNumber: f.line,
                                method: f.function,
                            })),
                        },
                    ],
                },
            ],
        };
    }

    // --- 360 Rollbar ---
    function rollbarPayload(error, environment) {
        return {
            data: {
                environment: environment || "production",
                level: "error",
                body: {
                    trace: {
                        exception: {
                            class: (error && error.name) || "Error",
                            message: String(error && error.message ? error.message : error),
                        },
                        frames: parseStackTrace(error).map((f) => ({
                            filename: f.file,
                            lineno: f.line,
                            method: f.function,
                        })),
                    },
                },
            },
        };
    }

    function init() {
        if (state.initialized) return;
        load();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ROADMAP 341-360 coverage active`);
    }
    function getHealth() {
        return {
            healthy: state.initialized,
            details:
                `${Object.keys(state.spans).length} traces, ` +
                `${Object.keys(state.metrics).length} metrics registered`,
        };
    }
    if (typeof window !== "undefined") {
        window.__NEXUS_OBSERVABILITY__ = {
            init,
            getHealth,
            metadata,
            getInternalState,
            configureObservability,
            uuid,
            startSpan,
            finishSpan,
            getTrace,
            listTraces,
            clearTraces,
            toOtlpSpans,
            jaegerPayload,
            exportToJaeger,
            zipkinPayload,
            registerMetric,
            incCounter,
            setGauge,
            observeHistogram,
            prometheusText,
            grafanaDashboard,
            grafanaAnnotation,
            alertmanagerRule,
            postJson,
            pagerDutyPayload,
            notifyPagerDuty,
            opsgeniePayload,
            notifyOpsgenie,
            victorOpsPayload,
            notifyVictorOps,
            serviceNowPayload,
            notifyServiceNow,
            splunkPayload,
            elkPayload,
            dataDogPayload,
            dataDogSeries,
            newRelicPayload,
            honeycombPayload,
            parseStackTrace,
            honeybadgerPayload,
            sentryPayload,
            bugsnagPayload,
            rollbarPayload,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (typeof document !== "undefined" && document.readyState === "complete") {
        init();
    } else if (typeof window !== "undefined") {
        window.addEventListener("load", init);
    }




})();
