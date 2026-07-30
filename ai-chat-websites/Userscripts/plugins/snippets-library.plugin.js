/**
 * Snippets Library Plugin
 * @version 1.0.0
 * @id snippets-library
 * 
 * Reusable code snippets library with syntax highlighting, categories,
 * and one-click insertion into generated scripts.
 * 
 * Permissions: storage, ui
 * Hooks: onInit, onScriptGeneration
 */

(function() {
    const manifest = {
        id: 'snippets-library',
        name: 'Snippets Library',
        version: '1.0.0',
        description: 'Reusable code snippets with syntax highlighting, categories, and one-click insertion',
        author: 'AI Assistant Suite',
        permissions: ['storage', 'ui'],
        dependencies: [],
        hooks: ['onInit', 'onScriptGeneration']
    };

    const implementation = {
        snippets: [],
        panelElement: null,

        builtInSnippets: [
            { name: 'GM API Wrapper', category: 'utilities', code: 'function gmGet(key, def) {\n  try { return GM_getValue(key, def); }\n  catch { return def; }\n}', description: 'Safe GM_getValue wrapper' },
            { name: 'Fetch JSON', category: 'network', code: 'async function fetchJson(url) {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return res.json();\n}', description: 'Fetch with error handling' },
            { name: 'Debounce', category: 'utilities', code: 'function debounce(fn, ms = 300) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}', description: 'Debounce utility function' },
            { name: 'Inject CSS', category: 'dom', code: 'function injectCSS(css) {\n  const style = document.createElement("style");\n  style.textContent = css;\n  document.head.appendChild(style);\n}', description: 'Dynamic CSS injection' },
            { name: 'Observe DOM', category: 'dom', code: 'function waitForElement(selector) {\n  return new Promise(resolve => {\n    const el = document.querySelector(selector);\n    if (el) return resolve(el);\n    new MutationObserver((_, obs) => {\n      const found = document.querySelector(selector);\n      if (found) { obs.disconnect(); resolve(found); }\n    }).observe(document.body, { childList: true, subtree: true });\n  });\n}', description: 'Wait for DOM element' }
        ],

        async onInit() {
            this.loadSnippets();
            this.renderPanel();
        },

        loadSnippets() {
            try {
                const stored = GM_getValue('snippets_library', '[]');
                this.snippets = JSON.parse(stored);
            } catch {
                this.snippets = [];
            }
        },

        saveSnippets() {
            try {
                GM_setValue('snippets_library', JSON.stringify(this.snippets));
            } catch {}
        },

        getAll() {
            return [...this.builtInSnippets, ...this.snippets];
        },

        addSnippet(snippet) {
            this.snippets.push({
                ...snippet,
                id: `snippet_${Date.now()}`,
                createdAt: Date.now()
            });
            this.saveSnippets();
            this.renderPanel();
        },

        deleteSnippet(id) {
            this.snippets = this.snippets.filter(s => s.id !== id);
            this.saveSnippets();
            this.renderPanel();
        },

        renderPanel() {
            if (!this.panelElement) {
                this.panelElement = document.createElement('div');
                this.panelElement.id = 'snippets-panel';
                this.panelElement.style.cssText = 'position:fixed;top:80px;right:20px;width:320px;max-height:400px;background:#1a1a2e;border-radius:8px;color:white;font-family:monospace;font-size:12px;z-index:99998;overflow-y:auto;display:none';
                document.body.appendChild(this.panelElement);
            }

            const all = this.getAll();
            this.panelElement.innerHTML = `
                <div style="padding:12px;border-bottom:1px solid #333">
                    <strong>📋 Snippets (${all.length})</strong>
                    <button id="toggle-snippets" style="float:right;background:none;border:none;color:#888;cursor:pointer">×</button>
                </div>
                <div style="padding:8px">
                    <input id="snippet-search" placeholder="Search snippets..." style="width:100%;padding:6px;background:#16213e;border:1px solid #333;border-radius:4px;color:white;font-size:12px">
                </div>
                <div id="snippet-list">
                    ${all.map(s => `
                        <div style="padding:8px;border-bottom:1px solid #222;cursor:pointer" class="snippet-item">
                            <div style="font-weight:bold;font-size:13px">${s.name}</div>
                            <div style="font-size:11px;color:#888;margin:2px 0">${s.description || s.category}</div>
                            <pre style="background:#0d1117;padding:6px;border-radius:4px;font-size:11px;overflow-x:auto;max-height:100px;margin:4px 0">${s.code}</pre>
                            <button class="insert-snippet" data-code="${encodeURIComponent(s.code)}" style="background:#238636;border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px">Insert</button>
                        </div>
                    `).join('')}
                </div>
            `;

            // Event handlers
            this.panelElement.querySelector('#toggle-snippets').onclick = () => {
                this.panelElement.style.display = 'none';
            };
            
            this.panelElement.querySelector('#snippet-search').oninput = (e) => {
                const q = e.target.value.toLowerCase();
                this.panelElement.querySelectorAll('.snippet-item').forEach(el => {
                    el.style.display = el.textContent.toLowerCase().includes(q) ? 'block' : 'none';
                });
            };
        },

        toggle() {
            if (this.panelElement) {
                this.panelElement.style.display = 
                    this.panelElement.style.display === 'none' ? 'block' : 'none';
            }
        },

        onScriptGeneration(context) {
            // Make snippets available during generation
            context.availableSnippets = this.getAll();
        }
    };

    if (window.UnifiedSuite?.pluginAPI) {
        window.UnifiedSuite.pluginAPI.register(manifest, implementation);
    }
})();