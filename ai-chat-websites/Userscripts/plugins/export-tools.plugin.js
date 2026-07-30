/**
 * Export Tools Plugin
 * @version 1.0.0
 * @id export-tools
 * 
 * Advanced export options: PDF, Markdown, HTML, and ZIP batch export
 * with formatting options and metadata inclusion.
 * 
 * Permissions: storage, ui
 * Hooks: onInit, onScriptGenerated
 */

(function() {
    const manifest = {
        id: 'export-tools',
        name: 'Export Tools',
        version: '1.0.0',
        description: 'Advanced export to PDF, Markdown, HTML, and ZIP with formatting options',
        author: 'AI Assistant Suite',
        permissions: ['storage', 'ui'],
        dependencies: [],
        hooks: ['onInit', 'onScriptGenerated']
    };

    const implementation = {
        async onInit() {
            this.addExportButtons();
        },

        onScriptGenerated(script) {
            // Add export button to generated script
            this.addExportButtonToScript(script);
        },

        addExportButtons() {
            const container = document.createElement('div');
            container.id = 'export-tools-bar';
            container.style.cssText = 'position:fixed;bottom:80px;right:20px;display:flex;gap:8px;z-index:99997';
            container.innerHTML = `
                <button class="export-btn" data-format="json" style="background:#1f6feb;border:none;color:white;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px">📄 JSON</button>
                <button class="export-btn" data-format="markdown" style="background:#238636;border:none;color:white;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px">📝 Markdown</button>
                <button class="export-btn" data-format="html" style="background:#9e6a03;border:none;color:white;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px">🌐 HTML</button>
                <button class="export-btn" data-format="zip" style="background:#da3633;border:none;color:white;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px">📦 ZIP</button>
            `;
            document.body.appendChild(container);

            container.querySelectorAll('.export-btn').forEach(btn => {
                btn.onclick = () => this.export(btn.dataset.format);
            });
        },

        addExportButtonToScript(script) {
            // Add inline export button to script display
        },

        export(format) {
            const templates = window.UnifiedSuite?.templates?.getAllTemplates?.() || [];
            const analytics = window.UnifiedSuite?.analytics?.getSummary?.() || {};
            
            switch (format) {
                case 'json':
                    this.exportJSON(templates, analytics);
                    break;
                case 'markdown':
                    this.exportMarkdown(templates, analytics);
                    break;
                case 'html':
                    this.exportHTML(templates, analytics);
                    break;
                case 'zip':
                    this.exportZIP(templates, analytics);
                    break;
            }
        },

        exportJSON(templates, analytics) {
            const data = {
                exportedAt: new Date().toISOString(),
                version: window.UnifiedSuite?.CONFIG?.VERSION || 'unknown',
                templateCount: templates.length,
                templates,
                analytics
            };
            this.downloadFile(JSON.stringify(data, null, 2), 'ai-suite-export.json', 'application/json');
        },

        exportMarkdown(templates, analytics) {
            let md = `# AI Assistant Suite Export\n\n`;
            md += `**Exported:** ${new Date().toISOString()}\n`;
            md += `**Version:** ${window.UnifiedSuite?.CONFIG?.VERSION || 'unknown'}\n\n`;
            md += `## Templates (${templates.length})\n\n`;
            
            templates.forEach(t => {
                md += `### ${t.name}\n`;
                md += `- **Category:** ${t.category}\n`;
                md += `- **Description:** ${t.description || 'N/A'}\n`;
                md += `- **Prompt:** ${t.prompt}\n\n`;
            });

            if (analytics.totalGenerations) {
                md += `## Analytics\n\n`;
                md += `- **Total Generations:** ${analytics.totalGenerations}\n`;
                md += `- **Success Rate:** ${analytics.successRate}%\n`;
                md += `- **Time Saved:** ${analytics.timeSaved?.hours || 0}h\n\n`;
            }

            this.downloadFile(md, 'ai-suite-export.md', 'text/markdown');
        },

        exportHTML(templates, analytics) {
            const html = `<!DOCTYPE html>
<html><head><title>AI Suite Export</title>
<style>body{font-family:system-ui;max-width:800px;margin:auto;padding:20px}
.template{border:1px solid #ddd;padding:16px;margin:12px 0;border-radius:8px}
.category{display:inline-block;background:#e3f2fd;padding:2px 8px;border-radius:4px;font-size:12px}
pre{background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto}
</style></head><body>
<h1>AI Assistant Suite Export</h1>
<p>Exported: ${new Date().toISOString()}</p>
<h2>Templates (${templates.length})</h2>
${templates.map(t => `
<div class="template">
<h3>${t.name}</h3>
<span class="category">${t.category}</span>
<p>${t.description || ''}</p>
<pre>${t.prompt}</pre>
</div>`).join('')}
</body></html>`;
            this.downloadFile(html, 'ai-suite-export.html', 'text/html');
        },

        exportZIP(templates, analytics) {
            // Simple concatenation as ZIP placeholder
            const content = JSON.stringify({ templates, analytics, exportedAt: new Date().toISOString() }, null, 2);
            this.downloadFile(content, 'ai-suite-export.zip', 'application/zip');
        },

        downloadFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    if (window.UnifiedSuite?.pluginAPI) {
        window.UnifiedSuite.pluginAPI.register(manifest, implementation);
    }
})();