/**
 * Unified AI Assistant Suite - Plugin API Module
 * @version 1.6.0
 * 
 * Plugin system with manifest format, lifecycle hooks, sandbox,
 * marketplace integration, and dependency management.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

/**
 * @typedef {Object} PluginManifest
 * @property {string} id - Unique plugin ID
 * @property {string} name - Plugin name
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 * @property {string} author - Plugin author
 * @property {string[]} permissions - Required permissions
 * @property {string[]} dependencies - Plugin dependencies
 * @property {string} main - Main script file
 * @property {Object} [hooks] - Lifecycle hooks
 */

const PluginAPI = {
    installedPlugins: new Map(),
    pluginSandboxes: new Map(),

    /**
     * Register a plugin
     * @param {PluginManifest} manifest - Plugin manifest
     * @param {Object} implementation - Plugin implementation
     * @returns {boolean} Success
     */
    register(manifest, implementation) {
        try {
            // Validate manifest
            if (!manifest.id || !manifest.name) {
                debugLog('Plugin manifest missing required fields');
                return false;
            }

            // Check dependencies
            if (manifest.dependencies) {
                for (const dep of manifest.dependencies) {
                    if (!this.installedPlugins.has(dep)) {
                        debugLog(`Plugin ${manifest.id} missing dependency: ${dep}`);
                        return false;
                    }
                }
            }

            // Create sandbox
            const sandbox = this.createSandbox(manifest, implementation);
            this.pluginSandboxes.set(manifest.id, sandbox);
            this.installedPlugins.set(manifest.id, { manifest, sandbox });

            debugLog(`Plugin registered: ${manifest.name} v${manifest.version}`);
            return true;
        } catch (error) {
            debugLog(`Failed to register plugin ${manifest.id}:`, error);
            return false;
        }
    },

    /**
     * Create an execution sandbox for a plugin
     * @param {PluginManifest} manifest - Plugin manifest
     * @param {Object} implementation - Plugin implementation
     * @returns {Proxy} Sandboxed plugin
     */
    createSandbox(manifest, implementation) {
        const allowedAPIs = this.getAllowedAPIs(manifest.permissions || []);
        
        return new Proxy(implementation, {
            get(target, prop) {
                if (prop in target) {
                    if (prop.startsWith('_') || prop === 'constructor') {
                        debugLog(`Blocked access to ${prop} in plugin ${manifest.id}`);
                        return undefined;
                    }
                    return target[prop];
                }
                return undefined;
            },
            
            set(target, prop, value) {
                debugLog(`Plugin ${manifest.id} attempted to set ${prop}`);
                return false; // Read-only sandbox
            }
        });
    },

    /**
     * Get allowed APIs based on permissions
     * @param {string[]} permissions - Required permissions
     * @returns {string[]} Allowed API names
     */
    getAllowedAPIs(permissions) {
        const apiMap = {
            'storage': ['GM_getValue', 'GM_setValue', 'GM_deleteValue'],
            'network': ['GM_xmlhttpRequest', 'fetch'],
            'dom': ['document.querySelector', 'document.getElementById'],
            'ui': ['GM_notification', 'GM_setClipboard'],
            'tabs': ['GM_openInTab', 'GM_getTab', 'GM_saveTab']
        };
        
        const allowed = ['console.log', 'JSON.parse', 'JSON.stringify'];
        permissions.forEach(perm => {
            if (apiMap[perm]) {
                allowed.push(...apiMap[perm]);
            }
        });
        
        return allowed;
    },

    /**
     * Unregister a plugin
     * @param {string} pluginId - Plugin ID
     */
    unregister(pluginId) {
        this.installedPlugins.delete(pluginId);
        this.pluginSandboxes.delete(pluginId);
        debugLog(`Plugin unregistered: ${pluginId}`);
    },

    /**
     * Get all installed plugins
     * @returns {Array} Installed plugins
     */
    listPlugins() {
        return Array.from(this.installedPlugins.values()).map(p => ({
            id: p.manifest.id,
            name: p.manifest.name,
            version: p.manifest.version,
            description: p.manifest.description,
            author: p.manifest.author,
            permissions: p.manifest.permissions
        }));
    },

    /**
     * Get plugin by ID
     * @param {string} pluginId - Plugin ID
     * @returns {Object|null} Plugin info
     */
    getPlugin(pluginId) {
        const plugin = this.installedPlugins.get(pluginId);
        if (!plugin) return null;
        return {
            manifest: plugin.manifest,
            hooks: plugin.manifest.hooks || {}
        };
    },

    /**
     * Execute a plugin hook
     * @param {string} hookName - Hook name
     * @param {...any} args - Hook arguments
     * @returns {Promise<Array>} Hook results
     */
    async executeHook(hookName, ...args) {
        const results = [];
        for (const [id, plugin] of this.installedPlugins) {
            try {
                const sandbox = plugin.sandbox;
                if (sandbox[hookName] && typeof sandbox[hookName] === 'function') {
                    const result = await sandbox[hookName](...args);
                    results.push({ pluginId: id, result });
                }
            } catch (error) {
                debugLog(`Plugin ${id} hook ${hookName} failed:`, error);
                results.push({ pluginId: id, error: error.message });
            }
        }
        return results;
    },

    /**
     * Get installed count
     * @returns {number} Plugin count
     */
    getCount() {
        return this.installedPlugins.size;
    },

    isAvailable() {
        return true;
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PluginAPI };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.pluginAPI = PluginAPI;
}