// ==UserScript==
// @name         Code Shrinker
// @namespace    http://tampermonkey.net/
// @version      2026.04.05.1
// @description  JavaScript shrinker with minify and simple tree-shake options plus UI controls
// @author       AI RMD
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'codeShrinkerSettings';
    const LEGACY_STORAGE_KEY = 'jsCodeShrinkerSettings';
    const DEFAULT_SETTINGS = {
        autoShrink: false,
        shrinkLevel: 'minify',
        removeComments: true,
        removeWhitespace: true,
        shortenVariables: false,
        preserveNewlines: false,
        removeEmptyLines: true,
        collapseBooleanLiterals: true,
        optimizeStrings: true,
        removeSemicolons: false,
        aggressiveMode: false,
        panelOpen: true
    };

    let settings = { ...DEFAULT_SETTINGS };
    let saveTimer = null;
    let initialized = false;
    const UI_IDS = {
        panel: 'code-shrinker-panel',
        toggle: 'code-shrinker-toggle',
        input: 'code-shrinker-input',
        output: 'code-shrinker-output',
        stats: 'code-shrinker-stats'
    };

    const getValue = async (key) => {
        if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') {
            return GM.getValue(key);
        }
        if (typeof GM_getValue === 'function') {
            return GM_getValue(key);
        }
        return null;
    };

    const setValue = async (key, value) => {
        if (typeof GM !== 'undefined' && typeof GM.setValue === 'function') {
            return GM.setValue(key, value);
        }
        if (typeof GM_setValue === 'function') {
            return GM_setValue(key, value);
        }
        return null;
    };

    const notify = (text) => {
        if (typeof GM_notification === 'function') {
            GM_notification({ text, title: 'Code Shrinker', timeout: 2000 });
        } else {
            console.log(`CodeShrinker: ${text}`);
        }
    };

    const normalizeSettings = (raw) => {
        if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
        const allowedLevels = ['minify', 'tree-shake', 'both'];
        const next = { ...DEFAULT_SETTINGS, ...raw };
        if (!allowedLevels.includes(next.shrinkLevel)) {
            next.shrinkLevel = DEFAULT_SETTINGS.shrinkLevel;
        }
        return next;
    };

    const loadSettings = async () => {
        try {
            const saved = await getValue(STORAGE_KEY);
            if (saved) {
                const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
                settings = normalizeSettings(parsed);
                return;
            }
        } catch (err) {
            console.warn('CodeShrinker: failed to load GM settings', err);
        }

        try {
            const legacy = await getValue(LEGACY_STORAGE_KEY);
            if (legacy) {
                const parsed = typeof legacy === 'string' ? JSON.parse(legacy) : legacy;
                settings = normalizeSettings({ ...settings, ...parsed });
                queueSaveSettings();
                return;
            }
        } catch (err) {
            console.warn('CodeShrinker: failed to load legacy GM settings', err);
        }

        try {
            const savedLocal = localStorage.getItem(STORAGE_KEY);
            if (savedLocal) {
                settings = normalizeSettings(JSON.parse(savedLocal));
                return;
            }
        } catch (err) {
            console.warn('CodeShrinker: failed to load local settings', err);
        }

        try {
            const legacyLocal = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacyLocal) {
                settings = normalizeSettings({ ...settings, ...JSON.parse(legacyLocal) });
                queueSaveSettings();
            }
        } catch (err) {
            console.warn('CodeShrinker: failed to load legacy local settings', err);
        }
    };

    const queueSaveSettings = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            try {
                await setValue(STORAGE_KEY, JSON.stringify(settings));
            } catch (err) {
                console.warn('CodeShrinker: falling back to localStorage', err);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            }
            saveTimer = null;
        }, 200);
    };

    window.CodeShrinker = window.CodeShrinker || {};

    window.CodeShrinker.shrink = function(code, options = {}) {
        const defaults = {
            removeComments: true,
            removeWhitespace: true,
            shortenVariables: false,
            preserveNewlines: false,
            removeEmptyLines: true,
            collapseBooleanLiterals: true,
            optimizeStrings: true,
            removeSemicolons: false,
            aggressiveMode: false
        };

        const active = { ...defaults, ...options };
        if (!code || typeof code !== 'string') {
            console.error('CodeShrinker: invalid input code');
            return '';
        }

        let result = code;
        const originalLength = code.length;

        try {
            if (active.removeComments) {
                result = this._removeComments(result);
            }
            if (active.removeWhitespace) {
                result = this._removeWhitespace(result, active);
            }
            if (active.removeEmptyLines) {
                result = result.replace(/^\s*\n/gm, '');
            }
            if (active.optimizeStrings) {
                result = this._optimizeStrings(result);
            }
            if (active.collapseBooleanLiterals) {
                result = result.replace(/\btrue\b/g, '!!1').replace(/\bfalse\b/g, '!1');
            }
            if (active.removeSemicolons) {
                result = this._removeSemicolons(result);
            }
            if (active.aggressiveMode) {
                result = this._aggressiveOptimizations(result);
            }

            const reduction = ((originalLength - result.length) / Math.max(1, originalLength) * 100).toFixed(1);
            console.log(`CodeShrinker: Reduced code by ${reduction}% (${originalLength} -> ${result.length} chars)`);
        } catch (error) {
            console.error('CodeShrinker: error during minification:', error);
            return code;
        }

        return result;
    };

    window.CodeShrinker._removeComments = function(code) {
        return code
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/[^\n]*(\n|$)/g, '$1');
    };

    window.CodeShrinker._removeWhitespace = function(code, active) {
        if (active.preserveNewlines) {
            return code
                .replace(/[ \t]+/g, ' ')
                .replace(/[ \t]*([\r\n]+)[ \t]*/g, '$1')
                .replace(/[ \t]*([{}:;,=\(\)\[\]])[ \t]*/g, '$1')
                .replace(/\s*([+\-*/%&|^<>!?:])\s*/g, '$1')
                .replace(/(if|for|while|switch|catch|function|return|var|let|const)\(/g, '$1 (')
                .trim();
        }
        return code
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}:;,=\(\)\[\]])\s*/g, '$1')
            .replace(/\s*([+\-*/%&|^<>!?:])\s*/g, '$1')
            .replace(/(if|for|while|switch|catch|function|return|var|let|const)\(/g, '$1 (')
            .trim();
    };

    window.CodeShrinker._optimizeStrings = function(code) {
        return code.replace(/(["'])([^"']*)\1/g, (match, quote, content) => {
            const singleLength = `'${content}'`.length;
            const doubleLength = `"${content}"`.length;
            if (content.includes("'") && !content.includes('"')) {
                return `"${content}"`;
            }
            if (content.includes('"') && !content.includes("'")) {
                return `'${content}'`;
            }
            return singleLength <= doubleLength ? `'${content}'` : `"${content}"`;
        });
    };

    window.CodeShrinker._removeSemicolons = function(code) {
        return code
            .replace(/;\s*}/g, '}')
            .replace(/;\s*$/gm, '');
    };

    window.CodeShrinker._aggressiveOptimizations = function(code) {
        return code
            .replace(/\bfunction\b/g, 'f')
            .replace(/\bvar\b/g, 'v')
            .replace(/\blet\b/g, 'l')
            .replace(/\bconst\b/g, 'c')
            .replace(/\breturn\b/g, 'r')
            .replace(/\bif\b/g, 'i')
            .replace(/\bfor\b/g, 'o')
            .replace(/\bwhile\b/g, 'w')
            .replace(/\btrue\b/g, 't')
            .replace(/\bfalse\b/g, 'f')
            .replace(/\bnull\b/g, 'n')
            .replace(/\bundefined\b/g, 'u');
    };

    window.CodeShrinker.benchmark = function(code, iterations = 100) {
        if (!code || typeof code !== 'string') {
            console.error('CodeShrinker: invalid input for benchmark');
            return null;
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            this.shrink(code);
        }
        const end = performance.now();
        const totalTime = end - start;

        return {
            totalTime: totalTime.toFixed(2),
            averageTime: (totalTime / iterations).toFixed(2),
            iterations,
            codeSize: code.length,
            minifiedSize: this.shrink(code).length
        };
    };

    window.CodeShrinker.batchShrink = function(codes, options = {}) {
        if (!Array.isArray(codes)) {
            console.error('CodeShrinker: input must be an array');
            return [];
        }
        return codes.map((code, index) => {
            try {
                const result = this.shrink(code, options);
                return {
                    index,
                    originalSize: code.length,
                    minifiedSize: result.length,
                    reduction: ((code.length - result.length) / Math.max(1, code.length) * 100).toFixed(1),
                    minifiedCode: result
                };
            } catch (error) {
                console.error(`CodeShrinker: error processing code at index ${index}:`, error);
                return { index, error: error.message, originalSize: code.length };
            }
        });
    };

    window.CodeShrinker.getStats = function(code, options = {}) {
        if (!code || typeof code !== 'string') {
            console.error('CodeShrinker: invalid input for stats');
            return null;
        }
        const minified = this.shrink(code, options);
        const comments = (code.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g) || []).length;
        const strings = (code.match(/(["'])([^"']*)\1/g) || []).length;
        const functions = (code.match(/\bfunction\b/g) || []).length;
        const variables = (code.match(/\b(var|let|const)\b/g) || []).length;
        return {
            originalSize: code.length,
            minifiedSize: minified.length,
            reductionPercent: ((code.length - minified.length) / Math.max(1, code.length) * 100).toFixed(1),
            reductionBytes: code.length - minified.length,
            linesOriginal: code.split('\n').length,
            linesMinified: minified.split('\n').length,
            commentsRemoved: comments,
            stringsCount: strings,
            functionsCount: functions,
            variablesCount: variables,
            compressionRatio: (code.length / Math.max(1, minified.length)).toFixed(2)
        };
    };

    const treeShakeCode = (code) => {
        return code
            .split('\n')
            .filter(line => !/\bconsole\./.test(line) && !/\bdebugger\b/.test(line))
            .join('\n');
    };

    const detectJavaScript = () => {
        const scripts = Array.from(document.querySelectorAll('script'));
        const snippets = [];
        scripts.forEach((script) => {
            if (script.src) {
                snippets.push(`// External script: ${script.src}`);
            } else {
                const text = (script.textContent || '').trim();
                if (text) snippets.push(text);
            }
        });
        return snippets.join('\n\n');
    };

    const getShrinkOptions = () => ({
        removeComments: settings.removeComments,
        removeWhitespace: settings.removeWhitespace,
        shortenVariables: settings.shortenVariables,
        preserveNewlines: settings.preserveNewlines,
        removeEmptyLines: settings.removeEmptyLines,
        collapseBooleanLiterals: settings.collapseBooleanLiterals,
        optimizeStrings: settings.optimizeStrings,
        removeSemicolons: settings.removeSemicolons,
        aggressiveMode: settings.aggressiveMode
    });

    const applyShrinkPipeline = (code) => {
        let result = code;
        if (settings.shrinkLevel === 'tree-shake' || settings.shrinkLevel === 'both') {
            result = treeShakeCode(result);
        }
        if (settings.shrinkLevel === 'minify' || settings.shrinkLevel === 'both') {
            result = window.CodeShrinker.shrink(result, getShrinkOptions());
        }
        return result;
    };

    const openOutput = (text) => {
        const url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
        if (typeof GM_openInTab === 'function') {
            GM_openInTab(url, true);
        } else {
            window.open(url, '_blank');
        }
    };

    const copyOutput = (text) => {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text);
            notify('Output copied to clipboard');
            return;
        }
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => notify('Output copied to clipboard'));
        }
    };

    const updateStats = (input, output) => {
        const statsEl = document.getElementById(UI_IDS.stats);
        if (!statsEl) return;
        if (!input) {
            statsEl.textContent = '';
            return;
        }
        const reduction = ((input.length - output.length) / Math.max(1, input.length) * 100).toFixed(1);
        statsEl.textContent = `Original: ${input.length} chars | Output: ${output.length} chars | Reduction: ${reduction}%`;
    };

    const shrinkInput = () => {
        const inputEl = document.getElementById(UI_IDS.input);
        const outputEl = document.getElementById(UI_IDS.output);
        if (!inputEl || !outputEl) return;
        const code = inputEl.value || '';
        if (!code.trim()) {
            notify('No input code to shrink');
            return;
        }
        const result = applyShrinkPipeline(code);
        outputEl.value = result;
        updateStats(code, result);
    };

    const detectPageScripts = () => {
        const inputEl = document.getElementById(UI_IDS.input);
        if (!inputEl) return;
        const code = detectJavaScript();
        if (!code) {
            notify('No script tags found');
            return;
        }
        inputEl.value = code;
        notify('Page scripts loaded');
    };

    const shrinkPageScripts = () => {
        const code = detectJavaScript();
        if (!code) {
            notify('No script tags found');
            return;
        }
        const result = applyShrinkPipeline(code);
        const outputEl = document.getElementById(UI_IDS.output);
        if (outputEl) {
            outputEl.value = result;
            updateStats(code, result);
        }
        openOutput(result);
    };

    const setPanelOpen = (open) => {
        settings.panelOpen = open;
        queueSaveSettings();
        const panel = document.getElementById(UI_IDS.panel);
        if (!panel) return;
        panel.classList.toggle('cs-collapsed', !open);
    };

    const bindCheckbox = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = !!settings[key];
        el.addEventListener('change', () => {
            settings[key] = el.checked;
            queueSaveSettings();
        });
    };

    const bindSelect = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = settings[key];
        el.addEventListener('change', () => {
            settings[key] = el.value;
            queueSaveSettings();
        });
    };

    const createCheckboxLabel = (id, text) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${text}`));
        return label;
    };

    const createButton = (id, text, className = '') => {
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.textContent = text;
        if (className) {
            button.className = className;
        }
        return button;
    };

    const createRow = (className = 'cs-row') => {
        const row = document.createElement('div');
        row.className = className;
        return row;
    };

    const createOption = (value, text) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    };

    const createUI = () => {
        if (document.getElementById(UI_IDS.panel)) return;

        GM_addStyle(`
            #${UI_IDS.panel} {
                position: fixed;
                bottom: 12px;
                right: 12px;
                width: 360px;
                background: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 8px;
                box-shadow: 0 4px 18px rgba(0,0,0,0.15);
                z-index: 99999;
                font-family: Segoe UI, Arial, sans-serif;
                color: #1e1e1e;
            }
            #${UI_IDS.panel} .cs-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                background: #f5f5f5;
                border-bottom: 1px solid #e0e0e0;
                font-weight: 600;
            }
            #${UI_IDS.panel} .cs-body {
                padding: 10px 12px;
            }
            #${UI_IDS.panel} .cs-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }
            #${UI_IDS.panel} label {
                font-size: 12px;
            }
            #${UI_IDS.panel} select,
            #${UI_IDS.panel} textarea,
            #${UI_IDS.panel} button {
                font-size: 12px;
            }
            #${UI_IDS.panel} textarea {
                width: 100%;
                height: 90px;
                resize: vertical;
                font-family: Consolas, monospace;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 6px;
            }
            #${UI_IDS.panel} .cs-actions button {
                padding: 6px 10px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #f7f7f7;
                cursor: pointer;
            }
            #${UI_IDS.panel} .cs-actions button.primary {
                background: #2d7ff9;
                border-color: #2d7ff9;
                color: #ffffff;
            }
            #${UI_IDS.panel} .cs-stats {
                font-size: 11px;
                color: #555;
                margin-top: 6px;
            }
            #${UI_IDS.panel}.cs-collapsed .cs-body {
                display: none;
            }
        `);

        const panel = document.createElement('div');
        panel.id = UI_IDS.panel;
        const header = document.createElement('div');
        header.className = 'cs-header';
        const title = document.createElement('span');
        title.textContent = 'Code Shrinker';
        const toggleButton = createButton('cs-toggle', 'Toggle');
        toggleButton.setAttribute('aria-label', 'Toggle panel');
        header.appendChild(title);
        header.appendChild(toggleButton);

        const body = document.createElement('div');
        body.className = 'cs-body';

        const autoShrinkRow = createRow();
        autoShrinkRow.appendChild(createCheckboxLabel('cs-autoShrink', 'Auto Shrink on Load'));

        const shrinkLevelRow = createRow();
        const shrinkLevelLabel = document.createElement('label');
        shrinkLevelLabel.setAttribute('for', 'cs-shrinkLevel');
        shrinkLevelLabel.textContent = 'Shrink Level';
        const shrinkLevelSelect = document.createElement('select');
        shrinkLevelSelect.id = 'cs-shrinkLevel';
        shrinkLevelSelect.appendChild(createOption('minify', 'Minify'));
        shrinkLevelSelect.appendChild(createOption('tree-shake', 'Tree Shake'));
        shrinkLevelSelect.appendChild(createOption('both', 'Minify + Tree Shake'));
        shrinkLevelRow.appendChild(shrinkLevelLabel);
        shrinkLevelRow.appendChild(shrinkLevelSelect);

        const advanced = document.createElement('details');
        advanced.id = 'cs-advanced';
        advanced.open = true;
        const advancedSummary = document.createElement('summary');
        advancedSummary.textContent = 'Advanced Options';
        const advancedRow = createRow();
        advancedRow.appendChild(createCheckboxLabel('cs-removeComments', 'Remove Comments'));
        advancedRow.appendChild(createCheckboxLabel('cs-removeWhitespace', 'Remove Whitespace'));
        advancedRow.appendChild(createCheckboxLabel('cs-optimizeStrings', 'Optimize Strings'));
        advancedRow.appendChild(createCheckboxLabel('cs-collapseBooleans', 'Collapse Booleans'));
        advancedRow.appendChild(createCheckboxLabel('cs-removeEmptyLines', 'Remove Empty Lines'));
        advancedRow.appendChild(createCheckboxLabel('cs-removeSemicolons', 'Remove Semicolons'));
        advancedRow.appendChild(createCheckboxLabel('cs-preserveNewlines', 'Preserve Newlines'));
        advancedRow.appendChild(createCheckboxLabel('cs-aggressiveMode', 'Aggressive Mode'));
        advanced.appendChild(advancedSummary);
        advanced.appendChild(advancedRow);

        const actionsRow = createRow('cs-row cs-actions');
        actionsRow.appendChild(createButton('cs-detect', 'Detect Page JS'));
        actionsRow.appendChild(createButton('cs-shrink', 'Shrink Input', 'primary'));
        actionsRow.appendChild(createButton('cs-clear', 'Clear'));

        const input = document.createElement('textarea');
        input.id = UI_IDS.input;
        input.placeholder = 'Paste or detect JavaScript code...';

        const outputActionsRow = createRow('cs-row cs-actions');
        outputActionsRow.appendChild(createButton('cs-copy', 'Copy Output'));
        outputActionsRow.appendChild(createButton('cs-open', 'Open Output'));

        const output = document.createElement('textarea');
        output.id = UI_IDS.output;
        output.placeholder = 'Shrunk output will appear here...';
        output.readOnly = true;

        const stats = document.createElement('div');
        stats.id = UI_IDS.stats;
        stats.className = 'cs-stats';

        body.appendChild(autoShrinkRow);
        body.appendChild(shrinkLevelRow);
        body.appendChild(advanced);
        body.appendChild(actionsRow);
        body.appendChild(input);
        body.appendChild(outputActionsRow);
        body.appendChild(output);
        body.appendChild(stats);

        panel.appendChild(header);
        panel.appendChild(body);

        document.body.appendChild(panel);

        const toggleBtn = panel.querySelector('#cs-toggle');
        toggleBtn.addEventListener('click', () => {
            setPanelOpen(!settings.panelOpen);
        });

        bindCheckbox('cs-autoShrink', 'autoShrink');
        bindSelect('cs-shrinkLevel', 'shrinkLevel');
        bindCheckbox('cs-removeComments', 'removeComments');
        bindCheckbox('cs-removeWhitespace', 'removeWhitespace');
        bindCheckbox('cs-optimizeStrings', 'optimizeStrings');
        bindCheckbox('cs-collapseBooleans', 'collapseBooleanLiterals');
        bindCheckbox('cs-removeEmptyLines', 'removeEmptyLines');
        bindCheckbox('cs-removeSemicolons', 'removeSemicolons');
        bindCheckbox('cs-preserveNewlines', 'preserveNewlines');
        bindCheckbox('cs-aggressiveMode', 'aggressiveMode');

        panel.querySelector('#cs-detect').addEventListener('click', detectPageScripts);
        panel.querySelector('#cs-shrink').addEventListener('click', shrinkInput);
        panel.querySelector('#cs-clear').addEventListener('click', () => {
            const inputEl = document.getElementById(UI_IDS.input);
            const outputEl = document.getElementById(UI_IDS.output);
            if (inputEl) inputEl.value = '';
            if (outputEl) outputEl.value = '';
            updateStats('', '');
        });
        panel.querySelector('#cs-copy').addEventListener('click', () => {
            const outputEl = document.getElementById(UI_IDS.output);
            if (outputEl && outputEl.value) {
                copyOutput(outputEl.value);
            } else {
                notify('No output to copy');
            }
        });
        panel.querySelector('#cs-open').addEventListener('click', () => {
            const outputEl = document.getElementById(UI_IDS.output);
            if (outputEl && outputEl.value) {
                openOutput(outputEl.value);
            } else {
                notify('No output to open');
            }
        });

        setPanelOpen(settings.panelOpen);
    };

    const registerHotkeys = () => {
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                shrinkPageScripts();
            }
        });
    };

    const registerMenuCommands = () => {
        if (typeof GM_registerMenuCommand !== 'function') return;
        GM_registerMenuCommand('Shrink Page Scripts', shrinkPageScripts);
        GM_registerMenuCommand('Toggle Panel', () => setPanelOpen(!settings.panelOpen));
        GM_registerMenuCommand('Toggle Auto Shrink', () => {
            settings.autoShrink = !settings.autoShrink;
            queueSaveSettings();
            notify(`Auto Shrink ${settings.autoShrink ? 'Enabled' : 'Disabled'}`);
        });
    };

    const init = async () => {
        if (initialized) return;
        initialized = true;
        await loadSettings();
        createUI();
        registerHotkeys();
        registerMenuCommands();
        if (settings.autoShrink) {
            shrinkPageScripts();
        }
    };

    const codeShrinkerModule = {
        name: 'CodeShrinker',
        version: '2026.04.05.1',
        dependencies: [],
        critical: false,
        init() {
            return init();
        }
    };

    const attemptRegistration = () => {
        if (!window.ChatGPTModules) {
            return false;
        }

        window.ChatGPTModules.register(codeShrinkerModule);
        return true;
    };

    if (!attemptRegistration()) {
        const checkInterval = setInterval(() => {
            if (attemptRegistration()) {
                clearInterval(checkInterval);
            }
        }, 100);
    }

    init();
})();
