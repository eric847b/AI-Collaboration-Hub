/**
 * Unified AI Assistant Suite - UI Module
 * @version 1.3.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

/**
 * UI Module - Handles all UI rendering and interactions
 * @version 1.4.0
 */
const UIModule = {
    /**
     * Create the unified UI
     */
    createUnifiedUI() {
        if (!document.body || document.getElementById(CONFIG.UI_ID)) return;
        
        const ui = document.createElement('div');
        ui.id = CONFIG.UI_ID;
        ui.setAttribute('role', 'region');
        ui.setAttribute('aria-label', 'AI Assistant Suite');
        
        const uiTemplate = document.createElement('template');
        uiTemplate.innerHTML = this.getUITemplate();
        ui.appendChild(uiTemplate.content.cloneNode(true));
        
        if (!document.getElementById(CONFIG.STYLE_ID)) {
            const styles = document.createElement('style');
            styles.id = CONFIG.STYLE_ID;
            styles.textContent = this.getStyles();
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(ui);
        this.bindUIEvents(ui);
    },

    /**
     * Get UI template HTML
     * @returns {string} HTML template
     */
    getUITemplate() {
        return `<div class="unified-suite-container">
            <div class="suite-header">
                <h2>AI Assistant Suite</h2>
                <div class="header-controls">
                    <div class="version">v${CONFIG.VERSION}</div>
                    <button class="toggle-btn" id="theme-toggle-btn" aria-label="Toggle theme" title="Toggle theme">🌓</button>
                    <button class="toggle-btn" id="toggle-ui-btn" aria-label="Close UI">✕</button>
                </div>
            </div>
            <div class="suite-tabs" role="tablist">
                <button class="tab-btn active" data-tab="dashboard" role="tab" aria-selected="true">Dashboard</button>
                <button class="tab-btn" data-tab="generator" role="tab" aria-selected="false">Script Generator</button>
                <button class="tab-btn" data-tab="templates" role="tab" aria-selected="false">Templates</button>
                <button class="tab-btn" data-tab="versions" role="tab" aria-selected="false">Versions</button>
                <button class="tab-btn" data-tab="security" role="tab" aria-selected="false">Security</button>
            </div>
            <div class="suite-content">
                <div class="tab-content active" id="dashboard-tab" role="tabpanel">
                    <div class="dashboard-stats">
                        <div class="stat-item">
                            <span class="stat-label">Scripts Generated</span>
                            <span class="stat-value" id="scripts-count">${this.getScriptsCount()}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Modules Active</span>
                            <span class="stat-value" id="modules-count">${Object.keys(state.modules).length}</span>
                        </div>
                    </div>
                    <div class="dashboard-actions">
                        <button class="btn-primary" id="export-scripts-button">Export All Scripts</button>
                        <label class="btn-secondary import-label">
                            <input type="file" id="import-scripts-input" accept="application/json" style="display:none">
                            Import Scripts
                        </label>
                        <button class="btn-secondary" id="clear-history-button">Clear History</button>
                    </div>
                </div>
                <div class="tab-content" id="generator-tab" role="tabpanel">
                    <div class="generator-controls">
                        <div class="control-group">
                            <label for="ai-provider-select">AI Provider:</label>
                            <select id="ai-provider-select">
                                <option value="OPENAI">OpenAI GPT-4</option>
                                <option value="ANTHROPIC">Claude</option>
                                <option value="GEMINI">Gemini</option>
                                <option value="OLLAMA">Ollama</option>
                                <option value="LOCAL">Local AI</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label for="template-select">Template:</label>
                            <select id="template-select">
                                <option value="">Custom</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label for="api-key-input">API Key:</label>
                            <input type="password" id="api-key-input" placeholder="Stored for this tab only" autocomplete="off">
                        </div>
                        <div class="control-group">
                            <label>Streaming</label>
                            <input type="checkbox" id="streaming-toggle" title="Enable streaming responses">
                            <span class="streaming-status" id="streaming-status">Idle</span>
                        </div>
                        <div class="control-group">
                            <label>Context Awareness</label>
                            <input type="checkbox" id="context-toggle" title="Auto-analyze page context to enhance prompts" checked>
                            <span class="context-status" id="context-status">Active</span>
                        </div>
                    </div>
                    <div class="prompt-area">
                        <label for="prompt-input">Describe what you want the script to do:</label>
                        <textarea id="prompt-input" rows="4" placeholder="Generate a userscript that enhances the user experience..."></textarea>
                        <div class="context-preview" id="context-preview" style="display:none;margin-top:10px;padding:8px;background:#0f172a;border-radius:6px;font-size:11px;color:#94a3b8;max-height:100px;overflow-y:auto"></div>
                    </div>
                    <div class="generator-actions">
                        <button class="btn-primary" id="generate-script-button">Generate Script</button>
                        <button class="btn-secondary hidden" id="cancel-script-button">Cancel</button>
                        <button class="btn-secondary" id="preview-script-button">Preview</button>
                        <button class="btn-secondary" id="save-script-button">Save Script</button>
                        <button class="btn-secondary hidden" id="copy-script-button">Copy</button>
                        <button class="btn-secondary hidden" id="download-script-button">Download</button>
                    </div>
                    <div class="results-area" id="results-area">
                        <div class="validation-results" id="validation-results"></div>
                        <div class="retry-indicator" id="retry-indicator" style="display:none"></div>
                        <div class="script-actions" id="script-actions"></div>
                        <div class="script-output" id="script-output"></div>
                    </div>
                </div>
                <div class="tab-content" id="versions-tab" role="tabpanel">
                    <div class="versions-controls">
                        <div class="control-group">
                            <label for="version-script-select">Select Script:</label>
                            <select id="version-script-select">
                                <option value="">Current script</option>
                            </select>
                        </div>
                        <button class="btn-primary" id="refresh-versions-button">Refresh</button>
                    </div>
                    <div class="versions-list" id="versions-list"></div>
                    <div class="diff-output" id="diff-output" style="display:none"></div>
        </div>
        <div class="tab-content" id="templates-tab" role="tabpanel">
            <div class="templates-container">
                <div class="templates-controls">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
                        <h3 style="margin:0;font-size:16px;color:white">Template Gallery</h3>
                        <button class="btn-primary" id="create-template-btn">+ Create Template</button>
                    </div>
                    <div class="control-group">
                        <input type="text" id="template-search-input" placeholder="Search templates..." class="template-search">
                    </div>
                    <div class="template-categories" id="template-categories">
                        <button class="category-btn active" data-category="all">All</button>
                        <button class="category-btn" data-category="Productivity">Productivity</button>
                        <button class="category-btn" data-category="Security">Security</button>
                        <button class="category-btn" data-category="UI Enhancement">UI Enhancement</button>
                        <button class="category-btn" data-category="Developer Tools">Developer Tools</button>
                    </div>
                </div>
                <div class="templates-grid" id="templates-grid"></div>
            </div>
        </div>
                <div class="tab-content" id="security-tab" role="tabpanel">
                    <div class="security-status">
                        <div class="status-item">
                            <span class="status-label">Authentication</span>
                            <span class="status-value" id="auth-status">Checking...</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">API Key</span>
                            <span class="status-value" id="api-key-status">${state.apiKey ? '•'.repeat(4) : 'Not set'}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Session</span>
                            <span class="status-value" id="session-status">Active</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Streaming</span>
                            <span class="status-value" id="streaming-security-status">Idle</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Retry Count</span>
                            <span class="status-value" id="retry-status">0</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Provider</span>
                            <span class="status-value" id="provider-status">${state.aiProvider}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Module Health</span>
                            <span class="status-value" id="module-health-status">OK</span>
                        </div>
                        <button class="btn-primary" id="test-connection-button" style="margin-top: 15px; width: 100%;">Test Connection</button>
                    </div>
                </div>
            </div>
        </div>`;
    },

    /**
     * Get scripts count
     * @returns {number} Number of scripts
     */
    getScriptsCount() {
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            try { return storage.loadGeneratedScripts().length; }
            catch { return 0; }
        }
        return 0;
    },

    /**
     * Get CSS styles
     * @returns {string} CSS styles
     */
    getStyles() {
        return `.unified-suite-container{position:fixed;top:20px;right:20px;width:400px;max-height:90vh;background:rgba(15,23,42,0.95);border:1px solid #334155;border-radius:12px;padding:20px;color:white;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.3);z-index:99999;backdrop-filter:blur(10px);overflow-y:auto}.suite-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid #334155;padding-bottom:10px}.header-controls{display:flex;align-items:center;gap:10px}.version{font-size:12px;color:#94a3b8}.toggle-btn{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:0;width:20px;height:20px}.toggle-btn:hover{color:white}.suite-tabs{display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid #334155}.tab-btn{padding:8px 16px;border:none;background:rgba(255,255,255,0.05);color:#94a3b8;border-radius:6px 6px 0 0;cursor:pointer;font-size:12px;transition:all 0.2s}.tab-btn.active{background:rgba(255,255,255,0.1);color:white}.tab-btn:hover{background:rgba(255,255,255,0.08)}.tab-content{display:none}.tab-content.active{display:block}.dashboard-stats{display:flex;gap:20px}.stat-item{text-align:center;flex:1}.stat-label{display:block;font-size:12px;color:#94a3b8;margin-bottom:5px}.stat-value{display:block;font-size:20px;font-weight:600;color:white}.control-group{display:flex;flex-direction:column;gap:5px;margin-bottom:15px}.control-group label{font-size:12px;color:#94a3b8}.control-group select,.control-group input{padding:8px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:white;font-size:14px}.prompt-area{margin-bottom:20px}.prompt-area label{display:block;margin-bottom:8px;font-size:12px;color:#94a3b8}.prompt-area textarea{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:white;resize:vertical;min-height:120px;font-size:14px}.generator-actions{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}.btn-primary,.btn-secondary{padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s;font-size:14px}.btn-primary{background:#3b82f6;color:white}.btn-primary:hover:not(:disabled){background:#2563eb}.btn-primary:disabled{opacity:0.6;cursor:not-allowed}.btn-secondary{background:#64748b;color:white}.btn-secondary:hover:not(:disabled){background:#475569}.btn-secondary:disabled{opacity:0.6;cursor:not-allowed}.hidden{display:none!important}.results-area{display:none;border-top:1px solid #334155;padding-top:20px}.validation-results{margin-bottom:15px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:13px}.script-actions{margin-bottom:10px;display:flex;gap:10px}.script-output{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:15px;max-height:300px;overflow-y:auto;font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap;word-break:break-word}.security-status{display:flex;flex-direction:column;gap:15px}.status-item{display:flex;justify-content:space-between;align-items:center;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px}.status-label{font-size:12px;color:#94a3b8}.status-value{font-size:14px;font-weight:600;color:#22c55e}#auth-status.checking{color:#f59e0b}`;
    },

    /**
     * Bind UI event listeners
     * @param {HTMLElement} ui - UI element
     */
    bindUIEvents(ui) {
        const elements = {
            toggleBtn: ui.querySelector('#toggle-ui-btn'),
            tabButtons: ui.querySelectorAll('.tab-btn'),
            tabContents: ui.querySelectorAll('.tab-content'),
            providerSelect: ui.querySelector('#ai-provider-select'),
            apiKeyInput: ui.querySelector('#api-key-input'),
            promptInput: ui.querySelector('#prompt-input'),
            templateSelect: ui.querySelector('#template-select'),
            generateButton: ui.querySelector('#generate-script-button'),
            previewButton: ui.querySelector('#preview-script-button'),
            saveButton: ui.querySelector('#save-script-button'),
            copyButton: ui.querySelector('#copy-script-button'),
            downloadButton: ui.querySelector('#download-script-button'),
            resultsArea: ui.querySelector('#results-area'),
            validationResults: ui.querySelector('#validation-results'),
            scriptActions: ui.querySelector('#script-actions'),
            scriptOutput: ui.querySelector('#script-output'),
            streamingToggle: ui.querySelector('#streaming-toggle'),
            streamingStatus: ui.querySelector('#streaming-status')
        };

        // Toggle UI visibility
        elements.toggleBtn.addEventListener('click', () => {
            ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
        });

        // Tab switching
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                elements.tabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                elements.tabContents.forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                e.target.setAttribute('aria-selected', 'true');
                const tabContent = ui.querySelector(`#${targetTab}-tab`);
                if (tabContent) tabContent.classList.add('active');
            });
        });

        this.bindGeneratorControls(ui, elements);
    },

    /**
     * Bind generator controls
     * @param {HTMLElement} ui - UI element
     * @param {Object} elements - UI elements
     */
    bindGeneratorControls(ui, elements) {
        const storage = window.UnifiedSuite?.storage;
        const providers = window.UnifiedSuite?.providers;
        const versioning = window.UnifiedSuite?.versioning;
        
        // Provider selection
        if (elements.providerSelect) {
            elements.providerSelect.value = state.aiProvider;
            elements.providerSelect.addEventListener('change', () => {
                updateState('aiProvider', elements.providerSelect.value);
            });
        }

        // API key input
        if (elements.apiKeyInput) {
            elements.apiKeyInput.value = state.apiKey;
            elements.apiKeyInput.addEventListener('input', () => {
                updateState('apiKey', elements.apiKeyInput.value.trim());
            });
        }

        // Streaming toggle
        if (elements.streamingToggle) {
            elements.streamingToggle.checked = state.config.enableStreaming;
            elements.streamingToggle.addEventListener('change', () => {
                updateState('config', { ...state.config, enableStreaming: elements.streamingToggle.checked });
            });
        }

        // Generate button
        if (elements.generateButton) {
            elements.generateButton.addEventListener('click', async () => {
                const prompt = elements.promptInput?.value?.trim();
                if (!prompt) {
                    this.showError(elements, 'Describe what you want the script to do first.');
                    return;
                }

                this.setButtonBusy(elements.generateButton, true, 'Generating...');
                const cancelButton = ui.querySelector('#cancel-script-button');
                if (cancelButton) cancelButton.classList.remove('hidden');
                
                this.updateStreamingStatus(elements.streamingStatus, true);
                
                try {
                    let fullText = '';
                    const onChunk = state.config.enableStreaming ? (delta) => {
                        fullText += delta;
                        if (elements.scriptOutput) {
                            elements.scriptOutput.textContent = fullText;
                        }
                    } : null;

                    const result = await providers.generateWithProvider(state.aiProvider, prompt, onChunk);
                    
                    if (result.error) {
                        this.showError(elements, result.error);
                        return;
                    }

                    const validation = storage.validateScript(result.content);
                    const script = {
                        id: generateId(),
                        content: result.content,
                        prompt,
                        provider: state.aiProvider,
                        timestamp: Date.now(),
                        validation,
                        name: deriveScriptName(result.content),
                        filename: generateFilename(result.content)
                    };

                    updateState('currentScript', script);
                    updateState('currentScriptId', script.id);
                    updateState('retryCount', 0);
                    
                    storage.saveGeneratedScript(script, validation, prompt);
                    if (versioning) versioning.saveVersion(script.id, script.content, 'Manual save');
                    
                    this.renderGeneratedScript(script, elements);
                    this.renderStatus(elements, `Generated ${script.filename}`);
                } catch (error) {
                    this.showError(elements, error.message);
                } finally {
                    this.setButtonBusy(elements.generateButton, false, 'Generate Script');
                    if (cancelButton) cancelButton.classList.add('hidden');
                    this.updateStreamingStatus(elements.streamingStatus, false);
                }
            });
        }

        // Save button
        if (elements.saveButton) {
            elements.saveButton.addEventListener('click', () => {
                if (!state.currentScript?.content) {
                    this.showError(elements, 'Generate a script before saving it.');
                    return;
                }
                const record = storage.saveGeneratedScript(state.currentScript, state.currentScript.validation, state.currentScript.prompt);
                if (versioning) versioning.saveVersion(record.id, record.content, 'Manual save');
                this.renderStatus(elements, `Saved ${record.filename}`);
            });
        }

        // Copy button
        if (elements.copyButton) {
            elements.copyButton.addEventListener('click', () => {
                if (!state.currentScript?.content) {
                    this.showError(elements, 'No script to copy.');
                    return;
                }
                GM_setClipboard(state.currentScript.content);
                this.renderStatus(elements, 'Script copied to clipboard');
            });
        }

        // Download button
        if (elements.downloadButton) {
            elements.downloadButton.addEventListener('click', () => {
                if (!state.currentScript?.content) {
                    this.showError(elements, 'No script to download.');
                    return;
                }
                const blob = new Blob([state.currentScript.content], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = state.currentScript.filename || 'script.user.js';
                a.click();
                URL.revokeObjectURL(url);
                this.renderStatus(elements, `Downloaded ${a.download}`);
            });
        }

        // Theme toggle
        const themeBtn = ui.querySelector('#theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const themeModule = window.UnifiedSuite?.theme;
                if (themeModule) {
                    const newTheme = themeModule.toggle();
                    themeBtn.textContent = newTheme === 'dark' ? '🌓' : '☀️';
                }
            });
        }

        // Export button
        const exportBtn = ui.querySelector('#export-scripts-button');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = storage.exportAllScripts();
                GM_setClipboard(data);
                this.renderStatus(elements, 'Exported scripts copied to clipboard');
            });
        }

        // Import input
        const importInput = ui.querySelector('#import-scripts-input');
        if (importInput) {
            importInput.addEventListener('change', async () => {
                const file = importInput.files?.[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const result = storage.importScripts(text);
                    this.renderStatus(elements, `Imported ${result.imported} scripts`);
                } catch (error) {
                    this.showError(elements, error.message);
                } finally {
                    importInput.value = '';
                }
            });
        }

        // Clear history button
        const clearBtn = ui.querySelector('#clear-history-button');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (!confirm('Clear all generated scripts?')) return;
                GM_setValue(CONFIG.STORAGE_KEYS.history, '[]');
                updateState('generatedScripts', []);
                this.renderStatus(elements, 'History cleared');
            });
        }

        // Versions tab
        const versionsTab = ui.querySelector('#versions-tab');
        if (versionsTab) {
            versionsTab.addEventListener('click', () => {
                if (versioning) {
                    versioning.renderVersionsTab(state.currentScriptId);
                }
            });
        }

        // Templates tab
        const templatesTab = ui.querySelector('[data-tab="templates"]');
        if (templatesTab) {
            templatesTab.addEventListener('click', () => {
                this.renderTemplatesTab();
            });
        }

        // Template search
        const templateSearch = ui.querySelector('#template-search-input');
        if (templateSearch) {
            templateSearch.addEventListener('input', (e) => {
                this.filterTemplates(e.target.value);
            });
        }

        // Category filters
        const categoryButtons = ui.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                categoryButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Filter templates
                const category = e.target.dataset.category;
                this.filterTemplatesByCategory(category);
            });
        });

        // Create template button
        const createTemplateBtn = ui.querySelector('#create-template-btn');
        if (createTemplateBtn) {
            createTemplateBtn.addEventListener('click', () => {
                this.showTemplateModal();
            });
        }

        // Context toggle
        const contextToggle = ui.querySelector('#context-toggle');
        const contextPreview = ui.querySelector('#context-preview');
        const promptInput = ui.querySelector('#prompt-input');
        
        if (contextToggle && contextPreview) {
            contextToggle.addEventListener('change', () => {
                const contextModule = window.UnifiedSuite?.context;
                const status = ui.querySelector('#context-status');
                
                if (contextToggle.checked && contextModule?.isAvailable()) {
                    if (status) status.textContent = 'Active';
                    const context = contextModule.analyzePage();
                    if (context.domain) {
                        contextPreview.textContent = `📄 Context: ${context.title || context.domain} (${context.contentType})`;
                        contextPreview.style.display = 'block';
                    }
                } else {
                    if (status) status.textContent = 'Off';
                    contextPreview.style.display = 'none';
                }
            });
            
            // Auto-analyze on load
            setTimeout(() => {
                contextToggle.dispatchEvent(new Event('change'));
            }, 500);
        }

        // Enhance prompt with context when generating
        if (promptInput && elements.generateButton) {
            const originalClick = elements.generateButton._listeners?.click;
            
            // Wrap generate to add context enhancement
            const enhanceGenerate = async () => {
                const contextModule = window.UnifiedSuite?.context;
                const contextToggle = ui.querySelector('#context-toggle');
                
                if (contextToggle?.checked && contextModule?.isAvailable()) {
                    const userPrompt = promptInput.value.trim();
                    if (userPrompt) {
                        const enhanced = contextModule.enhancePrompt(userPrompt);
                        // Only enhance if context was added
                        if (enhanced !== userPrompt) {
                            promptInput.value = enhanced;
                            contextPreview.textContent = `✅ Prompt enhanced with page context from ${window.location.hostname}`;
                            contextPreview.style.display = 'block';
                        }
                    }
                }
            };
            
            // Insert enhancement before existing click handlers
            elements.generateButton.addEventListener('click', enhanceGenerate);
        }
    },

    /**
     * Render generated script
     * @param {Object} script - Script object
     * @param {Object} elements - UI elements
     */
    renderGeneratedScript(script, elements) {
        this.showResults(elements);
        const issues = script.validation?.issues || [];
        const warnings = script.validation?.warnings || [];
        const status = script.validation?.isValid ? 'Valid' : 'Needs review';
        
        if (elements.validationResults) {
            elements.validationResults.textContent = `${status} - Score ${script.validation?.score ?? 0}. ${issues.concat(warnings).join(' ')}`;
            elements.validationResults.style.color = script.validation?.isValid ? '#22c55e' : '#f59e0b';
        }
        
        if (elements.scriptOutput) {
            elements.scriptOutput.textContent = script.content;
        }
        
        if (elements.copyButton && elements.downloadButton && elements.scriptActions) {
            elements.copyButton.classList.remove('hidden');
            elements.downloadButton.classList.remove('hidden');
            elements.scriptActions.style.display = 'flex';
        }
    },

    /**
     * Render status message
     * @param {Object} elements - UI elements
     * @param {string} message - Status message
     */
    renderStatus(elements, message) {
        this.showResults(elements);
        if (elements.validationResults) elements.validationResults.textContent = message;
        if (elements.scriptOutput) elements.scriptOutput.textContent = '';
    },

    /**
     * Show error message
     * @param {Object} elements - UI elements
     * @param {string} message - Error message
     */
    showError(elements, message) {
        this.showResults(elements);
        if (elements.validationResults) {
            elements.validationResults.textContent = `Error: ${message}`;
            elements.validationResults.style.color = '#ef4444';
        }
        if (elements.scriptOutput) elements.scriptOutput.textContent = '';
    },

    /**
     * Show results area
     * @param {Object} elements - UI elements
     */
    showResults(elements) {
        if (elements.resultsArea) elements.resultsArea.style.display = 'block';
    },

    /**
     * Set button busy state
     * @param {HTMLElement} button - Button element
     * @param {boolean} busy - Busy state
     * @param {string} label - Button label
     */
    setButtonBusy(button, busy, label) {
        if (!button) return;
        button.disabled = busy;
        button.textContent = label;
    },

    /**
     * Update streaming status indicator
     * @param {HTMLElement} statusElement - Status element
     * @param {boolean} isStreaming - Streaming state
     */
    updateStreamingStatus(statusElement, isStreaming) {
        if (statusElement) {
            statusElement.textContent = isStreaming ? 'Streaming...' : 'Idle';
        }
    },

    /**
     * Get CSS styles
     * @returns {string} CSS styles
     */
    getTemplateStyles() {
        return `.templates-container{padding:10px 0}.templates-controls{margin-bottom:20px;display:flex;flex-direction:column;gap:15px}.template-search{width:100%;padding:10px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:white;font-size:14px}.template-categories{display:flex;gap:8px;flex-wrap:wrap}.category-btn{padding:6px 12px;border:none;background:rgba(255,255,255,0.05);color:#94a3b8;border-radius:6px;cursor:pointer;font-size:12px;transition:all 0.2s}.category-btn.active{background:#3b82f6;color:white}.category-btn:hover{background:rgba(255,255,255,0.08)}.templates-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px}.template-card{background:rgba(255,255,255,0.05);border:1px solid #334155;border-radius:8px;padding:15px;transition:all 0.2s;cursor:pointer}.template-card:hover{background:rgba(255,255,255,0.08);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.2)}.template-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:8px}.template-name{font-size:14px;font-weight:600;color:white;margin:0;flex:1}.template-category{font-size:10px;padding:2px 8px;background:#3b82f6;color:white;border-radius:12px;white-space:nowrap}.template-description{font-size:12px;color:#94a3b8;margin-bottom:12px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.template-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}.template-tag{font-size:10px;padding:2px 8px;background:rgba(255,255,255,0.1);color:#94a3b8;border-radius:4px}.use-template-btn{width:100%;padding:8px;border:none;background:#3b82f6;color:white;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s}.use-template-btn:hover{background:#2563eb}.no-templates{text-align:center;padding:40px;color:#94a3b8;font-size:14px}`;
    },

    /**
     * Render templates tab content
     */
    renderTemplatesTab() {
        const templatesGrid = document.getElementById('templates-grid');
        if (!templatesGrid) return;

        const templates = window.UnifiedSuite?.templates?.loadTemplates() || [];
        templatesGrid.innerHTML = '';

        if (templates.length === 0) {
            templatesGrid.innerHTML = '<div class="no-templates">No templates available</div>';
            return;
        }

        templates.forEach(template => {
            const card = this.renderTemplateCard(template);
            templatesGrid.appendChild(card);
        });
    },

    /**
     * Render a single template card
     * @param {Object} template - Template object
     * @returns {HTMLElement} Template card element
     */
    renderTemplateCard(template) {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.templateId = template.id;
        
        card.innerHTML = `
            <div class="template-header">
                <h4 class="template-name">${sanitizeText(template.name)}</h4>
                <span class="template-category">${sanitizeText(template.category)}</span>
            </div>
            <p class="template-description">${sanitizeText(template.description)}</p>
            <div class="template-tags">
                ${template.tags.slice(0, 3).map(tag => `<span class="template-tag">${sanitizeText(tag)}</span>`).join('')}
            </div>
            <button class="btn-primary use-template-btn" data-template-id="${template.id}">
                Use Template
            </button>
        `;

        // Add click handler
        const useBtn = card.querySelector('.use-template-btn');
        if (useBtn) {
            useBtn.addEventListener('click', () => {
                this.selectTemplate(template);
            });
        }

        return card;
    },

    /**
     * Select a template and load it into generator
     * @param {Object} template - Template object
     */
    selectTemplate(template) {
        const promptInput = document.getElementById('prompt-input');
        const templateSelect = document.getElementById('template-select');
        
        if (promptInput) {
            promptInput.value = template.prompt;
        }
        
        if (templateSelect) {
            templateSelect.value = template.id;
        }

        // Switch to generator tab
        const generatorTab = document.querySelector('[data-tab="generator"]');
        if (generatorTab) {
            generatorTab.click();
        }

        this.renderStatus({ validationResults: document.querySelector('#validation-results') }, 
            `Loaded template: ${template.name}`);
    },

    /**
     * Filter templates by search query
     * @param {string} query - Search query
     */
    filterTemplates(query) {
        const templatesGrid = document.getElementById('templates-grid');
        if (!templatesGrid) return;

        const cards = templatesGrid.querySelectorAll('.template-card');
        const lowerQuery = sanitizeText(query).toLowerCase();

        cards.forEach(card => {
            const name = card.querySelector('.template-name')?.textContent?.toLowerCase() || '';
            const description = card.querySelector('.template-description')?.textContent?.toLowerCase() || '';
            const tags = Array.from(card.querySelectorAll('.template-tag'))
                .map(tag => tag.textContent.toLowerCase())
                .join(' ');

            const matches = name.includes(lowerQuery) || 
                           description.includes(lowerQuery) || 
                           tags.includes(lowerQuery);

            card.style.display = matches ? 'block' : 'none';
        });
    },

    /**
     * Filter templates by category
     * @param {string} category - Category name
     */
    filterTemplatesByCategory(category) {
        const templatesGrid = document.getElementById('templates-grid');
        if (!templatesGrid) return;

        const cards = templatesGrid.querySelectorAll('.template-card');
        
        cards.forEach(card => {
            const cardCategory = card.querySelector('.template-category')?.textContent || '';
            const matches = category === 'all' || cardCategory === category;
            card.style.display = matches ? 'block' : 'none';
        });
    },

    /**
     * Show template creation/editing modal
     * @param {Object|null} existingTemplate - Template to edit, or null for new
     */
    showTemplateModal(existingTemplate = null) {
        const isEditing = !!existingTemplate;
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'template-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center';
        
        modal.innerHTML = `
            <div style="background:#1e293b;border-radius:12px;padding:25px;width:450px;max-width:90%;border:1px solid #334155;color:white">
                <h3 style="margin:0 0 20px;font-size:18px">${isEditing ? 'Edit Template' : 'Create New Template'}</h3>
                <div style="margin-bottom:15px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Template Name</label>
                    <input type="text" id="modal-template-name" value="${isEditing ? sanitizeText(existingTemplate.name) : ''}" 
                           style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px;box-sizing:border-box">
                </div>
                <div style="margin-bottom:15px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Category</label>
                    <select id="modal-template-category" style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px">
                        <option value="Productivity" ${isEditing && existingTemplate.category === 'Productivity' ? 'selected' : ''}>Productivity</option>
                        <option value="Security" ${isEditing && existingTemplate.category === 'Security' ? 'selected' : ''}>Security</option>
                        <option value="UI Enhancement" ${isEditing && existingTemplate.category === 'UI Enhancement' ? 'selected' : ''}>UI Enhancement</option>
                        <option value="Developer Tools" ${isEditing && existingTemplate.category === 'Developer Tools' ? 'selected' : ''}>Developer Tools</option>
                    </select>
                </div>
                <div style="margin-bottom:15px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Description</label>
                    <textarea id="modal-template-desc" rows="2" 
                              style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px;resize:vertical;box-sizing:border-box">${isEditing ? sanitizeText(existingTemplate.description) : ''}</textarea>
                </div>
                <div style="margin-bottom:20px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Prompt Template</label>
                    <textarea id="modal-template-prompt" rows="4" 
                              style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px;resize:vertical;box-sizing:border-box">${isEditing ? sanitizeText(existingTemplate.prompt) : ''}</textarea>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button id="modal-cancel-btn" style="padding:10px 20px;border:none;background:#64748b;color:white;border-radius:6px;cursor:pointer;font-weight:600">Cancel</button>
                    <button id="modal-save-btn" style="padding:10px 20px;border:none;background:#3b82f6;color:white;border-radius:6px;cursor:pointer;font-weight:600">${isEditing ? 'Update' : 'Create'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Bind modal events
        const nameInput = modal.querySelector('#modal-template-name');
        const categorySelect = modal.querySelector('#modal-template-category');
        const descInput = modal.querySelector('#modal-template-desc');
        const promptInput = modal.querySelector('#modal-template-prompt');
        
        modal.querySelector('#modal-cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#modal-save-btn').addEventListener('click', () => {
            const name = nameInput.value.trim();
            const category = categorySelect.value;
            const description = descInput.value.trim();
            const prompt = promptInput.value.trim();
            
            if (!name) { alert('Please enter a template name'); return; }
            if (!prompt) { alert('Please enter a prompt template'); return; }
            
            const templates = window.UnifiedSuite?.templates;
            if (!templates) { alert('Templates module not loaded'); return; }
            
            try {
                if (isEditing) {
                    // Update existing - delete and recreate
                    templates.deleteTemplate(existingTemplate.id);
                    templates.saveTemplate({ name, category, description, prompt, tags: [] });
                } else {
                    templates.saveTemplate({ name, category, description, prompt, tags: [] });
                }
                modal.remove();
                this.renderTemplatesTab();
            } catch (error) {
                alert('Failed to save template: ' + error.message);
            }
        });

        // Focus name input
        setTimeout(() => nameInput?.focus(), 100);
    },

    /**
     * Export templates as JSON string
     * @returns {string} JSON export
     */
    exportTemplatesJSON() {
        const templates = window.UnifiedSuite?.templates;
        if (!templates) return '[]';
        return templates.exportTemplates();
    },

    /**
     * Import templates from JSON string
     * @param {string} jsonData - JSON data
     * @returns {{imported: number}} Import result
     */
    importTemplatesJSON(jsonData) {
        const templates = window.UnifiedSuite?.templates;
        if (!templates) return { imported: 0 };
        return templates.importTemplates(jsonData);
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.ui = UIModule;
}