// ==UserScript==
// @name         docs-helper
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.1
// @description  Documentation helper: glossary, acronym expander, FAQ, troubleshooting (ROADMAP 230-240)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Docs Helper v1.0 — ROADMAP items 230-240
 */
(() => {
    'use strict';
    const MODULE_NAME = 'docs-helper';
    const DOCS_KEY = 'docs_helper_data';
    const metadata = { name: MODULE_NAME, version: '2026.09.26.1', dependencies: [], critical: false, category: '00-Core' };
    const state = { initialized: false, glossary: {}, acronyms: {}, faq: [], troubleshooting: [] };

    function load() {
        try { const raw = GM_getValue(DOCS_KEY, '{}'); const p = JSON.parse(raw); state.glossary = p.glossary || {}; state.acronyms = p.acronyms || {}; state.faq = p.faq || []; state.troubleshooting = p.troubleshooting || []; }
        catch (e) { state.glossary = {}; state.acronyms = {}; state.faq = []; state.troubleshooting = []; }
    }
    function save() { try { GM_setValue(DOCS_KEY, JSON.stringify({ glossary: state.glossary, acronyms: state.acronyms, faq: state.faq, troubleshooting: state.troubleshooting })); } catch (e) {} }

    // ─── Glossary (239) ────────────────────────────────────────────────────────
    function defineTerm(term, definition) {
        state.glossary[term.toLowerCase()] = { term, definition: String(definition).slice(0, 500), added_at: new Date().toISOString() };
        save();
        return state.glossary[term.toLowerCase()];
    }
    function getTerm(term) { return state.glossary[term.toLowerCase()] || null; }
    function searchTerms(query) {
        const q = query.toLowerCase();
        return Object.values(state.glossary).filter(e => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q));
    }
    function listGlossary() { return { ...state.glossary }; }

    // ─── Acronym Expander (240) ────────────────────────────────────────────────
    function defineAcronym(acronym, expansion) {
        state.acronyms[acronym.toUpperCase()] = { acronym: acronym.toUpperCase(), expansion, added_at: new Date().toISOString() };
        save();
        return state.acronyms[acronym.toUpperCase()];
    }
    function expandAcronym(acronym) { return state.acronyms[acronym.toUpperCase()] || null; }
    function findAcronymsInText(text) {
        const results = [];
        for (const [ac, info] of Object.entries(state.acronyms)) {
            if (text.toUpperCase().includes(ac)) results.push(info);
        }
        return results;
    }
    function listAcronyms() { return { ...state.acronyms }; }

    // ─── FAQ Automation (231) ──────────────────────────────────────────────────
    function addFAQ(question, answer) {
        const entry = { question: String(question).slice(0, 300), answer: String(answer).slice(0, 1000), added_at: new Date().toISOString() };
        state.faq.push(entry);
        save();
        return entry;
    }
    function searchFAQ(query) {
        const q = query.toLowerCase();
        return state.faq.filter(e => e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q));
    }
    function listFAQ() { return [...state.faq]; }

    // ─── Troubleshooting Guides (230) ──────────────────────────────────────────
    function addTroubleshooting(issue, symptoms, solution) {
        const entry = { issue: String(issue).slice(0, 200), symptoms: String(symptoms).slice(0, 500), solution: String(solution).slice(0, 1000), added_at: new Date().toISOString() };
        state.troubleshooting.push(entry);
        save();
        return entry;
    }
    function searchTroubleshooting(query) {
        const q = query.toLowerCase();
        return state.troubleshooting.filter(e => e.issue.toLowerCase().includes(q) || e.symptoms.toLowerCase().includes(q) || e.solution.toLowerCase().includes(q));
    }
    function listTroubleshooting() { return [...state.troubleshooting]; }

    // ─── Search Optimization (232) ─────────────────────────────────────────────
    function searchAll(query) {
        return {
            glossary: searchTerms(query),
            faq: searchFAQ(query),
            troubleshooting: searchTroubleshooting(query),
        };
    }

    function init() {
        if (state.initialized) return;
        load();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ${Object.keys(state.glossary).length} terms, ${Object.keys(state.acronyms).length} acronyms, ${state.faq.length} FAQs`);
    }

    function getHealth() {
        return { healthy: state.initialized, details: `${Object.keys(state.glossary).length} terms, ${Object.keys(state.acronyms).length} acronyms, ${state.faq.length} FAQs, ${state.troubleshooting.length} guides` };
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_DOCS__ = { init, getHealth, metadata, defineTerm, getTerm, searchTerms, listGlossary, defineAcronym, expandAcronym, findAcronymsInText, listAcronyms, addFAQ, searchFAQ, listFAQ, addTroubleshooting, searchTroubleshooting, listTroubleshooting, searchAll };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
