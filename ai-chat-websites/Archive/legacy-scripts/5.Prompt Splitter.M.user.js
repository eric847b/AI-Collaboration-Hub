// ==UserScript== 
// @name         ChatGPT - UI Module - AI RMD
// @version      29-10-2024.6
// @description  UI Module for ChatGPT with customizable buttons, enhanced functionality, theme support, performance optimization, error handling, and accessibility features
// @author       AI RMD
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_info
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @match        https://chat.openai.com/*
// @match        https://chat.openai.com/c/*
// @match        https://chat.openai.com/g/*
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/user/repo/main/chatgpt-ui-module.user.js
// @downloadURL  https://raw.githubusercontent.com/user/repo/main/chatgpt-ui-module.user.js
// @supportURL   https://github.com/user/repo/issues
// @homepageURL  https://github.com/user/repo
// @namespace    https://github.com/user/repo
// @license      MIT
// @compatible   chrome Latest
// @compatible   firefox Latest
// @compatible   edge Latest
// @compatible   safari Latest
// @compatible   opera Latest
// @noframes
// @inject-into  content
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @require      https://cdn.jsdelivr.net/npm/lodash@latest/lodash.min.js
// @require      https://cdn.jsdelivr.net/npm/dexie@latest/dist/dexie.min.js
// @resource     CUSTOM_STYLE https://raw.githubusercontent.com/user/repo/main/styles.css
// @resource     DARK_THEME https://raw.githubusercontent.com/user/repo/main/dark-theme.css
// @resource     LIGHT_THEME https://raw.githubusercontent.com/user/repo/main/light-theme.css
// @connect      openai.com
// @connect      githubusercontent.com
// @connect      *
// ==/UserScript==

(() => {
    'use strict';

    /**
     * @namespace UIModule
     * @description UI Module for ChatGPT with customizable buttons, enhanced functionality, theme support, performance optimization, error handling, and accessibility features
     * @version 29-10-2024.6
     * @author AI RMD
     * @license MIT
     */
    const UIModule = {
        version: '29-10-2024.6',
        settings: {
            isDraggable: true,
            saveThemePreference: true,
            autoHideTimeout: 2000,
            animationDuration: 200,
            persistPosition: true,
            autoSave: true,
            debounceDelay: 150,
            maxRetries: 5,
            retryDelay: 500,
            memoryCheckInterval: 8000,
            performanceThreshold: 35,
            useHardwareAcceleration: true,
            enableIntersectionObserver: true,
            useCSSContainment: true,
            enableCache: true,
            compressionLevel: 'high',
            useServiceWorker: 'serviceWorker' in navigator && navigator.onLine && !navigator.webdriver && window.isSecureContext,
            prefetchResources: true,
            enableProgressiveLoading: true,
            useWebWorkers: 'Worker' in window && navigator.hardwareConcurrency > 1 && !navigator.webdriver && window.isSecureContext,
            enableVirtualization: true,
            enableLazyLoading: true,
            useSharedWorkers: 'SharedWorker' in window && navigator.onLine && !navigator.webdriver && window.isSecureContext,
            enableIndexedDB: 'indexedDB' in window && window.indexedDB && !navigator.webdriver && window.isSecureContext,
            useBroadcastChannel: 'BroadcastChannel' in window && navigator.onLine && !navigator.webdriver && window.isSecureContext,
            enableMemoryManagement: true,
            useRequestIdleCallback: 'requestIdleCallback' in window && !navigator.webdriver,
            enablePerformanceObserver: 'PerformanceObserver' in window && !navigator.webdriver,
            enableWebGL: 'WebGLRenderingContext' in window && !navigator.webdriver && !this.isLowEndDevice(),
            useWebAssembly: 'WebAssembly' in window && !navigator.webdriver && !this.isLowEndDevice(),
            enableWebRTC: 'RTCPeerConnection' in window && !navigator.webdriver && window.isSecureContext,
            useWebSockets: 'WebSocket' in window && navigator.onLine && !navigator.webdriver && window.isSecureContext,
            enableBatchUpdates: true,
            useVirtualDOM: true,
            enableCodeSplitting: true,
            useMemoization: true,
            enableTreeShaking: true,
            useAsyncLoading: true,
            enablePreloading: true,
            useEventDelegation: true,
            enableResourceHints: true,
            useIntersectionObserver: true,
            enablePriorityLoading: true,
            useResourceQueue: true,
            enableDynamicImports: true,
            useWebComponents: 'customElements' in window && window.isSecureContext,
            enableServiceWorkerCache: true,
            useAdaptiveLoading: true,
            enablePerformanceMetrics: true,
            useErrorBoundaries: true,
            enableAutoOptimization: true,
            usePriorityScheduling: true,
            enableMemoryOptimization: true,
            useBackgroundSync: 'sync' in navigator.serviceWorker && window.isSecureContext,
            enableWebTransport: 'WebTransport' in window && window.isSecureContext,
            useCompressionStreams: 'CompressionStream' in window,
            enableSharedArrayBuffer: 'SharedArrayBuffer' in window && crossOriginIsolated,
            useAtomics: 'Atomics' in window && crossOriginIsolated,
            enableQuicTransport: 'QuicTransport' in window && window.isSecureContext,
            enablePreconnect: true,
            usePrefetch: true,
            enablePreload: true,
            useImageOptimization: true,
            enableFontOptimization: true
        },

        init: async function() {
            const initStartTime = performance.now();
            const abortController = new AbortController();
            const signal = abortController.signal;

            try {
                performance.mark('init-start');
                
                setTimeout(() => abortController.abort(), 10000);

                await Promise.race([
                    this.detectFeatures(signal),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Feature detection timeout')), 1500))
                ]);
                
                if (!await this.checkBrowserCompatibility(signal)) {
                    throw new Error('Browser compatibility requirements not met');
                }

                await Promise.race([
                    this.retryWithBackoff(this.initializeCore.bind(this), 4, { 
                        exponentialBase: 1.2,
                        signal,
                        maxTimeout: 5000
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Core initialization timeout')), 5000))
                ]);
                
                await this.setupCriticalFeatures(signal);
                
                if (await this.hasAvailableResources(signal)) {
                    const resourceMonitor = this.startResourceMonitoring(signal);
                    await this.initializeNonCriticalFeatures(signal);
                    await resourceMonitor.stop();
                }
                
                await this.setupMonitoring(signal).catch(async err => {
                    console.warn('Advanced monitoring failed, falling back to basic:', err);
                    await this.logMonitoringFailure(err);
                    return this.setupBasicMonitoring(signal);
                });
                
                await this.finalizeInitialization(signal);
                
                performance.mark('init-end');
                const measure = performance.measure('initialization', 'init-start', 'init-end');
                await this.logInitializationMetrics(measure, performance.now() - initStartTime);
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.error('Initialization aborted due to timeout');
                }
                await this.handleInitializationError(error);
                throw error;
            } finally {
                await this.cleanup();
                this.schedulePerformanceCheck();
                this.initializeAutoRecovery();
                this.setupPerformanceMonitoring();
                abortController.abort();
            }
        },

        async initializeCore(signal) {
            const [networkStatus, memoryStatus, systemCheck] = await Promise.all([
                this.checkNetworkStatus(signal),
                this.checkMemoryUsage(signal),
                this.checkSystemRequirements(signal)
            ]);

            if (!networkStatus.online) {
                await this.initializeOfflineMode(networkStatus, signal);
            }
            
            if (!memoryStatus.sufficient) {
                await this.optimizeMemoryUsage(signal);
            }

            if (!systemCheck.passed) {
                await this.initializeFallbackMode(systemCheck.reason, signal);
                throw new Error('System requirements not met: ' + systemCheck.reason);
            }

            await Promise.all([
                this.setupErrorBoundary(signal),
                this.initializeCache(signal),
                this.setupServiceWorker(signal)
            ]);

            const savedSettings = await this.loadSavedSettings(signal);
            if (!await this.validateSettings(savedSettings, signal)) {
                await Promise.all([
                    this.resetToDefaultSettings(signal),
                    this.backupSettings(signal)
                ]);
            }
            
            await this.optimizeInitialLoad(signal);
        },

        async setupCriticalFeatures(signal) {            const criticalTasks = [
                this.createCustomStyles(),
                this.createCustomButtons(),
                this.initializeThemeToggle(),
                this.setupAccessibility(),
                this.initializeVirtualDOM(),
                this.setupBatchUpdates(),
                this.initializeCodeSplitting(),
                this.setupMemoization(),
                this.initializeErrorTracking(),
                this.setupPerformanceMonitoring()
            ].map(task => this.wrapWithRetry(task, { 
                maxRetries: 5, 
                retryDelay: 300, 
                timeout: 3000,
                priority: 'critical',
                backoff: 'exponential',
                signal,
                fallback: async (err) => {
                    await this.logCriticalFailure(err);
                    return this.handleCriticalTaskFailure(err);
                }
            }));

            const results = await Promise.allSettled(criticalTasks);
            await this.handleTaskResults(results, 'critical', signal);
            await this.optimizeCriticalPath(signal);
            await this.validateCriticalFeatures(signal);
        },

        async initializeNonCriticalFeatures(signal) {
            const nonCriticalTasks = this.getNonCriticalTasks()
                .filter(task => this.isFeatureSupported(task) && this.isPriorityTask(task))
                .sort((a, b) => this.getTaskPriority(b) - this.getTaskPriority(a));

            const taskGroups = this.createOptimalTaskGroups(nonCriticalTasks);
            const options = {
                concurrency: Math.min(navigator.hardwareConcurrency || 2, 4),
                timeout: 5000,
                retryStrategy: 'adaptive',
                signal
            };
            await this.executeTaskGroups(taskGroups, options);
        },

        async setupMonitoring(signal) {
            performance.mark('monitoring-start');
            const monitoringTasks = [
                this.setupPerformanceMonitoring(),
                this.initializeMetricsCollection(),
                this.setupResourceMonitoring(),
                this.initializeErrorTracking(),
                this.setupHealthCheck(),
                this.initializeHeartbeat(),
                this.setupMemoryMonitoring()
            ].map(task => this.wrapWithRetry(task, { 
                maxRetries: 4, 
                retryDelay: 400,
                timeout: 3000,
                priority: 'high',
                backoff: 'exponential',
                signal,
                fallback: async (err) => {
                    await this.logMonitoringFailure(err);
                    return this.setupBasicMonitoringTask(task);
                }
            }));

            const results = await Promise.allSettled(monitoringTasks);
            performance.mark('monitoring-end');
            performance.measure('monitoring', 'monitoring-start', 'monitoring-end');
            await this.handleTaskResults(results, 'monitoring', signal);
            await this.validateMonitoring(signal);
        },

        async finalizeInitialization(signal) {
            performance.mark('finalize-start');
            const finalTasks = [
                this.validateAndRepairSettings(),
                this.optimizeSettings(),
                this.setupAutoSave(),
                this.initializeSettingsBackup(),
                this.validateSettingsIntegrity(),
                this.setupSettingsMigration(),
                this.initializeSettingsSync()
            ].map(task => this.wrapWithRetry(task, { 
                maxRetries: 3, 
                retryDelay: 500,
                timeout: 2000,
                backoff: 'exponential',
                priority: 'medium',
                signal
            }));

            const results = await Promise.allSettled(finalTasks);
            performance.mark('finalize-end');
            performance.measure('finalization', 'finalize-start', 'finalize-end');
            await this.handleTaskResults(results, 'finalization', signal);
        },

        async handleInitializationError(error) {
            console.error('Initialization failed:', error);
            performance.mark('recovery-start');
            
            try {
                const recoveryTasks = [
                    this.handleCriticalError(error),
                    this.attemptRecovery(),
                    this.notifyAdministrator(error),
                    this.saveErrorState(error),
                    this.attemptGracefulDegradation(error),
                    this.initializeFailsafeMode(error)
                ].map(task => this.wrapWithRetry(task, { 
                    maxRetries: 5, 
                    retryDelay: 500,
                    timeout: 3000,
                    critical: true,
                    backoff: 'exponential'
                }));

                const recoveryResults = await Promise.allSettled(recoveryTasks);
                await this.handleRecoveryResults(recoveryResults);

                if (!this.isRecoverable(error)) {
                    await this.initializeEmergencyMode(error);
                    throw new Error(`Unrecoverable initialization error: ${error.message}`);
                }
            } finally {
                performance.mark('recovery-end');
                performance.measure('error-recovery', 'recovery-start', 'recovery-end');
            }
        },

        async cleanup() {
            performance.mark('cleanup-start');
            try {
                await Promise.all([
                    this.cleanupResources(),
                    this.optimizeMemoryUsage(),
                    this.flushMetrics(),
                    this.persistState(),
                    this.disposeEventListeners(),
                    this.clearTemporaryCache(),
                    this.finalizeWorkers(),
                    this.cleanupSharedResources(),
                    this.disposeWebGLContexts(),
                    this.closeConnections()
                ]);
            } finally {
                performance.mark('cleanup-end');
                performance.measure('cleanup', 'cleanup-start', 'cleanup-end');
                performance.clearMarks();
                performance.clearMeasures();
            }
        }
    };