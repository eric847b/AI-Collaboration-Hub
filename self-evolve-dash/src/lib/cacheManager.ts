/**
 * Advanced caching system with per-entry TTL, true LRU eviction,
 * hit/miss metrics, safe sizing, and a periodic sweep for expired entries.
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
  lastAccess: number;
  size: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number = 50 * 1024 * 1024; // 50MB default
  private currentSize: number = 0;
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;
  private sweepHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof setInterval !== 'undefined') {
      this.sweepHandle = setInterval(() => this.sweep(), 60_000);
      (this.sweepHandle as any)?.unref?.();
    }
  }

  /** Estimate byte size of a value safely (handles circular refs). */
  private estimateSize(value: unknown): number {
    try {
      const seen = new WeakSet();
      const json = JSON.stringify(value, (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      });
      return (json?.length ?? 0) * 2; // UTF-16
    } catch {
      return 1024; // fallback estimate
    }
  }

  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    const size = this.estimateSize(value);

    // Reject items that can never fit on their own
    if (size > this.maxSize) {
      console.warn(`[cacheManager] entry "${key}" (${size}B) exceeds maxSize; not cached`);
      return;
    }

    // Remove old entry if it exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentSize -= oldEntry.size;
      this.cache.delete(key);
    }

    // Evict until there is room
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + Math.max(0, ttl),
      hits: 0,
      lastAccess: now,
      size,
    });
    this.currentSize += size;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.expirations++;
      this.misses++;
      return null;
    }

    // True LRU: re-insert to move to most-recent end of Map
    entry.hits++;
    entry.lastAccess = Date.now();
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.expirations++;
      return false;
    }
    return true;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /** Remove all expired entries. Returns the number removed. */
  sweep(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.currentSize -= entry.size;
        this.cache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.expirations += removed;
      console.log(`[cacheManager] sweep removed ${removed} expired entries`);
    }
    return removed;
  }

  private evictLRU(): void {
    // Map preserves insertion order. We re-insert on every get(), so the
    // first key is the genuine least-recently-used entry.
    const oldestKey = this.cache.keys().next().value as string | undefined;
    if (oldestKey) {
      this.delete(oldestKey);
      this.evictions++;
    }
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      sizeMB: Math.round((this.currentSize / 1024 / 1024) * 100) / 100,
      maxSizeMB: Math.round((this.maxSize / 1024 / 1024) * 100) / 100,
      usage: Math.round((this.currentSize / this.maxSize) * 100),
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
      evictions: this.evictions,
      expirations: this.expirations,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  setMaxSize(sizeInMB: number): void {
    this.maxSize = sizeInMB * 1024 * 1024;
    while (this.currentSize > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  setDefaultTTL(ttlInMs: number): void {
    this.defaultTTL = ttlInMs;
  }

  /** Stop the periodic sweep (mainly for tests / teardown). */
  destroy(): void {
    if (this.sweepHandle) {
      clearInterval(this.sweepHandle);
      this.sweepHandle = null;
    }
  }
}

export const cacheManager = new CacheManager();
