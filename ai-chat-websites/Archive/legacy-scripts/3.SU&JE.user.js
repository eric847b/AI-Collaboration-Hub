// ==UserScript==
// @name                ChatGPT Script Executor and Updater
// @description         Executes and updates JavaScript code provided by ChatGPT, enhancing your ChatGPT experience.
// @version             13.11.2024.1344
// @author              AI RMD
// @match               https://chat.openai.com/*
// @match               https://chatgpt.com/*
// @grant               GM_setValue
// @grant               GM_getValue
// @grant               GM_xmlhttpRequest
// @grant               GM_notification
// @grant               GM_info
// @require             https://cdn.jsdelivr.net/gh/kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// @license             MIT
// ==/UserScript==

(async () => {
  "use strict";
  const t = 250,
    e = "3.3.5",
    i = !0;
  new (class {
    constructor() {
      ((this.metricsVersion = "1.4.0"),
        this.reset(),
        (this.updateInterval = t),
        i && (this.initObservers(), this.initNavigationTiming()));
    }
    initNavigationTiming() {
      if (window.performance && window.performance.timing) {
        const t = window.performance.timing;
        this.navigationTiming = {
          domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
          load: t.loadEventEnd - t.navigationStart,
          firstPaint: t.responseStart - t.navigationStart,
          ...t,
        };
      } else this.navigationTiming = {};
    }
    initObservers() {
      "function" == typeof PerformanceObserver &&
        ((this.performanceObserver = new PerformanceObserver((t) => {
          t.getEntries().forEach((t) => {
            this.handlePerformanceEntry(t);
          });
        })),
        this.performanceObserver.observe({
          entryTypes: [
            "measure",
            "largest-contentful-paint",
            "layout-shift",
            "longtask",
            "paint",
            "navigation",
            "resource",
            "element",
            "first-input",
          ],
        }));
    }
    handlePerformanceEntry(t) {
      switch (t.entryType) {
        case "measure":
          "executionTime" === t.name && this.updateResponseTime(t.duration);
          break;
        case "largest-contentful-paint":
          this.largestContentfulPaint = t.renderTime || t.loadTime;
          break;
        case "layout-shift":
          this.cumulativeLayoutShift += t.value;
          break;
        case "longtask":
          this.longTasks.push(t);
          break;
        case "resource":
          this.resources.push(t);
          break;
        case "paint":
          "first-contentful-paint" === t.name && (this.firstContentfulPaint = t.startTime);
      }
    }
    updateResponseTime(t) {
      (this.responseTimeHistory.push(t),
        (this.totalExecutionTime += t),
        (this.averageResponseTime = this.totalExecutionTime / this.responseTimeHistory.length));
    }
    reset() {
      ((this.executionCount = 0),
        (this.successCount = 0),
        (this.errorCount = 0),
        (this.responseTimeHistory = []),
        (this.averageResponseTime = 0),
        (this.totalExecutionTime = 0),
        (this.longTasks = []),
        (this.resources = []),
        (this.largestContentfulPaint = 0),
        (this.cumulativeLayoutShift = 0),
        (this.navigationTiming = {}),
        (this.firstContentfulPaint = 0));
    }
    getAllMetrics() {
      return {
        metricsVersion: this.metricsVersion,
        executionCount: this.executionCount,
        successCount: this.successCount,
        errorCount: this.errorCount,
        averageResponseTime: this.averageResponseTime,
        totalExecutionTime: this.totalExecutionTime,
        longTasks: this.longTasks,
        resources: this.resources,
        largestContentfulPaint: this.largestContentfulPaint,
        cumulativeLayoutShift: this.cumulativeLayoutShift,
        navigationTiming: this.navigationTiming,
        firstContentfulPaint: this.firstContentfulPaint,
      };
    }
  })();
  ((window.checkChatGPTVersion = async function () {
    try {
      const t = e,
        i = window.chatgpt?.version || "unknown";
      if (!window.chatgpt || parseFloat(i) < parseFloat(t)) {
        const e = `ChatGPT.js requires version ${t} or higher. Current version: ${i}.`;
        return (
          console.error(e),
          "function" == typeof GM_notification
            ? GM_notification({
                text: e,
                title: "ChatGPT.js Update Required",
                timeout: 6e4,
                onclick: () =>
                  window.open("https://github.com/kudoai/chatgpt.js/releases/latest", "_blank"),
              })
            : alert(e + "\nUpdate at: https://github.com/kudoai/chatgpt.js/releases/latest"),
          !1
        );
      }
    } catch (t) {
      return (console.error("Version check error:", t), !1);
    }
    return !0;
  }),
    (window.calculateComplexity = function (t) {
      if (!t || "string" != typeof t) return {};
      const e = Object.fromEntries(
        Object.entries({
          loops: /\b(for|while|do|forEach)\b/g,
          conditionals: /\b(if|else if|else|switch|case|default|try|catch|finally)\b/g,
          functions: /\b(function|=>|class|async|get|set|static)\b/g,
          events: /\b(addEventListener|removeEventListener|on)\b/g,
          operators: /\b(instanceof|typeof|in|of|void|delete|new|await|yield)\b/g,
        }).map(([e, i]) => [e, (t.match(i) || []).length])
      );
      e.total = Object.values(e).reduce((t, e) => t + e, 0);
      const i =
        1 + (t.match(/\b(if|else|for|while|switch|case|try|catch|finally)\b/g) || []).length;
      e.cyclomatic = i;
      const n = (t.match(/[+\-*\/%!=&|^~?:;.,<>()\[\]{}]/g) || []).length,
        s = (t.match(/(\b\w+\b)|(["'](.*?)["'])/g) || []).length;
      return (
        (e.halstead = {
          operators: n,
          operands: s,
          length: n + s,
          vocabulary:
            new Set([...(t.match(/(\b\w+\b)|(["'](.*?)["'])/g) || [])]).size +
            new Set([...(t.match(/[+\-*\/%!=&|^~?:;.,<>()\[\]{}]/g) || [])]).size,
        }),
        e
      );
    }),
    console.log("ChatGPT Script Executor and Updater initialized."));
})();
