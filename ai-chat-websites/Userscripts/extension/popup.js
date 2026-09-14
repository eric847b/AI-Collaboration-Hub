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
function recordGeneration(provider, ok, meta) {
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  events.push({
    provider: provider || 'unknown',
    success: !!ok,
    timestamp: Date.now(),
    responseMs: meta?.responseMs || null,
    tokens: meta?.tokens || null,
    costUsd: meta?.costUsd || null
  });
  localStorage.setItem('analytics_events', JSON.stringify(events.slice(-500)));
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
    container.innerHTML = '<div style="color:#888;font-size:12px;padding:8px">No analytics yet.</div>';
    return;
  }
  const now = Date.now();
  const filters = [
    { label: 'All', ms: Infinity },
    { label: '24h', ms: 86400000 },
    { label: '7d', ms: 604800000 },
    { label: '30d', ms: 2592000000 }
  ];
  const activeFilter = parseInt(localStorage.getItem('stats_filter') || '0', 10);
  const filtered = events.filter(e => (now - e.timestamp) < filters[activeFilter].ms);
  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:#888;font-size:12px;padding:8px">No data in range.</div>';
    return;
  }
  const byProvider = {};
  let success = 0, totalMs = 0, msCount = 0, totalTokens = 0, totalCost = 0;
  filtered.forEach(e => {
    const p = byProvider[e.provider] || (byProvider[e.provider] = { total: 0, ok: 0, ms: 0, msN: 0, tokens: 0, cost: 0 });
    p.total++;
    if (e.success) { p.ok++; success++; }
    if (e.responseMs) { p.ms += e.responseMs; p.msN++; totalMs += e.responseMs; msCount++; }
    if (e.tokens) { p.tokens += e.tokens; totalTokens += e.tokens; }
    if (e.costUsd) { p.cost += e.costUsd; totalCost += e.costUsd; }
  });
  const total = filtered.length;
  const rate = Math.round((success / total) * 100);
  const avgMs = msCount ? Math.round(totalMs / msCount) : null;
  const savedMin = success * 5;
  let html = '<div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">';
  filters.forEach((f, i) => {
    const sel = i === activeFilter ? 'background:#0f3460;color:#fff' : 'background:#16213e;color:#888';
    html += '<button onclick="setStatsFilter(' + i + ')" style="' + sel + ';border:none;border-radius:4px;padding:6px 10px;font-size:11px;cursor:pointer">' + f.label + '</button>';
  });
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">';
  html += sCard('Total', String(total), '#0f3460');
  html += sCard('Success', rate + '%', '#1a4a8a');
  html += sCard('Avg Time', avgMs ? avgMs + 'ms' : '—', '#0f3460');
  html += sCard('Tokens', totalTokens ? totalTokens.toLocaleString() : '—', '#0f3460');
  html += sCard('Cost', totalCost ? '$' + totalCost.toFixed(4) : '—', '#0f3460');
  html += sCard('Saved', '~' + savedMin + 'm', '#1a4a8a');
  html += '</div>';
  Object.entries(byProvider).forEach(([provider, s]) => {
    const r = Math.round((s.ok / s.total) * 100);
    const avg = s.msN ? Math.round(s.ms / s.msN) : null;
    html += '<div style="background:#16213e;border-radius:6px;padding:10px;margin-bottom:6px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:12px;color:#e0e0e0"><b>' + provider + '</b><span style="color:#888">' + s.ok + '/' + s.total + ' (' + r + '%)</span></div>';
    html += '<div style="height:6px;background:#0d1b2a;border-radius:3px;margin:4px 0"><div style="width:' + r + '%;height:6px;background:#1a4a8a;border-radius:3px"></div></div>';
    html += '<div style="font-size:10px;color:#888">Avg: ' + (avg ? avg + 'ms' : '—') + ' | Tokens: ' + (s.tokens ? s.tokens.toLocaleString() : '—') + ' | Cost: ' + (s.cost ? '$' + s.cost.toFixed(4) : '—') + '</div>';
    html += '</div>';
  });
  html += '<div style="display:flex;gap:6px;margin-top:10px">';
  html += '<button onclick="exportStats()" style="flex:1;background:#0f3460;color:#fff;border:none;border-radius:6px;padding:8px;font-size:12px;cursor:pointer">Export CSV</button>';
  html += '<button onclick="clearStats()" style="flex:1;background:#4a1a1a;color:#fff;border:none;border-radius:6px;padding:8px;font-size:12px;cursor:pointer">Clear All</button>';
  html += '</div>';
  container.innerHTML = html;
}

function sCard(label, value, color) {
  return '<div style="background:#16213e;border-radius:6px;padding:8px;text-align:center"><div style="font-size:10px;color:#888">' + label + '</div><div style="font-size:16px;font-weight:600;color:' + color + '">' + value + '</div></div>';
}

function setStatsFilter(idx) {
  localStorage.setItem('stats_filter', String(idx));
  renderStats();
}

function exportStats() {
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  if (!events.length) return;
  const header = 'timestamp,provider,success,response_ms,tokens,cost_usd\n';
  const rows = events.map(e => new Date(e.timestamp).toISOString() + ',' + e.provider + ',' + e.success + ',' + (e.responseMs || '') + ',' + (e.tokens || '') + ',' + (e.costUsd || '')).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-suite-analytics-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
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