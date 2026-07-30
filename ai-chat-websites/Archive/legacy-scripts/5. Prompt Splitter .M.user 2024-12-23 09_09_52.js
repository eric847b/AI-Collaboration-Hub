// ==UserScript==
// @name         5.Prompt.Splitter.M.user
// @version      11-27-2024.1
// @description  ChatGPT - Prompt splitting functionality. Combines UI customization.
// @author       AI RMD
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_info
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@3.3.5/dist/chatgpt.min.js
// @run-at       document-start
// ==/UserScript==

(function () {
  /**
   * Configuration Settings
   */
  const config = {
    aracterLimit: 6000, // Max characters per message
    sequenceLabelLength: 15, // Reserved length for sequence labels
    enableDebugLogs: true, // Enable detailed logging for debugging
  };

  /**
   * Utility Functions
   */
  const Utils = {
    log(message, ...optionalParams) {
      if (config.enableDebugLogs) {
        console.log(`[PromptSplitter] ${message}`, ...optionalParams);
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
      });
    },
  };

  /**
   * Prompt Splitting Logic
   */
  const PromptSplitter = {
    splitPrompt(prompt, maxLength) {
      const words = prompt.split(/(\s+)/);
      const parts = [];
      let currentPart = "";

      words.forEach((chunk) => {
        if ((currentPart + chunk).length <= maxLength) {
          currentPart += chunk;
        } else {
          parts.push(currentPart.trim());
          currentPart = chunk.trim();
        }
      });

      if (currentPart) parts.push(currentPart.trim());
      Utils.log(`Split into ${parts.length} parts.`);
      return parts;
    },

    async processFile(file) {
      try {
        const content = await Utils.readFile(file);
        const maxLength = config.characterLimit - config.sequenceLabelLength;
        const parts = this.splitPrompt(content, maxLength);
        parts.forEach((part, index) => {
          const labeledPart = `(${index + 1}/${parts.length}) ${part}`;
          Utils.log(`Prepared Part ${index + 1}:`, labeledPart);
          // Add logic here to send the labeled parts to ChatGPT
        });
      } catch (error) {
        console.error("[PromptSplitter] Error processing file:", error);
      }
    },
  };

  /**
   * UI Module Enhancements
   */
  const UIModule = {
    initializeFileInput() {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".txt";
      fileInput.style.display = "none";

      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          Utils.log("File selected:", file.name);
          PromptSplitter.processFile(file);
        }
      };

      document.body.appendChild(fileInput);

      GM_registerMenuCommand("Upload and Split File", () => {
        fileInput.click();
      });

      Utils.log("File input initialized and menu command registered.");
    },

    initializeUI() {
      this.initializeFileInput();
      Utils.log("UI Module initialized successfully.");
    },
  };

  /**
   * Initialization Logic
   */
  (function initializeScript() {
    Utils.log("Initializing Enhanced UI & Prompt Splitter Module...");
    UIModule.initializeUI();
    Utils.log("Initialization complete. Script is ready.");
  })();
})();
