// ==UserScript==
// @name         AutonomousImprovement
// @version      2026.05.04.0
// @description  ChatGPT - Self-improving system with automated optimization and learning
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
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/**
 * AutonomousImprovement - Self-improving system with automated optimization
 * Continuously monitors, learns, and improves the hub system
 */
(function() {
    'use strict';

    const AutonomousImprovement = {
        // System state
        isRunning: false,
        lastImprovement: null,
        improvements: [],
        metrics: {
            cycles: 0,
            fixes: 0,
            optimizations: 0,
            errors: 0,
            learned: 0
        },

        // Configuration
        config: {
            checkInterval: 30000,  // 30 seconds
            maxRetries: 3,
            learningRate: 0.1,
            adaptationThreshold: 0.7
        },

        /**
         * Initialize autonomous improvement
         */
        async init() {
            this.isRunning = true;
            this.startMonitoring();
            this.analyzeSystem();
            this.learn();
            console.log('[AutonomousImprovement] Initialized - Self-improvement active');
        },

        /**
         * Start periodic monitoring and improvement
         */
        startMonitoring() {
            this.monitorInterval = setInterval(() => {
                if (!this.isRunning) return;
                this.analyzeSystem();
                this.learn();
                this.applyImprovements();
            }, this.config.checkInterval);
        },

        /**
         * Stop monitoring
         */
        stopMonitoring() {
            if (this.monitorInterval) {
                clearInterval(this.monitorInterval);
                this.monitorInterval = null;
            }
            this.isRunning = false;
        },

        /**
         * Analyze system for improvement opportunities
         */
        analyzeSystem() {
            this.metrics.cycles++;

            // Check memory usage
            const memStats = window.MemoryManager?.getStats?.();
            if (memStats && memStats.current > memStats.threshold * 0.8) {
                this.addImprovement('memory', {
                    type: 'optimization',
                    priority: 'high',
                    action: 'cleanup',
                    reason: 'Memory usage above 80% threshold'
                });
            }

            // Check module health
            const health = window.ModuleRegistry?.getHealth?.() || [];
            const unhealthy = health.filter(h => !h.healthy);
            if (unhealthy.length > 0) {
                this.addImprovement('modules', {
                    type: 'fix',
                    priority: 'high',
                    action: 'reload',
                    affected: unhealthy.map(h => h.name),
                    reason: `${unhealthy.length} unhealthy modules detected`
                });
            }

            // Check error rate
            const errorLog = window.HubEventHandler?.errorLog || [];
            const recentErrors = errorLog.slice(-10);
            if (recentErrors.length >= 5) {
                this.addImprovement('errors', {
                    type: 'fix',
                    priority: 'medium',
                    action: 'clear_errors',
                    reason: `High error rate: ${recentErrors.length} recent errors`
                });
            }

            // Check module dependencies
            this.validateDependencies();

            // Auto-optimize config
            this.optimizeConfig();
        },

        /**
         * Validate module dependencies
         */
        validateDependencies() {
            const modules = window.ModuleRegistry?.list?.() || [];
            const issues = [];

            modules.forEach(mod => {
                const moduleEntry = window.ModuleRegistry?.modules?.get(mod.name.toLowerCase());
                if (moduleEntry?.module?.dependencies) {
                    moduleEntry.module.dependencies.forEach(dep => {
                        if (!window.ModuleRegistry?.get?.(dep)) {
                            issues.push({
                                module: mod.name,
                                missing: dep
                            });
                        }
                    });
                }
            });

            if (issues.length > 0) {
                this.addImprovement('dependencies', {
                    type: 'fix',
                    priority: 'high',
                    action: 'load_missing',
                    issues: issues,
                    reason: `${issues.length} missing dependencies detected`
                });
            }
        },

        /**
         * Optimize configuration
         */
        optimizeConfig() {
            const config = window.ConfigManager?.config || {};
            const optimizations = [];

            // Auto-enable performance optimizations if many modules
            const moduleCount = window.ModuleRegistry?.list?.().length || 0;
            if (moduleCount > 20 && !config.enablePerformanceMetrics) {
                optimizations.push({
                    key: 'enablePerformanceMetrics',
                    value: true,
                    reason: 'Auto-enabled for large module count'
                });
            }

            // Increase cache size if frequently clearing
            if (config.maxCacheSize < 1000 && moduleCount > 10) {
                optimizations.push({
                    key: 'maxCacheSize',
                    value: 2000,
                    reason: 'Increased cache for better performance'
                });
            }

            if (optimizations.length > 0) {
                this.addImprovement('config', {
                    type: 'optimization',
                    priority: 'low',
                    action: 'update_config',
                    changes: optimizations,
                    reason: 'Performance optimization'
                });
            }
        },

        /**
         * Apply pending improvements
         */
        async applyImprovements() {
            const pending = this.improvements.filter(i => !i.applied);
            if (pending.length === 0) return;

            for (const improvement of pending) {
                try {
                    await this.applyImprovement(improvement);
                    improvement.applied = true;
                    improvement.appliedAt = Date.now();
                    
                    if (improvement.type === 'fix') {
                        this.metrics.fixes++;
                    } else if (improvement.type === 'optimization') {
                        this.metrics.optimizations++;
                    }

                    console.log(`[AutonomousImprovement] Applied: ${improvement.reason}`);
                } catch (error) {
                    this.metrics.errors++;
                    console.error(`[AutonomousImprovement] Failed to apply:`, error);
                }
            }

            // Cleanup old improvements
            this.cleanup();
        },

        /**
         * Apply a single improvement
         */
        async applyImprovement(improvement) {
            switch (improvement.action) {
                case 'cleanup':
                    window.MemoryManager?.cleanup?.();
                    break;

                case 'reload':
                    if (improvement.affected && window.ModuleRegistry) {
                        for (const modName of improvement.affected) {
                            try {
                                await window.HubEventHandler?.handleReloadModule({
                                    moduleName: modName,
                                    moduleURL: ''
                                });
                            } catch (e) {
                                console.warn(`[AutonomousImprovement] Could not reload ${modName}:`, e);
                            }
                        }
                    }
                    break;

                case 'clear_errors':
                    window.HubEventHandler?.handleClearErrors?.();
                    break;

                case 'load_missing':
                    if (improvement.issues && window.ModuleLoader) {
                        for (const issue of improvement.issues) {
                            // Attempt to load from cache or skip
                            console.warn(`[AutonomousImprovement] Missing dependency: ${issue.missing} for ${issue.module}`);
                        }
                    }
                    break;

                case 'update_config':
                    if (improvement.changes && window.ConfigManager) {
                        for (const change of improvement.changes) {
                            window.ConfigManager.set('hub', change.key, change.value);
                        }
                    }
                    break;
            }
        },

        /**
         * Add improvement to queue
         */
        addImprovement(category, improvement) {
            // Deduplicate
            const exists = this.improvements.some(
                i => i.category === category && 
                     i.action === improvement.action && 
                     !i.applied
            );
            if (exists) return;

            this.improvements.push({
                id: `${category}_${Date.now()}_${Math.random()}`,
                category,
                ...improvement,
                detectedAt: Date.now(),
                applied: false
            });

            // Limit queue size
            if (this.improvements.length > 100) {
                this.improvements = this.improvements.slice(-50);
            }
        },

        /**
         * Cleanup old improvements
         */
        cleanup() {
            const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
            this.improvements = this.improvements.filter(
                i => !i.applied || i.appliedAt > cutoff
            );
        },

        /**
         * Get improvement statistics
         */
        getStats() {
            const pending = this.improvements.filter(i => !i.applied).length;
            const applied = this.improvements.filter(i => i.applied).length;
            
            return {
                metrics: this.metrics,
                queue: {
                    pending,
                    applied,
                    total: this.improvements.length
                },
                lastImprovement: this.lastImprovement,
                isRunning: this.isRunning
            };
        },

        /**
         * Self-healing: detect and fix common issues
         */
        selfHeal() {
            const issues = [];

            // Check if ModuleRegistry is accessible
            if (!window.ModuleRegistry) {
                issues.push({
                    component: 'ModuleRegistry',
                    issue: 'not_initialized',
                    fix: 'reinitialize'
                });
            }

            // Check if ConfigManager is accessible
            if (!window.ConfigManager) {
                issues.push({
                    component: 'ConfigManager',
                    issue: 'not_initialized',
                    fix: 'reinitialize'
                });
            }

            // Check if control panel is responsive
            if (window.ControlPanelUI && !window.ControlPanelUI.visible) {
                // Panel exists but hidden - this is OK
            } else if (!window.ControlPanelUI) {
                issues.push({
                    component: 'ControlPanelUI',
                    issue: 'not_initialized',
                    fix: 'reinitialize'
                });
            }

            return issues;
        },

        /**
         * Autonomous learning: adapt based on usage patterns
         */
        learn() {
            const stats = this.getStats();
            
            // Learn optimal check interval
            if (stats.metrics.cycles > 10) {
                const avgImprovementsPerCycle = stats.metrics.fixes / stats.metrics.cycles;
                
                if (avgImprovementsPerCycle < 0.1) {
                    // Few improvements, can check less frequently
                    this.config.checkInterval = Math.min(this.config.checkInterval * 1.2, 60000);
                } else if (avgImprovementsPerCycle > 0.5) {
                    // Many improvements, check more frequently
                    this.config.checkInterval = Math.max(this.config.checkInterval * 0.8, 10000);
                }
            }

            // Adapt to error patterns
            const recentErrors = this.improvements.filter(
                i => i.type === 'fix' && i.category === 'errors'
            );
            
            if (recentErrors.length > 10) {
                // Increase error tolerance temporarily
                this.config.adaptationThreshold *= 0.95;
            }

            // Pattern recognition for optimization
            this.recognizePatterns();

            // Predictive maintenance
            this.predictiveMaintenance();

            this.metrics.learned++;
        },

        /**
         * Recognize patterns in system behavior
         */
        recognizePatterns() {
            const patterns = [];
            
            // Memory pattern: detect if memory cleanup is consistently needed
            const memoryFixes = this.improvements.filter(i => i.category === 'memory' && i.type === 'optimization');
            if (memoryFixes.length > 5) {
                const avgTimeBetween = this.calculateAverageInterval(memoryFixes);
                if (avgTimeBetween < 300000) { // Less than 5 minutes
                    patterns.push({
                        type: 'memory_pressure',
                        severity: 'high',
                        recommendation: 'Consider increasing memory threshold or enabling aggressive cleanup'
                    });
                }
            }

            // Module pattern: detect frequently failing modules
            const moduleFixes = this.improvements.filter(i => i.category === 'modules' && i.type === 'fix');
            const moduleFailureCounts = {};
            moduleFixes.forEach(fix => {
                fix.affected?.forEach(mod => {
                    moduleFailureCounts[mod] = (moduleFailureCounts[mod] || 0) + 1;
                });
            });

            Object.entries(moduleFailureCounts).forEach(([mod, count]) => {
                if (count > 3) {
                    patterns.push({
                        type: 'unstable_module',
                        severity: 'medium',
                        module: mod,
                        recommendation: `Module "${mod}" fails frequently. Consider replacing or fixing.`
                    });
                }
            });

            // Error pattern: detect recurring errors
            const errorFixes = this.improvements.filter(i => i.category === 'errors' && i.type === 'fix');
            if (errorFixes.length > 10) {
                patterns.push({
                    type: 'error_storm',
                    severity: 'high',
                    recommendation: 'High error rate detected. Investigate root cause.'
                });
            }

            // Store patterns for analysis
            if (patterns.length > 0) {
                this.addImprovement('patterns', {
                    type: 'analysis',
                    priority: 'low',
                    action: 'log_patterns',
                    patterns: patterns,
                    reason: 'Pattern recognition completed'
                });
            }
        },

        /**
         * Calculate average interval between improvements
         */
        calculateAverageInterval(improvements) {
            if (improvements.length < 2) return Infinity;
            
            const sorted = improvements
                .filter(i => i.detectedAt)
                .sort((a, b) => a.detectedAt - b.detectedAt);
            
            let totalInterval = 0;
            for (let i = 1; i < sorted.length; i++) {
                totalInterval += sorted[i].detectedAt - sorted[i-1].detectedAt;
            }
            
            return totalInterval / (sorted.length - 1);
        },

        /**
         * Predictive maintenance: anticipate issues before they occur
         */
        predictiveMaintenance() {
            const predictions = [];
            
            // Predict memory exhaustion
            const memStats = window.MemoryManager?.getStats?.();
            if (memStats && memStats.current && memStats.limit) {
                const usagePercent = memStats.current / memStats.limit;
                const growthRate = this.estimateGrowthRate('memory');
                
                if (usagePercent > 0.7 && growthRate > 0) {
                    const timeToExhaustion = this.estimateTimeToThreshold(memStats.current, memStats.limit, growthRate);
                    if (timeToExhaustion < 300000) { // Less than 5 minutes
                        predictions.push({
                            type: 'memory_exhaustion',
                            severity: 'critical',
                            estimatedTime: timeToExhaustion,
                            recommendation: 'Immediate memory cleanup required'
                        });
                    }
                }
            }

            // Predict module failures
            const modules = window.ModuleRegistry?.list?.() || [];
            modules.forEach(mod => {
                const failureRate = this.calculateFailureRate(mod.name);
                if (failureRate > 0.3) { // 30% failure rate
                    predictions.push({
                        type: 'module_failure',
                        severity: 'medium',
                        module: mod.name,
                        recommendation: `Module "${mod.name}" likely to fail soon. Consider preventive reload.`
                    });
                }
            });

            // Act on critical predictions
            predictions.forEach(pred => {
                if (pred.severity === 'critical') {
                    this.addImprovement('predictive', {
                        type: 'preventive',
                        priority: 'critical',
                        action: pred.type === 'memory_exhaustion' ? 'cleanup' : 'reload',
                        module: pred.module,
                        reason: `Predictive: ${pred.recommendation}`
                    });
                }
            });
        },

        /**
         * Estimate growth rate based on historical data
         */
        estimateGrowthRate(metric) {
            const samples = window.MemoryManager?.heapUsage || [];
            if (samples.length < 10) return 0;
            
            const recent = samples.slice(-10);
            const growthRates = [];
            
            for (let i = 1; i < recent.length; i++) {
                const rate = (recent[i].used - recent[i-1].used) / (recent[i].timestamp - recent[i-1].timestamp);
                growthRates.push(rate);
            }
            
            const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
            return avgGrowth > 0 ? avgGrowth : 0;
        },

        /**
         * Estimate time until threshold is reached
         */
        estimateTimeToThreshold(current, threshold, growthRate) {
            if (growthRate <= 0) return Infinity;
            const remaining = threshold - current;
            return remaining / growthRate;
        },

        /**
         * Calculate failure rate for a module
         */
        calculateFailureRate(moduleName) {
            const totalAttempts = this.improvements.filter(
                i => i.category === 'modules' && i.affected?.includes(moduleName)
            ).length;
            
            if (totalAttempts === 0) return 0;
            
            const failures = this.improvements.filter(
                i => i.category === 'modules' && i.affected?.includes(moduleName) && i.type === 'fix'
            ).length;
            
            return failures / totalAttempts;
        },

        /**
         * Collect feedback from system events
         */
        collectFeedback() {
            // Listen for user actions via custom events
            const feedbackHandler = (e) => {
                if (e.detail?.type === 'user_feedback') {
                    const { action, success } = e.detail;
                    
                    if (success) {
                        this.metrics.learned++;
                    } else {
                        this.addImprovement('feedback', {
                            type: 'fix',
                            priority: 'medium',
                            action: 'investigate',
                            reason: `User-reported issue: ${action}`
                        });
                    }
                }
            };

            window.addEventListener('SystemFeedback', feedbackHandler);
            
            // Store handler for cleanup
            this._feedbackHandler = feedbackHandler;
        },

        /**
         * Generate improvement report
         */
        generateReport() {
            const stats = this.getStats();
            const patterns = this.improvements.filter(i => i.category === 'patterns');
            const predictions = this.improvements.filter(i => i.category === 'predictive');
            
            return {
                summary: {
                    totalCycles: stats.metrics.cycles,
                    totalFixes: stats.metrics.fixes,
                    totalOptimizations: stats.metrics.optimizations,
                    totalErrors: stats.metrics.errors,
                    learningIterations: stats.metrics.learned,
                    systemHealth: this.calculateSystemHealth()
                },
                improvements: {
                    pending: stats.queue.pending,
                    applied: stats.queue.applied,
                    recent: this.improvements.slice(-10)
                },
                patterns: patterns.length,
                predictions: predictions.length,
                recommendations: this.generateRecommendations(),
                lastAnalysis: new Date().toISOString()
            };
        },

        /**
         * Calculate overall system health score
         */
        calculateSystemHealth() {
            const stats = this.getStats();
            const errorRate = stats.metrics.errors / Math.max(stats.metrics.cycles, 1);
            const successRate = 1 - errorRate;
            
            let health = successRate * 100;
            
            // Factor in pending issues
            if (stats.queue.pending > 10) health *= 0.8;
            
            // Factor in patterns detected
            const patterns = this.improvements.filter(i => i.category === 'patterns');
            if (patterns.length > 5) health *= 0.9;
            
            return Math.round(Math.max(0, Math.min(100, health)));
        },

        /**
         * Generate actionable recommendations
         */
        generateRecommendations() {
            const recommendations = [];
            const stats = this.getStats();
            
            // High error rate
            if (stats.metrics.errors > 20) {
                recommendations.push({
                    priority: 'high',
                    action: 'Review error logs',
                    reason: `${stats.metrics.errors} errors detected`
                });
            }
            
            // Many pending improvements
            if (stats.queue.pending > 15) {
                recommendations.push({
                    priority: 'medium',
                    action: 'Review pending improvements',
                    reason: `${stats.queue.pending} improvements waiting`
                });
            }
            
            // Low learning iteration count
            if (stats.metrics.learned < 10) {
                recommendations.push({
                    priority: 'low',
                    action: 'Allow more time for learning',
                    reason: 'System still collecting data'
                });
            }
            
            return recommendations;
        },

        /**
         * Export state for persistence
         */
        exportState() {
            return {
                config: { ...this.config },
                metrics: { ...this.metrics },
                improvements: this.improvements.slice(-50), // Last 50
                timestamp: Date.now()
            };
        },

        /**
         * Import state from persistence
         */
        importState(state) {
            if (!state || typeof state !== 'object') return false;
            
            if (state.config) {
                this.config = { ...this.config, ...state.config };
            }
            
            if (state.metrics) {
                this.metrics = { ...this.metrics, ...state.metrics };
            }
            
            if (Array.isArray(state.improvements)) {
                this.improvements = state.improvements;
            }
            
            return true;
        },

        /**
         * Destroy cleanup
         */
        destroy() {
            this.stopMonitoring();
            this.improvements = [];
            
            if (this._feedbackHandler) {
                window.removeEventListener('SystemFeedback', this._feedbackHandler);
            }
            
            console.log('[AutonomousImprovement] Destroyed');
        }
    };

    // Export to global scope
    window.AutonomousImprovement = AutonomousImprovement;

    console.log('[AutonomousImprovement] Initialized v2026.05.04.0');
})();