// ==UserScript==
// @name         ChatGPT - UI & Prompt Splitter Module - AI RMD
// @version      30-11-2024.1
// @description  Combines UI customization and prompt-splitting functionality for ChatGPT
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
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @match        https://chat.openai.com/*
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// @run-at       document-start
// ==/UserScript==

!(function () {
  "use strict";
  const e = 6e3,
    t = 15;
  const n = document.createElement("input");
  ((n.type = "file"),
    (n.accept = ".txt"),
    (n.style.display = "none"),
    (n.onchange = (n) => {
      const o = n.target.files[0];
      o &&
        (console.log("File selected:", o.name),
        (async function (n) {
          const o = new FileReader();
          ((o.onload = async function (n) {
            const o = (function (e, t) {
              const n = e.split(/(\s+)/),
                o = [];
              let c = "";
              return (
                n.forEach((e) => {
                  (c + e).length <= t ? (c += e) : (o.push(c.trim()), (c = e.trim()));
                }),
                c && o.push(c.trim()),
                o
              );
            })(n.target.result, e - t);
            console.log(`Split into ${o.length} parts.`);
          }),
            (o.onerror = function (e) {
              console.error("Error reading file:", e);
            }),
            o.readAsText(n));
        })(o));
    }),
    document.body.appendChild(n),
    GM_registerMenuCommand("Upload and Split File", () => {
      n.click();
    }),
    console.log("Merged script is now active."));
})();
