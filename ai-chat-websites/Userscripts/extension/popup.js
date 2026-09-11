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
});

function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  event.currentTarget.classList.add('active');
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
    } else if (response.success) {
      const text = response.response?.choices?.[0]?.message?.content ||
                   response.response?.content?.[0]?.text ||
                   JSON.stringify(response.response);
      output.textContent = text;
      await saveToHistory(provider, prompt, text);
    }
  } catch (err) {
    output.textContent = 'Error: ' + err.message;
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