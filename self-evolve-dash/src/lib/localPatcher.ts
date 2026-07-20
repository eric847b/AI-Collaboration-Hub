// localPatcher.ts - Dynamic Code Patching System
import { localStorageManager } from "./localStorageManager";
import { analyticsTracker } from "./analyticsTracker";

interface PatchedModule {
  id: string;
  originalUrl: string;
  patchedCode: string;
  timestamp: number;
  hash: string;
  applied: boolean;
  verified?: boolean;
  metrics?: { before: number; after: number };
}

const PATCHED_MODULES_KEY = "autonomous_patches_v3";

// Fast hash function for deduplication
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

class LocalPatcher {
  private patches = new Map<string, PatchedModule>();
  private blobUrls = new Map<string, string>();

  constructor() {
    this.loadPatches();
    this.setupPatchInterceptor();
  }

  private loadPatches() {
    try {
      const raw = localStorageManager.get(PATCHED_MODULES_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        for (const p of loaded) {
          this.patches.set(p.id, p);
        }
        console.log(`[LocalPatcher] Loaded ${this.patches.size} patches`);
      }
    } catch (e) {
      console.warn("[LocalPatcher] Failed to load patches:", e);
    }
  }

  private savePatches() {
    const arr = Array.from(this.patches.values());
    localStorageManager.set(PATCHED_MODULES_KEY, JSON.stringify(arr));
  }

  private setupPatchInterceptor() {
    // Initialize global patch registry
    if (!("__PATCHED_MODULES__" in window)) {
      (window as any).__PATCHED_MODULES__ = {};
    }

    // Re-apply any previously saved patches
    for (const [moduleId, patch] of this.patches) {
      if (patch.applied && patch.patchedCode) {
        this.createBlobUrl(moduleId, patch.patchedCode);
      }
    }
  }

  private createBlobUrl(moduleId: string, code: string): string {
    // Clean up old blob URL if exists
    const oldUrl = this.blobUrls.get(moduleId);
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }

    const blob = new Blob([code], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrls.set(moduleId, blobUrl);
    (window as any).__PATCHED_MODULES__[moduleId] = blobUrl;
    
    return blobUrl;
  }

  // Apply a patch to a module
  async applyPatch(moduleId: string, newCode: string): Promise<boolean> {
    try {
      const hash = cyrb53(newCode);

      // Check if same patch already applied
      const existing = this.patches.get(moduleId);
      if (existing && existing.hash === hash && existing.applied) {
        console.log(`[LocalPatcher] Patch ${moduleId} already applied with same hash`);
        return true;
      }

      // Create blob URL for the patched code
      this.createBlobUrl(moduleId, newCode);

      // Save patch
      this.patches.set(moduleId, {
        id: moduleId,
        originalUrl: this.getOriginalUrl(moduleId),
        patchedCode: newCode,
        timestamp: Date.now(),
        hash,
        applied: true,
      });
      this.savePatches();

      // Notify about the patch
      await this.reloadModuleInAllContexts(moduleId);

      analyticsTracker.track("local_patch_applied", "patcher", 1, { moduleId, hash });
      console.log(`[LocalPatcher] Applied patch to ${moduleId}`);
      
      return true;
    } catch (error) {
      console.error(`[LocalPatcher] Failed to apply patch to ${moduleId}:`, error);
      analyticsTracker.track("local_patch_failed", "patcher", 0, { moduleId, error: String(error) });
      return false;
    }
  }

  // Verify a patch was successful
  async verifyPatch(moduleId: string, testFn?: () => Promise<boolean>): Promise<boolean> {
    const patch = this.patches.get(moduleId);
    if (!patch || !patch.applied) {
      return false;
    }

    try {
      if (testFn) {
        const result = await testFn();
        patch.verified = result;
        this.savePatches();
        return result;
      }

      // Default verification: check if blob URL is still valid
      const blobUrl = this.blobUrls.get(moduleId);
      patch.verified = !!blobUrl;
      this.savePatches();
      return patch.verified;
    } catch (error) {
      patch.verified = false;
      this.savePatches();
      return false;
    }
  }

  // Record performance metrics before/after patch
  recordMetrics(moduleId: string, before: number, after: number) {
    const patch = this.patches.get(moduleId);
    if (patch) {
      patch.metrics = { before, after };
      this.savePatches();
      
      const improvement = before > 0 ? ((before - after) / before * 100).toFixed(1) : "N/A";
      console.log(`[LocalPatcher] ${moduleId} metrics: ${before}ms → ${after}ms (${improvement}% improvement)`);
    }
  }

  private getOriginalUrl(moduleId: string): string {
    const map: Record<string, string> = {
      "autonomousEngine": "/src/lib/autonomousEngine.ts",
      "dashboard": "/src/components/Dashboard.tsx",
      "connectionUtils": "/src/lib/connectionUtils.ts",
      "analyticsTracker": "/src/lib/analyticsTracker.ts",
      "localStorageManager": "/src/lib/localStorageManager.ts",
      "cacheManager": "/src/lib/cacheManager.ts",
      "hybridDataManager": "/src/lib/hybridDataManager.ts",
      "trustUtils": "/src/lib/trustUtils.ts",
      "systemUtils": "/src/lib/systemUtils.ts",
    };
    return map[moduleId] || `/src/lib/${moduleId}.ts`;
  }

  private async reloadModuleInAllContexts(moduleId: string) {
    // Dispatch custom event for hot replacement
    const event = new CustomEvent("autonomous:patch-applied", {
      detail: { moduleId, forceReload: true, timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    // Also store in cache API for persistence
    if ("caches" in window) {
      try {
        const cache = await caches.open("autonomous-patches");
        const patch = this.patches.get(moduleId);
        if (patch?.patchedCode) {
          await cache.put(
            new Request(`/__patch__/${moduleId}`),
            new Response(patch.patchedCode, {
              headers: { "Content-Type": "application/javascript" }
            })
          );
        }
      } catch (e) {
        // Cache API not available, continue without it
      }
    }
  }

  // Rollback a specific patch
  async rollbackPatch(moduleId: string): Promise<boolean> {
    try {
      const patch = this.patches.get(moduleId);
      if (!patch) {
        return false;
      }

      // Clean up blob URL
      const blobUrl = this.blobUrls.get(moduleId);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        this.blobUrls.delete(moduleId);
      }

      // Remove from global registry
      delete (window as any).__PATCHED_MODULES__[moduleId];

      // Remove from patches
      this.patches.delete(moduleId);
      this.savePatches();

      // Clear from cache
      if ("caches" in window) {
        try {
          const cache = await caches.open("autonomous-patches");
          await cache.delete(new Request(`/__patch__/${moduleId}`));
        } catch (e) {
          // Ignore cache errors
        }
      }

      analyticsTracker.track("local_patch_rolled_back", "patcher", 1, { moduleId });
      console.log(`[LocalPatcher] Rolled back patch: ${moduleId}`);
      
      return true;
    } catch (error) {
      console.error(`[LocalPatcher] Failed to rollback ${moduleId}:`, error);
      return false;
    }
  }

  // Get all patches
  getAllPatches(): PatchedModule[] {
    return Array.from(this.patches.values());
  }

  // Get specific patch
  getPatch(moduleId: string): PatchedModule | undefined {
    return this.patches.get(moduleId);
  }

  // Check if module is patched
  isPatched(moduleId: string): boolean {
    const patch = this.patches.get(moduleId);
    return patch?.applied ?? false;
  }

  // Clear all patches
  async clearAllPatches(): Promise<void> {
    // Clean up blob URLs
    for (const [moduleId, blobUrl] of this.blobUrls) {
      URL.revokeObjectURL(blobUrl);
      delete (window as any).__PATCHED_MODULES__[moduleId];
    }
    this.blobUrls.clear();
    this.patches.clear();
    this.savePatches();

    // Clear cache
    if ("caches" in window) {
      try {
        await caches.delete("autonomous-patches");
      } catch (e) {
        // Ignore
      }
    }

    analyticsTracker.track("local_patches_cleared", "patcher", 1);
    console.log("[LocalPatcher] All patches cleared");
  }

  // Get patch statistics
  getStats() {
    const patches = this.getAllPatches();
    const verified = patches.filter(p => p.verified).length;
    const withMetrics = patches.filter(p => p.metrics);
    const avgImprovement = withMetrics.length > 0
      ? withMetrics.reduce((sum, p) => {
          if (p.metrics && p.metrics.before > 0) {
            return sum + ((p.metrics.before - p.metrics.after) / p.metrics.before * 100);
          }
          return sum;
        }, 0) / withMetrics.length
      : 0;

    return {
      total: patches.length,
      applied: patches.filter(p => p.applied).length,
      verified,
      avgImprovement: avgImprovement.toFixed(1),
      oldestPatch: patches.length > 0 
        ? new Date(Math.min(...patches.map(p => p.timestamp))).toISOString()
        : null,
      newestPatch: patches.length > 0
        ? new Date(Math.max(...patches.map(p => p.timestamp))).toISOString()
        : null,
    };
  }
}

export const localPatcher = new LocalPatcher();
