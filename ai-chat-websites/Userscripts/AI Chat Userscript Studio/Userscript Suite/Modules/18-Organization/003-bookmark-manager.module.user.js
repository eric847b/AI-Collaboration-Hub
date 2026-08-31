// ==UserScript==
// @name         Bookmark Manager
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.08.27.1
// @description Smart bookmarking with categories, tags, search, and floating panel UI
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==


/* UniversalSite runtime guard (injected by universalize-modules.cjs) */
(function(){
  if (!window.UniversalSite) {
    // Adapter not loaded on this page - nothing safe to do; bail out quietly.
    return;
  }
  try {
    if (!window.__UNIVERSALIZE_GUARDS) window.__UNIVERSALIZE_GUARDS = [];
    window.__UNIVERSALIZE_GUARDS.push(function(){
      const kind = window.UniversalSite.kind;
      const ok = kind === "chat" || kind === "chat-like" || kind === "chat-domain";
      return { run: ok, kind: kind, genericSafe: true };
    });
  } catch (e) { /* never break the page */ }
})();

/**
 * Bookmark Manager Module
 * @module 003-bookmark-manager
 * @version 1.1.0
 * @author AI RMD
 * @license MIT
 */

(function() {
    'use strict';

    const MODULE_ID = '003-bookmark-manager';
    const MODULE_NAME = 'Bookmark Manager';
    const MODULE_VERSION = '1.1.0';

    class BookmarkManager {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.config = {
                enabled: true, autoSave: true, maxBookmarks: 10000, syncEnabled: false,
                categories: ['Important', 'Reference', 'Templates', 'Archived', 'Research', 'Ideas', 'To-Read', 'Work'],
                defaultCategory: 'Reference', enableNotifications: true, enableStats: true,
                enableConfirmations: true, dateFormat: 'en-US', backupOnExport: true,
                enableAI: true, enableBatchOps: true, enableThemes: true, theme: 'auto',
                enableAccessibility: true, enableSmartSuggestions: true, enableAutoTag: true,
                enableDuplicateWarnings: true, enableInlineEdit: true, enableBulkSelect: true,
                enableFilterPresets: true, enableImportBrowser: true, enableAnimations: true,
                enableSoundEffects: false, enableActivityHeatmap: true, enableTimelineView: false,
                enablePinboard: false, enablePreviewPane: true
            };
            this.state = {
                initialized: false, instances: 0, bookmarks: [], activeCategory: null,
                currentQuery: '', currentFilters: {}, showFavoritesOnly: false,
                selectedBookmarks: new Set(), listeners: new Map()
            };
            this.ui = { fab: null, panel: null, categorySelect: null, searchInput: null,
                sortSelect: null, favFilterBtn: null, statsEl: null, listEl: null, categoriesEl: null };
        }

        async init() {
            try {
                console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);
                this.loadConfig();
                if (!this.checkDependencies()) {
                    console.warn(`[${MODULE_ID}] Dependencies not satisfied`);
                    return false;
                }
                this.setup();
                this.exposeAPI();
                this.state.initialized = true;
                console.log(`[${MODULE_ID}] Initialization complete`);
                return true;
            } catch (error) {
                console.error(`[${MODULE_ID}] Initialization failed:`, error);
                return false;
            }
        }

        checkDependencies() { return true; }

        setup() {
            this.detectEnvironment();
            this.loadBookmarks();
            this.loadFilterPresets();
            this.injectStyles();
            this.createUI();
            this.attachListeners();
            this.restoreState();
            this.registerMenuCommands();
            this.showWelcome();
            this.runFirstTimeSetup();
            this.createInstallationShortcuts();
            this.offerBrowserImport();
        }

        loadFilterPresets() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-filterPresets`);
                this.filterPresets = stored ? JSON.parse(stored) : [];
            } catch { this.filterPresets = []; }
        }

        saveFilterPresets() {
            localStorage.setItem(`${MODULE_ID}-filterPresets`, JSON.stringify(this.filterPresets));
        }

        createFilterPreset(name, filters) {
            if (!name || !filters) return false;
            this.filterPresets.push({ id: crypto.randomUUID(), name, filters, createdAt: Date.now() });
            this.saveFilterPresets();
            this.showNotification(`Filter preset "${name}" saved`, '💾');
            return true;
        }

        applyFilterPreset(presetId) {
            const preset = this.filterPresets.find(p => p.id === presetId);
            if (!preset) return;
            this.state.currentFilters = preset.filters;
            if (preset.filters.category) this.state.activeCategory = preset.filters.category;
            this.renderBookmarks();
            this.showNotification(`Filter: ${preset.name}`, '🔍');
        }

        showFilterPresetsMenu() {
            if (!this.config.enableFilterPresets || !this.filterPresets.length) return;
            const existing = document.querySelector('.bm-presets-menu');
            if (existing) existing.remove();
            const menu = document.createElement('div');
            menu.className = 'bm-presets-menu';
            menu.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #0d1117; border: 1px solid #30363d; border-radius: 12px; padding: 16px; min-width: 300px; max-width: 400px; z-index: 2147483647; box-shadow: 0 8px 32px rgba(0,0,0,0.6); font-family: -apple-system, sans-serif;`;
            menu.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;"><h3 style="color: #e6edf3; margin: 0; font-size: 14px;">💾 Filter Presets</h3><button id="bm-close-presets" style="background: none; border: none; color: #8b949e; cursor: pointer; font-size: 18px;">✕</button></div><div id="bm-presets-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 12px;">${this.filterPresets.map(p => `<div class="bm-preset-item" data-id="${p.id}" style="padding: 10px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; margin-bottom: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"><div><div style="color: #e6edf3; font-size: 12px; font-weight: 500;">${this.escapeHtml(p.name)}</div><div style="color: #8b949e; font-size: 10px; margin-top: 2px;">${p.filters.category ? '📁 ' + p.filters.category : 'All categories'}${p.filters.favorite ? ' • ⭐ Favorites' : ''}${p.filters.tags?.length ? ' • 🏷️ ' + p.filters.tags.join(', ') : ''}</div></div><button class="bm-preset-apply" data-id="${p.id}" style="padding: 4px 10px; background: #58a6ff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 10px;">Apply</button></div>`).join('')}</div><div style="border-top: 1px solid #30363d; padding-top: 12px;"><label style="color: #8b949e; font-size: 11px; display: block; margin-bottom: 6px;">Save current filters as preset:</label><div style="display: flex; gap: 6px;"><input type="text" id="bm-preset-name" placeholder="Preset name..." style="flex: 1; padding: 6px 10px; background: #21262d; border: 1px solid #30363d; border-radius: 4px; color: #e6edf3; font-size: 11px; outline: none;"><button id="bm-save-preset" style="padding: 6px 12px; background: #238636; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px;">Save</button></div></div>`;
            document.body.appendChild(menu);
            this.animateIn(menu);
            menu.querySelector('#bm-close-presets').addEventListener('click', () => {
                this.animateOut(menu, () => menu.remove());
            });
            menu.querySelectorAll('.bm-preset-apply').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.applyFilterPreset(btn.dataset.id);
                    menu.remove();
                });
            });
            menu.querySelector('#bm-save-preset').addEventListener('click', () => {
                const name = menu.querySelector('#bm-preset-name').value.trim();
                if (name) {
                    this.createFilterPreset(name, { category: this.state.activeCategory, filters: this.state.currentFilters, favorite: this.showFavoritesOnly });
                    menu.remove();
                    setTimeout(() => this.showFilterPresetsMenu(), 300);
                }
            });
            setTimeout(() => {
                document.addEventListener('click', function close(e) {
                    if (!menu.contains(e.target)) {
                        this.animateOut(menu, () => menu.remove());
                        document.removeEventListener('click', close);
                    }
                }.bind(this), 100);
            }, 100);
        }

        async importBrowserBookmarks() {
            if (!this.config.enableImportBrowser) return;
            try {
                if (typeof chrome !== 'undefined' && chrome.bookmarks) {
                    const tree = await chrome.bookmarks.getTree();
                    this.processBrowserBookmarks(tree);
                    return;
                }
            } catch {}
            this.showNotification('Browser import requires permissions', 'ℹ️');
        }

        processBrowserBookmarks(tree) {
            const bookmarks = [];
            const traverse = (nodes, category = 'Imported') => {
                nodes.forEach(node => {
                    if (node.url) bookmarks.push({ title: node.title || new URL(node.url).hostname, url: node.url, category, notes: 'Imported from browser' });
                    if (node.children) traverse(node.children, node.title || category);
                });
            };
            traverse(tree);
            const imported = this.mergeBookmarks(bookmarks);
            if (imported > 0) {
                this.showNotification(`Imported ${imported} from browser`, '📥');
                this.renderBookmarks();
            }
        }

        offerBrowserImport() {
            const hasOffered = localStorage.getItem(`${MODULE_ID}-browserImportOffered`);
            if (hasOffered) return;
            setTimeout(() => {
                const overlay = document.createElement('div');
                overlay.style.cssText = `position: fixed; bottom: 136px; right: 24px; background: #161b22; border: 1px solid #58a6ff; border-radius: 10px; padding: 14px; max-width: 260px; z-index: 2147483647; box-shadow: 0 4px 16px rgba(88,166,255,0.3); font-family: -apple-system, sans-serif; animation: tooltipSlide 0.4s ease;`;
                overlay.innerHTML = `<div style="color: #e6edf3; font-size: 13px; font-weight: 600; margin-bottom: 8px;">🌐 Import Browser Bookmarks?</div><div style="color: #8b949e; font-size: 11px; margin-bottom: 12px; line-height: 1.5;">Bring your existing bookmarks into Bookmark Manager</div><div style="display: flex; gap: 6px;"><button id="bm-import-browser" style="flex: 1; padding: 6px; background: #58a6ff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px;">Import</button><button id="bm-skip-import" style="flex: 1; padding: 6px; background: #21262d; border: 1px solid #30363d; border-radius: 4px; color: #8b949e; cursor: pointer; font-size: 11px;">Skip</button></div>`;
                document.body.appendChild(overlay);
                overlay.querySelector('#bm-import-browser').addEventListener('click', () => {
                    this.importBrowserBookmarks();
                    localStorage.setItem(`${MODULE_ID}-browserImportOffered`, 'true');
                    overlay.remove();
                });
                overlay.querySelector('#bm-skip-import').addEventListener('click', () => {
                    localStorage.setItem(`${MODULE_ID}-browserImportOffered`, 'true');
                    overlay.remove();
                });
                setTimeout(() => { if (overlay.parentNode) this.animateOut(overlay, () => overlay.remove()); }, 10000);
            }, 3000);
        }

        detectEnvironment() {
            this.env = {
                manager: 'unknown', hasGM: typeof GM_getValue === 'function',
                hasGMSetValue: typeof GM_setValue === 'function', hasGMNotif: typeof GM_notification === 'function',
                hasGMRegisterMenu: typeof GM_registerMenuCommand === 'function', hasClipboard: !!navigator.clipboard,
                hasSpeech: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
                hasLocalStorage: typeof localStorage !== 'undefined', hasServiceWorker: 'serviceWorker' in navigator,
                isMobile: /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent),
                browser: this.getBrowserInfo()
            };
            if (typeof GM_info !== 'undefined') this.env.manager = GM_info.scriptName || 'Tampermonkey';
            else if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.GM_getValue === 'function') this.env.manager = 'Violentmonkey';
            else if (typeof GM_getValue !== 'function') this.env.manager = 'None (Limited Mode)';
            console.log(`[${MODULE_ID}] Environment: ${this.env.manager} | Browser: ${this.env.browser}`);
        }

        getBrowserInfo() {
            const ua = navigator.userAgent;
            if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
            if (ua.includes('Firefox')) return 'Firefox';
            if (ua.includes('Safari')) return 'Safari';
            if (ua.includes('Edg')) return 'Edge';
            return 'Unknown';
        }

        runFirstTimeSetup() {
            const hasCompletedSetup = localStorage.getItem(`${MODULE_ID}-setupComplete`);
            if (hasCompletedSetup) return;
            const overlay = document.createElement('div');
            overlay.id = 'bm-setup-overlay';
            overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 2147483647; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;`;
            const dialog = document.createElement('div');
            dialog.style.cssText = `background: #0d1117; border: 1px solid #30363d; border-radius: 12px; padding: 24px; max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.6);`;
            dialog.innerHTML = `<h2 style="color: #e6edf3; margin: 0 0 16px 0; font-size: 20px;">👋 Welcome to Bookmark Manager!</h2><p style="color: #8b949e; margin: 0 0 20px 0; font-size: 13px; line-height: 1.6;">Let's set up your bookmarking experience. This will only take a moment.</p><div style="background: #161b22; border-radius: 8px; padding: 16px; margin-bottom: 20px;"><label style="display: flex; align-items: center; gap: 10px; color: #e6edf3; margin-bottom: 12px; cursor: pointer;"><input type="checkbox" id="bm-setup-ai" checked style="width: 18px; height: 18px;"><div><div style="font-weight: 500; margin-bottom: 2px;">🤖 Enable AI Features</div><div style="font-size: 11px; color: #8b949e;">Smart categorization and tag suggestions</div></div></label><label style="display: flex; align-items: center; gap: 10px; color: #e6edf3; margin-bottom: 12px; cursor: pointer;"><input type="checkbox" id="bm-setup-notif" checked style="width: 18px; height: 18px;"><div><div style="font-weight: 500; margin-bottom: 2px;">🔔 Enable Notifications</div><div style="font-size: 11px; color: #8b949e;">Get notified about actions and updates</div></div></label><label style="display: flex; align-items: center; gap: 10px; color: #e6edf3; margin-bottom: 12px; cursor: pointer;"><input type="checkbox" id="bm-setup-shortcuts" checked style="width: 18px; height: 18px;"><div><div style="font-weight: 500; margin-bottom: 2px;">⌨️ Enable Keyboard Shortcuts</div><div style="font-size: 11px; color: #8b949e;">Quick access with Ctrl+Shift+B</div></div></label><label style="display: flex; align-items: center; gap: 10px; color: #e6edf3; cursor: pointer;"><input type="checkbox" id="bm-setup-context" checked style="width: 18px; height: 18px;"><div><div style="font-weight: 500; margin-bottom: 2px;">🖱️ Enable Right-Click Menu</div><div style="font-size: 11px; color: #8b949e;">Quick bookmark from any link</div></div></label></div><div style="display: flex; gap: 10px; justify-content: flex-end;"><button id="bm-setup-skip" style="padding: 8px 16px; background: #21262d; border: 1px solid #30363d; border-radius: 6px; color: #8b949e; cursor: pointer; font-size: 12px;">Skip</button><button id="bm-setup-continue" style="padding: 8px 16px; background: #58a6ff; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 12px; font-weight: 500;">Get Started →</button></div>`;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const completeSetup = () => {
                this.config.enableAI = dialog.querySelector('#bm-setup-ai').checked;
                this.config.enableNotifications = dialog.querySelector('#bm-setup-notif').checked;
                this.config.enableKeyboardShortcuts = dialog.querySelector('#bm-setup-shortcuts').checked;
                this.config.enableContextMenu = dialog.querySelector('#bm-setup-context').checked;
                this.saveConfig();
                localStorage.setItem(`${MODULE_ID}-setupComplete`, 'true');
                overlay.remove();
                this.showNotification('Setup complete! Press Ctrl+Shift+B to start', '🎉');
            };
            dialog.querySelector('#bm-setup-continue').addEventListener('click', completeSetup);
            dialog.querySelector('#bm-setup-skip').addEventListener('click', () => {
                localStorage.setItem(`${MODULE_ID}-setupComplete`, 'true');
                overlay.remove();
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    localStorage.setItem(`${MODULE_ID}-setupComplete`, 'true');
                    overlay.remove();
                }
            });
        }

        createInstallationShortcuts() {
            if (!this.env.hasGM) {
                console.warn(`[${MODULE_ID}] Running in limited mode`);
                this.showNotification('Running in limited mode', '⚠️');
            }
            if (typeof GM_registerMenuCommand === 'function') {
                this.menuCommands = [
                    GM_registerMenuCommand('📖 Show All Bookmarks', () => {
                        this.togglePanel(true); this.state.activeCategory = null;
                        this.renderCategories(); this.renderBookmarks();
                    }),
                    GM_registerMenuCommand('⭐ Show Favorites', () => {
                        this.togglePanel(true); this.showFavoritesOnly = true; this.renderBookmarks();
                    }),
                    GM_registerMenuCommand('📊 View Statistics', () => {
                        const stats = this.getStats();
                        alert(`📊 Bookmark Statistics\n\nTotal: ${stats.total}\nFavorites: ${stats.favorites}\nCategories: ${stats.categories}\nTags: ${stats.tags}\nOldest: ${stats.oldest ? new Date(stats.oldest).toLocaleDateString() : 'N/A'}\nNewest: ${stats.newest ? new Date(stats.newest).toLocaleDateString() : 'N/A'}`);
                    }),
                    GM_registerMenuCommand('📥 Export All', () => this.exportBookmarks())
                ];
            }
            if (!localStorage.getItem(`${MODULE_ID}-tooltipShown`)) {
                setTimeout(() => {
                    this.showFeatureTooltip();
                    localStorage.setItem(`${MODULE_ID}-tooltipShown`, 'true');
                }, 2000);
            }
        }

        showFeatureTooltip() {
            const tooltip = document.createElement('div');
            tooltip.style.cssText = `position: fixed; bottom: 136px; right: 80px; background: #161b22; border: 1px solid #58a6ff; border-radius: 10px; padding: 14px; max-width: 260px; z-index: 2147483647; box-shadow: 0 4px 16px rgba(88,166,255,0.3); font-family: -apple-system, BlinkMacSystemFont, sans-serif; animation: tooltipSlide 0.4s ease;`;
            tooltip.innerHTML = `<div style="color: #e6edf3; font-size: 13px; font-weight: 600; margin-bottom: 8px;">🚀 Quick Start Guide</div><div style="color: #8b949e; font-size: 11px; line-height: 1.6;"><div style="margin-bottom: 6px;"><strong style="color: #58a6ff;">Ctrl+Shift+B</strong> — Toggle panel</div><div style="margin-bottom: 6px;"><strong style="color: #58a6ff;">Ctrl+Shift+V</strong> — Quick capture page</div><div style="margin-bottom: 6px;"><strong style="color: #58a6ff;">Ctrl+K</strong> — Search bookmarks</div><div style="margin-bottom: 6px;"><strong style="color: #58a6ff;">Right-click</strong> — Bookmark any link</div><div><strong style="color: #58a6ff;">Floating ⭐</strong> — Toggle favorites</div></div><button style="margin-top: 12px; padding: 6px 12px; background: #58a6ff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; width: 100%;">Got it!</button>`;
            const style = document.createElement('style');
            style.textContent = `@keyframes tooltipSlide { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
            document.head.appendChild(style);
            document.body.appendChild(tooltip);
            tooltip.querySelector('button').addEventListener('click', () => {
                tooltip.style.opacity = '0'; tooltip.style.transition = 'opacity 0.3s ease';
                setTimeout(() => { tooltip.remove(); style.remove(); }, 300);
            });
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.style.opacity = '0'; tooltip.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => { tooltip.remove(); style.remove(); }, 300);
                }
            }, 8000);
        }

        showWelcome() {
            const hasSeenWelcome = localStorage.getItem(`${MODULE_ID}-welcomeShown`);
            if (!hasSeenWelcome && typeof GM_notification === 'function') {
                GM_notification('Press Ctrl+Shift+B to toggle panel', '👋 Welcome to Bookmark Manager');
                localStorage.setItem(`${MODULE_ID}-welcomeShown`, 'true');
            }
        }

        registerMenuCommands() {
            if (typeof GM_registerMenuCommand !== 'function') return;
            this.menuCommands = [
                GM_registerMenuCommand('📖 Show All Bookmarks', () => {
                    this.togglePanel(true); this.state.activeCategory = null;
                    this.renderCategories(); this.renderBookmarks();
                }),
                GM_registerMenuCommand('⭐ Show Favorites', () => {
                    this.togglePanel(true); this.showFavoritesOnly = true; this.renderBookmarks();
                }),
                GM_registerMenuCommand('📊 View Statistics', () => {
                    const stats = this.getStats();
                    alert(`📊 Bookmark Statistics\n\nTotal: ${stats.total}\nFavorites: ${stats.favorites}\nCategories: ${stats.categories}\nTags: ${stats.tags}\nOldest: ${stats.oldest ? new Date(stats.oldest).toLocaleDateString() : 'N/A'}\nNewest: ${stats.newest ? new Date(stats.newest).toLocaleDateString() : 'N/A'}`);
                }),
                GM_registerMenuCommand('📥 Export All', () => this.exportBookmarks())
            ];
        }

        async loadConfig() {
            try {
                let stored = null;
                if (typeof GM_getValue === 'function') stored = await GM_getValue(`${MODULE_ID}-config`, null);
                if (!stored) stored = localStorage.getItem(`${MODULE_ID}-config`);
                if (stored) this.config = { ...this.config, ...(typeof stored === 'string' ? JSON.parse(stored) : stored) };
            } catch (error) { console.warn(`[${MODULE_ID}] Failed to load config:`, error); }
        }

        async saveConfig() {
            try {
                const data = JSON.stringify(this.config);
                if (typeof GM_setValue === 'function') await GM_setValue(`${MODULE_ID}-config`, data);
                localStorage.setItem(`${MODULE_ID}-config`, data);
            } catch (error) { console.warn(`[${MODULE_ID}] Failed to save config:`, error); }
        }

        handleKeyboard(e) {
            if (e.ctrlKey && e.shiftKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); this.togglePanel(); return; }
            if (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); this.quickCapture(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
                if (this.panel.classList.contains('open')) {
                    e.preventDefault();
                    const searchEl = this.panel.querySelector('#bm-search');
                    if (searchEl) { searchEl.focus(); searchEl.select(); }
                } else { e.preventDefault(); this.togglePanel(true); setTimeout(() => { const s = this.panel.querySelector('#bm-search'); if (s) s.focus(); }, 100); }
                return;
            }
            if (e.key === 'Escape' && this.panel.classList.contains('open')) { this.togglePanel(false); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'n' || e.key === 'N') && this.panel.classList.contains('open')) { e.preventDefault(); const t = this.panel.querySelector('#bm-title'); if (t) t.focus(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'e' || e.key === 'E') && this.panel.classList.contains('open')) { e.preventDefault(); this.exportBookmarks(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'i' || e.key === 'I') && this.panel.classList.contains('open')) { e.preventDefault(); this.importBookmarks(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'd' || e.key === 'D') && this.panel.classList.contains('open')) { e.preventDefault(); this.toggleFavoritesFilter(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R') && this.panel.classList.contains('open')) { e.preventDefault(); this.showFilterPresetsMenu(); return; }
        }

        handleSearch(query) { this.state.currentQuery = query; this.renderBookmarks(); if (query.trim().length > 2) this.addToSearchHistory(query.trim()); }

        async saveBookmarks() {
            try {
                const data = JSON.stringify(this.state.bookmarks);
                if (typeof GM_setValue === 'function') await GM_setValue(`${MODULE_ID}-data`, data);
                localStorage.setItem(`${MODULE_ID}-data`, data);
            } catch (error) { console.warn(`[${MODULE_ID}] Failed to save bookmarks:`, error); }
        }

        addBookmark(bookmark) {
            if (!bookmark.title || !String(bookmark.title).trim()) { console.warn(`[${MODULE_ID}] Bookmark title is required`); return null; }
            if (this.state.bookmarks.length >= this.config.maxBookmarks) {
                console.warn(`[${MODULE_ID}] Maximum bookmarks limit reached (${this.config.maxBookmarks})`);
                if (typeof GM_notification === 'function') GM_notification(`Maximum bookmarks limit reached (${this.config.maxBookmarks})`, '⚠️ Bookmark Manager');
                return null;
            }
            const url = bookmark.url ? String(bookmark.url).trim() : '';
            if (url && !this.isValidUrl(url)) { console.warn(`[${MODULE_ID}] Invalid URL format`); return null; }
            const newBookmark = {
                id: crypto.randomUUID(), title: String(bookmark.title).trim(), url: url || null,
                notes: bookmark.notes || '', category: bookmark.category || this.config.defaultCategory,
                tags: Array.isArray(bookmark.tags) ? bookmark.tags.filter(t => t && String(t).trim()) : [],
                favorite: false, createdAt: Date.now(), updatedAt: Date.now(), visitCount: 0, lastVisited: null
            };
            this.state.bookmarks.push(newBookmark);
            if (this.config.autoSave) this.saveBookmarks();
            this.emit('bookmarkAdded', newBookmark);
            return newBookmark;
        }

        removeBookmark(id) {
            const index = this.state.bookmarks.findIndex(b => b.id === id);
            if (index !== -1) {
                const removed = this.state.bookmarks.splice(index, 1)[0];
                if (this.config.autoSave) this.saveBookmarks();
                this.emit('bookmarkRemoved', removed);
                return removed;
            }
            return null;
        }

        updateBookmark(id, updates) {
            const bookmark = this.state.bookmarks.find(b => b.id === id);
            if (!bookmark) return null;
            const allowedFields = ['title', 'url', 'notes', 'category', 'tags', 'favorite'];
            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    if (key === 'tags' && Array.isArray(updates[key])) bookmark[key] = updates[key].filter(t => t && String(t).trim());
                    else if (key === 'url') bookmark[key] = updates[key] ? String(updates[key]).trim() : null;
                    else bookmark[key] = updates[key];
                }
            });
            bookmark.updatedAt = Date.now();
            if (this.config.autoSave) this.saveBookmarks();
            this.emit('bookmarkUpdated', bookmark);
            return bookmark;
        }

        toggleFavorite(id) {
            const bookmark = this.state.bookmarks.find(b => b.id === id);
            if (!bookmark) return null;
            bookmark.favorite = !bookmark.favorite;
            bookmark.updatedAt = Date.now();
            if (this.config.autoSave) this.saveBookmarks();
            this.emit('bookmarkUpdated', bookmark);
            return bookmark;
        }

        recordVisit(id) {
            const bookmark = this.state.bookmarks.find(b => b.id === id);
            if (!bookmark) return;
            bookmark.visitCount++;
            bookmark.lastVisited = Date.now();
            if (this.config.autoSave) this.saveBookmarks();
            this.emit('bookmarkVisited', bookmark);
        }

        isValidUrl(url) {
            try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol); }
            catch { return false; }
        }

        getBookmarks(category) { return category ? [...this.state.bookmarks.filter(b => b.category === category)] : this.state.bookmarks; }

        searchBookmarks(query, filters = {}) {
            let results = [...this.state.bookmarks];
            if (query && query.trim()) {
                const lowerQuery = query.toLowerCase().trim();
                const terms = lowerQuery.split(/\s+/);
                results = results.filter(b => {
                    const searchText = `${b.title} ${b.url || ''} ${b.notes} ${(b.tags || []).join(' ')}`.toLowerCase();
                    return terms.every(term => searchText.includes(term));
                });
            }
            if (filters.category) results = results.filter(b => b.category === filters.category);
            if (filters.favorite !== undefined) results = results.filter(b => b.favorite === filters.favorite);
            if (filters.tags?.length > 0) results = results.filter(b => filters.tags.some(t => (b.tags || []).includes(t)));
            if (filters.dateFrom) { const from = new Date(filters.dateFrom).getTime(); results = results.filter(b => b.createdAt >= from); }
            if (filters.dateTo) { const to = new Date(filters.dateTo).getTime(); results = results.filter(b => b.createdAt <= to); }
            if (filters.sortBy) {
                const { sortBy, sortOrder = 'desc' } = filters;
                results.sort((a, b) => {
                    let valA = a[sortBy], valB = b[sortBy];
                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();
                    if (valA == null && valB == null) return 0;
                    if (valA == null) return sortOrder === 'asc' ? -1 : 1;
                    if (valB == null) return sortOrder === 'asc' ? 1 : -1;
                    return valA < valB ? (sortOrder === 'asc' ? -1 : 1) : (valA > valB ? (sortOrder === 'asc' ? 1 : -1) : 0);
                });
            }
            return results;
        }

        findByUrl(url) { return this.state.bookmarks.find(b => b.url === url); }

        findDuplicates(field = 'url') {
            const groups = new Map();
            this.state.bookmarks.forEach(b => { const key = b[field]; if (key) { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(b); } });
            return Array.from(groups.entries()).filter(([, bookmarks]) => bookmarks.length > 1).map(([key, bookmarks]) => ({ key, count: bookmarks.length, bookmarks }));
        }

        mergeDuplicates(field = 'url') {
            const duplicates = this.findDuplicates(field);
            let merged = 0;
            duplicates.forEach(({ bookmarks }) => {
                const keeper = bookmarks.reduce((oldest, b) => b.createdAt < oldest.createdAt ? b : oldest);
                bookmarks.forEach(b => { if (b.id !== keeper.id) { this.removeBookmark(b.id); merged++; } });
            });
            return merged;
        }

        getStats() {
            const total = this.state.bookmarks.length;
            const favorites = this.state.bookmarks.filter(b => b.favorite).length;
            const categories = [...new Set(this.state.bookmarks.map(b => b.category))];
            const tags = [...new Set(this.state.bookmarks.flatMap(b => b.tags || []))];
            const timestamps = this.state.bookmarks.map(b => b.createdAt);
            const oldest = timestamps.length ? new Date(Math.min(...timestamps)) : null;
            const newest = timestamps.length ? new Date(Math.max(...timestamps)) : null;
            const byCategory = categories.reduce((acc, cat) => { acc[cat] = this.state.bookmarks.filter(b => b.category === cat).length; return acc; }, {});
            const byTag = tags.reduce((acc, tag) => { acc[tag] = this.state.bookmarks.filter(b => (b.tags || []).includes(tag)).length; return acc; }, {});
            const last7Days = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const recent = this.state.bookmarks.filter(b => b.createdAt >= last7Days).length;
            const mostVisited = [...this.state.bookmarks].sort((a, b) => b.visitCount - a.visitCount).slice(0, 5);
            return { total, favorites, categories: categories.length, tags: tags.length, oldest, newest, recent, byCategory, byTag, mostVisited };
        }

        getActivityLog() {
            return this.state.bookmarks.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map(b => ({ action: 'created', bookmark: b, timestamp: b.createdAt }));
        }

        on(event, callback) {
            if (!this.listeners.has(event)) this.listeners.set(event, []);
            this.listeners.get(event).push(callback);
            return () => this.off(event, callback);
        }

        off(event, callback) {
            const callbacks = this.listeners.get(event) || [];
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }

        emit(event, data) {
            const callbacks = this.listeners.get(event) || [];
            callbacks.forEach(cb => { try { cb(data); } catch (e) { console.error(`[${MODULE_ID}] Event error:`, e); } });
        }

        injectStyles() {
            try {
                const style = document.createElement('style');
                style.id = `${MODULE_ID}-styles`;
                style.textContent = `@keyframes bm-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } } @keyframes bm-slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes bm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } } .bm-float-btn { position: fixed; bottom: 80px; right: 24px; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #58a6ff, #bc8cff); border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.4); font-size: 20px; color: #fff; z-index: 2147483645; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease, box-shadow 0.2s ease; } .bm-float-btn:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.6); } .bm-float-btn:active { transform: scale(0.95); } .bm-panel { position: fixed; bottom: 136px; right: 24px; width: 360px; max-height: 500px; background: #0d1117; border: 1px solid #30363d; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); z-index: 2147483645; display: none; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; animation: bm-slide-in 0.3s ease; } .bm-panel.open { display: flex; } .bm-panel-hdr { padding: 12px 16px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: #e6edf3; } .bm-panel-body { padding: 12px; overflow-y: auto; flex: 1; } .bm-panel-body::-webkit-scrollbar { width: 8px; } .bm-panel-body::-webkit-scrollbar-track { background: #161b22; } .bm-panel-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; } .bm-panel-body::-webkit-scrollbar-thumb:hover { background: #484f58; } .bm-input { width: 100%; padding: 8px 12px; background: #21262d; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; font-size: 12px; margin-bottom: 8px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; } .bm-input:focus { border-color: #58a6ff; box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1); } .bm-input.shake { animation: bm-shake 0.5s ease; border-color: #f85149; } .bm-category { padding: 6px 12px; background: #21262d; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; font-size: 11px; cursor: pointer; margin: 2px; transition: all 0.2s ease; } .bm-category:hover { background: #30363d; transform: translateY(-1px); } .bm-cat-active { background: #58a6ff; border-color: #58a6ff; color: #fff; } .bm-item { padding: 10px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; margin-bottom: 6px; font-size: 11px; transition: all 0.2s ease; cursor: pointer; } .bm-item:hover { border-color: #58a6ff; transform: translateX(2px); } .bm-item-title { color: #e6edf3; font-weight: 500; margin-bottom: 4px; word-break: break-word; } .bm-item-url { color: #58a6ff; word-break: break-all; font-size: 10px; } .bm-item-actions { margin-top: 6px; display: flex; gap: 6px; } .bm-btn-sm { padding: 4px 8px; background: #21262d; border: 1px solid #30363d; border-radius: 4px; color: #8b949e; cursor: pointer; font-size: 10px; transition: all 0.2s ease; } .bm-btn-sm:hover { background: #30363d; color: #e6edf3; transform: translateY(-1px); } .bm-btn-sm:active { transform: translateY(0); } .bm-btn-del { color: #f85149; } .bm-btn-del:hover { background: #4a1e1e; } .bm-context-menu { animation: bm-slide-in 0.2s ease; }`;
                document.head.appendChild(style);
            } catch (error) { console.warn(`[${MODULE_ID}] Style injection failed:`, error); }
        }

        createUI() {
            this.fab = document.createElement('button');
            this.fab.className = 'bm-float-btn';
            this.fab.innerHTML = '<span style="font-size:24px">🔖</span>';
            this.fab.title = 'Bookmark Manager\n\nShortcuts:\nCtrl+Shift+B: Toggle\nCtrl+Shift+V: Quick Capture\nCtrl+K: Search';
            this.fab.addEventListener('click', () => this.togglePanel());
            document.body.appendChild(this.fab);
            this.panel = document.createElement('div');
            this.panel.className = 'bm-panel';
            this.panel.innerHTML = `<div class="bm-panel-hdr"><span>Bookmark Manager</span><div style="display:flex;gap:6px"><button class="bm-btn-sm" id="bm-export" title="Export (Ctrl+E)">📥</button><button class="bm-btn-sm" id="bm-import" title="Import (Ctrl+I)">📤</button><button class="bm-btn-sm" id="bm-presets" title="Filter Presets (Ctrl+R)">💾</button><button class="bm-btn-sm" id="bm-close" title="Close (Esc)">✕</button></div></div><div class="bm-panel-body"><input type="text" class="bm-input" id="bm-search" placeholder="🔍 Search... (Ctrl+K)"><div style="display:flex;gap:6px;margin-bottom:8px"><select class="bm-input" id="bm-sort" style="flex:1" title="Sort order"><option value="createdAt-desc">Newest First</option><option value="createdAt-asc">Oldest First</option><option value="title-asc">Title A-Z</option><option value="title-desc">Title Z-A</option><option value="updatedAt-desc">Recently Updated</option><option value="visitCount-desc">Most Visited</option></select><button class="bm-btn-sm" id="bm-fav-filter" title="Show Favorites (Ctrl+D)">⭐</button><button class="bm-btn-sm" id="bm-bulk-mode" title="Bulk Select Mode">☑️</button></div><div id="bm-categories" style="margin-bottom: 8px;"></div><div style="display:flex;gap:6px"><input type="text" class="bm-input" id="bm-title" placeholder="Title *" style="flex:2"><input type="text" class="bm-input" id="bm-url" placeholder="URL" style="flex:3"></div><input type="text" class="bm-input" id="bm-notes" placeholder="Notes (optional)"><input type="text" class="bm-input" id="bm-tags" placeholder="Tags (comma-separated)"><div style="display:flex;gap:6px"><select class="bm-input" id="bm-category" style="flex:1"></select><button class="bm-btn-sm" id="bm-add" style="flex:1;padding:8px;background:#238636;border-color:#238636;color:#fff;font-weight:500">➕ Add</button></div><div id="bm-list" style="margin-top: 12px;"></div><div id="bm-stats" style="margin-top:8px;padding:8px;background:#161b22;border-radius:6px;font-size:10px;color:#8b949e;display:flex;justify-content:space-between;align-items:center"><span id="bm-stats-text">📊 0 bookmarks</span><span id="bm-bulk-actions" style="display:none"><button class="bm-btn-sm" id="bm-bulk-delete" style="color:#f85149">🗑️ Delete Selected</button></span></div></div>`;
            document.body.appendChild(this.panel);
            this.categorySelect = this.panel.querySelector('#bm-category');
            this.config.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat; option.textContent = cat;
                this.categorySelect.appendChild(option);
            });
        }

        attachListeners() {
            this.panel.querySelector('#bm-close').addEventListener('click', () => this.togglePanel(false));
            this.panel.querySelector('#bm-add').addEventListener('click', () => this.addCurrentBookmark());
            this.panel.querySelector('#bm-search').addEventListener('input', e => this.handleSearch(e.target.value));
            this.panel.querySelector('#bm-sort').addEventListener('change', e => this.handleSort(e.target.value));
            this.panel.querySelector('#bm-fav-filter').addEventListener('click', () => this.toggleFavoritesFilter());
            this.panel.querySelector('#bm-export').addEventListener('click', () => this.exportBookmarks());
            this.panel.querySelector('#bm-import').addEventListener('click', () => this.importBookmarks());
            this.panel.querySelector('#bm-presets').addEventListener('click', () => this.showFilterPresetsMenu());
            this.panel.querySelector('#bm-bulk-mode').addEventListener('click', () => this.toggleBulkMode());
            this._keyHandler = e => this.handleKeyboard(e);
            document.addEventListener('keydown', this._keyHandler);
            this._visibilityHandler = () => { if (document.visibilityState === 'hidden' && this.config.autoSave) this.saveBookmarks(); };
            document.addEventListener('visibilitychange', this._visibilityHandler);
            this._contextHandler = e => this.handleContextMenu(e);
            document.addEventListener('contextmenu', this._contextHandler);
        }

        detachListeners() {
            if (this.fab) this.fab.replaceWith(this.fab.cloneNode(true));
            if (this.panel) this.panel.replaceWith(this.panel.cloneNode(true));
            if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
            if (this._visibilityHandler) document.removeEventListener('visibilitychange', this._visibilityHandler);
            if (this._contextHandler) document.removeEventListener('contextmenu', this._contextHandler);
        }

        handleSort(value) {
            const [sortBy, sortOrder] = value.split('-');
            this.renderBookmarks(this.panel.querySelector('#bm-search').value, { sortBy, sortOrder });
        }

        toggleFavoritesFilter() {
            this.showFavoritesOnly = !this.showFavoritesOnly;
            const btn = this.panel.querySelector('#bm-fav-filter');
            btn.style.background = this.showFavoritesOnly ? '#3d2e00' : '';
            btn.style.color = this.showFavoritesOnly ? '#d29922' : '';
            this.renderBookmarks();
        }

        addToSearchHistory(query) {
            let history = [];
            try { const stored = localStorage.getItem(`${MODULE_ID}-searchHistory`); history = stored ? JSON.parse(stored) : []; } catch {}
            history = [query, ...history.filter(h => h !== query)].slice(0, 10);
            localStorage.setItem(`${MODULE_ID}-searchHistory`, JSON.stringify(history));
        }

        getSearchHistory() {
            try { const stored = localStorage.getItem(`${MODULE_ID}-searchHistory`); return stored ? JSON.parse(stored) : []; } catch { return []; }
        }

        clearSearchHistory() { localStorage.removeItem(`${MODULE_ID}-searchHistory`); }

        removeUI() {
            if (this.fab) this.fab.remove();
            if (this.panel) this.panel.remove();
            const style = document.getElementById(`${MODULE_ID}-styles`);
            if (style) style.remove();
        }

        togglePanel(force) {
            const isOpen = typeof force === 'boolean' ? force : !this.panel.classList.contains('open');
            this.panel.classList.toggle('open', isOpen);
            if (isOpen) {
                this.renderCategories(); this.restorePanelState();
                setTimeout(() => {
                    if (this.state.currentQuery) { const s = this.panel.querySelector('#bm-search'); if (s) s.focus(); }
                    else { const t = this.panel.querySelector('#bm-title'); if (t) t.focus(); }
                }, 100);
            } else this.savePanelState();
        }

        savePanelState() {
            const state = { category: this.state.activeCategory, sort: this.panel.querySelector('#bm-sort')?.value || 'createdAt-desc', showFavorites: this.showFavoritesOnly, search: this.state.currentQuery };
            localStorage.setItem(`${MODULE_ID}-panelState`, JSON.stringify(state));
        }

        restorePanelState() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-panelState`);
                if (!stored) return;
                const state = JSON.parse(stored);
                if (state.category) this.state.activeCategory = state.category;
                if (state.sort) { const s = this.panel.querySelector('#bm-sort'); if (s) s.value = state.sort; }
                this.showFavoritesOnly = state.showFavorites || false;
                if (state.search) { const s = this.panel.querySelector('#bm-search'); s.value = state.search; this.state.currentQuery = state.search; }
            } catch {}
        }

        addCurrentBookmark() {
            const titleEl = this.panel.querySelector('#bm-title');
            const urlEl = this.panel.querySelector('#bm-url');
            const notesEl = this.panel.querySelector('#bm-notes');
            const tagsEl = this.panel.querySelector('#bm-tags');
            const categoryEl = this.panel.querySelector('#bm-category');
            const title = titleEl.value.trim();
            if (!title) {
                titleEl.focus(); titleEl.style.borderColor = '#f85149'; titleEl.style.animation = 'shake 0.5s ease';
                setTimeout(() => { titleEl.style.borderColor = ''; titleEl.style.animation = ''; }, 2000);
                return;
            }
            const bookmark = { title, url: urlEl.value.trim() || window.location.href, notes: notesEl.value.trim(), tags: tagsEl.value.split(',').map(t => t.trim()).filter(Boolean), category: categoryEl.value };
            const added = this.addBookmark(bookmark);
            if (added) {
                titleEl.value = ''; urlEl.value = ''; notesEl.value = ''; tagsEl.value = '';
                this.renderBookmarks(); this.updateStats();
                if (this.config.enableNotifications) this.showNotification('Bookmark added', '✅');
                this.emit('bookmarkAdded', added);
                titleEl.focus();
            }
        }

        quickCapture() {
            const title = document.title || 'Untitled';
            const url = window.location.href;
            const existing = this.findByUrl(url);
            if (existing) {
                if (this.config.enableNotifications) this.showNotification('Already bookmarked', 'ℹ️');
                this.togglePanel(true); this.state.activeCategory = existing.category;
                this.renderCategories(); this.renderBookmarks();
                return;
            }
            const bookmark = this.addBookmark({ title, url, category: this.state.activeCategory || this.config.defaultCategory });
            if (bookmark) {
                if (this.config.enableNotifications) this.showNotification('Quick captured!', '⚡');
                this.togglePanel(true); this.renderBookmarks();
            }
        }

        renderCategories() {
            const container = this.panel.querySelector('#bm-categories');
            if (!container) return;
            container.innerHTML = this.config.categories.map(cat => `<button class="bm-category${this.state.activeCategory === cat ? ' bm-cat-active' : ''}" data-cat="${cat}">${this.escapeHtml(cat)}</button>`).join('');
            const allBtn = document.createElement('button');
            allBtn.className = `bm-category${!this.state.activeCategory ? ' bm-cat-active' : ''}`;
            allBtn.textContent = 'All'; allBtn.style.marginRight = '4px';
            allBtn.addEventListener('click', () => { this.state.activeCategory = null; this.renderCategories(); this.renderBookmarks(); });
            container.insertBefore(allBtn, container.firstChild);
            container.querySelectorAll('.bm-category').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.state.activeCategory = btn.dataset.cat === this.state.activeCategory ? null : btn.dataset.cat;
                    this.renderCategories(); this.renderBookmarks();
                });
            });
        }

        addCategory(name) {
            const trimmed = name.trim();
            if (!trimmed || this.config.categories.includes(trimmed)) return false;
            this.config.categories.push(trimmed); this.saveConfig(); this.renderCategories();
            return true;
        }

        removeCategory(name) {
            const index = this.config.categories.indexOf(name);
            if (index === -1) return false;
            this.state.bookmarks.forEach(b => { if (b.category === name) b.category = this.config.defaultCategory; });
            this.config.categories.splice(index, 1); this.saveConfig();
            if (this.state.activeCategory === name) this.state.activeCategory = null;
            this.renderCategories(); this.renderBookmarks();
            return true;
        }

        renderBookmarks(query = '', filters = {}) {
            query = query || this.state.currentQuery;
            const list = this.ui.listEl || this.panel.querySelector('#bm-list');
            let bookmarks = query ? this.searchBookmarks(query, filters) : this.searchBookmarks('', { ...filters, category: this.state.activeCategory });
            if (this.showFavoritesOnly) bookmarks = bookmarks.filter(b => b.favorite);
            if (filters.sortBy) bookmarks = this.searchBookmarks('', { ...filters, category: this.state.activeCategory, favorite: this.showFavoritesOnly ? true : undefined });
            this.updateStats();
            if (!bookmarks.length) {
                list.innerHTML = `<div style="color:#6e7681;text-align:center;padding:40px 20px"><div style="font-size:32px;margin-bottom:8px">📭</div><div style="font-size:12px">No bookmarks found</div><div style="font-size:10px;margin-top:4px">Try adjusting your search or filters</div></div>`;
                return;
            }
            list.innerHTML = bookmarks.map(b => this.renderBookmarkItem(b)).join('');
            this.attachBookmarkListeners();
        }

        renderBookmarkItem(b) {
            const date = new Date(b.createdAt).toLocaleDateString(this.config.dateFormat === 'en-US' ? undefined : this.config.dateFormat, { month: 'short', day: 'numeric', year: 'numeric' });
            const relativeTime = this.getRelativeTime(b.createdAt);
            const favIcon = b.favorite ? '⭐ ' : '';
            const visitInfo = b.visitCount > 0 ? ` 👁 ${b.visitCount}` : '';
            const aiBadge = b.aiGenerated ? ' 🤖' : '';
            const selected = this.state.selectedBookmarks.has(b.id);
            return `<div class="bm-item${selected ? ' bm-selected' : ''}" data-id="${b.id}" style="${selected ? 'border-color:#58a6ff;background:#1c2d3d' : ''}"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="flex:1;min-width:0"><div class="bm-item-title">${this.config.enableBulkSelect ? `<input type="checkbox" class="bm-bulk-check" data-id="${b.id}" ${selected ? 'checked' : ''} style="margin-right:6px;cursor:pointer">` : ''}${favIcon}${this.escapeHtml(b.title)}${aiBadge}</div>${b.url ? `<div class="bm-item-url">${this.escapeHtml(b.url)}</div>` : ''}${b.notes ? `<div style="color:#8b949e;font-size:10px;margin:4px 0;font-style:italic">${this.escapeHtml(b.notes.substring(0, 100))}${b.notes.length > 100 ? '...' : ''}</div>` : ''}<div style="color:#8b949e;font-size:10px;margin-top:4px"><span style="display:inline-block;padding:2px 6px;background:#21262d;border-radius:3px;margin-right:4px">${this.escapeHtml(b.category)}</span>${b.tags.map(t => `<span style="color:#58a6ff;cursor:pointer" data-tag="${this.escapeHtml(t)}">#${this.escapeHtml(t)}</span>`).join(' ')}${visitInfo}<span style="color:#6e7681;margin-left:auto;padding-left:8px" title="${date}">${relativeTime}</span></div></div></div><div class="bm-item-actions">${b.url ? `<button class="bm-btn-sm" data-action="open" data-id="${b.id}">🔗 Open</button>` : ''}<button class="bm-btn-sm" data-action="copy" data-id="${b.id}">📋 Copy</button><button class="bm-btn-sm" data-action="edit" data-id="${b.id}">✏️ Edit</button><button class="bm-btn-sm" data-action="favorite" data-id="${b.id}">${b.favorite ? '⭐' : '☆'}</button><button class="bm-btn-sm bm-btn-del" data-action="delete" data-id="${b.id}">🗑️</button></div></div>`;
        }

        attachBookmarkListeners() {
            const list = this.ui.listEl || this.panel.querySelector('#bm-list');
            if (this.config.enableBulkSelect) {
                list.querySelectorAll('.bm-bulk-check').forEach(cb => {
                    cb.addEventListener('change', e => {
                        if (cb.checked) this.state.selectedBookmarks.add(cb.dataset.id);
                        else this.state.selectedBookmarks.delete(cb.dataset.id);
                        this.updateBulkUI();
                    });
                });
            }
            list.querySelectorAll('.bm-btn-sm').forEach(btn => {
                btn.addEventListener('click', e => {
                    const id = btn.dataset.id, action = btn.dataset.action;
                    if (!id || !action) return;
                    switch (action) {
                        case 'open': this.openBookmark(id); break;
                        case 'copy': this.copyBookmark(id); break;
                        case 'edit': this.editBookmark(id); break;
                        case 'favorite': this.toggleFavorite(id); break;
                        case 'delete': this.deleteBookmark(id); break;
                    }
                });
            });
            list.querySelectorAll('[data-tag]').forEach(tagEl => {
                tagEl.addEventListener('click', e => {
                    const tag = tagEl.dataset.tag;
                    const searchEl = this.panel.querySelector('#bm-search');
                    if (searchEl) { searchEl.value = `#${tag}`; this.handleSearch(`#${tag}`); }
                });
            });
            list.querySelectorAll('.bm-item').forEach(item => {
                item.addEventListener('dblclick', async e => {
                    if (e.target.closest('button') || e.target.closest('input')) return;
                    const id = item.dataset.id;
                    if (this.config.enableInlineEdit && e.ctrlKey) await this.inlineEditBookmark(id);
                    else this.openBookmark(id);
                });
            });
            this.updateBulkUI();
        }

        toggleBulkMode() {
            if (!this.config.enableBulkSelect) return;
            this.config.enableBulkSelect = !this.config.enableBulkSelect;
            const btn = this.panel.querySelector('#bm-bulk-mode');
            btn.style.background = this.config.enableBulkSelect ? '#58a6ff' : '';
            btn.style.color = this.config.enableBulkSelect ? '#fff' : '';
            if (!this.config.enableBulkSelect) this.state.selectedBookmarks.clear();
            this.renderBookmarks();
            this.showNotification(this.config.enableBulkSelect ? 'Bulk select enabled' : 'Bulk select disabled', '☑️');
        }

        selectAllBookmarks() { this.state.bookmarks.forEach(b => this.state.selectedBookmarks.add(b.id)); this.renderBookmarks(); this.updateBulkUI(); }

        updateBulkUI() {
            const count = this.state.selectedBookmarks.size;
            const bulkActions = this.panel.querySelector('#bm-bulk-actions');
            const bulkModeBtn = this.panel.querySelector('#bm-bulk-mode');
            if (bulkActions) bulkActions.style.display = count > 0 ? 'block' : 'none';
            if (bulkModeBtn && this.config.enableBulkSelect) { bulkModeBtn.style.background = count > 0 ? '#58a6ff' : ''; bulkModeBtn.style.color = count > 0 ? '#fff' : ''; }
        }

        async inlineEditBookmark(id) {
            const bookmark = this.state.bookmarks.find(b => b.id === id);
            if (!bookmark) return;
            const newTitle = prompt('Edit title:', bookmark.title);
            if (newTitle === null || !newTitle.trim()) return;
            const newUrl = prompt('Edit URL:', bookmark.url || '');
            if (newUrl && !this.isValidUrl(newUrl)) { alert('Invalid URL format'); return; }
            this.updateBookmark(id, { title: newTitle.trim(), url: newUrl.trim() || null });
            this.renderBookmarks();
            this.showNotification('Bookmark updated', '✏️');
        }

        animateIn(el) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'bm-slide-in 0.3s ease'; }

        animateOut(el, callback) {
            el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
            setTimeout(() => { if (callback) callback(); }, 300);
        }

        getRelativeTime(timestamp) {
            const seconds = Math.floor((Date.now() - timestamp) / 1000);
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
            if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
            return new Date(timestamp).toLocaleDateString();
        }

        openBookmark(id) {
            const bookmark = this.state.bookmarks.find(b => b.id === id);
            if (!bookmark || !bookmark.url) return;
            this.recordVisit(id); this.emit('bookmarkOpened', bookmark);
            window.open(bookmark.url, '_blank');
        }

        async handleKeyboard(e) {
            if (e.ctrlKey && e.shiftKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); this.togglePanel(); return; }
            if (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); this.quickCapture(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
                if (this.panel.classList.contains('open')) {
                    e.preventDefault(); const s = this.panel.querySelector('#bm-search');
                    if (s) { s.focus(); s.select(); }
                } else { e.preventDefault(); this.togglePanel(true); setTimeout(() => { const s = this.panel.querySelector('#bm-search'); if (s) s.focus(); }, 100); }
                return;
            }
            if (e.key === 'Escape' && this.panel.classList.contains('open')) { this.togglePanel(false); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'n' || e.key === 'N') && this.panel.classList.contains('open')) { e.preventDefault(); const t = this.panel.querySelector('#bm-title'); if (t) t.focus(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'e' || e.key === 'E') && this.panel.classList.contains('open')) { e.preventDefault(); this.exportBookmarks(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'i' || e.key === 'I') && this.panel.classList.contains('open')) { e.preventDefault(); this.importBookmarks(); return; }
            if (e.ctrlKey && !e.shiftKey && (e.key === 'd' || e.key === 'D') && this.panel.classList.contains('open')) { e.preventDefault(); this.toggleFavoritesFilter(); return; }
            if (e.ctrlKey && e.shiftKey && (e.key === 'p' || e.key === 'P') && this.panel.classList.contains('open')) { e.preventDefault(); this.showFilterPresetsMenu(); return; }
            if (e.ctrlKey && e.key === 'a' && this.panel.classList.contains('open') && this.config.enableBulkSelect) { e.preventDefault(); this.selectAllBookmarks(); return; }
        }

        handleContextMenu(e) {
            const link = e.target.closest('a');
            if (!link) return;
            const url = link.href;
            const title = link.textContent?.trim() || link.title || 'Link';
            const existing = document.querySelector('.bm-context-menu');
            if (existing) existing.remove();
            const menu = document.createElement('div');
            menu.className = 'bm-context-menu';
            menu.style.cssText = `position: fixed; left: ${e.clientX}px; top: ${e.clientY}px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 4px; z-index: 2147483647; min-width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px;`;
            const createItem = (text, action, icon = '') => {
                const item = document.createElement('div');
                item.style.cssText = `padding: 6px 12px; cursor: pointer; border-radius: 4px; color: #e6edf3; display: flex; align-items: center; gap: 8px;`;
                item.innerHTML = `${icon}<span>${text}</span>`;
                item.addEventListener('mouseenter', () => item.style.background = '#21262d');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', () => { action(); menu.remove(); });
                return item;
            };
            const existingBM = this.findByUrl(url);
            menu.appendChild(createItem(existingBM ? '✓ Update Bookmark' : '📖 Bookmark This Page', () => {
                if (existingBM) this.editBookmark(existingBM.id);
                else { this.addBookmark({ title, url, category: this.state.activeCategory || this.config.defaultCategory }); this.showNotification('Bookmark added', '✅'); }
            }));
            if (existingBM) menu.appendChild(createItem('⭐ Toggle Favorite', () => { this.toggleFavorite(existingBM.id); this.showNotification('Favorite toggled', '⭐'); }));
            menu.appendChild(createItem('📋 Copy Link', () => { navigator.clipboard?.writeText(url); this.showNotification('Link copied', '📋'); }, '📋'));
            menu.appendChild(createItem('🔗 Open in New Tab', () => window.open(url, '_blank'), '🔗'));
            document.body.appendChild(menu);
            const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); window.removeEventListener('scroll', closeMenu, true); };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
            window.addEventListener('scroll', closeMenu, { once: true, capture: true });
            e.preventDefault(); e.stopPropagation();
        }

        editBookmark(id) {
            const bookmark = this.state.bookmarks.find(b => b.id === id);
            if (!bookmark) return;
            const item = this.ui.listEl.querySelector(`[data-id="${id}"]`);
            if (!item) return;
            const titleEl = item.querySelector('.bm-item-title');
            const urlEl = item.querySelector('.bm-item-url');
            const newTitle = prompt('Title:', bookmark.title);
            if (newTitle === null) return;
            if (!newTitle.trim()) { alert('Title is required'); return; }
            const newUrl = prompt('URL:', bookmark.url || '');
            if (newUrl && !this.isValidUrl(newUrl)) { alert('Invalid URL format. Must start with http:// or https://'); return; }
            const newNotes = prompt('Notes:', bookmark.notes || '');
            const newTags = prompt('Tags (comma-separated):', bookmark.tags.join(', '));
            const newCategory = prompt('Category:', bookmark.category);
            if (newCategory && !this.config.categories.includes(newCategory)) { this.config.categories.push(newCategory); this.saveConfig(); }
            this.updateBookmark(id, { title: newTitle.trim(), url: newUrl.trim() || null, notes: newNotes.trim(), tags: newTags.split(',').map(t => t.trim()).filter(Boolean), category: newCategory.trim() || bookmark.category });
            this.renderBookmarks(); this.renderCategories();
            if (this.config.enableNotifications && typeof GM_notification === 'function') GM_notification('Bookmark updated', '✅ Bookmark Manager');
        }

        deleteBookmark(id) {
            const bookmark = this.state.bookmarks.find(b => b.id === id);
            if (!bookmark) return;
            if (this.config.enableConfirmations) { if (!confirm(`Delete "${bookmark.title}"?\n\nThis action cannot be undone.`)) return; }
            this.removeBookmark(id); this.renderBookmarks();
            if (this.config.enableNotifications && typeof GM_notification === 'function') GM_notification('Bookmark deleted', '🗑️ Bookmark Manager');
        }

        restoreState() {
            const lastCategory = localStorage.getItem(`${MODULE_ID}-lastCategory`);
            this.state.activeCategory = lastCategory || null;
            this.showFavoritesOnly = false;
        }

        showNotification(message, icon = 'ℹ️') {
            const toast = document.createElement('div');
            toast.style.cssText = `position: fixed; bottom: 90px; right: 24px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 10px 14px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #e6edf3; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.4); animation: toastSlide 0.3s ease; display: flex; align-items: center; gap: 8px;`;
            toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
            const style = document.createElement('style');
            style.textContent = `@keyframes toastSlide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
            document.head.appendChild(style);
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => { toast.remove(); style.remove(); }, 300);
            }, 2000);
        }

        updateStats() {
            const stats = this.getStats();
            const statsEl = this.panel.querySelector('#bm-stats');
            if (statsEl) statsEl.innerHTML = `📊 ${stats.total} bookmarks • ${stats.favorites} favorites • ${stats.categories} categories • ${stats.tags} unique tags`;
        }

        escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        }

        sanitize(text) { return this.escapeHtml(text); }

        backup() { return { version: MODULE_VERSION, timestamp: Date.now(), config: this.config, bookmarks: this.state.bookmarks, categories: this.config.categories }; }

        restore(data) {
            if (!data || typeof data !== 'object') throw new Error('Invalid backup data');
            if (!Array.isArray(data.bookmarks)) throw new Error('Invalid backup: missing bookmarks array');
            const validBookmarks = data.bookmarks.filter(b => b && b.title && typeof b.title === 'string');
            if (validBookmarks.length === 0) throw new Error('No valid bookmarks found in backup');
            this.state.bookmarks = validBookmarks;
            if (data.config) this.config = { ...this.config, ...data.config };
            if (data.categories && Array.isArray(data.categories)) this.config.categories = data.categories;
            this.saveBookmarks(); this.saveConfig(); this.renderBookmarks(); this.renderCategories();
            if (this.config.enableNotifications && typeof GM_notification === 'function') GM_notification(`Restored ${validBookmarks.length} bookmarks`, `🔄 Bookmark Manager`);
            this.emit('backupRestored', { count: validBookmarks.length });
        }

        async exportBookmarks(includeStats = false) {
            try {
                const data = includeStats ? this.backup() : this.state.bookmarks;
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const timestamp = new Date().toISOString().split('T')[0];
                a.href = url; a.download = `bookmarks-${timestamp}.json`; a.click();
                URL.revokeObjectURL(url);
                if (this.config.enableNotifications && typeof GM_notification === 'function') GM_notification(`Exported ${this.state.bookmarks.length} bookmarks`, `📥 Bookmark Manager`);
                this.emit('bookmarksExported', { count: this.state.bookmarks.length });
            } catch (error) { console.error(`[${MODULE_ID}] Export failed:`, error); alert('Export failed. Check console for details.'); }
        }

        async importBookmarks() {
            try {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.json'; input.style.display = 'none';
                const handleFile = async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        if (data.bookmarks && Array.isArray(data.bookmarks)) { this.restore(data); return; }
                        if (!Array.isArray(data)) throw new Error('Invalid format');
                        const added = this.mergeBookmarks(data);
                        this.renderBookmarks();
                        if (this.config.enableNotifications && typeof GM_notification === 'function') GM_notification(`Imported ${added} bookmarks`, `📤 Bookmark Manager`);
                        this.emit('bookmarksImported', { count: added });
                    } catch (error) { console.error(`[${MODULE_ID}] Import failed:`, error); alert('Import failed. Invalid file format.'); }
                };
                input.onchange = handleFile;
                document.body.appendChild(input); input.click(); document.body.removeChild(input);
            } catch (error) { console.error(`[${MODULE_ID}] Import failed:`, error); alert('Import failed. Check console for details.'); }
        }

        mergeBookmarks(bookmarks) {
            let added = 0;
            const existingUrls = new Set(this.state.bookmarks.map(b => b.url).filter(Boolean));
            const existingTitles = new Set(this.state.bookmarks.map(b => b.title.toLowerCase()));
            bookmarks.forEach(b => {
                if (b.url && existingUrls.has(b.url)) return;
                if (!b.url && existingTitles.has(b.title.toLowerCase())) return;
                if (b.title && this.addBookmark(b)) {
                    added++;
                    if (b.url) existingUrls.add(b.url);
                    existingTitles.add(b.title.toLowerCase());
                }
            });
            return added;
        }

        exposeAPI() {
            window[`${MODULE_ID}_api`] = { getConfig: () => this.getConfig(), setConfig: cfg => this.setConfig(cfg), init: () => this.init(), destroy: () => this.destroy(), addBookmark: data => this.addBookmark(data), removeBookmark: id => this.removeBookmark(id), getBookmarks: cat => this.getBookmarks(cat), searchBookmarks: q => this.searchBookmarks(q) };
            window[`${MODULE_ID}_instance`] = this;
        }

        destroy() {
            try {
                delete window[`${MODULE_ID}_api`];
                delete window[`${MODULE_ID}_instance`];
                this.cleanup();
                this.state.initialized = false;
                console.log(`[${MODULE_ID}] Destroyed successfully`);
            } catch (error) { console.error(`[${MODULE_ID}] Cleanup failed:`, error); }
        }

        cleanup() {
            try {
                if (this.menuCommands && typeof GM_unregisterMenuCommand === 'function') {
                    this.menuCommands.forEach(cmd => { try { GM_unregisterMenuCommand(cmd); } catch {} });
                }
                this.detachListeners(); this.removeUI();
                if (this.config.autoSave) { this.saveBookmarks(); this.saveConfig(); }
                this.ui = {}; this.state.initialized = false;
                this.emit('moduleDestroyed');
                console.log(`[${MODULE_ID}] Cleanup complete`);
            } catch (error) { console.error(`[${MODULE_ID}] Cleanup failed:`, error); }
        }
    }

    const instance = new BookmarkManager();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => instance.init());
    else instance.init();
    if (typeof window !== 'undefined' && window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
        window.ModuleRegistry.register('003-bookmark-manager', '1.1.0', {
            name: 'Bookmark Manager', version: '1.1.0', dependencies: [], critical: false,
            async init() { await instance.init(); return instance.state.initialized; },
            destroy() { instance.destroy(); },
            cleanup() { instance.cleanup(); },
            onConfigUpdate(settings) { instance.setConfig(settings); },
            getState() { return instance.state; },
            getConfig() { return instance.getConfig(); },
            setConfig(cfg) { return instance.setConfig(cfg); },
            quickCapture: () => instance.quickCapture(),
            getBookmarks: category => instance.getBookmarks(category),
            searchBookmarks: (query, filters) => instance.searchBookmarks(query, filters),
            addBookmark: data => instance.addBookmark(data),
            removeBookmark: id => instance.removeBookmark(id),
            updateBookmark: (id, updates) => instance.updateBookmark(id, updates),
            getStats: () => instance.getStats(),
            on: (event, callback) => instance.on(event, callback),
            off: (event, callback) => instance.off(event, callback)
        });
    }
    window.addEventListener('beforeunload', () => instance.destroy());
})();