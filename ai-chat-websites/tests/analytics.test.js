/**
 * Analytics Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

// Mock GM_* functions
global.GM_getValue = global.GM_getValue || ((key, def) => {
    const store = global.__gm_store || {};
    return store[key] !== undefined ? store[key] : def;
});
global.GM_setValue = global.GM_setValue || ((key, val) => {
    if (!global.__gm_store) global.__gm_store = {};
    global.__gm_store[key] = val;
});

// Mock window context
global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.state = {};
global.window.UnifiedSuite.debugLog = () => {};

describe('Analytics Module', () => {
    let AnalyticsModule;
    let mockStore;

    beforeAll(() => {
        AnalyticsModule = require('../Userscripts/modules/analytics.js').AnalyticsModule;
    });

    beforeEach(() => {
        mockStore = {};
        global.__gm_store = mockStore;
        // Reset module state
        AnalyticsModule.events = [];
        AnalyticsModule.dailyStats = {};
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('trackGeneration', () => {
        it('should track a generation event', () => {
            AnalyticsModule.trackGeneration({
                provider: 'openai',
                success: true,
                duration: 1500,
                scriptLength: 2500,
                templateUsed: 'cookie-banner'
            });

            expect(AnalyticsModule.events.length).toBe(1);
            expect(AnalyticsModule.events[0].provider).toBe('openai');
            expect(AnalyticsModule.events[0].success).toBe(true);
            expect(AnalyticsModule.events[0].duration).toBe(1500);
        });

        it('should use default values for optional fields', () => {
            AnalyticsModule.trackGeneration({});
            expect(AnalyticsModule.events[0].provider).toBe('unknown');
            expect(AnalyticsModule.events[0].success).toBe(true);
            expect(AnalyticsModule.events[0].duration).toBe(0);
        });

        it('should persist to GM storage', () => {
            AnalyticsModule.trackGeneration({
                provider: 'anthropic',
                success: true,
                duration: 2000
            });

            const stored = JSON.parse(GM_getValue('analytics_events', '[]'));
            expect(stored.length).toBeGreaterThanOrEqual(1);
        });

        it('should respect maxEvents limit', () => {
            // Track 1001 events
            for (let i = 0; i < 1001; i++) {
                AnalyticsModule.trackGeneration({ provider: 'test', success: true });
            }

            expect(AnalyticsModule.events.length).toBe(1000);
        });
    });

    describe('updateDailyStats', () => {
        it('should update daily statistics', () => {
            AnalyticsModule.trackGeneration({
                provider: 'openai',
                success: true,
                duration: 1000,
                scriptLength: 500,
                timestamp: Date.now()
            });

            const date = new Date().toISOString().split('T')[0];
            expect(AnalyticsModule.dailyStats[date]).toBeDefined();
            expect(AnalyticsModule.dailyStats[date].generations).toBe(1);
            expect(AnalyticsModule.dailyStats[date].successCount).toBe(1);
        });

        it('should track provider-specific stats', () => {
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true });
            AnalyticsModule.trackGeneration({ provider: 'anthropic', success: false });

            const date = new Date().toISOString().split('T')[0];
            expect(AnalyticsModule.dailyStats[date].byProvider.openai.count).toBe(1);
            expect(AnalyticsModule.dailyStats[date].byProvider.anthropic.count).toBe(1);
        });
    });

    describe('getSummary', () => {
        beforeEach(() => {
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true, duration: 1000, scriptLength: 500 });
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true, duration: 2000, scriptLength: 800 });
            AnalyticsModule.trackGeneration({ provider: 'anthropic', success: false, duration: 500, scriptLength: 200 });
        });

        it('should return summary with total generations', () => {
            const summary = AnalyticsModule.getSummary();
            expect(summary.totalGenerations).toBe(3);
        });

        it('should calculate success rate', () => {
            const summary = AnalyticsModule.getSummary();
            expect(summary.successRate).toBe(67); // 2/3 = 66.66... rounded
        });

        it('should calculate total script length', () => {
            const summary = AnalyticsModule.getSummary();
            expect(summary.totalScriptLength).toBe(1500);
        });

        it('should calculate average duration', () => {
            const summary = AnalyticsModule.getSummary();
            expect(summary.avgDuration).toBe(1167); // (1000+2000+500)/3 = 1166.67 rounded
        });

        it('should calculate time saved', () => {
            const summary = AnalyticsModule.getSummary();
            expect(summary.timeSaved.minutes).toBe(10); // 2 successful * 5 min
            expect(summary.timeSaved.hours).toBeCloseTo(0.2, 1);
        });

        it('should include provider breakdown', () => {
            const summary = AnalyticsModule.getSummary();
            expect(summary.byProvider.openai).toBeDefined();
            expect(summary.byProvider.openai.total).toBe(2);
            expect(summary.byProvider.openai.success).toBe(2);
        });

        it('should include daily stats for last 30 days', () => {
            const summary = AnalyticsModule.getSummary();
            expect(summary.daily).toBeDefined();
            expect(summary.daily.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getProviderRankings', () => {
        beforeEach(() => {
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true, duration: 1000, scriptLength: 500 });
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true, duration: 2000, scriptLength: 800 });
            AnalyticsModule.trackGeneration({ provider: 'anthropic', success: false, duration: 500, scriptLength: 200 });
        });

        it('should return ranked providers', () => {
            const rankings = AnalyticsModule.getProviderRankings();
            expect(rankings.length).toBe(2);
        });

        it('should sort by success rate', () => {
            const rankings = AnalyticsModule.getProviderRankings();
            expect(rankings[0].provider).toBe('openai');
            expect(rankings[0].successRate).toBe(100);
        });

        it('should include average duration and script length', () => {
            const rankings = AnalyticsModule.getProviderRankings();
            const openai = rankings.find(r => r.provider === 'openai');
            expect(openai.avgDuration).toBe(1500);
            expect(openai.avgScriptLength).toBe(650);
        });
    });

    describe('getUsagePatterns', () => {
        it('should return hourly usage array', () => {
            const patterns = AnalyticsModule.getUsagePatterns();
            expect(patterns.hourlyUsage.length).toBe(24);
        });

        it('should return day of week usage array', () => {
            const patterns = AnalyticsModule.getUsagePatterns();
            expect(patterns.dayOfWeekUsage.length).toBe(7);
        });

        it('should track template usage', () => {
            AnalyticsModule.trackGeneration({ templateUsed: 'cookie-banner' });
            AnalyticsModule.trackGeneration({ templateUsed: 'cookie-banner' });
            AnalyticsModule.trackGeneration({ templateUsed: 'privacy-policy' });

            const patterns = AnalyticsModule.getUsagePatterns();
            expect(patterns.templateUsage.length).toBe(2);
            expect(patterns.templateUsage[0].template).toBe('cookie-banner');
            expect(patterns.templateUsage[0].count).toBe(2);
        });

        it('should find most active hour and day', () => {
            const patterns = AnalyticsModule.getUsagePatterns();
            expect(typeof patterns.mostActiveHour).toBe('number');
            expect(typeof patterns.mostActiveDay).toBe('string');
            expect(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).toContain(patterns.mostActiveDay);
        });
    });

    describe('export', () => {
        it('should export analytics as JSON', () => {
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true });
            const exported = AnalyticsModule.export();
            const data = JSON.parse(exported);

            expect(data.summary).toBeDefined();
            expect(data.providerRankings).toBeDefined();
            expect(data.usagePatterns).toBeDefined();
            expect(data.exportedAt).toBeDefined();
        });
    });

    describe('clear', () => {
        it('should clear all analytics data', () => {
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true });
            expect(AnalyticsModule.events.length).toBeGreaterThan(0);

            AnalyticsModule.clear();
            expect(AnalyticsModule.events.length).toBe(0);
            expect(Object.keys(AnalyticsModule.dailyStats).length).toBe(0);
        });

        it('should clear GM storage', () => {
            AnalyticsModule.trackGeneration({ provider: 'openai', success: true });
            AnalyticsModule.clear();
            expect(GM_getValue('analytics_events', '[]')).toBe('[]');
        });
    });

    describe('isAvailable', () => {
        it('should return true', () => {
            expect(AnalyticsModule.isAvailable()).toBe(true);
        });
    });
});