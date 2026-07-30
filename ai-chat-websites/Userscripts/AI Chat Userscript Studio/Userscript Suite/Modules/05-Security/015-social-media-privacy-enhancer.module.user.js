// ==UserScript==
// @name         Social Media Privacy Enhancer
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Social media privacy enhancer with tracking cleanup, ad filtering, and control panel
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @match        https://facebook.com/*
// @match        https://*.facebook.com/*
// @match        https://instagram.com/*
// @match        https://*.instagram.com/*
// @match        https://threads.net/*
// @match        https://*.threads.net/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const HOST = window.location.hostname;
    const SITE = {
        facebook: HOST.includes('facebook.com'),
        instagram: HOST.includes('instagram.com'),
        threads: HOST.includes('threads.net')
    };
    const SITE_ID = SITE.facebook ? 'facebook' : SITE.instagram ? 'instagram' : SITE.threads ? 'threads' : 'social';
    const SITE_LABEL = SITE.facebook ? 'Facebook' : SITE.instagram ? 'Instagram' : SITE.threads ? 'Threads' : 'Social';
    const IS_FACEBOOK = SITE.facebook;
    const IS_META = SITE.facebook || SITE.instagram || SITE.threads;

    const DEFAULT_CFG = {
        enabled: true,
        keyboardShortcuts: true,
        removeTrackingParams: true,
        hideTrackingElements: true,
        visualizeExternalLinks: true,
        highlightPrivacyElements: true,
        privacyIndicator: true,
        autoExpandHiddenContent: true,
        removeSponsoredPosts: true,
        dynamicTitleUpdate: true,
        enhancedLinkProtection: true,
        removeSuggestedPosts: true,
        disableAutoplay: true,
        removeMarketplaceSuggestions: true,
        removePeopleYouMayKnow: true,
        disableDataCollection: true,
        removeStories: true,
        removeReels: true,
        removeRightSidebar: true,
        blockThirdPartyTrackers: true,
        removeMetaTags: true,
        anonymizeInteractions: true,
        blurThumbnails: true,
        removeGroupSuggestions: true,
        removeEventSuggestions: true,
        blockPixelTracking: true,
        removeGameRequests: true,
        removeAds: true,
        removeDataCollection: true,
        blockTrackers: true
    };

    const cfg = { ...DEFAULT_CFG };

    const STORE_KEY = `social-privacy-enhancer:cfg:${SITE_ID}`;
    const LEGACY_STORE_KEY = 'fb-privacy-enhancer:cfg';
    const CFG_KEYS = Object.keys(DEFAULT_CFG);

    const TRACKING_PARAMS = [
        'ref', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'tracking', 'ref_type', 'entry_point', 'referrer', 'source_id', 'source_type',
        'suggestion_token', 'tracking_id', '__tn__', 'eid', 'fref', 'hc_ref', 'hc_location',
        'fb_dtsg', 'paipv', 'eav', 'av', 'gfid', '__xts__', '__cft__', 'comment_tracking',
        'tracking_source', 'click_source', 'surface', 'story_location', 'entry', 'fb_source',
        'ref_dashboard_filter', 'ref_page_id', 'source_feed_story_type', 'notif_id', 'notif_t',
        'ref_notif_type', 'trigger', 'ref_timeline_story_type', 'acontext', 'action_history',
        'action_source', 'igshid', 'igsh', 'ig_rid', 'ig_mid', 'mibextid'
    ];

    const TRACKERS = {
        general: ['connect.facebook.net', 'facebook.com/plugins/', 'doubleclick.net', 'google-analytics.com'],
        img: ['facebook.com/tr/', 'pixel.gif', 'tracking.gif', 'beacon', 'impression', 'collect']
    };

    const CSS_RULES = [
        {
            when: () => IS_FACEBOOK && cfg.blurThumbnails,
            css: `
                .uiScaledImageContainer img:not(:hover),
                ._2k5d img:not(:hover),
                [data-visualcompletion="media-vc-image"]:not(:hover),
                [role="img"]:not(:hover),
                .x1lliihq:not(:hover),
                .x1qjc9v5 img:not(:hover),
                .xzg4506 img:not(:hover),
                [data-pagelet="ProfileTimeline"] img:not(:hover),
                [data-pagelet="ProfileCometTabs"] img:not(:hover),
                [data-pagelet="MediaViewerPhoto"] img:not(:hover),
                [data-pagelet*="Feed"] img:not(:hover),
                [data-pagelet*="Story"] img:not(:hover) { filter: blur(5px); transition: filter 0.3s; }
            `
        },
        {
            when: () => IS_FACEBOOK && cfg.removeRightSidebar,
            css: `[data-pagelet*="RightRail"], [role="complementary"] { display: none !important; }`
        },
        {
            when: () => IS_FACEBOOK && cfg.removeStories,
            css: `[data-pagelet*="Stories"], [aria-label*="Stories"] { display: none !important; }`
        },
        {
            when: () => IS_FACEBOOK && cfg.removeReels,
            css: `[data-pagelet*="Reels"], [aria-label*="Reels"], a[href*="/reel/"] { display: none !important; }`
        },
        {
            when: () => IS_META && (cfg.hideTrackingElements || cfg.blockTrackers || cfg.blockThirdPartyTrackers),
            css: `iframe[src*="facebook.com/tr/"], img[src*="facebook.com/tr/"] { display: none !important; }`
        },
        {
            when: () => cfg.visualizeExternalLinks,
            css: `
                a[data-sm-privacy-external="true"] { text-decoration: underline dotted; }
                a[data-sm-privacy-external="true"]::after { content: " (ext)"; font-size: 0.8em; }
            `
        },
        {
            when: () => cfg.highlightPrivacyElements,
            css: `
                a[href*="/settings"], a[href*="/privacy/"], [aria-label*="Privacy"] {
                    outline: 2px dashed #1b7a5b; outline-offset: 2px;
                }
            `
        },
        {
            when: () => cfg.privacyIndicator,
            always: true,
            css: `
                #sm-privacy-indicator {
                    position: fixed; top: 10px; right: 10px; z-index: 999999;
                    background: #1b7a5b; color: #fff; padding: 6px 10px;
                    border-radius: 6px; font: 12px/1.2 Arial, sans-serif;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2); cursor: pointer;
                }
            `
        },
        {
            when: () => true,
            always: true,
            css: `
                #sm-privacy-panel {
                    display: none;
                    position: fixed;
                    top: 48px;
                    right: 10px;
                    width: 300px;
                    max-height: 75vh;
                    overflow: hidden;
                    background: #fef7e7;
                    color: #2b1f15;
                    border: 1px solid #c8b59c;
                    border-radius: 10px;
                    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
                    font: 12px/1.4 "Trebuchet MS", "Segoe UI", sans-serif;
                    z-index: 999999;
                }
                #sm-privacy-panel .fbp-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 10px;
                    background: linear-gradient(135deg, #f5e3c6, #fdf2df);
                    border-bottom: 1px solid #d8c2a8;
                    font-weight: 700;
                }
                #sm-privacy-panel .fbp-title { font-size: 13px; }
                #sm-privacy-panel .fbp-stats {
                    padding: 6px 10px;
                    background: #f4e8d4;
                    border-bottom: 1px solid #d8c2a8;
                    font-size: 11px;
                }
                #sm-privacy-panel .fbp-body {
                    padding: 8px 10px;
                    overflow: auto;
                    max-height: 45vh;
                }
                #sm-privacy-panel .fbp-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 0;
                    cursor: pointer;
                }
                #sm-privacy-panel .fbp-row input { accent-color: #1b7a5b; }
                #sm-privacy-panel .fbp-footer {
                    display: flex;
                    gap: 6px;
                    padding: 8px 10px;
                    border-top: 1px solid #d8c2a8;
                    background: #fdf2df;
                }
                #sm-privacy-panel .fbp-footer button,
                #sm-privacy-panel .fbp-header button {
                    background: #2b6b54;
                    color: #fff;
                    border: 0;
                    padding: 5px 8px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                }
                #sm-privacy-panel .fbp-footer button.secondary {
                    background: #7a5a3a;
                }
                #sm-privacy-panel .fbp-footer button.ghost,
                #sm-privacy-panel .fbp-header button.ghost {
                    background: transparent;
                    color: #2b1f15;
                    border: 1px solid #c8b59c;
                }
                #sm-privacy-panel .fbp-hint {
                    padding: 6px 10px 10px;
                    font-size: 10px;
                    color: #6b5c4a;
                }
            `
        }
    ];

    const TEXT_RULES = [
        { key: 'removeSuggestedPosts', texts: ['suggested for you', 'suggested post'] },
        { key: 'removePeopleYouMayKnow', texts: ['people you may know'] },
        { key: 'removeGroupSuggestions', texts: ['suggested groups', 'group suggestions'] },
        { key: 'removeEventSuggestions', texts: ['suggested events', 'events you may like'] },
        { key: 'removeGameRequests', texts: ['game requests', 'games you may like'] },
        { key: 'removeMarketplaceSuggestions', texts: ['marketplace', 'today\'s picks', 'picks for you'] }
    ];

    const PANEL_FIELDS = [
        { key: 'enabled', label: 'Enable privacy filters' },
        { key: 'removeSponsoredPosts', label: 'Remove sponsored posts' },
        { key: 'removeAds', label: 'Remove ad containers' },
        { key: 'removeSuggestedPosts', label: 'Remove suggested posts' },
        { key: 'removePeopleYouMayKnow', label: 'Remove people you may know' },
        { key: 'removeGroupSuggestions', label: 'Remove group suggestions' },
        { key: 'removeEventSuggestions', label: 'Remove event suggestions' },
        { key: 'removeGameRequests', label: 'Remove game suggestions' },
        { key: 'removeMarketplaceSuggestions', label: 'Remove marketplace suggestions' },
        { key: 'removeStories', label: 'Remove stories' },
        { key: 'removeReels', label: 'Remove reels' },
        { key: 'removeRightSidebar', label: 'Remove right sidebar' },
        { key: 'disableAutoplay', label: 'Disable autoplay' },
        { key: 'removeTrackingParams', label: 'Strip tracking params' },
        { key: 'enhancedLinkProtection', label: 'Strengthen external links' },
        { key: 'visualizeExternalLinks', label: 'Mark external links' },
        { key: 'blurThumbnails', label: 'Blur thumbnails' },
        { key: 'anonymizeInteractions', label: 'Hide reaction controls' },
        { key: 'autoExpandHiddenContent', label: 'Auto expand content' },
        { key: 'blockThirdPartyTrackers', label: 'Block third-party trackers' },
        { key: 'blockPixelTracking', label: 'Block tracking pixels' },
        { key: 'disableDataCollection', label: 'Block sendBeacon' },
        { key: 'keyboardShortcuts', label: 'Enable keyboard shortcuts' },
        { key: 'privacyIndicator', label: 'Show privacy badge' }
    ];

    const ANON_SELECTORS = [
        '[data-testid="UFI2CommentActionLinks/reply"]',
        '[data-testid="UFI2ReactionLink"]',
        '[data-testid="share-button"]',
        '[aria-label*="reaction"]',
        '[aria-label*="React"]',
        '[aria-label*="Share"]',
        '[data-testid="story-subtitle"]',
        '[data-testid="post-comment"]',
        '[data-testid="fbfeed_story"]',
        '[data-testid*="reaction"]',
        '[data-testid*="share"]',
        '[data-testid*="comment"]',
        '[data-testid*="like"]',
        '[data-testid*="feedback"]',
        '[data-testid*="social"]',
        '[data-testid*="interaction"]'
    ];

    const AUTO_EXPAND_TEXT = [
        'see more', 'see translation', 'see original', 'see more comments',
        'view more comments', 'view more replies', 'see more replies', 'see full story'
    ];

    const state = {
        style: null,
        observer: null,
        scheduled: false,
        historyPatched: false,
        pixelPatched: false,
        beaconPatched: false,
        badge: null,
        titleObserver: null,
        metaCleared: false,
        panel: null,
        panelVisible: false,
        stats: {
            removed: 0,
            sponsored: 0,
            suggestions: 0,
            trackers: 0,
            autoplay: 0,
            links: 0,
            expanded: 0
        }
    };
    let initialized = false;

    const q = (sel, root = document) => {
        try {
            const base = root && root.querySelectorAll ? root : document;
            return Array.from(base.querySelectorAll(sel));
        } catch (error) {
            return [];
        }
    };

    const norm = value => String(value || '').toLowerCase();
    const hasAnyText = (node, texts) => texts.some(t => norm(node.textContent).includes(t));
    const isEnabled = () => cfg.enabled !== false;

    const loadCfg = () => {
        try {
            let raw = localStorage.getItem(STORE_KEY);
            if (!raw && IS_FACEBOOK) {
                raw = localStorage.getItem(LEGACY_STORE_KEY);
                if (raw) localStorage.setItem(STORE_KEY, raw);
            }
            if (!raw) return;
            const data = JSON.parse(raw);
            CFG_KEYS.forEach(key => {
                if (typeof data[key] === 'boolean') cfg[key] = data[key];
            });
        } catch (error) {}
    };

    const saveCfg = () => {
        try {
            const data = {};
            CFG_KEYS.forEach(key => { data[key] = !!cfg[key]; });
            localStorage.setItem(STORE_KEY, JSON.stringify(data));
        } catch (error) {}
    };

    const bump = (key, amount = 1) => {
        state.stats[key] = (state.stats[key] || 0) + amount;
    };

    const bumpRemoved = (key, amount = 1) => {
        bump('removed', amount);
        bump(key, amount);
    };

    const resetStats = () => {
        state.stats.removed = 0;
        state.stats.sponsored = 0;
        state.stats.suggestions = 0;
        state.stats.trackers = 0;
        state.stats.autoplay = 0;
        state.stats.links = 0;
        state.stats.expanded = 0;
    };

    const isTypingTarget = target => {
        if (!target) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const toggleEnabled = () => {
        cfg.enabled = !cfg.enabled;
        saveCfg();
        if (isEnabled()) applyHooks();
        applyFilters(document);
        updatePanel();
    };

    const restoreDefaults = () => {
        CFG_KEYS.forEach(key => { cfg[key] = DEFAULT_CFG[key]; });
        saveCfg();
        resetStats();
        if (isEnabled()) applyHooks();
        applyFilters(document);
        updatePanel();
    };

    const createPanelButton = (text, action, className = '') => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.textContent = text;
        if (className) {
            button.className = className;
        }
        return button;
    };

    const createPanelFieldRow = (field) => {
        const row = document.createElement('label');
        row.className = 'fbp-row';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.key = field.key;
        const label = document.createElement('span');
        label.textContent = field.label;
        row.appendChild(input);
        row.appendChild(label);
        return row;
    };

    const ensurePanel = () => {
        if (state.panel) return state.panel;
        const panel = document.createElement('div');
        panel.id = 'sm-privacy-panel';
        const header = document.createElement('div');
        header.className = 'fbp-header';
        const title = document.createElement('div');
        title.className = 'fbp-title';
        title.textContent = `${SITE_LABEL} Privacy Enhancer`;
        header.appendChild(title);
        header.appendChild(createPanelButton('Close', 'close', 'ghost'));

        const stats = document.createElement('div');
        stats.className = 'fbp-stats';
        stats.dataset.role = 'stats';

        const body = document.createElement('div');
        body.className = 'fbp-body';

        const footer = document.createElement('div');
        footer.className = 'fbp-footer';
        footer.appendChild(createPanelButton('Toggle', 'toggle'));
        footer.appendChild(createPanelButton('Reset Counters', 'reset', 'secondary'));
        footer.appendChild(createPanelButton('Defaults', 'defaults', 'ghost'));

        const hint = document.createElement('div');
        hint.className = 'fbp-hint';
        hint.textContent = 'Alt+P toggle, Alt+Shift+P panel, Esc close, Shift+Click badge for settings.';

        PANEL_FIELDS.forEach(field => {
            body.appendChild(createPanelFieldRow(field));
        });

        panel.appendChild(header);
        panel.appendChild(stats);
        panel.appendChild(body);
        panel.appendChild(footer);
        panel.appendChild(hint);

        panel.addEventListener('change', e => {
            const input = e.target;
            if (!input || !input.dataset || !input.dataset.key) return;
            cfg[input.dataset.key] = input.checked;
            saveCfg();
            if (isEnabled()) applyHooks();
            applyFilters(document);
            updatePanel();
        });
        panel.addEventListener('click', e => {
            const button = e.target.closest('[data-action]');
            if (!button) return;
            const action = button.dataset.action;
            if (action === 'close') togglePanel(false);
            if (action === 'toggle') toggleEnabled();
            if (action === 'reset') { resetStats(); updateBadge(); updatePanel(); }
            if (action === 'defaults') restoreDefaults();
        });
        document.documentElement.appendChild(panel);
        state.panel = panel;
        return panel;
    };

    const updatePanel = () => {
        if (!state.panel) return;
        PANEL_FIELDS.forEach(field => {
            const input = state.panel.querySelector(`input[data-key="${field.key}"]`);
            if (input) input.checked = !!cfg[field.key];
        });
        const stats = state.panel.querySelector('[data-role="stats"]');
        if (stats) {
            stats.textContent = `Removed ${state.stats.removed} | Sponsored ${state.stats.sponsored} | Suggestions ${state.stats.suggestions} | Trackers ${state.stats.trackers} | Autoplay ${state.stats.autoplay} | Links ${state.stats.links} | Expanded ${state.stats.expanded}`;
        }
        const toggleBtn = state.panel.querySelector('[data-action="toggle"]');
        if (toggleBtn) toggleBtn.textContent = isEnabled() ? 'Disable' : 'Enable';
    };

    const togglePanel = force => {
        ensurePanel();
        const show = typeof force === 'boolean' ? force : !state.panelVisible;
        state.panelVisible = show;
        state.panel.style.display = show ? 'block' : 'none';
        state.panel.setAttribute('aria-hidden', show ? 'false' : 'true');
        if (show) updatePanel();
    };

    const handleShortcuts = e => {
        if (!cfg.keyboardShortcuts) return;
        if (isTypingTarget(e.target)) return;
        const key = (e.key || '').toLowerCase();
        if (key === 'escape' && state.panelVisible) {
            togglePanel(false);
            e.preventDefault();
            return;
        }
        if (e.altKey && e.shiftKey && key === 'p') {
            togglePanel();
            e.preventDefault();
            return;
        }
        if (e.altKey && !e.shiftKey && key === 'p') {
            toggleEnabled();
            e.preventDefault();
        }
    };

    const ensureStyle = () => {
        if (state.style) return state.style;
        const style = document.createElement('style');
        style.id = 'sm-privacy-enhancer-style';
        (document.head || document.documentElement).appendChild(style);
        state.style = style;
        return style;
    };

    const applyCss = () => {
        const css = CSS_RULES.filter(r => (isEnabled() ? r.when() : r.always && r.when()))
            .map(r => r.css)
            .join('\n')
            .trim();
        if (!css) {
            if (state.style) state.style.textContent = '';
            return;
        }
        const style = ensureStyle();
        if (style.textContent !== css) style.textContent = css;
    };

    const stripParams = url => {
        let modified = false;
        TRACKING_PARAMS.forEach(p => {
            if (url.searchParams.has(p)) {
                url.searchParams.delete(p);
                modified = true;
            }
        });
        return modified;
    };

    const cleanCurrentUrl = () => {
        try {
            const url = new URL(window.location.href);
            if (stripParams(url)) window.history.replaceState({}, '', url.toString());
        } catch (error) {}
    };

    const patchHistory = () => {
        if (state.historyPatched) return;
        state.historyPatched = true;
        const push = history.pushState;
        const replace = history.replaceState;
        history.pushState = function() { push.apply(this, arguments); cleanCurrentUrl(); };
        history.replaceState = function() { replace.apply(this, arguments); cleanCurrentUrl(); };
        window.addEventListener('popstate', cleanCurrentUrl);
        window.addEventListener('hashchange', cleanCurrentUrl);
    };

    const addRel = (rel, tokens) => {
        const current = norm(rel).split(/\s+/).filter(Boolean);
        tokens.forEach(t => { if (!current.includes(t)) current.push(t); });
        return current.join(' ');
    };

    const sanitizeLinks = root => {
        if (!cfg.enhancedLinkProtection && !cfg.removeTrackingParams && !cfg.visualizeExternalLinks) return;
        const anchors = [];
        if (root && root.nodeType === 1 && root.tagName === 'A' && root.getAttribute('href')) anchors.push(root);
        anchors.push(...q('a[href]', root));
        anchors.forEach(a => {
            const raw = a.getAttribute('href');
            if (!raw || raw.startsWith('#')) return;
            const alreadyMarked = a.dataset.smPrivacySanitized === '1';
            let touched = false;
            let url;
            try { url = new URL(raw, window.location.href); } catch (error) { return; }
            const isMetaRedirect = url.hostname === 'l.facebook.com'
                || url.hostname === 'l.instagram.com'
                || (url.hostname.endsWith('facebook.com') && url.pathname === '/l.php');
            if (isMetaRedirect) {
                const target = url.searchParams.get('u');
                if (target) {
                    try { url = new URL(decodeURIComponent(target)); } catch (error) { return; }
                    touched = true;
                }
            }
            if (cfg.removeTrackingParams && stripParams(url)) touched = true;
            const external = url.hostname && url.hostname !== window.location.hostname;
            if (cfg.enhancedLinkProtection && external) {
                a.rel = addRel(a.rel, ['noreferrer', 'noopener']);
                a.referrerPolicy = 'no-referrer';
                touched = true;
            }
            if (cfg.visualizeExternalLinks && external) {
                if (!a.hasAttribute('data-sm-privacy-external')) touched = true;
                a.setAttribute('data-sm-privacy-external', 'true');
            }
            const finalHref = url.toString();
            if (a.getAttribute('href') !== finalHref) touched = true;
            a.setAttribute('href', finalHref);
            if (touched && !alreadyMarked) {
                a.dataset.smPrivacySanitized = '1';
                bump('links');
            }
        });
    };

    const disableAutoplay = root => {
        if (!cfg.disableAutoplay) return;
        const videos = [];
        if (root && root.nodeType === 1 && root.tagName === 'VIDEO') videos.push(root);
        videos.push(...q('video', root));
        videos.forEach(v => {
            try {
                let changed = false;
                if (v.autoplay || v.hasAttribute('autoplay')) {
                    v.autoplay = false;
                    v.removeAttribute('autoplay');
                    changed = true;
                }
                if (!v.paused) {
                    v.pause();
                    changed = true;
                }
                if (changed && v.dataset.smPrivacyAutoplayOff !== '1') {
                    v.dataset.smPrivacyAutoplayOff = '1';
                    bump('autoplay');
                }
            } catch (error) {}
        });
    };

    const removeSponsored = root => {
        if (!IS_FACEBOOK || (!cfg.removeSponsoredPosts && !cfg.removeAds)) return;
        q('div[role="article"], div[data-pagelet*="FeedUnit"], div[data-pagelet*="Feed"]', root).forEach(node => {
            if (node.querySelector('[aria-label*="Sponsored"]')) {
                node.remove();
                bumpRemoved('sponsored');
                return;
            }
            if (node.querySelector('a[href*="/ads/"], a[href*="/business/"]')) {
                node.remove();
                bumpRemoved('sponsored');
                return;
            }
            if (hasAnyText(node, ['sponsored'])) {
                node.remove();
                bumpRemoved('sponsored');
            }
        });
        q('[data-pagelet*="Sponsored"], [data-pagelet*="AdUnit"], [data-pagelet*="FeedAdsUnit"]', root).forEach(n => {
            n.remove();
            bumpRemoved('sponsored');
        });
    };

    const removeByTextRules = root => {
        if (!IS_FACEBOOK) return;
        const containerSel = 'div[role="article"], div[role="region"], div[data-pagelet], section[aria-label]';
        TEXT_RULES.forEach(rule => {
            if (!cfg[rule.key]) return;
            q(containerSel, root).forEach(node => {
                if (hasAnyText(node, rule.texts)) {
                    node.remove();
                    bumpRemoved('suggestions');
                }
            });
        });
    };

    const anonymize = root => {
        if (!IS_FACEBOOK || !cfg.anonymizeInteractions) return;
        q(ANON_SELECTORS.join(', '), root).forEach(el => { el.style.visibility = 'hidden'; });
    };

    const removeMetaTags = () => {
        if (!cfg.removeMetaTags || state.metaCleared) return;
        q('meta[property^="og:"], meta[name^="fb:"], meta[name^="twitter:"], meta[property^="article:"], meta[property^="al:"]').forEach(m => m.remove());
        state.metaCleared = true;
    };

    const shouldBlockUrl = (url, tag) => {
        const value = norm(url);
        if (!value) return false;
        const list = tag === 'IMG' ? TRACKERS.img : TRACKERS.general;
        return list.some(p => value.includes(p));
    };

    const removeTrackerNodes = root => {
        if (!root || root.nodeType !== 1) return;
        const nodes = [];
        if (['SCRIPT', 'IMG', 'IFRAME'].includes(root.tagName)) nodes.push(root);
        nodes.push(...q('script[src], img[src], iframe[src]', root));
        nodes.forEach(node => {
            const src = node.getAttribute('src') || node.src || '';
            if (src && shouldBlockUrl(src, node.tagName)) {
                node.remove();
                bumpRemoved('trackers');
            }
        });
    };

    const blockPixelTracking = () => {
        if (!cfg.blockPixelTracking && !cfg.blockTrackers) return;
        if (state.pixelPatched) return;
        const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        if (!desc || !desc.set) return;
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            get: desc.get,
            set: function(value) { if (!shouldBlockUrl(value, 'IMG')) return desc.set.call(this, value); },
            configurable: desc.configurable,
            enumerable: desc.enumerable
        });
        state.pixelPatched = true;
    };

    const blockSendBeacon = () => {
        if (!cfg.disableDataCollection && !cfg.removeDataCollection) return;
        if (!navigator.sendBeacon) return;
        if (state.beaconPatched) return;
        const orig = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function(url, data) {
            try { if (shouldBlockUrl(url, 'IMG')) return false; } catch (error) {}
            return orig(url, data);
        };
        state.beaconPatched = true;
    };

    const autoExpand = root => {
        if (!IS_FACEBOOK || !cfg.autoExpandHiddenContent) return;
        q('div[role="button"], span[role="button"], a[role="button"], button', root).forEach(btn => {
            const label = norm(btn.getAttribute('aria-label') || btn.textContent);
            if (!label || !AUTO_EXPAND_TEXT.some(t => label.includes(t))) return;
            if (btn.dataset.smPrivacyExpanded === '1') return;
            btn.dataset.smPrivacyExpanded = '1';
            btn.click();
            bump('expanded');
        });
    };

    const ensureBadge = () => {
        if (!cfg.privacyIndicator || state.badge) return;
        const badge = document.createElement('div');
        badge.id = 'sm-privacy-indicator';
        badge.textContent = `${SITE_LABEL} Privacy On`;
        badge.title = 'Click to toggle, Shift+Click for settings, right-click to reset counters.';
        badge.addEventListener('click', e => {
            if (e.shiftKey) {
                togglePanel();
                return;
            }
            toggleEnabled();
        });
        badge.addEventListener('contextmenu', e => {
            e.preventDefault();
            resetStats();
            updateBadge();
            updatePanel();
        });
        document.documentElement.appendChild(badge);
        state.badge = badge;
    };

    const updateBadge = () => {
        if (!state.badge) return;
        if (!cfg.privacyIndicator) {
            state.badge.style.display = 'none';
            return;
        }
        state.badge.style.display = 'block';
        const total = state.stats.removed || 0;
        const label = `${SITE_LABEL} Privacy`;
        state.badge.textContent = isEnabled()
            ? (total ? `${label} On - ${total}` : `${label} On`)
            : `${label} Off`;
        state.badge.style.background = isEnabled() ? '#1b7a5b' : '#666';
        state.badge.title = `Removed: ${state.stats.removed} | Sponsored: ${state.stats.sponsored} | Suggestions: ${state.stats.suggestions} | Trackers: ${state.stats.trackers} | Autoplay: ${state.stats.autoplay} | Links: ${state.stats.links} | Expanded: ${state.stats.expanded}`;
    };

    const cleanTitle = title => title.replace(/^(\(\d+\)\s*)+/, '').replace(/\s+\(\d+\)$/, '').trim();

    const watchTitle = () => {
        if (!cfg.dynamicTitleUpdate || state.titleObserver) return;
        const titleEl = document.querySelector('title');
        if (!titleEl) return;
        const apply = () => {
            const cleaned = cleanTitle(document.title);
            if (cleaned && cleaned !== document.title) document.title = cleaned;
        };
        apply();
        state.titleObserver = new MutationObserver(apply);
        state.titleObserver.observe(titleEl, { childList: true });
    };

    const applyHooks = () => {
        if (!isEnabled()) return;
        if (cfg.removeTrackingParams) { cleanCurrentUrl(); patchHistory(); }
        if (cfg.blockPixelTracking || cfg.blockTrackers) blockPixelTracking();
        if (cfg.blockThirdPartyTrackers || cfg.blockTrackers || cfg.hideTrackingElements) removeTrackerNodes(document.documentElement);
        if (cfg.disableDataCollection || cfg.removeDataCollection) blockSendBeacon();
    };

    const applyFilters = root => {
        applyCss();
        ensureBadge();
        if (!isEnabled()) {
            updateBadge();
            updatePanel();
            return;
        }
        removeMetaTags();
        watchTitle();
        removeSponsored(root);
        removeByTextRules(root);
        anonymize(root);
        disableAutoplay(root);
        sanitizeLinks(root);
        autoExpand(root);
        updateBadge();
        updatePanel();
    };

    const scheduleApply = () => {
        if (state.scheduled) return;
        state.scheduled = true;
        window.setTimeout(() => {
            state.scheduled = false;
            applyFilters(document);
        }, 250);
    };

    const observe = () => {
        if (state.observer) return;
        state.observer = new MutationObserver(mutations => {
            if (!isEnabled()) {
                updateBadge();
                updatePanel();
                return;
            }
            let shouldSchedule = false;
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (cfg.blockThirdPartyTrackers || cfg.blockTrackers || cfg.hideTrackingElements) removeTrackerNodes(node);
                    if (cfg.disableAutoplay) disableAutoplay(node);
                    if (cfg.enhancedLinkProtection || cfg.removeTrackingParams || cfg.visualizeExternalLinks) sanitizeLinks(node);
                    if (cfg.autoExpandHiddenContent) autoExpand(node);
                });
                shouldSchedule = true;
            });
            if (shouldSchedule) scheduleApply();
        });
        state.observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    const onReady = fn => {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    };

    const init = () => {
        if (initialized) return;
        initialized = true;
        loadCfg();
        applyCss();
        applyHooks();
        observe();
        window.addEventListener('keydown', handleShortcuts, true);
        onReady(() => {
            applyFilters(document);
        });
    };

    const socialMediaPrivacyModule = {
        name: 'SocialMediaPrivacyEnhancer',
        version: '2026.04.05.1',
        dependencies: [],
        critical: false,
        init() {
            init();
        }
    };

    const attemptRegistration = () => {
        if (!window.ChatGPTModules) {
            return false;
        }

        window.ChatGPTModules.register(socialMediaPrivacyModule);
        return true;
    };

    if (!attemptRegistration()) {
        const checkInterval = setInterval(() => {
            if (attemptRegistration()) {
                clearInterval(checkInterval);
            }
        }, 100);
    }

    init();
})();
