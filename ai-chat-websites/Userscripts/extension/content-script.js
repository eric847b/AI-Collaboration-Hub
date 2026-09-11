/**
 * Content Script for Unified AI Assistant Suite Extension
 * Injects into AI chat websites, bridges DOM context with extension background
 */

(() => {
  'use strict';

  const PLATFORM_DETECTORS = {
    openai: ['chat.openai.com'],
    claude: ['claude.ai'],
    gemini: ['gemini.google.com']
  };

  const currentPlatform = detectPlatform();
  console.log('[AI Assistant Suite] Content script loaded on:', currentPlatform);

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('chat.openai.com')) return 'openai';
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('gemini.google.com')) return 'gemini';
    return 'unknown';
  }

  function getPageContext() {
    try {
      const selection = window.getSelection().toString().trim();
      const title = document.title;
      const url = window.location.href;
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      return {
        platform: currentPlatform,
        url,
        title,
        description,
        selectedText: selection,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return { platform: currentPlatform, error: e.message };
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'getPageContext':
        sendResponse({ context: getPageContext() });
        break;

      case 'injectPrompt':
        injectPrompt(request.prompt);
        sendResponse({ success: true });
        break;

      case 'extractChatHistory':
        sendResponse({ history: extractChatHistory() });
        break;

      default:
        sendResponse({ error: 'Unknown content action' });
    }
  });

  function injectPrompt(prompt) {
    const platformActions = {
      openai: () => {
        const composer = document.querySelector('#promptTextarea');
        if (composer) {
          composer.textContent = prompt;
          composer.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      claude: () => {
        const composer = document.querySelector('div[contenteditable="true"]');
        if (composer) {
          composer.textContent = prompt;
          composer.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      gemini: () => {
        const composer = document.querySelector('[aria-label="Message"]');
        if (composer) {
          composer.textContent = prompt;
          composer.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    };

    const action = platformActions[currentPlatform];
    if (action) action();
  }

  function extractChatHistory() {
    const results = [];

    if (currentPlatform === 'openai') {
      const messages = document.querySelectorAll('.conversation-item');
      messages.forEach((item, i) => {
        const isUser = item.classList.contains('user');
        const textEl = item.querySelector('.markdown');
        results.push({
          role: isUser ? 'user' : 'assistant',
          content: textEl ? textEl.innerText : '',
          index: i
        });
      });
    }

    if (currentPlatform === 'claude') {
      const messages = document.querySelectorAll('[data-testid="conversation-turn"]');
      messages.forEach((turn, i) => {
        const isUser = turn.querySelector('humanmsg') || turn.querySelector('[data-user-visible="true"]');
        const textEl = turn.querySelector('.whitespace-pre-wrap');
        if (textEl) {
          results.push({
            role: isUser ? 'user' : 'assistant',
            content: textEl.innerText,
            index: i
          });
        }
      });
    }

    return results;
  }

  window.addEventListener('message', (event) => {
    if (event.source === window && event.data?.source === 'ai-assistant-suite') {
      chrome.runtime.sendMessage(event.data, (response) => {
        if (response) {
          window.postMessage({
            source: 'ai-assistant-suite-response',
            ...response
          }, '*');
        }
      });
    }
  });
})();