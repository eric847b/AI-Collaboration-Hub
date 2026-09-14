/**
 * Unified AI Assistant Suite - Multi-Model Orchestration Module
 * @version 1.0.0
 *
 * Routes prompts to the best provider/model per task type, manages
 * cost/latency profiles, and provides fallback failover between providers.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const ProvidersModule = (typeof window !== 'undefined' && window.UnifiedSuite?.modules?.providers) || null;

/**
 * Model cost/latency profiles — updated from real pricing data.
 */
const MODEL_PROFILES = {
    'gpt-4o': { provider: 'OPENAI', costPer1kTokens: 0.015, latencyMs: 800, strengths: ['code', 'analysis', 'reasoning'] },
    'gpt-3.5-turbo': { provider: 'OPENAI', costPer1kTokens: 0.001, latencyMs: 500, strengths: ['summarization', 'code'] },
    'claude-3-5-sonnet-20241022': { provider: 'ANTHROPIC', costPer1kTokens: 0.003, latencyMs: 600, strengths: ['reasoning', 'analysis', 'summarization'] },
    'claude-3-haiku-20240307': { provider: 'ANTHROPIC', costPer1kTokens: 0.00025, latencyMs: 300, strengths: ['summarization', 'creative'] },
    'gemini-pro': { provider: 'GEMINI', costPer1kTokens: 0.0005, latencyMs: 700, strengths: ['code', 'analysis', 'creative'] },
    'llama2': { provider: 'OLLAMA', costPer1kTokens: 0.0, latencyMs: 1200, strengths: ['creative', 'summarization'] },
};

const DEFAULT_ROUTING = {
    code: ['OPENAI', 'ANTHROPIC', 'GEMINI', 'OLLAMA'],
    creative: ['ANTHROPIC', 'GEMINI', 'OLLAMA', 'OPENAI'],
    analysis: ['ANTHROPIC', 'OPENAI', 'GEMINI', 'OLLAMA'],
    summarization: ['ANTHROPIC', 'GEMINI', 'OLLAMA', 'OPENAI'],
    reasoning: ['ANTHROPIC', 'OPENAI', 'GEMINI', 'OLLAMA'],
};

const MultiModelOrchestrationModule = {
    routingTable: {},
    usageHistory: [],
    maxHistory: 1000,
    failoverAttempts: 0,
    maxFailoverAttempts: 3,

    init(userRouting) {
        this.routingTable = { ...DEFAULT_ROUTING };
        if (userRouting) {
            for (const [taskType, providers] of Object.entries(userRouting)) {
                this.routingTable[taskType] = [...providers];
            }
        }
        debugLog('MultiModelOrchestration: initialized', this.routingTable);
    },

    classifyTask(prompt) {
        const lower = prompt.toLowerCase();
        if (lower.includes('function') || lower.includes('script') || lower.includes('code') ||
            lower.includes('javascript') || lower.includes('python') || lower.includes('typescript') ||
            lower.includes('api') || lower.includes('endpoint')) return 'code';
        if (lower.includes('analyze') || lower.includes('evaluate') || lower.includes('compare') ||
            lower.includes('review') || lower.includes('assess') || lower.includes('performance')) return 'analysis';
        if (lower.includes('why') || lower.includes('explain') || lower.includes('reason') ||
            lower.includes('logic') || lower.includes('hypothesis') || lower.includes('diagnose')) return 'reasoning';
        if (lower.includes('write') || lower.includes('story') || lower.includes('creative') ||
            lower.includes('content') || lower.includes('blog') || lower.includes('article') ||
            lower.includes('design')) return 'creative';
        if (lower.includes('summarize') || lower.includes('summary') || lower.includes('shorten') ||
            lower.includes('condense') || lower.includes('brief') || lower.includes('overview')) return 'summarization';
                return 'code';
    },

    getBestProvider(prompt, taskType) {
        const task = taskType || this.classifyTask(prompt);
        const providerOrder = this.routingTable[task] || this.routingTable.code;
        if (!providerOrder || providerOrder.length === 0) {
            throw new Error(`No providers available for task type: ${task}`);
        }
        const primaryProvider = providerOrder[0];
        const model = this.getModelForProvider(primaryProvider, task);
        return {
            provider: primaryProvider,
            model,
            profile: MODEL_PROFILES[model] || MODEL_PROFILES['gpt-4o'],
        };
    },

    getModelForProvider(provider, taskType) {
        const candidates = Object.entries(MODEL_PROFILES)
            .filter(([_, p]) => p.provider === provider && p.strengths.includes(taskType))
            .sort((a, b) => a[1].costPer1kTokens - b[1].costPer1kTokens);
        if (candidates.length > 0) return candidates[0][0];

        const providerModels = Object.entries(MODEL_PROFILES)
            .filter(([_, p]) => p.provider === provider)
            .sort((a, b) => a[1].costPer1kTokens - b[1].costPer1kTokens);
        if (providerModels.length > 0) return providerModels[0][0];

        return CONFIG?.AI_PROVIDERS?.[provider]?.model || 'gpt-4o';
    },

    getFallbackProviders(failedProvider, taskType) {
        const order = this.routingTable[taskType] || this.routingTable.code;
                return order.filter(p => p !== failedProvider);
    },

    async route(prompt, onStreamChunk, onFailover) {
        if (!ProvidersModule) throw new Error('ProvidersModule not available');
        const taskType = this.classifyTask(prompt);
        let { provider, model, profile } = this.getBestProvider(prompt, taskType);
        let lastError;
        this.failoverAttempts = 0;

        while (this.failoverAttempts <= this.maxFailoverAttempts) {
            try {
                const result = await ProvidersModule.generateWithProvider(provider, prompt, onStreamChunk);
                this.recordUsage({ provider, model, taskType, success: true,
                    latencyMs: result.latency || Date.now(), promptLength: prompt.length,
                    resultLength: result.content?.length || 0 });
                return { content: result.content, provider, model, taskType,
                    failoverCount: this.failoverAttempts, profile };
            } catch (error) {
                lastError = error;
                if (onFailover) onFailover({ provider, model, error: error.message,
                    attempt: this.failoverAttempts + 1 });
                this.failoverAttempts++;
                const fallbacks = this.getFallbackProviders(provider, taskType);
                if (this.failoverAttempts > this.maxFailoverAttempts || fallbacks.length === 0) break;
                provider = fallbacks[0];
                model = this.getModelForProvider(provider, taskType);
                profile = MODEL_PROFILES[model] || MODEL_PROFILES['gpt-4o'];
            }
        }

        this.recordUsage({ provider: 'NONE', model, taskType, success: false,
            error: lastError?.message || 'All providers failed' });
        throw new Error(`All providers failed after ${this.maxFailoverAttempts} retries. Last: ${lastError?.message}`);
    },

    recordUsage(entry) {
        this.usageHistory.push({ ...entry, timestamp: Date.now() });
        if (this.usageHistory.length > this.maxHistory) {
            this.usageHistory = this.usageHistory.slice(-this.maxHistory);
        }
        debugLog('MultiModel: recorded usage', entry);
    },

    getUsageStats() {
        const stats = { totalCalls: 0, successfulCalls: 0, failedCalls: 0,
            failoverRate: 0, providerBreakdown: {}, taskBreakdown: {}, averageLatency: 0, totalCost: 0 };
        let totalLatency = 0, latencyCount = 0, failoverCount = 0;
        for (const entry of this.usageHistory) {
            stats.totalCalls++;
            if (entry.success) {
                stats.successfulCalls++;
                if (entry.failoverCount > 0) failoverCount++;
                stats.providerBreakdown[entry.provider] = (stats.providerBreakdown[entry.provider] || 0) + 1;
                stats.taskBreakdown[entry.taskType] = (stats.taskBreakdown[entry.taskType] || 0) + 1;
                if (entry.latencyMs) { totalLatency += entry.latencyMs; latencyCount++; }
                const tokens = Math.ceil((entry.promptLength + entry.resultLength) / 4);
                if (MODEL_PROFILES[entry.model]) {
                    stats.totalCost += (tokens / 1000) * MODEL_PROFILES[entry.model].costPer1kTokens;
                }
            } else {
                stats.failedCalls++;
            }
        }
        stats.failoverRate = stats.successfulCalls > 0 ? (failoverCount / stats.successfulCalls) * 100 : 0;
        stats.averageLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
        return stats;
    },

    estimateCost(prompt, expectedOutputLength = 1000) {
        const promptTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil(expectedOutputLength / 4);
        const totalTokens = promptTokens + outputTokens;
        const estimates = {};
        for (const [model, profile] of Object.entries(MODEL_PROFILES)) {
            estimates[model] = { provider: profile.provider,
                cost: (totalTokens / 1000) * profile.costPer1kTokens,
                latencyMs: profile.latencyMs, strengths: profile.strengths };
        }
        return { totalTokens, estimates };
    },

    updateRouting(taskType, providers) {
        this.routingTable[taskType] = [...providers];
        debugLog(`MultiModel: updated routing for ${taskType}`, providers);
    },

    getRoutingTable() {
        return { ...this.routingTable };
    },

    resetUsageHistory() {
        this.usageHistory = [];
        this.failoverAttempts = 0;
        debugLog('MultiModel: usage history reset');
    },
};

// Initialize and export
if (typeof window !== 'undefined' && window.UnifiedSuite) {
    window.UnifiedSuite.modules = window.UnifiedSuite.modules || {};
    window.UnifiedSuite.modules.multiModelOrchestration = MultiModelOrchestrationModule;
    MultiModelOrchestrationModule.init();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiModelOrchestrationModule;
    module.exports.MODEL_PROFILES = MODEL_PROFILES;
    module.exports.DEFAULT_ROUTING = DEFAULT_ROUTING;
}
