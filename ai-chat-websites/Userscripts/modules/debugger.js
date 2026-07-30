/**
 * Unified AI Assistant Suite - Advanced Debugging Module
 * @version 1.7.0
 * 
 * Script execution logging, error trace visualization,
 * performance profiling, and network request inspector.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const DebuggerModule = {
    logs: [],
    traces: [],
    profileData: {},
    maxLogEntries: 500,
    isRecording: false,

    /**
     * Initialize debugger
     */
    init() {
        this.interceptConsole();
        this.interceptNetwork();
        debugLog('Debugger module initialized');
    },

    /**
     * Intercept console methods for logging
     */
    interceptConsole() {
        const self = this;
        ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
            const original = console[method];
            console[method] = function(...args) {
                self.addLogEntry({
                    type: method,
                    message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
                    timestamp: Date.now(),
                    stack: new Error().stack
                });
                original.apply(console, args);
            };
        });
    },

    /**
     * Intercept network requests
     */
    interceptNetwork() {
        const originalFetch = window.fetch;
        const self = this;
        window.fetch = async function(...args) {
            const startTime = performance.now();
            const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            
            self.addTraceEntry({
                id: requestId,
                url: typeof args[0] === 'string' ? args[0] : args[0]?.url,
                method: args[1]?.method || 'GET',
                startTime,
                status: 'pending'
            });
            
            try {
                const response = await originalFetch.apply(this, args);
                const duration = performance.now() - startTime;
                self.updateTraceEntry(requestId, {
                    status: response.ok ? 'success' : 'error',
                    duration: Math.round(duration),
                    statusCode: response.status
                });
                return response;
            } catch (error) {
                self.updateTraceEntry(requestId, {
                    status: 'error',
                    error: error.message
                });
                throw error;
            }
        };
    },

    /**
     * Add log entry
     * @param {Object} entry - Log entry
     */
    addLogEntry(entry) {
        this.logs.push(entry);
        if (this.logs.length > this.maxLogEntries) {
            this.logs.shift();
        }
    },

    /**
     * Add trace entry
     * @param {Object} entry - Trace entry
     */
    addTraceEntry(entry) {
        this.traces.push(entry);
    },

    /**
     * Update trace entry
     * @param {string} id - Request ID
     * @param {Object} updates - Partial update
     */
    updateTraceEntry(id, updates) {
        const entry = this.traces.find(t => t.id === id);
        if (entry) Object.assign(entry, updates);
    },

    /**
     * Profile a function execution
     * @param {string} name - Profile name
     * @param {Function} fn - Function to profile
     * @returns {*} Function result
     */
    async profile(name, fn) {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            this.profileData[name] = {
                duration: Math.round(duration),
                success: true,
                timestamp: Date.now()
            };
            return result;
        } catch (error) {
            this.profileData[name] = {
                duration: Math.round(performance.now() - start),
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
            throw error;
        }
    },

    /**
     * Get logs with optional filters
     * @param {Object} [filters] - Filter criteria
     * @returns {Array} Filtered logs
     */
    getLogs(filters = {}) {
        let filtered = [...this.logs];
        if (filters.type) filtered = filtered.filter(l => l.type === filters.type);
        if (filters.since) filtered = filtered.filter(l => l.timestamp >= filters.since);
        if (filters.search) filtered = filtered.filter(l => l.message.toLowerCase().includes(filters.search.toLowerCase()));
        return filtered.slice(-100);
    },

    /**
     * Get performance report
     * @returns {Object} Performance data
     */
    getProfileReport() {
        return {
            profiles: this.profileData,
            networkStats: this.getNetworkStats(),
            logStats: this.getLogStats()
        };
    },

    /**
     * Get network statistics
     * @returns {Object} Network stats
     */
    getNetworkStats() {
        const completed = this.traces.filter(t => t.status !== 'pending');
        return {
            total: this.traces.length,
            success: completed.filter(t => t.status === 'success').length,
            errors: completed.filter(t => t.status === 'error').length,
            pending: this.traces.filter(t => t.status === 'pending').length,
            avgDuration: completed.length > 0
                ? Math.round(completed.reduce((sum, t) => sum + (t.duration || 0), 0) / completed.length)
                : 0
        };
    },

    /**
     * Get log statistics
     * @returns {Object} Log stats
     */
    getLogStats() {
        return {
            total: this.logs.length,
            byType: {
                log: this.logs.filter(l => l.type === 'log').length,
                warn: this.logs.filter(l => l.type === 'warn').length,
                error: this.logs.filter(l => l.type === 'error').length,
                info: this.logs.filter(l => l.type === 'info').length,
                debug: this.logs.filter(l => l.type === 'debug').length
            }
        };
    },

    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        this.traces = [];
    },

    /**
     * Export debug data as JSON
     * @returns {string} JSON export
     */
    export() {
        return JSON.stringify({
            logs: this.logs.slice(-100),
            traces: this.traces.slice(-50),
            profiles: this.profileData,
            exportedAt: new Date().toISOString()
        }, null, 2);
    },

    isAvailable() {
        return true;
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DebuggerModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.debugger = DebuggerModule;
}