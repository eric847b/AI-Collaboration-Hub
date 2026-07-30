/**
 * Analytics Dashboard Plugin
 * @version 1.0.0
 * @id analytics-dashboard
 * 
 * Visual dashboard showing generation statistics, provider performance,
 * and usage patterns with interactive charts.
 * 
 * Permissions: storage, ui
 * Hooks: onInit, onGenerationComplete
 */

(function() {
    const manifest = {
        id: 'analytics-dashboard',
        name: 'Analytics Dashboard',
        version: '1.0.0',
        description: 'Visual dashboard with generation statistics, provider rankings, and usage patterns',
        author: 'AI Assistant Suite',
        permissions: ['storage', 'ui'],
        dependencies: [],
        hooks: ['onInit', 'onGenerationComplete']
    };

    const implementation = {
        dashboardElement: null,

        async onInit() {
            this.renderDashboard();
        },

        onGenerationComplete(event) {
            this.updateStats(event);
        },

        renderDashboard() {
            this.dashboardElement = document.createElement('div');
            this.dashboardElement.id = 'analytics-dashboard';
            this.dashboardElement.innerHTML = `
                <div style="padding:16px;background:#1a1a2e;border-radius:8px;color:white;font-family:system-ui">
                    <h3>📊 Analytics Dashboard</h3>
                    <div id="analytics-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0">
                        <div style="background:#16213e;padding:12px;border-radius:6px">
                            <div style="font-size:24px;font-weight:bold" id="stat-total">0</div>
                            <div style="font-size:12px;opacity:0.7">Total Generations</div>
                        </div>
                        <div style="background:#16213e;padding:12px;border-radius:6px">
                            <div style="font-size:24px;font-weight:bold" id="stat-success">0%</div>
                            <div style="font-size:12px;opacity:0.7">Success Rate</div>
                        </div>
                        <div style="background:#16213e;padding:12px;border-radius:6px">
                            <div style="font-size:24px;font-weight:bold" id="stat-time">0h</div>
                            <div style="font-size:12px;opacity:0.7">Time Saved</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(this.dashboardElement);
        },

        updateStats(event) {
            const analytics = window.UnifiedSuite?.analytics;
            if (!analytics) return;
            const summary = analytics.getSummary();
            document.getElementById('stat-total').textContent = summary.totalGenerations;
            document.getElementById('stat-success').textContent = `${summary.successRate}%`;
            document.getElementById('stat-time').textContent = `${summary.timeSaved.hours}h`;
        }
    };

    // Register with plugin API
    if (window.UnifiedSuite?.pluginAPI) {
        window.UnifiedSuite.pluginAPI.register(manifest, implementation);
    }
})();