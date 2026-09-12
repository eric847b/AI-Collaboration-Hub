/**
 * Plugin Marketplace client (Q4 2026 #8).
 * Fetches the hosted catalog (GitHub Pages / raw), validates listings, and
 * offers install/update/uninstall flows against the local plugin registry.
 *
 * Usage:
 *   const mkt = new PluginMarketplace();
 *   const available = await mkt.refresh();
 *   await mkt.install('analytics-dashboard');
 */

(function (global) {
  const DEFAULT_CATALOG_URL =
    'https://raw.githubusercontent.com/eric847b/AI-Collaboration-Hub/main/ai-chat-websites/Userscripts/plugins/marketplace/catalog.json';

  const REQUIRED_FIELDS = ['id', 'name', 'version', 'description', 'downloadUrl'];

  /** Structural validation of a single catalog entry. */
  function validatePlugin(entry) {
    return REQUIRED_FIELDS.every(k => typeof entry[k] === 'string' && entry[k].length > 0);
  }

  /** Semantic version less-than comparison for update detection. */
  function semverLt(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) return na < nb;
    }
    return false;
  }

  class PluginMarketplace {
    constructor(options) {
      this.catalogUrl = (options && options.catalogUrl) || DEFAULT_CATALOG_URL;
      this.catalog = [];
      this.installedKey = 'unifiedsuite_installed_plugins';
    }

    /** Fetch, validate, and cache the remote catalog. */
    async refresh() {
      const res = await fetch(this.catalogUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Catalog fetch failed: ' + res.status);
      const json = await res.json();
      if (!Array.isArray(json.plugins)) throw new Error('Invalid catalog: missing plugins array');
      this.catalog = json.plugins.filter(validatePlugin);
      return this.catalog;
    }

    getInstalled() {
      try {
        return JSON.parse(localStorage.getItem(this.installedKey) || '{}');
      } catch {
        return {};
      }
    }

    /** Catalog entries annotated with install/update state. */
    listAvailable() {
      const installed = this.getInstalled();
      return this.catalog.map(p => Object.assign({}, p, {
        installed: Boolean(installed[p.id]),
        updateAvailable: installed[p.id] ? semverLt(installed[p.id], p.version) : false
      }));
    }

    /** Download and register a plugin (version recorded locally). */
    async install(pluginId) {
      const plugin = this.catalog.find(p => p.id === pluginId);
      if (!plugin) throw new Error('Unknown plugin: ' + pluginId);
      const res = await fetch(plugin.downloadUrl);
      if (!res.ok) throw new Error('Download failed: ' + res.status);
      const source = await res.text();
      const installed = this.getInstalled();
      installed[plugin.id] = plugin.version;
      localStorage.setItem(this.installedKey, JSON.stringify(installed));
      return { id: plugin.id, version: plugin.version, source };
    }

    /** Remove a plugin from the local registry. */
    async uninstall(pluginId) {
      const installed = this.getInstalled();
      delete installed[pluginId];
      localStorage.setItem(this.installedKey, JSON.stringify(installed));
      return { id: pluginId };
    }
  }

  global.PluginMarketplace = PluginMarketplace;
  if (typeof module !== 'undefined' && module.exports) module.exports = { PluginMarketplace };
})(typeof window !== 'undefined' ? window : globalThis);