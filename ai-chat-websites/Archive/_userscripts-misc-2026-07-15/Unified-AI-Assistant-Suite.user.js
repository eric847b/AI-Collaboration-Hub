// ==UserScript==
// @name         Unified AI Assistant Suite
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  Integrated AI assistant enhancement suite - script generation, management, and security dashboard
// @include      http://*/*
// @include      https://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @connect      api.openai.com
// @connect      api.anthropic.com
// @run-at       document-end
// ==/UserScript==

/**
 * Unified AI Assistant Suite v1.3.0
 *
 * Features:
 * - AI-powered userscript generation (OpenAI / Anthropic)
 * - Script validation and sanitization
 * - History tracking and management
 * - Security dashboard
 * - Tampermonkey menu integration
 */

(function () {
  "use strict";

  // ==================== CONFIGURATION ====================
  const CONFIG = {
    VERSION: "1.3.0",
    DEBUG: 0,
    MAX_SCRIPT_LENGTH: 8000,
    HISTORY_LIMIT: 25,
    STORAGE_KEYS: {
      history: "uai_h",
      settings: "uai_s",
      key: "uai_k",
    },
    UI_ID: "uai-ui",
    STYLE_ID: "uai-st",
    API_ENDPOINTS: {
      OPENAI: {
        url: "https://api.openai.com/v1/chat/completions",
      },
      ANTHROPIC: {
        url: "https://api.anthropic.com/v1/messages",
      },
    },
  };

  // ==================== STATE ====================
  const STATE = {
    modules: {},
    config: {
      enabled: 1,
      autoGenerate: 0,
      showDashboard: 1,
      showGenerator: 1,
      showSecurity: 1,
    },
    generatedScripts: [],
    validationResults: [],
    menuRegistered: 0,
    apiKey: "",
    activeProvider: "OPENAI",
  };

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Debug logger - only logs when DEBUG is enabled
   */
  const debugLog = (...args) => CONFIG.DEBUG && console.log("[UAI]", ...args);

  /**
   * Safe string trim - removes null bytes and whitespace
   * @param {*} value
   * @returns {string}
   */
  const safeTrim = (value) =>
    String(value ?? "")
      .replace(/\0/g, "")
      .trim();

  /**
   * Safe JSON parse with fallback
   * @param {*} value
   * @param {*} fallback
   * @returns {*}
   */
  const safeJsonParse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  /**
   * Load settings from GM storage
   * @returns {Object}
   */
  const loadSettings = () =>
    Object.assign(STATE.config, safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.settings, "{}"), {}));

  /**
   * Make a remote fetch request via GM_xmlhttpRequest
   * @param {string} url
   * @param {Object} options
   * @returns {Promise<*>}
   */
  const remoteFetch = async (url, options) => {
    return await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...options,
        url: url,
        onload: (response) => {
          try {
            resolve(JSON.parse(response.responseText));
          } catch {
            resolve(response.responseText);
          }
        },
        onerror: reject,
      });
    });
  };

  /**
   * Register a module in the state
   * @param {string} name
   * @param {Object} module
   */
  const registerModule = (name, module) => {
    STATE.modules[name] = STATE.modules[name] || (debugLog("Module:", name), module);
  };

  /**
   * Load generated scripts from storage
   * @returns {Array}
   */
  const loadGeneratedScripts = () => {
    const scripts = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.history, "[]"), []);
    return Array.isArray(scripts) ? scripts.filter(Boolean) : [];
  };

  /**
   * Save a generated script to history
   * @param {Object} script
   * @param {Object} validation
   * @param {string} source
   * @returns {Object}
   */
  const saveGeneratedScript = (script, validation, source) => {
    const history = loadGeneratedScripts().filter((entry) => entry && entry.id !== script.id);
    const fileName = generateFileName(script);
    const name = extractName(script) || fileName.replace(/\.user\.js$/, "");
    const record = {
      id: generateId(),
      timestamp: Date.now(),
      fileName: fileName,
      name: name,
      description: truncateDescription(source).slice(0, 160),
      validation: validation,
      content: script,
    };
    PhraseTracker.track(source || script, "s");
    history.unshift(record);
    GM_setValue(
      CONFIG.STORAGE_KEYS.history,
      JSON.stringify(history.slice(0, CONFIG.HISTORY_LIMIT))
    );
    STATE.generatedScripts = history;
    return record;
  };

  /**
   * Validate a userscript for common issues
   * @param {string} scriptContent
   * @returns {Object}
   */
  const validateScript = (scriptContent) => {
    const content = safeTrim(scriptContent);
    const issues = [];
    const warnings = [];

    // Check for metadata block
    if (!content.includes("// ==UserScript==")) {
      issues.push("No metadata");
    }

    // Check for @match or @include
    if (!/@match\s+|@include\s+/m.test(content)) {
      warnings.push("No @match");
    }

    // Check for IIFE wrapper
    if (!/\(function\s*\(\)\s*\{/.test(content)) {
      warnings.push("No IIFE");
    }

    // Check for dangerous patterns
    if (/\beval\s*\(/.test(content)) {
      warnings.push("eval()");
    }
    if (/\bdocument\.write\s*\(/.test(content)) {
      warnings.push("doc.write()");
    }
    if (/\.innerHTML\s*=/.test(content)) {
      warnings.push("innerHTML=");
    }

    // Check syntax
    try {
      new Function(content);
    } catch (error) {
      issues.push("Syntax: " + error.message);
    }

    // Check size
    if (content.length > CONFIG.MAX_SCRIPT_LENGTH) {
      warnings.push("Large");
    }

    return {
      ok: issues.length < 1,
      issues: issues,
      warnings: warnings,
      score: Math.max(
        0,
        100 - issues.length * 20 - warnings.length * 5 - (content.length > 5000 ? 10 : 0)
      ),
    };
  };

  /**
   * Optimize script whitespace
   * @param {string} scriptContent
   * @returns {string}
   */
  const optimizeScript = (scriptContent) => {
    return scriptContent
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  // ==================== PHRASE TRACKER ====================
  const PhraseTracker = {
    /**
     * Tokenize text into phrases
     * @param {string} text
     * @returns {Array}
     */
    tokenize(text) {
      return safeTrim(text)
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter(Boolean);
    },

    /**
     * Track phrase usage
     * @param {string} text
     * @param {string} namespace
     */
    track(text, namespace = "g") {
      const tokens = this.tokenize(text);
      if (!tokens.length) return;
      let phraseFreq = safeJsonParse(GM_getValue(`vf_${namespace}`, "{}"), {});
      tokens.forEach((token) => {
        phraseFreq[token] = (phraseFreq[token] || 0) + 1;
      });
      GM_setValue(`vf_${namespace}`, JSON.stringify(phraseFreq));
    },

    /**
     * Get phrase rankings
     * @param {string} text
     * @param {string} namespace
     * @returns {Array}
     */
    getRankings(text, namespace = "g") {
      const phraseFreq = safeJsonParse(GM_getValue(`vf_${namespace}`, "{}"), {});
      return this.tokenize(text)
        .map((token) => ({
          token: token,
          weight: phraseFreq[token] || 0,
        }))
        .sort((a, b) => b.weight - a.weight);
    },

    /**
     * Get common phrases from text
     * @param {string} text
     * @param {string} namespace
     * @returns {string}
     */
    getCommonPhrases(text, namespace = "g") {
      const rankings = this.getRankings(text, namespace);
      const topTokens = new Set(
        rankings
          .slice(0, Math.max(12, Math.ceil(rankings.length * 0.45)))
          .map((entry) => entry.token)
      );
      return (
        this.tokenize(text)
          .filter((token) => topTokens.has(token))
          .join(" ") || safeTrim(text)
      );
    },
  };

  /**
   * Extract @name from userscript metadata
   * @param {string} scriptContent
   * @returns {string}
   */
  const extractName = (scriptContent) => {
    const match = safeTrim(scriptContent).match(/@name\s+(.+)/);
    return safeTrim(match?.[1] || "").trim();
  };

  /**
   * Generate a safe filename from script name
   * @param {Object|string} script
   * @param {string} fallback
   * @returns {string}
   */
  const generateFileName = (script, fallback = `gen-${Date.now()}`) => {
    const name = typeof script === "string" ? extractName(script) : script.name || "";
    const base = name
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return (base || fallback) + ".user.js";
  };

  /**
   * Generate a unique ID
   * @returns {string}
   */
  const generateId = () => {
    return window.crypto?.randomUUID?.() || `s_${Math.random().toString(36).slice(2, 11)}`;
  };

  /**
   * Truncate and clean description text
   * @param {string} text
   * @returns {string}
   */
  const truncateDescription = (text) => {
    return (
      safeTrim(text)
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Auto"
    );
  };

  /**
   * Ensure script has proper userscript wrapper
   * @param {string} scriptContent
   * @param {string} prompt
   * @returns {string}
   */
  const ensureUserscriptWrapper = (scriptContent, prompt) => {
    const name = extractName(scriptContent) || "Script";
    if (scriptContent.includes("// ==UserScript==")) {
      return scriptContent;
    }
    return [
      "// ==UserScript==",
      `// @name         ${name}`,
      `// @description  ${truncateDescription(prompt)}`,
      "// @match        *://*/*",
      "// @grant        none",
      "// ==/UserScript==",
      "",
      "(function(){'use strict';",
      scriptContent,
      "})();",
    ].join("\n");
  };

  // ==================== STYLES ====================
  const STYLES = `
.u-sc{position:fixed;top:20px;right:20px;width:380px;background:rgba(15,23,42,.95);border:1px solid #334155;border-radius:12px;padding:16px;color:#fff;font:12px system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:99999;backdrop-filter:blur(10px)}
.u-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #334155;padding-bottom:8px}
.u-h h2{margin:0;font-size:14px;font-weight:600}
.u-v{color:#94a3b8;font-size:11px}
.u-tb{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:15px;padding:2px}
.u-tabs{display:flex;gap:4px;margin-bottom:14px}
.u-ta{padding:6px 14px;border:none;background:rgba(255,255,255,.05);color:#94a3b8;border-radius:6px 6px 0 0;cursor:pointer;font-size:11px}
.u-ta.active{background:rgba(255,255,255,.1);color:#fff}
.u-tc{display:none}.u-tc.active{display:block}
.u-stats{display:flex;gap:24px}
.u-si{text-align:center}.u-sl{display:block;color:#94a3b8;font-size:11px}.u-sv{display:block;font-size:18px;font-weight:600}
.u-cgr{margin-bottom:10px;display:flex;flex-direction:column;gap:4px}
.u-cgr label{color:#94a3b8;font-size:11px}
.u-cgr select,.u-cgr input{padding:6px;border-radius:5px;border:1px solid #475569;background:#1e293b;color:#fff;font-size:11px}
.u-pa{margin-bottom:14px}
.u-pa label{display:block;margin-bottom:6px;color:#94a3b8;font-size:11px}
.u-pa textarea{width:100%;padding:10px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#fff;resize:vertical;min-height:80px;font-size:11px;box-sizing:border-box}
.u-acts{display:flex;gap:8px;margin-bottom:14px}
.u-bp,.u-bs{padding:8px 16px;border:none;border-radius:5px;cursor:pointer;font-weight:600;font-size:11px}
.u-bp{background:#3b82f6;color:#fff}.u-bp:hover{background:#2563eb}
.u-bs{background:#64748b;color:#fff}.u-bs:hover{background:#475569}
.u-ra{display:none;border-top:1px solid #334155;padding-top:14px}
.u-vr{padding:8px;background:rgba(255,255,255,.05);border-radius:6px;margin-bottom:10px;font-size:11px}
.u-so{background:#0f172a;border:1px solid #334155;border-radius:6px;padding:10px;max-height:250px;overflow-y:auto;font:11px 'Courier New',monospace}
.u-sec .u-si2{display:flex;justify-content:space-between;padding:8px;background:rgba(255,255,255,.05);border-radius:6px;margin-bottom:8px}
.u-sv2{color:#22c55e;font-weight:600}`;

  // ==================== UI CREATION ====================

  /**
   * Create the main UI panel
   */
  function createUI() {
    if (!document.body || document.getElementById(CONFIG.UI_ID)) return;

    const panel = document.createElement("div");
    panel.id = CONFIG.UI_ID;
    panel.className = "u-sc";

    panel.innerHTML = `
<div class="u-h">
  <h2>AI Suite</h2>
  <span class="u-v">v${CONFIG.VERSION}</span>
  <button class="u-tb" id="u-tb">✕</button>
</div>
<div class="u-tabs">
  <button class="u-ta active" data-tab="dash">Dashboard</button>
  <button class="u-ta" data-tab="gen">Generator</button>
  <button class="u-ta" data-tab="sec">Security</button>
</div>
<div class="u-tc active" id="dash-tab">
  <div class="u-stats">
    <div class="u-si">
      <span class="u-sl">Scripts</span>
      <span class="u-sv" id="dash-scripts">${loadGeneratedScripts().length}</span>
    </div>
    <div class="u-si">
      <span class="u-sl">Modules</span>
      <span class="u-sv" id="dash-modules">${Object.keys(STATE.modules).length}</span>
    </div>
  </div>
</div>
<div class="u-tc" id="gen-tab">
  <div class="u-cgr">
    <label>AI Provider:</label>
    <select id="ai-provider">
      <option value="OPENAI">GPT-4</option>
      <option value="ANTHROPIC">Claude</option>
      <option value="LOCAL">Local</option>
    </select>
  </div>
  <div class="u-cgr">
    <label>API Key:</label>
    <input type="password" id="api-key-input" placeholder="Session only" autocomplete="off">
  </div>
  <div class="u-pa">
    <label>Describe the script:</label>
    <textarea id="prompt-input" rows="3" placeholder="What should the script do?"></textarea>
  </div>
  <div class="u-acts">
    <button class="u-bp" id="generate-btn">Generate</button>
    <button class="u-bs" id="preview-btn">Preview</button>
    <button class="u-bs" id="save-btn">Save</button>
  </div>
  <div class="u-ra" id="result-area">
    <div class="u-vr" id="validation-result"></div>
    <div class="u-so" id="script-output"></div>
  </div>
</div>
<div class="u-tc" id="sec-tab">
  <div class="u-sec">
    <div class="u-si2">
      <span class="u-sl">Auth Status</span>
      <span class="u-sv2" id="auth-status">OK</span>
    </div>
    <div class="u-si2">
      <span class="u-sl">Session</span>
      <span class="u-sv2" id="session-status">Active</span>
    </div>
  </div>
</div>`;

    // Add styles if not already present
    if (!document.getElementById(CONFIG.STYLE_ID)) {
      const styleElement = document.createElement("style");
      styleElement.id = CONFIG.STYLE_ID;
      styleElement.textContent = STYLES;
      document.head.appendChild(styleElement);
    }

    document.body.appendChild(panel);

    // Wire close button
    document.getElementById("u-tb").onclick = () => {
      panel.style.display = panel.style.display === "none" ? "" : "none";
    };

    // Wire tab switching
    panel.querySelectorAll(".u-ta").forEach((tabButton) => {
      tabButton.onclick = () => {
        panel.querySelectorAll(".u-ta").forEach((btn) => btn.classList.remove("active"));
        panel.querySelectorAll(".u-tc").forEach((tc) => tc.classList.remove("active"));
        tabButton.classList.add("active");
        document.getElementById(tabButton.dataset.tab + "-tab").classList.add("active");
      };
    });

    initializeModules();
  }

  // ==================== AI PROVIDERS ====================

  /**
   * Generate script using OpenAI
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  const generateWithOpenAI = async (prompt) => {
    const response = await remoteFetch(CONFIG.API_ENDPOINTS.OPENAI.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STATE.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "Generate a userscript" },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
      }),
    });
    return response?.choices?.[0]?.message?.content || "";
  };

  /**
   * Generate script using Anthropic Claude
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  const generateWithClaude = async (prompt) => {
    const response = await remoteFetch(CONFIG.API_ENDPOINTS.ANTHROPIC.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": STATE.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const contentBlocks = Array.isArray(response?.content) ? response.content : [];
    const textBlock = contentBlocks.find((block) => block?.type === "text" && block?.text);
    return textBlock?.text || "";
  };

  // ==================== MODULE INITIALIZATION ====================

  function initializeModules() {
    // Script Generator module
    const scriptGenerator = {
      generate: async (prompt) => {
        debugLog("Generating script");
        try {
          let result;
          if (STATE.activeProvider === "OPENAI") {
            result = await generateWithOpenAI(safeTrim(prompt));
          } else if (STATE.activeProvider === "ANTHROPIC") {
            result = await generateWithClaude(safeTrim(prompt));
          } else {
            result = "";
          }

          const wrappedScript = ensureUserscriptWrapper(result, prompt);
          const validation = validateScript(wrappedScript);
          const finalScript = validation.ok ? optimizeScript(wrappedScript) : wrappedScript;

          saveGeneratedScript(
            {
              id: generateId(),
              content: finalScript,
              prompt: safeTrim(prompt),
              provider: STATE.activeProvider,
              timestamp: Date.now(),
              version: CONFIG.VERSION,
              name: extractName(finalScript),
              fileName: generateFileName(finalScript),
            },
            validation,
            prompt
          );

          STATE.validationResults = validation;
          return finalScript;
        } catch (error) {
          return { error: error.message };
        }
      },
    };
    registerModule("scriptGenerator", scriptGenerator);

    // Auth Service module
    registerModule("authService", {
      init: () => {
        debugLog("Auth service initialized");
        return {
          ok: () => true,
          auth: () => Promise.resolve(true),
          clear: () => {},
        };
      },
    });
  }

  // ==================== INITIALIZATION ====================

  function initialize() {
    loadSettings();

    createUI();

    if (!STATE.menuRegistered) {
      GM_registerMenuCommand("UAI: Toggle Panel", () => {
        const uiPanel = document.getElementById(CONFIG.UI_ID);
        if (uiPanel) {
          uiPanel.style.display = uiPanel.style.display === "none" ? "" : "none";
        }
      });

      GM_registerMenuCommand("UAI: View History", () => {
        const history = loadGeneratedScripts();
        if (!history.length) {
          alert("No scripts in history");
          return;
        }
        alert(
          history
            .map(
              (entry, index) =>
                `${index + 1}. ${entry.name || entry.fileName}\n${new Date(entry.timestamp).toLocaleString()}`
            )
            .join("\n\n")
        );
      });

      STATE.menuRegistered = 1;
    }

    debugLog("Initialization complete");
  }

  // Run initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
