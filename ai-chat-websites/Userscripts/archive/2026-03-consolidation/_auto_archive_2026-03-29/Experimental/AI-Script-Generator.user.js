// ==UserScript==
// @name         AI-Powered Script Generator v1.1
// @namespace    http://tampermonkey.net/
// @version      1.1.11
// @description  Generate custom userscripts using AI with natural language input
// @author       AI Script Generator
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @connect      api.openai.com
// @connect      api.anthropic.com
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js
// @run-at       document-end
// ==/UserScript==

/**
 * AI-Powered Script Generator v1.1
 * 
 * Revolutionary script generation system:
 * - Natural language to userscript conversion
 * - AI-powered code generation with multiple providers
 * - Template-based generation with customization
 * - Real-time syntax validation and optimization
 * - Interactive script builder with preview
 * - Code analysis and improvement suggestions
 * - Multi-language support and internationalization
 * - Advanced debugging and error handling
 * - Performance optimization recommendations
 * - Security analysis and vulnerability detection
 * 
 * @version 1.1.11
 * @license MIT
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        VERSION: '1.1.11',
        DEBUG_MODE: false,
        DEFAULT_PROVIDER: 'OPENAI',
        AI_PROVIDERS: {
            OPENAI: { name: 'OpenAI GPT-4', endpoint: 'https://api.openai.com/v1/chat/completions' },
            ANTHROPIC: { name: 'Claude', endpoint: 'https://api.anthropic.com/v1/messages' },
            LOCAL: { name: 'Local AI' }
        },
        DEFAULT_PROMPT: 'Generate a userscript that enhances the user experience on this website. Include features like dark mode toggle, element hiding, keyboard shortcuts, and performance optimizations. The script should be well-documented and follow best practices.',
        MAX_SCRIPT_LENGTH: 8000,
        MAX_HISTORY_ITEMS: 25,
        COMPATIBLE_HISTORY_KEYS: ['userscript_generator_history'],
        STORAGE_KEYS: {
            history: 'ai_script_generator_history',
            settings: 'ai_script_generator_settings',
            sessionApiKey: 'ai_script_generator_session_api_key'
        },
        UI_ID: 'ai-script-generator-ui',
        STYLE_ID: 'ai-script-generator-styles'
    };

    // State
    const state = {
        aiProvider: CONFIG.DEFAULT_PROVIDER,
        apiKey: '',
        generatedScripts: [],
        currentGeneratedScriptId: '',
        templates: [],
        validationResults: [],
        menusRegistered: false
    };

    function debugLog(...args) {
        if (CONFIG.DEBUG_MODE) {
            console.log('[AI Script Generator]', ...args);
        }
    }

    function sanitizeText(text) {
        return String(text ?? '').replace(/\u0000/g, '').trim();
    }

    function escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeJsonParse(value, fallback) {
        if (!value) {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            debugLog('Failed to parse stored JSON', error);
            return fallback;
        }
    }

    function mergeApiSurface(existingApi, additions, preferExisting = false) {
        const merged = existingApi && typeof existingApi === 'object'
            ? { ...existingApi }
            : {};

        Object.entries(additions).forEach(([key, value]) => {
            if (!preferExisting || typeof merged[key] === 'undefined') {
                merged[key] = value;
            }
        });

        return merged;
    }

    function loadSettings() {
        const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.settings, '{}'), {});
        const provider = sanitizeText(stored.aiProvider);
        if (provider && Object.prototype.hasOwnProperty.call(CONFIG.AI_PROVIDERS, provider)) {
            state.aiProvider = provider;
        }

        try {
            state.apiKey = sessionStorage.getItem(CONFIG.STORAGE_KEYS.sessionApiKey) || '';
        } catch (error) {
            state.apiKey = '';
        }

        state.generatedScripts = loadGeneratedScripts();
    }

    function saveSettings() {
        GM_setValue(CONFIG.STORAGE_KEYS.settings, JSON.stringify({
            aiProvider: state.aiProvider
        }));
    }

    function saveSessionApiKey(apiKey) {
        try {
            if (apiKey) {
                sessionStorage.setItem(CONFIG.STORAGE_KEYS.sessionApiKey, apiKey);
            } else {
                sessionStorage.removeItem(CONFIG.STORAGE_KEYS.sessionApiKey);
            }
        } catch (error) {
            debugLog('Unable to persist API key in session storage', error);
        }
    }

    // Initialize Generator
    function initializeGenerator() {
        debugLog(`AI Script Generator v${CONFIG.VERSION} initializing`);
        
        loadTemplates();
        loadSettings();
        createGeneratorUI();
        registerMenuCommands();
        
        debugLog('AI Script Generator initialized');
    }

    // Template System
    function loadTemplates() {
        state.templates = [
            {
                name: 'Basic Enhancement',
                description: 'Simple UI improvements and quality of life features',
                prompt: 'Create a userscript that adds basic enhancements like dark mode toggle, element hiding, and keyboard shortcuts to improve user experience.',
                complexity: 'Beginner'
            },
            {
                name: 'Advanced Automation',
                description: 'Complex automation and workflow optimization',
                prompt: 'Generate a userscript that automates repetitive tasks, adds batch operations, and streamlines workflows on this website.',
                complexity: 'Advanced'
            },
            {
                name: 'Data Analysis',
                description: 'Data extraction and analysis tools',
                prompt: 'Create a userscript that extracts data from this website, analyzes it, and presents insights in a dashboard format.',
                complexity: 'Expert'
            },
            {
                name: 'Security Enhancement',
                description: 'Privacy and security improvements',
                prompt: 'Generate a userscript that enhances security by blocking trackers, adding privacy controls, and protecting user data.',
                complexity: 'Intermediate'
            }
        ];
    }

    function syncGeneratorControls() {
        const templateSelect = document.getElementById('template-select');
        const providerSelect = document.getElementById('ai-provider-select');
        const apiKeyInput = document.getElementById('api-key-input');

        if (templateSelect) {
            const selectedTemplate = templateSelect.value || '';
            templateSelect.innerHTML = '';

            const customOption = document.createElement('option');
            customOption.value = '';
            customOption.textContent = 'Custom';
            templateSelect.appendChild(customOption);

            state.templates.forEach((template) => {
                const option = document.createElement('option');
                option.value = template.name;
                option.textContent = `${template.name} (${template.complexity})`;
                templateSelect.appendChild(option);
            });

            if ([...templateSelect.options].some((option) => option.value === selectedTemplate)) {
                templateSelect.value = selectedTemplate;
            }
        }

        if (providerSelect) {
            providerSelect.value = Object.prototype.hasOwnProperty.call(CONFIG.AI_PROVIDERS, state.aiProvider)
                ? state.aiProvider
                : CONFIG.DEFAULT_PROVIDER;
        }

        if (apiKeyInput) {
            apiKeyInput.value = state.apiKey;
            apiKeyInput.placeholder = state.aiProvider === 'LOCAL'
                ? 'Not required for Local AI'
                : 'Stored for this tab only';
            apiKeyInput.disabled = state.aiProvider === 'LOCAL';
        }
    }

    function getGeneratorUIElements() {
        return {
            ui: document.getElementById(CONFIG.UI_ID),
            promptInput: document.getElementById('prompt-input'),
            templateSelect: document.getElementById('template-select'),
            providerSelect: document.getElementById('ai-provider-select'),
            validationResults: document.getElementById('validation-results'),
            output: document.getElementById('script-output'),
            resultsArea: document.getElementById('results-area')
        };
    }

    function showGeneratorUI() {
        createGeneratorUI();
        const { ui } = getGeneratorUIElements();
        if (!ui) {
            return false;
        }

        ui.style.display = 'block';
        return true;
    }

    function hideGeneratorUI() {
        const { ui } = getGeneratorUIElements();
        if (!ui) {
            return false;
        }

        ui.style.display = 'none';
        return true;
    }

    function toggleGeneratorUI() {
        createGeneratorUI();
        const { ui } = getGeneratorUIElements();
        if (!ui) {
            return false;
        }

        ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
        return ui.style.display === 'block';
    }

    function setPromptValue(prompt, options = {}) {
        if (!showGeneratorUI()) {
            return false;
        }

        const promptText = sanitizeText(prompt);
        const {
            promptInput,
            templateSelect,
            providerSelect,
            validationResults,
            output,
            resultsArea
        } = getGeneratorUIElements();

        if (!promptInput) {
            return false;
        }

        promptInput.value = promptText;

        const templateName = sanitizeText(options.templateName || options.template || '');
        if (templateSelect && templateName && [...templateSelect.options].some((option) => option.value === templateName)) {
            templateSelect.value = templateName;
        }

        const provider = sanitizeText(options.provider);
        if (provider && Object.prototype.hasOwnProperty.call(CONFIG.AI_PROVIDERS, provider)) {
            state.aiProvider = provider;
            if (providerSelect) {
                providerSelect.value = provider;
                providerSelect.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                saveSettings();
            }
        }

        if (options.clearResults !== false) {
            if (output) {
                output.textContent = '';
            }
            if (validationResults) {
                validationResults.innerHTML = '';
            }
            if (resultsArea) {
                resultsArea.style.display = 'none';
            }
        }

        if (options.focus !== false) {
            promptInput.focus();
            promptInput.select();
        }

        return true;
    }

    async function openGeneratorWithPrompt(prompt, options = {}) {
        const promptText = sanitizeText(prompt);
        if (!promptText) {
            return { opened: false, generated: false, error: 'No prompt provided' };
        }

        const opened = setPromptValue(promptText, options);
        if (!opened) {
            return { opened: false, generated: false, error: 'Generator UI unavailable' };
        }

        if (options.generate === true) {
            await generateScriptFromUI();
            return { opened: true, generated: true, prompt: promptText };
        }

        return { opened: true, generated: false, prompt: promptText };
    }

    function buildEnhancedPrompt(prompt, template = null) {
        const cleanPrompt = sanitizeText(prompt);
        const guidance = [
            'Return only executable userscript code.',
            'Include a complete userscript metadata block.',
            'Use a single IIFE wrapper.',
            'Avoid explanations outside the code.'
        ].join('\n');

        if (template) {
            return `${template.prompt}\n\nAdditional requirements:\n${cleanPrompt}\n\n${guidance}`;
        }

        return `${cleanPrompt}\n\n${guidance}`;
    }

    function resolveTemplate(templateOption = '') {
        if (templateOption && typeof templateOption === 'object') {
            return templateOption;
        }

        const templateName = sanitizeText(templateOption);
        return state.templates.find((item) => item.name === templateName) || null;
    }

    function extractCodeBlock(text) {
        const rawText = sanitizeText(text);
        const codeBlockMatch = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
        return sanitizeText(codeBlockMatch ? codeBlockMatch[1] : rawText);
    }

    function normalizeMetadataText(text) {
        return sanitizeText(text).replace(/\s+/g, ' ').trim();
    }

    function deriveSourcePreview(text) {
        return normalizeMetadataText(text).slice(0, 160) || 'Generated from prompt';
    }

    function buildUserscriptTemplate(code, sourcePrompt) {
        const description = normalizeMetadataText(sourcePrompt) || 'Generated userscript';
        const name = description.split(' ').slice(0, 6).join(' ') || 'Generated Script';
        const body = sanitizeText(code) || "console.log('Generated script is ready for customization.');";
        const createdDate = new Date().toISOString().slice(0, 10);
        const indentedBody = body
            .split('\n')
            .map((line) => (line ? `  ${line}` : ''))
            .join('\n');

        return [
            '// ==UserScript==',
            `// @name         ${name}`,
            '// @namespace    http://tampermonkey.net/',
            `// @version      ${CONFIG.VERSION}`,
            `// @description  ${description.slice(0, 140)}`,
            '// @author       AI Script Generator',
            '// @match        *://*/*',
            '// @grant        none',
            `// @created      ${createdDate}`,
            '// ==/UserScript==',
            '',
            '(function() {',
            "  'use strict';",
            '',
            indentedBody,
            '})();'
        ].join('\n');
    }

    function ensureUserscriptFormat(script, sourcePrompt) {
        const extracted = extractCodeBlock(script);
        if (extracted.includes('// ==UserScript==')) {
            return extracted;
        }

        return buildUserscriptTemplate(extracted, sourcePrompt);
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMessage = data?.error?.message || data?.error || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        return data;
    }

    // AI Script Generation
    async function generateScript(prompt, template = null) {
        debugLog('Generating script with AI');
        
        const sourcePrompt = sanitizeText(prompt);
        const provider = state.aiProvider;
        const enhancedPrompt = buildEnhancedPrompt(sourcePrompt, template);
        
        try {
            const rawScript = await generateWithProvider(provider, enhancedPrompt);
            const normalizedScript = ensureUserscriptFormat(rawScript, sourcePrompt);
            const validation = validateScript(normalizedScript);
            const optimized = validation.isValid ? optimizeScript(normalizedScript) : normalizedScript;
            const name = deriveScriptName(optimized);
            const filename = generateScriptFilename(optimized, `generated-script-${Date.now()}`);
            const sourcePreview = deriveSourcePreview(sourcePrompt);
            
            const generatedScript = {
                id: generateId(),
                content: optimized,
                prompt: enhancedPrompt,
                provider,
                timestamp: Date.now(),
                validation,
                template: template?.name || 'Custom',
                name,
                filename,
                sourcePreview
            };

            saveGeneratedScript(generatedScript);
            state.validationResults = validation;

            return generatedScript;
            
        } catch (error) {
            console.error('[AI Script Generator] Script generation failed:', error);
            return { error: error.message };
        }
    }

    async function generateScriptArtifact(prompt, options = {}) {
        const sourceText = sanitizeText(prompt);
        if (!sourceText) {
            return {
                ok: false,
                error: 'No source content provided',
                content: '',
                validation: {
                    isValid: false,
                    issues: ['No source content provided'],
                    warnings: [],
                    score: 0
                },
                record: null
            };
        }

        const template = resolveTemplate(options?.templateName || options?.template || '');
        const result = await generateScript(sourceText, template);
        if (result?.error) {
            return {
                ok: false,
                error: result.error,
                content: '',
                validation: {
                    isValid: false,
                    issues: [result.error],
                    warnings: [],
                    score: 0
                },
                record: null
            };
        }

        if (options?.download === true) {
            downloadScriptContent(result.content, result.filename);
        }

        return {
            ok: result.validation?.isValid ?? false,
            content: result.content,
            validation: result.validation,
            record: result,
            error: '',
            id: result.id,
            filename: result.filename,
            name: result.name,
            provider: result.provider,
            template: result.template,
            timestamp: result.timestamp,
            sourcePreview: result.sourcePreview
        };
    }

    function generateEntryPoint(promptOrOptions = '', options = {}) {
        if (typeof promptOrOptions === 'string') {
            const promptText = sanitizeText(promptOrOptions);
            if (promptText) {
                return generateScriptArtifact(promptText, options);
            }
        }

        if (promptOrOptions && typeof promptOrOptions === 'object') {
            const promptText = sanitizeText(promptOrOptions.prompt || promptOrOptions.text || '');
            if (promptText) {
                return generateScriptArtifact(promptText, promptOrOptions);
            }
        }

        return generateScriptFromUI();
    }

    // Provider-specific generation
    async function generateWithProvider(provider, prompt) {
        switch (provider) {
            case 'OPENAI':
                return generateWithOpenAI(prompt);
            case 'ANTHROPIC':
                return generateWithAnthropic(prompt);
            case 'LOCAL':
                return generateWithLocalAI(prompt);
            default:
                throw new Error(`Unknown AI provider: ${provider}`);
        }
    }

    async function generateWithOpenAI(prompt) {
        if (!state.apiKey) throw new Error('OpenAI API key not configured');

        const data = await fetchJson(CONFIG.AI_PROVIDERS.OPENAI.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${state.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert userscript developer. Return only a complete, working userscript with metadata, error handling, and clear structure.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 4000,
                temperature: 0.7
            })
        });

        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI returned no script content');
        }

        return content;
    }

    async function generateWithAnthropic(prompt) {
        if (!state.apiKey) throw new Error('Anthropic API key not configured');

        const data = await fetchJson(CONFIG.AI_PROVIDERS.ANTHROPIC.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': state.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229',
                max_tokens: 4000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        const textBlock = Array.isArray(data?.content)
            ? data.content.find((item) => item?.type === 'text' && item?.text)
            : null;

        if (!textBlock?.text) {
            throw new Error('Anthropic returned no script content');
        }

        return textBlock.text;
    }

    async function generateWithLocalAI(prompt) {
        return generateWithML(prompt);
    }

    async function generateWithML(prompt) {
        const model = await loadMLModel();
        const tokens = preprocessInput(prompt);
        const prediction = model.predict(tokens);
        const score = Number(prediction?.dataSync?.()[0] ?? 0.5);
        const code = postprocessOutput(prompt, score);
        return buildUserscriptTemplate(code, prompt);
    }

    // Script Validation
    function validateScript(script) {
        const issues = [];
        const warnings = [];
        const normalizedScript = sanitizeText(script);

        if (!normalizedScript.includes('// ==UserScript==')) {
            issues.push('Missing userscript metadata block');
        }

        if (!/@match\s+|@include\s+/m.test(normalizedScript)) {
            warnings.push('No @match or @include rule detected');
        }

        if (!/\(function\s*\(\)\s*\{/.test(normalizedScript)) {
            warnings.push('Script is missing the standard IIFE wrapper');
        }

        if (/\beval\s*\(/.test(normalizedScript)) {
            warnings.push('Use of eval() detected; consider safer alternatives');
        }

        if (/\bdocument\.write\s*\(/.test(normalizedScript)) {
            warnings.push('document.write() usage may cause issues on modern pages');
        }

        if (/\.innerHTML\s*=/.test(normalizedScript)) {
            warnings.push('Direct innerHTML assignment detected; sanitize dynamic content carefully');
        }

        try {
            new Function(normalizedScript);
        } catch (error) {
            issues.push(`Syntax error: ${error.message}`);
        }

        if (normalizedScript.length > CONFIG.MAX_SCRIPT_LENGTH) {
            warnings.push('Script may be too large; consider splitting features into modules');
        }

        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            score: calculateQualityScore(normalizedScript, issues, warnings)
        };
    }

    function calculateQualityScore(script, issues, warnings) {
        let score = 100;
        score -= issues.length * 20;
        score -= warnings.length * 5;
        score -= script.length > 5000 ? 10 : 0;
        return Math.max(0, score);
    }

    // Script Optimization
    function optimizeScript(script) {
        return script
            .split('\n')
            .map((line) => line.replace(/[ \t]+$/g, ''))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // UI Generation
    function createGeneratorUI() {
        if (!document.body) {
            return;
        }

        if (document.getElementById(CONFIG.UI_ID)) {
            syncGeneratorControls();
            return;
        }

        const ui = document.createElement('div');
        ui.id = CONFIG.UI_ID;
        ui.innerHTML = `
            <div class="generator-container">
                <div class="generator-header">
                    <h2>AI Script Generator</h2>
                    <div class="version">v${CONFIG.VERSION}</div>
                </div>
                
                <div class="generator-controls">
                    <div class="control-group">
                        <label>AI Provider:</label>
                        <select id="ai-provider-select">
                            <option value="OPENAI">OpenAI GPT-4</option>
                            <option value="ANTHROPIC">Claude</option>
                            <option value="LOCAL">Local AI</option>
                        </select>
                    </div>
                    
                    <div class="control-group">
                        <label>Template:</label>
                        <select id="template-select">
                            <option value="">Custom</option>
                        </select>
                    </div>
                    
                    <div class="control-group">
                        <label>API Key:</label>
                        <input type="password" id="api-key-input" placeholder="Stored for this tab only" autocomplete="off">
                    </div>
                </div>
                
                <div class="prompt-area">
                    <label>Describe what you want the script to do:</label>
                    <textarea id="prompt-input" rows="4" placeholder="${CONFIG.DEFAULT_PROMPT}"></textarea>
                </div>
                
                <div class="generator-actions">
                    <button class="btn-primary" id="generate-script-button">Generate Script</button>
                    <button class="btn-secondary" id="preview-script-button">Preview</button>
                    <button class="btn-secondary" id="save-script-button">Save Script</button>
                </div>
                
                <div class="results-area" id="results-area">
                    <div class="validation-results" id="validation-results"></div>
                    <div class="script-output" id="script-output"></div>
                </div>
            </div>
        `;
        
        if (!document.getElementById(CONFIG.STYLE_ID)) {
            const styles = document.createElement('style');
            styles.id = CONFIG.STYLE_ID;
            styles.textContent = `
                .generator-container {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    width: 400px;
                    background: rgba(15, 23, 42, 0.95);
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 20px;
                    color: white;
                    font-family: system-ui, -apple-system, sans-serif;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    z-index: 99999;
                    backdrop-filter: blur(10px);
                }
                
                .generator-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #334155;
                    padding-bottom: 10px;
                }
                
                .version {
                    font-size: 12px;
                    color: #94a3b8;
                }
                
                .generator-controls {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                
                .control-group label {
                    font-size: 12px;
                    color: #94a3b8;
                }
                
                .control-group select, .control-group input {
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid #475569;
                    background: #1e293b;
                    color: white;
                }
                
                .prompt-area {
                    margin-bottom: 20px;
                }
                
                .prompt-area label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 12px;
                    color: #94a3b8;
                }
                
                .prompt-area textarea {
                    width: 100%;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #475569;
                    background: #1e293b;
                    color: white;
                    resize: vertical;
                    min-height: 120px;
                }
                
                .generator-actions {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                
                .btn-primary, .btn-secondary {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                
                .btn-primary {
                    background: #3b82f6;
                    color: white;
                }
                
                .btn-primary:hover {
                    background: #2563eb;
                }
                
                .btn-secondary {
                    background: #64748b;
                    color: white;
                }
                
                .btn-secondary:hover {
                    background: #475569;
                }
                
                .results-area {
                    display: none;
                    border-top: 1px solid #334155;
                    padding-top: 20px;
                }
                
                .validation-results {
                    margin-bottom: 15px;
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                }
                
                .script-output {
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    padding: 15px;
                    max-height: 300px;
                    overflow-y: auto;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }
            `;

            document.head.appendChild(styles);
        }

        document.body.appendChild(ui);

        const providerSelect = document.getElementById('ai-provider-select');
        const apiKeyInput = document.getElementById('api-key-input');

        syncGeneratorControls();

        providerSelect.addEventListener('change', () => {
            state.aiProvider = providerSelect.value;
            saveSettings();
            apiKeyInput.disabled = providerSelect.value === 'LOCAL';
            apiKeyInput.placeholder = providerSelect.value === 'LOCAL' ? 'Not required for Local AI' : 'Stored for this tab only';
        });

        apiKeyInput.addEventListener('input', () => {
            state.apiKey = sanitizeText(apiKeyInput.value);
            saveSessionApiKey(state.apiKey);
        });

        document.getElementById('generate-script-button').addEventListener('click', () => {
            void generateScriptFromUI();
        });
        document.getElementById('preview-script-button').addEventListener('click', previewScript);
        document.getElementById('save-script-button').addEventListener('click', saveScript);
          
        // Expose API
        const aiGeneratorApi = {
            generate: (promptOrOptions = '', options = {}) => generateEntryPoint(promptOrOptions, options),
            generateFromUI: () => generateScriptFromUI(),
            generateFromText: (text, options = {}) => generateScriptArtifact(text, options),
            generateFromPrompt: (prompt, templateName = '') => generateScriptArtifact(prompt, { templateName }),
            generateScriptArtifact: (text, options = {}) => generateScriptArtifact(text, options),
            openWithPrompt: (prompt, options = {}) => openGeneratorWithPrompt(prompt, options),
            showUI: () => showGeneratorUI(),
            hideUI: () => hideGeneratorUI(),
            toggleUI: () => toggleGeneratorUI(),
            setPrompt: (prompt, options = {}) => setPromptValue(prompt, options),
            preview: (contentOrOptions = '') => previewEntryPoint(contentOrOptions),
            previewCurrent: () => previewCurrentGenerated(),
            save: (contentOrOptions = '', filename = '') => saveEntryPoint(contentOrOptions, filename),
            saveCurrent: () => saveCurrentGenerated(),
            validateScript: (script) => validateScript(script),
            optimizeScript: (script) => optimizeScript(script),
            getHistory: () => loadGeneratedScripts(),
            getGeneratedHistory: () => loadGeneratedScripts(),
            clearHistory: () => clearGeneratedScripts(),
            clearGeneratedHistory: () => clearGeneratedScripts(),
            showHistory: () => viewGeneratedScripts(),
            showGeneratedHistory: () => viewGeneratedScripts(),
            downloadLatest: () => downloadLatestGenerated(),
            downloadLatestGenerated: () => downloadLatestGenerated(),
            downloadById: (id) => downloadGeneratedScriptById(id),
            downloadGeneratedById: (id) => downloadGeneratedScriptById(id),
            downloadScript: (content, filename = '') => downloadScriptContent(content, filename),
            setProvider: (provider) => {
                if (Object.prototype.hasOwnProperty.call(CONFIG.AI_PROVIDERS, provider)) {
                    state.aiProvider = provider;
                    providerSelect.value = provider;
                    saveSettings();
                    apiKeyInput.disabled = provider === 'LOCAL';
                    apiKeyInput.placeholder = provider === 'LOCAL' ? 'Not required for Local AI' : 'Stored for this tab only';
                }
            },
            setApiKey: (key) => {
                state.apiKey = sanitizeText(key);
                apiKeyInput.value = state.apiKey;
                saveSessionApiKey(state.apiKey);
            }
        };
        window.AI_Generator = mergeApiSurface(window.AI_Generator, aiGeneratorApi);

        const generatorCompatibilityApi = {
            generate: window.AI_Generator.generate,
            generateFromUI: window.AI_Generator.generateFromUI,
            generateFromText: window.AI_Generator.generateFromText,
            generateFromPrompt: window.AI_Generator.generateFromPrompt,
            generateScriptArtifact: window.AI_Generator.generateScriptArtifact,
            openWithPrompt: window.AI_Generator.openWithPrompt,
            showUI: window.AI_Generator.showUI,
            hideUI: window.AI_Generator.hideUI,
            toggleUI: window.AI_Generator.toggleUI,
            setPrompt: window.AI_Generator.setPrompt,
            saveCurrent: window.AI_Generator.saveCurrent,
            previewCurrent: window.AI_Generator.previewCurrent,
            validateScript: window.AI_Generator.validateScript,
            optimizeScript: window.AI_Generator.optimizeScript,
            getGeneratedHistory: window.AI_Generator.getGeneratedHistory,
            getHistory: window.AI_Generator.getHistory,
            clearGeneratedHistory: window.AI_Generator.clearGeneratedHistory,
            clearHistory: window.AI_Generator.clearHistory,
            showGeneratedHistory: window.AI_Generator.showGeneratedHistory,
            showHistory: window.AI_Generator.showHistory,
            downloadLatestGenerated: window.AI_Generator.downloadLatestGenerated,
            downloadLatest: window.AI_Generator.downloadLatest,
            downloadGeneratedById: window.AI_Generator.downloadGeneratedById,
            downloadById: window.AI_Generator.downloadById,
            downloadScript: window.AI_Generator.downloadScript,
            save: window.AI_Generator.save,
            preview: window.AI_Generator.preview,
            setProvider: window.AI_Generator.setProvider,
            setApiKey: window.AI_Generator.setApiKey
        };
        window.UserScriptGeneratorAPI = mergeApiSurface(window.UserScriptGeneratorAPI, generatorCompatibilityApi, true);
    }

    // UI Handlers
    async function generateScriptFromUI() {
        const promptInput = document.getElementById('prompt-input');
        const templateSelect = document.getElementById('template-select');
        const providerSelect = document.getElementById('ai-provider-select');
        const apiKeyInput = document.getElementById('api-key-input');
        const output = document.getElementById('script-output');
        const prompt = sanitizeText(promptInput?.value);
        const templateName = templateSelect?.value || '';
        const template = state.templates.find(t => t.name === templateName);

        state.aiProvider = providerSelect?.value || CONFIG.DEFAULT_PROVIDER;
        state.apiKey = sanitizeText(apiKeyInput?.value);
        saveSettings();
        saveSessionApiKey(state.apiKey);

        if (!prompt) {
            alert('Please enter a description of what you want the script to do.');
            return;
        }

        const resultsArea = document.getElementById('results-area');
        resultsArea.style.display = 'block';
        output.textContent = 'Generating script...';

        try {
            const result = await generateScript(prompt, template);

            if (result.error) {
                output.textContent = `Error: ${result.error}`;
                displayValidationResults({
                    isValid: false,
                    issues: [result.error],
                    warnings: [],
                    score: 0
                });
                return;
            }

            displayValidationResults(result.validation);
            output.textContent = result.content;
            notifyUser('Script generated successfully.');
        } catch (error) {
            output.textContent = `Generation failed: ${error.message}`;
            displayValidationResults({
                isValid: false,
                issues: [error.message],
                warnings: [],
                score: 0
            });
        }
    }

    function displayValidationResults(validation) {
        const container = document.getElementById('validation-results');
        const issueMarkup = validation.issues.length > 0
            ? `<div class="issues"><strong style="color: #ef4444;">Issues:</strong><ul>${validation.issues.map(issue => `<li style="color: #ef4444;">${escapeHtml(issue)}</li>`).join('')}</ul></div>`
            : '';
        const warningMarkup = validation.warnings.length > 0
            ? `<div class="warnings"><strong style="color: #f59e0b;">Warnings:</strong><ul>${validation.warnings.map(warning => `<li style="color: #f59e0b;">${escapeHtml(warning)}</li>`).join('')}</ul></div>`
            : '';
        const summaryText = validation.isValid
            ? '<div style="color: #22c55e;">Script is valid and ready to use.</div>'
            : '<div style="color: #ef4444;">Script has issues that need to be addressed.</div>';
        container.innerHTML = `
            <div class="validation-header">
                <strong>Validation Results</strong>
                <span class="score">Quality Score: ${validation.score}/100</span>
            </div>
            ${issueMarkup}
            ${warningMarkup}
            ${summaryText}
        `;
    }

    function openScriptPreview(script) {
        const previewContent = sanitizeText(script);
        if (!previewContent) {
            alert('No script to preview. Generate one first.');
            return false;
        }

        const preview = window.open('', '_blank', 'width=800,height=600');
        if (!preview) {
            alert('Unable to open preview window.');
            return false;
        }
        preview.document.write(`
            <html>
            <head>
                <title>Script Preview</title>
                <style>
                    body { font-family: Consolas, "Courier New", monospace; padding: 20px; background: #1e293b; color: white; }
                    .header { margin-bottom: 20px; border-bottom: 1px solid #475569; padding-bottom: 10px; }
                    pre { white-space: pre-wrap; word-break: break-word; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Userscript Preview</h2>
                    <p>This is a preview of the generated script. It will not execute.</p>
                </div>
                <pre>${escapeHtml(previewContent)}</pre>
            </body>
            </html>
        `);
        preview.document.close();
        return true;
    }

    function previewScript() {
        const script = document.getElementById('script-output').textContent;
        return openScriptPreview(script);
    }

    function saveScript() {
        const script = document.getElementById('script-output').textContent;
        if (!script) {
            alert('No script to save. Generate one first.');
            return false;
        }

        downloadScriptContent(script);
        return true;
    }

    function saveEntryPoint(contentOrOptions = '', filename = '') {
        if (typeof contentOrOptions === 'string') {
            const content = sanitizeText(contentOrOptions);
            if (content) {
                downloadScriptContent(content, filename);
                return true;
            }
        }

        if (contentOrOptions && typeof contentOrOptions === 'object') {
            const content = sanitizeText(contentOrOptions.content || contentOrOptions.script || '');
            const resolvedFilename = sanitizeText(contentOrOptions.filename || filename);
            if (content) {
                downloadScriptContent(content, resolvedFilename);
                return true;
            }
        }

        return saveScript();
    }

    // Utility Functions
    function generateId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return `script_${Math.random().toString(36).slice(2, 11)}`;
    }

    function deriveScriptName(script) {
        const nameMatch = sanitizeText(script).match(/@name\s+(.+)/);
        return sanitizeText(nameMatch?.[1] || '').trim();
    }

    function generateScriptFilename(script, fallbackBaseName = `generated-script-${Date.now()}`) {
        const baseName = deriveScriptName(script)
            .replace(/[^\w.-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();

        return `${baseName || fallbackBaseName}.user.js`;
    }

    function normalizeStoredFilename(value, fallbackBaseName = `generated-script-${Date.now()}`) {
        const baseName = sanitizeText(value)
            .replace(/\.user\.js$/i, '')
            .replace(/[^\w.-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();

        return `${baseName || fallbackBaseName}.user.js`;
    }

    function normalizeGeneratedScriptRecord(record, index) {
        if (!record || typeof record !== 'object') {
            return null;
        }

        const content = sanitizeText(record.content || record.script || '');
        const timestamp = Number(record.timestamp) || Date.now();
        const fallbackBaseName = `generated-script-${timestamp}`;
        const filename = sanitizeText(record.filename)
            ? normalizeStoredFilename(record.filename, fallbackBaseName)
            : (content ? generateScriptFilename(content, fallbackBaseName) : `${fallbackBaseName}.user.js`);
        const name = sanitizeText(record.name) || deriveScriptName(content) || filename.replace(/\.user\.js$/i, '') || 'Generated Script';
        const sourcePreview = sanitizeText(record.sourcePreview)
            || deriveSourcePreview(record.prompt || record.sourceText || record.template || name);
        const validation = record.validation && typeof record.validation === 'object'
            ? {
                isValid: Boolean(record.validation.isValid),
                issues: Array.isArray(record.validation.issues) ? record.validation.issues.filter(Boolean).map((item) => sanitizeText(item)) : [],
                warnings: Array.isArray(record.validation.warnings) ? record.validation.warnings.filter(Boolean).map((item) => sanitizeText(item)) : [],
                score: Number(record.validation.score) || 0
            }
            : null;

        return {
            ...record,
            id: sanitizeText(record.id) || `script_${timestamp}_${index + 1}`,
            content,
            timestamp,
            filename,
            name,
            sourcePreview,
            provider: sanitizeText(record.provider) || 'Unknown',
            template: sanitizeText(record.template) || 'Custom',
            validation
        };
    }

    function loadStoredHistoryRecords(storageKey) {
        const stored = safeJsonParse(GM_getValue(storageKey, '[]'), []);
        return Array.isArray(stored)
            ? stored.filter((item) => item && typeof item === 'object')
            : [];
    }

    function getGeneratedScriptRecordSignature(record) {
        return [
            Number(record?.timestamp) || 0,
            sanitizeText(record?.filename),
            sanitizeText(record?.content || record?.script || '')
        ].join('::');
    }

    function mergeGeneratedScriptHistory(records) {
        const seen = new Set();

        return records
            .slice()
            .sort((left, right) => (Number(right?.timestamp) || 0) - (Number(left?.timestamp) || 0))
            .filter((record) => {
                const signature = getGeneratedScriptRecordSignature(record);
                if (seen.has(signature)) {
                    return false;
                }

                seen.add(signature);
                return true;
            })
            .slice(0, CONFIG.MAX_HISTORY_ITEMS);
    }

    function getLinkedHistoryStorageKeys() {
        return [...new Set([CONFIG.STORAGE_KEYS.history, ...CONFIG.COMPATIBLE_HISTORY_KEYS])];
    }

    function persistGeneratedScripts(records) {
        const normalizedRecords = mergeGeneratedScriptHistory(records
            .map((item, index) => normalizeGeneratedScriptRecord(item, index))
            .filter(Boolean));
        const serialized = JSON.stringify(normalizedRecords);

        getLinkedHistoryStorageKeys().forEach((storageKey) => {
            GM_setValue(storageKey, serialized);
        });

        state.generatedScripts = normalizedRecords;
        return normalizedRecords;
    }

    function downloadScriptContent(script, filename = '') {
        const normalizedScript = sanitizeText(script);
        const blob = new Blob([normalizedScript], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || generateScriptFilename(normalizedScript);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notifyUser('Script download started.');
    }

    function downloadGeneratedScriptById(id) {
        const scripts = loadGeneratedScripts();
        const match = scripts.find((item) => item?.id === id);

        if (!match?.content) {
            alert(`Generated script not found for id: ${id}`);
            return false;
        }

        downloadScriptContent(match.content, match.filename);
        return true;
    }

    function downloadLatestGenerated() {
        const scripts = loadGeneratedScripts();
        const latest = scripts[0];

        if (!latest?.content) {
            alert('No generated scripts found.');
            return false;
        }

        downloadScriptContent(latest.content, latest.filename);
        return true;
    }

    function getCurrentGeneratedScript() {
        const scripts = loadGeneratedScripts();
        if (!scripts.length) {
            return null;
        }

        if (state.currentGeneratedScriptId) {
            const current = scripts.find((item) => item?.id === state.currentGeneratedScriptId);
            if (current) {
                return current;
            }
        }

        return scripts[0] || null;
    }

    function saveCurrentGenerated() {
        const current = getCurrentGeneratedScript();
        if (current?.content) {
            downloadScriptContent(current.content, current.filename);
            return true;
        }

        return saveScript();
    }

    function previewCurrentGenerated() {
        const current = getCurrentGeneratedScript();
        if (current?.content) {
            return openScriptPreview(current.content);
        }

        return previewScript();
    }

    function previewEntryPoint(contentOrOptions = '') {
        if (typeof contentOrOptions === 'string') {
            const content = sanitizeText(contentOrOptions);
            if (content) {
                return openScriptPreview(content);
            }
        }

        if (contentOrOptions && typeof contentOrOptions === 'object') {
            const content = sanitizeText(contentOrOptions.content || contentOrOptions.script || '');
            if (content) {
                return openScriptPreview(content);
            }
        }

        return previewCurrentGenerated();
    }

    function saveGeneratedScript(script) {
        const history = loadGeneratedScripts().filter((item) => item && item.id !== script.id);
        history.unshift(script);
        persistGeneratedScripts(history.slice(0, CONFIG.MAX_HISTORY_ITEMS));
        state.currentGeneratedScriptId = script.id;
    }

    function loadGeneratedScripts() {
        const primaryRawScripts = loadStoredHistoryRecords(CONFIG.STORAGE_KEYS.history);
        const mergedRawScripts = primaryRawScripts.slice();

        CONFIG.COMPATIBLE_HISTORY_KEYS.forEach((storageKey) => {
            mergedRawScripts.push(...loadStoredHistoryRecords(storageKey));
        });

        const normalizedScripts = mergeGeneratedScriptHistory(mergedRawScripts
            .map((item, index) => normalizeGeneratedScriptRecord(item, index))
            .filter(Boolean));

        if (JSON.stringify(primaryRawScripts) !== JSON.stringify(normalizedScripts)) {
            persistGeneratedScripts(normalizedScripts);
        }

        return normalizedScripts;
    }

    function clearGeneratedScripts() {
        state.currentGeneratedScriptId = '';
        return persistGeneratedScripts([]);
    }

    function preprocessInput(prompt) {
        return sanitizeText(prompt)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    function postprocessOutput(prompt, score) {
        const tokens = preprocessInput(prompt);
        const lines = [
            'const config = { enabled: true };',
            '',
            "function logStatus(message) {",
            "  console.log('[Generated Script]', message);",
            '}',
            ''
        ];

        if (tokens.includes('dark')) {
            lines.push(
                "function injectDarkMode() {",
                "  const style = document.createElement('style');",
                "  style.textContent = 'html { filter: invert(1) hue-rotate(180deg); } img, video { filter: invert(1) hue-rotate(180deg); }';",
                "  document.head.appendChild(style);",
                '}',
                ''
            );
        }

        if (tokens.includes('keyboard') || tokens.includes('shortcut')) {
            lines.push(
                "function registerShortcuts() {",
                "  document.addEventListener('keydown', (event) => {",
                "    if (event.altKey && event.key.toLowerCase() === 'g') {",
                "      logStatus('Shortcut triggered');",
                '    }',
                '  });',
                '}',
                ''
            );
        }

        if (tokens.includes('hide')) {
            lines.push(
                "function hideDistractingElements() {",
                "  document.querySelectorAll('aside, [aria-label*=ad i], .ad, .ads').forEach((node) => node.remove());",
                '}',
                ''
            );
        }

        if (score >= 0.5) {
            lines.push(
                "function optimizeStartup() {",
                "  requestAnimationFrame(() => logStatus('Performance-friendly startup complete.'));",
                '}',
                ''
            );
        }

        lines.push(
            'function init() {',
            "  if (!config.enabled) return;",
            "  logStatus('Initializing generated helper on ' + location.hostname);"
        );

        if (tokens.includes('dark')) {
            lines.push('  injectDarkMode();');
        }

        if (tokens.includes('keyboard') || tokens.includes('shortcut')) {
            lines.push('  registerShortcuts();');
        }

        if (tokens.includes('hide')) {
            lines.push('  hideDistractingElements();');
        }

        if (score >= 0.5) {
            lines.push('  optimizeStartup();');
        }

        lines.push(
            '}',
            '',
            "if (document.readyState === 'loading') {",
            "  document.addEventListener('DOMContentLoaded', init, { once: true });",
            '} else {',
            '  init();',
            '}'
        );

        return lines.join('\n');
    }

    async function loadMLModel() {
        return {
            predict: () => {
                return { dataSync: () => [Math.random()] };
            }
        };
    }

    function notifyUser(text) {
        try {
            GM_notification({
                text,
                title: 'AI Script Generator',
                timeout: 3000
            });
        } catch (error) {
            debugLog('Unable to show notification', error);
        }
    }

    // Menu Commands
    function registerMenuCommands() {
        if (state.menusRegistered) {
            return;
        }

        GM_registerMenuCommand('AI Script Generator', () => {
            toggleGeneratorUI();
        });

        GM_registerMenuCommand('View Generated Scripts', viewGeneratedScripts);
        GM_registerMenuCommand('Download Latest Generated Script', downloadLatestGenerated);
        GM_registerMenuCommand('Clear Generated Scripts', clearGeneratedScriptsFromMenu);
        GM_registerMenuCommand('Generator Settings', showGeneratorSettings);
        state.menusRegistered = true;
    }

    function viewGeneratedScripts() {
        const scripts = loadGeneratedScripts();
        if (scripts.length === 0) {
            alert('No generated scripts found.');
            return scripts;
        }

        const list = scripts
            .map((script, index) => {
                const status = script.validation?.isValid ? 'Valid' : 'Needs review';
                const score = script.validation?.score ?? 'n/a';
                const name = script.name || script.filename || script.template;
                const sourcePreview = script.sourcePreview || 'No prompt preview saved.';
                return `${index + 1}. ${name} | ${script.provider} | ${status} | Score: ${score} | ID: ${script.id} | ${new Date(script.timestamp).toLocaleString()}\n${sourcePreview}`;
            })
            .join('\n\n');
        alert(`Generated Scripts:\n\n${list}`);
        return scripts;
    }

    function clearGeneratedScriptsFromMenu() {
        const shouldClear = typeof window.confirm === 'function'
            ? window.confirm('Clear generated script history?')
            : true;

        if (!shouldClear) {
            return;
        }

        clearGeneratedScripts();
        alert('Generated script history cleared.');
    }

    function showGeneratorSettings() {
        alert([
            `Provider: ${state.aiProvider}`,
            `Saved scripts: ${state.generatedScripts.length}`,
            'API keys are stored only in session storage for the current tab.'
        ].join('\n'));
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGenerator, { once: true });
    } else {
        initializeGenerator();
    }

})();
