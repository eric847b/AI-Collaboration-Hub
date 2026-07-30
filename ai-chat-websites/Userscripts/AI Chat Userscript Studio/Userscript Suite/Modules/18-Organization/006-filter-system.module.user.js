// ==UserScript==
// @name         Filter System
// @namespace   AI-Chat-Userscript-Studio
// @version     1.0.0
// @description Advanced filtering
// @match       *://*/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

/**
 * AI Chat Userscript Studio - Module Template
 *
 * This file serves as a boilerplate for rapid module development.
 * Copy this file, rename it, and customize for new modules.
 *
 * Template Structure:
 * - Module ID and versioning pattern
 * - Class-based architecture with init/destroy lifecycle
 * - Config management with localStorage
 * - Public API exposure
 *
 * Usage:
 * 1. Copy this file to Modules/NN-module-name.module.user.js
 * 2. Replace 63. Filter System .M and Advanced filtering in metadata
 * 3. Replace TEMPLATE with your module class name
 * 4. Implement your module methods in the class
 * 5. Update the module ID and version
 */

(function() {
    'use strict';

    const MODULE_ID = '63-filter-system';
    const MODULE_NAME = 'Filter System';
    const MODULE_VERSION = '1.0.0';

    class FilterSystem {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.config = {
                enabled: true,
                // Add your config options here
            };
            this.state = {
                initialized: false,
                instances: 0
            };
        }

        /**
         * Initialize the module
         * @returns {Promise<boolean>} Success status
         */
        async init() {
            try {
                console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);

                // Load persisted config
                this.loadConfig();

                // Validate dependencies
                if (!this.checkDependencies()) {
                    console.warn(`[${MODULE_ID}] Dependencies not satisfied`);
                    return false;
                }

                // Set up module
                this.setup();

                // Expose public API
                this.exposeAPI();

                // Mark as initialized
                this.state.initialized = true;

                console.log(`[${MODULE_ID}] Initialization complete`);
                return true;

            } catch (error) {
                console.error(`[${MODULE_ID}] Initialization failed:`, error);
                return false;
            }
        }

        /**
         * Check if all dependencies are met
         * @returns {boolean}
         */
        checkDependencies() {
            // Override this method if your module has dependencies
            // Example: return window.ConfigManager && window.FileManager;
            return true;
        }

        /**
         * Module-specific setup logic
         */
        setup() {
            // Override this method with your module's setup code
            // This is where you inject styles, create UI, start observers, etc.
        }

        /**
         * Load configuration from localStorage
         */
        loadConfig() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-config`);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    this.config = { ...this.config, ...parsed };
                }
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, error);
            }
        }

        /**
         * Save configuration to localStorage
         */
        saveConfig() {
            try {
                localStorage.setItem(`${MODULE_ID}-config`, JSON.stringify(this.config));
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to save config:`, error);
            }
        }

        /**
         * Update configuration
         * @param {Object} newConfig - New configuration values
         */
        setConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
            this.saveConfig();
            this.onConfigUpdate();
        }

        /**
         * Get current configuration
         * @returns {Object}
         */
        getConfig() {
            return { ...this.config };
        }

        /**
         * Called when configuration is updated
         */
        onConfigUpdate() {
            // Override this method to react to config changes
            console.log(`[${MODULE_ID}] Config updated:`, this.config);
        }

        /**
         * Expose public API to global scope
         */
        exposeAPI() {
            window[`${MODULE_ID}_api`] = {
                getConfig: () => this.getConfig(),
                setConfig: (cfg) => this.setConfig(cfg),
                init: () => this.init(),
                destroy: () => this.destroy(),
                // Add your module's public methods here
            };

            // Also expose instance for debugging
            window[`${MODULE_ID}_instance`] = this;
        }

        /**
         * Clean up module resources
         */
        destroy() {
            try {
                // Remove API from global scope
                delete window[`${MODULE_ID}_api`];
                delete window[`${MODULE_ID}_instance`];

                // Clean up module-specific resources
                this.cleanup();

                this.state.initialized = false;
                console.log(`[${MODULE_ID}] Destroyed successfully`);
            } catch (error) {
                console.error(`[${MODULE_ID}] Cleanup failed:`, error);
            }
        }

        /**
         * Override this method with cleanup logic
         */
        cleanup() {
            // Remove event listeners, observers, timers, etc.
        }
    }

    // Initialize module
    const instance = new TemplateModule();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            instance.init();
        });
    } else {
        instance.init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        instance.destroy();
    });

})();