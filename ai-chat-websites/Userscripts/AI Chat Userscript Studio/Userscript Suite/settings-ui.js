// settings-ui.js - To be included in the Hub

/**
 * Creates and manages a unified settings UI for all modules
 */
class SettingsUI {
    constructor(configManager) {
        this.configManager = configManager;
        this.panel = null;
        this.isVisible = false;
        this.tabs = [];
    }
    
    /**
     * Initializes the settings UI
     */
    init() {
        this.createStyles();
        this.createPanel();
        this.registerCommands();
    }
    
    /**
     * Creates CSS styles for the settings UI
     */
    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .chatgpt-hub-settings {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                max-width: 800px;
                max-height: 80vh;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .chatgpt-hub-settings-header {
                padding: 15px 20px;
                background-color: #4CAF50;
                color: white;
                font-size: 18px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .chatgpt-hub-settings-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
            }
            
            .chatgpt-hub-settings-tabs {
                display: flex;
                background-color: #f5f5f5;
                border-bottom: 1px solid #ddd;
            }
            
            .chatgpt-hub-settings-tab {
                padding: 10px 15px;
                cursor: pointer;
                border: none;
                background: none;
                font-size: 14px;
            }
            
            .chatgpt-hub-settings-tab.active {
                background-color: white;
                border-bottom: 2px solid #4CAF50;
                font-weight: bold;
            }
            
            .chatgpt-hub-settings-content {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }
            
            .chatgpt-hub-settings-section {
                display: none;
            }
            
            .chatgpt-hub-settings-section.active {
                display: block;
            }
            
            .chatgpt-hub-settings-group {
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #eee;
            }
            
            .chatgpt-hub-settings-group h3 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 16px;
            }
            
            .chatgpt-hub-settings-row {
                margin-bottom: 10px;
                display: flex;
                align-items: center;
            }
            
            .chatgpt-hub-settings-label {
                flex: 0 0 40%;
                font-size: 14px;
            }
            
            .chatgpt-hub-settings-input {
                flex: 1;
            }
            
            .chatgpt-hub-settings-footer {
                padding: 15px 20px;
                background-color: #f5f5f5;
                text-align: right;
                border-top: 1px solid #ddd;
            }
            
            .chatgpt-hub-settings-button {
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-left: 10px;
            }
            
            .chatgpt-hub-settings-save {
                background-color: #4CAF50;
                color: white;
            }
            
            .chatgpt-hub-settings-reset {
                background-color: #f44336;
                color: white;
            }
            
            .chatgpt-hub-settings-cancel {
                background-color: #ccc;
                color: black;
            }
            
            /* Dark theme */
            .dark-theme .chatgpt-hub-settings {
                background-color: #2c3e50;
                color: #ecf0f1;
            }
            
            .dark-theme .chatgpt-hub-settings-tabs {
                background-color: #34495e;
                border-color: #2c3e50;
            }
            
            .dark-theme .chatgpt-hub-settings-tab {
                color: #ecf0f1;
            }
            
            .dark-theme .chatgpt-hub-settings-tab.active {
                background-color: #2c3e50;
                border-color: #3498db;
            }
            
            .dark-theme .chatgpt-hub-settings-footer {
                background-color: #34495e;
                border-color: #2c3e50;
            }
            
            .dark-theme .chatgpt-hub-settings-group {
                border-color: #34495e;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Creates the settings panel
     */
    createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'chatgpt-hub-settings';
        this.panel.style.display = 'none';
        
        // Header
        const header = document.createElement('div');
        header.className = 'chatgpt-hub-settings-header';
        header.innerHTML = `
            <span>ChatGPT Hub Settings</span>
            <button class="chatgpt-hub-settings-close">&times;</button>
        `;
        this.panel.appendChild(header);
        
        // Close button event
        header.querySelector('.chatgpt-hub-settings-close').addEventListener('click', () => {
            this.hide();
        });
        
        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'chatgpt-hub-settings-tabs';
        this.panel.appendChild(tabs);
        
        // Content
        const content = document.createElement('div');
        content.className = 'chatgpt-hub-settings-content';
        this.panel.appendChild(content);
        
        // Footer
        const footer = document.createElement('div');
        footer.className = 'chatgpt-hub-settings-footer';
        footer.innerHTML = `
            <button class="chatgpt-hub-settings-button chatgpt-hub-settings-cancel">Cancel</button>
            <button class="chatgpt-hub-settings-button chatgpt-hub-settings-reset">Reset</button>
            <button class="chatgpt-hub-settings-button chatgpt-hub-settings-save">Save</button>
        `;
        this.panel.appendChild(footer);
        
        // Button events
        footer.querySelector('.chatgpt-hub-settings-cancel').addEventListener('click', () => {
            this.hide();
        });
        
        footer.querySelector('.chatgpt-hub-settings-reset').addEventListener('click', () => {
            this.resetSettings();
        });
        
        footer.querySelector('.chatgpt-hub-settings-save').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.body.appendChild(this.panel);
    }
    
    /**
     * Registers menu commands
     */
    registerCommands() {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('ChatGPT Hub Settings', () => {
                this.show();
            });
        }
    }
    
    /**
     * Shows the settings panel
     */
    show() {
        this.refreshTabs();
        this.panel.style.display = 'flex';
        this.isVisible = true;
    }
    
    /**
     * Hides the settings panel
     */
    hide() {
        this.panel.style.display = 'none';
        this.isVisible = false;
    }
    
    /**
     * Refreshes the tabs based on loaded modules
     */
    refreshTabs() {
        const tabsContainer = this.panel.querySelector('.chatgpt-hub-settings-tabs');
        const contentContainer = this.panel.querySelector('.chatgpt-hub-settings-content');
        
        // Clear existing tabs and content
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '';
        
        // Add Hub tab
        this.addTab('Hub', 'hub', this.createHubSettings());
        
        // Add tabs for each module
        if (window.ChatGPTModules) {
            const modules = window.ChatGPTModules.list();
            modules.forEach(module => {
                this.addTab(module.name, module.name.toLowerCase(), this.createModuleSettings(module.name));
            });
        }
        
        // Activate first tab
        if (this.tabs.length > 0) {
            this.activateTab(this.tabs[0]);
        }
    }
    
        /**
         * Adds a tab to the settings panel
         * @param {string} label - Tab label
         * @param {string} id - Tab ID
         * @param {HTMLElement} content - Tab content
         */
        addTab(label, id, content) {
            const tabsContainer = this.panel.querySelector('.chatgpt-hub-settings-tabs');
            const contentContainer = this.panel.querySelector('.chatgpt-hub-settings-content');
            
            // Create tab button
            const tab = document.createElement('button');
            tab.className = 'chatgpt-hub-settings-tab';
            tab.textContent = label;
            tab.dataset.tabId = id;
            tabsContainer.appendChild(tab);
            
            // Create content section
            const section = document.createElement('div');
            section.className = 'chatgpt-hub-settings-section';
            section.dataset.tabId = id;
            section.appendChild(content);
            contentContainer.appendChild(section);
            
            // Add to tabs array
            this.tabs.push(id);
            
            // Add click event
            tab.addEventListener('click', () => {
                this.activateTab(id);
            });
        }
        
        /**
         * Activates a tab
         * @param {string} id - Tab ID to activate
         */
        activateTab(id) {
            // Remove active class from all tabs and sections
            this.panel.querySelectorAll('.chatgpt-hub-settings-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            this.panel.querySelectorAll('.chatgpt-hub-settings-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Add active class to selected tab and section
            this.panel.querySelector(`.chatgpt-hub-settings-tab[data-tab-id="${id}"]`).classList.add('active');
            this.panel.querySelector(`.chatgpt-hub-settings-section[data-tab-id="${id}"]`).classList.add('active');
        }
    }

if (typeof window !== 'undefined') {
    window.SettingsUI = SettingsUI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsUI;
}
