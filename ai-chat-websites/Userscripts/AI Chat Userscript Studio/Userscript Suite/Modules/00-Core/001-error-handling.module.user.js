// ==UserScript==
// @name         Error Handling (Compatibility Layer)
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to Hub's ErrorHandler for backward compatibility
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
// @grant        GM_deleteValue
// @grant        GM_log
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==

/**
 * ErrorHandlingModule Compatibility Layer
 * @deprecated Core error handling is maintained in 00-hub.user.js
 * This module provides delegation to Hub's ErrorHandler with full backward compatibility
 */
(() => {
    'use strict';

    const HYBRID_MODE = true;

    /**
     * Creates a thin compatibility wrapper that delegates to Hub's ErrorHandler
     */
    function createCompatibilityLayer() {
        const hubErrorHandler = window.ErrorHandler;

        if (!hubErrorHandler) {
            console.warn('[ErrorHandlingModule] Hub not available, running in standalone mode');
            return createStandaloneErrorHandling();
        }

        console.log('[ErrorHandlingModule] Using Hub error handler (hybrid mode)');

        // Create delegation wrapper that maintains original API surface
        const wrapper = {
            name: 'ErrorHandling',
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,

            config: {
                retry: {
                    maxRetries: 5,
                    baseDelay: 1000,
                    backoffFactor: 2,
                    maxConcurrent: 3,
                    throttleDelay: 5000,
                    maxDelay: 30000,
                    strategies: {},
                    enableJitter: true,
                    jitterRange: 0.3,
                    enableAdaptiveDelay: true
                },
                circuitBreaker: {
                    threshold: 5,
                    timeout: 60000,
                    halfOpenMaxAttempts: 3,
                    resetTimeout: 120000,
                    failureThreshold: 0.5,
                    successThreshold: 0.8,
                    enabled: true
                },
                logging: {
                    level: 'debug',
                    maxSize: 5242880,
                    retention: 86400000,
                    compression: true,
                    rotateCount: 5,
                    batchSize: 100,
                    flushInterval: 3000,
                    enableStructured: true,
                    exportFormat: 'json'
                },
                healthCheck: {
                    interval: 60000,
                    errorRateThreshold: 0.4,
                    degradedThreshold: 0.6,
                    memoryThreshold: 0.85,
                    responseTimeThreshold: 3000,
                    enableAutoRecovery: true
                },
                deadLetterQueue: {
                    enabled: true,
                    maxSize: 100,
                    retryAfter: 300000,
                    enableNotification: true
                },
                alerting: {
                    enabled: true,
                    channels: ['console'],
                    threshold: 10,
                    cooldown: 60000,
                    enableEscalation: true
                }
            },

            state: {
                retries: 0,
                activeRetries: 0,
                circuitState: 'CLOSED',
                lastCircuitTrip: null,
                halfOpenAttempts: 0,
                metrics: {
                    totalErrors: 0,
                    retries: { attempted: 0, successful: 0, failed: 0 },
                    breakerTrips: 0,
                    recoveries: 0
                }
            },

            async init() {
                console.log('[ErrorHandlingModule] Hybrid mode: delegating to Hub');
                this.state.isInitialized = true;
                return true;
            },

            async cleanup() {
                console.log('[ErrorHandlingModule] Cleanup delegated to Hub');
            },

            async execute() {
                console.log('[ErrorHandlingModule] Execute delegated to Hub');
            },

            // Delegate core methods to Hub
            retry(fn, options = {}) {
                return hubErrorHandler.retry(fn, options);
            },

            circuitBreaker(fn, options = {}) {
                return hubErrorHandler.circuitBreaker(fn, options);
            },

            wrap(fn, onError) {
                return hubErrorHandler.wrap(fn, onError);
            },

            delay(ms) {
                return hubErrorHandler.delay(ms);
            }
        };

        return wrapper;
    }

    /**
     * Fallback standalone error handling if Hub is not present
     */
    function createStandaloneErrorHandling() {
        // Preserve original implementation structure for fallback
        const module = {
            name: 'ErrorHandling',
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,
            
            config: {
                retry: {
                    maxRetries: 5,
                    baseDelay: 1000,
                    backoffFactor: 2,
                    maxConcurrent: 3,
                    throttleDelay: 5000,
                    maxDelay: 30000,
                    strategies: {},
                    enableJitter: true,
                    jitterRange: 0.3,
                    enableAdaptiveDelay: true
                },
                circuitBreaker: {
                    threshold: 5,
                    timeout: 60000,
                    halfOpenMaxAttempts: 3,
                    resetTimeout: 120000,
                    failureThreshold: 0.5,
                    successThreshold: 0.8,
                    enabled: true
                },
                logging: {
                    level: 'debug',
                    maxSize: 5242880,
                    retention: 86400000,
                    compression: true,
                    rotateCount: 5,
                    batchSize: 100,
                    flushInterval: 3000,
                    enableStructured: true,
                    exportFormat: 'json'
                },
                healthCheck: {
                    interval: 60000,
                    errorRateThreshold: 0.4,
                    degradedThreshold: 0.6,
                    memoryThreshold: 0.85,
                    responseTimeThreshold: 3000,
                    enableAutoRecovery: true
                },
                deadLetterQueue: {
                    enabled: true,
                    maxSize: 100,
                    retryAfter: 300000,
                    enableNotification: true
                },
                alerting: {
                    enabled: true,
                    channels: ['console'],
                    threshold: 10,
                    cooldown: 60000,
                    enableEscalation: true
                }
            },

            state: {
                retries: 0,
                activeRetries: 0,
                circuitState: 'CLOSED',
                lastCircuitTrip: null,
                halfOpenAttempts: 0,
                metrics: {
                    totalErrors: 0,
                    retries: { attempted: 0, successful: 0, failed: 0 },
                    breakerTrips: 0,
                    recoveries: 0
                }
            },

            async init() {
                console.log('[ErrorHandlingModule] Standalone mode initialized');
                this.state.isInitialized = true;
                return true;
            },

            async cleanup() {
                console.log('[ErrorHandlingModule] Cleanup executed');
            },

            async execute() {
                console.log('[ErrorHandlingModule] Execute executed');
            },

            retry(fn, options = {}) {
                const maxRetries = options.maxRetries ?? this.config.retry.maxRetries;
                const baseDelay = options.baseDelay ?? this.config.retry.baseDelay;
                const backoffFactor = options.backoffFactor ?? this.config.retry.backoffFactor;
                
                let lastError;
                
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        const result = fn();
                        if (result && typeof result.then === 'function') {
                            return result.then((r) => {
                                if (attempt > 1) console.log(`[ErrorHandlingModule] Retry succeeded on attempt ${attempt}`);
                                return r;
                            });
                        }
                        if (attempt > 1) console.log(`[ErrorHandlingModule] Retry succeeded on attempt ${attempt}`);
                        return result;
                    } catch (error) {
                        lastError = error;
                        console.warn(`[ErrorHandlingModule] Attempt ${attempt} failed:`, error);
                        if (attempt < maxRetries) {
                            const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
                            if (this.config.retry.enableJitter) {
                                const jitter = delay * this.config.retry.jitterRange * (Math.random() - 0.5);
                                delay += jitter;
                            }
                            const start = Date.now();
                            const timeoutId = setTimeout(() => {}, delay);
                            this.state.metrics.retries.attempted++;
                        }
                    }
                }
                
                throw lastError;
            },

            circuitBreaker(fn, options = {}) {
                const threshold = options.threshold ?? this.config.circuitBreaker.threshold;
                const timeout = options.timeout ?? this.config.circuitBreaker.timeout;
                let failures = 0;
                let lastFailure = null;
                let open = false;

                return async (...args) => {
                    if (open) {
                        if (Date.now() - lastFailure > timeout) {
                            open = false;
                            failures = 0;
                        } else {
                            throw new Error('[ErrorHandlingModule] Circuit breaker is open');
                        }
                    }

                    try {
                        const result = fn(...args);
                        if (result && typeof result.then === 'function') {
                            return result.then((r) => {
                                failures = 0;
                                this.state.metrics.retries.successful++;
                                return r;
                            });
                        }
                        failures = 0;
                        this.state.metrics.retries.successful++;
                        return result;
                    } catch (err) {
                        failures++;
                        lastFailure = Date.now();
                        this.state.metrics.retries.failed++;
                        this.state.metrics.breakerTrips++;
                        if (failures >= threshold) open = true;
                        throw err;
                    }
                };
            }
        };

        return module;
    }

    // Initialize compatibility layer
    const errorHandlingInstance = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneErrorHandling();

    // Export to global scope (only if Hub hasn't already set it)
    if (!window.ErrorHandlingModule) {
        window.ErrorHandlingModule = errorHandlingInstance;
    }

    console.log('[ErrorHandlingModule] Compatibility layer initialized v2026.07.04.0');
})();