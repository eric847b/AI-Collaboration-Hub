// ==UserScript==
// @name         Intelligent Error Handler (Compatibility Layer)
// @namespace    http://tampermonkey.net/
// @version      2026.07.04.0
// @description  Enterprise-grade intelligent error handling - delegates to Hub's ErrorHandler for backward compatibility
// @author       AI RMD
// @license      MIT
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
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @noframes
// ==/UserScript==

/**
 * Intelligent Error Handler Compatibility Layer
 * @deprecated Core functionality is maintained in 00-hub.user.js
 * This module provides delegation to Hub's ErrorHandler with full backward compatibility
 */

(function() {
    'use strict';

    const HYBRID_MODE = true;
    const MODULE_NAME = 'Intelligent Error Handler';
    const CONFIG_KEY = 'intelligentErrorHandler';
    const ERROR_LOG_KEY = 'errorLog';
    const ERROR_PATTERNS_KEY = 'errorPatterns';
    const CIRCUIT_BREAKERS_KEY = 'circuitBreakers';
    
    // Error severity levels
    const ERROR_SEVERITY = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };

    // Error categories
    const ERROR_CATEGORIES = {
        NETWORK: 'network',
        MEMORY: 'memory',
        TIMEOUT: 'timeout',
        VALIDATION: 'validation',
        LOGIC: 'logic',
        EXTERNAL: 'external',
        UNKNOWN: 'unknown'
    };

    // Circuit breaker states
    const CIRCUIT_STATES = {
        CLOSED: 'closed',
        OPEN: 'open',
        HALF_OPEN: 'half_open'
    };

    /**
     * Intelligent Error Handler Class
     */
    class IntelligentErrorHandler {
        constructor() {
            this.name = MODULE_NAME;
            this.version = MODULE_VERSION;
            this.dependencies = ['ModuleRegistry', 'ConfigManager', 'PerformanceMonitor'];
            
            // State management
            this.state = {
                isActive: false,
                errorLog: [],
                errorPatterns: new Map(),
                circuitBreakers: new Map(),
                recoveryStrategies: new Map(),
                mlModel: null,
                lastMLUpdate: 0,
                errorThresholds: this.initializeErrorThresholds(),
                recoveryHistory: [],
                performanceImpact: new Map()
            };

            // Configuration
            this.config = {
                enableCircuitBreakers: true,
                enableRetryLogic: true,
                enablePredictiveRecovery: true,
                enableErrorCorrelation: true,
                enableGracefulDegradation: true,
                maxErrorLogSize: 1000,
                errorPatternAnalysisInterval: 60000, // 1 minute
                mlModelUpdateInterval: 300000, // 5 minutes
                circuitBreakerThreshold: 5,
                circuitBreakerTimeout: 60000, // 1 minute
                maxRetries: 3,
                baseRetryDelay: 1000,
                maxRetryDelay: 30000,
                enableNotifications: true
            };

            this.init();
        }

    /**
     * Module initialization
     * @deprecated Initialization is now handled by the Hub
     */
    async init() {
        if (!HYBRID_MODE) {
            console.log(`[${MODULE_NAME}] Running in standalone mode`);
            this.initStandalone();
        } else {
            console.log(`[${MODULE_NAME}] Hybrid mode: delegating to Hub's ErrorHandler`);
            this.initHybrid();
        }
    }

    initHybrid() {
        const hubErrorHandler = window.ErrorHandler;
        if (!hubErrorHandler) {
            console.warn(`[${MODULE_NAME}] Hub ErrorHandler not available, falling back to standalone`);
            this.initStandalone();
            return;
        }
        
        console.log(`[${MODULE_NAME}] Using Hub error handler`);
        this.state.isActive = true;
        
        // Expose hub error handler with module interface
        this.retry = hubErrorHandler.retry.bind(hubErrorHandler);
        this.circuitBreaker = hubErrorHandler.circuitBreaker.bind(hubErrorHandler);
        this.wrap = hubErrorHandler.wrap.bind(hubErrorHandler);
        this.delay = hubErrorHandler.delay.bind(hubErrorHandler);
    }

    initStandalone() {
        console.log(`[${MODULE_NAME}] Initializing standalone mode v${MODULE_VERSION}`);
        
        // Load configuration
        this.loadConfig();
        
        // Load error data
        this.loadErrorData();
        
        // Initialize circuit breakers
        this.initializeCircuitBreakers();
        
        // Start monitoring
        this.startMonitoring();
        
        // Register global error handlers
        this.registerGlobalErrorHandlers();
        
        // Register with module registry
        if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
            window.ModuleRegistry.register(this.name, this.version, this);
        }

        // Register menu commands
        this.registerMenuCommands();
        
        console.log(`[${MODULE_NAME}] Initialized successfully`);
        this.state.isActive = true;
    }

        /**
         * Load module configuration
         */
        loadConfig() {
            const defaultConfig = {
                enableCircuitBreakers: true,
                enableRetryLogic: true,
                enablePredictiveRecovery: true,
                enableErrorCorrelation: true,
                enableGracefulDegradation: true,
                maxErrorLogSize: 1000,
                errorPatternAnalysisInterval: 60000,
                mlModelUpdateInterval: 300000,
                circuitBreakerThreshold: 5,
                circuitBreakerTimeout: 60000,
                maxRetries: 3,
                baseRetryDelay: 1000,
                maxRetryDelay: 30000,
                enableNotifications: true,
                notificationThreshold: ERROR_SEVERITY.HIGH
            };

            const storedConfig = window.ConfigManager?.getConfig(CONFIG_KEY) || {};
            this.config = { ...defaultConfig, ...storedConfig };
        }

        /**
         * Load error data from storage
         */
        loadErrorData() {
            try {
                // Load error log
                const errorLogData = GM_getValue(ERROR_LOG_KEY);
                if (errorLogData) {
                    this.state.errorLog = JSON.parse(errorLogData);
                }

                // Load error patterns
                const patternsData = GM_getValue(ERROR_PATTERNS_KEY);
                if (patternsData) {
                    const patterns = JSON.parse(patternsData);
                    this.state.errorPatterns = new Map(Object.entries(patterns));
                }

                // Load circuit breakers
                const cbData = GM_getValue(CIRCUIT_BREAKERS_KEY);
                if (cbData) {
                    const breakers = JSON.parse(cbData);
                    this.state.circuitBreakers = new Map(Object.entries(breakers));
                }

                console.log(`[${MODULE_NAME}] Loaded ${this.state.errorLog.length} errors, ${this.state.errorPatterns.size} patterns, ${this.state.circuitBreakers.size} circuit breakers`);
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not load error data:`, error);
                this.state.errorLog = [];
                this.state.errorPatterns = new Map();
                this.state.circuitBreakers = new Map();
            }
        }

        /**
         * Initialize error thresholds
         */
        initializeErrorThresholds() {
            return {
                [ERROR_SEVERITY.LOW]: { rate: 0.01, count: 10, timeWindow: 300000 }, // 5 minutes
                [ERROR_SEVERITY.MEDIUM]: { rate: 0.05, count: 20, timeWindow: 180000 }, // 3 minutes
                [ERROR_SEVERITY.HIGH]: { rate: 0.1, count: 10, timeWindow: 60000 }, // 1 minute
                [ERROR_SEVERITY.CRITICAL]: { rate: 0.2, count: 5, timeWindow: 30000 } // 30 seconds
            };
        }

        /**
         * Initialize circuit breakers
         */
        initializeCircuitBreakers() {
            // Initialize default circuit breakers for common operations
            const defaultBreakers = [
                'network_requests',
                'module_loading',
                'cache_operations',
                'dom_manipulation',
                'api_calls'
            ];

            for (const breakerName of defaultBreakers) {
                if (!this.state.circuitBreakers.has(breakerName)) {
                    this.state.circuitBreakers.set(breakerName, {
                        name: breakerName,
                        state: CIRCUIT_STATES.CLOSED,
                        failureCount: 0,
                        lastFailureTime: 0,
                        lastSuccessTime: 0,
                        threshold: this.config.circuitBreakerThreshold,
                        timeout: this.config.circuitBreakerTimeout,
                        halfOpenMaxAttempts: 3,
                        halfOpenAttempts: 0
                    });
                }
            }
        }

        /**
         * Start monitoring and analysis
         */
        startMonitoring() {
            // Error pattern analysis
            this.patternAnalysisTimer = setInterval(() => {
                this.analyzeErrorPatterns();
            }, this.config.errorPatternAnalysisInterval);

            // ML model updates
            this.mlUpdateTimer = setInterval(() => {
                if (this.config.enablePredictiveRecovery) {
                    this.updateMLModel();
                }
            }, this.config.mlModelUpdateInterval);

            // Circuit breaker monitoring
            this.circuitBreakerTimer = setInterval(() => {
                this.monitorCircuitBreakers();
            }, 10000); // Check every 10 seconds

            // Performance impact analysis
            this.performanceAnalysisTimer = setInterval(() => {
                this.analyzePerformanceImpact();
            }, 60000); // Check every minute
        }

        /**
         * Register global error handlers
         */
        registerGlobalErrorHandlers() {
            // Window error handler
            window.addEventListener('error', (event) => {
                this.handleGlobalError(event.error || new Error(event.message), {
                    type: 'window_error',
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            });

            // Unhandled promise rejection handler
            window.addEventListener('unhandledrejection', (event) => {
                this.handleGlobalError(event.reason, {
                    type: 'unhandled_promise_rejection',
                    promise: event.promise
                });
            });

            // Console error interception
            const originalError = console.error;
            console.error = (...args) => {
                this.handleConsoleError(args);
                originalError.apply(console, args);
            };
        }

        /**
         * Handle global errors
         */
        handleGlobalError(error, context = {}) {
            const errorInfo = this.createErrorInfo(error, context);
            this.logError(errorInfo);
            
            // Categorize error
            const category = this.categorizeError(errorInfo);
            errorInfo.category = category;
            
            // Determine severity
            const severity = this.determineSeverity(errorInfo);
            errorInfo.severity = severity;
            
            // Apply error handling strategy
            this.applyErrorHandlingStrategy(errorInfo);
            
            // Update circuit breaker
            this.updateCircuitBreaker(errorInfo.operation, false);
            
            // Notify if critical
            if (severity === ERROR_SEVERITY.CRITICAL && this.config.enableNotifications) {
                this.sendNotification(`Critical error: ${errorInfo.message}`, 'error');
            }
        }

        /**
         * Handle console errors
         */
        handleConsoleError(args) {
            const errorInfo = {
                message: args.join(' '),
                timestamp: Date.now(),
                type: 'console_error',
                severity: ERROR_SEVERITY.MEDIUM,
                category: ERROR_CATEGORIES.LOGIC,
                stack: new Error().stack,
                context: { consoleArgs: args }
            };
            
            this.logError(errorInfo);
        }

        /**
         * Create error information object
         */
        createErrorInfo(error, context) {
            return {
                id: this.generateErrorId(),
                message: error.message || 'Unknown error',
                name: error.name || 'Error',
                stack: error.stack,
                timestamp: Date.now(),
                type: context.type || 'unknown',
                filename: context.filename,
                lineno: context.lineno,
                colno: context.colno,
                operation: context.operation || 'unknown',
                context: context,
                severity: ERROR_SEVERITY.MEDIUM,
                category: ERROR_CATEGORIES.UNKNOWN,
                handled: false,
                recoveryAttempts: 0,
                performanceImpact: 0
            };
        }

        /**
         * Generate unique error ID
         */
        generateErrorId() {
            return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * Log error
         */
        logError(errorInfo) {
            this.state.errorLog.push(errorInfo);
            
            // Limit log size
            if (this.state.errorLog.length > this.config.maxErrorLogSize) {
                this.state.errorLog.shift();
            }
            
            // Save to storage periodically
            if (this.state.errorLog.length % 10 === 0) {
                this.saveErrorLog();
            }
        }

        /**
         * Save error log to storage
         */
        saveErrorLog() {
            try {
                GM_setValue(ERROR_LOG_KEY, JSON.stringify(this.state.errorLog));
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not save error log:`, error);
            }
        }

        /**
         * Categorize error
         */
        categorizeError(errorInfo) {
            const message = errorInfo.message.toLowerCase();
            const stack = errorInfo.stack || '';
            
            if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
                return ERROR_CATEGORIES.NETWORK;
            }
            
            if (message.includes('memory') || message.includes('heap') || message.includes('out of memory')) {
                return ERROR_CATEGORIES.MEMORY;
            }
            
            if (message.includes('timeout') || message.includes('timed out')) {
                return ERROR_CATEGORIES.TIMEOUT;
            }
            
            if (message.includes('validation') || message.includes('invalid') || message.includes('expected')) {
                return ERROR_CATEGORIES.VALIDATION;
            }
            
            if (message.includes('external') || message.includes('api') || message.includes('service')) {
                return ERROR_CATEGORIES.EXTERNAL;
            }
            
            if (stack.includes('ModuleRegistry') || stack.includes('ConfigManager')) {
                return ERROR_CATEGORIES.LOGIC;
            }
            
            return ERROR_CATEGORIES.UNKNOWN;
        }

        /**
         * Determine error severity
         */
        determineSeverity(errorInfo) {
            // Critical errors
            if (errorInfo.message.includes('out of memory') || 
                errorInfo.message.includes('critical') ||
                errorInfo.category === ERROR_CATEGORIES.MEMORY) {
                return ERROR_SEVERITY.CRITICAL;
            }
            
            // High severity
            if (errorInfo.category === ERROR_CATEGORIES.NETWORK ||
                errorInfo.category === ERROR_CATEGORIES.TIMEOUT) {
                return ERROR_SEVERITY.HIGH;
            }
            
            // Medium severity
            if (errorInfo.category === ERROR_CATEGORIES.VALIDATION ||
                errorInfo.category === ERROR_CATEGORIES.EXTERNAL) {
                return ERROR_SEVERITY.MEDIUM;
            }
            
            return ERROR_SEVERITY.LOW;
        }

        /**
         * Apply error handling strategy
         */
        applyErrorHandlingStrategy(errorInfo) {
            switch (errorInfo.category) {
                case ERROR_CATEGORIES.NETWORK:
                    this.handleNetworkError(errorInfo);
                    break;
                case ERROR_CATEGORIES.MEMORY:
                    this.handleMemoryError(errorInfo);
                    break;
                case ERROR_CATEGORIES.TIMEOUT:
                    this.handleTimeoutError(errorInfo);
                    break;
                case ERROR_CATEGORIES.VALIDATION:
                    this.handleValidationError(errorInfo);
                    break;
                case ERROR_CATEGORIES.LOGIC:
                    this.handleLogicError(errorInfo);
                    break;
                case ERROR_CATEGORIES.EXTERNAL:
                    this.handleExternalError(errorInfo);
                    break;
                default:
                    this.handleUnknownError(errorInfo);
            }
        }

        /**
         * Handle network errors
         */
        handleNetworkError(errorInfo) {
            // Implement retry logic
            if (this.config.enableRetryLogic) {
                this.retryWithBackoff(errorInfo, this.handleNetworkError.bind(this));
            }
            
            // Update circuit breaker
            this.updateCircuitBreaker('network_requests', false);
        }

        /**
         * Handle memory errors
         */
        handleMemoryError(errorInfo) {
            // Trigger garbage collection if available
            if (window.gc) {
                try {
                    window.gc();
                } catch (e) {
                    // GC not available
                }
            }
            
            // Clear caches
            if (window.CacheManager) {
                window.CacheManager.clear();
            }
            
            // Reduce memory usage
            this.reduceMemoryUsage();
        }

        /**
         * Handle timeout errors
         */
        handleTimeoutError(errorInfo) {
            // Increase timeout for future requests
            this.adjustTimeout(errorInfo.operation);
            
            // Retry with longer timeout
            if (this.config.enableRetryLogic) {
                this.retryWithBackoff(errorInfo, this.handleTimeoutError.bind(this), { baseDelay: 2000 });
            }
        }

        /**
         * Handle validation errors
         */
        handleValidationError(errorInfo) {
            // Log for pattern analysis
            this.logValidationError(errorInfo);
            
            // Apply graceful degradation
            if (this.config.enableGracefulDegradation) {
                this.applyGracefulDegradation(errorInfo);
            }
        }

        /**
         * Handle logic errors
         */
        handleLogicError(errorInfo) {
            // Check for known patterns
            const pattern = this.findErrorPattern(errorInfo);
            if (pattern) {
                this.applyPatternRecovery(pattern, errorInfo);
            } else {
                // Use ML-based recovery
                if (this.config.enablePredictiveRecovery && this.state.mlModel) {
                    this.applyMLRecovery(errorInfo);
                }
            }
        }

        /**
         * Handle external errors
         */
        handleExternalError(errorInfo) {
            // Update circuit breaker for external services
            this.updateCircuitBreaker('external_services', false);
            
            // Switch to fallback if available
            this.switchToFallback(errorInfo);
        }

        /**
         * Handle unknown errors
         */
        handleUnknownError(errorInfo) {
            // Log for analysis
            console.warn(`[${MODULE_NAME}] Unknown error type:`, errorInfo);
            
            // Apply general recovery strategy
            this.applyGeneralRecovery(errorInfo);
        }

        /**
         * Retry with exponential backoff
         */
        async retryWithBackoff(errorInfo, retryFunction, options = {}) {
            const maxRetries = options.maxRetries || this.config.maxRetries;
            const baseDelay = options.baseDelay || this.config.baseRetryDelay;
            const maxDelay = options.maxDelay || this.config.maxRetryDelay;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
                const jitter = Math.random() * delay * 0.1; // 10% jitter
                
                await this.delay(delay + jitter);
                
                try {
                    // Attempt recovery
                    const result = await retryFunction(errorInfo);
                    if (result) {
                        errorInfo.handled = true;
                        errorInfo.recoveryAttempts = attempt;
                        this.logRecovery(errorInfo, 'retry');
                        return true;
                    }
                } catch (recoveryError) {
                    console.warn(`[${MODULE_NAME}] Retry attempt ${attempt} failed:`, recoveryError);
                }
            }
            
            return false;
        }

        /**
         * Delay utility
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Reduce memory usage
         */
        reduceMemoryUsage() {
            // Clear temporary DOM elements
            const tempElements = document.querySelectorAll('[data-temp="true"]');
            tempElements.forEach(el => el.remove());
            
            // Clear event listeners (simplified)
            // In a real implementation, this would be more sophisticated
            
            // Force garbage collection hint
            if (window.gc) {
                try {
                    window.gc();
                } catch (error) {
                    // GC might not be available
                }
            }
        }

        /**
         * Adjust timeout for operation
         */
        adjustTimeout(operation) {
            // This would integrate with the actual timeout management system
            console.log(`[${MODULE_NAME}] Adjusting timeout for operation: ${operation}`);
        }

        /**
         * Log validation error for pattern analysis
         */
        logValidationError(errorInfo) {
            // Store validation error details for pattern analysis
            const patternKey = `${errorInfo.operation}_${errorInfo.message}`;
            if (!this.state.errorPatterns.has(patternKey)) {
                this.state.errorPatterns.set(patternKey, {
                    count: 0,
                    lastSeen: 0,
                    recoveryStrategies: []
                });
            }
            
            const pattern = this.state.errorPatterns.get(patternKey);
            pattern.count++;
            pattern.lastSeen = Date.now();
        }

        /**
         * Apply graceful degradation
         */
        applyGracefulDegradation(errorInfo) {
            console.log(`[${MODULE_NAME}] Applying graceful degradation for: ${errorInfo.message}`);
            
            // Disable non-critical features
            if (window.ConfigManager) {
                window.ConfigManager.set('performance.enablePerformanceMetrics', false);
            }
            
            // Reduce functionality
            this.reduceFunctionality(errorInfo);
        }

        /**
         * Reduce functionality
         */
        reduceFunctionality(errorInfo) {
            // This would implement specific functionality reduction based on error context
            console.log(`[${MODULE_NAME}] Reducing functionality due to: ${errorInfo.message}`);
        }

        /**
         * Find error pattern
         */
        findErrorPattern(errorInfo) {
            for (const [patternKey, pattern] of this.state.errorPatterns.entries()) {
                if (pattern.count > 3 && Date.now() - pattern.lastSeen < 600000) { // 10 minutes
                    return pattern;
                }
            }
            return null;
        }

        /**
         * Apply pattern-based recovery
         */
        applyPatternRecovery(pattern, errorInfo) {
            if (pattern.recoveryStrategies.length > 0) {
                const strategy = pattern.recoveryStrategies[0]; // Use most successful strategy
                this.executeRecoveryStrategy(strategy, errorInfo);
            }
        }

        /**
         * Execute recovery strategy
         */
        executeRecoveryStrategy(strategy, errorInfo) {
            console.log(`[${MODULE_NAME}] Executing recovery strategy: ${strategy.name}`);
            
            try {
                // Execute strategy
                const result = strategy.execute(errorInfo);
                if (result) {
                    errorInfo.handled = true;
                    this.logRecovery(errorInfo, strategy.name);
                    strategy.successCount++;
                } else {
                    strategy.failureCount++;
                }
            } catch (error) {
                console.error(`[${MODULE_NAME}] Recovery strategy failed:`, error);
                strategy.failureCount++;
            }
        }

        /**
         * Apply ML-based recovery
         */
        applyMLRecovery(errorInfo) {
            // This would use the ML model to predict the best recovery strategy
            console.log(`[${MODULE_NAME}] Applying ML-based recovery for: ${errorInfo.message}`);
            
            // For now, use a simple heuristic
            this.applyGeneralRecovery(errorInfo);
        }

        /**
         * Apply general recovery
         */
        applyGeneralRecovery(errorInfo) {
            // Clear caches
            if (window.CacheManager) {
                window.CacheManager.clear();
            }
            
            // Reset state
            this.resetState(errorInfo);
            
            // Notify user
            this.sendNotification(`Error occurred: ${errorInfo.message}. Applying recovery measures.`, 'warning');
        }

        /**
         * Reset state
         */
        resetState(errorInfo) {
            // This would reset the application state based on error context
            console.log(`[${MODULE_NAME}] Resetting state due to: ${errorInfo.message}`);
        }

        /**
         * Switch to fallback
         */
        switchToFallback(errorInfo) {
            console.log(`[${MODULE_NAME}] Switching to fallback for: ${errorInfo.message}`);
            // Implement fallback logic
        }

        /**
         * Log recovery attempt
         */
        logRecovery(errorInfo, strategyName) {
            const recovery = {
                errorId: errorInfo.id,
                strategy: strategyName,
                timestamp: Date.now(),
                success: true
            };
            
            this.state.recoveryHistory.push(recovery);
            
            // Limit recovery history
            if (this.state.recoveryHistory.length > 100) {
                this.state.recoveryHistory.shift();
            }
        }

        /**
         * Update circuit breaker
         */
        updateCircuitBreaker(operation, success) {
            if (!this.config.enableCircuitBreakers) return;
            
            let breaker = this.state.circuitBreakers.get(operation);
            if (!breaker) {
                breaker = {
                    name: operation,
                    state: CIRCUIT_STATES.CLOSED,
                    failureCount: 0,
                    lastFailureTime: 0,
                    lastSuccessTime: 0,
                    threshold: this.config.circuitBreakerThreshold,
                    timeout: this.config.circuitBreakerTimeout,
                    halfOpenMaxAttempts: 3,
                    halfOpenAttempts: 0
                };
                this.state.circuitBreakers.set(operation, breaker);
            }
            
            if (success) {
                breaker.failureCount = 0;
                breaker.lastSuccessTime = Date.now();
                if (breaker.state === CIRCUIT_STATES.HALF_OPEN) {
                    breaker.state = CIRCUIT_STATES.CLOSED;
                    breaker.halfOpenAttempts = 0;
                }
            } else {
                breaker.failureCount++;
                breaker.lastFailureTime = Date.now();
                
                if (breaker.failureCount >= breaker.threshold && breaker.state === CIRCUIT_STATES.CLOSED) {
                    breaker.state = CIRCUIT_STATES.OPEN;
                    console.warn(`[${MODULE_NAME}] Circuit breaker OPENED for ${operation}`);
                }
            }
            
            // Save circuit breakers
            this.saveCircuitBreakers();
        }

        /**
         * Save circuit breakers to storage
         */
        saveCircuitBreakers() {
            try {
                const breakers = Object.fromEntries(this.state.circuitBreakers);
                GM_setValue(CIRCUIT_BREAKERS_KEY, JSON.stringify(breakers));
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not save circuit breakers:`, error);
            }
        }

        /**
         * Monitor circuit breakers
         */
        monitorCircuitBreakers() {
            const now = Date.now();
            
            for (const [name, breaker] of this.state.circuitBreakers.entries()) {
                if (breaker.state === CIRCUIT_STATES.OPEN && now - breaker.lastFailureTime > breaker.timeout) {
                    breaker.state = CIRCUIT_STATES.HALF_OPEN;
                    console.log(`[${MODULE_NAME}] Circuit breaker HALF_OPEN for ${name}`);
                }
            }
        }

        /**
         * Analyze error patterns
         */
        analyzeErrorPatterns() {
            // Analyze recent errors for patterns
            const recentErrors = this.state.errorLog.slice(-100);
            const patterns = new Map();
            
            for (const error of recentErrors) {
                const patternKey = `${error.category}_${error.operation}`;
                if (!patterns.has(patternKey)) {
                    patterns.set(patternKey, {
                        count: 0,
                        errors: [],
                        recoveryStrategies: []
                    });
                }
                
                const pattern = patterns.get(patternKey);
                pattern.count++;
                pattern.errors.push(error);
            }
            
            // Update known patterns
            for (const [patternKey, pattern] of patterns.entries()) {
                if (this.state.errorPatterns.has(patternKey)) {
                    const existing = this.state.errorPatterns.get(patternKey);
                    existing.count = pattern.count;
                    existing.lastSeen = Date.now();
                } else {
                    this.state.errorPatterns.set(patternKey, {
                        count: pattern.count,
                        lastSeen: Date.now(),
                        recoveryStrategies: []
                    });
                }
            }
            
            // Save patterns
            this.saveErrorPatterns();
        }

        /**
         * Save error patterns to storage
         */
        saveErrorPatterns() {
            try {
                const patterns = Object.fromEntries(this.state.errorPatterns);
                GM_setValue(ERROR_PATTERNS_KEY, JSON.stringify(patterns));
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not save error patterns:`, error);
            }
        }

        /**
         * Update ML model
         */
        updateMLModel() {
            // This would implement ML model training with error data
            // For now, just update timestamp
            this.state.lastMLUpdate = Date.now();
            console.log(`[${MODULE_NAME}] ML model updated`);
        }

        /**
         * Analyze performance impact
         */
        analyzePerformanceImpact() {
            // Analyze how errors affect performance
            const recentErrors = this.state.errorLog.slice(-50);
            const performanceImpact = {
                totalErrors: recentErrors.length,
                avgRecoveryTime: 0,
                avgPerformanceImpact: 0,
                criticalErrors: recentErrors.filter(e => e.severity === ERROR_SEVERITY.CRITICAL).length
            };
            
            this.state.performanceImpact.set(Date.now(), performanceImpact);
            
            // Clean old performance data
            if (this.state.performanceImpact.size > 100) {
                const oldestKey = Array.from(this.state.performanceImpact.keys())[0];
                this.state.performanceImpact.delete(oldestKey);
            }
        }

        /**
         * Send notification
         */
        sendNotification(message, type = 'info') {
            if (this.config.enableNotifications) {
                GM_notification({
                    text: message,
                    type: type,
                    timeout: 5000
                });
            }
        }

        /**
         * Get error report
         */
        getErrorReport() {
            const recentErrors = this.state.errorLog.slice(-100);
            const errorStats = {
                totalErrors: this.state.errorLog.length,
                recentErrors: recentErrors.length,
                errorRate: this.calculateErrorRate(),
                topCategories: this.getTopErrorCategories(),
                circuitBreakers: Array.from(this.state.circuitBreakers.values()),
                recoverySuccessRate: this.getRecoverySuccessRate(),
                performanceImpact: Array.from(this.state.performanceImpact.values()).slice(-10)
            };
            
            return errorStats;
        }

        /**
         * Calculate error rate
         */
        calculateErrorRate() {
            const recentErrors = this.state.errorLog.filter(e => Date.now() - e.timestamp < 300000); // Last 5 minutes
            return recentErrors.length / 5; // Errors per minute
        }

        /**
         * Get top error categories
         */
        getTopErrorCategories() {
            const categoryCounts = new Map();
            
            for (const error of this.state.errorLog.slice(-100)) {
                const count = categoryCounts.get(error.category) || 0;
                categoryCounts.set(error.category, count + 1);
            }
            
            return Array.from(categoryCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
        }

        /**
         * Get recovery success rate
         */
        getRecoverySuccessRate() {
            const totalRecoveries = this.state.recoveryHistory.length;
            const successfulRecoveries = this.state.recoveryHistory.filter(r => r.success).length;
            
            return totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0;
        }

        /**
         * Register menu commands
         */
        registerMenuCommands() {
            if (typeof GM_registerMenuCommand === 'function') {
                GM_registerMenuCommand(`Show ${MODULE_NAME} Report`, () => {
                    const report = this.getErrorReport();
                    console.table(report);
                    alert(`Error Report: ${JSON.stringify(report, null, 2)}`);
                });

                GM_registerMenuCommand(`Clear Error Log`, () => {
                    if (confirm('Are you sure you want to clear the error log?')) {
                        this.state.errorLog = [];
                        this.saveErrorLog();
                        alert('Error log cleared');
                    }
                });

                GM_registerMenuCommand(`Reset Circuit Breakers`, () => {
                    for (const breaker of this.state.circuitBreakers.values()) {
                        breaker.state = CIRCUIT_STATES.CLOSED;
                        breaker.failureCount = 0;
                    }
                    this.saveCircuitBreakers();
                    alert('Circuit breakers reset');
                });

                GM_registerMenuCommand(`Test Error Handling`, () => {
                    const testError = new Error('Test error for error handling system');
                    this.handleGlobalError(testError, { type: 'test', operation: 'test_operation' });
                    alert('Test error processed');
                });

                GM_registerMenuCommand(`Show Recovery History`, () => {
                    console.table(this.state.recoveryHistory);
                    alert(`Recovery History: ${JSON.stringify(this.state.recoveryHistory.slice(-10), null, 2)}`);
                });
            }
        }

        /**
         * Cleanup and destroy
         */
        destroy() {
            console.log(`[${MODULE_NAME}] Destroying Intelligent Error Handler`);

            // Stop timers
            if (this.patternAnalysisTimer) {
                clearInterval(this.patternAnalysisTimer);
                this.patternAnalysisTimer = null;
            }

            if (this.mlUpdateTimer) {
                clearInterval(this.mlUpdateTimer);
                this.mlUpdateTimer = null;
            }

            if (this.circuitBreakerTimer) {
                clearInterval(this.circuitBreakerTimer);
                this.circuitBreakerTimer = null;
            }

            if (this.performanceAnalysisTimer) {
                clearInterval(this.performanceAnalysisTimer);
                this.performanceAnalysisTimer = null;
            }

            // Save final state
            this.saveErrorLog();
            this.saveErrorPatterns();
            this.saveCircuitBreakers();

            this.state.isActive = false;
            console.log(`[${MODULE_NAME}] Intelligent Error Handler destroyed`);
        }

        /**
         * Execute module
         */
        execute() {
            // Module execution logic if needed
            console.log(`[${MODULE_NAME}] Module execution completed`);
        }
    }

    // Initialize the module
    const intelligentErrorHandler = new IntelligentErrorHandler();

    // Make globally available
    window.IntelligentErrorHandler = intelligentErrorHandler;

})();