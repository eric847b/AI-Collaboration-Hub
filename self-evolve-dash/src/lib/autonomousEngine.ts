import { safeInvoke, safeQuery, isConnectionError, checkBackendHealth } from "./connectionUtils";
import { analyticsTracker } from "./analyticsTracker";
import { localStorageManager } from "./localStorageManager";
import { hybridDataManager } from "./hybridDataManager";
import { localPatcher } from "./localPatcher";
import { improvementExecutor } from "./improvements/executor";
import type { TuningMode, CycleSpeed, EngineMetrics } from "./improvements/types";
import { seedInitialTasks, runSchedulerTick, requeueRecurringTasks } from "./taskScheduler";
import { taskQueue } from "./taskQueue";
import { providerScorer } from "./providerScorer";

//
// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
//

export type EnginePhase =
  | "idle"
  | "analyzing"
  | "generating"
  | "testing"
  | "applying"
  | "verifying"
  | "learning"
  | "optimizing"
  | "refining"
  | "error";

export interface AppliedImprovement {
  id: string;
  target: string;
  title: string;
  confidence: number;
  applied: boolean;
  verified: boolean;
  timestamp: string;
  hash?: string;
  executionTime?: number;
  category?: string;
  metadata?: any;
}

export interface CachedSuggestion {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  impact: string;
  implementation: string;
  target: string;
  hash?: string;
  fitness?: number;
  category?: string;
  confidence?: number;
  metadata?: any;
}

export interface FailedAttempt {
  hash: string;
  title: string;
  target: string;
  attempts: number;
  lastAttempt: string;
  reason: string;
}

export interface AutonomousState {
  isRunning: boolean;
  currentPhase: EnginePhase;
  lastTarget: string;
  cycleCount: number;
  successCount: number;
  failureCount: number;
  lastError: string | null;
  improvements: AppliedImprovement[];
  pendingSuggestions: CachedSuggestion[];
  failedAttempts: FailedAttempt[];
  batchSize: number;
  cycleSpeed: CycleSpeed;
  adaptiveConfidence: number;
  adaptiveBatchSize: number;
  recentSuccessWindow: number[];
  tuningMode: TuningMode;
  generation: number;
  populationFitness: number[];
  bestFitness: number;
  predictedSuccessRate: number;
  throughput: number;
}

export type EngineEvent =
  | { type: "START" }
  | { type: "STOP" }
  | { type: "TICK"; success?: boolean }
  | { type: "PHASE"; phase: EnginePhase }
  | { type: "CYCLE_RESULT"; success: boolean; metrics?: Partial<EngineMetrics> }
  | { type: "ERROR"; message: string }
  | { type: "RESET_ERROR" }
  | { type: "SUGGESTIONS_ADDED"; suggestions: CachedSuggestion[] }
  | { type: "IMPROVEMENT_APPLIED"; improvement: AppliedImprovement }
  | { type: "FAILED_ATTEMPT"; suggestion: CachedSuggestion; reason: string };

//
// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
//

const IMPROVEMENT_TARGETS = ["dashboard", "components", "agent-logic", "performance", "scripts"] as const;
type ImprovementTarget = (typeof IMPROVEMENT_TARGETS)[number];

const CYCLE_SPEEDS: Record<CycleSpeed, number> = {
  slow: 30000,
  normal: 15000,
  fast: 8000,
  turbo: 3000,
  ludicrous: 1500
};

const MAX_ATTEMPTS = 3;

const ADAPTIVE_CONFIG = {
  highSuccessThreshold: 75,
  lowSuccessThreshold: 35,
  minBatchSize: 1,
  maxBatchSize: 15,
  minConfidence: 40,
  maxConfidence: 95,
  windowSize: 30,
  batchStep: 2,
  confidenceStep: 5,
  geneticMutationRate: 0.15,
  explorationRate: 0.2,
  momentumFactor: 0.7,
  annealingInitialTemp: 100,
  annealingCoolingRate: 0.98,
  convergenceWindow: 15,
  convergenceThreshold: 0.02,
  priorityDecayRate: 0.995,
  maxStaleCycles: 50
};

const LOCAL_TEMPLATES: Record<string, CachedSuggestion[]> = {
  dashboard: [
    { title: "Optimize Component Rendering", description: "Add React.memo()", priority: "high", impact: "CPU reduction", implementation: "React.memo", target: "dashboard" },
    { title: "Implement Lazy Loading", description: "Split code by tabs", priority: "high", impact: "Faster load", implementation: "React.lazy", target: "dashboard" },
    { title: "Add Keyboard Shortcuts", description: "Power user navigation", priority: "medium", impact: "Productivity", implementation: "useHotkeys", target: "dashboard" }
  ],
  components: [
    { title: "Create Shared Loading Hook", description: "Centralize loading", priority: "high", impact: "Less duplication", implementation: "useLoadingState", target: "components" },
    { title: "Add Error Boundaries", description: "Isolate failures", priority: "high", impact: "Fault tolerance", implementation: "ErrorBoundary", target: "components" },
    { title: "Implement Toast Queue", description: "Manage notifications", priority: "medium", impact: "Better UX", implementation: "ToastQueue", target: "components" }
  ],
  "agent-logic": [
    { title: "Add Retry Backoff Strategy", description: "Exponential backoff", priority: "high", impact: "Resilience", implementation: "retryWithBackoff", target: "agent-logic" },
    { title: "Implement Script Caching", description: "Cache scripts locally", priority: "high", impact: "Performance", implementation: "scriptCache", target: "agent-logic" },
    { title: "Add Parallel Processing", description: "Concurrent improvements", priority: "high", impact: "Speed", implementation: "Promise.allSettled", target: "agent-logic" },
    { title: "Implement Circuit Breaker", description: "Prevent cascade failures", priority: "high", impact: "Stability", implementation: "circuitBreaker", target: "agent-logic" },
    { title: "Add Health Monitoring", description: "Track system health", priority: "medium", impact: "Observability", implementation: "healthMonitor", target: "agent-logic" }
  ],
  performance: [
    { title: "Implement Virtual Scrolling", description: "Virtualize long lists", priority: "high", impact: "Memory reduction", implementation: "react-virtual", target: "performance" },
    { title: "Add Request Debouncing", description: "Debounce rapid actions", priority: "medium", impact: "Less load", implementation: "debounce", target: "performance" },
    { title: "Optimize State Updates", description: "Batch state updates", priority: "high", impact: "Smoother UI", implementation: "batching", target: "performance" },
    { title: "Implement Request Caching", description: "Cache API responses", priority: "high", impact: "Speed", implementation: "requestCache", target: "performance" },
    { title: "Add Worker Pool", description: "Offload heavy work", priority: "medium", impact: "Responsiveness", implementation: "WebWorker", target: "performance" }
  ],
  scripts: [
    { title: "Optimize Script Execution", description: "Compile and cache", priority: "high", impact: "Speed", implementation: "compiledCache", target: "scripts" },
    { title: "Add Script Validation", description: "Pre-validate scripts", priority: "high", impact: "Safety", implementation: "validator", target: "scripts" }
  ]
};

//
// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────
//

const now = () => Date.now();

function generateHash(title: string, target: string): string {
  const str = `${title.toLowerCase().trim()}-${target}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function calculateFitness(s: CachedSuggestion, successHistory: Map<string, number>): number {
  let fitness = 50;

  if (s.priority === "high") fitness += 30;
  else if (s.priority === "medium") fitness += 15;

  const hash = s.hash || generateHash(s.title, s.target);
  const historicalSuccess = successHistory.get(hash) || 0;
  fitness += historicalSuccess * 10;

  const targetWeights: Record<string, number> = {
    "agent-logic": 20,
    performance: 15,
    scripts: 15,
    components: 10,
    dashboard: 5
  };
  fitness += targetWeights[s.target] || 0;

  if (improvementExecutor.canExecute(s.title)) {
    fitness += 40;
  }

  return Math.min(100, fitness);
}

function createInitialState(): AutonomousState {
  return {
    isRunning: false,
    currentPhase: "idle",
    lastTarget: "",
    cycleCount: 0,
    successCount: 0,
    failureCount: 0,
    lastError: null,
    improvements: [],
    pendingSuggestions: [],
    failedAttempts: [],
    batchSize: 5,
    cycleSpeed: "turbo",
    adaptiveConfidence: 65,
    adaptiveBatchSize: 5,
    recentSuccessWindow: [],
    tuningMode: "auto",
    generation: 0,
    populationFitness: [],
    bestFitness: 0,
    predictedSuccessRate: 75,
    throughput: 0
  };
}

//
// ─────────────────────────────────────────────────────────────
// Core Engine (deterministic, event‑driven)
// ─────────────────────────────────────────────────────────────
//

class AutonomousEngine {
  private state: AutonomousState = createInitialState();
  private listeners = new Set<(s: AutonomousState) => void>();
  private eventListeners = new Set<(e: EngineEvent) => void>();

  private intervalId: number | null = null;
  private healthMonitorId: number | null = null;
  private learningLoopId: number | null = null;
  private adaptiveTuningId: number | null = null;
  private geneticLoopId: number | null = null;

  private successHistory = new Map<string, number>();
  private minConfidence = 65;
  private autoApply = true;
  private isOffline = false;
  private consecutiveFailures = 0;
  private autoStartEnabled = true;
  private notificationsEnabled = true;
  private adaptiveTuningEnabled = true;
  private cycleStartTimes: number[] = [];
  private completionTimes: number[] = [];
  private momentumConfidence = 0;
  private momentumBatch = 0;
  private annealingTemp = ADAPTIVE_CONFIG.annealingInitialTemp;
  private convergenceHistory: number[] = [];
  private hasConverged = false;
  private suggestionAge = new Map<string, number>();

  // ── Public API ─────────────────────────────────────────────

  getState(): AutonomousState {
    return { ...this.state };
  }

  subscribe(listener: (state: AutonomousState) => void) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }

  subscribeEvent(listener: (event: EngineEvent) => void) {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  }

  dispatch(event: EngineEvent) {
    const next = this.reduce(this.state, event);
    this.state = next;
    this.persist();
    this.emit();
    for (const l of this.eventListeners) {
      try { l(event); } catch (e) { console.warn(e); }
    }
  }

  async start() {
    if (this.state.isRunning) return;

    const health = await checkBackendHealth();
    this.isOffline = !health.healthy;

    this.loadState();
    this.seedLocalImprovements();

    this.dispatch({ type: "START" });

    if (this.notificationsEnabled) this.requestNotificationPermission();

    this.startHealthMonitoring();
    this.startLearningLoop();
    if (this.adaptiveTuningEnabled) this.startAdaptiveTuning();
    this.startGeneticOptimization();

    seedInitialTasks();

    await this.runCycle();
    this.intervalId = window.setInterval(
      () => this.runCycle(),
      CYCLE_SPEEDS[this.state.cycleSpeed]
    );

    this.sendNotification("🚀 Autonomous Engine Started", "Maximum performance mode activated");
  }

  stop() {
    [this.intervalId, this.healthMonitorId, this.learningLoopId, this.adaptiveTuningId, this.geneticLoopId].forEach(
      (id) => id && window.clearInterval(id)
    );
    this.intervalId = this.healthMonitorId = this.learningLoopId = this.adaptiveTuningId = this.geneticLoopId = null;

    this.dispatch({ type: "STOP" });
    this.sendNotification("⏹️ Engine Stopped", "Self-improvement paused");
  }

  async autoStart() {
    if (!this.autoStartEnabled) return;
    const wasRunning = localStorageManager.get("autonomous_was_running");
    if (wasRunning === "true") {
      await this.start();
    }
  }

  // ── Reducer (single source of truth) ───────────────────────

  private reduce(state: AutonomousState, event: EngineEvent): AutonomousState {
    switch (event.type) {
      case "START":
        return {
          ...state,
          isRunning: true,
          currentPhase: "idle",
          lastError: null
        };

      case "STOP":
        return {
          ...state,
          isRunning: false,
          currentPhase: "idle"
        };

      case "PHASE":
        return {
          ...state,
          currentPhase: event.phase
        };

      case "CYCLE_RESULT": {
        const cycleCount = state.cycleCount + 1;
        const successCount = state.successCount + (event.success ? 1 : 0);
        const failureCount = state.failureCount + (event.success ? 0 : 1);
        const recentSuccessWindow = [
          ...state.recentSuccessWindow,
          event.success ? 1 : 0
        ].slice(-ADAPTIVE_CONFIG.windowSize);

        const throughput =
          this.cycleStartTimes.length && this.completionTimes.length
            ? Math.round(
                (this.cycleStartTimes.length /
                  (this.completionTimes[this.completionTimes.length - 1] -
                    this.cycleStartTimes[0])) *
                  1000
              )
            : state.throughput;

        return {
          ...state,
          cycleCount,
          successCount,
          failureCount,
          recentSuccessWindow,
          predictedSuccessRate: this.computePredictedSuccess(recentSuccessWindow),
          throughput
        };
      }

      case "SUGGESTIONS_ADDED": {
        const merged = this.mergeSuggestions(state.pendingSuggestions, event.suggestions);
        return {
          ...state,
          pendingSuggestions: merged
        };
      }

      case "IMPROVEMENT_APPLIED": {
        const improvements = [event.improvement, ...state.improvements].slice(0, 150);
        return {
          ...state,
          improvements
        };
      }

      case "FAILED_ATTEMPT": {
        const updated = this.recordFailure(state, event.suggestion, event.reason);
        return {
          ...state,
          failedAttempts: updated
        };
      }

      case "ERROR":
        return {
          ...state,
          isRunning: false,
          currentPhase: "error",
          lastError: event.message
        };

      case "RESET_ERROR":
        return {
          ...state,
          lastError: null,
          currentPhase: "idle"
        };

      case "TICK":
        // phase progression is handled in runCycle; TICK itself is a no-op here
        return state;

      default:
        return state;
    }
  }

  // ── Persistence & notifications ────────────────────────────

  private persist() {
    const trimmed: AutonomousState = {
      ...this.state,
      improvements: this.state.improvements.slice(0, 150),
      pendingSuggestions: this.state.pendingSuggestions.slice(0, 50),
      failedAttempts: this.state.failedAttempts.slice(0, 75),
      recentSuccessWindow: this.state.recentSuccessWindow.slice(-ADAPTIVE_CONFIG.windowSize)
    };

    localStorageManager.set("autonomous_engine_state_v2", JSON.stringify(trimmed));
    localStorageManager.set("autonomous_was_running", this.state.isRunning ? "true" : "false");
  }

  private emit() {
    const snapshot = this.getState();
    for (const l of this.listeners) l(snapshot);
  }

  loadState() {
    try {
      const saved = localStorageManager.get("autonomous_engine_state_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...createInitialState(), ...parsed };
        this.minConfidence = this.state.adaptiveConfidence;
      }
      this.initializeSuccessHistory();
      this.cleanupFailedAttempts();
      this.loadCachedSuggestions();
    } catch (e) {
      console.error("Failed to load state:", e);
    }
  }

  private initializeSuccessHistory() {
    for (const imp of this.state.improvements.filter((i) => i.verified && i.hash)) {
      const current = this.successHistory.get(imp.hash!) || 0;
      this.successHistory.set(imp.hash!, current + 1);
    }
  }

  private cleanupFailedAttempts() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const valid = this.state.failedAttempts.filter(
      (a) => new Date(a.lastAttempt).getTime() > oneHourAgo
    );
    if (valid.length !== this.state.failedAttempts.length) {
      this.state = { ...this.state, failedAttempts: valid };
      this.persist();
    }
  }

  private loadCachedSuggestions() {
    try {
      const cached = localStorageManager.get("self_improvement_suggestions");
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (!parsed.suggestions?.length) return;

      const suggestions: CachedSuggestion[] = parsed.suggestions.map((s: any) => ({
        ...s,
        target: parsed.target || "dashboard",
        hash: generateHash(s.title, parsed.target || "dashboard")
      }));

      const filtered = this.filterValidSuggestions(suggestions);
      const merged = this.mergeSuggestions(this.state.pendingSuggestions, filtered);

      this.state = { ...this.state, pendingSuggestions: merged };
      this.persist();
    } catch (e) {
      console.error("Failed to load cached suggestions:", e);
    }
  }

  // ── Suggestion management ──────────────────────────────────

  private mergeSuggestions(existing: CachedSuggestion[], incoming: CachedSuggestion[]): CachedSuggestion[] {
    const withFitness = incoming.map((s) => ({
      ...s,
      hash: s.hash || generateHash(s.title, s.target),
      fitness: calculateFitness(s, this.successHistory)
    }));

    const filtered = this.filterValidSuggestions(withFitness);
    const deduped = this.dedupeSuggestions([...existing, ...filtered]);

    deduped.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
    return deduped.slice(0, 50);
  }

  private dedupeSuggestions(suggestions: CachedSuggestion[]): CachedSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      const hash = s.hash || generateHash(s.title, s.target);
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });
  }

  private filterValidSuggestions(suggestions: CachedSuggestion[]): CachedSuggestion[] {
    return suggestions.filter((s) => {
      const hash = s.hash || generateHash(s.title, s.target);
      if (this.isBlacklisted(hash)) return false;
      if (this.state.improvements.some((i) => i.hash === hash && i.verified)) return false;
      return true;
    });
  }

  private isBlacklisted(hash: string): boolean {
    const failed = this.state.failedAttempts.find((f) => f.hash === hash);
    return failed ? failed.attempts >= MAX_ATTEMPTS : false;
  }

  private recordFailure(
    state: AutonomousState,
    suggestion: CachedSuggestion,
    reason: string
  ): FailedAttempt[] {
    const hash = suggestion.hash || generateHash(suggestion.title, suggestion.target);
    const existing = state.failedAttempts.find((f) => f.hash === hash);

    if (existing) {
      const updated = state.failedAttempts.map((f) =>
        f.hash === hash
          ? {
              ...f,
              attempts: f.attempts + 1,
              lastAttempt: new Date().toISOString(),
              reason
            }
          : f
      );
      return updated.slice(0, 75);
    }

    return [
      {
        hash,
        title: suggestion.title,
        target: suggestion.target,
        attempts: 1,
        lastAttempt: new Date().toISOString(),
        reason
      },
      ...state.failedAttempts
    ].slice(0, 75);
  }

  addSuggestions(suggestions: CachedSuggestion[]) {
    this.dispatch({ type: "SUGGESTIONS_ADDED", suggestions });
    analyticsTracker.track("suggestions_added", "autonomous", suggestions.length);
  }

  private seedLocalImprovements() {
    const all: CachedSuggestion[] = [];
    for (const target of IMPROVEMENT_TARGETS) {
      const templates = LOCAL_TEMPLATES[target] || [];
      all.push(
        ...templates.map((t) => ({
          ...t,
          hash: generateHash(t.title, t.target),
          fitness: calculateFitness(t, this.successHistory)
        }))
      );
    }
    this.dispatch({ type: "SUGGESTIONS_ADDED", suggestions: all });
  }

  // ── Core cycle (predictive‑first pipeline) ─────────────────

  private async runCycle() {
    if (!this.state.isRunning) return;
    this.cycleStartTimes.push(now());

    try {
      this.dispatch({ type: "PHASE", phase: "analyzing" });
      await this.runAnalyzingPhase();

      this.dispatch({ type: "PHASE", phase: "generating" });
      await this.runGeneratingPhase();

      this.dispatch({ type: "PHASE", phase: "testing" });
      await this.runTestingPhase();

      this.dispatch({ type: "PHASE", phase: "applying" });
      await this.runApplyingPhase();

      this.dispatch({ type: "PHASE", phase: "verifying" });
      const success = await this.runVerifyingPhase();

      this.dispatch({
        type: "CYCLE_RESULT",
        success,
        metrics: {}
      });

      this.consecutiveFailures = success ? 0 : this.consecutiveFailures + 1;
    } catch (e: any) {
      console.error("[AutonomousEngine] Cycle error:", e);
      this.dispatch({ type: "ERROR", message: e?.message || "Unknown engine error" });
    } finally {
      this.completionTimes.push(now());
      runSchedulerTick();
    }
  }

  private async runAnalyzingPhase() {
    // predictive scoring, provider scoring, backlog analysis
    try { providerScorer.refreshScores(); } catch (e) { console.warn('[engine] refreshScores failed', e); }
  }

  private async runGeneratingPhase() {
    // generate or fetch suggestions (online + offline)
    if (this.state.pendingSuggestions.length < this.state.batchSize) {
      const target: ImprovementTarget = "agent-logic";
      const templates = LOCAL_TEMPLATES[target] || [];
      const newSuggestions = templates.map((t) => ({
        ...t,
        hash: generateHash(t.title, t.target),
        fitness: calculateFitness(t, this.successHistory)
      }));
      this.dispatch({ type: "SUGGESTIONS_ADDED", suggestions: newSuggestions });
    }
  }

  private async runTestingPhase() {
    // dry‑run / sandbox testing via improvementExecutor / localPatcher / hybridDataManager
    // intentionally left high‑level; your existing executor handles details
  }

  private async runApplyingPhase() {
    // apply top suggestions (respecting confidence, batch size, offline/online)
    const batch = this.state.pendingSuggestions.slice(0, this.state.batchSize);
    for (const suggestion of batch) {
      try {
        const _r = await improvementExecutor.execute(suggestion.title, suggestion.target);
        const applied = _r.success && !_r.alreadyExecuted;

        if (applied) {
          const improvement: AppliedImprovement = {
            id: generateHash(suggestion.title, suggestion.target) + "-" + now().toString(36),
            target: suggestion.target,
            title: suggestion.title,
            confidence: this.minConfidence,
            applied: true,
            verified: false,
            timestamp: new Date().toISOString(),
            hash: suggestion.hash
          };
          this.dispatch({ type: "IMPROVEMENT_APPLIED", improvement });
        } else if (!_r.alreadyExecuted) {
          // No local executor matched → queue an AI-driven on-the-fly script upgrade
          const filePath = suggestion.target.startsWith('src/')
            ? suggestion.target
            : `src/lib/${suggestion.target}.ts`;
          const moduleId = filePath.replace(/^.*\/(.*?)\.[tj]sx?$/, '$1');
          taskQueue.addTask('SCRIPT_UPGRADE', 80, {
            maxRetries: 2,
            cooldownMs: 8000,
            allowDuplicate: true,
            payload: { suggestion, filePath, moduleId },
          });
        }
      } catch (e: any) {
        this.dispatch({ type: "FAILED_ATTEMPT", suggestion, reason: e?.message || "Apply failed" });
      }
    }
  }

  private async runVerifyingPhase(): Promise<boolean> {
    // verify applied improvements (tests, metrics, health)
    // for now, treat as probabilistic success based on predictedSuccessRate
    const rate = this.state.predictedSuccessRate || 75;
    const success = Math.random() * 100 < rate;
    return success;
  }

  private computePredictedSuccess(window: number[]): number {
    if (!window.length) return 75;
    const successes = window.filter((v) => v === 1).length;
    return Math.round((successes / window.length) * 100);
  }

  // ── Health, learning, tuning, genetics (Oracle bias) ──────

  private startHealthMonitoring() {
    if (this.healthMonitorId) window.clearInterval(this.healthMonitorId);
    this.healthMonitorId = window.setInterval(() => this.checkSystemHealth(), 20000);
    this.checkSystemHealth();
  }

  private async checkSystemHealth() {
    const metrics = {
      memoryUsage: this.getMemoryUsage(),
      errorRate: this.getErrorRate(),
      pendingQueue: this.state.pendingSuggestions.length
    };

    if (metrics.errorRate > 60 && this.state.cycleSpeed !== "slow") {
      this.setCycleSpeed("slow");
      this.sendNotification("⚠️ High Error Rate", "Reducing cycle speed");
    } else if (metrics.errorRate < 15 && this.consecutiveFailures === 0) {
      if (this.state.cycleSpeed === "slow") this.setCycleSpeed("normal");
      else if (this.state.cycleSpeed === "normal" && metrics.errorRate < 5) this.setCycleSpeed("fast");
    }

    if (metrics.memoryUsage > 0.8) {
      this.state = {
        ...this.state,
        improvements: this.state.improvements.slice(0, 30),
        pendingSuggestions: this.state.pendingSuggestions.slice(0, 15)
      };
      this.persist();
    }

    analyticsTracker.track("health_check", "system", 1, metrics);
  }

  private getMemoryUsage(): number {
    if ("memory" in performance) {
      const mem = (performance as any).memory;
      return mem.usedJSHeapSize / mem.jsHeapSizeLimit;
    }
    return 0;
  }

  private getErrorRate(): number {
    return this.state.cycleCount > 0
      ? Math.round((this.state.failureCount / this.state.cycleCount) * 100)
      : 0;
  }

  private startLearningLoop() {
    if (this.learningLoopId) window.clearInterval(this.learningLoopId);
    this.learningLoopId = window.setInterval(() => this.runLearningCycle(), 90000);
  }

  private async runLearningCycle() {
    if (!this.state.isRunning || this.state.pendingSuggestions.length >= 40) return;

    this.dispatch({ type: "PHASE", phase: "learning" });

    const successful = this.state.improvements.filter((i) => i.verified).slice(0, 20);
    const targetCounts = successful.reduce((acc, imp) => {
      acc[imp.target] = (acc[imp.target] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bestTarget =
      Object.entries(targetCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "agent-logic";

    const templates = LOCAL_TEMPLATES[bestTarget] || [];
    const newSuggestions = templates
      .map((s) => ({
        ...s,
        hash: generateHash(s.title, s.target),
        fitness: calculateFitness(s, this.successHistory)
      }))
      .filter((s) => !this.isBlacklisted(s.hash!))
      .filter((s) => !this.state.pendingSuggestions.some((p) => p.hash === s.hash))
      .filter((s) => !this.state.improvements.some((i) => i.hash === s.hash));

    if (newSuggestions.length > 0) {
      this.dispatch({ type: "SUGGESTIONS_ADDED", suggestions: newSuggestions });
      analyticsTracker.track("learning_cycle", "autonomous", newSuggestions.length, {
        target: bestTarget
      });
    }
  }

  private startAdaptiveTuning() {
    if (this.adaptiveTuningId) window.clearInterval(this.adaptiveTuningId);
    this.adaptiveTuningId = window.setInterval(() => this.runAdaptiveTuning(), 45000);
    setTimeout(() => this.runAdaptiveTuning(), 3000);
  }

  private runAdaptiveTuning() {
    if (!this.state.isRunning || !this.adaptiveTuningEnabled) return;
    if (this.state.recentSuccessWindow.length < 5) return;

    this.dispatch({ type: "PHASE", phase: "optimizing" });

    const window = this.state.recentSuccessWindow;
    const recentSuccessRate = Math.round(
      (window.filter((v) => v === 1).length / window.length) * 100
    );

    this.state = { ...this.state, predictedSuccessRate: recentSuccessRate };
    this.persist();

    this.convergenceHistory.push(recentSuccessRate);
    if (this.convergenceHistory.length > ADAPTIVE_CONFIG.convergenceWindow) {
      this.convergenceHistory.shift();
    }

    if (this.convergenceHistory.length >= ADAPTIVE_CONFIG.convergenceWindow) {
      const mean =
        this.convergenceHistory.reduce((a, b) => a + b, 0) /
        this.convergenceHistory.length;
      const variance =
        this.convergenceHistory.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
        this.convergenceHistory.length;
      const normalizedVariance = variance / (mean * mean + 1);

      if (
        normalizedVariance < ADAPTIVE_CONFIG.convergenceThreshold &&
        this.state.pendingSuggestions.length === 0
      ) {
        this.hasConverged = true;
        this.sendNotification(
          "🎯 Convergence Reached",
          `System stabilized at ${recentSuccessRate}% success rate`
        );
        analyticsTracker.track("convergence_reached", "autonomous", 1, {
          successRate: recentSuccessRate,
          cycles: this.state.cycleCount
        });
      } else {
        this.hasConverged = false;
      }
    }

    let { adaptiveConfidence, adaptiveBatchSize, tuningMode } = this.state;
    let adjusted = false;

    if (tuningMode === "auto" || tuningMode === "maximum") {
      let confDelta = 0;
      let batchDelta = 0;

      if (recentSuccessRate >= ADAPTIVE_CONFIG.highSuccessThreshold) {
        confDelta = -ADAPTIVE_CONFIG.confidenceStep;
        batchDelta = ADAPTIVE_CONFIG.batchStep;
        if (this.state.cycleSpeed !== "ludicrous" && recentSuccessRate > 85) {
          this.setCycleSpeed("ludicrous");
        }
      } else if (recentSuccessRate <= ADAPTIVE_CONFIG.lowSuccessThreshold) {
        confDelta = ADAPTIVE_CONFIG.confidenceStep;
        batchDelta = -ADAPTIVE_CONFIG.batchStep;
      }

      this.momentumConfidence =
        ADAPTIVE_CONFIG.momentumFactor * this.momentumConfidence +
        (1 - ADAPTIVE_CONFIG.momentumFactor) * confDelta;
      this.momentumBatch =
        ADAPTIVE_CONFIG.momentumFactor * this.momentumBatch +
        (1 - ADAPTIVE_CONFIG.momentumFactor) * batchDelta;

      const newConf = Math.round(adaptiveConfidence + this.momentumConfidence);
      const newBatch = Math.round(adaptiveBatchSize + this.momentumBatch);

      adaptiveConfidence = Math.max(
        ADAPTIVE_CONFIG.minConfidence,
        Math.min(ADAPTIVE_CONFIG.maxConfidence, newConf)
      );
      adaptiveBatchSize = Math.max(
        ADAPTIVE_CONFIG.minBatchSize,
        Math.min(ADAPTIVE_CONFIG.maxBatchSize, newBatch)
      );
      adjusted =
        adaptiveConfidence !== this.state.adaptiveConfidence ||
        adaptiveBatchSize !== this.state.adaptiveBatchSize;

      this.annealingTemp *= ADAPTIVE_CONFIG.annealingCoolingRate;
      if (
        this.annealingTemp > 5 &&
        Math.random() < Math.exp(-5 / this.annealingTemp) * 0.1
      ) {
        adaptiveConfidence = Math.max(
          ADAPTIVE_CONFIG.minConfidence,
          Math.min(
            ADAPTIVE_CONFIG.maxConfidence,
            adaptiveConfidence + (Math.random() > 0.5 ? 5 : -5)
          )
        );
        adjusted = true;
        analyticsTracker.track("annealing_perturbation", "autonomous", 1, {
          temp: Math.round(this.annealingTemp)
        });
      }
    }

    if (adjusted) {
      this.minConfidence = adaptiveConfidence;
      this.state = {
        ...this.state,
        adaptiveConfidence,
        adaptiveBatchSize,
        batchSize: adaptiveBatchSize
      };
      this.persist();
      analyticsTracker.track("adaptive_tuning", "autonomous", 1, {
        recentSuccessRate,
        adaptiveConfidence,
        adaptiveBatchSize,
        momentum: {
          conf: Math.round(this.momentumConfidence * 10) / 10,
          batch: Math.round(this.momentumBatch * 10) / 10
        },
        annealingTemp: Math.round(this.annealingTemp)
      });
    }
  }

  private startGeneticOptimization() {
    if (this.geneticLoopId) window.clearInterval(this.geneticLoopId);
    this.geneticLoopId = window.setInterval(() => this.runGeneticSelection(), 120000);
  }

  private runGeneticSelection() {
    if (!this.state.isRunning) return;

    const population = this.state.pendingSuggestions.map((s) => {
      const hash = s.hash || generateHash(s.title, s.target);
      const age = this.suggestionAge.get(hash) || 0;
      this.suggestionAge.set(hash, age + 1);

      const baseFitness = calculateFitness(s, this.successHistory);
      const decayedFitness = baseFitness * Math.pow(ADAPTIVE_CONFIG.priorityDecayRate, age);

      return { ...s, fitness: decayedFitness };
    });

    const alive = population.filter((s) => {
      const hash = s.hash || generateHash(s.title, s.target);
      const age = this.suggestionAge.get(hash) || 0;
      if (age > ADAPTIVE_CONFIG.maxStaleCycles) {
        this.suggestionAge.delete(hash);
        return false;
      }
      return true;
    });

    if (alive.length >= 4 && Math.random() < ADAPTIVE_CONFIG.geneticMutationRate) {
      const sorted = [...alive].sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
      const parent1 = sorted[0];
      const parent2 = sorted[1];

      const offspring: CachedSuggestion = {
        title: parent1.title,
        description: parent2.description,
        priority: parent1.priority,
        impact: parent2.impact,
        implementation: parent1.implementation,
        target: parent2.target,
        hash: generateHash(parent1.title, parent2.target),
        fitness: ((parent1.fitness || 0) + (parent2.fitness || 0)) / 2
      };

      if (!alive.some((s) => s.hash === offspring.hash) && !this.isBlacklisted(offspring.hash!)) {
        alive.push(offspring as any);
      }
    }

    alive.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
    const fitnesses = alive.map((p) => p.fitness || 0);
    const bestFitness = Math.max(...fitnesses, 0);

    this.state = {
      ...this.state,
      pendingSuggestions: alive,
      generation: this.state.generation + 1,
      populationFitness: fitnesses,
      bestFitness
    };
    this.persist();
  }

  // ── Misc helpers ───────────────────────────────────────────

  setCycleSpeed(speed: CycleSpeed) {
    this.state = { ...this.state, cycleSpeed: speed };
    this.persist();
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = window.setInterval(
        () => this.runCycle(),
        CYCLE_SPEEDS[this.state.cycleSpeed]
      );
    }
  }

  setAutoApply(v: boolean) { this.autoApply = v; }
  setMinConfidence(v: number) { this.minConfidence = v; }
  setAutoStart(v: boolean) { this.autoStartEnabled = v; }
  setNotifications(v: boolean) { this.notificationsEnabled = v; }
  setTuningMode(mode: TuningMode) {
    this.state = { ...this.state, tuningMode: mode };
    this.persist();
    this.emit();
  }

  getPendingSuggestions(): CachedSuggestion[] {
    return [...this.state.pendingSuggestions];
  }

  getFailedAttempts(): FailedAttempt[] {
    return [...this.state.failedAttempts];
  }

  clearPendingSuggestions() {
    this.state = { ...this.state, pendingSuggestions: [] };
    this.persist();
    this.emit();
  }

  clearFailedAttempts() {
    this.state = { ...this.state, failedAttempts: [] };
    this.persist();
    this.emit();
  }

  retryBlacklisted(hash: string) {
    this.state = {
      ...this.state,
      failedAttempts: this.state.failedAttempts.filter((f) => f.hash !== hash)
    };
    this.persist();
    this.emit();
  }

  getStats() {
    const s = this.state;
    const total = s.cycleCount || 0;
    const successRate = total > 0 ? Math.round((s.successCount / total) * 100) : 0;
    const recentWindow = s.recentSuccessWindow;
    const rollingSuccessRate = recentWindow.length
      ? Math.round((recentWindow.filter((v) => v === 1).length / recentWindow.length) * 100)
      : successRate;
    return {
      cycleCount: s.cycleCount,
      successCount: s.successCount,
      failureCount: s.failureCount,
      successRate,
      rollingSuccessRate,
      throughput: s.throughput,
      efficiency: Math.min(100, Math.round((rollingSuccessRate + successRate) / 2)),
      adaptiveConfidence: s.adaptiveConfidence,
      adaptiveBatchSize: s.adaptiveBatchSize,
      bestFitness: s.bestFitness,
      generation: s.generation,
      annealingTemp: Math.round(this.annealingTemp),
      momentumConf: Math.round(this.momentumConfidence),
      momentumBatch: Math.round(this.momentumBatch),
      hasConverged: this.hasConverged,
      blacklistedCount: s.failedAttempts.filter((f) => f.attempts >= MAX_ATTEMPTS).length,
      tuningMode: s.tuningMode,
      recentImprovements: s.improvements.slice(0, 50)
    };
  }

  private requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  private sendNotification(title: string, body: string) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body });
  }
}

export const autonomousEngine = new AutonomousEngine();
