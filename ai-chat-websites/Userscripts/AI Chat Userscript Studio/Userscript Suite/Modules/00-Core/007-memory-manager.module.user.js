// ==UserScript==
// @name         MemoryManager (Compatibility Layer)
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to Hub's memory management for backward compatibility
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
// @grant        none
// ==/UserScript==

/**
 * MemoryManager - Memory monitoring and garbage collection
 * Tracks heap usage and triggers cleanup when needed
 */
(function() {
    'use strict';

    const HYBRID_MODE = true;

    /**
     * Creates a thin compatibility wrapper that delegates to Hub's PerformanceMetrics
     */
    function createCompatibilityLayer() {
        const hubMetrics = window.PerformanceMetrics;

        if (!hubMetrics) {
            console.warn('[MemoryManager] Hub not available, running in standalone mode');
            return createStandaloneMemoryManager();
        }

        console.log('[MemoryManager] Using Hub performance metrics (hybrid mode)');

        // Create delegation wrapper that maintains the MemoryManager API
        const wrapper = {
            heapUsage: [],
            maxSamples: 100,
            threshold: 0,
            cleanupCallback: null,

            setThreshold(bytes) {
                this.threshold = bytes;
            },

            onCleanup(callback) {
                if (typeof callback === 'function') {
                    this.cleanupCallback = callback;
                }
            },

            record() {
                if (performance.memory) {
                    const entry = {
                        timestamp: Date.now(),
                        used: performance.memory.usedJSHeapSize,
                        total: performance.memory.totalJSHeapSize,
                        limit: performance.memory.jsHeapSizeLimit
                    };
                    
                    this.heapUsage.push(entry);
                    if (this.heapUsage.length > this.maxSamples) {
                        this.heapUsage.shift();
                    }
                    
                    return entry;
                }
                return null;
            },

            check() {
                const entry = this.record();
                if (entry && this.threshold > 0 && entry.used > this.threshold) {
                    console.warn('[MemoryManager] Memory threshold exceeded:', {
                        used: this.formatBytes(entry.used),
                        threshold: this.formatBytes(this.threshold)
                    });
                    return true;
                }
                return false;
            },

            getStats() {
                // Delegate to hub for comprehensive metrics
                return hubMetrics.snapshot();
            },

            getSamples(count = 10) {
                return this.heapUsage.slice(-count).map(entry => ({
                    timestamp: new Date(entry.timestamp).toLocaleTimeString(),
                    used: this.formatBytes(entry.used),
                    total: this.formatBytes(entry.total),
                    limit: this.formatBytes(entry.limit)
                }));
            },

            cleanup() {
                this.heapUsage = [];
                
                if (typeof this.cleanupCallback === 'function') {
                    try {
                        this.cleanupCallback();
                    } catch (e) {
                        console.error('[MemoryManager] Cleanup callback error:', e);
                    }
                }
                
                console.log('[MemoryManager] Cleanup completed');
            },

            formatBytes(bytes) {
                if (typeof bytes !== 'number' || bytes <= 0) return '0 B';
                const units = ['B', 'KB', 'MB', 'GB'];
                let i = 0, val = bytes;
                while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
                return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
            },

            startMonitoring(interval = 30000, thresholdBytes = 0) {
                this.setThreshold(thresholdBytes);
                
                const intervalId = setInterval(() => {
                    if (this.check()) {
                        this.cleanup();
                    }
                }, interval);

                console.log('[MemoryManager] Monitoring started', {
                    interval: `${interval}ms`,
                    threshold: this.formatBytes(thresholdBytes)
                });

                return () => {
                    clearInterval(intervalId);
                    console.log('[MemoryManager] Monitoring stopped');
                };
            }
        };

        return wrapper;
    }

    /**
     * Fallback standalone memory manager if Hub is not present
     */
    function createStandaloneMemoryManager() {
        const memoryManager = {
            heapUsage: [],
            maxSamples: 100,
            threshold: 0,
            cleanupCallback: null,

            setThreshold(bytes) {
                this.threshold = bytes;
            },

            onCleanup(callback) {
                if (typeof callback === 'function') {
                    this.cleanupCallback = callback;
                }
            },

            record() {
                if (performance.memory) {
                    const entry = {
                        timestamp: Date.now(),
                        used: performance.memory.usedJSHeapSize,
                        total: performance.memory.totalJSHeapSize,
                        limit: performance.memory.jsHeapSizeLimit
                    };
                    
                    this.heapUsage.push(entry);
                    if (this.heapUsage.length > this.maxSamples) {
                        this.heapUsage.shift();
                    }
                    
                    return entry;
                }
                return null;
            },

            check() {
                const entry = this.record();
                if (entry && this.threshold > 0 && entry.used > this.threshold) {
                    console.warn('[MemoryManager] Memory threshold exceeded:', {
                        used: this.formatBytes(entry.used),
                        threshold: this.formatBytes(this.threshold)
                    });
                    return true;
                }
                return false;
            },

            getStats() {
                if (this.heapUsage.length === 0) return null;

                const avg = this.heapUsage.reduce((a, b) => a + b.used, 0) / this.heapUsage.length;
                const peak = Math.max(...this.heapUsage.map(e => e.used));
                const current = this.heapUsage[this.heapUsage.length - 1]?.used;

                return {
                    average: avg,
                    peak: peak,
                    current: current,
                    threshold: this.threshold,
                    sampleCount: this.heapUsage.length
                };
            },

            getSamples(count = 10) {
                return this.heapUsage.slice(-count).map(entry => ({
                    timestamp: new Date(entry.timestamp).toLocaleTimeString(),
                    used: this.formatBytes(entry.used),
                    total: this.formatBytes(entry.total),
                    limit: this.formatBytes(entry.limit)
                }));
            },

            cleanup() {
                this.heapUsage = [];
                
                if (typeof this.cleanupCallback === 'function') {
                    try {
                        this.cleanupCallback();
                    } catch (e) {
                        console.error('[MemoryManager] Cleanup callback error:', e);
                    }
                }
                
                console.log('[MemoryManager] Cleanup completed');
            },

            formatBytes(bytes) {
                if (typeof bytes !== 'number' || bytes <= 0) return '0 B';
                const units = ['B', 'KB', 'MB', 'GB'];
                let i = 0, val = bytes;
                while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
                return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
            },

            startMonitoring(interval = 30000, thresholdBytes = 0) {
                this.setThreshold(thresholdBytes);
                
                const intervalId = setInterval(() => {
                    if (this.check()) {
                        this.cleanup();
                    }
                }, interval);

                console.log('[MemoryManager] Monitoring started', {
                    interval: `${interval}ms`,
                    threshold: this.formatBytes(thresholdBytes)
                });

                return () => {
                    clearInterval(intervalId);
                    console.log('[MemoryManager] Monitoring stopped');
                };
            }
        };

        return memoryManager;
    }

    // Initialize compatibility layer
    const memoryManager = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneMemoryManager();

    // Export to global scope (only if Hub hasn't already set it)
    if (!window.MemoryManager) {
        window.MemoryManager = memoryManager;
    }

    console.log('[MemoryManager] Compatibility layer initialized v2026.07.04.0');
})();