// ==UserScript==
// @name         Autonomous Agent Runner
// @version      2026.07.01.1
// @description  AI Chat Userscript Suite - Module 10: Autonomous Agent Runner with task scheduling, execution queue, and status tracking
// @author       AI Chat Userscript Studio
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
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
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

/**
 * AI Chat Userscript Suite - Autonomous Agent Runner
 *
 * Provides autonomous task execution capabilities:
 * - Task queue with priority scheduling
 * - Configurable execution intervals
 * - Status tracking and history
 * - Integration with hub module registry
 * - Error recovery with retry logic
 */

(function() {
    'use strict';

    const MODULE_ID = 'module-10';
    const MODULE_NAME = 'Autonomous Agent Runner';
    const MODULE_VERSION = '2026.07.01.1';
    const MAX_HISTORY = 100;
    const DEFAULT_INTERVAL = 60000;
    const MAX_RETRIES = 3;

    class AutonomousAgentRunner {
        constructor() {
            this.id = MODULE_ID;
            this.name = MODULE_NAME;
            this.version = MODULE_VERSION;
            this.taskQueue = [];
            this.taskHistory = [];
            this.activeTasks = new Map();
            this.scheduledIntervals = new Map();
            this.scheduledTimeouts = new Map();
            this.isProcessing = false;
            this.config = {
                enabled: true,
                maxConcurrentTasks: 3,
                defaultInterval: DEFAULT_INTERVAL,
                retryOnFailure: true,
                maxRetries: MAX_RETRIES,
                logLevel: 'info',
                autoStart: true,
                enableDependencies: true,
                enableTimeouts: true,
                defaultTimeout: 300000,
                enableThrottling: true,
                maxTasksPerMinute: 60,
                enableSmartRetry: true,
                enableWebhooks: false,
                webhookUrl: '',
                enableCron: true,
                enablePauseResume: true,
                enableTaskCategories: true,
                enableResourceTracking: true
            };
            this.state = {
                initialized: false,
                tasksCompleted: 0,
                tasksFailed: 0,
                tasksRunning: 0,
                lastRun: null,
                paused: false,
                startTime: null,
                totalExecutionTime: 0,
                taskMetrics: new Map(),
                deadLetterQueue: [],
                resourceUsage: {
                    cpu: 0,
                    memory: 0,
                    network: 0
                }
            };
            this.metrics = {
                tasksPerMinute: [],
                averageExecutionTime: 0,
                successRate: 100,
                throughput: 0
            };
            this.cronJobs = new Map();
            this.eventListeners = new Map();
        }

        /**
         * Initialize the agent runner
         * @returns {Promise<boolean>}
         */
        async init() {
            try {
                console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);

                this.loadConfig();
                this.loadState();

                if (!this.config.enabled) {
                    console.log(`[${MODULE_ID}] Module disabled in config`);
                    return false;
                }

                this.setup();
                this.startMetricsCollection();
                this.restoreScheduledTasks();
                this.exposeAPI();

                this.state.initialized = true;
                this.state.startTime = Date.now();

                console.log(`[${MODULE_ID}] Initialization complete`);
                this.emit('initialized', { timestamp: Date.now() });
                return true;

            } catch (error) {
                console.error(`[${MODULE_ID}] Initialization failed:`, error);
                return false;
            }
        }

        /**
         * Start metrics collection
         * @private
         */
        startMetricsCollection() {
            if (!this.config.enableResourceTracking) return;

            setInterval(() => {
                this.updateResourceUsage();
                this.updateMetrics();
            }, 5000);
        }

        /**
         * Update resource usage metrics
         * @private
         */
        updateResourceUsage() {
            if (performance.memory) {
                this.state.resourceUsage.memory = performance.memory.usedJSHeapSize / 1024 / 1024;
            }

            const nav = performance.getEntriesByType('navigation')[0];
            if (nav) {
                this.state.resourceUsage.network = nav.responseEnd - nav.responseStart;
            }

            this.emit('metricsUpdated', this.state.resourceUsage);
        }

        /**
         * Update performance metrics
         * @private
         */
        updateMetrics() {
            const now = Date.now();
            const lastMinute = now - 60000;

            this.metrics.tasksPerMinute = this.taskHistory.filter(
                t => t.timestamp > lastMinute && t.status === 'completed'
            ).length;

            const completed = this.taskHistory.filter(t => t.status === 'completed');
            const failed = this.taskHistory.filter(t => t.status === 'failed');
            const total = completed.length + failed.length;

            this.metrics.successRate = total > 0 ? ((completed.length / total) * 100).toFixed(2) : 100;
            this.metrics.throughput = this.state.startTime ?
                (total / ((now - this.state.startTime) / 1000 / 60)).toFixed(2) : 0;

            const times = completed
                .filter(t => t.executionTime)
                .map(t => t.executionTime);

            if (times.length > 0) {
                this.metrics.averageExecutionTime = times.reduce((a, b) => a + b, 0) / times.length;
            }
        }

        /**
         * Restore scheduled tasks after reload
         * @private
         */
        restoreScheduledTasks() {
            try {
                const stored = GM_getValue(`${MODULE_ID}-cron`, '[]');
                if (stored) {
                    const cronJobs = typeof stored === 'string' ? JSON.parse(stored) : stored;
                    cronJobs.forEach(job => {
                        this.scheduleCronJob(job);
                    });
                }
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to restore scheduled tasks:`, error);
            }
        }

        /**
         * Setup module - register with hub if available
         */
        setup() {
            // Register with hub if available
            if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
                try {
                    window.ModuleRegistry.register(MODULE_NAME, MODULE_VERSION, this);
                    console.log(`[${MODULE_ID}] Registered with hub`);
                } catch (e) {
                    console.warn(`[${MODULE_ID}] Hub registration skipped:`, e.message);
                }
            }

            // Auto-start processing if configured
            if (this.config.autoStart && this.taskQueue.length > 0) {
                this.startProcessing();
            }

            // Save initial state
            this.saveState();
        }

        /**
         * Add a task to the execution queue
         * @param {Object} task - Task definition
         * @param {string} task.id - Unique task identifier
         * @param {Function} task.execute - Task execution function
         * @param {number} [task.priority=0] - Priority (higher = more urgent)
         * @param {number} [task.interval] - Recurring interval in ms
         * @param {string} [task.name] - Human-readable task name
         * @param {string[]} [task.dependencies] - Task IDs this task depends on
         * @param {number} [task.timeout] - Task timeout in ms
         * @param {string} [task.category] - Task category
         * @param {Function} [task.onComplete] - Completion callback
         * @param {Function} [task.onError] - Error callback
         * @returns {string} Task ID
         */
        addTask(task) {
            if (!task || typeof task.execute !== 'function') {
                console.error(`[${MODULE_ID}] Invalid task: must have execute function`);
                return null;
            }

            // Check dependencies
            if (task.dependencies && task.dependencies.length > 0) {
                const missingDeps = task.dependencies.filter(
                    depId => !this.taskQueue.some(t => t.id === depId && t.status === 'completed')
                );

                if (missingDeps.length > 0) {
                    console.warn(`[${MODULE_ID}] Task has unmet dependencies: ${missingDeps.join(', ')}`);
                }
            }

            const taskId = task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

            const taskEntry = {
                id: taskId,
                name: task.name || taskId,
                execute: task.execute,
                priority: task.priority || 0,
                interval: task.interval || 0,
                recurring: !!task.interval,
                createdAt: Date.now(),
                lastRun: null,
                status: 'queued',
                retries: 0,
                maxRetries: task.maxRetries || this.config.maxRetries,
                dependencies: task.dependencies || [],
                timeout: task.timeout || this.config.defaultTimeout,
                category: task.category || 'default',
                onComplete: task.onComplete || null,
                onError: task.onError || null,
                metadata: task.metadata || {},
                progress: 0,
                estimatedDuration: task.estimatedDuration || 0
            };

            this.taskQueue.push(taskEntry);
            this.sortQueue();

            console.log(`[${MODULE_ID}] Task added: ${taskEntry.name} (${taskId})`);

            if (task.dependencies && task.dependencies.length > 0) {
                console.log(`[${MODULE_ID}] Dependencies: ${task.dependencies.join(', ')}`);
            }

            this.emit('taskAdded', taskEntry);
            this.saveState();

            // Auto-start if processing
            if (this.isProcessing) {
                this.processNextTask();
            }

            return taskId;
        }

        /**
         * Schedule a task using cron syntax
         * @param {Object} config
         * @param {string} config.cron - Cron expression (* * * * *)
         * @param {Function} config.execute - Task function
         * @param {string} [config.name] - Task name
         * @param {string} [config.category] - Task category
         * @returns {string} Job ID
         */
        scheduleCronJob(config) {
            if (!this.config.enableCron) {
                console.warn(`[${MODULE_ID}] Cron scheduling is disabled`);
                return null;
            }

            const jobId = config.id || `cron-${Date.now()}`;

            const job = {
                id: jobId,
                name: config.name || jobId,
                cron: config.cron,
                execute: config.execute,
                category: config.category || 'cron',
                lastRun: null,
                nextRun: this.parseCron(config.cron),
                active: true
            };

            this.cronJobs.set(jobId, job);

            // Schedule next run
            this.scheduleNextCronRun(job);

            console.log(`[${MODULE_ID}] Cron job scheduled: ${job.name} (${config.cron})`);
            this.emit('cronScheduled', job);
            this.saveCronJobs();

            return jobId;
        }

        /**
         * Schedule next cron run
         * @param {Object} job
         * @private
         */
        scheduleNextCronRun(job) {
            if (!job.active) return;

            const now = Date.now();
            const delay = job.nextRun - now;

            if (delay <= 0) {
                // Calculate next run immediately
                job.nextRun = this.parseCron(job.cron);
                this.scheduleNextCronRun(job);
                return;
            }

            const timeout = setTimeout(() => {
                if (!job.active) return;

                this.addTask({
                    name: job.name,
                    execute: job.execute,
                    category: job.category,
                    id: `${job.id}-${Date.now()}`
                });

                job.lastRun = Date.now();
                job.nextRun = this.parseCron(job.cron);

                this.scheduleNextCronRun(job);
                this.saveCronJobs();
            }, delay);

            this.scheduledTimeouts.set(job.id, timeout);
        }

        /**
         * Parse cron expression and return next run timestamp
         * @param {string} cron
         * @returns {number}
         * @private
         */
        parseCron(cron) {
            const parts = cron.split(' ');
            if (parts.length !== 5) {
                throw new Error('Invalid cron expression');
            }

            const [minute, hour, day, month, weekday] = parts;

            const now = new Date();
            const next = new Date(now);

            // Simple cron parsing (only basic patterns)
            if (minute !== '*') next.setMinutes(parseInt(minute));
            if (hour !== '*') next.setHours(parseInt(hour));

            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }

            return next.getTime();
        }

        /**
         * Save cron jobs to storage
         * @private
         */
        saveCronJobs() {
            try {
                const jobs = Array.from(this.cronJobs.values()).map(job => ({
                    id: job.id,
                    name: job.name,
                    cron: job.cron,
                    category: job.category,
                    active: job.active,
                    lastRun: job.lastRun,
                    nextRun: job.nextRun
                }));

                GM_setValue(`${MODULE_ID}-cron`, JSON.stringify(jobs));
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to save cron jobs:`, error);
            }
        }

        /**
         * Remove a task from the queue
         * @param {string} taskId
         * @returns {boolean}
         */
        removeTask(taskId) {
            const index = this.taskQueue.findIndex(t => t.id === taskId);
            if (index === -1) return false;

            this.taskQueue.splice(index, 1);

            // Clear any scheduled interval
            if (this.scheduledIntervals.has(taskId)) {
                clearInterval(this.scheduledIntervals.get(taskId));
                this.scheduledIntervals.delete(taskId);
            }

            // Remove from active tasks
            this.activeTasks.delete(taskId);

            console.log(`[${MODULE_ID}] Task removed: ${taskId}`);
            this.saveState();
            return true;
        }

        /**
         * Sort task queue by priority (highest first)
         */
        sortQueue() {
            this.taskQueue.sort((a, b) => b.priority - a.priority);
        }

        /**
         * Start processing the task queue
         */
        startProcessing() {
            if (this.isProcessing) return;

            this.isProcessing = true;
            console.log(`[${MODULE_ID}] Processing started`);

            this.processNextTask();
        }

        /**
         * Stop processing the task queue
         */
        stopProcessing() {
            this.isProcessing = false;
            console.log(`[${MODULE_ID}] Processing stopped`);
        }

        /**
         * Process the next task in the queue
         */
        async processNextTask() {
            if (!this.isProcessing) return;
            if (this.state.paused) {
                setTimeout(() => this.processNextTask(), 1000);
                return;
            }
            if (this.activeTasks.size >= this.config.maxConcurrentTasks) return;

            // Throttling
            if (this.config.enableThrottling) {
                const lastMinute = this.taskHistory.filter(
                    t => t.timestamp > Date.now() - 60000 && t.status === 'completed'
                );
                if (lastMinute.length >= this.config.maxTasksPerMinute) {
                    setTimeout(() => this.processNextTask(), 1000);
                    return;
                }
            }

            const task = this.taskQueue.find(t => {
                if (t.status !== 'queued') return false;
                if (this.activeTasks.has(t.id)) return false;

                // Check dependencies
                if (t.dependencies && t.dependencies.length > 0) {
                    return t.dependencies.every(depId => {
                        const dep = this.taskQueue.find(d => d.id === depId);
                        return dep && dep.status === 'completed';
                    });
                }

                return true;
            });

            if (!task) {
                setTimeout(() => this.processNextTask(), 1000);
                return;
            }

            // Check for pause
            if (this.state.paused) {
                setTimeout(() => this.processNextTask(), 1000);
                return;
            }

            this.activeTasks.set(task.id, task);
            task.status = 'running';
            task.lastRun = Date.now();
            this.state.tasksRunning = this.activeTasks.size;

            const startTime = Date.now();

            // Set up timeout
            let timeoutId = null;
            if (this.config.enableTimeouts && task.timeout > 0) {
                timeoutId = setTimeout(() => {
                    if (this.activeTasks.has(task.id)) {
                        this.handleTaskTimeout(task);
                    }
                }, task.timeout);
            }

            try {
                this.emit('taskStarted', task);

                const result = await task.execute();

                if (timeoutId) clearTimeout(timeoutId);

                const executionTime = Date.now() - startTime;
                task.status = 'completed';
                task.progress = 100;
                this.state.tasksCompleted++;

                const historyEntry = {
                    id: task.id,
                    name: task.name,
                    status: 'completed',
                    timestamp: Date.now(),
                    result: result,
                    executionTime: executionTime,
                    retries: task.retries,
                    category: task.category
                };

                this.addToHistory(historyEntry);
                this.updateTaskMetrics(task, executionTime);

                console.log(`[${MODULE_ID}] Task completed: ${task.name} (${executionTime}ms)`);

                this.emit('taskCompleted', { task, result, executionTime });

                // Call onComplete callback
                if (task.onComplete) {
                    try {
                        task.onComplete(result, executionTime);
                    } catch (error) {
                        console.error(`[${MODULE_ID}] onComplete callback error:`, error);
                    }
                }

                // Send webhook
                if (this.config.enableWebhooks && this.config.webhookUrl) {
                    this.sendWebhook('task.completed', { task, result, executionTime });
                }

                // If recurring, re-queue after interval
                if (task.recurring && task.interval > 0) {
                    this.scheduleRecurring(task);
                } else {
                    this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
                }

            } catch (error) {
                if (timeoutId) clearTimeout(timeoutId);

                task.status = 'failed';
                this.state.tasksFailed++;

                const executionTime = Date.now() - startTime;

                const historyEntry = {
                    id: task.id,
                    name: task.name,
                    status: 'failed',
                    timestamp: Date.now(),
                    error: error.message,
                    executionTime: executionTime,
                    retries: task.retries,
                    category: task.category
                };

                this.addToHistory(historyEntry);

                console.error(`[${MODULE_ID}] Task failed: ${task.name}`, error);

                this.emit('taskFailed', { task, error, executionTime });

                // Call onError callback
                if (task.onError) {
                    try {
                        task.onError(error, executionTime);
                    } catch (callbackError) {
                        console.error(`[${MODULE_ID}] onError callback error:`, callbackError);
                    }
                }

                // Send webhook
                if (this.config.enableWebhooks && this.config.webhookUrl) {
                    this.sendWebhook('task.failed', { task, error, executionTime });
                }

                // Smart retry logic
                if (this.config.retryOnFailure && task.retries < task.maxRetries) {
                    const retryDelay = this.config.enableSmartRetry ?
                        this.calculateSmartRetryDelay(task) : 2000 * (task.retries + 1);

                    task.retries++;
                    task.status = 'queued';

                    console.log(`[${MODULE_ID}] Retrying task ${task.name} (${task.retries}/${task.maxRetries}) in ${retryDelay}ms`);

                    this.emit('taskRetrying', { task, retryCount: task.retries, delay: retryDelay });

                    setTimeout(() => this.processNextTask(), retryDelay);
                } else {
                    // Move to dead letter queue
                    this.state.deadLetterQueue.push({
                        ...task,
                        failedAt: Date.now(),
                        error: error.message
                    });

                    this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);

                    console.log(`[${MODULE_ID}] Task moved to dead letter queue: ${task.name}`);

                    if (this.config.enableNotifications) {
                        this.showNotification(`Task failed: ${task.name}`, '❌');
                    }
                }
            } finally {
                this.activeTasks.delete(task.id);
                this.state.tasksRunning = this.activeTasks.size;
                this.saveState();

                // Process next task
                setTimeout(() => this.processNextTask(), 100);
            }
        }

        /**
         * Calculate smart retry delay with exponential backoff
         * @param {Object} task
         * @returns {number}
         * @private
         */
        calculateSmartRetryDelay(task) {
            const baseDelay = 1000;
            const maxDelay = 30000;
            const multiplier = Math.pow(2, task.retries);
            const jitter = Math.random() * 1000;

            return Math.min(baseDelay * multiplier + jitter, maxDelay);
        }

        /**
         * Handle task timeout
         * @param {Object} task
         * @private
         */
        handleTaskTimeout(task) {
            task.status = 'timeout';
            this.state.tasksFailed++;

            this.addToHistory({
                id: task.id,
                name: task.name,
                status: 'timeout',
                timestamp: Date.now(),
                error: 'Task timeout exceeded',
                executionTime: task.timeout
            });

            console.error(`[${MODULE_ID}] Task timeout: ${task.name}`);

            this.emit('taskTimeout', task);

            if (this.config.enableWebhooks && this.config.webhookUrl) {
                this.sendWebhook('task.timeout', { task });
            }

            this.activeTasks.delete(task.id);
            this.state.tasksRunning = this.activeTasks.size;
        }

        /**
         * Send webhook notification
         * @param {string} event
         * @param {Object} data
         * @private
         */
        async sendWebhook(event, data) {
            if (!this.config.webhookUrl) return;

            try {
                await fetch(this.config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event,
                        module: MODULE_ID,
                        timestamp: Date.now(),
                        data
                    })
                });
            } catch (error) {
                console.warn(`[${MODULE_ID}] Webhook failed:`, error);
            }
        }

        /**
         * Pause task processing
         * @public
         */
        pause() {
            if (!this.config.enablePauseResume) return;

            this.state.paused = true;
            console.log(`[${MODULE_ID}] Processing paused`);
            this.emit('paused');
        }

        /**
         * Resume task processing
         * @public
         */
        resume() {
            if (!this.config.enablePauseResume) return;

            this.state.paused = false;
            console.log(`[${MODULE_ID}] Processing resumed`);
            this.emit('resumed');

            if (this.isProcessing) {
                this.processNextTask();
            }
        }

        /**
         * Toggle pause/resume
         * @returns {boolean}
         * @public
         */
        togglePause() {
            if (this.state.paused) {
                this.resume();
                return false;
            } else {
                this.pause();
                return true;
            }
        }

        /**
         * Schedule a recurring task
         * @param {Object} task
         */
        scheduleRecurring(task) {
            if (this.scheduledIntervals.has(task.id)) {
                clearInterval(this.scheduledIntervals.get(task.id));
            }

            const interval = setInterval(() => {
                // Re-add to queue
                const reQueued = this.taskQueue.find(t => t.id === task.id);
                if (!reQueued) {
                    this.taskQueue.push({
                        ...task,
                        status: 'queued',
                        lastRun: null,
                        retries: 0
                    });
                    this.sortQueue();
                    this.processNextTask();
                }
            }, task.interval);

            this.scheduledIntervals.set(task.id, interval);
        }

        /**
         * Add entry to task history
         * @param {Object} entry
         */
        addToHistory(entry) {
            this.taskHistory.unshift(entry);
            if (this.taskHistory.length > MAX_HISTORY) {
                this.taskHistory = this.taskHistory.slice(0, MAX_HISTORY);
            }
        }

        /**
         * Get comprehensive status
         * @returns {Object}
         */
        getStatus() {
            const tasksByCategory = this.taskQueue.reduce((acc, task) => {
                acc[task.category] = (acc[task.category] || 0) + 1;
                return acc;
            }, {});

            return {
                queueLength: this.taskQueue.length,
                activeTasks: this.activeTasks.size,
                historyLength: this.taskHistory.length,
                tasksCompleted: this.state.tasksCompleted,
                tasksFailed: this.state.tasksFailed,
                isProcessing: this.isProcessing,
                lastRun: this.state.lastRun,
                initialized: this.state.initialized,
                paused: this.state.paused,
                metrics: this.metrics,
                resourceUsage: this.state.resourceUsage,
                tasksByCategory,
                deadLetterQueue: this.state.deadLetterQueue.length,
                cronJobs: this.cronJobs.size,
                retryQueue: this.taskQueue.filter(t => t.retries > 0).length
            };
        }

        /**
         * Get detailed task metrics
         * @param {string} taskId
         * @returns {Object}
         */
        getTaskMetrics(taskId) {
            const history = this.taskHistory.filter(t => t.id === taskId);
            const completed = history.filter(t => t.status === 'completed' && t.executionTime);

            if (completed.length === 0) {
                return { runs: history.length, averageTime: 0, successRate: 0 };
            }

            const avgTime = completed.reduce((sum, t) => sum + t.executionTime, 0) / completed.length;
            const successRate = (completed.length / history.length) * 100;

            return {
                runs: history.length,
                completed: completed.length,
                failed: history.filter(t => t.status === 'failed').length,
                averageTime: Math.round(avgTime),
                successRate: successRate.toFixed(2)
            };
        }

        /**
         * Update task metrics
         * @private
         */
        updateTaskMetrics(task, executionTime) {
            if (!this.state.taskMetrics.has(task.id)) {
                this.state.taskMetrics.set(task.id, {
                    executions: [],
                    totalTime: 0,
                    minTime: Infinity,
                    maxTime: 0
                });
            }

            const metrics = this.state.taskMetrics.get(task.id);
            metrics.executions.push(executionTime);
            metrics.totalTime += executionTime;
            metrics.minTime = Math.min(metrics.minTime, executionTime);
            metrics.maxTime = Math.max(metrics.maxTime, executionTime);
        }

        /**
         * Get queued tasks
         * @returns {Array}
         */
        getTasks() {
            return this.taskQueue.map(t => ({
                id: t.id,
                name: t.name,
                priority: t.priority,
                status: t.status,
                recurring: t.recurring,
                interval: t.interval,
                createdAt: t.createdAt,
                lastRun: t.lastRun,
                retries: t.retries
            }));
        }

        /**
         * Get task history
         * @returns {Array}
         */
        getHistory() {
            return [...this.taskHistory];
        }

        /**
         * Load configuration from GM storage
         */
        loadConfig() {
            try {
                const stored = GM_getValue(`${MODULE_ID}-config`, '{}');
                if (stored) {
                    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
                    this.config = { ...this.config, ...parsed };
                }
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, error);
            }
        }

        /**
         * Save configuration to GM storage
         */
        saveConfig() {
            try {
                GM_setValue(`${MODULE_ID}-config`, JSON.stringify(this.config));
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to save config:`, error);
            }
        }

        /**
         * Load persisted state
         */
        loadState() {
            try {
                const stored = GM_getValue(`${MODULE_ID}-state`, '{}');
                if (stored) {
                    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
                    this.state = { ...this.state, ...parsed };
                }

                const history = GM_getValue(`${MODULE_ID}-history`, '[]');
                if (history) {
                    this.taskHistory = typeof history === 'string' ? JSON.parse(history) : history;
                }

                const tasks = GM_getValue(`${MODULE_ID}-tasks`, '[]');
                if (tasks) {
                    const parsedTasks = typeof tasks === 'string' ? JSON.parse(tasks) : tasks;
                    // Restore task metadata (execute functions can't be serialized)
                    this.taskQueue = parsedTasks.map(t => ({
                        ...t,
                        execute: null, // Must be re-registered
                        status: 'queued'
                    }));
                }
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to load state:`, error);
            }
        }

        /**
         * Save state to GM storage
         */
        saveState() {
            try {
                GM_setValue(`${MODULE_ID}-state`, JSON.stringify(this.state));
                GM_setValue(`${MODULE_ID}-history`, JSON.stringify(this.taskHistory));

                // Save task metadata (without execute functions)
                const taskMeta = this.taskQueue.map(t => ({
                    id: t.id,
                    name: t.name,
                    priority: t.priority,
                    interval: t.interval,
                    recurring: t.recurring,
                    createdAt: t.createdAt,
                    lastRun: t.lastRun,
                    status: t.status,
                    retries: t.retries,
                    maxRetries: t.maxRetries
                }));
                GM_setValue(`${MODULE_ID}-tasks`, JSON.stringify(taskMeta));
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to save state:`, error);
            }
        }

        /**
         * Update configuration
         * @param {Object} newConfig
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
         * Handle config updates
         */
        onConfigUpdate() {
            console.log(`[${MODULE_ID}] Config updated:`, this.config);
        }

        /**
         * Event emitter
         */
        on(event, callback) {
            if (!this.eventListeners.has(event)) {
                this.eventListeners.set(event, []);
            }
            this.eventListeners.get(event).push(callback);
            return () => this.off(event, callback);
        }

        off(event, callback) {
            const callbacks = this.eventListeners.get(event) || [];
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }

        emit(event, data) {
            const callbacks = this.eventListeners.get(event) || [];
            callbacks.forEach(cb => {
                try { cb(data); } catch (e) { console.error(`[${MODULE_ID}] Event error:`, e); }
            });
        }

        /**
         * Show notification
         * @param {string} message
         * @param {string} icon
         * @private
         */
        showNotification(message, icon = 'ℹ️') {
            if (typeof GM_notification === 'function') {
                GM_notification(message, icon);
            }
        }

        /**
         * Expose public API
         */
        exposeAPI() {
            window[MODULE_ID] = window[MODULE_ID] || {};
            const api = window[MODULE_ID];

            api.id = MODULE_ID;
            api.name = MODULE_NAME;
            api.version = MODULE_VERSION;
            api.addTask = (task) => this.addTask(task);
            api.removeTask = (taskId) => this.removeTask(taskId);
            api.getStatus = () => this.getStatus();
            api.getTasks = () => this.getTasks();
            api.getHistory = () => this.getHistory();
            api.startProcessing = () => this.startProcessing();
            api.stopProcessing = () => this.stopProcessing();
            api.pause = () => this.pause();
            api.resume = () => this.resume();
            api.togglePause = () => this.togglePause();
            api.getTaskMetrics = (taskId) => this.getTaskMetrics(taskId);
            api.scheduleCronJob = (config) => this.scheduleCronJob(config);
            api.getConfig = () => this.getConfig();
            api.setConfig = (cfg) => this.setConfig(cfg);
            api.init = () => this.init();
            api.destroy = () => this.destroy();
        }

        /**
         * Clean up resources
         */
        destroy() {
            try {
                this.stopProcessing();

                // Clear all scheduled intervals
                for (const [taskId, interval] of this.scheduledIntervals.entries()) {
                    clearInterval(interval);
                }
                this.scheduledIntervals.clear();

                // Clear all scheduled timeouts
                for (const [jobId, timeout] of this.scheduledTimeouts.entries()) {
                    clearTimeout(timeout);
                }
                this.scheduledTimeouts.clear();

                this.taskQueue = [];
                this.activeTasks.clear();
                this.cronJobs.clear();
                this.eventListeners.clear();

                delete window[MODULE_ID];

                this.state.initialized = false;
                this.saveState();

                console.log(`[${MODULE_ID}] Destroyed successfully`);
                this.emit('destroyed');
            } catch (error) {
                console.error(`[${MODULE_ID}] Cleanup failed:`, error);
            }
        }

        /**
         * Cleanup alias
         */
        cleanup() {
            this.destroy();
        }
    }

    // Initialize module
    const instance = new AutonomousAgentRunner();

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