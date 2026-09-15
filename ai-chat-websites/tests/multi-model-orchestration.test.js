/**
 * Multi-Model Orchestration Module Unit Tests
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = {
    AI_PROVIDERS: {
        OPENAI: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
        ANTHROPIC: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20241022' },
        GEMINI: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', model: 'gemini-pro' },
        OLLAMA: { endpoint: 'http://localhost:11434/api/generate', model: 'llama2' }
    }
};
global.window.UnifiedSuite.state = { apiKey: 'test-key-123' };
global.window.UnifiedSuite.debugLog = () => {};
global.window.UnifiedSuite.modules = { providers: { generateWithProvider: jest.fn() } };

const { MODEL_PROFILES, DEFAULT_ROUTING } = require('../Userscripts/v3/037-multi-model-orchestration.js');
const MMOM = require('../Userscripts/v3/037-multi-model-orchestration.js');
const ProvidersModule = global.window.UnifiedSuite.modules.providers;

describe('Multi-Model Orchestration Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MMOM.resetUsageHistory();
        MMOM.init();
        ProvidersModule.generateWithProvider.mockClear();
    });
    describe('classifyTask', () => {
        it('classifies code prompts', () => {
            expect(MMOM.classifyTask('write a javascript function')).toBe('code');
            expect(MMOM.classifyTask('create an api endpoint')).toBe('code');
        });
        it('classifies analysis prompts', () => {
            expect(MMOM.classifyTask('analyze this performance report')).toBe('analysis');
        });
        it('classifies reasoning prompts', () => {
            expect(MMOM.classifyTask('diagnose this hypothesis with logic')).toBe('reasoning');
        });
        it('classifies creative prompts', () => {
            expect(MMOM.classifyTask('write a creative story blog')).toBe('creative');
        });
        it('classifies summarization prompts', () => {
            expect(MMOM.classifyTask('summarize this briefly')).toBe('summarization');
        });
        it('defaults unknown prompts to code', () => {
            expect(MMOM.classifyTask('hello there')).toBe('code');
        });
    });
    describe('init and routing', () => {
        it('uses DEFAULT_ROUTING when no user routing given', () => {
            const table = MMOM.getRoutingTable();
            expect(table.code).toEqual(DEFAULT_ROUTING.code);
            expect(table.analysis).toEqual(DEFAULT_ROUTING.analysis);
        });
        it('merges user routing overrides', () => {
            MMOM.init({ code: ['OLLAMA', 'OPENAI'] });
            expect(MMOM.getRoutingTable().code).toEqual(['OLLAMA', 'OPENAI']);
            expect(MMOM.getRoutingTable().analysis).toEqual(DEFAULT_ROUTING.analysis);
        });
        it('updateRouting replaces providers for a task', () => {
            MMOM.updateRouting('creative', ['GEMINI']);
            expect(MMOM.getRoutingTable().creative).toEqual(['GEMINI']);
        });
        it('getRoutingTable returns a copy', () => {
            const table = MMOM.getRoutingTable();
            table.code.push('FAKE');
            expect(MMOM.getRoutingTable().code).not.toContain('FAKE');
        });
    });
    describe('estimateCost', () => {
        it('computes total tokens and per-model costs', () => {
            const prompt = 'x'.repeat(400);
            const { totalTokens, estimates } = MMOM.estimateCost(prompt, 400);
            expect(totalTokens).toBe(200);
            expect(estimates['gpt-4o'].cost).toBeCloseTo(0.2 * 0.015, 6);
            expect(estimates['llama2'].cost).toBe(0);
            expect(estimates['gpt-4o'].provider).toBe('OPENAI');
        });
    });
    describe('recordUsage and getUsageStats', () => {
        it('tracks successes, failures, breakdowns and cost', () => {
            MMOM.recordUsage({ provider: 'OPENAI', model: 'gpt-4o', taskType: 'code', success: true, latencyMs: 800, promptLength: 400, resultLength: 400, failoverCount: 0 });
            MMOM.recordUsage({ provider: 'ANTHROPIC', model: 'claude-3-5-sonnet-20241022', taskType: 'analysis', success: true, latencyMs: 600, promptLength: 400, resultLength: 0, failoverCount: 1 });
            MMOM.recordUsage({ provider: 'NONE', model: 'gpt-4o', taskType: 'code', success: false });
            const stats = MMOM.getUsageStats();
            expect(stats.totalCalls).toBe(3);
            expect(stats.successfulCalls).toBe(2);
            expect(stats.failedCalls).toBe(1);
            expect(stats.providerBreakdown.OPENAI).toBe(1);
            expect(stats.taskBreakdown.code).toBe(1);
            expect(stats.averageLatency).toBe(700);
            expect(stats.failoverRate).toBe(50);
            expect(stats.totalCost).toBeGreaterThan(0);
        });
        it('caps history at maxHistory', () => {
            MMOM.maxHistory = 5;
            for (let i = 0; i < 8; i++) MMOM.recordUsage({ provider: 'OPENAI', model: 'gpt-4o', taskType: 'code', success: true });
            expect(MMOM.usageHistory.length).toBe(5);
            MMOM.maxHistory = 1000;
        });
    });
    describe('route with failover', () => {
        it('succeeds on first provider without failover', async () => {
            ProvidersModule.generateWithProvider.mockResolvedValueOnce({ content: 'hello', latency: 100 });
            const result = await MMOM.route('write code function');
            expect(result.content).toBe('hello');
            expect(result.provider).toBe('OPENAI');
            expect(result.taskType).toBe('code');
            expect(result.failoverCount).toBe(0);
            expect(MMOM.getUsageStats().successfulCalls).toBe(1);
        });
        it('fails over to next provider after first failure', async () => {
            ProvidersModule.generateWithProvider
                .mockRejectedValueOnce(new Error('down'))
                .mockResolvedValueOnce({ content: 'recovered', latency: 50 });
            const result = await MMOM.route('write code function');
            expect(result.content).toBe('recovered');
            expect(result.provider).toBe('ANTHROPIC');
            expect(result.failoverCount).toBe(1);
            expect(ProvidersModule.generateWithProvider).toHaveBeenCalledTimes(2);
            const stats = MMOM.getUsageStats();
            expect(stats.successfulCalls).toBe(1);
        });
        it('throws after all providers fail', async () => {
            ProvidersModule.generateWithProvider.mockRejectedValue(new Error('all down'));
            MMOM.maxFailoverAttempts = 1;
            await expect(MMOM.route('summarize this brief')).rejects.toThrow('All providers failed');
            MMOM.maxFailoverAttempts = 3;
        });
        it('throws when no providers are configured for the task', async () => {
            MMOM.updateRouting('code', []);
            await expect(MMOM.route('write code function')).rejects.toThrow('No providers available');
        });
        it('invokes onFailover callback on failure', async () => {
            ProvidersModule.generateWithProvider
                .mockRejectedValueOnce(new Error('boom'))
                .mockResolvedValueOnce({ content: 'ok', latency: 10 });
            const calls = [];
            const result = await MMOM.route('write code function', null, (info) => calls.push(info));
            expect(result.content).toBe('ok');
            expect(calls.length).toBe(1);
            expect(calls[0].provider).toBe('OPENAI');
        });
    });
    describe('provider selection', () => {
        it('getBestProvider returns first routing-table provider plus model and profile', () => {
            const best = MMOM.getBestProvider('write code function', 'code');
            expect(best.provider).toBe('OPENAI');
            expect(best.model).toBe(MMOM.getModelForProvider('OPENAI', 'code'));
            expect(best.profile.provider).toBe('OPENAI');
        });
        it('getBestProvider throws when no providers configured', () => {
            MMOM.updateRouting('code', []);
            expect(() => MMOM.getBestProvider('write code', 'code')).toThrow('No providers available');
        });
        it('getModelForProvider returns profile model', () => {
            expect(MMOM.getModelForProvider('OPENAI', 'code')).toBe('gpt-3.5-turbo');
            expect(MMOM.getModelForProvider('NOPE', 'code')).toBe('gpt-4o');
        });
        it('getFallbackProviders excludes the failed provider', () => {
            const fb = MMOM.getFallbackProviders('OPENAI', 'code');
            expect(fb).not.toContain('OPENAI');
            expect(fb.length).toBeGreaterThan(0);
        });
    });
});