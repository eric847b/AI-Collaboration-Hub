// ==UserScript==
// @name         Security Assistant
// @namespace    http://tampermonkey.net/
// @version      2026.03.28.3
// @description  Intelligent security monitoring and threat detection
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const MODULE_VERSION = '2026.03.28.3';
  const STORAGE_KEY = 'ai_security_assistant_settings';
  const MAX_ALERTS = 50;
  const MAX_HISTORY_ITEMS = 100;
  const MODULE_NAME = 'AI Security Assistant';
  const LEGACY_API_NAME = 'AISecurityEnhancerAPI';
  const LEGACY_MODULE_NAME = 'AISecurityEnhancerModule';

  function mergeApiSurface(name, additions) {
    const existing = window[name] && typeof window[name] === 'object' ? window[name] : {};
    window[name] = { ...existing, ...additions };
    return window[name];
  }

  class AISecurityAssistantModule {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = {
        enabled: true,
        realTimeMonitoring: true,
        showSecurityUI: true,
        darkMode: true,
        autoBlock: true,
        alertNotifications: true,
        scanFrequency: 60000
      };
      this._observer = null;
      this._menusRegistered = false;
      this._monitoringInterval = null;
      this._alerts = [];
      this._securityHistory = [];
      this._activeThreats = [];
      this.api = {
        scanPage: () => this.scanPage(),
        performSecurityScan: (options) => this.performSecurityScan(options),
        scanForThreats: (text) => this.scanForThreats(text),
        filterSensitiveData: (text) => this.filterSensitiveData(text),
        getSecurityStatus: () => this.getSecurityStatus(),
        blockThreat: (id) => this.blockThreat(id),
        getAlerts: () => this.getAlerts(),
        getSecurityHistory: () => this.getSecurityHistory(),
        toggleProtection: () => this.toggleProtection(),
        toggleSecurityUI: () => this.toggleSecurityUI(),
        clearAlerts: () => this.clearAlerts(),
        viewAlertDetails: (id) => this.viewAlertDetails(id),
        setConfig: (settings) => this.setConfig(settings),
        getConfig: () => this.getConfig()
      };
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig(MODULE_NAME) };
        }

        window.AISecurityAssistantAPI = this.api;
        mergeApiSurface(LEGACY_API_NAME, this.api);
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachSecurityUI();
        this.startSecurityMonitoring();
        console.log(`[${MODULE_NAME}] Initialized`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Init error:`, err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.attachSecurityUI();
        this.startSecurityMonitoring();
      } else {
        this.stopSecurityMonitoring();
        this.removeSecurityUI();
      }

      console.log(`[${MODULE_NAME}] Config updated:`, this.config);
    }

    ensureStyles() {
      if (!document.head || document.getElementById('ai-security-assistant-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'ai-security-assistant-styles';
      style.textContent = `
        .security-assistant-container {
          position: fixed;
          top: 1400px;
          right: 20px;
          width: 480px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          padding: 20px;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          z-index: 99998;
          backdrop-filter: blur(10px);
          display: none;
        }

        .security-assistant-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(239, 68, 68, 0.3);
          padding-bottom: 10px;
        }

        .security-assistant-title {
          font-size: 16px;
          font-weight: 600;
          color: white;
        }

        .security-assistant-toggle {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .security-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 6px;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse 2s infinite;
        }

        .status-indicator.secure {
          background: #22c55e;
          animation: none;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .status-text {
          font-size: 12px;
          color: #94a3b8;
        }

        .status-text.secure {
          color: #22c55e;
        }

        .security-alerts {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 15px;
        }

        .alert-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 6px;
          margin-bottom: 8px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          transition: all 0.2s;
        }

        .alert-item:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .alert-item.secure {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .alert-item.secure:hover {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.5);
        }

        .alert-icon {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .alert-icon.threat {
          background: #ef4444;
        }

        .alert-icon.secure {
          background: #22c55e;
        }

        .alert-info {
          flex: 1;
        }

        .alert-title {
          font-size: 13px;
          color: white;
          font-weight: 500;
        }

        .alert-description {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .alert-actions {
          display: flex;
          gap: 5px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .alert-item:hover .alert-actions {
          opacity: 1;
        }

        .alert-btn {
          width: 20px;
          height: 20px;
          border: none;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          transition: all 0.2s;
        }

        .alert-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .alert-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .alert-btn.success:hover {
          background: rgba(34, 197, 94, 0.2);
        }

        .security-actions-bottom {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .security-btn-large {
          padding: 8px 16px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          background: rgba(239, 68, 68, 0.1);
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .security-btn-large:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .security-btn-large.active {
          background: #ef4444;
          border-color: #ef4444;
        }

        .security-btn-large.success {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .security-btn-large.success:hover {
          background: rgba(34, 197, 94, 0.2);
        }

        .security-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 15px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: white;
        }

        .stat-label {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .threat-level {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 6px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          margin-bottom: 10px;
        }

        .threat-level.secure {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .threat-level.critical {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .threat-level.high {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.3);
        }

        .threat-level.medium {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .threat-level.low {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .threat-level-icon {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          color: white;
        }

        .threat-level-icon.threat {
          background: #ef4444;
        }

        .threat-level-icon.secure {
          background: #22c55e;
        }

        .threat-level-icon.critical {
          background: #ef4444;
        }

        .threat-level-icon.high {
          background: #f59e0b;
        }

        .threat-level-icon.medium {
          background: #3b82f6;
        }

        .threat-level-icon.low {
          background: #22c55e;
        }

        .threat-level-text {
          font-size: 11px;
          font-weight: 600;
          color: #ef4444;
        }

        .threat-level-text.secure {
          color: #22c55e;
        }

        .threat-level-text.critical {
          color: #ef4444;
        }

        .threat-level-text.high {
          color: #f59e0b;
        }

        .threat-level-text.medium {
          color: #3b82f6;
        }

        .threat-level-text.low {
          color: #22c55e;
        }
      `;

      document.head.appendChild(style);
    }

    attachSecurityUI() {
      if (!document.body || document.getElementById('security-assistant-container')) {
        return;
      }

      const container = document.createElement('div');
      container.id = 'security-assistant-container';
      container.innerHTML = `
        <div class="security-assistant-container">
          <div class="security-assistant-header">
            <span class="security-assistant-title">AI Security Assistant</span>
            <button class="security-assistant-toggle" onclick="window.AISecurityAssistantAPI.toggleSecurityUI()">✕</button>
          </div>

          <div class="security-status">
            <div class="status-indicator"></div>
            <span class="status-text">Security monitoring active</span>
          </div>

          <div class="threat-level">
            <div class="threat-level-icon threat">⚠️</div>
            <div>
              <div class="threat-level-text">Threat Level: Medium</div>
              <div class="threat-level-text" style="font-size: 10px; color: #94a3b8;">Scanning for threats...</div>
            </div>
          </div>

          <div class="security-alerts" id="security-alerts">
            <div class="alert-item">
              <div class="alert-icon threat">⚠️</div>
              <div class="alert-info">
                <div class="alert-title">Security Assistant Active</div>
                <div class="alert-description">Real-time threat monitoring enabled</div>
              </div>
              <div class="alert-actions">
                <button class="alert-btn" title="Details">🔍</button>
                <button class="alert-btn success" title="Dismiss">✅</button>
              </div>
            </div>
          </div>

          <div class="security-stats">
            <div class="stat-item">
              <span class="stat-value" id="total-alerts">0</span>
              <span class="stat-label">Total Alerts</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="active-threats">0</span>
              <span class="stat-label">Active Threats</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="blocked-threats">0</span>
              <span class="stat-label">Blocked</span>
            </div>
          </div>

          <div class="security-actions-bottom">
            <button class="security-btn-large" id="scan-page-btn">Scan Page</button>
            <button class="security-btn-large active" id="quick-scan-btn">Quick Scan</button>
            <button class="security-btn-large danger" id="clear-alerts-btn">Clear Alerts</button>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      document.getElementById('scan-page-btn').addEventListener('click', () => {
        this.scanPage();
      });

      document.getElementById('quick-scan-btn').addEventListener('click', () => {
        this.quickScan();
      });

      document.getElementById('clear-alerts-btn').addEventListener('click', () => {
        this.clearAlerts();
      });
    }

    startSecurityMonitoring() {
      if (this._monitoringInterval) {
        clearInterval(this._monitoringInterval);
      }

      this._monitoringInterval = setInterval(() => {
        this.monitorPage();
      }, this.config.scanFrequency);
    }

    stopSecurityMonitoring() {
      if (this._monitoringInterval) {
        clearInterval(this._monitoringInterval);
        this._monitoringInterval = null;
      }
    }

    scanPage(options = {}) {
      const { includeContentScan = false } = options;
      const alerts = [];

      // Simple threat detection logic
      if (document.location.href.includes('http://')) {
        alerts.push({
          id: Date.now().toString(),
          type: 'insecure-connection',
          title: 'Insecure HTTP Connection',
          description: 'Page is loaded over HTTP instead of HTTPS',
          severity: 'high',
          timestamp: Date.now()
        });
      }

      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach(script => {
        if (script.src.includes('untrusted.com')) {
          alerts.push({
            id: Date.now().toString(),
            type: 'suspicious-script',
            title: 'Suspicious Script Detected',
            description: `Script from untrusted domain: ${script.src}`,
            severity: 'medium',
            timestamp: Date.now()
          });
        }
      });

      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.src.includes('unknown.net')) {
          alerts.push({
            id: Date.now().toString(),
            type: 'suspicious-iframe',
            title: 'Suspicious IFrame Detected',
            description: `IFrame from unknown domain: ${iframe.src}`,
            severity: 'medium',
            timestamp: Date.now()
          });
        }
      });

      if (includeContentScan) {
        const pageText = document.body ? (document.body.innerText || document.body.textContent || '') : '';
        const { threats, sanitizedText } = this.scanForThreats(pageText);

        threats.forEach((threat, index) => {
          alerts.push({
            id: `${Date.now()}-content-${index}`,
            type: 'content-threat',
            title: 'Content Threat Detected',
            description: threat,
            severity: /sensitive|privilege|malicious|phishing/i.test(threat) ? 'high' : 'medium',
            timestamp: Date.now(),
            sanitizedPreview: sanitizedText.slice(0, 200)
          });
        });
      }

      this._alerts = [...alerts, ...this._alerts].slice(0, MAX_ALERTS);
      this._activeThreats = this._alerts
        .filter((alert) => alert.severity === 'high' && !alert.blocked)
        .map((alert) => alert.id);
      this._securityHistory.push({
        action: includeContentScan ? 'full-scan' : 'scan',
        alertCount: alerts.length,
        timestamp: Date.now()
      });
      if (this._securityHistory.length > MAX_HISTORY_ITEMS) {
        this._securityHistory.shift();
      }
      this.renderAlerts();
      this.updateStats();

      return alerts;
    }

    quickScan() {
      const alerts = this.performSecurityScan({ notify: true, includeContentScan: true });
      return alerts;
    }

    performSecurityScan(options = {}) {
      const { notify = true, includeContentScan = true } = options;
      const alerts = this.scanPage({ includeContentScan });

      if (notify) {
        GM_notification({
          text: `Security scan complete: ${alerts.length} issues found`,
          title: 'AI Security Assistant',
          timeout: 5000
        });
      }

      return alerts;
    }

    scanForThreats(text) {
      const threats = [];
      const sanitizedText = String(text ?? '').replace(/\u0000/g, '').trim();

      if (/password|secret|token|api[_-]?key/i.test(sanitizedText)) {
        threats.push('Sensitive data detected');
      }

      if (/(admin|root|sudo|elevated privileges)/i.test(sanitizedText)) {
        threats.push('Privilege escalation attempt');
      }

      if (/(malware|virus|trojan|ransomware)/i.test(sanitizedText)) {
        threats.push('Malicious content detected');
      }

      if (/(phishing|scam|credential harvesting)/i.test(sanitizedText)) {
        threats.push('Phishing attempt detected');
      }

      if (sanitizedText.length > 5000) {
        threats.push('Excessive data size');
      }

      return {
        threats,
        sanitizedText: this.filterSensitiveData(sanitizedText)
      };
    }

    filterSensitiveData(text) {
      return String(text ?? '')
        .replace(/password\s*=\s*['"]?[^'"\s]+['"]?/gi, 'password=***')
        .replace(/secret\s*=\s*['"]?[^'"\s]+['"]?/gi, 'secret=***')
        .replace(/token\s*=\s*['"]?[^'"\s]+['"]?/gi, 'token=***')
        .replace(/key\s*=\s*['"]?[^'"\s]+['"]?/gi, 'key=***')
        .replace(/(password|secret|token|key):\s*['"]?[^'"\s]+['"]?/gi, '$1: ***');
    }

    getSecurityStatus() {
      const activeThreats = this._alerts.filter((alert) => alert.severity === 'high' && !alert.blocked).length;
      const protectedMessages = this._securityHistory.filter((entry) => entry.action === 'block').length;
      const filteredContent = this._alerts.filter((alert) => alert.type === 'content-threat').length;
      const lastScanEntry = [...this._securityHistory].reverse().find((entry) => /scan/.test(entry.action));

      return {
        activeThreats,
        protectedMessages,
        filteredContent,
        encryptionStatus: this.config.autoBlock ? 'active' : 'monitor-only',
        lastScan: lastScanEntry ? lastScanEntry.timestamp : null,
        totalAlerts: this._alerts.length
      };
    }

    monitorPage() {
      if (!this.config.realTimeMonitoring) {
        return;
      }

      const newAlerts = this.scanPage({ includeContentScan: true });
      if (newAlerts.length > 0 && this.config.alertNotifications) {
        newAlerts.forEach(alert => {
          GM_notification({
            text: alert.title,
            title: 'Security Alert',
            timeout: 8000
          });
        });
      }

      if (newAlerts.length > 0 && this.config.autoBlock) {
        newAlerts.forEach(alert => {
          this.blockThreat(alert.id);
        });
      }
    }

    blockThreat(id) {
      const alert = this._alerts.find(a => a.id === id);
      if (!alert) {
        return false;
      }

      // Simple blocking logic
      if (alert.type === 'suspicious-script') {
        const script = document.querySelector(`script[src*="${alert.description.split(': ')[1]}"]`);
        if (script) {
          script.remove();
        }
      }

      if (alert.type === 'suspicious-iframe') {
        const iframe = document.querySelector(`iframe[src*="${alert.description.split(': ')[1]}"]`);
        if (iframe) {
          iframe.remove();
        }
      }

      alert.blocked = true;
      alert.blockedAt = Date.now();
      this._activeThreats = this._activeThreats.filter(tid => tid !== id);
      this._securityHistory.push({
        action: 'block',
        alert: alert,
        timestamp: Date.now()
      });
      if (this._securityHistory.length > MAX_HISTORY_ITEMS) {
        this._securityHistory.shift();
      }
      this.renderAlerts();
      this.updateStats();

      return true;
    }

    getAlerts() {
      return [...this._alerts];
    }

    getSecurityHistory() {
      return [...this._securityHistory];
    }

    renderAlerts(alertsToShow = null) {
      const securityAlerts = document.getElementById('security-alerts');
      if (!securityAlerts) {
        return;
      }

      const alerts = alertsToShow || this._alerts;
      securityAlerts.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.blocked ? 'secure' : ''} ${alert.severity === 'high' ? 'critical' : ''} ${alert.severity === 'medium' ? 'high' : ''} ${alert.severity === 'low' ? 'medium' : ''}">
          <div class="alert-icon ${alert.severity === 'high' ? 'threat' : ''} ${alert.severity === 'medium' ? 'threat' : ''} ${alert.severity === 'low' ? 'threat' : ''}">${this.getAlertIcon(alert.severity)}</div>
          <div class="alert-info">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-description">${alert.description}${alert.blocked ? ' (blocked)' : ''}</div>
          </div>
          <div class="alert-actions">
            <button class="alert-btn" title="Details" onclick="window.AISecurityAssistantAPI.viewAlertDetails('${alert.id}')">🔍</button>
            <button class="alert-btn ${alert.severity === 'high' ? 'danger' : ''} ${alert.severity === 'medium' ? 'danger' : ''} ${alert.severity === 'low' ? 'success' : ''}" title="${alert.severity === 'high' ? 'Block' : 'Dismiss'}" onclick="window.AISecurityAssistantAPI.blockThreat('${alert.id}')">${alert.severity === 'high' ? '🛑' : '✅'}</button>
          </div>
        </div>
      `).join('');
    }

    getAlertIcon(severity) {
      const icons = {
        high: '⚠️',
        medium: '⚠️',
        low: '⚠️'
      };
      return icons[severity] || '⚠️';
    }

    updateStats() {
      const totalAlerts = this._alerts.length;
      const activeThreats = this._alerts.filter(a => a.severity === 'high' && !a.blocked).length;
      const blockedThreats = this._securityHistory.filter(h => h.action === 'block').length;

      document.getElementById('total-alerts').textContent = totalAlerts;
      document.getElementById('active-threats').textContent = activeThreats;
      document.getElementById('blocked-threats').textContent = blockedThreats;

      // Update threat level
      let threatLevel = 'low';
      if (activeThreats > 5) threatLevel = 'high';
      if (activeThreats > 10) threatLevel = 'critical';

      const threatLevelElement = document.querySelector('.threat-level');
      const threatLevelText = document.querySelector('.threat-level-text');
      if (threatLevelElement) {
        threatLevelElement.className = `threat-level ${threatLevel}`;
      }
      if (threatLevelText) {
        threatLevelText.className = `threat-level-text ${threatLevel}`;
        threatLevelText.textContent = `Threat Level: ${threatLevel.charAt(0).toUpperCase() + threatLevel.slice(1)}`;
      }
    }

    viewAlertDetails(id) {
      const alertEntry = this._alerts.find((entry) => entry.id === id);
      if (!alertEntry) {
        return null;
      }

      window.alert(
        [
          `Title: ${alertEntry.title}`,
          `Severity: ${alertEntry.severity}`,
          `Type: ${alertEntry.type}`,
          `Blocked: ${alertEntry.blocked ? 'Yes' : 'No'}`,
          `Description: ${alertEntry.description}`
        ].join('\n')
      );

      return alertEntry;
    }

    clearAlerts() {
      if (confirm('Are you sure you want to clear all alerts?')) {
        this._alerts = [];
        this._activeThreats = [];
        this._securityHistory.push({
          action: 'clear-alerts',
          timestamp: Date.now()
        });
        if (this._securityHistory.length > MAX_HISTORY_ITEMS) {
          this._securityHistory.shift();
        }
        this.renderAlerts();
        this.updateStats();
      }
    }

    toggleProtection() {
      return this.toggleSecurityUI();
    }

    setConfig(settings) {
      Object.assign(this.config, settings);
      this.onConfigUpdate(settings);
    }

    getConfig() {
      return { ...this.config };
    }

    registerMenuCommands() {
      if (this._menusRegistered || typeof GM_registerMenuCommand !== 'function') {
        return;
      }

      GM_registerMenuCommand('AI Security Assistant: Toggle', () => {
        this.toggleSecurityUI();
      });

      GM_registerMenuCommand('AI Security Assistant: Scan Page', () => {
        this.scanPage();
      });

      GM_registerMenuCommand('AI Security Assistant: Quick Scan', () => {
        this.quickScan();
      });

      GM_registerMenuCommand('AI Security Assistant: Settings', () => {
        alert(`AI Security Assistant\n\nEnabled: ${this.config.enabled}\nReal-time monitoring: ${this.config.realTimeMonitoring}\nShow UI: ${this.config.showSecurityUI}\nAuto-block: ${this.config.autoBlock}\nAlert notifications: ${this.config.alertNotifications}\nScan frequency: ${this.config.scanFrequency}ms`);
      });

      this._menusRegistered = true;
    }

    removeSecurityUI() {
      const container = document.getElementById('security-assistant-container');
      if (container) {
        container.remove();
      }
    }

    toggleSecurityUI() {
      const container = document.getElementById('security-assistant-container');
      if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
      }
    }

    execute() {
      if (this.config.enabled) {
        this.attachSecurityUI();
        this.startSecurityMonitoring();
      }
      console.log(`[${MODULE_NAME}] Execute called`);
    }

    destroy() {
      try {
        this.stopSecurityMonitoring();
        this.removeSecurityUI();
        console.log(`[${MODULE_NAME}] Cleanup complete`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Cleanup error:`, err);
      }
    }
  }

  const instance = new AISecurityAssistantModule();
  window.AISecurityAssistantModule = instance;
  window[LEGACY_MODULE_NAME] = instance;
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window.AISecurityAssistantAPI = instance.api;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error(`[${MODULE_NAME}] fallback error`, err);
    }
  }
})();
