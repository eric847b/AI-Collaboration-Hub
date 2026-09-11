/**
 * Popup UI logic for Unified AI Assistant Suite Extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadHistory();
  const tempSlider = document.getElementById('temperature');
  const tempValue = document.getElementById('temp-value');
  tempSlider.addEventListener('input', () => {
    tempValue.textContent = tempSlider.value;
  });
  await renderStats();
});

/**
 * Analytics — record a generation outcome (provider + success) so the Stats
 * tab can show success rates, provider comparison, and time saved.
 */
function recordGeneration(provider, ok) {
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  events.push({
    provider: provider || 'unknown',
    success: !!ok,
    timestamp: Date.now()
  });
  localStorage.setItem('analytics_events', JSON.stringify(events.slice(-200)));
}

/**
 * Analytics — render the Stats tab: totals, success rate, per-provider bars,
 * estimated time saved (~5 min per successful generation).
 */
function renderStats() {
  const container = document.getElementById('stats-list');
  if (!container) return;
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');

  if (events.length === 0) {
    container.innerHTML =
      '<div style="color:#888;font-size:12px;padding:8px">No analytics yet — generate a script to start tracking.</div>';
    return;
  }

  const byProvider = {};
  let success = 0;
  events.forEach(e => {
    const p = byProvider[e.provider] || (byProvider[e.provider] = { total: 0, ok: 0 });
    p.total++;
    if (e.success) {
      p.ok++;
      success++;
    }
  });

  const total = events.length;
  const rate = Math.round((success / total) * 100);
  const savedMin = success * 5;

  let html =
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:10px">' +
    `<span>Total: <b style="color:#0f3460">${total}</b></span>` +
    `<span>Success: <b style="color:#0f3460">${rate}%</b></span>` +
    `<span>Saved: <b style="color:#0f3460">~${savedMin}m</b></span>` +
    '</div>';

  Object.entries(byProvider).forEach(([provider, s]) => {
    const r = Math.round((s.ok / s.total) * 100);
    html +=
      '<div style="background:#16213e;border-radius:4px;padding:8px;margin-bottom:6px">' +
      `<div style="font-size:12px;color:#e0e0e0">${provider} — ${r}% <span style="color:#888">(${s.ok}/${s.total})</span></div>` +
      '<div style="height:6px;background:#0d1b2a;border-radius:3px">' +
      `<div style="width:${r}%;height:6px;background:#1a4a8a;border-radius:3px"></div>` +
      '</div></div>';
  });

  html +=
    '<button onclick="clearStats()" style="margin-top:10px;background:#4a1a1a;color:#fff;' +
    'border:none;border-radius:6px;padding:8px;font-size:12px;cursor:pointer">Clear Analytics</button>';

  container.innerHTML = html;
}

/** Analytics — wipe locally stored events and re-render. */
function clearStats() {
  localStorage.removeItem('analytics_events');
  renderStats();
}

function showTab(tabName, el) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  if (el) el.classList.add('active');
  if (tabName === 'stats') renderStats();
}

async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
  if (response && response.config) {
    const { apiKey, apiProvider } = response.config;
    if (apiKey) document.getElementById('api-key').value = apiKey;
    if (apiProvider) document.getElementById('config-provider').value = apiProvider;
  }
}

async function saveConfig() {
  const apiKey = document.getElementById('api-key').value;
  const apiProvider = document.getElementById('config-provider').value;
  await chrome.runtime.sendMessage({
    action: 'setConfig',
    config: { apiKey, apiProvider }
  });
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Configuration Saved',
    message: 'Your API settings have been saved.'
  });
}

async function generateScript() {
  const provider = document.getElementById('provider').value;
  const model = document.getElementById('model').value;
  const prompt = document.getElementById('prompt').value;
  const temperature = document.getElementById('temperature').value;
  const output = document.getElementById('output');
  const btn = document.getElementById('generate-btn');

  if (!prompt) {
    output.textContent = 'Please enter a prompt.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Generating...';
  output.textContent = '';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateScript',
      payload: {
        provider,
        prompt,
        options: {
          model: model || undefined,
          temperature: parseFloat(temperature),
          maxTokens: 4000
        }
      }
    });

    if (response.error) {
      output.textContent = 'Error: ' + response.error;
      recordGeneration(provider, false);
    } else if (response.success) {
      const text = response.response?.choices?.[0]?.message?.content ||
                   response.response?.content?.[0]?.text ||
                   JSON.stringify(response.response);
      output.textContent = text;
      recordGeneration(provider, true);
      await saveToHistory(provider, prompt, text);
    }
  } catch (err) {
    output.textContent = 'Error: ' + err.message;
    recordGeneration(provider, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Script';
  }
}

async function saveToHistory(provider, prompt, result) {
  const history = JSON.parse(localStorage.getItem('history') || '[]');
  history.unshift({
    id: Date.now(),
    provider,
    prompt,
    result,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('history', JSON.stringify(history.slice(0, 20)));
  await loadHistory();
}

async function loadHistory() {
  const history = JSON.parse(localStorage.getItem('history') || '[]');
  const container = document.getElementById('history-list');
  if (history.length === 0) {
    container.textContent = 'No history yet';
    return;
  }
  container.innerHTML = history.map(item => `
    <div style="margin-bottom:8px;">
      <div style="font-size:11px;color:#888">${new Date(item.timestamp).toLocaleString()}</div>
      <div style="font-size:11px;color:#0f3460">${item.provider}:</div>
      <div style="font-size:10px;color:#aaa;margin-top:4px">${item.prompt.substring(0,80)}...</div>
    </div>
  `).join('');
}