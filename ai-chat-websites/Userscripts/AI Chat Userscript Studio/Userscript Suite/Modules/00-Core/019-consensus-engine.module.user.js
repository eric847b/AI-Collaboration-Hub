// ==UserScript==
// @name         consensus-engine
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.0
// @description  Consensus engine - merges nexus_consensus multi-role AI (Planner/Researcher/Critic/Forge/Echo) adapted for browser context with rule-based fallback
// @author       AI Chat Userscript Studio (merged from autonomous-github-agent/nexus_consensus.py)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Consensus Engine v1.0
 * Merged from: autonomous-github-agent/nexus_consensus.py
 * Roles: Planner -> Researcher -> Critic -> Forge -> Echo
 * Upgrades: browser-native, rule-based fallback (no LLM needed), confidence scoring
 */
(() => {
    'use strict';

    const MODULE_NAME = 'consensus-engine';
    const CONSENSUS_KEY = 'consensus_history';

    const metadata = {
        name: MODULE_NAME, version: '2026.09.26.0',
        dependencies: ['hub-orchestrator', 'self-evolution-engine'],
        critical: false, category: '00-Core',
    };

    const state = { initialized: false, history: [] };

    const Roles = {
        Planner: {
            analyze: (task) => {
                const steps = [];
                if (task.includes('fix')) steps.push('Identify root cause', 'Implement fix', 'Verify resolution');
                if (task.includes('add')) steps.push('Define requirements', 'Implement feature', 'Test integration');
                if (task.includes('refactor')) steps.push('Analyze current code', 'Plan changes', 'Execute incrementally');
                if (steps.length === 0) steps.push('Analyze task', 'Break into steps', 'Execute', 'Verify');
                return { steps };
            }
        },
        Researcher: {
            analyze: (task, plan) => {
                const risks = [];
                const deps = [];
                if (task.includes('network')) risks.push('Network failures may recur');
                if (task.includes('auth')) risks.push('Token expiry possible');
                if (task.includes('deps')) deps.push('hub-orchestrator', 'self-evolution-engine');
                return { risks, deps, notes: [`Task type: ${task.split(' ')[0] || 'unknown'}`] };
            }
        },
        Critic: {
            analyze: (task, plan, research) => {
                const blockers = [];
                const warnings = [];
                if (research.risks.length > 2) warnings.push('High risk count - consider smaller steps');
                if (!plan.steps || plan.steps.length === 0) blockers.push('No plan steps defined');
                if (task.length > 500) warnings.push('Task may be over-scoped');
                return { blockers, warnings, approve: blockers.length === 0 };
            }
        },
        Forge: {
            analyze: (task, plan, research, critic) => {
                const actions = [];
                if (critic.approve && plan.steps) {
                    for (const step of plan.steps) {
                        actions.push({ type: 'action', summary: step, priority: 'normal' });
                    }
                }
                return { actions };
            }
        },
        Echo: {
            analyze: (task, plan, research, critic, forge) => {
                if (!critic.approve) return `BLOCKED: ${critic.blockers.join(', ')}`;
                if (!forge.actions || forge.actions.length === 0) return 'No actions generated';
                return `Plan: ${plan.steps ? plan.steps.length : 0} steps, ${forge.actions.length} actions. ${research.risks.length} risks noted.`;
            }
        },
    };

    function runConsensus(task) {
        const plannerResult = Roles.Planner.analyze(task);
        const researcherResult = Roles.Researcher.analyze(task, plannerResult);
        const criticResult = Roles.Critic.analyze(task, plannerResult, researcherResult);
        const forgeResult = Roles.Forge.analyze(task, plannerResult, researcherResult, criticResult);
        const echoResult = Roles.Echo.analyze(task, plannerResult, researcherResult, criticResult, forgeResult);

        const consensus = {
            task: task.slice(0, 200),
            timestamp: new Date().toISOString(),
            roles: {
                planner: plannerResult,
                researcher: researcherResult,
                critic: criticResult,
                forge: forgeResult,
                echo: echoResult,
            },
            approved: criticResult.approve,
            confidence: criticResult.approve ? (researcherResult.risks.length === 0 ? 'high' : 'medium') : 'blocked',
        };

        try {
            state.history = JSON.parse(GM_getValue(CONSENSUS_KEY, '[]'));
        } catch (e) { state.history = []; }
        state.history.push(consensus);
        state.history = state.history.slice(-50);
        GM_setValue(CONSENSUS_KEY, JSON.stringify(state.history));

        return consensus;
    }

    function init() {
        if (state.initialized) return;
        console.log(`[${MODULE_NAME}] Initializing...`);
        try { state.history = JSON.parse(GM_getValue(CONSENSUS_KEY, '[]')); } catch (e) { state.history = []; }
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ${state.history.length} past consensus records`);
    }
    function getHealth() {
        return { healthy: state.initialized, details: `${state.history.length} consensus records` };
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_CONSENSUS__ = { init, getHealth, runConsensus, Roles, metadata };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
