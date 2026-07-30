const fs = require('fs');
const path = require('path');

const __dirname = 'C:/Users/Eric/OneDrive/Documents/Userscripts/AI Chat Websites/Userscripts/AI Chat Userscript Studio/Userscript Suite/Modules';

const BOILERPLATE = (n, name) => `// ==UserScript==
// @name         ${String(n).padStart(3,'0')}. ${name}
// @version      2026.06.26.2
// @description  AI Chat Userscript Suite - Module ${n}: ${name}
// @author       AI Chat Userscript Studio
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-idle
// ==/UserScript==

var MODULE_ID = 'module-' + ${n};
var MODULE_NAME = '${name.replace(/'/g, "\\'")}';

(function() {
    'use strict';

    // Module namespace
    window[MODULE_ID] = window[MODULE_ID] || {};

    // Initialization
    var module = window[MODULE_ID];
    module.id = MODULE_ID;
    module.name = MODULE_NAME;
    module.version = '2026.06.26.2';

    if (typeof GM_setValue !== 'undefined') {
        GM_setValue(MODULE_ID + '_loaded', 'true');
    }

    // Auto-initialize
    try {
        if (typeof module.init === 'function') {
            module.init();
        }
    } catch (e) {
        console.warn('[' + MODULE_ID + '] init failed:', e);
    }

    console.log('[' + MODULE_ID + '] ' + MODULE_NAME + ' loaded');
})();
`;

const ITEMS = [
  [24, 'Gap Filler 24'],
  [40, 'Gap Filler 40'],
  [41, 'Gap Filler 41']
];

let created = 0;
const base = __dirname;
for (const [n, name] of ITEMS) {
  const fileName = `${String(n).padStart(3,'0')}-module-${String(n).padStart(3,'0')}.module.user.js`;
  fs.writeFileSync(path.join(base, fileName), BOILERPLATE(n, name));
  created++;
}
console.info(`Created ${  created  } backfill modules`);
