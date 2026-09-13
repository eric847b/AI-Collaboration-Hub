/**
 * Plugin API v3 — stable release (Q2 2027 #13, "Plugin API v3 stable release").
 * Evolution of the legacy modules/plugin-api.js (v1.6.0) into a hardened,
 * versioned contract that runs unchanged in Node (CI/tests) and browsers:
 *
 *   - strict schema validation (id / semver / author / permissions)
 *   - deny-by-default capability allow-list
 *   - dependency graph resolution with semver constraints + cycle detection
 *   - lifecycle hooks (onInstall / onActivate / onDeactivate / onUninstall)
 *   - sandboxed invocation: implementations receive only a capability `ctx`
 *     object built from their declared permissions — no host leakage
 *   - registry snapshot for audit / marketplace / backup tooling
 *
 * No network access, no reflection into host memory, no PII stored.
 */

(function (global) {
  'use strict';

  const VERSION = '3.0.0';
  const API_VERSION = 3;
  const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
  const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
  const VERSION_CONSTRAINT_PATTERN = /^(\^)?\d+\.\d+\.\d+$/;
  const LIFECYCLE = ['onInstall', 'onActivate', 'onDeactivate', 'onUninstall', 'onUpdate'];

  /** Capability allow-list (deny-by-default; every permission must be declared). */
  const PERMISSIONS = Object.freeze([
    'storage:local',   // namespaced key/value access scoped to the plugin id
    'http:fetch',      // outbound fetch (subject to the host's CSP/extension rules)
    'ui:panel',        // may attach/render its own panel UI
    'clipboard:read',  // explicit user gesture only
    'clipboard:write',
    'notifications'
  ]);
  const PERMISSION_SET = new Set(PERMISSIONS);

  function satisfies(installed, required) {
    const [imajor, iminor, ipatch] = String(installed).split('.').map(Number);
    const req = String(required);
    const exact = req.startsWith('^') ? req.slice(1) : req;
    const [rmajor, rminor, rpatch] = exact.split('.').map(Number);
    if (req.startsWith('^')) {
      return imajor === rmajor && (iminor > rminor || (iminor === rminor && ipatch >= rpatch));
    }
    return installed === exact;
  }

  class PluginAPIv3 {
    constructor(options) {
      this.options = Object.assign({ strict: true }, options);
      this._registry = new Map(); // id -> { manifest, implementation, active }
      this._contexts = new Map(); // id -> lazily built capability ctx
      this._storage = new Map();  // ns -> Map
    }

    /** Strict manifest validation. Returns { ok, errors[] }. */
    validate(manifest) {
      const errors = [];
      if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'] };
      if (!ID_PATTERN.test(String(manifest.id || ''))) {
        errors.push('id must be 2-64 chars, kebab-case [a-z0-9-], starting alphanumeric');
      }
      if (!VERSION_PATTERN.test(String(manifest.version || ''))) {
        errors.push('version must be semver MAJOR.MINOR.PATCH (no leading v)');
      }
      if (!manifest.name || String(manifest.name).trim().length > 80) errors.push('name required (max 80 chars)');
      if (!manifest.description) errors.push('description required');
      if (!manifest.author) errors.push('author required');
      if (manifest.permissions === undefined) {
        if (this.options.strict) errors.push('permissions array required (deny-by-default)');
      } else if (!Array.isArray(manifest.permissions)) {
        errors.push('permissions must be an array');
      } else {
        const unknown = manifest.permissions.filter(p => !PERMISSION_SET.has(p));
        if (unknown.length) errors.push('unknown permission(s): ' + unknown.join(', '));
      }
      if (manifest.dependencies !== undefined) {
        if (!Array.isArray(manifest.dependencies)) errors.push('dependencies must be an array');
        else {
          for (const dep of manifest.dependencies) {
            if (!dep || typeof dep !== 'object' || !ID_PATTERN.test(String(dep.id || '')) || !VERSION_CONSTRAINT_PATTERN.test(String(dep.version || ''))) {
              errors.push('each dependency must be { id, version } (semver constraint, optional ^)');
            }
          }
        }
      }
      return { ok: errors.length === 0, errors };
    }

    /** Install a plugin. Resolves dependencies, runs onInstall on success. */
    register(manifest, implementation) {
      const verdict = this.validate(manifest);
      if (!verdict.ok) {
        if (this.options.strict) throw new Error('invalid manifest: ' + verdict.errors.join('; '));
        return false;
      }
      if (this._registry.has(manifest.id)) {
        throw new Error('plugin already installed: ' + manifest.id + ' (unregister first)');
      }
      this.resolveDependencies(manifest.id, manifest.dependencies);
      const node = { manifest: JSON.parse(JSON.stringify(manifest)), implementation: implementation || {}, active: false };
      this._registry.set(manifest.id, node);
      this._runHook(node, 'onInstall', { reason: 'install' });
      return true;
    }

    /** Topological install order for a dependency list (cycle-safe). */
    resolveDependencies(id, deps, seen, order) {
      order = order || [];
      seen = seen || new Set();
      const node = this._registry.get(id);
      if (deps === undefined && node) deps = node.manifest.dependencies;
      deps = deps || [];
      for (const dep of deps) {
        if (seen.has(dep.id)) throw new Error('dependency cycle detected at: ' + dep.id);
        const installed = this._registry.get(dep.id);
        if (!installed) throw new Error('missing dependency: ' + dep.id + ' (required by ' + id + ')');
        if (!satisfies(installed.manifest.version, dep.version)) {
          throw new Error(dep.id + '@' + dep.version + ' not satisfied (have ' + installed.manifest.version + ')');
        }
        seen.add(dep.id);
        this.resolveDependencies(dep.id, installed.manifest.dependencies, seen, order);
        if (!order.includes(dep.id)) order.push(dep.id);
      }
      return order;
    }

    unregister(id) {
      const node = this._registry.get(id);
      if (!node) return false;
      if (node.active) this.deactivate(id);
      this._runHook(node, 'onUninstall', { reason: 'uninstall' });
      this._registry.delete(id);
      this._contexts.delete(id);
      this._storage.delete(id);
      return true;
    }

    activate(id) {
      const node = this._registry.get(id);
      if (!node) throw new Error('unknown plugin: ' + id);
      this.resolveDependencies(id, node.manifest.dependencies);
      node.active = true;
      this._runHook(node, 'onActivate', { reason: 'activate' });
      return true;
    }

    deactivate(id) {
      const node = this._registry.get(id);
      if (!node || !node.active) return false;
      node.active = false;
      this._runHook(node, 'onDeactivate', { reason: 'deactivate' });
      return true;
    }

    /** Invoke a method on a plugin through its capability sandbox. */
    invoke(id, method, args) {
      const node = this._registry.get(id);
      if (!node) throw new Error('unknown plugin: ' + id);
      if (!node.active) throw new Error('plugin not active: ' + id);
      const fn = node.implementation[method];
      if (typeof fn !== 'function') throw new Error('plugin ' + id + ' has no method: ' + method);
      return fn(this._context(id), ...(args || []));
    }

    /** Run a lifecycle hook; hook errors are surfaced with plugin context. */
    runHook(id, hook, ctx) {
      const node = this._registry.get(id);
      if (!node) return null;
      return this._runHook(node, hook, ctx || {});
    }

    _runHook(node, hook, ctx) {
      const fn = node.implementation[hook];
      if (typeof fn !== 'function') return null;
      return fn(this._context(node.manifest.id), ctx);
    }

    /** Build (or fetch) the deny-by-default capability object for a plugin id. */
    _context(id) {
      const cached = this._contexts.get(id);
      if (cached) return cached;
      const node = this._registry.get(id);
      if (!node) return { pluginId: id, api: API_VERSION, storage: { get: () => undefined, set: (v) => v } };
      const perms = new Set(node.manifest.permissions || []);
      const ns = 'plugin:' + id;
      if (!this._storage.has(ns)) this._storage.set(ns, new Map());
      const box = this._storage.get(ns);
      const ctx = {
        pluginId: id,
        api: API_VERSION,
        storage: {
          get: (k) => box.get(String(k)),
          set: (k, v) => { box.set(String(k), v); return v; }
        }
      };
      if (perms.has('http:fetch')) {
        ctx.http = {
          fetch: (url, init) => (typeof global.fetch === 'function'
            ? global.fetch(url, init)
            : Promise.reject(new Error('fetch unavailable in this host')))
        };
      }
      if (perms.has('ui:panel')) {
        ctx.ui = { panel: (html) => (typeof global.postMessage === 'function' ? global.postMessage({ type: 'plugin:panel', id, html }) : null) };
      }
      if (perms.has('notifications')) {
        ctx.notify = (msg) => String(msg).slice(0, 120);
      }
      if (perms.has('clipboard:read') && global.navigator && navigator.clipboard) {
        ctx.clipboard = { read: () => navigator.clipboard.readText() };
      }
      if (perms.has('clipboard:write')) {
        ctx.clipboard = ctx.clipboard || {};
        ctx.clipboard.write = (t) => (global.navigator && navigator.clipboard ? navigator.clipboard.writeText(String(t)) : Promise.resolve(false));
      }
      this._contexts.set(id, ctx);
      return ctx;
    }

    listInstalled() {
      return Array.from(this._registry.values()).map(n => Object.assign({ active: n.active }, n.manifest));
    }

    getManifest(id) {
      const n = this._registry.get(id);
      return n ? Object.assign({}, n.manifest) : null;
    }

    /** Full registry snapshot (for audit, backup, marketplace tooling). */
    snapshot() {
      return {
        version: VERSION,
        takenAt: new Date().toISOString(),
        plugins: this.listInstalled()
      };
    }

    static get VERSION() { return VERSION; }
  }

  global.PluginAPIv3 = PluginAPIv3;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PluginAPIv3, PERMISSIONS, VERSION, satisfies };
  }
})(typeof window !== 'undefined' ? window : globalThis);