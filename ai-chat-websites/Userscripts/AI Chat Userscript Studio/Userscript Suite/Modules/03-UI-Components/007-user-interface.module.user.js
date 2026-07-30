// ==UserScript==
// @name         User Interface
// @version      2026.04.05.1
// @description  User Interface - Module - customizable buttons, keyboard shortcuts, feedback system, and customization
// @author       AI RMD
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
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_download
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==

(function() {
    'use strict';

    const chat = (window.ChatGPTUtils && typeof window.ChatGPTUtils.getChatAdapter === 'function')
        ? window.ChatGPTUtils.getChatAdapter()
        : (window.chatgpt || null);

    const safeChat = {
        sendRequest: (...args) => chat && typeof chat.sendRequest === 'function'
            ? chat.sendRequest(...args)
            : (chat && typeof chat.sendMessage === 'function'
                ? chat.sendMessage(...args)
                : Promise.reject(new Error('sendRequest not supported on this site')))
    };

    /**
     * User Interface Module for ChatGPT
     * Provides customizable buttons, keyboard shortcuts, and UI enhancements
     */
    class UserInterfaceModule {
        constructor() {
            this.version = '2026.04.05.1';
            this.config = {
                theme: 'light',
                customActions: [],
                buttonPosition: 'top-right',
                enableKeyboardShortcuts: true,
                feedbackDuration: 3000
            };
            
            this.elements = {
                buttonContainer: null,
                feedbackMessage: null,
                settingsPanel: null,
                dropdown: null
            };
            
            this.menuCommands = [];
        }
        
        /**
         * Initializes the module
         */
        init() {
            this.loadUserSettings();
            this.createCustomStyles();
            this.createMenu();
            
            if (this.config.enableKeyboardShortcuts) {
                this.addGlobalKeyboardShortcuts();
            }
            
            this.log('info', 'User Interface module initialized');
        }
        
        /**
         * Loads user settings from storage
         */
        loadUserSettings() {
            // Try to get from central config first
            if (window.ChatGPTConfig) {
                const savedConfig = window.ChatGPTConfig.get('ui');
                if (savedConfig) {
                    this.config = { ...this.config, ...savedConfig };
                    return;
                }
            }
            
            // Fall back to local storage
            const storedSettings = JSON.parse(localStorage.getItem('uiModuleSettings'));
            if (storedSettings) {
                this.config = { ...this.config, ...storedSettings };
            }
        }
        
        /**
         * Saves user settings to storage
         */
        saveUserSettings() {
            // Save to central config if available
            if (window.ChatGPTConfig) {
                Object.entries(this.config).forEach(([key, value]) => {
                    window.ChatGPTConfig.set('ui', key, value);
                });
            } else {
                // Fall back to local storage
                localStorage.setItem('uiModuleSettings', JSON.stringify(this.config));
            }
        }
        
        /**
         * Creates custom CSS styles
         */
        createCustomStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .custom-button {
                    margin: 5px;
                    padding: 10px 15px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.3s, transform 0.2s;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                }
                .custom-button:hover {
                    background-color: #45a049;
                    transform: scale(1.05);
                }
                .button-container {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                }
                .dropdown-content {
                    display: none;
                    position: absolute;
                    background-color: #f9f9f9;
                    min-width: 160px;
                    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                    z-index: 1;
                }
                .dropdown:hover .dropdown-content {
                    display: block;
                }
                .feedback-message {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 10px;
                    border-radius: 5px;
                    display: none;
                    z-index: 9999;
                    transition: opacity 0.5s;
                }
                .settings-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 20px;
                    background-color: white;
                    border: 1px solid #ccc;
                    box-shadow: 0px 4px 12px rgba(0,0,0,0.1);
                    z-index: 9999;
                }
                
                /* Dark theme styles */
                .dark-theme .custom-button {
                    background-color: #2c3e50;
                    color: #ecf0f1;
                }
                .dark-theme .custom-button:hover {
                    background-color: #34495e;
                }
                .dark-theme .dropdown-content {
                    background-color: #2c3e50;
                    color: #ecf0f1;
                }
                .dark-theme .settings-panel {
                    background-color: #2c3e50;
                    color: #ecf0f1;
                    border-color: #34495e;
                }
            `;
            document.head.appendChild(style);
            
            // Apply theme
            if (this.config.theme === 'dark') {
                document.body.classList.add('dark-theme');
            }
        }
        
        /**
         * Creates the UI menu
         */
        createMenu() {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown';
            
            const dropdownButton = this.createButton('Actions', this.toggleDropdown.bind(this));
            dropdown.appendChild(dropdownButton);
            
            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';

            // Define menu actions
            const actions = [
                { text: 'Custom Action 1', handler: this.customAction1.bind(this) },
                { text: 'Custom Action 2', handler: this.customAction2.bind(this) },
                { text: 'Show Alert', handler: this.showAlert.bind(this) },
                { text: 'Send ChatGPT Request', handler: this.sendChatGPTRequest.bind(this) },
                { text: 'Clear Console', handler: this.clearConsole.bind(this) },
                { text: 'Settings', handler: this.showSettings.bind(this) }
            ];

            // Create buttons for each action
            actions.forEach(action => {
                const button = this.createButton(action.text, action.handler);
                dropdownContent.appendChild(button);
            });

            // Add custom user actions
            this.config.customActions.forEach(action => {
                if (typeof action.handler === 'string') {
                    // Convert string handler to function
                    action.handler = new Function(action.handler);
                }
                const button = this.createButton(action.text, action.handler);
                dropdownContent.appendChild(button);
            });

            dropdown.appendChild(dropdownContent);
            buttonContainer.appendChild(dropdown);
            document.body.appendChild(buttonContainer);

            // Store references
            this.elements.buttonContainer = buttonContainer;
            this.elements.dropdown = dropdown;

            // Feedback message container
            this.elements.feedbackMessage = document.createElement('div');
            this.elements.feedbackMessage.className = 'feedback-message';
            document.body.appendChild(this.elements.feedbackMessage);
        }
        
        /**
         * Creates a button element
         * @param {string} text - Button text
         * @param {Function} onClick - Click handler
         * @returns {HTMLButtonElement} - The created button
         */
        createButton(text, onClick) {
            // Use the DOM utility if available
            if (window.ChatGPTUtils?.dom?.createButton) {
                return window.ChatGPTUtils.dom.createButton(text, onClick, 'custom-button');
            }
            
            // Fall back to direct creation
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'custom-button';
            button.addEventListener('click', onClick);
            return button;
        }
        
        /**
         * Toggles the dropdown menu
         * @param {Event} event - The click event
         */
        toggleDropdown(event) {
            const dropdownContent = event.target.nextElementSibling;
            dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
        }
        
        /**
         * Custom action 1
         */
        customAction1() {
            this.displayFeedback('Custom Action 1 executed!');
        }
        
        /**
         * Custom action 2
         */
        customAction2() {
            this.displayFeedback('Custom Action 2 executed!');
        }
        
        /**
         * Shows an alert
         */
        showAlert() {
            alert('Hello from the ChatGPT UI Module!');
        }
        
        /**
         * Sends a request to ChatGPT
         */
        sendChatGPTRequest() {
            const prompt = prompt("Enter your prompt for ChatGPT:", this.getSuggestedPrompt());
            if (prompt) {
                safeChat.sendRequest(prompt)
                    .then(response => {
                        this.logAction('ChatGPT Request', prompt);
                        this.displayFeedback(`ChatGPT Response: ${response}`);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        this.displayFeedback('Failed to get a response from ChatGPT.', true);
                    });
            } else {
                this.displayFeedback('Prompt cannot be empty.', true);
            }
        }
        
        /**
         * Clears the console
         */
        clearConsole() {
            console.clear();
            this.displayFeedback('Console cleared!');
        }

        createSettingsPanel() {
            const panel = document.createElement('div');
            panel.className = 'settings-panel';

            const heading = document.createElement('h3');
            heading.textContent = 'UI Module Settings';

            const keyboardRow = document.createElement('div');
            const keyboardLabel = document.createElement('label');
            const keyboardInput = document.createElement('input');
            keyboardInput.type = 'checkbox';
            keyboardInput.id = 'enableKeyboardShortcuts';
            keyboardInput.checked = this.config.enableKeyboardShortcuts;
            keyboardLabel.appendChild(keyboardInput);
            keyboardLabel.appendChild(document.createTextNode(' Enable Keyboard Shortcuts'));
            keyboardRow.appendChild(keyboardLabel);

            const themeRow = document.createElement('div');
            const themeLabel = document.createElement('label');
            themeLabel.appendChild(document.createTextNode('Theme: '));
            const themeSelect = document.createElement('select');
            themeSelect.id = 'themeSelect';

            const lightOption = document.createElement('option');
            lightOption.value = 'light';
            lightOption.textContent = 'Light';
            lightOption.selected = this.config.theme === 'light';

            const darkOption = document.createElement('option');
            darkOption.value = 'dark';
            darkOption.textContent = 'Dark';
            darkOption.selected = this.config.theme === 'dark';

            themeSelect.appendChild(lightOption);
            themeSelect.appendChild(darkOption);
            themeLabel.appendChild(themeSelect);
            themeRow.appendChild(themeLabel);

            const actionsRow = document.createElement('div');
            const saveButton = document.createElement('button');
            saveButton.id = 'saveSettings';
            saveButton.textContent = 'Save Settings';
            const closeButton = document.createElement('button');
            closeButton.id = 'closeSettings';
            closeButton.textContent = 'Close';
            actionsRow.appendChild(saveButton);
            actionsRow.appendChild(closeButton);

            panel.appendChild(heading);
            panel.appendChild(keyboardRow);
            panel.appendChild(themeRow);
            panel.appendChild(actionsRow);

            return panel;
        }
        
        /**
         * Shows the settings panel
         */
        showSettings() {
            if (this.elements.settingsPanel) {
                this.elements.settingsPanel.style.display = 'block';
                return;
            }
            
            const panel = this.createSettingsPanel();
            
            document.body.appendChild(panel);
            this.elements.settingsPanel = panel;
            
            // Add event listeners
            panel.querySelector('#saveSettings').addEventListener('click', () => {
                this.config.enableKeyboardShortcuts = panel.querySelector('#enableKeyboardShortcuts').checked;
                this.config.theme = panel.querySelector('#themeSelect').value;
                
                this.saveUserSettings();
                this.applySettings();
                this.displayFeedback('Settings saved!');
                panel.style.display = 'none';
            });
            
            panel.querySelector('#closeSettings').addEventListener('click', () => {
                panel.style.display = 'none';
            });
        }
        
        /**
         * Applies current settings
         */
        applySettings() {
            // Apply theme
            if (this.config.theme === 'dark') {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            
            // Apply keyboard shortcuts
            if (this.config.enableKeyboardShortcuts) {
                this.addGlobalKeyboardShortcuts();
            } else {
                this.removeGlobalKeyboardShortcuts();
            }
        }
        
        /**
         * Displays a feedback message
         * @param {string} message - The message to display
         * @param {boolean} isError - Whether this is an error message
         */
        displayFeedback(message, isError = false) {
            this.elements.feedbackMessage.textContent = message;
            this.elements.feedbackMessage.style.backgroundColor = isError ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)';
            this.elements.feedbackMessage.style.display = 'block';
            
            setTimeout(() => {
                this.elements.feedbackMessage.style.display = 'none';
            }, this.config.feedbackDuration);
        }
        
        /**
         * Adds global keyboard shortcuts
         */
        addGlobalKeyboardShortcuts() {
            // Remove existing shortcuts first
            this.removeGlobalKeyboardShortcuts();
            
            // Add event listener
            this.keydownHandler = (event) => {
                if (event.ctrlKey && event.key === '1') {
                    this.customAction1();
                } else if (event.ctrlKey && event.key === '2') {
                    this.customAction2();
                } else if (event.ctrlKey && event.key === 's') {
                    event.preventDefault();
                    this.showSettings();
                }
            };
            
            window.addEventListener('keydown', this.keydownHandler);
        }
        
        /**
         * Removes global keyboard shortcuts
         */
        removeGlobalKeyboardShortcuts() {
            if (this.keydownHandler) {
                window.removeEventListener('keydown', this.keydownHandler);
                this.keydownHandler = null;
            }
        }
        
        /**
         * Gets a suggested prompt
         * @returns {string} - A suggested prompt
         */
        getSuggestedPrompt() {
            const prompts = [
                'What are the key features of AI development in 2024?',
                'How can I improve my JavaScript code efficiency?',
                'What are the trends in automation technologies?'
            ];
            return prompts[Math.floor(Math.random() * prompts.length)];
        }
        
        /**
         * Logs an action
         * @param {string} actionType - The type of action
         * @param {string} details - Action details
         */
        logAction(actionType, details) {
            if (window.ChatGPTUtils?.logger) {
                window.ChatGPTUtils.logger('info', `UI Action: ${actionType}`, { details });
            } else {
                console.log(`Action: ${actionType}, Details: ${details}`);
            }
        }
        
        /**
         * Adds a custom action
         * @param {string} text - Button text
         * @param {Function} handler - Action handler
         */
        addCustomAction(text, handler) {
            if (!text || typeof handler !== 'function') {
                this.displayFeedback('Invalid custom action', true);
                return;
            }
            
            this.config.customActions.push({ text, handler: handler.toString() });
            this.saveUserSettings();
            this.refreshMenu();
            this.displayFeedback(`Custom action "${text}" added`);
        }
        
        /**
         * Refreshes the menu with current actions
         */
        refreshMenu() {
            // Remove existing menu
            if (this.elements.buttonContainer) {
                document.body.removeChild(this.elements.buttonContainer);
            }
            
            // Recreate menu
            this.createMenu();
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
                console[level](`[UI] ${message}`, data || '');
            }
        }
        
        /**
         * Cleans up resources
         */
        cleanup() {
            this.removeGlobalKeyboardShortcuts();
            
            // Remove UI elements
            if (this.elements.buttonContainer) {
                document.body.removeChild(this.elements.buttonContainer);
            }
            
            if (this.elements.feedbackMessage) {
                document.body.removeChild(this.elements.feedbackMessage);
            }
            
            if (this.elements.settingsPanel) {
                document.body.removeChild(this.elements.settingsPanel);
            }
            
            this.log('info', 'UI Module cleaned up');
        }
    }
    
    // Register with the hub when available
    (function registerModule() {
        const attemptRegistration = () => {
            if (window.ChatGPTModules) {
                const module = new UserInterfaceModule();
                window.ChatGPTModules.register("UserInterface", "2026.04.05.1", module);
                module.init();
                
                // Register menu commands
                if (typeof GM_registerMenuCommand === 'function') {
                    GM_registerMenuCommand('UI Settings', () => {
                        module.showSettings();
                    });
                }
                return true;
            }
            return false;
        };

        if (attemptRegistration()) {
            return;
        }

        const checkInterval = setInterval(() => {
            if (attemptRegistration()) {
                clearInterval(checkInterval);
            }
        }, 100);
    })();
})();         
