// ==UserScript==
// @name         performance-optimizer
// @namespace    AI-Chat-Userscript-Studio
// @version      2026.09.26.1
// @description  Performance optimizer: critical CSS, lazy images, scheduling, WASM, pools (ROADMAP 171-200)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Performance Optimizer v1.0 - ROADMAP items 171-200 (Performance Optimizations)
 * 171 critical CSS, 172 fonts, 173 lazy images, 174 responsive images, 175 WebP/AVIF,
 * 176 SVG optimization, 177 icon fonts, 178 inline SVG sprites, 179 sprite sheets,
 * 180 CSS containment, 181 content-visibility, 182 will-change, 183 GPU acceleration,
 * 184 layer promotion, 185 paint holding, 186 display locking, 187 input delay,
 * 188 scheduling, 189 task priority, 190 idle callbacks, 191/192 frame batching,
 * 193 idle deadline work, 194 workers, 195 SharedArrayBuffer, 196 Atomics,
 * 197 SIMD probe, 198 WebAssembly loader, 199 WASM SIMD status, 200 thread pool.
 */
(() => {
    "use strict";
    const MODULE_NAME = "performance-optimizer";
    const CONFIG_KEY = "performance_optimizer_config";
    const metadata = {
        name: MODULE_NAME,
        version: "2026.09.26.1",
        dependencies: [],
        critical: false,
        category: "00-Core",
    };
    const state = {
        initialized: false,
        willChangeTracked: [], // 182 anti-pattern guard (never persisted)
        svgSymbols: {}, // 178 name -> inner svg markup (rebuilt per page)
        wasmCache: new Map(), // 198 source -> instance
        settings: { willChangeLimit: 50, defaultIntrinsicHeight: 300 },
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
    function configurePerf(patch) {
        Object.assign(state.settings, patch || {});
        save();
        return { ...state.settings };
    }

    // --- 171 critical CSS extraction ---
    function extractCriticalRules(cssText, usedClasses) {
        const kept = [];
        const re = /([^{}]+)\{([^{}]*)\}/g;
        let m = re.exec(String(cssText));
        while (m) {
            const selector = m[1].trim();
            const body = m[2].trim();
            const keepAtRule = selector.indexOf("@") === 0;
            const used = (usedClasses || []).some((c) => selector.indexOf("." + c) >= 0);
            if (keepAtRule || used) kept.push(selector + " { " + body + " }");
            m = re.exec(String(cssText));
        }
        return kept.join("\n");
    }

    // --- 172 font optimization ---
    function buildFontCss(families) {
        const preconnect = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
        const rules = (families || []).map(
            (f) => "." + f + " { font-family: '" + f + "', sans-serif; font-display: swap; }"
        );
        return {
            preconnect,
            css: "@font-face { font-display: swap; }\n" + rules.join("\n"),
            strategy: "swap",
        };
    }

    // --- 173 image lazy loading ---
    function lazyifyImages(container) {
        if (!container || !container.querySelectorAll) return { count: 0, skipped: true };
        const imgs = container.querySelectorAll("img");
        let count = 0;
        for (const img of imgs) {
            img.setAttribute("loading", "lazy");
            img.setAttribute("decoding", "async");
            count++;
        }
        return { count };
    }

    // --- 174 responsive images ---
    function buildSrcSet(baseUrl, widths) {
        return (widths || []).map((w) => baseUrl + "?w=" + w + " " + w + "w").join(", ");
    }
    function pickBestCandidate(srcset, viewportWidth) {
        const candidates = String(srcset)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
                const parts = s.split(/\s+/);
                const wMatch = parts[1] ? parts[1].match(/^(\d+)w$/) : null;
                return { url: parts[0], width: wMatch ? parseInt(wMatch[1], 10) : Infinity };
            });
        const widthBased = candidates.filter((c) => c.width !== Infinity);
        if (!widthBased.length) return candidates[0] || null;
        widthBased.sort((a, b) => a.width - b.width);
        for (const c of widthBased) if (c.width >= viewportWidth) return c;
        return widthBased[widthBased.length - 1];
    }

    // --- 175 WebP/AVIF ---
    function buildPictureMarkup(src, alt, widths) {
        const w = widths || [480, 960, 1440];
        const srcset = w.map((x) => src + "?w=" + x + " " + x + "w").join(", ");
        return (
            "<picture>" +
            '<source type="image/avif" srcset="' + srcset + '">' +
            '<source type="image/webp" srcset="' + srcset + '">' +
            '<img src="' + src + '" alt="' + (alt || "") + '" loading="lazy" decoding="async">' +
            "</picture>"
        );
    }
    function modernFormatSupport(canvas) {
        if (!canvas || !canvas.toDataURL) return { webp: false, avif: false };
        return {
            webp: canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0,
            avif: canvas.toDataURL("image/avif").indexOf("data:image/avif") === 0,
        };
    }

    // --- 176 SVG optimization ---
    function optimizeSvg(svgText) {
        return String(svgText)
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
            .replace(/\s(inkscape:[\w-]+|sodipodi:[\w-]+)="[^"]*"/gi, "")
            .replace(/>\s+</g, "><")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    // --- 177 icon fonts ---
    function buildIconFontCss(fontFamily, glyphMap, prefix) {
        const p = prefix || "icon";
        const classes = Object.keys(glyphMap || {}).map(
            (name) => "." + p + "-" + name + ":before { content: '\\" + glyphMap[name].toString(16) + "'; }"
        );
        return {
            fontFamily,
            css:
                "@font-face { font-family: '" + fontFamily + "'; font-display: block; }\n" +
                classes.join("\n"),
        };
    }

    // --- 178 inline SVG sprite registry ---
    function registerSvgSymbol(name, svgText) {
        const inner = String(svgText)
            .replace(/^\s*<svg[^>]*>/i, "")
            .replace(/<\/svg>\s*$/i, "");
        state.svgSymbols[name] = inner;
        return name;
    }
    function getSvgSpriteSheet() {
        const symbols = Object.keys(state.svgSymbols).map(
            (n) => '<symbol id="icon-' + n + '">' + state.svgSymbols[n] + "</symbol>"
        );
        return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' + symbols.join("") + "</svg>";
    }

    // --- 179 CSS sprite sheets ---
    function buildSpriteCss(names, cellWidth, cellHeight, columns) {
        const cols = columns || names.length;
        return names
            .map((n, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                return "." + n + " { background-position: -" + col * cellWidth + "px -" + row * cellHeight + "px; }";
            })
            .join("\n");
    }

    // --- 180 CSS containment / 181 content-visibility / 186 display locking ---
    function applyContainment(el, type) {
        el.style.contain = type || "layout paint";
        return el.style.contain;
    }
    function applyContentVisibility(el, intrinsicHeight) {
        const h = intrinsicHeight || state.settings.defaultIntrinsicHeight;
        el.style.contentVisibility = "auto";
        el.style.containIntrinsicSize = "auto " + h + "px";
        return { contentVisibility: el.style.contentVisibility, containIntrinsicSize: el.style.containIntrinsicSize };
    }
    function displayLock(el, intrinsicHeight) {
        const h = intrinsicHeight || state.settings.defaultIntrinsicHeight;
        el.style.contentVisibility = "hidden";
        el.style.containIntrinsicSize = "auto " + h + "px";
        return el.style;
    }

    // --- 182 will-change (with anti-pattern guard) / 183 GPU / 184 layer promotion ---
    function setWillChange(el, props) {
        el.style.willChange = props;
        state.willChangeTracked.push(el);
        return state.willChangeTracked.length;
    }
    function willChangeReport(limit) {
        const tracked = state.willChangeTracked.length;
        return { tracked, overLimit: tracked > (limit || state.settings.willChangeLimit) };
    }
    function gpuAccelerate(el) {
        el.style.transform = "translateZ(0)";
        el.style.backfaceVisibility = "hidden";
        return el.style;
    }
    function promoteLayer(el) {
        el.style.isolation = "isolate";
        if (!el.style.transform) el.style.transform = "translateZ(0)";
        return el.style;
    }

    // --- 185 paint holding ---
    function paintHoldCss() {
        return ".paint-hold { content-visibility: hidden; } .paint-ready { content-visibility: visible; }";
    }

    // --- 187 input delay reduction ---
    function debounce(fn, ms) {
        let timer = null;
        return function debounced() {
            const args = arguments;
            const self = this;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                fn.apply(self, args);
            }, ms);
        };
    }
    function throttle(fn, ms) {
        let last = 0;
        let timer = null;
        return function throttled() {
            const args = arguments;
            const self = this;
            const now = Date.now();
            const remaining = ms - (now - last);
            if (remaining <= 0) {
                last = now;
                fn.apply(self, args);
            } else if (!timer) {
                timer = setTimeout(() => {
                    timer = null;
                    last = Date.now();
                    fn.apply(self, args);
                }, remaining);
            }
        };
    }
    function yieldToInput() {
        if (typeof scheduler === "object" && scheduler && typeof scheduler.yield === "function") {
            return scheduler.yield();
        }
        return new Promise((resolve) => setTimeout(resolve, 0));
    }

    // --- 188 main-thread scheduling / 189 task prioritization ---
    function scheduleTask(fn, priority) {
        const p = priority || "user-visible";
        if (p === "urgent") return Promise.resolve().then(fn);
        if (p === "background" && typeof requestIdleCallback === "function") {
            return new Promise((resolve) => requestIdleCallback(() => resolve(fn())));
        }
        return new Promise((resolve) => setTimeout(() => resolve(fn()), 0));
    }
    function createTaskQueue() {
        const tasks = [];
        return {
            push(fn, priority) {
                tasks.push({ fn, priority: priority || 0 });
            },
            size() {
                return tasks.length;
            },
            async drain() {
                tasks.sort((a, b) => b.priority - a.priority);
                const results = [];
                for (const task of tasks) results.push(await task.fn());
                tasks.length = 0;
                return results;
            },
        };
    }

    // --- 190/193 idle callbacks + deadline-bounded work ---
    function runIdle(fn) {
        if (typeof requestIdleCallback === "function") {
            return new Promise((resolve) => requestIdleCallback((deadline) => resolve(fn(deadline))));
        }
        return new Promise((resolve) => setTimeout(() => resolve(fn({ didTimeout: true, timeRemaining: () => 0 })), 0));
    }
    function idleDeadlineWork(items, fn, deadline, maxPerSlice) {
        const budget = deadline || { timeRemaining: () => 1, didTimeout: false };
        const cap = maxPerSlice || Infinity;
        let processed = 0;
        while (processed < items.length && processed < cap && (budget.didTimeout || budget.timeRemaining() > 0)) {
            fn(items[processed], processed);
            processed++;
        }
        return { processed, remaining: items.length - processed };
    }

    // --- 191/192 animation frames + batching ---
    function nextFrame() {
        return new Promise((resolve) => {
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame((ts) => resolve(ts));
            } else {
                setTimeout(() => resolve(Date.now()), 16);
            }
        });
    }
    const frameBatches = new Map();
    let frameScheduled = false;
    function frameBatch(key, fn) {
        if (!frameBatches.has(key)) frameBatches.set(key, []);
        frameBatches.get(key).push(fn);
        if (!frameScheduled && typeof requestAnimationFrame === "function") {
            frameScheduled = true;
            requestAnimationFrame(() => {
                const batches = new Map(frameBatches);
                frameBatches.clear();
                frameScheduled = false;
                for (const fns of batches.values()) for (const f of fns) f();
            });
        }
    }
    function animationLoop(cb) {
        let stopped = false;
        function tick(ts) {
            if (stopped) return;
            cb(ts);
            if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick);
        }
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick);
        return () => {
            stopped = true;
        };
    }

    // --- 194 web workers ---
    function canUseWorkers() {
        return (
            typeof Worker !== "undefined" &&
            typeof Blob !== "undefined" &&
            typeof URL !== "undefined" &&
            typeof URL.createObjectURL === "function"
        );
    }
    function workerSource(fn) {
        return (
            "self.onmessage = function(e) { var result = (" + String(fn) + ")(e.data); self.postMessage(result); };"
        );
    }
    function createInlineWorker(fn) {
        if (!canUseWorkers()) return null;
        const blob = new Blob([workerSource(fn)], { type: "application/javascript" });
        return new Worker(URL.createObjectURL(blob));
    }

    // --- 195 SharedArrayBuffer / 196 Atomics ---
    function sabSupported() {
        return typeof SharedArrayBuffer !== "undefined";
    }
    function createSharedCounter(bytes) {
        if (!sabSupported()) return null;
        const sab = new SharedArrayBuffer(bytes || 64);
        return { sab, view: new Int32Array(sab) };
    }
    function atomicIncrement(counter, index) {
        return Atomics.add(counter.view, index || 0, 1);
    }
    function atomicCompareExchange(counter, index, expected, replacement) {
        return Atomics.compareExchange(counter.view, index || 0, expected, replacement);
    }
    function atomicStore(counter, index, value) {
        Atomics.store(counter.view, index || 0, value);
        return Atomics.load(counter.view, index || 0);
    }

    // --- 197 SIMD probe / 198 WebAssembly loader / 199 WASM SIMD status ---
    function wasmSupported() {
        return typeof WebAssembly !== "undefined";
    }
    const MINIMAL_WASM = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
    function wasmKey(source) {
        // realm-independent cache key (instanceof fails across vm/browser realms)
        let s = "";
        for (let i = 0; i < source.length; i++) s += String.fromCharCode(source[i]);
        return s;
    }
    async function loadWasm(bytes, imports) {
        if (!wasmSupported()) throw new Error("WebAssembly unavailable");
        const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const key = wasmKey(source);
        if (state.wasmCache.has(key)) return state.wasmCache.get(key);
        const result = await WebAssembly.instantiate(source, imports || {});
        state.wasmCache.set(key, result.instance);
        return result.instance;
    }
    function simdSupport(probeBytes) {
        if (!wasmSupported()) return { wasm: false, simd: false };
        return {
            wasm: true,
            simd: probeBytes ? WebAssembly.validate(new Uint8Array(probeBytes)) : false,
            note: "pass a known SIMD module's bytes to probe v128 support",
        };
    }
    function wasmSimdStatus(probeBytes) {
        return simdSupport(probeBytes);
    }

    // --- 200 concurrency-limited pool ---
    async function runPool(jobs, limit) {
        const results = new Array(jobs.length);
        let next = 0;
        let active = 0;
        let maxConcurrent = 0;
        return new Promise((resolve) => {
            function launch() {
                while (active < limit && next < jobs.length) {
                    const i = next++;
                    active++;
                    if (active > maxConcurrent) maxConcurrent = active;
                    Promise.resolve()
                        .then(() => jobs[i]())
                        .then((r) => {
                            results[i] = r;
                        })
                        .catch((e) => {
                            results[i] = { error: String(e && e.message ? e.message : e) };
                        })
                        .then(() => {
                            active--;
                            if (next < jobs.length) launch();
                            else if (active === 0) resolve({ results, maxConcurrent });
                        });
                }
            }
            launch();
        });
    }

    function init() {
        if (state.initialized) return;
        load();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ROADMAP 171-200 coverage active`);
    }
    function getHealth() {
        return {
            healthy: state.initialized,
            details:
                `will-change tracked: ${state.willChangeTracked.length}, ` +
                `wasm: ${wasmSupported()}, workers: ${canUseWorkers()}`,
        };
    }
    if (typeof window !== "undefined") {
        window.__NEXUS_PERF__ = {
            init,
            getHealth,
            metadata,
            getInternalState,
            configurePerf,
            extractCriticalRules,
            buildFontCss,
            lazyifyImages,
            buildSrcSet,
            pickBestCandidate,
            buildPictureMarkup,
            modernFormatSupport,
            optimizeSvg,
            buildIconFontCss,
            registerSvgSymbol,
            getSvgSpriteSheet,
            buildSpriteCss,
            applyContainment,
            applyContentVisibility,
            displayLock,
            setWillChange,
            willChangeReport,
            gpuAccelerate,
            promoteLayer,
            paintHoldCss,
            debounce,
            throttle,
            yieldToInput,
            scheduleTask,
            createTaskQueue,
            runIdle,
            idleDeadlineWork,
            nextFrame,
            frameBatch,
            animationLoop,
            canUseWorkers,
            workerSource,
            createInlineWorker,
            sabSupported,
            createSharedCounter,
            atomicIncrement,
            atomicCompareExchange,
            atomicStore,
            wasmSupported,
            loadWasm,
            simdSupport,
            wasmSimdStatus,
            runPool,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (typeof document !== "undefined" && document.readyState === "complete") {
        init();
    } else if (typeof window !== "undefined") {
        window.addEventListener("load", init);
    }



})();
