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

/**
 * Multi-model orchestration (Q2 2027 #15).
 * Routes each generation to the cheapest capable model for the task, with a
 * quality escalation ladder on failure. Choose 'auto' in the popup to use the
 * router; picking a specific provider keeps manual routing.
 */

const MODEL_LADDER = [
  // [provider, model, capability: 1 = cheap … 5 = premium]
  { provider: 'ollama',   model: 'llama3',                    capability: 1 },
  { provider: 'gemini',   model: 'gemini-1.5-flash',          capability: 2 },
  { provider: 'openai',   model: 'gpt-4o-mini',               capability: 3 },
  { provider: 'gemini',   model: 'gemini-1.5-pro',            capability: 4 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', capability: 5 },
  { provider: 'openai',   model: 'gpt-4o',                    capability: 5 }
];

/** Heuristic difficulty score (1-5) from the prompt content. */
function scoreCapability(prompt) {
  const text = (prompt || '').toLowerCase();
  let score = text.length >= 120 ? 0 : 1;
  if (text.includes('create a script')) score -= 1;
  if (text.length > 600) score += 2;
  if (/\b(simple|basic|quick|short|small|banner|tooltip)\b/.test(text)) score -= 1;
  const COMPLEX_HINTS = [
    'complex', 'advanced', 'architect', 'optimize', 'refactor', 'debug',
    'reason', 'hard', 'async', 'concurrent', 'multi-threaded', 'enterprise', 'ai'
  ];
  for (const hint of COMPLEX_HINTS) {
    if (text.includes(hint)) score += 1;
  }
  return Math.max(1, Math.min(5, score));
}

/** The cheapest ladder tier capable of the prompt's difficulty. */
function routedTier(prompt) {
  const need = scoreCapability(prompt);
  return MODEL_LADDER.find(t => t.capability >= need) || MODEL_LADDER[MODEL_LADDER.length - 1];
}

/** Try the graded tier; escalate to higher tiers when a call fails. */
function orchestrate(prompt, options, sendResponse) {
  const startIndex = MODEL_LADDER.indexOf(routedTier(prompt));
  let failures = 0;

  const tryTier = (index) => {
    if (index >= MODEL_LADDER.length) {
      sendResponse({ error: 'All model tiers failed. Check your provider API keys.' });
      return;
    }
    const tier = MODEL_LADDER[index];
    const tierOptions = Object.assign({}, options, { model: tier.model });
    routeToProvider(tier.provider, prompt, tierOptions, (result) => {
      if (result && result.success) {
        sendResponse(Object.assign({}, result, { route: tier.provider + '/' + tier.model }));
      } else if (failures < 2) {
        failures += 1;
        tryTier(index + 1);
      } else {
        sendResponse(result || { error: 'Generation failed after escalation.' });
      }
    });
  };

  tryTier(Math.max(0, startIndex));
}

function routeToProvider(provider, prompt, options, sendResponse) {
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

function handleGenerateScript(payload, sendResponse) {
  const { provider, prompt, options } = payload;

  if (!prompt) {
    sendResponse({ error: 'Prompt is required.' });
    return;
  }

  if (provider && provider !== 'auto') {
    routeToProvider(provider, prompt, options, sendResponse);
    return;
  }

  orchestrate(prompt, options, sendResponse);
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