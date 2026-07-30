// ==UserScript==
// @name         ChatGPT - Feedback Module - AI RMD
// @namespace    http://tampermonkey.net/
// @version      10-15-2024
// @description  Feedback adjustments for ChatGPT responses based on content analysis

// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==

(async () => {
  const e = {
    analyzeResponse: (e) =>
      e.includes("too complex")
        ? "Simplify the explanation."
        : e.includes("summary")
          ? "Summarize this further."
          : e.includes("expand") || e.length < 100
            ? "Expand on this."
            : e.includes("confusing") || e.includes("clarify")
              ? "Clarify the explanation."
              : "Provide more examples.",
    async applyFeedback() {
      try {
        const e = await chatgpt.getLastReply(),
          a = this.analyzeResponse(e);
        (console.log(`Applying feedback: ${a}`), await chatgpt.sendMessage(a));
      } catch (e) {
        console.error("Failed to apply feedback:", e);
      }
    },
  };
  chatgpt.onReply(async () => {
    await e.applyFeedback();
  });
})();
