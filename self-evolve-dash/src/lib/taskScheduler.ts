// Background Task Scheduler
// Executes tasks from the queue, runs on the engine interval

import { taskQueue, BackgroundTask, BackgroundTaskType } from './taskQueue';
import { checkBackendHealth } from './connectionUtils';
import { providerScorer } from './providerScorer';
import { applyImprovement } from './codeGenUtils';
import { localPatcher } from './localPatcher';
import { analyticsTracker } from './analyticsTracker';

const TASKS_PER_CYCLE = 3;

type TaskHandler = (task: BackgroundTask) => Promise<string>;

const handlers: Record<BackgroundTaskType, TaskHandler> = {
  HEALTH_CHECK: async () => {
    const startMs = performance.now();
    const health = await checkBackendHealth();
    const latency = Math.round(performance.now() - startMs);
    if (health.healthy) {
      providerScorer.recordSuccess('health-check', latency);
    } else {
      providerScorer.recordFailure('health-check');
    }
    return health.healthy
      ? `Healthy (latency: ${health.latency}ms)`
      : `Unhealthy (latency: ${health.latency}ms)`;
  },

  CACHE_WARM: async () => {
    // Warm localStorage caches by reading key entries
    const keys = ['autonomous_engine_state_v2', 'self_improvement_suggestions', 'executed_improvements_v2'];
    let warmed = 0;
    for (const key of keys) {
      try {
        const val = localStorage.getItem(key);
        if (val) warmed++;
      } catch { /* ignore */ }
    }
    return `Warmed ${warmed}/${keys.length} cache entries`;
  },

  ROUTER_TUNE: async () => {
    // Evaluate cycle speed vs success rate and recommend adjustment
    const stateRaw = localStorage.getItem('autonomous_engine_state_v2');
    if (!stateRaw) return 'No engine state to tune';
    try {
      const state = JSON.parse(stateRaw);
      const successRate = state.cycleCount > 0
        ? Math.round((state.successCount / state.cycleCount) * 100)
        : 0;
      const currentSpeed = state.cycleSpeed || 'normal';
      let recommendation = currentSpeed;
      if (successRate > 80) recommendation = 'turbo';
      else if (successRate > 50) recommendation = 'fast';
      else if (successRate < 20) recommendation = 'slow';
      return `Success: ${successRate}%, Speed: ${currentSpeed}, Recommended: ${recommendation}`;
    } catch {
      return 'Failed to parse engine state';
    }
  },

  PROVIDER_SCORE_UPDATE: async () => {
    providerScorer.logScores();
    const scores = providerScorer.getAllScores();
    const entries = Object.entries(scores);
    if (entries.length === 0) return 'No providers tracked yet';
    const best = entries.sort(([, a], [, b]) => b.score - a.score)[0];
    return `Best: ${best[0]} (score=${best[1].score.toFixed(4)}, ${entries.length} providers tracked)`;
  },

  SCRIPT_UPGRADE: async (task) => {
    const { suggestion, filePath, moduleId, currentCode } = task.payload || {};
    if (!suggestion || !filePath) {
      throw new Error('SCRIPT_UPGRADE missing suggestion/filePath payload');
    }

    // Resolve current code from the dev server if not supplied (works in Lovable preview)
    let baseCode = currentCode as string | undefined;
    if (!baseCode) {
      try {
        const res = await fetch(filePath.startsWith('/') ? filePath : `/${filePath}`);
        if (res.ok) baseCode = await res.text();
      } catch { /* offline — pass undefined */ }
    }

    const result = await applyImprovement(suggestion, filePath, baseCode, true);
    if (!result?.success || !result.code) {
      const reason = result?.error || (result?.fallback ? `fallback (retry in ${result.retryAfter}s)` : 'unknown');
      throw new Error(`AI apply failed: ${reason}`);
    }

    // Hot-patch the running module via blob URL
    const id = moduleId || filePath.replace(/^.*\/(.*?)\.[tj]sx?$/, '$1');
    const ok = await localPatcher.applyPatch(id, result.code);
    if (!ok) throw new Error(`localPatcher.applyPatch failed for ${id}`);

    analyticsTracker.track('script_upgrade_applied', 'scheduler', 1, {
      moduleId: id, filePath, title: suggestion.title, confidence: result.confidence,
    });

    return `Upgraded ${id} (${result.code.length} bytes, conf ${result.confidence ?? '—'}%)`;
  },
};

let initialized = false;

/** Run one scheduler tick — execute up to TASKS_PER_CYCLE ready tasks */
export async function runSchedulerTick(): Promise<number> {
  const ready = taskQueue.getReady(TASKS_PER_CYCLE);
  if (ready.length === 0) return 0;

  console.log(`[Scheduler] Tick: ${ready.length} task(s) ready`);

  let executed = 0;
  for (const task of ready) {
    taskQueue.markRunning(task.id);
    const handler = handlers[task.type];
    if (!handler) {
      taskQueue.markFailed(task.id, `No handler for type: ${task.type}`);
      continue;
    }
    try {
      const result = await handler(task);
      taskQueue.markCompleted(task.id, result);
      executed++;
    } catch (err: any) {
      taskQueue.markFailed(task.id, err?.message || 'Unknown error');
    }
  }

  return executed;
}

/** Seed initial background tasks */
export function seedInitialTasks() {
  if (initialized) return;
  initialized = true;

  console.log('[Scheduler] Seeding initial background tasks');
  taskQueue.addTask('HEALTH_CHECK', 90, { maxRetries: 5, cooldownMs: 10000 });
  taskQueue.addTask('ROUTER_TUNE', 50, { maxRetries: 3, cooldownMs: 15000 });
  taskQueue.addTask('CACHE_WARM', 20, { maxRetries: 2, cooldownMs: 20000 });
  taskQueue.addTask('PROVIDER_SCORE_UPDATE', 40, { maxRetries: 3, cooldownMs: 12000 });
}

/** Re-seed recurring tasks (call after each cycle to keep them going) */
export function requeueRecurringTasks() {
  taskQueue.requeue('HEALTH_CHECK', 90, { maxRetries: 5, cooldownMs: 10000 });
  taskQueue.requeue('ROUTER_TUNE', 50, { maxRetries: 3, cooldownMs: 15000 });
  taskQueue.requeue('CACHE_WARM', 20, { maxRetries: 2, cooldownMs: 20000 });
  taskQueue.requeue('PROVIDER_SCORE_UPDATE', 40, { maxRetries: 3, cooldownMs: 12000 });
}

export function resetScheduler() {
  initialized = false;
  taskQueue.clear();
}
