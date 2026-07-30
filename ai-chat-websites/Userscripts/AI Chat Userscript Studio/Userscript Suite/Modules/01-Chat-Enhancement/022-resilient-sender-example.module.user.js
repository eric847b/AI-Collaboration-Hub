// ==UserScript==
// @name         Resilient Sender Example
// @namespace   AI-Chat-Userscript-Studio
// @version     1.0.0
// @description  Minimal example module using the shared retry/backoff helper for normal sends
// @match       *://*/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_notification
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    var MODULE_ID = '116-resilient-sender-example';
    var MODULE_NAME = 'Resilient Sender Example';

    var chat = (window.ChatGPTUtils && typeof window.ChatGPTUtils.getChatAdapter === 'function')
        ? window.ChatGPTUtils.getChatAdapter()
        : (window.chatgpt || null);

    function safeSendMessage(text) {
        if (chat && typeof chat.sendMessage === 'function') {
            return Promise.resolve(chat.sendMessage(text));
        }
        return Promise.reject(new Error('sendMessage not supported on this site'));
    }

    async function sendWithRetry(text) {
        var helper = window.promptSplitterRetry;
        if (!helper || typeof helper.execute !== 'function') {
            return safeSendMessage(text);
        }
        var outcome = await helper.execute(
            function(attempt) {
                return safeSendMessage(text);
            },
            {
                maxRetries: 2,
                minRetries: 0,
                baseDelay: 500,
                degradeMaxRetries: 0,
                degradeBaseDelay: 0,
                ui: null
            }
        );
        if (!outcome.success) {
            throw outcome.error || new Error('Resilient send failed');
        }
        return outcome.result;
    }

    var batcher = (window.module_102 && window.module_102.batcher) || null;

    async function sendViaExampleModule(text) {
        if (batcher && typeof batcher.enqueue === 'function') {
            return new Promise(function(resolve, reject) {
                batcher.enqueue(
                    function() {
                        return sendWithRetry(text);
                    },
                    {
                        maxRetries: 2,
                        baseDelay: 500
                    }
                );
            });
        }
        return sendWithRetry(text);
    }

    function init() {
        try {
            GM_setValue(MODULE_ID + '_loaded', 'true');
            console.log('[' + MODULE_ID + '] ' + MODULE_NAME + ' loaded');
        } catch {}
    }

    function destroy() {
        try {
            GM_setValue(MODULE_ID + '_loaded', 'false');
        } catch {}
    }

    window[MODULE_ID] = {
        id: MODULE_ID,
        name: MODULE_NAME,
        version: '2026.06.26.1',
        init: init,
        destroy: destroy,
        sendWithRetry: sendWithRetry,
        sendViaExampleModule: sendViaExampleModule
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('beforeunload', destroy);
})();