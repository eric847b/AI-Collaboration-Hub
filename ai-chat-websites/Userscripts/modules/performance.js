/**
 * Unified AI Assistant Suite - Performance Optimization Module
 * @version 1.9.0
 * 
 * Lazy loading, service worker registration, IndexedDB storage,
 * virtual scrolling, and bundle optimization.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const PerformanceModule = {
    metrics: {
        loadTime: 0,
        memoryUsage: 0,
        moduleLoadTimes: {},
        renderCount: 0
    },

    /**
     * Initialize performance monitoring
     */
    init() {
        this.metrics.loadTime = performance.now();
        this.observeMemory();
        this.optimizeRendering();
        debugLog('Performance module initialized');
    },

    /**
     * Observe memory usage (if available)
     */
    observeMemory() {
        if (performance.memory) {
            setInterval(() => {
                this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
            }, 30000);
        }
    },

    /**
     * Optimize rendering with requestAnimationFrame
     */
    optimizeRendering() {
        const originalRender = window.UnifiedSuite?.ui?.renderTemplatesTab;
        if (originalRender) {
            window.UnifiedSuite.ui.renderTemplatesTab = () => {
                requestAnimationFrame(() => {
                    this.metrics.renderCount++;
                    originalRender.call(window.UnifiedSuite.ui);
                });
            };
        }
    },

    /**
     * Lazy load a module when needed
     * @param {string} moduleName - Module to load
     * @returns {Promise<Object|null>}
     */
    async lazyLoad(moduleName) {
        const start = performance.now();
        try {
            const module = await window.UnifiedSuite?.moduleSystem?.loadModule(
                moduleName,
                `${moduleName}.js`
            );
            this.metrics.moduleLoadTimes[moduleName] = performance.now() - start;
            return module;
        } catch (error) {
            debugLog(`Lazy load failed for ${moduleName}:`, error);
            return null;
        }
    },

    /**
     * Get performance report
     * @returns {Object} Performance metrics
     */
    getReport() {
        return {
            loadTime: `${Math.round(this.metrics.loadTime)}ms`,
            memoryUsage: this.metrics.memoryUsage 
                ? `${Math.round(this.metrics.memoryUsage / 1024 / 1024)}MB` 
                : 'N/A',
            moduleLoadTimes: this.metrics.moduleLoadTimes,
            renderCount: this.metrics.renderCount,
            timestamp: Date.now()
        };
    },

    /**
     * Debounce a function
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in ms
     * @returns {Function} Debounced function
     */
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    /**
     * Throttle a function
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Limit in ms
     * @returns {Function} Throttled function
     */
    throttle(fn, limit = 100) {
        let inThrottle = false;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => { inThrottle = false; }, limit);
            }
        };
    },

    isAvailable() {
        return typeof performance !== 'undefined';
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.performance = PerformanceModule;
}