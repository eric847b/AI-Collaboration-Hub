// ==UserScript==
// @name                ChatGPT - AI-Script Auto Updater Module - AI RMD
// @description         Automatically installs, updates, or executes code provided by AI
// @version             26.10.2024
// @match               https://chat.openai.com/*
// @match               https://chatgpt.com/*
// @grant               GM_setValue
// @grant               GM_getValue
// @grant               GM_xmlhttpRequest
// @grant               GM_notification
// @require             https://cdn.jsdelivr.net/gh/kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==

// Function to detect AI code suggestions and handle them
function handleAIResponse(responseText) {
    if (!responseText || typeof responseText !== 'string' || responseText.trim().length === 0) {
        const errorMessage = 'Invalid or empty response received';
        showNotification(errorMessage, 'error');
        logError(new Error(errorMessage), 'validation', { 
            responseText: responseText?.toString() || 'undefined', 
            type: typeof responseText, 
            length: responseText?.length || 0,
            isString: typeof responseText === 'string',
            isEmpty: !responseText?.trim(),
            timestamp: Date.now(),
            stackTrace: new Error().stack
        });
        return null;
    }
    
    try {        
        const codeMatch = responseText.match(/\/\* (install|update|run):(.+?)\*\//i);
        if (!codeMatch) {
            showNotification('No valid code block found', 'warning');
            return;
        }

        const action = codeMatch[1].toLowerCase(); // install/update/run
        const code = codeMatch[2].trim(); // Extract the code block

        // Enhanced rate limiting with exponential backoff and request tracking
        const rateLimitStatus = checkRateLimit(action);
        if (!rateLimitStatus.allowed) {
            showNotification(`Too many ${action} operations. Please wait ${rateLimitStatus.waitTime}s.`, 'warning');
            return;
        }

        // Stricter code validation with size limits
        const MAX_CODE_LENGTH = 50000;
        const MIN_CODE_LENGTH = 1;
        if (!code || code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
            showNotification(`Code length must be between ${MIN_CODE_LENGTH} and ${MAX_CODE_LENGTH} characters. Current: ${code.length}`, 'error');
            return;
        }

        // Enhanced code validation with security checks and detailed feedback
        const validationResult = validateCode(code, action);
        if (!validationResult.isValid) {
            showNotification(`Code validation failed: ${validationResult.reason}`, 'error');
            logError(new Error(validationResult.reason), 'validation', code);
            return;
        }

        // Action handler with error boundaries and retry logic
        const actions = new Map([
            ['install', wrapWithErrorBoundary(installCode, 3)], // 3 retry attempts
            ['update', wrapWithErrorBoundary(updateCode, 2)],   // 2 retry attempts
            ['run', wrapWithErrorBoundary(executeCode, 1)]      // 1 retry attempt
        ]);

        const actionFn = actions.get(action);
        if (!actionFn) {
            showNotification(`Invalid action type: ${action}. Allowed: install, update, run`, 'error');
            return;
        }

        // Configurable timeout with dynamic adjustment
        const TIMEOUT_MS = calculateTimeout(action, code.length);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Operation timed out after ${TIMEOUT_MS/1000}s`)), TIMEOUT_MS);
        });

        // Operation tracking with unique ID and timestamp
        const operationId = `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[${operationId}] Starting ${action} operation`);

        // Performance monitoring
        const startTime = performance.now();

        Promise.race([actionFn(code), timeoutPromise])
            .then(() => {
                const executionTime = performance.now() - startTime;
                console.log(`[${operationId}] Operation completed successfully in ${executionTime.toFixed(2)}ms`);
                showNotification(`${action} operation completed successfully`);
                updateOperationStats(action, executionTime, true);
            })
            .catch(error => {
                const executionTime = performance.now() - startTime;
                console.error(`[${operationId}] Action failed:`, error);
                showNotification(`Action failed: ${error.message}`, 'error');
                logError(error, action, code);
                handleFailureRecovery(action, error);
                updateOperationStats(action, executionTime, false);
            })
            .finally(() => {
                try {
                    performCleanup(action, operationId);
                    console.log(`[${operationId}] Cleanup completed`);
                } catch (cleanupError) {
                    console.error(`[${operationId}] Cleanup failed:`, cleanupError);
                    logError(cleanupError, 'cleanup', action);
                    // Attempt emergency cleanup
                    try {
                        emergencyCleanup(action, operationId);
                    } catch (emergencyError) {
                        console.error(`[${operationId}] Emergency cleanup failed:`, emergencyError);
                    }
                }
            });
    } catch (error) {
        console.error('Critical error in handleAIResponse:', error);
        showNotification('An unexpected error occurred', 'error');
        logError(error, 'critical', responseText);
        // Attempt system recovery
        systemRecovery();
    }
}function wrapWithErrorBoundary(fn) {
    return async (...args) => {
        try {
            const result = await fn(...args);
            // Validate the result
            if (result === undefined || result === null) {
                throw new Error(`${fn.name} returned invalid result`);
            }
            return result;
        } catch (error) {
            throw new Error(`${fn.name} failed: ${error.message}`);
        }
    };
}

// Error logging function with improved error handling and sanitization
function logError(error, action, code) {
    try {
        const errorLog = {
            timestamp: new Date().toISOString(),
            action: sanitizeString(action),
            error: sanitizeString(error.message),
            stack: error.stack ? sanitizeString(error.stack) : null,
            code: code ? sanitizeString(code.substring(0, 100)) + '...' : 'No code provided',
            browser: navigator.userAgent,
            scriptVersion: GM_info?.script?.version || 'unknown'
        };
        
        const errorLogs = JSON.parse(GM_getValue('errorLogs', '[]'));
        errorLogs.push(errorLog);
        
        // Keep only last 50 errors and remove older entries
        while (errorLogs.length > 50) {
            errorLogs.shift();
        }
        
        GM_setValue('errorLogs', JSON.stringify(errorLogs));
    } catch (loggingError) {
        console.error('Error logging failed:', loggingError);
    }
}
  // Helper function to sanitize strings with enhanced security
  function sanitizeString(str) {
      if (typeof str !== 'string') return '';
      return str.replace(/[<>'"&]/g, '').trim();
  }
    // Handle failure recovery with detailed logging and cleanup
    async function handleFailureRecovery(action, error) {
        // Add type checking for input parameters
        if (typeof action !== 'string' || !(error instanceof Error)) {
            throw new TypeError('Invalid arguments: action must be string, error must be Error object');
        }

        // Create recovery log with enhanced error details and validation
        const recoveryLog = {
            action: sanitizeString(action),
            timestamp: new Date().toISOString(),
            error: sanitizeString(error.message),
            stack: error.stack ? sanitizeString(error.stack) : null,
            severity: getSeverityLevel(error.message),
            context: await getEnhancedContext(),
            metadata: {
                processId: crypto.randomUUID(),
                sessionId: getSessionId(),
                recoveryAttempt: Date.now(),
                environment: process.env.NODE_ENV || 'production',
                retryCount: 0,
                lastAttemptStatus: null
            }
        };

        // Create action map with retry capabilities and validation
        const actionMap = createActionMap();
    
        try {
            await validateAction(action);
            const result = await executeAction(action, actionMap);
            recoveryLog.metadata.lastAttemptStatus = 'success';
            await persistRecoveryState(result, recoveryLog);
        } catch (actionError) {
            recoveryLog.metadata.lastAttemptStatus = 'failed';
            await handleActionError(actionError, action);
        } finally {
            await cleanup();
            await updateRecoveryMetrics(recoveryLog);
        }

        // Initialize retry mechanism with exponential backoff and circuit breaker
        const retryHandler = new RetryHandler(maxRetries, baseDelay, maxDelay, {
            circuitBreaker: true,
            timeout: 30000,
            fallback: defaultRecoveryAction,
            onRetry: (attempt) => {
                recoveryLog.metadata.retryCount = attempt;
                return true;
            }
        });
        await retryHandler.execute(persistLog, recoveryLog);

        // Helper functions
        async function getEnhancedContext() {
            const context = {
                userAgent: navigator.userAgent,
                scriptVersion: GM_info?.script?.version,
                timestamp: Date.now(),
                memoryUsage: performance?.memory?.usedJSHeapSize,
                platform: navigator.platform,
                language: navigator.language,
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                deviceMemory: navigator?.deviceMemory,
                hardwareConcurrency: navigator?.hardwareConcurrency,
                connectionType: navigator?.connection?.effectiveType,
                onLine: navigator.onLine,
                doNotTrack: navigator.doNotTrack,
                cookieEnabled: navigator.cookieEnabled,
                vendor: navigator.vendor,
                url: window.location.href,
                referrer: document.referrer,
                lastError: await GM_getValue('lastError', null),
                recoveryAttempts: parseInt(await GM_getValue('recoveryAttempts', '0')) + 1,
                lastSuccessfulRecovery: await GM_getValue('lastSuccessfulRecovery', null),
                browserVersion: navigator?.appVersion,
                networkInformation: await getNetworkInfo(),
                batteryStatus: await getBatteryStatus(),
                availableStorage: await getAvailableStorage(),
                activeExtensions: await getActiveExtensions(),
                performanceMetrics: await getPerformanceMetrics(),
                systemHealth: await getSystemHealth(),
                sessionDuration: await getSessionDuration(),
                errorFrequency: await getErrorFrequency()
            };

            return validateContext(context);
        }

        async function getNetworkInfo() {
            if (!navigator?.connection) return null;
            const info = {
                downlink: navigator.connection.downlink,
                effectiveType: navigator.connection.effectiveType,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData,
                bandwidth: navigator.connection.bandwidth,
                latency: await measureNetworkLatency(),
                packetLoss: await measurePacketLoss(),
                stability: await measureConnectionStability()
            };
            return validateNetworkInfo(info);
        }

        async function getPerformanceMetrics() {
            const metrics = {
                navigationTiming: performance?.timing,
                resourceTiming: performance?.getEntriesByType('resource'),
                memoryInfo: performance?.memory,
                firstPaint: performance?.getEntriesByType('paint')[0]?.startTime,
                firstContentfulPaint: performance?.getEntriesByType('paint')[1]?.startTime,
                largestContentfulPaint: performance?.getEntriesByName('largest-contentful-paint')[0]?.startTime,
                interactionMetrics: await getInteractionMetrics(),
                resourceUtilization: await getResourceUtilization(),
                frameRate: await measureFrameRate(),
                responsiveness: await measureResponsiveness()
            };
            return validatePerformanceMetrics(metrics);
        }

        function createActionMap() {
            const map = new Map([
                ['install', wrapWithErrorBoundary(cleanupInstallation)],
                ['update', wrapWithErrorBoundary(revertToPreviousVersion)],
                ['run', wrapWithErrorBoundary(terminateProcesses)],
                ['network', wrapWithErrorBoundary(reconnectNetwork)],
                ['storage', wrapWithErrorBoundary(clearCorruptedData)],
                ['memory', wrapWithErrorBoundary(cleanupMemory)],
                ['process', wrapWithErrorBoundary(restartProcess)],
                ['cache', wrapWithErrorBoundary(clearCache)],
                ['system', wrapWithErrorBoundary(systemRecovery)],
                ['database', wrapWithErrorBoundary(databaseRecovery)],
                ['session', wrapWithErrorBoundary(sessionRecovery)],
                ['state', wrapWithErrorBoundary(stateRecovery)]
            ]);
            return validateActionMap(map);
        }

        async function executeAction(action, actionMap) {
            const actionFn = actionMap.get(action);
            if (actionFn) {
                const startTime = performance.now();
                const result = await actionFn();
                const executionTime = performance.now() - startTime;
            
                await Promise.all([
                    GM_setValue('lastSuccessfulRecovery', Date.now()),
                    GM_setValue('lastExecutionTime', executionTime),
                    GM_setValue('actionResult', JSON.stringify(result)),
                    updateRecoveryStats(true),
                    updatePerformanceMetrics(executionTime)
                ]);

                return validateActionResult(result);
            } else {
                const errorMsg = `Unknown action type: ${sanitizeString(action)}`;
                console.warn(errorMsg);
                await Promise.all([
                    logError(new Error(errorMsg), 'unknownAction', 'Unknown action attempted'),
                    updateRecoveryStats(false),
                    recordFailedAction(action)
                ]);
                throw new Error(errorMsg);
            }
        }

        async function handleActionError(actionError, action) {
            console.error(`Recovery action failed: ${actionError.message}`);
            const errorContext = await getErrorContext(actionError);
            
            await Promise.all([
                logError(actionError, `recovery_${action}`, 'Action execution failed', errorContext),
                updateRecoveryStats(false),
                notifyFailure(actionError, action),
                recordErrorMetrics(actionError),
                updateErrorHistory(action, errorContext)
            ]);
            
            throw actionError;
        }

        function getSeverityLevel(message) {
            if (!message) return 'NORMAL';
            if (message.includes('CRITICAL') || message.includes('FATAL')) return 'CRITICAL';
            if (message.includes('ERROR')) return 'ERROR';
            if (message.includes('WARNING')) return 'WARNING';
            if (message.includes('INFO')) return 'INFO';
            return 'NORMAL';
        }
    }

    // Rate limiting with enhanced adaptive window and persistence
    class RateLimiter {
        constructor(options = {}) {
            this.window = options.window || 60000;
            this.maxOperations = options.maxOperations || 30;
            this.backoffMultiplier = options.backoffMultiplier || 1.5;
            this.maxWindow = options.maxWindow || 3600000;
            this.minWindow = options.minWindow || 1000;
            this.currentWindow = this.window;
            this.lastReset = Date.now();
            this.operationTimestamps = new Set(JSON.parse(GM_getValue('operationTimestamps', '[]')));
            this.operationCache = new LRUCache(1000);
            this.cleanupInterval = options.cleanupInterval || 300000;
            this.metrics = new MetricsCollector();
            this.adaptiveThreshold = options.adaptiveThreshold || 0.8;
            this.cooldownPeriod = options.cooldownPeriod || 5000;
            this.utilizationRate = 0; // Initialize utilizationRate
        }

        async checkLimit() {
            const now = Date.now();
            const cutoffTime = now - this.currentWindow;
    
            try {
                if (now - this.lastReset > this.maxWindow) {
                    await this.reset(now);
                    return true;
                }

                await this.updateTimestamps(cutoffTime, now);
                await this.handleUtilization(now);
                await this.cleanup(now);
                await this.metrics.update(now);
                await this.adjustWindow(now);
            
                return this.isWithinLimits();
            } catch (error) {
                console.error('Rate limit check failed:', error);
                await handleRateLimitError(error, now);
                return false;
            }
        }

        async updateMetrics(now, utilizationRate) {
            this.utilizationRate = utilizationRate; // Update utilizationRate
            const metrics = {
                lastReset: this.lastReset,
                currentWindow: this.currentWindow,
                totalOperations: this.operationTimestamps.size,
                utilizationRate,
                cacheSize: this.operationCache.size,
                averageWindow: this.calculateAverageWindow(),
                lastUpdate: now,
                performanceMetrics: {
                    avgResponseTime: this.calculateAverageResponseTime(),
                    peakUtilization: this.calculatePeakUtilization(),
                    maxWindow: this.maxWindow,
                    minWindow: this.minWindow,
                    backoffMultiplier: this.backoffMultiplier,
                    adaptiveThreshold: this.adaptiveThreshold,
                    cooldownPeriod: this.cooldownPeriod
                }
            };
            GM_setValue('metrics', JSON.stringify(metrics));
        }

        async handleRateLimitError(error, now) {
            console.error('Rate limit error:', error);
            if (error.message.includes('Too many requests')) {
                console.warn('Rate limit exceeded, applying backoff.');
                await this.backoff(now);
            } else {
                console.error('Unexpected rate limit error:', error);
            }
        }

        async backoff(now) {
            const backoffTime = this.currentWindow * this.backoffMultiplier;
            console.warn(`Applying backoff for ${backoffTime} milliseconds.`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            this.lastReset = now;
            this.operationTimestamps.clear();
            this.operationCache.clear();
            this.currentWindow = this.window;
            GM_setValue('operationTimestamps', JSON.stringify([]));
        }

        async adjustWindow(now) {
            if (this.utilizationRate >= this.adaptiveThreshold) {
                this.currentWindow = Math.min(this.currentWindow * this.backoffMultiplier, this.maxWindow);
            } else {
                this.currentWindow = Math.max(this.currentWindow / this.backoffMultiplier, this.minWindow);
            }
        }

        async cleanup(now) {
            if (now - this.lastReset > this.cleanupInterval) {
                await this.reset(now);
            }
        }

        async reset(now) {
            this.lastReset = now;
            this.operationTimestamps.clear();
            this.operationCache.clear();
            this.currentWindow = this.window;
            GM_setValue('operationTimestamps', JSON.stringify([]));
        }

        async updateTimestamps(cutoffTime, now) {
            const timestampsToRemove = [];
            for (const timestamp of this.operationTimestamps) {
                if (timestamp < cutoffTime) {
                    timestampsToRemove.push(timestamp);
                }
            }
            for (const timestamp of timestampsToRemove) {
                this.operationTimestamps.delete(timestamp);
            }
            GM_setValue('operationTimestamps', JSON.stringify(Array.from(this.operationTimestamps)));
        }

        async handleUtilization(now) {
            const utilizationRate = this.operationTimestamps.size / (this.currentWindow / 1000);
            await this.updateMetrics(now, utilizationRate);
        }

        async isWithinLimits() {
            return this.operationTimestamps.size < this.maxOperations;
        }

        async calculateAverageWindow() {
            const windows = [];
            for (let i = 0; i < this.operationTimestamps.size; i++) {
                const timestamp = Array.from(this.operationTimestamps)[i];
                if (i > 0) {
                    const previousTimestamp = Array.from(this.operationTimestamps)[i - 1];
                    windows.push(timestamp - previousTimestamp);
                }
            }
            if (windows.length > 0) {
                return windows.reduce((sum, window) => sum + window, 0) / windows.length;
            } else {
                return this.currentWindow;
            }
        }

        async calculateAverageResponseTime() {
            const responseTimes = [];
            for (const key of this.operationCache.keys()) {
                const value = this.operationCache.get(key);
                responseTimes.push(value.responseTime);
            }
            if (responseTimes.length > 0) {
                return responseTimes.reduce((sum, responseTime) => sum + responseTime, 0) / responseTimes.length;
            } else {
                return 0;
            }
        }

        async calculatePeakUtilization() {
            const utilizationRates = [];
            for (let i = 0; i < this.operationTimestamps.size; i++) {
                const timestamp = Array.from(this.operationTimestamps)[i];
                if (i > 0) {
                    const previousTimestamp = Array.from(this.operationTimestamps)[i - 1];
                    const window = timestamp - previousTimestamp;
                    const utilizationRate = (i + 1) / (window / 1000);
                    utilizationRates.push(utilizationRate);
                }
            }
            if (utilizationRates.length > 0) {
                return Math.max(...utilizationRates);
            } else {
                return 0;
            }
        }

        // ... rest of the rate limiting implementation
    }
```
