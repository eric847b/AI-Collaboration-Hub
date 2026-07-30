// ==UserScript==
// @name         Analytics Dashboard
// @namespace    http://tampermonkey.net/
// @version      2026.03.29.1
// @description  Comprehensive analytics dashboard for AI interactions
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

  const MODULE_VERSION = '2026.03.29.1';
  const STORAGE_KEY = 'ai_analytics_dashboard_settings';
  const MAX_HISTORY_ITEMS = 500;
  const MODULE_NAME = 'AI Analytics Dashboard';
  const STYLE_ID = 'ai-analytics-dashboard-classic-styles';
  const CONTAINER_ID = 'analytics-dashboard-classic-container';
  const PRIMARY_API_NAME = 'AIAnalyticsDashboardClassicAPI';
  const SHARED_API_NAME = 'AIAnalyticsDashboardAPI';
  const MODULE_INSTANCE_NAME = 'AIAnalyticsDashboardClassicModule';
  const LEGACY_API_NAME = 'AIPerformanceMonitorAPI';
  const LEGACY_MODULE_NAME = 'AIPerformanceMonitorModule';

  function createEmptyAnalyticsData() {
    return {
      conversations: [],
      responseTimes: [],
      tokenUsage: [],
      userActivity: [],
      systemPerformance: []
    };
  }

  function createEmptyAnalyticsStats() {
    return {
      optimizedRequests: 0,
      cachedResponses: 0,
      dataSaved: 0,
      compressionRatio: 0,
      lastOptimization: null
    };
  }

  function createEmptyPerformanceMetrics() {
    return {
      responseTimes: [],
      tokenCounts: [],
      latency: [],
      errors: 0,
      successCount: 0,
      totalRequests: 0
    };
  }

  function mergeApiSurface(name, additions) {
    const existing = window[name] && typeof window[name] === 'object' ? window[name] : {};
    window[name] = { ...existing, ...additions };
    return window[name];
  }

  class AIAnalyticsDashboardModule {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = {
        enabled: true,
        autoRefresh: true,
        refreshRate: 10000,
        showCharts: true,
        exportData: true,
        darkMode: true
      };
      this._observer = null;
      this._menusRegistered = false;
      this._monitoringInterval = null;
      this._analyticsData = createEmptyAnalyticsData();
      this._charts = {};
      this._cache = {};
      this._stats = createEmptyAnalyticsStats();
      this._performanceMetrics = createEmptyPerformanceMetrics();
      this.api = {
        getAnalytics: () => this.getAnalytics(),
        exportData: () => this.exportData(),
        clearData: () => this.clearData(),
        toggleDashboard: () => this.toggleDashboard(),
        getMetrics: () => this.getMetrics(),
        resetMetrics: () => this.resetMetrics(),
        toggleMetrics: () => this.toggleMetrics(),
        recordResponse: (time, success, tokens, metadata) => this.recordResponse(time, success, tokens, metadata),
        recordConversation: (data) => this.recordConversation(data),
        recordResponseTime: (time) => this.recordResponseTime(time),
        recordTokenUsage: (tokens) => this.recordTokenUsage(tokens),
        recordUserActivity: (activity) => this.recordUserActivity(activity),
        recordSystemPerformance: (performance) => this.recordSystemPerformance(performance),
        setConfig: (settings) => this.setConfig(settings),
        getConfig: () => this.getConfig()
      };
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig(MODULE_NAME) };
        }

        window[PRIMARY_API_NAME] = this.api;
        mergeApiSurface(SHARED_API_NAME, this.api);
        mergeApiSurface(LEGACY_API_NAME, this.api);
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachDashboardUI();
        this.startAnalyticsMonitoring();
        console.log(`[${MODULE_NAME}] Initialized`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Init error:`, err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.startAnalyticsMonitoring();
      } else {
        this.stopAnalyticsMonitoring();
      }

      console.log(`[${MODULE_NAME}] Config updated:`, this.config);
    }

    ensureStyles() {
      if (!document.head || document.getElementById(STYLE_ID)) {
        return;
      }

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .analytics-dashboard-container {
          position: fixed;
          top: 400px;
          right: 20px;
          width: 400px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 20px;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          z-index: 99998;
          backdrop-filter: blur(10px);
          display: none;
        }

        .analytics-dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding-bottom: 10px;
        }

        .analytics-dashboard-title {
          font-size: 16px;
          font-weight: 600;
          color: white;
        }

        .analytics-dashboard-toggle {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .analytics-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
        }

        .analytics-tab {
          padding: 8px 16px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .analytics-tab.active {
          background: rgba(59, 130, 246, 0.2);
          color: white;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .analytics-content {
          display: none;
        }

        .analytics-content.active {
          display: block;
        }

        .analytics-chart {
          height: 150px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 15px;
          padding: 10px;
          overflow: hidden;
        }

        .chart-placeholder {
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
          padding: 20px;
        }

        .analytics-metrics {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }

        .metric-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .metric-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }

        .metric-label {
          font-size: 11px;
          color: #94a3b8;
        }

        .metric-value {
          font-size: 13px;
          font-weight: 600;
          color: white;
        }

        .metric-success {
          color: #22c55e;
        }

        .metric-warning {
          color: #f59e0b;
        }

        .metric-danger {
          color: #ef4444;
        }

        .analytics-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .analytics-btn {
          padding: 6px 12px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          background: rgba(59, 130, 246, 0.1);
          color: white;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .analytics-btn:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .analytics-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        .export-btn {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .export-btn:hover {
          background: rgba(34, 197, 94, 0.2);
        }

        .clear-btn {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .clear-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }
      `;

      document.head.appendChild(style);
    }

    getDashboardContainer() {
      return document.getElementById(CONTAINER_ID);
    }

    getDashboardPanel() {
      const container = this.getDashboardContainer();
      return container ? container.querySelector('.analytics-dashboard-container') : null;
    }

    getDashboardElement(id) {
      const container = this.getDashboardContainer();
      return container ? container.querySelector(`#${id}`) : null;
    }

    setDashboardText(id, value) {
      const element = this.getDashboardElement(id);
      if (element) {
        element.textContent = value;
      }
    }

    isDashboardVisible() {
      const panel = this.getDashboardPanel();
      return Boolean(panel) && window.getComputedStyle(panel).display !== 'none';
    }

    showDashboard(tabName = 'overview') {
      const panel = this.getDashboardPanel();
      if (!panel) {
        return;
      }

      panel.style.display = 'block';
      this.switchTab(tabName);
    }

    hideDashboard() {
      const panel = this.getDashboardPanel();
      if (panel) {
        panel.style.display = 'none';
      }
    }

    pushMetricValue(target, value, maxItems = 100) {
      if (!Array.isArray(target) || !Number.isFinite(value) || value < 0) {
        return;
      }

      target.push(value);
      if (target.length > maxItems) {
        target.shift();
      }
    }

    attachDashboardUI() {
      if (!document.body || this.getDashboardContainer()) {
        return;
      }

      // Create container
      const container = document.createElement('div');
      container.id = CONTAINER_ID;

      // Create dashboard container
      const dashboardContainer = document.createElement('div');
      dashboardContainer.className = 'analytics-dashboard-container';

      // Create header
      const header = document.createElement('div');
      header.className = 'analytics-dashboard-header';

      const title = document.createElement('span');
      title.className = 'analytics-dashboard-title';
      title.textContent = 'AI Analytics Dashboard';

      const toggleButton = document.createElement('button');
      toggleButton.className = 'analytics-dashboard-toggle';
      toggleButton.textContent = '✕';
      toggleButton.addEventListener('click', () => {
        window[PRIMARY_API_NAME].toggleDashboard();
      });

      header.appendChild(title);
      header.appendChild(toggleButton);
      dashboardContainer.appendChild(header);

      // Create tabs
      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'analytics-tabs';

      const tabs = [
        { id: 'overview', label: 'Overview', active: true },
        { id: 'conversations', label: 'Conversations', active: false },
        { id: 'performance', label: 'Performance', active: false },
        { id: 'usage', label: 'Usage', active: false }
      ];

      tabs.forEach(tab => {
        const tabButton = document.createElement('button');
        tabButton.className = 'analytics-tab' + (tab.active ? ' active' : '');
        tabButton.dataset.tab = tab.id;
        tabButton.textContent = tab.label;
        tabsContainer.appendChild(tabButton);
      });

      dashboardContainer.appendChild(tabsContainer);

      // Create chart placeholder
      const createChart = () => {
        const chart = document.createElement('div');
        chart.className = 'analytics-chart';
        const placeholder = document.createElement('div');
        placeholder.className = 'chart-placeholder';
        placeholder.textContent = 'Overview chart will appear here';
        chart.appendChild(placeholder);
        return chart;
      };

      // Create metric item
      const createMetricItem = (labelText, valueText, valueId, valueClass = '') => {
        const metricItem = document.createElement('div');
        metricItem.className = 'metric-item';

        const label = document.createElement('span');
        label.className = 'metric-label';
        label.textContent = labelText;

        const value = document.createElement('span');
        value.className = 'metric-value' + (valueClass ? ` ${valueClass}` : '');
        value.id = valueId;
        value.textContent = valueText;

        metricItem.appendChild(label);
        metricItem.appendChild(value);
        return metricItem;
      };

      // Create metric group
      const createMetricGroup = (items) => {
        const metricGroup = document.createElement('div');
        metricGroup.className = 'metric-group';
        items.forEach(item => {
          metricGroup.appendChild(createMetricItem(item.label, item.value, item.id, item.class));
        });
        return metricGroup;
      };

      // Create metrics container
      const createMetrics = (groups) => {
        const metricsContainer = document.createElement('div');
        metricsContainer.className = 'analytics-metrics';
        groups.forEach(group => {
          metricsContainer.appendChild(createMetricGroup(group));
        });
        return metricsContainer;
      };

      // Create content section
      const createContentSection = (id, active, metricGroups) => {
        const content = document.createElement('div');
        content.className = 'analytics-content' + (active ? ' active' : '');
        content.id = `${id}-content`;
        content.appendChild(createChart());
        content.appendChild(createMetrics(metricGroups));
        return content;
      };

      // Overview content
      const overviewContent = createContentSection('overview', true, [
        [
          { label: 'Total Conversations', value: '0', id: 'total-conversations' },
          { label: 'Avg Response Time', value: '0ms', id: 'avg-response-time' },
          { label: 'Avg Tokens Used', value: '0', id: 'avg-tokens' }
        ],
        [
          { label: 'Success Rate', value: '0%', id: 'success-rate', class: 'metric-success' },
          { label: 'Active Users', value: '0', id: 'active-users' },
          { label: 'Data Usage', value: '0MB', id: 'data-usage' }
        ]
      ]);

      // Conversations content
      const conversationsContent = createContentSection('conversations', false, [
        [
          { label: 'Conversations Today', value: '0', id: 'conversations-today' },
          { label: 'Avg Messages/Conv', value: '0', id: 'avg-messages-conv' },
          { label: 'Longest Conversation', value: '0', id: 'longest-conv' }
        ],
        [
          { label: 'Conversations Active', value: '0', id: 'active-convs' },
          { label: 'Avg Duration', value: '0min', id: 'avg-duration' },
          { label: 'Peak Hour', value: 'N/A', id: 'peak-hour' }
        ]
      ]);

      // Performance content
      const performanceContent = createContentSection('performance', false, [
        [
          { label: 'Avg Latency', value: '0ms', id: 'avg-latency' },
          { label: 'Error Rate', value: '0%', id: 'error-rate', class: 'metric-danger' },
          { label: 'Throughput', value: '0req/s', id: 'throughput' }
        ],
        [
          { label: 'Peak Load', value: '0', id: 'peak-load' },
          { label: 'System Health', value: 'Good', id: 'system-health', class: 'metric-success' },
          { label: 'Uptime', value: '0%', id: 'uptime' }
        ]
      ]);

      // Usage content
      const usageContent = createContentSection('usage', false, [
        [
          { label: 'Data Used Today', value: '0MB', id: 'data-used-today' },
          { label: 'API Calls', value: '0', id: 'api-calls' },
          { label: 'Cost Estimate', value: '$0.00', id: 'cost-estimate' }
        ],
        [
          { label: 'Storage Used', value: '0MB', id: 'storage-used' },
          { label: 'Cache Hit Rate', value: '0%', id: 'cache-hit-rate' },
          { label: 'Optimization Rate', value: '0%', id: 'optimization-rate' }
        ]
      ]);

      // Add content sections to dashboard
      dashboardContainer.appendChild(overviewContent);
      dashboardContainer.appendChild(conversationsContent);
      dashboardContainer.appendChild(performanceContent);
      dashboardContainer.appendChild(usageContent);

      // Create actions
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'analytics-actions';

      const exportButton = document.createElement('button');
      exportButton.className = 'analytics-btn export-btn';
      exportButton.id = 'export-data-btn';
      exportButton.textContent = 'Export Data';

      const clearButton = document.createElement('button');
      clearButton.className = 'analytics-btn clear-btn';
      clearButton.id = 'clear-data-btn';
      clearButton.textContent = 'Clear Data';

      const toggleMonitoringButton = document.createElement('button');
      toggleMonitoringButton.className = 'analytics-btn active';
      toggleMonitoringButton.id = 'toggle-monitoring-btn';
      toggleMonitoringButton.textContent = 'Monitoring On';

      actionsContainer.appendChild(exportButton);
      actionsContainer.appendChild(clearButton);
      actionsContainer.appendChild(toggleMonitoringButton);
      dashboardContainer.appendChild(actionsContainer);

      // Add dashboard to container
      container.appendChild(dashboardContainer);

      // Add container to body
      document.body.appendChild(container);

      container.querySelectorAll('.analytics-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const targetTab = e.target.dataset.tab;
          this.switchTab(targetTab);
        });
      });

      container.querySelector('#export-data-btn').addEventListener('click', () => {
        this.exportData();
      });

      container.querySelector('#clear-data-btn').addEventListener('click', () => {
        this.clearData();
      });

      container.querySelector('#toggle-monitoring-btn').addEventListener('click', () => {
        this.config.autoRefresh = !this.config.autoRefresh;
        const btn = container.querySelector('#toggle-monitoring-btn');
        if (this.config.autoRefresh) {
          btn.textContent = 'Monitoring On';
          btn.classList.add('active');
          this.startAnalyticsMonitoring();
        } else {
          btn.textContent = 'Monitoring Off';
          btn.classList.remove('active');
          this.stopAnalyticsMonitoring();
        }
      });
    }

    startAnalyticsMonitoring() {
      if (!this.config.autoRefresh || this._monitoringInterval) {
        return;
      }

      this._monitoringInterval = setInterval(() => {
        this.updateAnalyticsDisplay();
      }, this.config.refreshRate);
    }

    stopAnalyticsMonitoring() {
      if (this._monitoringInterval) {
        clearInterval(this._monitoringInterval);
        this._monitoringInterval = null;
      }
    }

    updateAnalyticsDisplay() {
      const analytics = this.getAnalytics();

      this.setDashboardText('total-conversations', analytics.totalConversations);
      this.setDashboardText('avg-response-time', `${analytics.avgResponseTime}ms`);
      this.setDashboardText('avg-tokens', analytics.avgTokens);
      this.setDashboardText('success-rate', `${analytics.successRate}%`);
      this.setDashboardText('active-users', analytics.activeUsers);
      this.setDashboardText('data-usage', `${(analytics.dataUsage / 1024 / 1024).toFixed(2)}MB`);

      this.setDashboardText('conversations-today', analytics.conversationsToday);
      this.setDashboardText('avg-messages-conv', analytics.avgMessagesPerConversation);
      this.setDashboardText('longest-conv', `${analytics.longestConversation}min`);
      this.setDashboardText('active-convs', analytics.activeConversations);
      this.setDashboardText('avg-duration', `${analytics.avgDuration}min`);
      this.setDashboardText('peak-hour', analytics.peakHour);

      this.setDashboardText('avg-latency', `${analytics.avgLatency}ms`);
      this.setDashboardText('error-rate', `${analytics.errorRate}%`);
      this.setDashboardText('throughput', `${analytics.throughput}req/s`);
      this.setDashboardText('peak-load', analytics.peakLoad);
      this.setDashboardText('system-health', analytics.systemHealth);
      this.setDashboardText('uptime', `${analytics.uptime}%`);

      this.setDashboardText('data-used-today', `${(analytics.dataUsedToday / 1024 / 1024).toFixed(2)}MB`);
      this.setDashboardText('api-calls', analytics.apiCalls);
      this.setDashboardText('cost-estimate', `$${analytics.costEstimate.toFixed(2)}`);
      this.setDashboardText('storage-used', `${(analytics.storageUsed / 1024 / 1024).toFixed(2)}MB`);
      this.setDashboardText('cache-hit-rate', `${analytics.cacheHitRate}%`);
      this.setDashboardText('optimization-rate', `${analytics.optimizationRate}%`);
    }

    getAnalytics() {
      const now = Date.now();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();

      const conversationsToday = this._analyticsData.conversations.filter(c => c.timestamp >= todayTimestamp).length;
      const activeConversations = this._analyticsData.conversations.filter(c => c.endTime > now - 300000).length;
      const dataUsedToday = this._analyticsData.conversations
        .filter(c => c.timestamp >= todayTimestamp)
        .reduce((sum, c) => sum + c.dataUsage, 0);

      const responseTimes = this._analyticsData.responseTimes;
      const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

      const tokenUsage = this._analyticsData.tokenUsage;
      const avgTokens = tokenUsage.length > 0 ? tokenUsage.reduce((a, b) => a + b, 0) / tokenUsage.length : 0;

      const successRate = this._analyticsData.conversations.length > 0
        ? (this._analyticsData.conversations.filter(c => c.success).length / this._analyticsData.conversations.length) * 100
        : this._performanceMetrics.totalRequests > 0
          ? (this._performanceMetrics.successCount / this._performanceMetrics.totalRequests) * 100
          : 0;

      const errorRate = this._analyticsData.conversations.length > 0
        ? (this._analyticsData.conversations.filter(c => !c.success).length / this._analyticsData.conversations.length) * 100
        : this._performanceMetrics.totalRequests > 0
          ? (this._performanceMetrics.errors / this._performanceMetrics.totalRequests) * 100
          : 0;

      const avgDuration = this._analyticsData.conversations.length > 0
        ? this._analyticsData.conversations.reduce((sum, c) => sum + (c.endTime - c.startTime), 0) / this._analyticsData.conversations.length / 60000
        : 0;

      const longestConversation = this._analyticsData.conversations.length > 0
        ? Math.max(...this._analyticsData.conversations.map(c => (c.endTime - c.startTime) / 60000))
        : 0;

      const peakHourData = this._analyticsData.conversations
        .filter(c => c.timestamp >= todayTimestamp)
        .reduce((hours, c) => {
          const hour = new Date(c.timestamp).getHours();
          hours[hour] = (hours[hour] || 0) + 1;
          return hours;
        }, {});

      const peakHour = Object.keys(peakHourData).reduce((maxHour, hour) => peakHourData[hour] > (peakHourData[maxHour] || 0) ? hour : maxHour, 0);

      const systemPerformance = this._analyticsData.systemPerformance;
      const avgLatency = systemPerformance.length > 0
        ? systemPerformance.reduce((sum, performance) => sum + performance.latency, 0) / systemPerformance.length
        : 0;
      const throughput = systemPerformance.length > 0
        ? Math.round(systemPerformance.length / 60)
        : 0;
      const peakLoad = systemPerformance.length > 0
        ? Math.max(...systemPerformance.map((performance) => performance.load))
        : 0;
      const systemHealth = systemPerformance.length === 0 || systemPerformance.every((performance) => performance.load < 80)
        ? 'Good'
        : 'Warning';
      const uptime = systemPerformance.length > 0
        ? (1 - systemPerformance.filter((performance) => performance.status === 'down').length / systemPerformance.length) * 100
        : 100;

      return {
        totalConversations: this._analyticsData.conversations.length,
        avgResponseTime: Math.round(avgResponseTime),
        avgTokens: Math.round(avgTokens),
        successRate: Math.round(successRate),
        activeUsers: this._analyticsData.userActivity.length,
        dataUsage: this._analyticsData.conversations.reduce((sum, c) => sum + c.dataUsage, 0),
        conversationsToday,
        avgMessagesPerConversation: this._analyticsData.conversations.length > 0 ? this._analyticsData.conversations.reduce((sum, c) => sum + c.messages, 0) / this._analyticsData.conversations.length : 0,
        longestConversation: Math.round(longestConversation),
        activeConversations,
        avgDuration: Math.round(avgDuration),
        peakHour: `${peakHour}:00`,
        avgLatency: Math.round(avgLatency),
        errorRate: Math.round(errorRate),
        throughput,
        peakLoad,
        systemHealth,
        uptime: Math.round(uptime),
        dataUsedToday,
        apiCalls: systemPerformance.length,
        costEstimate: this._analyticsData.conversations.reduce((sum, c) => sum + c.cost, 0),
        storageUsed: Object.values(this._cache).reduce((sum, item) => sum + item.size, 0),
        cacheHitRate: this._stats.cachedResponses > 0 ? (this._stats.cachedResponses / (this._stats.cachedResponses + this._stats.optimizedRequests)) * 100 : 0,
        optimizationRate: this._stats.optimizedRequests > 0 ? (this._stats.dataSaved / (this._stats.dataSaved + this._stats.optimizedRequests * 1000)) * 100 : 0
      };
    }

    recordConversation(data) {
      this._analyticsData.conversations.push({
        ...data,
        timestamp: Date.now()
      });

      if (this._analyticsData.conversations.length > MAX_HISTORY_ITEMS) {
        this._analyticsData.conversations.shift();
      }
    }

    recordResponseTime(time) {
      this.pushMetricValue(this._analyticsData.responseTimes, time);
      this.pushMetricValue(this._performanceMetrics.responseTimes, time);
      this.pushMetricValue(this._performanceMetrics.latency, time);
    }

    recordTokenUsage(tokens) {
      this.pushMetricValue(this._analyticsData.tokenUsage, tokens);
      this.pushMetricValue(this._performanceMetrics.tokenCounts, tokens);
    }

    recordUserActivity(activity) {
      this._analyticsData.userActivity.push({
        ...activity,
        timestamp: Date.now()
      });

      if (this._analyticsData.userActivity.length > 100) {
        this._analyticsData.userActivity.shift();
      }
    }

    recordSystemPerformance(performance) {
      this._analyticsData.systemPerformance.push({
        ...performance,
        timestamp: Date.now()
      });

      if (this._analyticsData.systemPerformance.length > 100) {
        this._analyticsData.systemPerformance.shift();
      }
    }

    recordResponse(time, success = true, tokens = 0, metadata = {}) {
      const responseTime = Number.isFinite(time) && time >= 0 ? time : 0;
      const tokenCount = Number.isFinite(tokens) && tokens >= 0 ? Math.round(tokens) : 0;
      const systemLoad = Number.isFinite(metadata.load)
        ? metadata.load
        : Math.min(100, Math.max(5, Math.round(responseTime / 25) + (success ? 0 : 15)));

      this._performanceMetrics.totalRequests += 1;
      if (success) {
        this._performanceMetrics.successCount += 1;
      } else {
        this._performanceMetrics.errors += 1;
      }

      this.recordResponseTime(responseTime);
      this.recordTokenUsage(tokenCount);
      this.recordSystemPerformance({
        latency: responseTime,
        load: systemLoad,
        status: success ? 'up' : 'degraded',
        source: metadata.source || 'legacy-performance-monitor'
      });

      if (this.config.enabled) {
        this.updateAnalyticsDisplay();
      }

      return this.getMetrics();
    }

    getMetrics() {
      const avgResponseTime = this._performanceMetrics.responseTimes.length > 0
        ? this._performanceMetrics.responseTimes.reduce((sum, value) => sum + value, 0) / this._performanceMetrics.responseTimes.length
        : 0;

      return {
        avgResponseTime,
        successRate: this._performanceMetrics.totalRequests > 0
          ? this._performanceMetrics.successCount / this._performanceMetrics.totalRequests
          : 0,
        errorCount: this._performanceMetrics.errors,
        totalRequests: this._performanceMetrics.totalRequests,
        responseTimes: [...this._performanceMetrics.responseTimes],
        tokenCounts: [...this._performanceMetrics.tokenCounts],
        latency: [...this._performanceMetrics.latency]
      };
    }

    resetMetrics() {
      this._performanceMetrics = createEmptyPerformanceMetrics();
      this._analyticsData.responseTimes = [];
      this._analyticsData.tokenUsage = [];
      this._analyticsData.systemPerformance = [];
      this.updateAnalyticsDisplay();
      return this.getMetrics();
    }

    switchTab(tabName) {
      const container = this.getDashboardContainer();
      if (!container) {
        return;
      }

      container.querySelectorAll('.analytics-tab').forEach(tab => tab.classList.remove('active'));
      container.querySelectorAll('.analytics-content').forEach(content => content.classList.remove('active'));

      const tab = container.querySelector(`[data-tab="${tabName}"]`);
      const content = container.querySelector(`#${tabName}-content`);

      if (tab) {
        tab.classList.add('active');
      }

      if (content) {
        content.classList.add('active');
      }
    }

    exportData() {
      const data = {
        conversations: this._analyticsData.conversations,
        responseTimes: this._analyticsData.responseTimes,
        tokenUsage: this._analyticsData.tokenUsage,
        userActivity: this._analyticsData.userActivity,
        systemPerformance: this._analyticsData.systemPerformance,
        stats: this._stats
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-analytics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      GM_notification({
        text: 'Analytics data exported',
        title: 'AI Analytics Dashboard Classic',
        timeout: 3000
      });
    }

    clearData() {
      this._analyticsData = createEmptyAnalyticsData();
      this._stats = createEmptyAnalyticsStats();
      this._performanceMetrics = createEmptyPerformanceMetrics();
      this.updateAnalyticsDisplay();

      GM_notification({
        text: 'Analytics data cleared',
        title: 'AI Analytics Dashboard Classic',
        timeout: 3000
      });
    }

    toggleDashboard(tabName = 'overview') {
      if (this.isDashboardVisible()) {
        this.hideDashboard();
      } else {
        this.showDashboard(tabName);
      }
    }

    toggleMetrics() {
      const container = this.getDashboardContainer();
      const performanceTab = container ? container.querySelector('[data-tab="performance"]') : null;
      const performanceContent = this.getDashboardElement('performance-content');
      const isPerformanceViewActive = this.isDashboardVisible()
        && Boolean(performanceTab && performanceTab.classList.contains('active'))
        && Boolean(performanceContent && performanceContent.classList.contains('active'));

      if (isPerformanceViewActive) {
        this.hideDashboard();
      } else {
        this.showDashboard('performance');
      }
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

      GM_registerMenuCommand('AI Analytics Dashboard Classic: Toggle', () => {
        this.toggleDashboard();
      });

      GM_registerMenuCommand('AI Analytics Dashboard Classic: Export Data', () => {
        this.exportData();
      });

      GM_registerMenuCommand('AI Analytics Dashboard Classic: Clear Data', () => {
        this.clearData();
      });

      GM_registerMenuCommand('AI Analytics Dashboard Classic: Settings', () => {
        alert(`AI Analytics Dashboard Classic\n\nEnabled: ${this.config.enabled}\nAuto-refresh: ${this.config.autoRefresh ? 'On' : 'Off'}\nRefresh rate: ${this.config.refreshRate}ms\nShow charts: ${this.config.showCharts}\nExport data: ${this.config.exportData}\nDark mode: ${this.config.darkMode}`);
      });

      this._menusRegistered = true;
    }

    removeDashboardUI() {
      const container = this.getDashboardContainer();
      if (container) {
        container.remove();
      }
    }

    execute() {
      if (this.config.enabled) {
        this.attachDashboardUI();
        this.startAnalyticsMonitoring();
      }
      console.log(`[${MODULE_NAME}] Execute called`);
    }

    destroy() {
      try {
        this.stopAnalyticsMonitoring();
        this.removeDashboardUI();
        console.log(`[${MODULE_NAME}] Cleanup complete`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Cleanup error:`, err);
      }
    }
  }

  const instance = new AIAnalyticsDashboardModule();
  window[MODULE_INSTANCE_NAME] = instance;
  window[LEGACY_MODULE_NAME] = instance;
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window[PRIMARY_API_NAME] = instance.api;
    mergeApiSurface(SHARED_API_NAME, instance.api);
    mergeApiSurface(LEGACY_API_NAME, instance.api);
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error(`[${MODULE_NAME}] fallback error`, err);
    }
  }
})();
