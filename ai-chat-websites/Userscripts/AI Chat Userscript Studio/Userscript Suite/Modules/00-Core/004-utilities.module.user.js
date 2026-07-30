// ==UserScript==
// @name         Utilities
// @version      2026.03.14.1
// @description  ChatGPT - Shared utilities for all modules
// @author       AI RMD
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==

(function() {
    'use strict';
    
    // Create namespace for utilities
    window.ChatGPTUtils = window.ChatGPTUtils || {};
    
    // Logger utility
    window.ChatGPTUtils.logger = (() => {
        let logBuffer = [];
        let flushTimeout = null;
        
        const flush = async () => {
            if (logBuffer.length === 0) return;
            
            try {
                let logs = JSON.parse(GM_getValue('errorLogs', '[]'));
                logs.push(...logBuffer);
                
                // Implement log rotation
                if (logs.length > 1000) {
                    logs = logs.slice(-1000);
                }
                
                GM_setValue('errorLogs', JSON.stringify(logs));
                logBuffer = [];
            } catch (e) {
                console.error('Log flush failed:', e);
            }
        };
        
        return (level, message, data = null) => {
            const entry = {
                timestamp: new Date().toISOString(),
                level,
                message,
                data
            };
            
            console[level](`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
            logBuffer.push(entry);
            
            // Implement batched logging
            if (logBuffer.length >= 50) {
                flush();
            } else if (!flushTimeout) {
                flushTimeout = setTimeout(() => {
                    flush();
                    flushTimeout = null;
                }, 5000);
            }
        };
    })();
    
    // Error handling utilities
    window.ChatGPTUtils.errorHandling = {
        delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        retry: async function(fn, options = {}) {
            const maxRetries = options.maxRetries || 3;
            const baseDelay = options.baseDelay || 1000;
            const backoffFactor = options.backoffFactor || 2;
            
            let lastError;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    lastError = error;
                    window.ChatGPTUtils.logger('error', `Retry attempt ${attempt} failed`, { error });
                    
                    if (attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
                        await this.delay(delay);
                    }
                }
            }
            
            throw lastError;
        }
    };
    
    // DOM utilities
    window.ChatGPTUtils.dom = {
        waitForElement: function(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(selector)) {
                    return resolve(document.querySelector(selector));
                }
                
                const observer = new MutationObserver((mutations) => {
                    if (document.querySelector(selector)) {
                        observer.disconnect();
                        resolve(document.querySelector(selector));
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Timeout waiting for element: ${selector}`));
                }, timeout);
            });
        },
        
        createButton: function(text, onClick, className = '') {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = className || 'custom-button';
            button.addEventListener('click', onClick);
            return button;
        }
    };

    // Site detection and generic chat adapter
    window.ChatGPTUtils.site = (() => {
        const host = location.hostname.toLowerCase();
        const sites = [
            { id: 'chatgpt', hosts: ['chatgpt.com', 'chat.openai.com'] },
            { id: 'claude', hosts: ['claude.ai'] },
            { id: 'poe', hosts: ['poe.com'] },
            { id: 'perplexity', hosts: ['perplexity.ai', 'www.perplexity.ai'] },
            { id: 'pi', hosts: ['pi.ai'] },
            { id: 'you', hosts: ['you.com'] },
            { id: 'gemini', hosts: ['gemini.google.com'] },
            { id: 'aistudio', hosts: ['aistudio.google.com'] },
            { id: 'copilot', hosts: ['copilot.microsoft.com'] },
            { id: 'mistral', hosts: ['chat.mistral.ai'] }
        ];
        const match = sites.find(site => site.hosts.includes(host));
        return Object.freeze({
            id: match ? match.id : 'unknown',
            host,
            isChatGPT: host === 'chatgpt.com' || host === 'chat.openai.com',
            isSupported: Boolean(match)
        });
    })();

    window.ChatGPTUtils.chatAdapter = (() => {
        const isVisible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
        const isInputLike = (el) => {
            if (!el || !(el instanceof Element)) return false;
            if (el.tagName === 'TEXTAREA') return true;
            if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search')) return true;
            if (el.isContentEditable) return true;
            return false;
        };

        const getSiteHints = () => {
            const siteId = window.ChatGPTUtils?.site?.id || 'unknown';
            const hints = {
                chatgpt: {
                    input: ['#prompt-textarea', 'textarea#prompt-textarea'],
                    send: ['button[data-testid="send-button"]', 'button[aria-label*="Send"]']
                },
                claude: {
                    input: ['div[contenteditable="true"]', 'div.ProseMirror'],
                    send: ['button[aria-label*="Send"]', 'button[data-testid*="send"]']
                },
                poe: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                },
                perplexity: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                },
                pi: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                },
                you: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                },
                gemini: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                },
                aistudio: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                },
                copilot: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                },
                mistral: {
                    input: ['textarea', 'div[contenteditable="true"]'],
                    send: ['button[aria-label*="Send"]', 'button[type="submit"]']
                }
            };
            return hints[siteId] || { input: [], send: [] };
        };

        const defaultInputSelectors = [
            'textarea',
            'input[type="text"]',
            'input[type="search"]',
            '[contenteditable="true"][role="textbox"]',
            '[contenteditable="true"]'
        ];

        const defaultSendSelectors = [
            'button[type="submit"]',
            'button[aria-label*="Send"]',
            'button[aria-label*="send"]',
            'button[title*="Send"]',
            'button[title*="send"]',
            'button[data-testid*="send"]',
            'button[data-testid*="submit"]',
            'button[class*="send"]',
            'button[class*="Send"]'
        ];

        const queryCandidates = (selectors, scope = document) => {
            if (!selectors || selectors.length === 0) return [];
            return Array.from(scope.querySelectorAll(selectors.join(',')));
        };

        const scoreInput = (el) => {
            if (!isVisible(el)) return -10;
            let score = 0;
            const tag = el.tagName.toLowerCase();
            if (tag === 'textarea') score += 5;
            if (tag === 'input') score += 3;
            if (el.isContentEditable) score += 4;
            const role = (el.getAttribute('role') || '').toLowerCase();
            if (role === 'textbox') score += 2;
            const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
            if (placeholder.includes('message') || placeholder.includes('ask') || placeholder.includes('prompt')) {
                score += 2;
            }
            const rect = el.getBoundingClientRect();
            score += Math.min(5, Math.round((rect.width * rect.height) / 50000));
            if (el.disabled) score -= 5;
            return score;
        };

        const pickBest = (elements, scorer) => {
            let best = null;
            let bestScore = -Infinity;
            elements.forEach(el => {
                const score = scorer(el);
                if (score > bestScore) {
                    bestScore = score;
                    best = el;
                }
            });
            return best;
        };

        const getInput = () => {
            const active = document.activeElement;
            if (isInputLike(active) && isVisible(active)) return active;
            const hints = getSiteHints();
            const candidates = [
                ...queryCandidates(hints.input),
                ...queryCandidates(defaultInputSelectors)
            ].filter(isInputLike);
            return pickBest(candidates, scoreInput);
        };

        const scoreButton = (el) => {
            if (!isVisible(el)) return -10;
            let score = 0;
            const text = (el.getAttribute('aria-label') || el.title || el.textContent || '').toLowerCase();
            if (text.includes('send') || text.includes('submit')) score += 5;
            if (el.type === 'submit') score += 2;
            if (el.disabled) score -= 5;
            return score;
        };

        const getSendButton = (input) => {
            const hints = getSiteHints();
            const selectors = [...hints.send, ...defaultSendSelectors];
            if (selectors.length === 0) return null;

            const scopes = [];
            if (input) {
                const form = input.closest('form');
                if (form) scopes.push(form);
                const container = input.closest('footer, [role="form"], .composer, .chat, .chat-input, .input, main');
                if (container) scopes.push(container);
            }
            scopes.push(document);

            for (const scope of scopes) {
                const candidates = queryCandidates(selectors, scope);
                const best = pickBest(candidates, scoreButton);
                if (best) return best;
            }
            return null;
        };

        const setInputValue = (el, text) => {
            if (!el) return;
            el.focus();
            if (el.isContentEditable) {
                try {
                    el.textContent = '';
                    const selection = window.getSelection();
                    if (selection) {
                        selection.removeAllRanges();
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        selection.addRange(range);
                    }
                    if (document.execCommand) {
                        document.execCommand('insertText', false, text);
                    } else {
                        el.textContent = text;
                    }
                } catch (err) {
                    el.textContent = text;
                }
            } else if ('value' in el) {
                el.value = text;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const pressEnter = (input) => {
            if (!input) return;
            const eventInit = { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true };
            input.dispatchEvent(new KeyboardEvent('keydown', eventInit));
            input.dispatchEvent(new KeyboardEvent('keypress', eventInit));
            input.dispatchEvent(new KeyboardEvent('keyup', eventInit));
        };

        const clickSend = (input) => {
            const button = getSendButton(input);
            if (button) {
                button.click();
                return true;
            }
            if (input) {
                pressEnter(input);
                return true;
            }
            return false;
        };

        const collectMessages = () => {
            const candidates = document.querySelectorAll('[data-message-author-role], [data-testid*="message"], .message, .chat-message, .prose, .markdown');
            const items = [];
            candidates.forEach(el => {
                const text = (el.textContent || '').trim();
                if (!text) return;
                const roleAttr = el.getAttribute('data-message-author-role') || '';
                const className = (el.className || '').toLowerCase();
                const role = roleAttr || (className.includes('assistant') || className.includes('bot')
                    ? 'assistant'
                    : className.includes('user')
                        ? 'user'
                        : 'unknown');
                items.push({ role, text });
            });
            return items;
        };

        return {
            sendMessage: async (text) => {
                const input = getInput();
                if (!input) throw new Error('Chat input not found');
                setInputValue(input, text);
                if (!clickSend(input)) {
                    throw new Error('Send action failed');
                }
                return true;
            },
            getLastReply: async () => {
                const items = collectMessages();
                const last = [...items].reverse().find(m => m.role === 'assistant') || items[items.length - 1];
                return last ? last.text : '';
            },
            getConversationHistory: async () => collectMessages()
        };
    })();

    window.ChatGPTUtils.getChatAdapter = () => {
        if (window.chatgpt && typeof window.chatgpt.sendMessage === 'function') return window.chatgpt;
        return window.ChatGPTUtils.chatAdapter;
    };
    
    console.log('ChatGPT Utilities Module loaded');
})();
