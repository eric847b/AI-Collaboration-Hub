/**
 * Unified AI Assistant Suite - Advanced Analytics Module
 * @version 1.7.0
 * 
 * Generation success tracking, provider comparison, time saved metrics,
 * and usage pattern analysis.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const AnalyticsModule = {
    events: [],
    dailyStats: {},
    maxEvents: 1000,

    /**
     * Track a generation event
     * @param {Object} event - Event data
     */
    trackGeneration(event) {
        const entry = {
            type: 'generation',
            provider: event.provider || 'unknown',
            success: event.success ?? true,
            duration: event.duration || 0,
            scriptLength: event.scriptLength || 0,
            templateUsed: event.templateUsed || null,
            timestamp: Date.now()
        };
        
        this.events.push(entry);
        this.updateDailyStats(entry);
        
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
        
        // Persist to storage
        try {
            const history = JSON.parse(GM_getValue('analytics_events', '[]'));
            history.push(entry);
            GM_setValue('analytics_events', JSON.stringify(history.slice(-500)));
        } catch {}
    },

    /**
     * Update daily statistics
     * @param {Object} event - Event data
     */
    updateDailyStats(event) {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        if (!this.dailyStats[date]) {
            this.dailyStats[date] = {
                generations: 0,
                successCount: 0,
                totalDuration: 0,
                byProvider: {},
                totalScriptLength: 0
            };
        }
        
        const day = this.dailyStats[date];
        day.generations++;
        if (event.success) day.successCount++;
        day.totalDuration += event.duration;
        day.totalScriptLength += event.scriptLength;
        
        if (!day.byProvider[event.provider]) {
            day.byProvider[event.provider] = { count: 0, successCount: 0 };
        }
        day.byProvider[event.provider].count++;
        if (event.success) day.byProvider[event.provider].successCount++;
    },

    /**
     * Get summary statistics
     * @returns {Object} Summary
     */
    getSummary() {
        const total = this.events.length;
        const successful = this.events.filter(e => e.success).length;
        const byProvider = {};
        
        this.events.forEach(e => {
            if (!byProvider[e.provider]) {
                byProvider[e.provider] = { total: 0, success: 0, totalDuration: 0 };
            }
            byProvider[e.provider].total++;
            if (e.success) byProvider[e.provider].success++;
            byProvider[e.provider].totalDuration += e.duration;
        });
        
        // Calculate time saved (estimated: each generation saves ~5 minutes of manual work)
        const timeSavedMinutes = successful * 5;
        
        return {
            totalGenerations: total,
            successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
            totalScriptLength: this.events.reduce((sum, e) => sum + e.scriptLength, 0),
            avgDuration: total > 0 ? Math.round(this.events.reduce((sum, e) => sum + e.duration, 0) / total) : 0,
            timeSaved: {
                minutes: timeSavedMinutes,
                hours: Math.round(timeSavedMinutes / 60 * 10) / 10,
                days: Math.round(timeSavedMinutes / 60 / 8 * 10) / 10
            },
            byProvider,
            daily: Object.entries(this.dailyStats).slice(-30).map(([date, stats]) => ({
                date,
                ...stats
            }))
        };
    },

    /**
     * Get provider performance comparison
     * @returns {Array} Provider rankings
     */
    getProviderRankings() {
        const providerStats = {};
        
        this.events.forEach(e => {
            if (!providerStats[e.provider]) {
                providerStats[e.provider] = { total: 0, success: 0, duration: [], scriptLengths: [] };
            }
            providerStats[e.provider].total++;
            if (e.success) providerStats[e.provider].success++;
            providerStats[e.provider].duration.push(e.duration);
            providerStats[e.provider].scriptLengths.push(e.scriptLength);
        });
        
        return Object.entries(providerStats)
            .map(([provider, stats]) => ({
                provider,
                totalRequests: stats.total,
                successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
                avgDuration: stats.duration.length > 0 
                    ? Math.round(stats.duration.reduce((a, b) => a + b, 0) / stats.duration.length) 
                    : 0,
                avgScriptLength: stats.scriptLengths.length > 0
                    ? Math.round(stats.scriptLengths.reduce((a, b) => a + b, 0) / stats.scriptLengths.length)
                    : 0
            }))
            .sort((a, b) => b.successRate - a.successRate || a.avgDuration - b.avgDuration);
    },

    /**
     * Get usage patterns
     * @returns {Object} Usage patterns
     */
    getUsagePatterns() {
        const hourlyUsage = Array(24).fill(0);
        const dayOfWeekUsage = Array(7).fill(0);
        
        this.events.forEach(e => {
            const date = new Date(e.timestamp);
            hourlyUsage[date.getHours()]++;
            dayOfWeekUsage[date.getDay()]++;
        });
        
        // Template usage stats
        const templateUsage = {};
        this.events.filter(e => e.templateUsed).forEach(e => {
            templateUsage[e.templateUsed] = (templateUsage[e.templateUsed] || 0) + 1;
        });
        
        return {
            hourlyUsage,
            dayOfWeekUsage,
            templateUsage: Object.entries(templateUsage)
                .sort((a, b) => b[1] - a[1])
                .map(([template, count]) => ({ template, count })),
            mostActiveHour: hourlyUsage.indexOf(Math.max(...hourlyUsage)),
            mostActiveDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekUsage.indexOf(Math.max(...dayOfWeekUsage))]
        };
    },

    /**
     * Export analytics data
     * @returns {string} JSON export
     */
    export() {
        return JSON.stringify({
            summary: this.getSummary(),
            providerRankings: this.getProviderRankings(),
            usagePatterns: this.getUsagePatterns(),
            exportedAt: new Date().toISOString()
        }, null, 2);
    },

    /**
     * Clear all analytics data
     */
    clear() {
        this.events = [];
        this.dailyStats = {};
        try { GM_setValue('analytics_events', '[]'); } catch {}
    },

    isAvailable() {
        return true;
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnalyticsModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.analytics = AnalyticsModule;
}