// ==UserScript==
// @name         1. Automation .M
// @description  ChatGPT - Automation - Module for Hub - Automates code refinement and improvement
// @author       AI RMD
// @version      2026.03.14.1
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
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==

(() => {
    'use strict';

    const chat = (window.ChatGPTUtils && typeof window.ChatGPTUtils.getChatAdapter === 'function')
        ? window.ChatGPTUtils.getChatAdapter()
        : (window.chatgpt || null);

    const safeChat = {
        sendMessage: (...args) => chat && typeof chat.sendMessage === 'function'
            ? chat.sendMessage(...args)
            : Promise.reject(new Error('sendMessage not supported on this site')),
        getLastReply: (...args) => chat && typeof chat.getLastReply === 'function'
            ? chat.getLastReply(...args)
            : Promise.resolve(''),
        getConversationHistory: (...args) => chat && typeof chat.getConversationHistory === 'function'
            ? chat.getConversationHistory(...args)
            : Promise.resolve([])
    };
    
    /**
     * Automation module for ChatGPT
     * Handles code refinement and improvement automation
     */
    class AutomationModule {
        constructor() {
            this.config = {
                infinityModeActive: false,
                selfRefineActive: false,
                selfRefineMaxCycles: 8,
                selfRefineDelay: 2000,
                selfRefineTimeout: 60000,
                codeBlockMarkers: ['', ''],
                delayAfterApply: 2000,
                delayAfterSkip: 500,
                maxRetries: 3,
                backoffBase: 2,
                memoryCheckInterval: 30000,
                memoryThreshold: 100000000
            };
            
            this.state = {
                isAnimationsPaused: false,
                activeAnimations: new Set(),
                activeTimeouts: new Set(),
                memoryUsage: 0,
                lastSuccessfulCode: '',
                lastError: '',
                recoveryAttempts: 0,
                selfRefineRunning: false,
                selfRefineCycles: 0
            };
        }
        
        /**
         * Initialize the module
         */
        init() {
            if (!chat || typeof chat.sendMessage !== 'function') {
                this.log('warning', 'Automation Module not supported on this site.');
                return;
            }
            // Load configuration from central config if available
            if (window.ChatGPTConfig) {
                const savedConfig = window.ChatGPTConfig.get('automation');
                if (savedConfig) {
                    this.config = { ...this.config, ...savedConfig };
                }
            } else {
                Object.keys(this.config).forEach((key) => {
                    const storedValue = GM_getValue(key, undefined);
                    if (storedValue !== undefined) this.config[key] = storedValue;
                });
            }
            
            // Load state from storage
            this.state.lastSuccessfulCode = GM_getValue('lastSuccessfulCode', '');
            this.state.lastError = GM_getValue('lastError', '');
            this.state.recoveryAttempts = GM_getValue('recoveryAttempts', 0);
            
            this.log('info', 'Automation Module initialized');

            this.ensureSelfRefineToggle();
            
            // Prefer self-refine loop if both are enabled
            if (this.config.selfRefineActive) {
                this.startSelfRefine();
            } else if (this.config.infinityModeActive) {
                this.activate();
            }
        }
        
        /**
         * Activates the automation process
         */
        async activate() {
            const activatePrompt = "You are now in Infinity Mode. Continue making improvements with every cycle, requesting user confirmation before proceeding. Remember previous cycles and user responses. Focus on code generation and improvement, with clear explanations and examples. Only generate one code block at a time.";
            this.log('info', 'Activating Automation Module...');

            try {
                await safeChat.sendMessage(activatePrompt);
                let retryCount = 0;
                let consecutiveErrors = 0;

                while (this.getConfig('infinityModeActive', false)) {
                    try {
                        if (consecutiveErrors >= 3) {
                            this.log('warning', 'Too many consecutive errors, pausing for recovery...');
                            await this.delay(5000);
                            consecutiveErrors = 0;
                        }

                        // Check memory usage before iteration
                        this.state.memoryUsage = performance.memory?.usedJSHeapSize || 0;
                        if (this.state.memoryUsage > this.config.memoryThreshold) {
                            this.log('warning', 'Memory threshold exceeded, performing cleanup...');
                            await this.cleanup();
                            await this.delay(2000);
                        }

                        await this.iterateImprovement();
                        retryCount = 0;
                        consecutiveErrors = 0;
                        await this.delay(1000);
                    } catch (error) {
                        retryCount++;
                        consecutiveErrors++;
                        this.log('warning', `Retry attempt ${retryCount}/${this.config.maxRetries}`, error);

                        if (retryCount >= this.config.maxRetries) {
                            this.log('error', 'Maximum retries reached, attempting recovery...');
                            await this.attemptRecovery();
                            retryCount = 0;
                        }

                        const backoffDelay = Math.min(1000 * Math.pow(this.config.backoffBase, retryCount), 30000);
                        await this.delay(backoffDelay);
                    }
                }
            } catch (error) {
                this.log('error', 'Activation error:', error);
                await this.handleError(error);
                await this.cleanup();
                this.toggleInfinityMode();
            } finally {
                // Ensure cleanup is performed even if an error occurs
                this.state.activeAnimations.clear();
                this.state.activeTimeouts.clear();
                this.state.isAnimationsPaused = false;
            }
        }
        
        /**
         * Performs one iteration of the improvement cycle
         */
        async iterateImprovement() {
            const startTime = performance.now();
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 30000);
            this.state.activeTimeouts.add(timeoutId);

            try {
                const lastReply = await safeChat.getLastReply();
                if (!lastReply) throw new Error('No previous reply found');

                const improvementPrompt = await this.dynamicPrompt(lastReply);
                this.log('info', `Proposed improvement:\n\n${improvementPrompt}`);

                const shouldProceed = await this.confirmImprovement();
                if (shouldProceed) {
                    const response = await Promise.race([
                        safeChat.sendMessage(improvementPrompt),
                        new Promise((_, reject) => abortController.signal.addEventListener('abort', () => reject(new Error('Response timeout')))),
                    ]);

                    if (!response) throw new Error('No response received from ChatGPT');

                    const success = await this.applyCode(response);
                    await this.handleIterationResult(success, response);

                    const duration = performance.now() - startTime;
                    this.log('info', `Iteration completed in ${duration.toFixed(2)}ms`);
                } else {
                    this.log('info', 'Improvement skipped by user.');
                    await this.delay(this.config.delayAfterSkip);
                }
            } catch (error) {
                this.log('error', 'Iteration error:', error);
                await this.handleError(error);
                throw error;
            } finally {
                clearTimeout(timeoutId);
                this.state.activeTimeouts.delete(timeoutId);
            }
        }
        
        /**
         * Generates a dynamic prompt based on context
         * @param {string} lastReply - The last reply from ChatGPT
         * @returns {string} - The generated prompt
         */
        async dynamicPrompt(lastReply) {
            const conversationHistory = await safeChat.getConversationHistory();
            const context = `Here is the conversation history:\n\n${conversationHistory}`;
            const lastSuccessfulCode = this.state.lastSuccessfulCode;
            const lastError = this.state.lastError;
            const recoveryAttempts = this.state.recoveryAttempts;

            const promptType = lastError
                ? 'error'
                : recoveryAttempts > 0
                ? 'recovery'
                : 'improvement';

            const promptMap = {
                error: `Fix this error: ${lastError}\nPrevious successful code:\n${lastSuccessfulCode}\nCorrect the code within ${this.config.codeBlockMarkers[0]} and ${this.config.codeBlockMarkers[1]} markers. Focus on error handling and validation.\n${context}`,
                recovery: `We have attempted ${recoveryAttempts} recoveries. Previous successful code:\n${lastSuccessfulCode}\nRework the code within ${this.config.codeBlockMarkers[0]} and ${this.config.codeBlockMarkers[1]} markers. Focus on stability and resilience.\n${context}`,
                improvement: `Improve the following code for clarity, performance, and security:\n\n${lastReply}\nProvide the updated code within ${this.config.codeBlockMarkers[0]} and ${this.config.codeBlockMarkers[1]} markers. Ensure explanations and comments are included.\n${context}`,
            };

            return promptMap[promptType];
        }
        
        /**
         * Confirms with the user whether to apply the improvement
         * @returns {Promise<boolean>} - Whether to proceed
         */
        async confirmImprovement() {
            return new Promise((resolve) => {
                const result = confirm('Apply this improvement? Click OK to proceed or Cancel to skip.');
                resolve(result);
            });
        }
        
        /**
         * Applies the code from the response
         * @param {string} response - The response from ChatGPT
         * @returns {Promise<boolean>} - Whether the application was successful
         */
        async applyCode(response) {
            this.log('info', 'Applying code:', response);
            // Implementation logic for applying code can be added here
            this.state.lastSuccessfulCode = response;
            GM_setValue('lastSuccessfulCode', response);
            return true;
        }
        
        /**
         * Handles the result of an iteration
         * @param {boolean} success - Whether the iteration was successful
         * @param {string} response - The response from ChatGPT
         */
        async handleIterationResult(success, response) {
            if (success) {
                this.log('info', 'Code successfully applied.');
                this.state.lastError = '';
                GM_setValue('lastError', '');
            } else {
                this.log('warning', 'Code application failed.');
                this.state.lastError = 'Failed to apply code. Review manually.';
                GM_setValue('lastError', this.state.lastError);
            }
        }
        
        /**
         * Attempts to recover from errors
         */
        async attemptRecovery() {
            this.state.recoveryAttempts++;
            GM_setValue('recoveryAttempts', this.state.recoveryAttempts);
            this.log('info', `Recovery attempt ${this.state.recoveryAttempts}`);
            
            // Implement recovery logic here
            await this.delay(3000); // Simple delay as placeholder
        }
        
        /**
         * Toggles infinity mode on/off
         */
        toggleInfinityMode() {
            this.config.infinityModeActive = !this.config.infinityModeActive;
            
            // Update central config if available
            if (window.ChatGPTConfig) {
                window.ChatGPTConfig.set('automation', 'infinityModeActive', this.config.infinityModeActive);
            } else {
                GM_setValue('infinityModeActive', this.config.infinityModeActive);
            }
            
            this.log('info', `Infinity Mode ${this.config.infinityModeActive ? 'activated' : 'deactivated'}`);
            
            if (this.config.infinityModeActive) {
                this.activate();
            }
        }

        /**
         * Starts the self-refine loop
         */
        startSelfRefine() {
            if (!chat || typeof chat.sendMessage !== 'function') {
                this.log('warning', 'Self-refine loop not supported on this site.');
                return;
            }
            if (this.state.selfRefineRunning) {
                this.log('info', 'Self-refine loop is already running.');
                return;
            }

            if (this.config.infinityModeActive) {
                this.toggleInfinityMode();
            }

            this.config.selfRefineActive = true;
            if (window.ChatGPTConfig) {
                window.ChatGPTConfig.set('automation', 'selfRefineActive', true);
            } else {
                GM_setValue('selfRefineActive', true);
            }
            this.updateSelfRefineToggle();

            this.state.selfRefineCycles = 0;
            this.log('info', 'Self-refine loop started.');
            this.runSelfRefineLoop();
        }

        /**
         * Stops the self-refine loop
         * @param {string} reason - Optional reason for stopping
         */
        stopSelfRefine(reason = 'stopped') {
            this.config.selfRefineActive = false;
            if (window.ChatGPTConfig) {
                window.ChatGPTConfig.set('automation', 'selfRefineActive', false);
            } else {
                GM_setValue('selfRefineActive', false);
            }
            this.state.selfRefineRunning = false;
            this.updateSelfRefineToggle();
            this.log('info', `Self-refine loop ${reason}.`);
        }

        /**
         * Runs the self-refine loop
         */
        async runSelfRefineLoop() {
            if (this.state.selfRefineRunning) return;
            this.state.selfRefineRunning = true;

            const maxCycles = Math.max(1, parseInt(this.getConfig('selfRefineMaxCycles', 8), 10) || 1);
            const delayMs = Math.max(250, parseInt(this.getConfig('selfRefineDelay', 2000), 10) || 2000);
            const timeoutMs = Math.max(5000, parseInt(this.getConfig('selfRefineTimeout', 60000), 10) || 60000);

            try {
                let lastReply = await safeChat.getLastReply();
                if (!lastReply) {
                    lastReply = await this.waitForNewReply('', timeoutMs);
                }

                while (this.getConfig('selfRefineActive', false) && this.state.selfRefineCycles < maxCycles) {
                    const prompt = this.buildSelfRefinePrompt(lastReply);
                    await safeChat.sendMessage(prompt);

                    const newReply = await this.waitForNewReply(lastReply, timeoutMs);
                    if (!newReply) {
                        this.stopSelfRefine('timeout');
                        break;
                    }

                    if (this.shouldStopRefine(newReply, lastReply)) {
                        this.stopSelfRefine('completed');
                        break;
                    }

                    lastReply = newReply;
                    this.state.selfRefineCycles += 1;
                    await this.delay(delayMs);
                }

                if (this.state.selfRefineCycles >= maxCycles && this.getConfig('selfRefineActive', false)) {
                    this.stopSelfRefine('reached max cycles');
                }
            } catch (error) {
                this.log('error', 'Self-refine loop error:', error);
                this.stopSelfRefine('errored');
            } finally {
                this.state.selfRefineRunning = false;
            }
        }

        /**
         * Determines whether the loop should stop based on the reply
         * @param {string} reply - The latest assistant reply
         * @param {string} previousReply - The previous assistant reply
         * @returns {boolean} - Whether to stop
         */
        shouldStopRefine(reply, previousReply) {
            if (!reply) return true;
            const markers = [
                '[[STOP]]',
                'STOP_LOOP',
                'STOP REFINING',
                'NO FURTHER CHANGES',
                'NO MORE CHANGES',
                'NO MEANINGFUL IMPROVEMENTS'
            ];
            const upper = reply.toUpperCase();
            if (markers.some(marker => upper.includes(marker))) return true;

            if (previousReply) {
                const currentNormalized = this.normalizeText(reply);
                const previousNormalized = this.normalizeText(previousReply);
                if (currentNormalized && currentNormalized === previousNormalized) return true;
            }

            return false;
        }

        /**
         * Builds the self-refine prompt
         * @param {string} lastReply - The previous reply to refine
         * @returns {string} - Prompt text
         */
        buildSelfRefinePrompt(lastReply) {
            return [
                'Refine the previous response for clarity, correctness, and brevity.',
                'If there are no meaningful improvements, reply with [[STOP]] and a short reason.',
                'Do not ask questions. Provide the improved response only.',
                '',
                'Previous response:',
                lastReply || ''
            ].join('\n');
        }

        /**
         * Waits for a new reply that differs from the previous one
         * @param {string} previousReply - The previous reply
         * @param {number} timeoutMs - Timeout in milliseconds
         * @returns {Promise<string>} - The new reply or empty string on timeout
         */
        async waitForNewReply(previousReply, timeoutMs) {
            const start = Date.now();
            const previousNormalized = this.normalizeText(previousReply || '');
            while (Date.now() - start < timeoutMs) {
                const latest = await safeChat.getLastReply();
                const latestNormalized = this.normalizeText(latest || '');
                if (latest && latestNormalized !== previousNormalized) return latest;
                await this.delay(800);
            }
            return '';
        }

        /**
         * Normalizes text for comparison
         * @param {string} text - The text to normalize
         * @returns {string} - Normalized text
         */
        normalizeText(text) {
            return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
        }

        /**
         * Prompts for a numeric setting
         * @param {string} key - Config key
         * @param {string} label - Display label
         * @param {number} minValue - Minimum value
         * @param {number} maxValue - Maximum value
         */
        promptNumberSetting(key, label, minValue, maxValue) {
            const current = this.getConfig(key, this.config[key]);
            const input = prompt(`${label} (${minValue}-${maxValue})`, String(current));
            if (input === null) return;
            const value = parseInt(input, 10);
            if (!Number.isFinite(value) || value < minValue || value > maxValue) {
                alert(`Invalid value. Enter a number between ${minValue} and ${maxValue}.`);
                return;
            }
            this.setConfig(key, value);
            this.log('info', `${label} set to ${value}`);
        }

        /**
         * Adds a small on-page toggle for the self-refine loop
         */
        ensureSelfRefineToggle() {
            if (document.getElementById('chatgpt-self-refine-toggle')) return;

            const styleId = 'chatgpt-self-refine-toggle-style';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    .chatgpt-self-refine-toggle {
                        position: fixed;
                        right: 16px;
                        bottom: 16px;
                        z-index: 9999;
                        padding: 8px 12px;
                        font-size: 12px;
                        border-radius: 16px;
                        border: 1px solid #2c3e50;
                        background: #ffffff;
                        color: #2c3e50;
                        cursor: pointer;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    }
                    .chatgpt-self-refine-toggle.active {
                        background: #2c3e50;
                        color: #ffffff;
                    }
                `;
                document.head.appendChild(style);
            }

            const button = document.createElement('button');
            button.id = 'chatgpt-self-refine-toggle';
            button.type = 'button';
            button.className = 'chatgpt-self-refine-toggle';
            button.addEventListener('click', () => {
                if (this.getConfig('selfRefineActive', false)) {
                    this.stopSelfRefine('stopped by user');
                } else {
                    this.startSelfRefine();
                }
            });

            document.body.appendChild(button);
            this.updateSelfRefineToggle();
        }

        /**
         * Updates the toggle button state
         */
        updateSelfRefineToggle() {
            const button = document.getElementById('chatgpt-self-refine-toggle');
            if (!button) return;
            const active = this.getConfig('selfRefineActive', false);
            button.textContent = active ? 'Self Refine: On' : 'Self Refine: Off';
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
        
        /**
         * Handles errors
         * @param {Error} error - The error to handle
         */
        async handleError(error) {
            this.log('error', 'Error encountered:', error);
            this.state.lastError = error.message || 'Unknown error';
            GM_setValue('lastError', this.state.lastError);
        }
        
        /**
         * Creates a delay
         * @param {number} ms - Milliseconds to delay
         * @returns {Promise} - Promise that resolves after the delay
         */
        delay(ms) {
            return new Promise((resolve) => {
                const timeoutId = setTimeout(resolve, ms);
                this.state.activeTimeouts.add(timeoutId);
                return () => {
                    clearTimeout(timeoutId);
                    this.state.activeTimeouts.delete(timeoutId);
                };
            });
        }
        
        /**
         * Cleans up resources
         */
        async cleanup() {
            // Clear all timeouts
            this.state.activeTimeouts.forEach(id => clearTimeout(id));
            this.state.activeTimeouts.clear();
            
            // Clear all animations
            this.state.activeAnimations.clear();
            
            // Reset state
            this.state.isAnimationsPaused = false;
            
            this.log('info', 'Cleanup completed');
        }
        
        /**
         * Gets a configuration value
         * @param {string} key - The configuration key
         * @param {any} defaultValue - The default value if not found
         * @returns {any} - The configuration value
         */
        getConfig(key, defaultValue) {
            // Try to get from central config first
            if (window.ChatGPTConfig) {
                const value = window.ChatGPTConfig.get('automation', key);
                if (value !== undefined) return value;
            }
            
            // Fall back to local config
            return this.config[key] !== undefined ? this.config[key] : defaultValue;
        }
        
        /**
         * Sets a configuration value
         * @param {string} key - The configuration key
         * @param {any} value - The value to set
         */
        setConfig(key, value) {
            this.config[key] = value;
            
            // Update central config if available
            if (window.ChatGPTConfig) {
                window.ChatGPTConfig.set('automation', key, value);
            } else {
                GM_setValue(key, value);
            }
        }
        
        /**
         * Logs a message
         * @param {string} level - Log level (info, warning, error)
         * @param {string} message - The message to log
         * @param {any} data - Additional data to log
         */
        log(level, message, data = null) {
            // Use the global logger if available
            if (window.ChatGPTUtils?.logger) {
                window.ChatGPTUtils.logger(level, message, data);
            } else {
                console[level](`[Automation] ${message}`, data || '');
            }
        }
    }
    
    // Register with the hub when available
    (function registerModule() {
        const checkInterval = setInterval(() => {
            if (window.ChatGPTModules) {
                clearInterval(checkInterval);
                const module = new AutomationModule();
                window.ChatGPTModules.register("Automation", "2026.03.14.1", module);
                module.init();
                
                // Register menu command
                if (typeof GM_registerMenuCommand === 'function') {
                    GM_registerMenuCommand('Toggle Infinity Mode', () => {
                        module.toggleInfinityMode();
                    });
                    GM_registerMenuCommand('Start Self-Refine Loop', () => {
                        module.startSelfRefine();
                    });
                    GM_registerMenuCommand('Stop Self-Refine Loop', () => {
                        module.stopSelfRefine('stopped by user');
                    });
                    GM_registerMenuCommand('Set Self-Refine Max Cycles', () => {
                        module.promptNumberSetting('selfRefineMaxCycles', 'Self-Refine Max Cycles', 1, 50);
                    });
                    GM_registerMenuCommand('Set Self-Refine Delay (ms)', () => {
                        module.promptNumberSetting('selfRefineDelay', 'Self-Refine Delay (ms)', 250, 30000);
                    });
                    GM_registerMenuCommand('Set Self-Refine Timeout (ms)', () => {
                        module.promptNumberSetting('selfRefineTimeout', 'Self-Refine Timeout (ms)', 5000, 300000);
                    });
                }
            }
        }, 100);
    })();
})();
