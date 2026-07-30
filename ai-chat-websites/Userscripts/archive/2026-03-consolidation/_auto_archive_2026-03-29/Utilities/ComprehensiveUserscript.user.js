// ==UserScript==
// @name         Comprehensive Userscript
// @namespace    http://tampermonkey.net/
// @version      2026.03.19.0
// @description  Compatibility shim for the ChatGPT Userscript Code Pack
// @author       Eric
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const NOTICE_ID = 'code-pack-compat-notice';
    const MODULE_CHECKERS = [
        () => window.ChatGPTModules?.list?.(),
        () => window.ModuleRegistry?.list?.()
    ];

    function createNotice(message, tone) {
        if (!document.body || document.getElementById(NOTICE_ID)) return;

        const notice = document.createElement('div');
        notice.id = NOTICE_ID;
        notice.textContent = message;
        notice.style.cssText = `
            position:fixed; right:16px; bottom:16px; z-index:99999; max-width:360px;
            padding:12px 14px; border-radius:12px; border:1px solid rgba(15,23,42,0.14);
            box-shadow:0 12px 30px rgba(15,23,42,0.16); font:13px/1.4 system-ui, sans-serif;
            color:#0f172a; background:${tone==='info'?'linear-gradient(135deg,#eff6ff,#dbeafe)':'linear-gradient(135deg,#fff7ed,#ffedd5)'};
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Dismiss';
        closeBtn.style.cssText = `
            margin-top:10px; padding:6px 10px; border:none; border-radius:999px;
            background:#0f172a; color:#fff; cursor:pointer;
        `;
        closeBtn.onclick = () => notice.remove();

        notice.appendChild(document.createElement('br'));
        notice.appendChild(closeBtn);
        document.body.appendChild(notice);

        setTimeout(() => notice.remove(), 12000);
    }

    function getRegisteredModules() {
        for (const checker of MODULE_CHECKERS) {
            try {
                const modules = checker();
                if (modules && modules.length > 0) return modules;
            } catch {}
        }
        return [];
    }

    function init() {
        const modules = getRegisteredModules();
        const hasModules = modules.length > 0;
        
        console[hasModules ? 'log' : 'warn'](
            `[ComprehensiveUserscript] ${hasModules ? 'Code Pack runtime present:' : 'Install Code Pack/dist/code-pack.bundle.merged.user.js for full runtime'}`
        );

        if (hasModules) {
            console.log(modules.map(m => m.name));
            createNotice('Code Pack runtime already loaded. No separate imports needed.', 'info');
        } else {
            createNotice('Install dist/code-pack.bundle.merged.user.js for full experience.', 'warning');
        }
    }

    (document.readyState === 'loading' 
        ? document.addEventListener('DOMContentLoaded', init, { once: true })
        : init()
    );
})();
