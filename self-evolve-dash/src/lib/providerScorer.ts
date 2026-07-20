// Provider Scoring System v2
// Merged intelligence from Smart Router AI:
//   - EWMA latency (responsive without losing history)
//   - Rolling-window rate limits per provider
//   - Exponential cooldown instead of permanent skip
//   - ε-greedy exploration so under-used providers can recover
//   - lastError surface + status (healthy/degraded/down/cooldown)
//   - Persistence + subscribers for UI reactivity

export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'cooldown' | 'unknown';

export interface ProviderMetrics {
  successCount: number;
  failureCount: number;
  totalLatency: number;
  avgLatency: number;          // EWMA
  consecutiveFailures: number;
  lastUsed: number;
  lastError?: string;
  status: ProviderStatus;
  cooldownUntil: number;       // epoch ms; 0 = no cooldown
  recentRequests: number[];    // timestamps within window
  maxRequestsPerHour: number;
}

const STORAGE_KEY = 'providerScorer.v2';
const RATE_WINDOW_MS = 60 * 60 * 1000;
const EWMA_ALPHA = 0.3;
const BASE_COOLDOWN_MS = 15 * 1000;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;
const DEGRADED_AFTER = 2;
const DOWN_AFTER = 5;
const EXPLORATION_RATE = 0.08; // ε-greedy

type Listener = () => void;

class ProviderScorer {
  private providers: Map<string, ProviderMetrics> = new Map();
  private listeners = new Set<Listener>();
  private rateLimits: Record<string, number> = {};

  constructor() {
    this.load();
  }

  // ---------- persistence ----------
  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, ProviderMetrics>;
      for (const [k, v] of Object.entries(parsed || {})) {
        this.providers.set(k, {
          recentRequests: [],
          maxRequestsPerHour: Infinity,
          status: 'unknown',
          cooldownUntil: 0,
          ...v,
        });
      }
    } catch { /* ignore corrupt cache */ }
  }

  private persist() {
    try {
      const obj: Record<string, ProviderMetrics> = {};
      for (const [k, v] of this.providers.entries()) obj[k] = v;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch { /* quota — ignore */ }
  }

  // ---------- subscribers ----------
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    for (const fn of [...this.listeners]) {
      try { fn(); } catch (e) { console.warn('[ProviderScorer] listener error', e); }
    }
  }

  // ---------- config ----------
  setRateLimit(provider: string, maxPerHour: number) {
    this.rateLimits[provider] = maxPerHour;
    const m = this.providers.get(provider);
    if (m) m.maxRequestsPerHour = maxPerHour;
  }

  // ---------- core ----------
  private getOrCreate(provider: string): ProviderMetrics {
    let m = this.providers.get(provider);
    if (!m) {
      m = {
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        avgLatency: 0,
        consecutiveFailures: 0,
        lastUsed: 0,
        status: 'unknown',
        cooldownUntil: 0,
        recentRequests: [],
        maxRequestsPerHour: this.rateLimits[provider] ?? Infinity,
      };
      this.providers.set(provider, m);
    }
    return m;
  }

  private trimWindow(m: ProviderMetrics) {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    if (m.recentRequests.length > 0) {
      m.recentRequests = m.recentRequests.filter((t) => t >= cutoff);
    }
  }

  private cooldownFor(consecutive: number): number {
    const ms = BASE_COOLDOWN_MS * Math.pow(2, Math.max(0, consecutive - DEGRADED_AFTER));
    return Math.min(ms, MAX_COOLDOWN_MS);
  }

  recordSuccess(provider: string, latencyMs: number) {
    const m = this.getOrCreate(provider);
    const now = Date.now();
    m.successCount++;
    m.totalLatency += latencyMs;
    m.avgLatency = m.avgLatency
      ? m.avgLatency * (1 - EWMA_ALPHA) + latencyMs * EWMA_ALPHA
      : latencyMs;
    m.consecutiveFailures = 0;
    m.lastUsed = now;
    m.lastError = undefined;
    m.cooldownUntil = 0;
    m.status = 'healthy';
    m.recentRequests.push(now);
    this.trimWindow(m);
    this.persist();
    this.notify();
  }

  recordFailure(provider: string, error?: string) {
    const m = this.getOrCreate(provider);
    const now = Date.now();
    m.failureCount++;
    m.consecutiveFailures++;
    m.lastUsed = now;
    if (error) m.lastError = error.slice(0, 240);
    m.recentRequests.push(now);
    this.trimWindow(m);

    if (m.consecutiveFailures >= DOWN_AFTER) {
      m.status = 'down';
      m.cooldownUntil = now + this.cooldownFor(m.consecutiveFailures);
    } else if (m.consecutiveFailures >= DEGRADED_AFTER) {
      m.status = 'cooldown';
      m.cooldownUntil = now + this.cooldownFor(m.consecutiveFailures);
    } else {
      m.status = 'degraded';
    }
    this.persist();
    this.notify();
  }

  getProviderScore(provider: string): number {
    const m = this.providers.get(provider);
    if (!m) return 0.5; // optimistic for unknown
    const total = m.successCount + m.failureCount;
    const successRate = total > 0 ? m.successCount / total : 0.5;
    // latencyScore in (0,1]: 100ms=1.0, 1s=0.5, 10s=~0.09
    const latencyScore = 1 / (1 + (m.avgLatency || 250) / 1000);
    // recency bonus: providers untouched for >5min get small +
    const idleBonus = m.lastUsed && (Date.now() - m.lastUsed) > 5 * 60 * 1000 ? 0.05 : 0;
    return successRate * 0.65 + latencyScore * 0.30 + idleBonus;
  }

  isAvailable(provider: string): boolean {
    const m = this.providers.get(provider);
    if (!m) return true;
    if (m.cooldownUntil > Date.now()) return false;
    this.trimWindow(m);
    if (m.recentRequests.length >= m.maxRequestsPerHour) return false;
    return true;
  }

  /** Best available provider, with ε-greedy exploration. */
  selectBest(candidates: string[]): string | null {
    if (candidates.length === 0) return null;

    // Reap expired cooldowns first
    const now = Date.now();
    for (const p of candidates) {
      const m = this.providers.get(p);
      if (m && m.cooldownUntil > 0 && m.cooldownUntil <= now) {
        m.cooldownUntil = 0;
        m.status = 'degraded';
      }
    }

    const available = candidates.filter((p) => this.isAvailable(p));
    if (available.length === 0) {
      // Everyone cooling down — pick the one closest to recovery
      const soonest = candidates
        .map((p) => ({ p, m: this.getOrCreate(p) }))
        .sort((a, b) => (a.m.cooldownUntil || 0) - (b.m.cooldownUntil || 0))[0];
      console.warn(`[ProviderScorer] all in cooldown — emergency pick ${soonest.p}`);
      return soonest.p;
    }

    // ε-greedy exploration
    if (available.length > 1 && Math.random() < EXPLORATION_RATE) {
      const explore = available[Math.floor(Math.random() * available.length)];
      console.log(`[ProviderScorer] EXPLORE ${explore}`);
      return explore;
    }

    let best = available[0];
    let bestScore = this.getProviderScore(best);
    for (let i = 1; i < available.length; i++) {
      const s = this.getProviderScore(available[i]);
      if (s > bestScore) { bestScore = s; best = available[i]; }
    }
    return best;
  }

  /** Refresh derived state — called by scheduler. Reaps expired cooldowns. */
  refreshScores(): void {
    const now = Date.now();
    let changed = false;
    for (const m of this.providers.values()) {
      if (m.cooldownUntil > 0 && m.cooldownUntil <= now) {
        m.cooldownUntil = 0;
        m.status = m.consecutiveFailures > 0 ? 'degraded' : 'healthy';
        changed = true;
      }
      this.trimWindow(m);
    }
    if (changed) { this.persist(); this.notify(); }
  }

  reset(provider?: string) {
    if (provider) this.providers.delete(provider);
    else this.providers.clear();
    this.persist();
    this.notify();
  }

  getAllScores(): Record<string, { score: number; metrics: ProviderMetrics }> {
    const out: Record<string, { score: number; metrics: ProviderMetrics }> = {};
    for (const [name, metrics] of this.providers.entries()) {
      out[name] = { score: this.getProviderScore(name), metrics: { ...metrics } };
    }
    return out;
  }

  logScores() {
    const entries = Object.entries(this.getAllScores())
      .sort(([, a], [, b]) => b.score - a.score);
    console.log('[ProviderScorer] --- v2 scores ---');
    for (const [name, { score, metrics }] of entries) {
      console.log(
        `  ${name}: score=${score.toFixed(3)} status=${metrics.status} ` +
        `s/f=${metrics.successCount}/${metrics.failureCount} ` +
        `lat=${Math.round(metrics.avgLatency)}ms ` +
        `cd=${metrics.cooldownUntil > Date.now() ? Math.round((metrics.cooldownUntil - Date.now())/1000)+'s' : '-'}`
      );
    }
  }
}

export const providerScorer = new ProviderScorer();
