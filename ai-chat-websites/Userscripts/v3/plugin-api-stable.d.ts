/**
 * TypeScript declarations for v3/plugin-api-stable.js (opt-in — Q2 2027 #13).
 * Consumers that don't use TypeScript can ignore this file.
 */

export interface PluginManifest {
  id: string;
  version: string;             // semver MAJOR.MINOR.PATCH
  name: string;
  description: string;
  author: string;
  permissions?: string[];      // subset of PERMISSIONS (deny-by-default)
  dependencies?: Array<{ id: string; version: string }>;
}

export interface PluginStorage {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}

export interface PluginContext {
  pluginId: string;
  api: number;
  storage: PluginStorage;
  http?: { fetch(url: string, init?: object): Promise<Response> };
  ui?: { panel(html: string): unknown };
  notify?: (message: string) => unknown;
  clipboard?: { write(text: string): Promise<boolean> };
}

export interface PluginImplementation {
  onInstall?(ctx: PluginContext, payload: unknown): unknown;
  onActivate?(ctx: PluginContext, payload: unknown): unknown;
  onDeactivate?(ctx: PluginContext, payload: unknown): unknown;
  onUninstall?(ctx: PluginContext, payload: unknown): unknown;
  [method: string]: unknown;
}

export declare class PluginAPIv3 {
  static readonly VERSION: string;
  constructor(options?: { strict?: boolean });
  validate(manifest: unknown): { ok: boolean; errors: string[] };
  register(manifest: PluginManifest, implementation: PluginImplementation): boolean;
  unregister(id: string): boolean;
  activate(id: string): boolean;
  deactivate(id: string): boolean;
  resolveDependencies(id: string, deps?: Array<{ id: string; version: string }>, seen?: Set<string>): string[];
  invoke(id: string, method: string, args?: unknown[]): unknown;
  runHook(id: string, hook: string, ctx?: unknown): unknown;
  listInstalled(): Array<PluginManifest & { active: boolean }>;
  getManifest(id: string): PluginManifest | null;
  snapshot(): { version: string; takenAt: string; plugins: Array<PluginManifest & { active: boolean }> };
}

export const PERMISSIONS: readonly string[];
export const VERSION: string;
export declare function satisfies(installed: string, required: string): boolean;