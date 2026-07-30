// ==UserScript==
// @name         Collaboration Hub
// @namespace    AI-Chat-Userscript-Studio
// @version      1.1.0
// @description  Multi-user collaboration hub with real-time sync, presence detection, and shared state management
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
 * AI Chat Userscript Studio - Collaboration Hub Module
 *
 * Provides real-time collaboration features:
 * - BroadcastChannel-based tab sync for shared state
 * - Presence detection across tabs
 * - Shared configuration management
 * - Activity broadcasting and event relay
 * - Conflict resolution for concurrent edits
 */

(function() {
    'use strict';

    const MODULE_ID = '44-collaboration-hub';
    const MODULE_NAME = 'Collaboration Hub';
    const MODULE_VERSION = '1.1.0';
    const CHANNEL_NAME = 'ai-chat-collaboration';
    const PRESENCE_TIMEOUT = 30000;
    const MAX_PEERS = 20;

    class CollaborationHub {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.channel = null;
            this.peers = new Map();
            this.presenceInterval = null;
            this.eventHandlers = new Map();
            this.sessionId = this.generateSessionId();
            this.config = {
                enabled: true,
                syncConfig: true,
                broadcastActivity: true,
                showPresence: true,
                conflictResolution: 'last-write-wins',
                peerTimeout: PRESENCE_TIMEOUT
            };
            this.state = {
                initialized: false,
                peers: 0,
                messagesSent: 0,
                messagesReceived: 0,
                conflictsResolved: 0
            };
        }

        /**
         * Initialize the collaboration hub
         * @returns {Promise<boolean>} Success status
         */
        async init() {
            try {
                console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);

                this.loadConfig();

                if (!this.checkDependencies()) {
                    console.warn(`[${MODULE_ID}] Dependencies not satisfied`);
                    return false;
                }

                if (!this.config.enabled) {
                    console.log(`[${MODULE_ID}] Module disabled in config`);
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

        /**
         * Check if BroadcastChannel API is available
         * @returns {boolean}
         */
        checkDependencies() {
            if (typeof BroadcastChannel === 'undefined') {
                console.warn(`[${MODULE_ID}] BroadcastChannel API not available`);
                return false;
            }
            return true;
        }

        /**
         * Setup collaboration channel and presence detection
         */
        setup() {
            try {
                this.channel = new BroadcastChannel(CHANNEL_NAME);
                this.channel.onmessage = (event) => this.handleMessage(event);

                // Broadcast our presence
                this.broadcastPresence();

                // Start presence monitoring
                this.presenceInterval = setInterval(() => {
                    this.cleanStalePeers();
                    this.broadcastPresence();
                }, 10000);

                // Listen for storage events from other tabs
                window.addEventListener('storage', (event) => {
                    if (event.key && event.key.startsWith(`${MODULE_ID}-`)) {
                        this.handleStorageEvent(event);
                    }
                });

                console.log(`[${MODULE_ID}] Collaboration channel established`);
            } catch (error) {
                console.error(`[${MODULE_ID}] Setup failed:`, error);
            }
        }

        /**
         * Generate a unique session ID for this tab
         * @returns {string}
         */
        generateSessionId() {
            return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${navigator.userAgent?.slice(0, 20) || 'unknown'}`;
        }

        /**
         * Broadcast presence information to other tabs
         */
        broadcastPresence() {
            if (!this.channel) return;

            const presence = {
                type: 'presence',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                userAgent: navigator.userAgent?.slice(0, 50) || 'unknown',
                url: window.location.href,
                title: document.title
            };

            try {
                this.channel.postMessage(presence);
                this.state.messagesSent++;
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to broadcast presence:`, error);
            }
        }

        /**
         * Handle incoming messages from the BroadcastChannel
         * @param {MessageEvent} event
         */
        handleMessage(event) {
            try {
                const data = event.data;
                if (!data || !data.type) return;

                this.state.messagesReceived++;

                switch (data.type) {
                    case 'presence':
                        this.handlePresence(data);
                        break;
                    case 'config-update':
                        this.handleConfigUpdate(data);
                        break;
                    case 'activity':
                        this.handleActivity(data);
                        break;
                    case 'event':
                        this.forwardEvent(data);
                        break;
                    case 'sync-request':
                        this.handleSyncRequest(data);
                        break;
                    case 'sync-response':
                        this.handleSyncResponse(data);
                        break;
                    default:
                        console.debug(`[${MODULE_ID}] Unknown message type: ${data.type}`);
                }
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to handle message:`, error);
            }
        }

        /**
         * Handle presence updates from peers
         * @param {Object} data
         */
        handlePresence(data) {
            if (data.sessionId === this.sessionId) return;

            this.peers.set(data.sessionId, {
                sessionId: data.sessionId,
                lastSeen: Date.now(),
                userAgent: data.userAgent,
                url: data.url,
                title: data.title
            });

            // Limit peer count
            if (this.peers.size > MAX_PEERS) {
                const oldest = Array.from(this.peers.entries())
                    .sort(([, a], [, b]) => a.lastSeen - b.lastSeen)[0];
                if (oldest) this.peers.delete(oldest[0]);
            }

            this.state.peers = this.peers.size;
            this.notifyListeners('peers-updated', this.getPeers());
        }

        /**
         * Handle configuration updates from peers
         * @param {Object} data
         */
        handleConfigUpdate(data) {
            if (data.sessionId === this.sessionId) return;

            if (this.config.conflictResolution === 'last-write-wins') {
                if (data.timestamp > (this._lastConfigTimestamp || 0)) {
                    this._lastConfigTimestamp = data.timestamp;
                    if (data.config) {
                        this.config = { ...this.config, ...data.config };
                        this.saveConfig();
                        this.notifyListeners('config-updated', this.config);
                    }
                }
            }
        }

        /**
         * Handle activity broadcasts from peers
         * @param {Object} data
         */
        handleActivity(data) {
            if (data.sessionId === this.sessionId) return;

            this.notifyListeners('activity', {
                sessionId: data.sessionId,
                activity: data.activity,
                timestamp: data.timestamp,
                peer: this.peers.get(data.sessionId)
            });
        }

        /**
         * Forward custom events to local listeners
         * @param {Object} data
         */
        forwardEvent(data) {
            if (data.sessionId === this.sessionId) return;

            this.notifyListeners('event', {
                sessionId: data.sessionId,
                event: data.event,
                payload: data.payload,
                timestamp: data.timestamp
            });
        }

        /**
         * Handle sync requests from peers
         * @param {Object} data
         */
        handleSyncRequest(data) {
            if (data.sessionId === this.sessionId) return;

            if (!this.channel) return;

            this.channel.postMessage({
                type: 'sync-response',
                sessionId: this.sessionId,
                targetSession: data.sessionId,
                timestamp: Date.now(),
                config: this.config,
                state: {
                    peers: this.state.peers,
                    messagesSent: this.state.messagesSent,
                    messagesReceived: this.state.messagesReceived
                }
            });
        }

        /**
         * Handle sync responses from peers
         * @param {Object} data
         */
        handleSyncResponse(data) {
            if (data.targetSession !== this.sessionId) return;

            this.notifyListeners('sync-complete', {
                peer: this.peers.get(data.sessionId),
                config: data.config,
                state: data.state,
                timestamp: data.timestamp
            });
        }

        /**
         * Handle storage events for cross-tab config sync
         * @param {StorageEvent} event
         */
        handleStorageEvent(event) {
            if (event.key === `${MODULE_ID}-config`) {
                try {
                    const newConfig = JSON.parse(event.newValue);
                    if (newConfig && this.config.conflictResolution === 'last-write-wins') {
                        this.config = { ...this.config, ...newConfig };
                        this.notifyListeners('config-updated', this.config);
                    }
                } catch {
                    // Ignore parse errors
                }
            }
        }

        /**
         * Remove peers that haven't been seen recently
         */
        cleanStalePeers() {
            const now = Date.now();
            let removed = 0;

            for (const [sessionId, peer] of this.peers.entries()) {
                if (now - peer.lastSeen > this.config.peerTimeout) {
                    this.peers.delete(sessionId);
                    removed++;
                }
            }

            if (removed > 0) {
                this.state.peers = this.peers.size;
                this.notifyListeners('peers-updated', this.getPeers());
            }
        }

        /**
         * Broadcast an activity to all peers
         * @param {string} activity
         */
        broadcastActivity(activity) {
            if (!this.channel || !this.config.broadcastActivity) return;

            try {
                this.channel.postMessage({
                    type: 'activity',
                    sessionId: this.sessionId,
                    activity: activity,
                    timestamp: Date.now()
                });
                this.state.messagesSent++;
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to broadcast activity:`, error);
            }
        }

        /**
         * Broadcast a custom event to all peers
         * @param {string} eventName
         * @param {*} payload
         */
        broadcastEvent(eventName, payload) {
            if (!this.channel) return;

            try {
                this.channel.postMessage({
                    type: 'event',
                    sessionId: this.sessionId,
                    event: eventName,
                    payload: payload,
                    timestamp: Date.now()
                });
                this.state.messagesSent++;
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to broadcast event:`, error);
            }
        }

        /**
         * Request sync from all peers
         */
        requestSync() {
            if (!this.channel) return;

            try {
                this.channel.postMessage({
                    type: 'sync-request',
                    sessionId: this.sessionId,
                    timestamp: Date.now()
                });
                this.state.messagesSent++;
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to request sync:`, error);
            }
        }

        /**
         * Get list of active peers
         * @returns {Array}
         */
        getPeers() {
            return Array.from(this.peers.values()).map(peer => ({
                sessionId: peer.sessionId,
                lastSeen: peer.lastSeen,
                userAgent: peer.userAgent,
                url: peer.url,
                title: peer.title,
                isActive: (Date.now() - peer.lastSeen) < this.config.peerTimeout
            }));
        }

        /**
         * Register a listener for hub events
         * @param {string} event
         * @param {Function} handler
         */
        on(event, handler) {
            if (!this.eventHandlers.has(event)) {
                this.eventHandlers.set(event, new Set());
            }
            this.eventHandlers.get(event).add(handler);

            // Return unsubscribe function
            return () => {
                const handlers = this.eventHandlers.get(event);
                if (handlers) handlers.delete(handler);
            };
        }

        /**
         * Notify all listeners of an event
         * @param {string} event
         * @param {*} data
         */
        notifyListeners(event, data) {
            const handlers = this.eventHandlers.get(event);
            if (handlers) {
                handlers.forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.warn(`[${MODULE_ID}] Listener error for ${event}:`, error);
                    }
                });
            }
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
         * Update configuration and broadcast to peers
         * @param {Object} newConfig
         */
        setConfig(newConfig) {
            const oldConfig = { ...this.config };
            this.config = { ...this.config, ...newConfig };
            this.saveConfig();
            this._lastConfigTimestamp = Date.now();

            // Broadcast config change to peers
            if (this.channel) {
                try {
                    this.channel.postMessage({
                        type: 'config-update',
                        sessionId: this.sessionId,
                        config: newConfig,
                        timestamp: this._lastConfigTimestamp
                    });
                    this.state.messagesSent++;
                } catch (error) {
                    console.warn(`[${MODULE_ID}] Failed to broadcast config:`, error);
                }
            }

            this.onConfigUpdate(newConfig, oldConfig);
        }

        /**
         * Get current configuration
         * @returns {Object}
         */
        getConfig() {
            return { ...this.config };
        }

        /**
         * Called when configuration is updated
         * @param {Object} newConfig
         * @param {Object} oldConfig
         */
        onConfigUpdate(newConfig, oldConfig) {
            console.log(`[${MODULE_ID}] Config updated:`, newConfig);
            this.notifyListeners('config-updated', { newConfig, oldConfig });
        }

        /**
         * Expose public API to global scope
         */
        exposeAPI() {
            window[`${MODULE_ID}_api`] = {
                getConfig: () => this.getConfig(),
                setConfig: (cfg) => this.setConfig(cfg),
                init: () => this.init(),
                destroy: () => this.destroy(),
                getPeers: () => this.getPeers(),
                broadcastActivity: (activity) => this.broadcastActivity(activity),
                broadcastEvent: (event, payload) => this.broadcastEvent(event, payload),
                requestSync: () => this.requestSync(),
                on: (event, handler) => this.on(event, handler),
                getState: () => ({ ...this.state })
            };

            window[`${MODULE_ID}_instance`] = this;
        }

        /**
         * Clean up module resources
         */
        destroy() {
            try {
                if (this.presenceInterval) {
                    clearInterval(this.presenceInterval);
                    this.presenceInterval = null;
                }

                if (this.channel) {
                    this.channel.close();
                    this.channel = null;
                }

                this.peers.clear();
                this.eventHandlers.clear();

                delete window[`${MODULE_ID}_api`];
                delete window[`${MODULE_ID}_instance`];

                this.state.initialized = false;
                console.log(`[${MODULE_ID}] Destroyed successfully`);
            } catch (error) {
                console.error(`[${MODULE_ID}] Cleanup failed:`, error);
            }
        }

        /**
         * Cleanup resources
         */
        cleanup() {
            this.destroy();
        }
    }

    // Initialize module
    const instance = new CollaborationHub();

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