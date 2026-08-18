// ==UserScript==
// @name         FreeAI Collaboration Module
// @namespace    http://ai-collab-hub.example
// @version      1.0.0
// @description  Provides a button to invoke the workspace-wide FreeAI rotator.
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // This module delegates to the workspace-level FreeAI rotator.
    // From the root:   npm run ai -- "your prompt"
    // From nexus-infinity-hub:  npm run ai -- "your prompt"
    // It rotates through permanent‑free local providers (Ollama/LM Studio/LocalAI)
    // then cloud free tiers (Groq, Gemini, Together, OpenRouter, HF).
    // Instant failover on 429/5xx/throw, step accumulation, no pause.

    // On click, open a prompt and run the rotator via the workspace CLI.
    // (In a real deployment the script would inject a docked result card;
    // here we simply demonstrate the intent.)
    const prompt = window.prompt(
        'FreeAI prompt (type your request, or press Cancel):',
        'State what you are, in one line.'
    );
    if (prompt === null) return;
    // Launch the rotator from the workspace root:
    //   npm run ai -- "${prompt}"
    // For now, just log the intent:
    console.log('[FreeAI Collaboration] prompt would be sent via: npm run ai -- "' + prompt + '"');
})();