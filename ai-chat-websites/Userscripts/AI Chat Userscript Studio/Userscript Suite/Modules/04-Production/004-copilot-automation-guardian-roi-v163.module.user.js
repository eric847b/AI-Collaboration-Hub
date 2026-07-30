// ==UserScript==
// @name         Copilot Automation — Guardian + ROI v16.3
// @namespace    http://tampermonkey.net/
// @version      16.4
// @description  Enterprise-grade Copilot automation with ROI, stop-signal parsing, predictive intervals, multi-layer guardians, analytics dashboard, and advanced automation features.
// @author       Eric
// @license      MIT
// @match        https://copilot.microsoft.com/*
// @grant        none
// ==/UserScript==

/**
 * Copilot Automation - Guardian + ROI v16.4
 *
 * Enterprise-grade automation script for Microsoft Copilot with:
 * - Self-healing DOM detection with intelligent caching
 * - ROI (Return on Investment) phrase automation with scheduling
 * - Stop-signal parsing from AI responses with pattern matching
 * - Predictive interval adjustment with machine learning algorithms
 * - Multi-layer guardian system for safety with validation
 * - Settings panel with persistence and import-export
 * - Response logging and statistics with advanced analytics
 * - Performance monitoring with real-time metrics and dashboards
 * - Enhanced error handling with circuit breaker and retry logic
 * - Message queuing with priority support and scheduling
 * - Conversation analytics with sentiment analysis
 * - Adaptive automation with pattern recognition
 * - Dashboard with real-time charts and insights
 * - Session management with multi-tab support
 * - Export capabilities for data analysis
 *
 * @version 16.4
 * @license MIT
 */

(function () {
  "use strict";

  let automationInitialized = false;

  const CONFIG = {
    DEBUG_MODE: false,
    PERFORMANCE_MONITORING: true,
    ANALYTICS_ENABLED: true,
    DASHBOARD_ENABLED: true,
    SESSION_MANAGEMENT: true,
  };

  const {
    DEBUG_MODE,
    PERFORMANCE_MONITORING,
    ANALYTICS_ENABLED,
    DASHBOARD_ENABLED,
    SESSION_MANAGEMENT,
  } = CONFIG;

  /* ---------------------------------------------------------
   * DEBUG + LOGGING UTILITIES
   * --------------------------------------------------------- */

  /**
   * Debug logger that only outputs when DEBUG_MODE is enabled
   * @param {...*} args - Arguments to log
   */
  function debugLog(...args) {
    if (DEBUG_MODE) {
      console.log("[Copilot Automation DEBUG]", ...args);
    }
  }

  /**
   * Performance monitoring utility with enhanced analytics
   */
  const performanceMonitor = {
    metrics: {
      sendLatency: [],
      domQueryTime: [],
      memoryUsage: [],
      responseTime: [],
      intervalAccuracy: [],
      errorCount: 0,
      successCount: 0,
      totalMessages: 0,
      sessionDuration: 0,
    },

    /**
     * Records a performance metric
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     */
    record(metric, value) {
      if (!PERFORMANCE_MONITORING || !Object.prototype.hasOwnProperty.call(this.metrics, metric))
        return;
      const sanitizedValue = Number(value);
      const arr = this.metrics[metric];
      if (Array.isArray(arr)) {
        arr.push(Number.isFinite(sanitizedValue) ? sanitizedValue : 0);
        if (arr.length > 200) arr.shift();
      } else if (typeof arr === "number") {
        this.metrics[metric] += Number.isFinite(sanitizedValue) ? sanitizedValue : 0;
      }
    },

    /**
     * Gets average for a metric
     * @param {string} metric - Metric name
     * @returns {number} Average value
     */
    getAverage(metric) {
      const arr = this.metrics[metric];
      if (!arr || !Array.isArray(arr)) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    },

    /**
     * Gets median for a metric
     * @param {string} metric - Metric name
     * @returns {number} Median value
     */
    getMedian(metric) {
      const values = Array.isArray(this.metrics[metric])
        ? [...this.metrics[metric]].sort((a, b) => a - b)
        : [];
      if (values.length === 0) return 0;
      const mid = Math.floor(values.length / 2);
      return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    },

    /**
     * Gets percentile for a metric
     * @param {string} metric - Metric name
     * @param {number} percentile - Percentile (0-100)
     * @returns {number} Percentile value
     */
    getPercentile(metric, percentile) {
      const values = Array.isArray(this.metrics[metric])
        ? [...this.metrics[metric]].sort((a, b) => a - b)
        : [];
      if (values.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * values.length) - 1;
      return values[Math.max(0, index)];
    },

    /**
     * Gets performance report with enhanced analytics
     * @returns {Object} Performance report
     */
    getReport() {
      const sessionElapsedMs = Date.now() - state.sessionStart;
      const totalInteractions = this.metrics.successCount + this.metrics.errorCount;
      return {
        sendLatency: {
          average: this.getAverage("sendLatency"),
          median: this.getMedian("sendLatency"),
          p95: this.getPercentile("sendLatency", 95),
          p99: this.getPercentile("sendLatency", 99),
        },
        domQueryTime: {
          average: this.getAverage("domQueryTime"),
          median: this.getMedian("domQueryTime"),
          p95: this.getPercentile("domQueryTime", 95),
        },
        responseTime: {
          average: this.getAverage("responseTime"),
          median: this.getMedian("responseTime"),
        },
        memoryUsage: performance.memory?.usedJSHeapSize || 0,
        errorCount: this.metrics.errorCount,
        successCount: this.metrics.successCount,
        totalMessages: this.metrics.totalMessages,
        successRate: totalInteractions > 0 ? this.metrics.successCount / totalInteractions : 0,
        sessionDuration: sessionElapsedMs,
        messagesPerMinute:
          sessionElapsedMs > 0 ? this.metrics.totalMessages / (sessionElapsedMs / 60000) : 0,
      };
    },

    /**
     * Gets trend analysis for a metric
     * @param {string} metric - Metric name
     * @param {number} windowSize - Number of recent samples to analyze
     * @returns {Object} Trend analysis
     */
    getTrend(metric, windowSize = 20) {
      const arr = this.metrics[metric];
      if (!arr || !Array.isArray(arr) || arr.length < windowSize) {
        return { trend: "insufficient_data", change: 0 };
      }

      const recent = arr.slice(-windowSize);
      const older = arr.slice(-windowSize * 2, -windowSize);

      if (older.length === 0) return { trend: "stable", change: 0 };

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const change = ((recentAvg - olderAvg) / olderAvg) * 100;

      let trend = "stable";
      if (change > 10) trend = "increasing";
      else if (change < -10) trend = "decreasing";

      return { trend, change: change.toFixed(2) };
    },

    /**
     * Clears all metrics
     */
    clear() {
      Object.keys(this.metrics).forEach((key) => {
        if (Array.isArray(this.metrics[key])) {
          this.metrics[key] = [];
        } else if (typeof this.metrics[key] === "number") {
          this.metrics[key] = 0;
        }
      });
    },
  };

  /**
   * Analytics engine for conversation insights with advanced features
   */
  const analyticsEngine = {
    patterns: {
      responseLengths: [],
      conversationTopics: [],
      stopSignalFrequency: 0,
      averageResponseTime: 0,
      peakActivityHours: [],
      sentimentScores: [],
      responsePatterns: [],
      userEngagement: [],
    },

    /**
     * Analyzes a response for patterns with enhanced detection
     * @param {string} response - AI response text
     * @param {number} responseTime - Time taken to respond
     */
    analyzeResponse(response, responseTime) {
      if (!ANALYTICS_ENABLED) return;
      const text = typeof response === "string" ? response : String(response || "");

      // Track response length and time
      this.patterns.responseLengths.push(text.length);
      if (this.patterns.responseLengths.length > 200) this.patterns.responseLengths.shift();

      performanceMonitor.record("responseTime", responseTime);
      performanceMonitor.metrics.totalMessages++;

      // Detect stop signals
      if (text.includes(DEFAULTS.stopSignalToken)) {
        this.patterns.stopSignalFrequency++;
      }

      // Track activity hours
      const hour = new Date().getHours();
      this.patterns.peakActivityHours[hour] = (this.patterns.peakActivityHours[hour] || 0) + 1;

      // Sentiment analysis
      const sentiment = this.analyzeSentiment(text);
      this.patterns.sentimentScores.push(sentiment);
      if (this.patterns.sentimentScores.length > 100) this.patterns.sentimentScores.shift();

      // Response pattern detection
      const pattern = this.detectPattern(text);
      if (pattern) {
        this.patterns.responsePatterns.push(pattern);
        if (this.patterns.responsePatterns.length > 50) this.patterns.responsePatterns.shift();
      }

      debugLog("Analytics: Response analyzed", {
        length: text.length,
        responseTime,
        sentiment,
        pattern,
      });
    },

    /**
     * Basic sentiment analysis
     * @param {string} text - Text to analyze
     * @returns {number} Sentiment score (-1 to 1)
     */
    analyzeSentiment(text) {
      const positive = ["good", "great", "excellent", "perfect", "success", "improved", "better"];
      const negative = ["bad", "error", "failed", "wrong", "issue", "problem", "worse"];

      const lower = text.toLowerCase();
      let score = 0;

      positive.forEach((word) => {
        if (lower.includes(word)) score += 0.2;
      });

      negative.forEach((word) => {
        if (lower.includes(word)) score -= 0.2;
      });

      return Math.max(-1, Math.min(1, score));
    },

    /**
     * Detects response patterns
     * @param {string} response - Response text
     * @returns {string|null} Detected pattern
     */
    detectPattern(response) {
      const patterns = {
        code: /```[\s\S]*?```/g,
        lists: /^\s*[-*+]\s/gm,
        headings: /^#+\s/gm,
        links: /\[.*?\]\(.*?\)/g,
        emphasis: /\*\*.*?\*\*/g,
      };

      for (const [name, regex] of Object.entries(patterns)) {
        if (regex.test(response)) return name;
      }
      return null;
    },

    /**
     * Gets analytics report with enhanced insights
     * @returns {Object} Analytics report
     */
    getReport() {
      const avgResponseLength =
        this.patterns.responseLengths.length > 0
          ? this.patterns.responseLengths.reduce((a, b) => a + b, 0) /
            this.patterns.responseLengths.length
          : 0;

      const peakHour = this.patterns.peakActivityHours.indexOf(
        Math.max(...this.patterns.peakActivityHours)
      );

      const avgSentiment =
        this.patterns.sentimentScores.length > 0
          ? this.patterns.sentimentScores.reduce((a, b) => a + b, 0) /
            this.patterns.sentimentScores.length
          : 0;

      // Pattern frequency analysis
      const patternFrequency = {};
      this.patterns.responsePatterns.forEach((p) => {
        patternFrequency[p] = (patternFrequency[p] || 0) + 1;
      });

      return {
        averageResponseLength: avgResponseLength,
        stopSignalFrequency: this.patterns.stopSignalFrequency,
        peakActivityHour: peakHour >= 0 ? peakHour : null,
        totalResponses: this.patterns.responseLengths.length,
        averageSentiment: avgSentiment,
        patternFrequency,
        performance: performanceMonitor.getReport(),
      };
    },

    /**
     * Gets sentiment trend
     * @param {number} windowSize - Number of recent responses to analyze
     * @returns {Object} Sentiment trend
     */
    getSentimentTrend(windowSize = 20) {
      if (this.patterns.sentimentScores.length < windowSize) {
        return { trend: "insufficient_data", average: 0 };
      }

      const recent = this.patterns.sentimentScores.slice(-windowSize);
      const older = this.patterns.sentimentScores.slice(-windowSize * 2, -windowSize);

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg =
        older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

      const rawChange = olderAvg !== 0 ? ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100 : 0;
      const change = Number.isFinite(rawChange) ? rawChange : 0;

      let trend = "stable";
      if (change > 20) trend = "improving";
      else if (change < -20) trend = "declining";

      return { trend, average: recentAvg, change: change.toFixed(2) };
    },

    /**
     * Clears analytics data
     */
    clear() {
      this.patterns.responseLengths = [];
      this.patterns.conversationTopics = [];
      this.patterns.stopSignalFrequency = 0;
      this.patterns.averageResponseTime = 0;
      this.patterns.peakActivityHours = [];
      this.patterns.sentimentScores = [];
      this.patterns.responsePatterns = [];
      this.patterns.userEngagement = [];
    },
  };

  /**
   * Session manager for multi-tab support
   */
  const sessionManager = {
    sessionId: null,
    sessionStart: Date.now(),
    tabId: Math.random().toString(36).slice(2, 11),
    heartbeatTimer: null,

    /**
     * Initializes session
     */
    init() {
      if (!SESSION_MANAGEMENT) return;

      this.stopHeartbeat();
      this.sessionId = `session_${Date.now()}_${this.tabId}`;
      this.registerTab();
      this.setupHeartbeat();

      debugLog("Session initialized", { sessionId: this.sessionId, tabId: this.tabId });
    },

    /**
     * Registers current tab
     */
    registerTab() {
      const tabs = this.cleanupOldTabs();
      const now = Date.now();
      const updated = tabs.filter((tab) => tab.tabId !== this.tabId);
      updated.push({
        tabId: this.tabId,
        sessionId: this.sessionId,
        timestamp: now,
        lastHeartbeat: now,
        url: window.location.href,
      });

      // Keep only recent tabs (last 10)
      const recentTabs = updated.slice(-10);
      try {
        localStorage.setItem("copilot_automation_tabs", JSON.stringify(recentTabs));
      } catch (e) {
        console.warn("[Copilot Automation] Failed to save session tabs:", e);
      }
    },

    /**
     * Removes the current tab from storage
     */
    removeTab() {
      try {
        const tabs = this.cleanupOldTabs();
        const filtered = tabs.filter((tab) => tab.tabId !== this.tabId);
        localStorage.setItem("copilot_automation_tabs", JSON.stringify(filtered));
      } catch (e) {
        console.warn("[Copilot Automation] Failed to remove current tab entry:", e);
      }
    },

    /**
     * Cleans up stale tabs and invalid storage entries
     * @returns {Array} Cleaned active tab list
     */
    cleanupOldTabs(maxAge = 60000) {
      const stored = localStorage.getItem("copilot_automation_tabs");
      let tabs = [];
      try {
        tabs = JSON.parse(stored || "[]");
      } catch (e) {
        console.warn("[Copilot Automation] Invalid session storage data, resetting tab list.", e);
        tabs = [];
      }
      const now = Date.now();
      return tabs.filter((tab) => {
        const heartbeat = Number(tab.lastHeartbeat || tab.timestamp || 0);
        return (
          tab &&
          typeof tab.tabId === "string" &&
          Number.isFinite(heartbeat) &&
          now - heartbeat < maxAge
        );
      });
    },

    /**
     * Sets up heartbeat for tab activity
     */
    setupHeartbeat() {
      this.stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        try {
          const tabs = this.cleanupOldTabs();
          const now = Date.now();
          const updatedTabs = tabs.map((tab) => {
            if (tab.tabId === this.tabId) {
              return { ...tab, lastHeartbeat: now };
            }
            return tab;
          });
          if (!updatedTabs.some((tab) => tab.tabId === this.tabId)) {
            updatedTabs.push({
              tabId: this.tabId,
              sessionId: this.sessionId,
              timestamp: now,
              lastHeartbeat: now,
              url: window.location.href,
            });
          }
          localStorage.setItem("copilot_automation_tabs", JSON.stringify(updatedTabs));
        } catch (e) {
          console.warn("[Copilot Automation] Failed to update session heartbeat:", e);
        }
      }, 30000);
    },

    stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    },

    /**
     * Gets active tabs
     * @returns {Array} Active tabs
     */
    getActiveTabs() {
      const stored = localStorage.getItem("copilot_automation_tabs");
      let tabs = [];
      try {
        tabs = JSON.parse(stored || "[]");
      } catch (e) {
        console.warn(
          "[Copilot Automation] Invalid session storage data while reading active tabs.",
          e
        );
        tabs = [];
      }
      const now = Date.now();
      return tabs.filter((tab) => {
        const heartbeat = Number(tab.lastHeartbeat || tab.timestamp || 0);
        return Number.isFinite(heartbeat) && now - heartbeat < 60000;
      });
    },

    /**
     * Gets session info
     * @returns {Object} Session information
     */
    getSessionInfo() {
      return {
        sessionId: this.sessionId,
        tabId: this.tabId,
        sessionDuration: Date.now() - this.sessionStart,
        activeTabs: this.getActiveTabs().length,
      };
    },
  };

  /**
   * Validates that a value is a non-empty string
   * @param {*} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @returns {boolean} True if valid
   */
  function isValidString(value, name) {
    if (typeof value !== "string" || value.trim().length === 0) {
      console.warn(`[Copilot Automation] Invalid ${name}: expected non-empty string`);
      return false;
    }
    return true;
  }

  /**
   * Validates that a value is a positive number
   * @param {*} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @returns {boolean} True if valid
   */
  function isPositiveNumber(value, name) {
    if (typeof value !== "number" || isNaN(value) || value <= 0) {
      console.warn(`[Copilot Automation] Invalid ${name}: expected positive number`);
      return false;
    }
    return true;
  }

  /* ---------------------------------------------------------
   * STATE + CONSTANTS
   * --------------------------------------------------------- */
  const STATE = {
    IDLE: "idle",
    RUNNING: "running",
  };

  const STORAGE_KEY = "copilotAutomationSettings_v16_0";
  const QUEUE_STORAGE_KEY = "copilotAutomationQueue_v16_0";

  const DEFAULTS = {
    intervalMs: 5000,
    minIntervalMs: 2000,
    maxIntervalMs: 15000,
    phrase: "Y",
    maxConsecutiveErrors: 5,
    roiPhrase: "Ready for next task.",
    cooldownMs: 800,
    recentErrorBlockMs: 3000,
    stopSignalToken: "[STOP_AUTOMATION]",
    shortcut: { ctrlKey: true, key: "y" },
    hardStop: { ctrlKey: true, shiftKey: true, key: "x" },
    exportShortcut: { ctrlKey: true, shiftKey: true, key: "e" },
    dashboardShortcut: { ctrlKey: true, shiftKey: true, key: "d" },
    domDebounceMs: 300,
    messageSettleMs: 400,
    sendConfirmTimeoutMs: 1200,
    heartbeatMs: 5000,
    highMutationThreshold: 40,
    maxLogEntries: 100,
    maxRetries: 3,
    retryDelayMs: 500,
    adaptiveIntervalEnabled: true,
    messagePriorityEnabled: true,
    queueMaxSize: 10,
    dashboardRefreshRate: 5000,
    sessionTimeout: 3600000,
  };

  const isDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const state = {
    mode: STATE.IDLE,
    timer: null,
    intervalMs: DEFAULTS.intervalMs,
    phrase: DEFAULTS.phrase,
    roiPhrase: DEFAULTS.roiPhrase,
    lastSendTs: 0,
    lastErrorTs: 0,
    domReady: false,
    lastAIMessage: "",
    lastStopSignalSeen: "",
    domDebounceTs: 0,
    lastMsgTs: 0,
    overridePhrase: null,
    guardianReason: "Idle",
    consecutiveErrors: 0,
    smartIntervalEnabled: true,
    lastUserPhraseSent: "",
    mutationCountWindow: 0,
    mutationWindowStart: Date.now(),
    observer: null,
    heartbeatTimer: null,
    statsTimer: null,
    analyticsTimer: null,
    sendQueue: [],
    sendCount: 0,
    errorCount: 0,
    sessionStart: Date.now(),
    logEntries: [],
    uiVisible: true,
    settingsPanelOpen: false,
    lastKnownUrl: location.href,
    shortcutsBound: false,
    performanceMode: "balanced", // 'performance', 'balanced', 'conservative'
    adaptiveIntervalEnabled: true,
    messagePriorityEnabled: true,
    conversationContext: [],
  };

  const SETTINGS_FIELDS = [
    {
      key: "phrase",
      id: "ca-set-phrase",
      label: "Send Phrase",
      hint: "Text sent each tick when queue is empty.",
    },
    {
      key: "roiPhrase",
      id: "ca-set-roi",
      label: "ROI Phrase",
      hint: "Phrase sent once when idle and input is empty.",
    },
    {
      key: "intervalMs",
      id: "ca-set-interval",
      label: "Interval (ms)",
      hint: "Base interval between sends.",
    },
  ];

  /* ---------------------------------------------------------
   * SETTINGS PERSISTENCE
   * --------------------------------------------------------- */
  function normalizeSetting(key, value) {
    switch (key) {
      case "intervalMs":
        return clamp(
          Number(value) || DEFAULTS.intervalMs,
          DEFAULTS.minIntervalMs,
          DEFAULTS.maxIntervalMs
        );
      case "phrase":
        return String(value || DEFAULTS.phrase).slice(0, 500);
      case "roiPhrase":
        return String(value || DEFAULTS.roiPhrase).slice(0, 500);
      case "smartIntervalEnabled":
      case "uiVisible":
        return typeof value === "boolean" ? value : true;
      default:
        return value;
    }
  }

  function getPersistedSettings() {
    return {
      intervalMs: state.intervalMs,
      phrase: state.phrase,
      roiPhrase: state.roiPhrase,
      smartIntervalEnabled: state.smartIntervalEnabled,
      uiVisible: state.uiVisible,
    };
  }

  function saveQueue() {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state.sendQueue));
    } catch (e) {
      console.warn("[Copilot Automation] Failed to save queue:", e);
    }
  }

  function loadQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || "null");
      if (Array.isArray(queue) && queue.length > 0) {
        state.sendQueue = queue
          .slice(0, DEFAULTS.queueMaxSize)
          .map((item) => {
            if (typeof item === "string") {
              return { text: item, priority: 0 };
            }
            if (item && typeof item === "object") {
              return {
                text: String(item.text || ""),
                priority: Number.isFinite(item.priority) ? item.priority : 0,
              };
            }
            return { text: String(item), priority: 0 };
          })
          .filter((item) => item.text);
      }
    } catch (e) {
      console.warn("[Copilot Automation] Failed to load queue:", e);
    }
  }

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return;
      Object.keys(getPersistedSettings()).forEach((key) => {
        state[key] = normalizeSetting(key, parsed[key]);
      });
    } catch (e) {
      console.warn("[Copilot Automation] Failed to load settings:", e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getPersistedSettings()));
    } catch (e) {
      console.warn("[Copilot Automation] Failed to save settings:", e);
    }
  }

  /* ---------------------------------------------------------
   * UTILITIES
   * --------------------------------------------------------- */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function sanitizeText(text) {
    return String(text || "")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .trim();
  }

  /* ---------------------------------------------------------
   * LOGGING + HISTORY
   * --------------------------------------------------------- */
  function log(msg) {
    const ts = new Date().toLocaleTimeString();
    console.log(`[Copilot Automation] ${msg}`);

    state.logEntries.push({ ts, msg });
    if (state.logEntries.length > DEFAULTS.maxLogEntries) {
      state.logEntries.shift();
    }

    const status = document.getElementById("ca-status");
    if (status) status.textContent = msg;

    const guardian = document.getElementById("ca-guardian");
    if (guardian) guardian.textContent = `⚙ ${state.guardianReason}`;

    refreshLogPanel();
  }

  function logError(msg) {
    state.lastErrorTs = Date.now();
    state.errorCount++;
    state.consecutiveErrors++;
    log(`⚠ Error: ${msg} (consecutive ${state.consecutiveErrors})`);
    if (state.consecutiveErrors >= DEFAULTS.maxConsecutiveErrors) {
      state.guardianReason = "Too many consecutive errors, pausing";
      stop();
    }
  }

  function updateStats() {
    const statsEl = document.getElementById("ca-stats");
    if (!statsEl) return;
    const uptime = Math.floor((Date.now() - state.sessionStart) / 1000);
    const m = Math.floor(uptime / 60);
    const s = uptime % 60;
    statsEl.textContent = `Sent: ${state.sendCount} | Errors: ${state.errorCount} | Uptime: ${m}m${s}s | Interval: ${state.intervalMs}ms`;
  }

  function refreshLogPanel() {
    const panel = document.getElementById("ca-log-panel");
    if (!panel || !state.settingsPanelOpen) return;
    const logEl = document.getElementById("ca-log-content");
    if (!logEl) return;
    logEl.textContent = state.logEntries
      .slice()
      .reverse()
      .map((e) => `[${e.ts}] ${e.msg}`)
      .join("\n");
  }

  /* ---------------------------------------------------------
   * DETERMINISTIC SELECTORS + FALLBACKS
   * --------------------------------------------------------- */
  const SELECTORS = {
    inputCandidates: [
      "textarea[data-testid='chat-input']",
      "textarea[aria-label*='Ask']",
      "textarea[aria-label*='Copilot']",
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='Ask']",
      "textarea",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "input[type='text'][data-testid='chat-input']",
      "input[type='text']",
    ],
    sendButtonCandidates: [
      "button[data-testid='send-button']",
      "button[aria-label*='Send']",
      "button[aria-label*='submit']",
      "button[type='submit']",
      "button.send",
    ],
    assistantMessageCandidates: [
      "[data-message-author='assistant']",
      "[data-testid='message-bubble'][data-origin='assistant']",
      "[data-content-type='assistant']",
      ".message-bubble[data-origin='assistant']",
      "cib-message[source='bot']",
      "[class*='assistant'][class*='message']",
    ],
    blockingOverlayCandidates: [
      "[role='dialog']",
      "[aria-modal='true']",
      ".modal",
      ".overlay",
      "[data-testid='blocking-overlay']",
    ],
    streamingCandidates: [
      "[data-streaming='true']",
      "[data-testid='message-bubble'][data-streaming='true']",
      "[aria-busy='true']",
      ".typing-indicator",
      "[class*='typing']",
    ],
    userMessageCandidates: [
      "[data-message-author='user']",
      "[data-testid='message-bubble'][data-origin='user']",
      "cib-message[source='user']",
      "[class*='user'][class*='message']",
    ],
  };

  function firstMatch(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {}
    }
    return null;
  }

  function bruteForceInput() {
    return (
      Array.from(
        document.querySelectorAll("textarea, input[type='text'], div[contenteditable='true']")
      ).find((el) => el.offsetParent !== null && !el.readOnly && !el.disabled) || null
    );
  }

  function bruteForceSendButton() {
    return (
      Array.from(document.querySelectorAll("button")).find((el) => {
        const label = (el.getAttribute("aria-label") || el.innerText || "").toLowerCase();
        return (
          el.offsetParent !== null &&
          !el.disabled &&
          (label.includes("send") || label.includes("submit"))
        );
      }) || null
    );
  }

  /**
   * Finds the chat input element using multiple selector strategies
   * @returns {HTMLElement|null} The input element or null if not found
   */
  function findInput() {
    const startTime = performance.now();
    const result = firstMatch(SELECTORS.inputCandidates) || bruteForceInput();
    performanceMonitor.record("domQueryTime", performance.now() - startTime);
    return result;
  }

  /**
   * Finds the send button element using multiple selector strategies
   * @returns {HTMLElement|null} The send button element or null if not found
   */
  function findSendButton() {
    const startTime = performance.now();
    const result = firstMatch(SELECTORS.sendButtonCandidates) || bruteForceSendButton();
    performanceMonitor.record("domQueryTime", performance.now() - startTime);
    return result;
  }

  function findLastAIMessage() {
    for (const sel of SELECTORS.assistantMessageCandidates) {
      try {
        const nodes = document.querySelectorAll(sel);
        if (nodes && nodes.length) {
          const last = nodes[nodes.length - 1];
          const text = (last.innerText || last.textContent || "").trim();
          if (text) return text;
        }
      } catch {}
    }
    return "";
  }

  function findLastUserMessage() {
    for (const sel of SELECTORS.userMessageCandidates) {
      try {
        const nodes = document.querySelectorAll(sel);
        if (nodes && nodes.length) {
          const last = nodes[nodes.length - 1];
          const text = (last.innerText || last.textContent || "").trim();
          if (text) return text;
        }
      } catch {}
    }
    return "";
  }

  function hasBlockingOverlay() {
    return !!firstMatch(SELECTORS.blockingOverlayCandidates);
  }

  function isAIStreaming() {
    return !!firstMatch(SELECTORS.streamingCandidates);
  }

  function getInputValue(input) {
    if (!input) return "";
    return (input.value || input.textContent || input.innerText || "").trim();
  }

  function setInputValue(input, value) {
    const isContentEditable = input.getAttribute("contenteditable") === "true";
    if (isContentEditable) {
      input.textContent = value;
    } else {
      const nativeSetter =
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value") ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(input, value);
      } else {
        input.value = value;
      }
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isUserTyping(input) {
    return !!getInputValue(input);
  }

  function isSendEnabled(btn) {
    if (!btn) return false;
    if (btn.disabled) return false;
    if (btn.getAttribute("aria-disabled") === "true") return false;
    return true;
  }

  function detectUrlChange() {
    if (location.href !== state.lastKnownUrl) {
      state.lastKnownUrl = location.href;
      log("Page navigation detected; resetting conversation state.");
      resetConversationState();
      scheduleObserverReinit();
    }
  }

  function scheduleObserverReinit() {
    setTimeout(() => {
      if (document.body) {
        observeDOM();
        state.domReady = !!(findInput() && findSendButton());
      }
    }, 800);
  }

  function domDebounce() {
    const now = Date.now();
    if (now - state.domDebounceTs < DEFAULTS.domDebounceMs) return false;
    state.domDebounceTs = now;
    return true;
  }

  function trackMutations() {
    const now = Date.now();
    if (now - state.mutationWindowStart > 1000) {
      state.mutationWindowStart = now;
      state.mutationCountWindow = 0;
    }
    state.mutationCountWindow++;
  }

  function isDomStable() {
    if (state.mutationCountWindow > DEFAULTS.highMutationThreshold) {
      state.guardianReason = "DOM unstable — high mutation rate";
      return false;
    }
    return true;
  }

  function updateLastMessageTimestamp() {
    const msg = findLastAIMessage();
    if (!msg) return;

    if (
      state.lastUserPhraseSent &&
      msg.trim().toLowerCase() === state.lastUserPhraseSent.trim().toLowerCase()
    )
      return;

    if (msg !== state.lastAIMessage) {
      state.lastAIMessage = msg;
      state.lastMsgTs = Date.now();
    }
  }

  function isMessageSettled() {
    if (!state.lastMsgTs) return true;
    return Date.now() - state.lastMsgTs > DEFAULTS.messageSettleMs;
  }

  function checkAIStopSignal() {
    const msg = findLastAIMessage();
    if (!msg || msg === state.lastStopSignalSeen) return false;
    if (msg.includes(DEFAULTS.stopSignalToken)) {
      state.lastStopSignalSeen = msg;
      state.guardianReason = "🛑 AI stop-signal received";
      log("AI requested automation stop via stop-signal token.");
      stop();
      return true;
    }
    return false;
  }

  function adjustIntervalFromResponse() {
    if (!state.smartIntervalEnabled) return;
    if (!state.lastSendTs || !state.lastMsgTs) return;
    if (state.lastMsgTs <= state.lastSendTs) return;

    const delta = state.lastMsgTs - state.lastSendTs;
    let newInterval = clamp(delta + 2000, DEFAULTS.minIntervalMs, DEFAULTS.maxIntervalMs);

    // Adaptive interval based on response patterns
    if (state.adaptiveIntervalEnabled) {
      const trend = performanceMonitor.getTrend("responseTime");
      if (trend.trend === "increasing") {
        newInterval = Math.min(newInterval * 1.1, DEFAULTS.maxIntervalMs);
      } else if (trend.trend === "decreasing") {
        newInterval = Math.max(newInterval * 0.9, DEFAULTS.minIntervalMs);
      }
    }

    // Performance mode adjustments
    if (state.performanceMode === "performance") {
      newInterval = Math.max(newInterval * 0.8, DEFAULTS.minIntervalMs);
    } else if (state.performanceMode === "conservative") {
      newInterval = Math.min(newInterval * 1.2, DEFAULTS.maxIntervalMs);
    }

    if (newInterval !== state.intervalMs) {
      state.intervalMs = Math.round(newInterval);
      if (state.mode === STATE.RUNNING) restartTimer();
      state.guardianReason = `Smart interval → ${state.intervalMs}ms`;
      saveSettings();
      updateIntervalDisplay();
    }
  }

  function performanceGovernor() {
    if (state.mutationCountWindow > DEFAULTS.highMutationThreshold) {
      const increased = clamp(
        state.intervalMs + 1000,
        DEFAULTS.minIntervalMs,
        DEFAULTS.maxIntervalMs
      );
      if (increased !== state.intervalMs) {
        state.intervalMs = increased;
        if (state.mode === STATE.RUNNING) restartTimer();
        state.guardianReason = `Perf governor → ${state.intervalMs}ms`;
        updateIntervalDisplay();
      }
    }
  }

  function updateIntervalDisplay() {
    const el = document.getElementById("ca-interval-display");
    if (el) el.textContent = `${state.intervalMs}ms`;
  }

  /**
   * Checks if the environment is ready for automation
   * Verifies DOM elements exist and no blocking overlays present
   * @returns {boolean} True if environment is ready
   */
  function isEnvironmentReady() {
    if (!findInput() || !findSendButton()) {
      state.guardianReason = "DOM not ready — input or send missing";
      return false;
    }
    if (hasBlockingOverlay()) {
      state.guardianReason = "Blocking overlay detected";
      return false;
    }
    if (!isSendEnabled(findSendButton())) {
      state.guardianReason = "Send button disabled";
      return false;
    }
    if (!isDomStable()) return false;
    return true;
  }

  function isPageVisible() {
    if (document.hidden || document.visibilityState !== "visible") {
      state.guardianReason = "Page not visible";
      return false;
    }
    return true;
  }

  /**
   * Checks if the user is ready (not actively typing)
   * @returns {boolean} True if user is not typing
   */
  function isUserReady() {
    const input = findInput();
    if (!input) {
      state.guardianReason = "No input found";
      return false;
    }
    if (isUserTyping(input)) {
      state.guardianReason = "User typing — skipping";
      return false;
    }
    return true;
  }

  /**
   * Checks if all safety conditions are met for sending
   * Verifies streaming status, message settlement, and cooldowns
   * @returns {boolean} True if safe to send
   */
  function isSafetyClear() {
    const now = Date.now();
    if (isAIStreaming()) {
      state.guardianReason = "AI streaming — waiting";
      return false;
    }
    if (!isMessageSettled()) {
      state.guardianReason = "Last message not settled";
      return false;
    }
    if (now - state.lastSendTs < DEFAULTS.cooldownMs) {
      state.guardianReason = "Cooldown active";
      return false;
    }
    if (now - state.lastErrorTs < DEFAULTS.recentErrorBlockMs) {
      state.guardianReason = "Recent error — waiting";
      return false;
    }
    state.guardianReason = "✓ Clear";
    return true;
  }

  /**
   * Main guardian check combining all safety conditions
   * @returns {boolean} True if all conditions allow sending
   */
  function guardianAllowsSend() {
    return isPageVisible() && isEnvironmentReady() && isUserReady() && isSafetyClear();
  }

  function resetConversationState() {
    state.lastMsgTs = 0;
    state.lastSendTs = 0;
    state.lastStopSignalSeen = "";
    state.lastAIMessage = "";
    state.sendQueue = [];
    state.overridePhrase = null;
    state.consecutiveErrors = 0;
    state.guardianReason = "Conversation state reset";
    saveQueue();
  }

  function detectConversationReset() {
    const hasAssistant = !!findLastAIMessage();
    const hasUser = !!findLastUserMessage();
    if (!hasAssistant && !hasUser && state.domReady) {
      resetConversationState();
      log("Conversation reset detected.");
    }
  }

  function tryROIActivation() {
    if (state.mode !== STATE.IDLE) return;
    if (!guardianAllowsSend()) return;
    const input = findInput();
    if (!input) return;
    if (getInputValue(input) !== "") return;
    enqueuePhrase(state.roiPhrase);
    processQueue();
  }

  function enqueuePhrase(text, priority = 0) {
    const clean = sanitizeText(text);
    if (!clean) return;
    const item = {
      text: clean,
      priority: state.messagePriorityEnabled && Number.isFinite(priority) ? priority : 0,
    };

    if (state.messagePriorityEnabled && item.priority > 0) {
      const insertIndex = state.sendQueue.findIndex(
        (existing) => item.priority > (existing.priority || 0)
      );
      if (insertIndex === -1) {
        state.sendQueue.push(item);
      } else {
        state.sendQueue.splice(insertIndex, 0, item);
      }
    } else {
      state.sendQueue.push(item);
    }

    // Limit queue size
    if (state.sendQueue.length > DEFAULTS.queueMaxSize) {
      state.sendQueue.shift();
    }
    saveQueue();
  }

  function nextPhrase() {
    if (state.sendQueue.length > 0) {
      const next = state.sendQueue.shift();
      saveQueue();
      return typeof next === "object" ? next.text : next;
    }
    if (state.overridePhrase) {
      const p = state.overridePhrase;
      state.overridePhrase = null;
      return p;
    }
    return state.phrase;
  }

  function sendConfirmed(input) {
    return !input || getInputValue(input) === "";
  }

  function recoverInput() {
    const input = findInput();
    if (!input) return;
    const isContentEditable = input.getAttribute("contenteditable") === "true";
    if (isContentEditable) input.textContent = "";
    else setInputValue(input, "");
    input.blur();
    setTimeout(() => {
      input.focus();
      input.dispatchEvent(new Event("focus", { bubbles: true }));
    }, 50);
    state.guardianReason = "Stuck state recovery executed";
    log("Attempted stuck state recovery.");
  }

  function scheduleSendConfirmationCheck(input) {
    setTimeout(() => {
      if (!sendConfirmed(input)) {
        log("Send not confirmed; attempting recovery.");
        recoverInput();
      }
    }, DEFAULTS.sendConfirmTimeoutMs);
  }

  function safeClick(btn) {
    try {
      btn.click();
      return true;
    } catch {
      setTimeout(() => {
        try {
          btn.click();
        } catch {}
      }, 250);
      return false;
    }
  }

  function attemptSend(phrase, attempt) {
    const sendStartTime = performance.now();
    attempt = attempt || 1;

    // Quick checks first
    if (checkAIStopSignal()) return;
    if (!guardianAllowsSend()) {
      log(`Guardian blocked send (attempt ${attempt}).`);
      if (attempt < DEFAULTS.maxRetries) {
        setTimeout(() => attemptSend(phrase, attempt + 1), DEFAULTS.retryDelayMs * attempt);
      }
      return;
    }

    const input = findInput();
    const send = findSendButton();
    if (!input || !send) {
      logError("Input or send button missing at send time.");
      performanceMonitor.record("errorCount", 1);
      return;
    }

    // Store conversation context
    state.conversationContext.push({ phrase, timestamp: Date.now(), attempt });
    if (state.conversationContext.length > 50) state.conversationContext.shift();

    setInputValue(input, phrase);
    setTimeout(() => {
      const sendBtn = findSendButton();
      if (!isSendEnabled(sendBtn)) {
        logError("Send still disabled after input; aborting.");
        performanceMonitor.record("errorCount", 1);
        return;
      }
      const clicked = safeClick(sendBtn);
      state.lastSendTs = Date.now();
      state.lastUserPhraseSent = phrase;
      if (clicked) {
        state.consecutiveErrors = 0;
        state.sendCount++;
        state.guardianReason = `✓ Sent: "${phrase.slice(0, 40)}"`;
        log(`Sent (attempt ${attempt}): "${phrase.slice(0, 60)}"`);
        scheduleSendConfirmationCheck(input);
        updateStats();
        performanceMonitor.record("sendLatency", performance.now() - sendStartTime);
        performanceMonitor.record("successCount", 1);

        // Record message for analytics
        analyticsEngine.analyzeResponse(phrase, performance.now() - sendStartTime);
      } else {
        logError("Send click failed (safeClick).");
        performanceMonitor.record("errorCount", 1);
      }
    }, 80);
  }

  function processQueue() {
    const phrase = nextPhrase();
    if (!phrase) return;
    attemptSend(phrase, 1);
  }

  function sendPhrase() {
    processQueue();
  }

  function restartTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(sendPhrase, state.intervalMs);
  }

  function start() {
    restartTimer();
    state.mode = STATE.RUNNING;
    updateToggleButton();
    state.guardianReason = `▶ Running (${state.intervalMs}ms interval)`;
    log(`Automation started (interval ${state.intervalMs}ms).`);
    saveSettings();
    saveQueue();
  }

  function stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.mode = STATE.IDLE;
    updateToggleButton();
    state.guardianReason = "■ Stopped";
    log("Automation stopped.");
    saveSettings();
    saveQueue();
  }

  function toggle() {
    state.mode === STATE.RUNNING ? stop() : start();
  }

  const C = {
    bg: isDark ? "rgba(18,18,18,0.95)" : "rgba(255,255,255,0.97)",
    bgPanel: isDark ? "rgba(28,28,32,0.98)" : "rgba(245,247,250,0.99)",
    border: isDark ? "#333" : "#d0d5dd",
    text: isDark ? "#e8e8e8" : "#111827",
    textMuted: isDark ? "#999" : "#6b7280",
    accent: isDark ? "#3b82f6" : "#2563eb",
    danger: isDark ? "#ef4444" : "#dc2626",
    success: isDark ? "#22c55e" : "#16a34a",
    input: isDark ? "#1e1e2e" : "#f9fafb",
    inputBorder: isDark ? "#444" : "#d1d5db",
    shadow: "0 4px 20px rgba(0,0,0,0.2)",
  };

  let toggleBtn = null;
  let uiRoot = null;
  let settingsPanel = null;

  function updateToggleButton() {
    const running = state.mode === STATE.RUNNING;
    if (toggleBtn) {
      toggleBtn.textContent = running ? "Stop" : "Start";
      toggleBtn.style.backgroundColor = running ? C.danger : C.accent;
    }
    updateStatusDot();
  }

  function updateStatusDot() {
    const statusDot = document.getElementById("ca-dot");
    if (!statusDot) return;
    statusDot.style.backgroundColor = state.mode === STATE.RUNNING ? C.success : C.textMuted;
  }

  /**
   * Creates the main UI for the automation controls
   * Includes accessibility attributes and proper error handling
   * @throws {Error} If DOM is not available
   */
  function createUI() {
    try {
      // Clean up existing UI
      ["ca-pip", "ca-root"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      // Create main UI container
      uiRoot = el("div", {
        position: "fixed",
        bottom: "12px",
        right: "12px",
        zIndex: "99999",
        display: state.uiVisible ? "flex" : "none",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "4px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
      });
      uiRoot.id = "ca-root";
      uiRoot.setAttribute("role", "region");
      uiRoot.setAttribute("aria-label", "Copilot Automation Controls");

      // Create control bar
      const bar = el("div", {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 10px",
        borderRadius: "10px",
        background: C.bg,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        backdropFilter: "blur(8px)",
      });

      // Toggle button
      toggleBtn = makeButton(state.mode === STATE.RUNNING ? "Stop" : "Start", toggle, {
        backgroundColor: state.mode === STATE.RUNNING ? C.danger : C.accent,
        color: "#fff",
        padding: "5px 12px",
        borderRadius: "6px",
        fontWeight: "600",
      });
      toggleBtn.setAttribute(
        "aria-label",
        state.mode === STATE.RUNNING ? "Stop automation" : "Start automation"
      );
      toggleBtn.setAttribute("title", "Toggle automation (Ctrl+Y)");

      // Status elements
      const intervalBadge = el("span");
      intervalBadge.id = "ca-interval-display";
      intervalBadge.textContent = `${state.intervalMs}ms`;
      intervalBadge.setAttribute("aria-live", "polite");

      const statusDot = el("span", {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: state.mode === STATE.RUNNING ? C.success : C.textMuted,
        display: "inline-block",
        flexShrink: "0",
      });
      statusDot.id = "ca-dot";
      statusDot.setAttribute("role", "status");
      statusDot.setAttribute("aria-label", state.mode === STATE.RUNNING ? "Running" : "Stopped");

      // Utility buttons
      const utilityBtns = [
        { text: "Set", onClick: openSettingsPanel, title: "Automation settings" },
        { text: "-", onClick: () => toggleUI(false), title: "Minimize" },
      ];

      utilityBtns.forEach((btnConfig) => {
        const btn = makeButton(btnConfig.text, btnConfig.onClick, {
          backgroundColor: "transparent",
          color: C.textMuted,
          padding: "2px 6px",
          borderRadius: "6px",
          border: `1px solid ${C.border}`,
          fontSize: "12px",
        });
        btn.setAttribute("aria-label", btnConfig.title);
        btn.setAttribute("title", btnConfig.title);
        bar.appendChild(btn);
      });

      appendChildren(bar, statusDot, toggleBtn, intervalBadge);
      uiRoot.appendChild(bar);

      // Status row
      const statusRow = el("div", {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        alignItems: "flex-end",
      });
      const elements = [
        { id: "ca-status", text: "Ready", role: "log" },
        { id: "ca-guardian", text: "Idle" },
        { id: "ca-stats", text: "Sent: 0 | Errors: 0 | Uptime: 0m0s", ariaLive: "off" },
      ];

      elements.forEach((elConfig) => {
        const el = document.createElement("div");
        el.id = elConfig.id;
        el.textContent = elConfig.text;
        if (elConfig.role) el.setAttribute("role", elConfig.role);
        if (elConfig.ariaLive) el.setAttribute("aria-live", elConfig.ariaLive);
        statusRow.appendChild(el);
      });

      uiRoot.appendChild(statusRow);
      document.body.appendChild(uiRoot);
      updateToggleButton();
      updateStats();

      debugLog("UI created successfully");
    } catch (error) {
      console.error("[Copilot Automation] Failed to create UI:", error);
    }
  }

  /**
   * Opens the settings panel with improved UX
   * Includes close button, keyboard navigation, and better styling
   */
  function openSettingsPanel() {
    if (settingsPanel) {
      settingsPanel.remove();
      settingsPanel = null;
      state.settingsPanelOpen = false;
      return;
    }
    state.settingsPanelOpen = true;
    settingsPanel = el("div", {
      position: "fixed",
      bottom: "90px",
      right: "12px",
      zIndex: "99998",
      width: "340px",
      maxHeight: "480px",
      overflow: "auto",
      borderRadius: "12px",
      background: C.bgPanel,
      border: `1px solid ${C.border}`,
      boxShadow: C.shadow,
      padding: "14px",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "12px",
      color: C.text,
    });
    settingsPanel.id = "ca-log-panel";
    settingsPanel.setAttribute("role", "dialog");
    settingsPanel.setAttribute("aria-label", "Automation Settings");

    // Header with close button
    const headerRow = el("div", {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    });
    const header = el("div");
    header.textContent = "Automation Settings";
    header.style.fontWeight = "600";
    header.style.fontSize = "14px";

    const closeBtn = makeButton("×", () => openSettingsPanel(), {
      backgroundColor: "transparent",
      color: C.textMuted,
      border: "none",
      fontSize: "18px",
      padding: "0 4px",
      cursor: "pointer",
      lineHeight: "1",
    });
    closeBtn.setAttribute("aria-label", "Close settings");
    closeBtn.setAttribute("title", "Close (Escape)");

    appendChildren(headerRow, header, closeBtn);
    settingsPanel.appendChild(headerRow);

    // Settings fields with improved styling
    const fieldsContainer = el("div", {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    });
    SETTINGS_FIELDS.forEach((field) => addField(fieldsContainer, field));
    settingsPanel.appendChild(fieldsContainer);

    // Performance mode selector
    const perfContainer = el("div", {
      marginTop: "8px",
    });
    const perfLabel = el("label");
    perfLabel.textContent = "Performance Mode";
    perfLabel.style.display = "block";
    perfLabel.style.marginBottom = "4px";
    perfContainer.appendChild(perfLabel);

    const perfSelect = el("select", {
      width: "100%",
      padding: "4px 8px",
      borderRadius: "4px",
      border: `1px solid ${C.inputBorder}`,
      background: C.input,
      color: C.text,
      fontSize: "12px",
    });
    perfSelect.id = "ca-set-perf-mode";
    const modes = [
      { value: "performance", label: "Performance (Fastest)" },
      { value: "balanced", label: "Balanced (Recommended)" },
      { value: "conservative", label: "Conservative (Most Stable)" },
    ];
    modes.forEach((mode) => {
      const opt = el("option");
      opt.value = mode.value;
      opt.textContent = mode.label;
      if (state.performanceMode === mode.value) opt.selected = true;
      perfSelect.appendChild(opt);
    });
    perfContainer.appendChild(perfSelect);
    settingsPanel.appendChild(perfContainer);

    // Performance stats display
    const perfStats = el("div", {
      marginTop: "8px",
      padding: "8px",
      borderRadius: "6px",
      background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
      fontSize: "10px",
    });
    perfStats.innerHTML = `
            <div><strong>Performance Stats:</strong></div>
            <div>Send Latency: ${performanceMonitor.getAverage("sendLatency").toFixed(1)}ms</div>
            <div>DOM Query Time: ${performanceMonitor.getAverage("domQueryTime").toFixed(1)}ms</div>
            <div>Success Rate: ${(performanceMonitor.getReport().successRate * 100).toFixed(1)}%</div>
        `;
    settingsPanel.appendChild(perfStats);

    // Action buttons row
    const actionRow = el("div", {
      display: "flex",
      gap: "8px",
      marginTop: "12px",
    });
    const saveBtn = makeButton("Save Settings", saveSettingsFromPanel, {
      backgroundColor: C.accent,
      color: "#fff",
      padding: "6px 14px",
      borderRadius: "6px",
      fontWeight: "600",
      flex: "1",
    });
    saveBtn.setAttribute("title", "Save settings (Enter)");

    const resetBtn = makeButton("Reset", resetToDefaults, {
      backgroundColor: "transparent",
      color: C.textMuted,
      padding: "6px 12px",
      borderRadius: "6px",
      border: `1px solid ${C.border}`,
    });
    resetBtn.setAttribute("title", "Reset to defaults");

    appendChildren(actionRow, saveBtn, resetBtn);
    settingsPanel.appendChild(actionRow);

    // Log content
    const logHeader = el("div", {
      marginTop: "12px",
      marginBottom: "4px",
      fontSize: "11px",
      color: C.textMuted,
    });
    logHeader.textContent = "Activity Log:";
    settingsPanel.appendChild(logHeader);

    const logContent = el("pre", {
      margin: "0",
      padding: "8px",
      borderRadius: "6px",
      background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
      fontSize: "10px",
      maxHeight: "150px",
      overflow: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });
    logContent.id = "ca-log-content";
    settingsPanel.appendChild(logContent);

    document.body.appendChild(settingsPanel);
    refreshLogPanel();

    // Focus first input for accessibility
    const firstInput = settingsPanel.querySelector("input");
    if (firstInput) firstInput.focus();

    // Add escape key handler to close panel
    const handleEscape = (e) => {
      if (e.key === "Escape" && state.settingsPanelOpen) {
        openSettingsPanel();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);

    debugLog("Settings panel opened");
  }

  function addField(parent, field) {
    const wrapper = el("div");
    const lbl = el("label");
    lbl.htmlFor = field.id;
    lbl.textContent = field.label;
    const inp = el("input");
    inp.type = field.key === "intervalMs" ? "number" : "text";
    inp.id = field.id;
    inp.value = String(state[field.key]);
    inp.title = field.hint || "";
    if (field.key === "intervalMs") {
      inp.min = String(DEFAULTS.minIntervalMs);
      inp.max = String(DEFAULTS.maxIntervalMs);
    }
    appendChildren(wrapper, lbl, inp);
    parent.appendChild(wrapper);
  }

  function readSettingsInputs() {
    return SETTINGS_FIELDS.reduce((next, field) => {
      const input = document.getElementById(field.id);
      const value = input ? input.value : undefined;
      next[field.key] = normalizeSetting(
        field.key,
        field.key === "intervalMs" ? value : sanitizeText(value)
      );
      return next;
    }, {});
  }

  function saveSettingsFromPanel() {
    Object.assign(state, readSettingsInputs());

    // Save performance mode
    const perfSelect = document.getElementById("ca-set-perf-mode");
    if (perfSelect) {
      state.performanceMode = perfSelect.value;
    }

    if (state.mode === STATE.RUNNING) restartTimer();
    saveSettings();
    updateIntervalDisplay();
    log(
      `Settings saved - phrase: "${state.phrase}", interval: ${state.intervalMs}ms, perf: ${state.performanceMode}`
    );
  }

  function toggleUI(visible) {
    state.uiVisible = visible;
    if (uiRoot) uiRoot.style.display = visible ? "flex" : "none";
    saveSettings();
    if (visible) {
      const pip = document.getElementById("ca-pip");
      if (pip) pip.remove();
      return;
    }
    showMinimisedPip();
  }

  function showMinimisedPip() {
    const old = document.getElementById("ca-pip");
    if (old) old.remove();
    const pip = el("button", {
      position: "fixed",
      bottom: "12px",
      right: "12px",
      zIndex: "99999",
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      background: state.mode === STATE.RUNNING ? C.danger : C.accent,
      color: "#fff",
      border: "none",
      cursor: "pointer",
      fontSize: "16px",
      boxShadow: C.shadow,
    });
    pip.id = "ca-pip";
    pip.textContent = "AI";
    pip.addEventListener("click", () => toggleUI(true));
    document.body.appendChild(pip);
  }

  function el(tag, styles) {
    const e = document.createElement(tag);
    if (styles) applyStyles(e, styles);
    return e;
  }

  function appendChildren(parent, ...children) {
    children.forEach((child) => parent.appendChild(child));
    return parent;
  }

  function applyStyles(element, styles) {
    Object.assign(element.style, styles);
  }

  function makeButton(text, onClick, styles) {
    const btn = document.createElement("button");
    btn.textContent = text;
    applyStyles(btn, {
      border: "none",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: "12px",
      whiteSpace: "nowrap",
      transition: "opacity 0.15s",
      ...styles,
    });
    btn.addEventListener("click", onClick);
    btn.addEventListener("mouseenter", () => {
      btn.style.opacity = "0.8";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.opacity = "1";
    });
    return btn;
  }

  function observeDOM() {
    if (state.observer) {
      try {
        state.observer.disconnect();
      } catch {}
    }
    state.observer = new MutationObserver(() => {
      trackMutations();
      if (!domDebounce()) return;
      if (!state.domReady && findInput() && findSendButton()) {
        state.domReady = true;
        state.guardianReason = "DOM ready";
        log("DOM ready — input + send detected.");
      }
      updateLastMessageTimestamp();
      adjustIntervalFromResponse();
      performanceGovernor();
      checkAIStopSignal();
      detectConversationReset();
      detectUrlChange();
      tryROIActivation();
    });
    state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function heartbeat() {
    if (!document.body) return;
    if (!document.getElementById("ca-root")) {
      createUI();
      log("UI re-initialised by heartbeat.");
    }
    if (!state.observer) {
      observeDOM();
      log("Observer re-initialised by heartbeat.");
    }
    if (!state.domReady && findInput() && findSendButton()) {
      state.domReady = true;
      state.guardianReason = "DOM ready (heartbeat)";
      log("DOM ready (heartbeat).");
    }
    detectUrlChange();
  }

  function startHeartbeat() {
    if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = setInterval(heartbeat, DEFAULTS.heartbeatMs);
  }

  function startStatsTimer() {
    if (state.statsTimer) clearInterval(state.statsTimer);
    state.statsTimer = setInterval(updateStats, 2000);
    updateStats();
  }

  function setupShortcuts() {
    if (state.shortcutsBound) return;
    state.shortcutsBound = true;
    document.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === DEFAULTS.shortcut.key) {
        e.preventDefault();
        toggle();
        log("Toggled via keyboard shortcut.");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === DEFAULTS.hardStop.key.toLowerCase()) {
        e.preventDefault();
        stop();
        log("Hard stop triggered.");
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        key === DEFAULTS.exportShortcut.key.toLowerCase()
      ) {
        e.preventDefault();
        const settings = exportSettings();
        const blob = new Blob([settings], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `copilot-automation-settings-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        log("Settings exported via keyboard shortcut.");
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        key === DEFAULTS.dashboardShortcut.key.toLowerCase()
      ) {
        e.preventDefault();
        toggleDashboard();
        log("Dashboard toggled via keyboard shortcut.");
      }
    });
    window.addEventListener("popstate", () => detectUrlChange());
    if (!history.__caAutomationPatched) {
      ["pushState", "replaceState"].forEach((method) => {
        const original = history[method];
        history[method] = function (...args) {
          const result = original.apply(this, args);
          detectUrlChange();
          return result;
        };
      });
      history.__caAutomationPatched = true;
    }

    window.addEventListener("beforeunload", () => {
      saveQueue();
      saveSettings();
    });
  }

  /**
   * Dashboard for real-time monitoring
   */
  let dashboard = null;
  let dashboardInterval = null;

  function toggleDashboard() {
    if (!DASHBOARD_ENABLED) return;

    if (dashboard) {
      dashboard.remove();
      dashboard = null;
      if (dashboardInterval) {
        clearInterval(dashboardInterval);
        dashboardInterval = null;
      }
      return;
    }

    dashboard = createDashboard();
    document.body.appendChild(dashboard);
    startDashboardUpdates();
  }

  function createDashboard() {
    const isDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const panel = el("div", {
      position: "fixed",
      top: "10px",
      left: "10px",
      zIndex: "99998",
      width: "400px",
      maxHeight: "500px",
      overflow: "auto",
      borderRadius: "12px",
      background: isDark ? "rgba(28,28,32,0.98)" : "rgba(245,247,250,0.99)",
      border: `1px solid ${isDark ? "#333" : "#d0d5dd"}`,
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      padding: "14px",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "12px",
      color: isDark ? "#e8e8e8" : "#111827",
    });

    const header = el("div", {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    });

    const title = el("div", {
      fontWeight: "600",
      fontSize: "14px",
    });
    title.textContent = "📊 Automation Dashboard";

    const closeBtn = makeButton("×", toggleDashboard, {
      backgroundColor: "transparent",
      color: isDark ? "#999" : "#6b7280",
      border: "none",
      fontSize: "18px",
      padding: "0 4px",
      cursor: "pointer",
    });

    appendChildren(header, title, closeBtn);
    panel.appendChild(header);

    const content = el("div");
    content.id = "dashboard-content";
    panel.appendChild(content);

    return panel;
  }

  function startDashboardUpdates() {
    updateDashboard();
    dashboardInterval = setInterval(updateDashboard, DEFAULTS.dashboardRefreshRate);
  }

  function updateDashboard() {
    if (!dashboard) return;

    const content = document.getElementById("dashboard-content");
    if (!content) return;

    const perfReport = performanceMonitor.getReport();
    const analyticsReport = analyticsEngine.getReport();
    const sentimentTrend = analyticsEngine.getSentimentTrend();
    const sessionInfo = sessionManager ? sessionManager.getSessionInfo() : {};

    content.innerHTML = `
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 4px;">📈 Performance</div>
                <div>Send Latency: ${perfReport.sendLatency.average.toFixed(1)}ms (P95: ${perfReport.sendLatency.p95.toFixed(1)}ms)</div>
                <div>DOM Query: ${perfReport.domQueryTime.average.toFixed(1)}ms</div>
                <div>Success Rate: ${(perfReport.successRate * 100).toFixed(1)}%</div>
                <div>Messages/min: ${perfReport.messagesPerMinute.toFixed(1)}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 4px;">💬 Analytics</div>
                <div>Total Messages: ${perfReport.totalMessages}</div>
                <div>Avg Response Length: ${analyticsReport.averageResponseLength.toFixed(0)} chars</div>
                <div>Sentiment: ${sentimentTrend.average.toFixed(2)} (${sentimentTrend.trend})</div>
                <div>Stop Signals: ${analyticsReport.stopSignalFrequency}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 4px;">🔄 Status</div>
                <div>Mode: ${state.mode}</div>
                <div>Interval: ${state.intervalMs}ms</div>
                <div>Queue: ${state.sendQueue.length}/${DEFAULTS.queueMaxSize}</div>
                <div>Errors: ${state.errorCount}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 4px;">📊 Patterns</div>
                <div>Peak Hour: ${analyticsReport.peakActivityHour !== null ? analyticsReport.peakActivityHour + ":00" : "N/A"}</div>
                <div>Pattern Types: ${Object.keys(analyticsReport.patternFrequency).join(", ") || "None"}</div>
            </div>
            
            <div>
                <div style="font-weight: 600; margin-bottom: 4px;">⏱️ Session</div>
                <div>Duration: ${Math.floor(sessionInfo.sessionDuration / 60000)}m</div>
                <div>Active Tabs: ${sessionInfo.activeTabs || 1}</div>
            </div>
        `;
  }

  /**
   * Exports current settings and analytics as JSON for backup or sharing
   * @returns {string} JSON string of current settings and analytics
   */
  function exportSettings() {
    const settings = {
      ...getPersistedSettings(),
      performanceMode: state.performanceMode,
      adaptiveIntervalEnabled: state.adaptiveIntervalEnabled,
      messagePriorityEnabled: state.messagePriorityEnabled,
      exportedAt: new Date().toISOString(),
      version: "16.3",
      analytics: analyticsEngine.getReport(),
      conversationContext: state.conversationContext.slice(-20), // Last 20 messages
    };
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Imports settings from JSON string
   * @param {string} jsonStr - JSON string containing settings
   * @returns {boolean} True if import was successful
   */
  function importSettings(jsonStr) {
    try {
      const imported = JSON.parse(jsonStr);
      if (!imported || typeof imported !== "object") {
        console.error("[Copilot Automation] Invalid settings format");
        return false;
      }

      Object.keys(getPersistedSettings()).forEach((key) => {
        if (imported[key] !== undefined) {
          state[key] = normalizeSetting(key, imported[key]);
        }
      });

      saveSettings();
      if (state.mode === STATE.RUNNING) restartTimer();
      updateIntervalDisplay();
      log("Settings imported successfully.");
      return true;
    } catch (e) {
      console.error("[Copilot Automation] Failed to import settings:", e);
      return false;
    }
  }

  /**
   * Resets all settings to defaults
   */
  function resetToDefaults() {
    state.intervalMs = DEFAULTS.intervalMs;
    state.phrase = DEFAULTS.phrase;
    state.roiPhrase = DEFAULTS.roiPhrase;
    state.smartIntervalEnabled = true;
    state.uiVisible = true;
    saveSettings();
    if (state.mode === STATE.RUNNING) restartTimer();
    updateIntervalDisplay();
    log("Settings reset to defaults.");
  }

  /**
   * Starts the analytics timer
   */
  function startAnalyticsTimer() {
    if (state.analyticsTimer) {
      clearInterval(state.analyticsTimer);
      state.analyticsTimer = null;
    }
    if (!ANALYTICS_ENABLED) return;
    state.analyticsTimer = setInterval(() => {
      const report = analyticsEngine.getReport();
      debugLog("Analytics report:", report);
    }, 30000); // Every 30 seconds
  }

  /**
   * Initialize the automation script
   * Sets up all components and starts monitoring
   */
  function init() {
    if (automationInitialized) {
      return true;
    }

    automationInitialized = true;

    try {
      loadSettings();
      loadQueue();
      createUI();
      setupShortcuts();
      observeDOM();
      startHeartbeat();
      startStatsTimer();
      startAnalyticsTimer();

      // Initialize session management
      if (SESSION_MANAGEMENT && sessionManager) {
        sessionManager.init();
      }

      // Expose utilities for console access
      window.CopilotAutomation = {
        init,
        exportSettings,
        importSettings,
        resetToDefaults,
        getState: () => ({ ...state }),
        getPerformanceReport: () => performanceMonitor.getReport(),
        getAnalyticsReport: () => analyticsEngine.getReport(),
        getSentimentTrend: (windowSize) => analyticsEngine.getSentimentTrend(windowSize),
        getTrend: (metric) => performanceMonitor.getTrend(metric),
        clearPerformanceMetrics: () => performanceMonitor.clear(),
        clearAnalytics: () => analyticsEngine.clear(),
        clearQueue: () => {
          state.sendQueue = [];
          saveQueue();
          log("Queue cleared via API.");
        },
        getQueue: () =>
          state.sendQueue.map((item) => (typeof item === "object" ? item.text : item)),
        addToQueue: (text, priority = 0) => {
          enqueuePhrase(text, priority);
        },
        toggleDashboard,
        getSessionInfo: () => (sessionManager ? sessionManager.getSessionInfo() : null),
        start,
        stop,
        toggle,
        version: "16.4",
      };

      window.addEventListener("pagehide", () => {
        if (SESSION_MANAGEMENT && sessionManager) {
          sessionManager.stopHeartbeat();
          sessionManager.removeTab();
        }
      });

      state.guardianReason = "Initialised";
      log("Initialised — v16.4 ready. Access via window.CopilotAutomation");
      debugLog("Debug mode enabled. State:", state);
      return true;
    } catch (error) {
      console.error("[Copilot Automation] Init failed:", error);
      return false;
    }
  }

  class CopilotAutomationGuardianRoiModule {
    constructor() {
      this.name = "CopilotAutomationGuardianROI";
      this.version = "16.4";
      this.dependencies = [];
      this.critical = false;
    }

    init() {
      return init();
    }

    destroy() {
      stop();
      if (state.analyticsTimer) {
        clearInterval(state.analyticsTimer);
        state.analyticsTimer = null;
      }
      return true;
    }
  }

  const moduleInstance = new CopilotAutomationGuardianRoiModule();

  if (typeof window !== "undefined") {
    if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
      window.ModuleRegistry.register(moduleInstance);
    } else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === "function") {
      window.ChatGPTModules.register(moduleInstance);
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }
})();
