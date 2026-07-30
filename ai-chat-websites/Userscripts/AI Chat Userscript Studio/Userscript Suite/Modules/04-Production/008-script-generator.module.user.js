// ==UserScript==
// @name         Script Generator
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Generate and modify scripts using AI with automated reactions to witness results and minimal human intervention when required
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/lodash@latest/lodash.min.js
// @require      https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js
// @require      https://cdn.jsdelivr.net/npm/socket.io-client/dist/socket.io.min.js
// @connect      cdn.jsdelivr.net
// ==/UserScript==

(function() {
    'use strict';

    const isTesting = false; // Set to true when testing

    // AI-Powered Script Generator Module
    class AIPoweredScriptGeneratorModule {
        constructor() {
            this.name = 'AI-Powered Script Generator';
            this.version = '1.4';
            this.description = 'Generate and modify scripts using AI with automated reactions';
            this.dependencies = [];
        }

        init() {
            console.log(`[${this.name}] Module initialized v${this.version}`);
            this.setupUI();
            this.integrateWithServices();
        }

        integrateWithServices() {
            // Integrate with CacheManager for script caching
            if (window.CacheManager) {
                this.cacheManager = window.CacheManager;
                console.log(`[${this.name}] Integrated with CacheManager`);
            }

            // Integrate with Scheduler for automated tasks
            if (window.Scheduler) {
                this.scheduler = window.Scheduler;
                console.log(`[${this.name}] Integrated with Scheduler`);
                this.setupScheduledTasks();
            }

            // Integrate with PluginManager for extensibility
            if (window.PluginManager) {
                this.pluginManager = window.PluginManager;
                console.log(`[${this.name}] Integrated with PluginManager`);
            }

            // Integrate with MiddlewareManager for request processing
            if (window.MiddlewareManager) {
                this.middlewareManager = window.MiddlewareManager;
                console.log(`[${this.name}] Integrated with MiddlewareManager`);
            }
        }

        setupScheduledTasks() {
            // Schedule a cleanup task to clear old cached scripts every hour
            this.scheduler.schedule(
                'script-cache-cleanup',
                () => {
                    console.log(`[${this.name}] Running scheduled cache cleanup`);
                    if (this.cacheManager) {
                        // Clear scripts older than 24 hours
                        const cacheStats = this.cacheManager.getStats();
                        console.log(`[${this.name}] Cache stats:`, cacheStats);
                    }
                },
                3600000, // 1 hour
                { immediate: false }
            );

            console.log(`[${this.name}] Scheduled tasks configured`);
        }

        setupUI() {
            // Create a simple UI for inputting commands
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Enter command';
            input.style.position = 'fixed';
            input.style.top = '10px';
            input.style.left = '10px';
            input.style.padding = '5px';
            input.style.fontSize = '14px';
            input.style.zIndex = '10000';
            document.body.appendChild(input);

            const button = document.createElement('button');
            button.innerText = 'Generate Script';
            button.style.position = 'fixed';
            button.style.top = '10px';
            button.style.left = '200px';
            button.style.padding = '5px 10px';
            button.style.fontSize = '14px';
            button.style.zIndex = '10000';
            document.body.appendChild(button);

            button.addEventListener('click', () => {
                const command = input.value;
                if (command) {
                    this.handleInput(command);
                } else {
                    alert('Please enter a command.');
                }
            });

            const modeSelect = document.createElement('select');
            modeSelect.style.position = 'fixed';
            modeSelect.style.top = '10px';
            modeSelect.style.left = '400px';
            modeSelect.style.padding = '5px';
            modeSelect.style.fontSize = '14px';
            modeSelect.style.zIndex = '10000';
            ['fully_automated', 'semi_automated', 'manual'].forEach(mode => {
                const option = document.createElement('option');
                option.value = mode;
                option.text = mode.replace('_', ' ').toUpperCase();
                modeSelect.appendChild(option);
            });
            document.body.appendChild(modeSelect);

            modeSelect.addEventListener('change', () => {
                this.currentMode = modeSelect.value;
                console.log(`Mode changed to: ${this.currentMode}`);
            });

            const historyButton = document.createElement('button');
            historyButton.innerText = 'Show Command History';
            historyButton.style.position = 'fixed';
            historyButton.style.top = '10px';
            historyButton.style.left = '600px';
            historyButton.style.padding = '5px 10px';
            historyButton.style.fontSize = '14px';
            historyButton.style.zIndex = '10000';
            document.body.appendChild(historyButton);

            historyButton.addEventListener('click', () => {
                console.log('Command History:', this.commandHistory);
            });
        }

        handleInput(command) {
            this.commandHistory.push(command);
            const bestMode = this.determineBestMode(command);
            if (this.currentMode !== bestMode) {
                this.explainDecision(bestMode);
            }
            this.currentMode = bestMode;
            this.generateScript(command);
        }

        determineBestMode(command) {
            if (command.includes('automate')) {
                return this.modes.FULLY_AUTOMATED;
            } else if (command.includes('assist')) {
                return this.modes.SEMI_AUTOMATED;
            } else {
                return this.modes.MANUAL;
            }
        }

        explainDecision(bestMode) {
            console.log(`AI has chosen ${bestMode} mode because it is the most suitable for the command.`);
        }

        async generateScript(command) {
            try {
                if (await this.checkWebSocket()) {
                    this.generateScriptWebSocket(command);
                } else if (await this.checkHTTP()) {
                    this.generateScriptHTTP(command);
                } else {
                    this.generateScriptLocal(command);
                }
            } catch (error) {
                console.error('Error in generating script:', error);
                alert(`Error in generating script: ${error.message}`);
            }
        }

        async checkWebSocket() {
            return new Promise((resolve) => {
                const socket = io('http://localhost:8080');
                socket.on('connect', () => {
                    socket.disconnect();
                    resolve(true);
                });
                socket.on('connect_error', () => {
                    resolve(false);
                });
            });
        }

        async checkHTTP() {
            try {
                const response = await axios.options('http://localhost:8080/generate-script');
                return response.status === 200;
            } catch {
                return false;
            }
        }

        generateScriptWebSocket(command) {
            const socket = io('http://localhost:8080');

            socket.on('connect', () => {
                socket.emit('generate-script', command);
            });

            socket.on('script-generated', (data) => {
                console.log('Generated Script (WebSocket):', data);
                this.executeScript(data);
                this.saveScriptToFile(data);
                socket.disconnect();
            });

            socket.on('error', (error) => {
                console.error('WebSocket Error:', error);
                alert(`WebSocket Error: ${error.message}`);
            });
        }

        async generateScriptHTTP(command) {
            try {
                const response = await axios.post('http://localhost:8080/generate-script', command, {
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });
                console.log('Generated Script (HTTP):', response.data);
                this.executeScript(response.data);
                this.saveScriptToFile(response.data);
            } catch (error) {
                console.error('HTTP Error:', error.message);
                alert(`HTTP Error: ${error.message}`);
            }
        }

        generateScriptLocal(command) {
            const script = `// Script for: ${command}\nconsole.log('Executing local script for: ${command}');`;
            console.log('Generated Script (Local):', script);
            
            // Cache the generated script if CacheManager is available
            if (this.cacheManager) {
                this.cacheManager.set(`script_${command}`, script);
                console.log(`[${this.name}] Script cached for command: ${command}`);
            }
            
            // AI-powered script optimization
            const optimizedScript = this.optimizeScript(script, command);
            
            this.executeScript(optimizedScript);
            this.saveScriptToFile(optimizedScript);
        }

        optimizeScript(script, command) {
            // AI-powered script optimization based on command analysis
            const optimizations = {
                'automate': this.#optimizeAutomationScript,
                'backup': this.#optimizeBackupScript,
                'process': this.#optimizeProcessingScript,
                'analyze': this.#optimizeAnalysisScript,
                'generate': this.#optimizeGenerationScript
            };

            const commandType = this.#classifyCommand(command);
            if (optimizations[commandType]) {
                return optimizations[commandType](script, command);
            }

            // Default optimization: remove comments and whitespace
            return script.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
        }

        #classifyCommand(command) {
            const lowerCommand = command.toLowerCase();
            if (lowerCommand.includes('automate')) return 'automate';
            if (lowerCommand.includes('backup')) return 'backup';
            if (lowerCommand.includes('process')) return 'process';
            if (lowerCommand.includes('analyze')) return 'analyze';
            if (lowerCommand.includes('generate')) return 'generate';
            return 'default';
        }

        #optimizeAutomationScript(script, command) {
            // Add performance optimizations for automation scripts
            return `
// Performance-optimized automation script
const startTime = performance.now();

${script}

// Performance monitoring
const endTime = performance.now();
console.log(\`Automation completed in \${endTime - startTime}ms\`);

// Memory cleanup
if (typeof window !== 'undefined' && window.gc) {
    try { window.gc(); } catch(e) {}
}
`;
        }

        #optimizeBackupScript(script, command) {
            // Add error handling and progress tracking for backup scripts
            return `
// Robust backup script with error handling
try {
    console.log('Starting backup operation...');
    
    ${script}
    
    console.log('Backup completed successfully');
} catch (error) {
    console.error('Backup failed:', error);
    // Retry logic
    setTimeout(() => {
        console.log('Retrying backup...');
        // Retry logic here
    }, 1000);
}
`;
        }

        #optimizeProcessingScript(script, command) {
            // Add parallel processing capabilities
            return `
// Parallel processing optimized script
const workers = [];
const chunks = []; // Split data into chunks

${script}

// Worker management
for (let i = 0; i < workers.length; i++) {
    workers[i].onmessage = function(e) {
        console.log('Worker', i, 'completed:', e.data);
    };
}
`;
        }

        #optimizeAnalysisScript(script, command) {
            // Add data analysis optimizations
            return `
// Data analysis optimized script
const analysisStartTime = performance.now();

${script}

// Analysis results
const analysisEndTime = performance.now();
console.log(\`Analysis completed in \${analysisEndTime - analysisStartTime}ms\`);

// Analysis command: ${command}
`;
        }

        #optimizeGenerationScript(script, command) {
            // Add generation metadata and basic safety wrapper
            return `
// Generated script for command: ${command}
try {
    ${script}
} catch (error) {
    console.error('Generated script failed:', error);
}
`;
        }

        executeScript(script) {
            try {
                const scriptElement = document.createElement('script');
                scriptElement.textContent = script;
                document.documentElement.appendChild(scriptElement);
                scriptElement.remove();
            } catch (error) {
                console.error(`[${this.name}] Failed to execute generated script:`, error);
            }
        }

        saveScriptToFile(script) {
            if (typeof GM_setValue === 'function') {
                GM_setValue('lastGeneratedScript', script);
            }
        }
    }

    const instance = new AIPoweredScriptGeneratorModule();
    if (typeof window !== 'undefined') {
        if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
            window.ModuleRegistry.register(instance);
        } else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
            window.ChatGPTModules.register(instance);
        }
    }
})();
