/**
 * Background Service Worker for Unified AI Assistant Suite Extension
 * Chrome/Firefox/Edge Manifest V3 compatible
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ suiteInstalled: true, suiteVersion: '2.1.0' });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getConfig':
      chrome.storage.local.get(['apiKey', 'apiProvider', 'apiBaseUrl'], (result) => {
        sendResponse({ config: result });
      });
      return true;

    case 'setConfig':
      chrome.storage.local.set(request.config, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'generateScript':
      handleGenerateScript(request.payload, sendResponse);
      return true;

    case 'notification':
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: request.title || 'AI Assistant Suite',
        message: request.message,
        priority: 2
      });
      sendResponse({ queued: true });
      return true;

    default:
      sendResponse({ error: 'Unknown action: ' + request.action });
      return false;
  }
});

function handleGenerateScript(payload, sendResponse) {
  const { provider, prompt, options } = payload;

  switch (provider) {
    case 'openai':
      callOpenAI(prompt, options, sendResponse);
      break;
    case 'anthropic':
      callAnthropic(prompt, options, sendResponse);
      break;
    case 'gemini':
      callGemini(prompt, options, sendResponse);
      break;
    case 'ollama':
      callOllama(prompt, options, sendResponse);
      break;
    default:
      sendResponse({ error: 'Unknown provider: ' + provider });
  }
}

function callOpenAI(prompt, options, sendResponse) {
  chrome.storage.local.get(['apiKey'], (result) => {
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + result.apiKey
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000
      })
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, response: data }))
      .catch(err => sendResponse({ error: err.message }));
  });
}

function callAnthropic(prompt, options, sendResponse) {
  chrome.storage.local.get(['apiKey'], (result) => {
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': result.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 4000
      })
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, response: data }))
      .catch(err => sendResponse({ error: err.message }));
  });
}

function callGemini(prompt, options, sendResponse) {
  chrome.storage.local.get(['apiKey'], (result) => {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      (options.model || 'gemini-1.5-flash') + ':generateContent?key=' + result.apiKey;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 4000
        }
      })
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, response: data }))
      .catch(err => sendResponse({ error: err.message }));
  });
}

function callOllama(prompt, options, sendResponse) {
  const baseUrl = options.baseUrl || 'http://localhost:11434';
  fetch(baseUrl + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || 'llama3',
      prompt: prompt,
      stream: false
    })
  })
    .then(r => r.json())
    .then(data => sendResponse({ success: true, response: data }))
    .catch(err => sendResponse({ error: err.message }));
}