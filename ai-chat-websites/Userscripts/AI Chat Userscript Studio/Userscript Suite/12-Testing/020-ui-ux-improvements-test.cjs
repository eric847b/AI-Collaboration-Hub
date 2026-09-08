"use strict";
const assert = require("assert");
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const modulePath = path.join(__dirname, "..", "Modules", "00-Core", "031-ui-ux-improvements.module.user.js");
const source = fs.readFileSync(modulePath, "utf8");

const log = [];
const sandbox = {
    console: { log: (...a) => log.push(a), error: () => {}, warn: () => {}, info: () => {} },
    window: {
        __NEXUS_HUB_REGISTRY__: { register: (meta, api) => {} },
        addEventListener: () => {},
        matchMedia: () => ({ matches: false }),
    },
    document: {
        documentElement: { setAttribute: () => {}, getAttribute: () => null, style: { setProperty: () => {} } },
        querySelectorAll: () => [], querySelector: () => null, querySelector: () => null,querySelector: () => null,
        createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
        head: { appendChild: () => {} },
        body: { appendChild: () => {} },
        activeElement: null,
        title: "",
    },
    performance: {
        now: () => 0,
        getEntriesByType: () => [],
        mark: () => {},
        measure: () => {},
    },
    GM_setValue: () => {},
    GM_getValue: () => "{}",
    GM_log: () => {},
    GM_addStyle: () => {},
    setTimeout: () => {},
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    Date, Math, JSON, Object, Array, String, Number, Boolean, Set, Map, RegExp, Error, TypeError,
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);
const script = new vm.Script(source, { filename: "031-ui-ux-improvements.module.user.js" });
const API = script.runInContext(context);

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; }
    catch (e) { failed++; console.error(`FAIL: ${name} - ${e.message}`); }
}

// ---- 101-105: Theming ----
test("applyTheme dark", () => {
    assert.strictEqual(API.applyTheme("dark"), "dark");
});
test("applyTheme light", () => {
    assert.strictEqual(API.applyTheme("light"), "light");
});
test("applyTheme system", () => {
    const r = API.applyTheme("system");
    assert.ok(["dark", "light"].includes(r));
});
test("detectSystemTheme", () => {
    assert.ok(["dark", "light"].includes(API.detectSystemTheme()));
});
test("injectCustomCSS", () => {
    assert.strictEqual(typeof API.injectCustomCSS, "function");
});
test("tailwindClass", () => {
    assert.strictEqual(API.tailwindClass("btn", "primary", "lg"), "btn-primary btn-lg");
});

// ---- 106-109: Components ----
test("registerComponent", () => {
    API.registerComponent("card", { template: "<div></div>" });
    assert.strictEqual(API.state.components.length, 1);
});
test("renderComponent", () => {
    API.registerComponent("card", { template: "<div>hello</div>" });
    const r = API.renderComponent("card", { title: "Hi" });
    assert.ok(typeof r === "string");
});
test("designToken", () => {
    API.designToken("color.primary", "#007bff");
    assert.strictEqual(API.getDesignToken("color.primary"), "#007bff");
});

// ---- 110-115: Visual Testing ----
test("captureSnapshot", () => {
    const s = API.captureSnapshot({ width: 100 });
    assert.ok(s.id);
    assert.ok(s.timestamp);
});
test("compareSnapshots", () => {
    const a = API.captureSnapshot({ width: 100 });
    const b = API.captureSnapshot({ width: 100 });
    const c = API.compareSnapshots(a, b);
    assert.ok(typeof c.diff === "number");
});
test("testBreakpoint", () => {
    const r = API.testBreakpoint(375);
    assert.ok(r.name);
    assert.ok(typeof r.width === "number");
});
test("emulateDevice", () => {
    const r = API.emulateDevice("iPhone SE");
    assert.ok(typeof r.width === "number");
});

// ---- 116-125: Input & A11y ----
test("trackGesture", () => {
    const g = API.trackGesture([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    assert.ok(["swipe_right", "swipe_left", "tap", "pan"].includes(g));
});
test("luminance", () => {
    const l = API.luminance([255, 255, 255]);
    assert.ok(l > 0.9 && l <= 1);
});
test("colorContrast black on white", () => {
    const c = API.colorContrast([0, 0, 0], [255, 255, 255]);
    assert.ok(c >= 20 && c <= 22);
});
test("manageFocus", () => {
    assert.strictEqual(typeof API.manageFocus, "function");
});
test("setupKeyboardNav", () => {
    assert.strictEqual(typeof API.setupKeyboardNav, "function");
});
test("addSkipLink", () => {
    assert.strictEqual(typeof API.addSkipLink, "function");
});

// ---- 126-133: Semantic & Structured Data ----
test("setAriaLabel", () => {
    assert.strictEqual(typeof API.setAriaLabel, "function");
});
test("announceToScreenReader", () => {
    assert.strictEqual(typeof API.announceToScreenReader, "function");
});
test("validateSemanticHTML", () => {
    const r = API.validateSemanticHTML([]);
    assert.ok(typeof r === "object");
});
test("extractMicrodata", () => {
    const r = API.extractMicrodata([]);
    assert.ok(Array.isArray(r));
});
test("buildSchemaOrg", () => {
    const r = API.buildSchemaOrg({ name: "Test", url: "https://example.com" });
    assert.ok(r["@context"]);
    assert.strictEqual(r.name, "Test");
});
test("buildOpenGraph", () => {
    const r = API.buildOpenGraph({ title: "Page", description: "Desc" });
    assert.strictEqual(r["og:title"], "Page");
});
test("buildTwitterCards", () => {
    const r = API.buildTwitterCards({ title: "Tweet", card: "summary" });
    assert.strictEqual(r["twitter:card"], "summary");
});
test("injectJSONLD", () => {
    assert.strictEqual(typeof API.injectJSONLD, "function");
});

// ---- 134-140: SEO & Performance ----
test("setMetaTags", () => {
    const r = API.setMetaTags({ description: "Test", keywords: ["a", "b"] });
    assert.ok(Array.isArray(r));
});
test("auditSEO", () => {
    const r = API.auditSEO({ title: "", description: "", h1: [] });
    assert.ok(typeof r.score === "number");
});
test("checkPerfBudget within", () => {
    const r = API.checkPerfBudget({ fcp: 1000, lcp: 2000, tti: 3000, cls: 0.05, kb: 300 });
    assert.strictEqual(r.withinBudget, true);
});
test("checkPerfBudget exceeded", () => {
    const r = API.checkPerfBudget({ fcp: 5000, lcp: 5000, tti: 5000, cls: 0.5, kb: 5000 });
    assert.strictEqual(r.withinBudget, false);
    assert.ok(Object.keys(r.violations).length > 0);
});
test("lighthouseCIScore", () => {
    const s = API.lighthouseCIScore({ fcp: 1000, lcp: 2000, tti: 3000, cls: 0.05, tbt: 100 });
    assert.ok(s >= 0 && s <= 100);
});
test("coreWebVitals", () => {
    const v = API.coreWebVitals();
    assert.ok(typeof v === "object");
});
test("analyzeBundle", () => {
    const r = API.analyzeBundle([{ src: "a.js", size: 1024 }, { src: "b.js", size: 2048 }]);
    assert.strictEqual(r.count, 2);
    assert.strictEqual(r.totalSizeKB, 3);
});
test("treeShake", () => {
    const r = API.treeShake(["a", "b"], ["a", "b", "c", "d"]);
    assert.strictEqual(r.kept.length, 2);
    assert.strictEqual(r.removed.length, 2);
    assert.strictEqual(r.savings, 50);
});

console.log(`\nui-ux-improvements: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
