// ImprovementExecutor - Manages execution of improvements with full metrics

import { localStorageManager } from "../localStorageManager";
import { analyticsTracker } from "../analyticsTracker";
import { EXECUTORS, getExecutorKey, getExecutorCategory, getExecutorPriority } from "./executors";
import type { ExecutedImprovement, ExecutorStats, ImprovementCategory } from "./types";

const EXECUTED_KEY = "executed_improvements_v2";
const EXECUTION_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export class ImprovementExecutor {
  private executed: ExecutedImprovement[] = [];
  private executionTimes: number[] = [];

  constructor() {
    this.loadExecuted();
  }

  private loadExecuted() {
    try {
      const raw = localStorageManager.get(EXECUTED_KEY);
      if (raw) this.executed = JSON.parse(raw);
    } catch {
      this.executed = [];
    }
  }

  private saveExecuted() {
    localStorageManager.set(EXECUTED_KEY, JSON.stringify(this.executed.slice(-200)));
  }

  async execute(title: string, target: string): Promise<{
    success: boolean;
    result: string;
    alreadyExecuted?: boolean;
    executionTime?: number;
  }> {
    const key = getExecutorKey(title);
    if (!key) {
      return { success: false, result: `No handler for: "${title}"` };
    }

    // Check cooldown
    const recent = this.executed.find(
      e => e.key === key && e.success && Date.now() - e.executedAt < EXECUTION_COOLDOWN_MS
    );
    if (recent) {
      return { success: true, result: "Recently executed — skipping", alreadyExecuted: true };
    }

    const executor = EXECUTORS[key];
    if (!executor) {
      return { success: false, result: `Executor missing: ${key}` };
    }

    const startTime = performance.now();
    
    try {
      const result = await executor();
      const executionTime = performance.now() - startTime;
      this.executionTimes.push(executionTime);
      if (this.executionTimes.length > 100) this.executionTimes.shift();

      const record: ExecutedImprovement = {
        id: `${key}-${Date.now()}`,
        title,
        key,
        target,
        executedAt: Date.now(),
        success: result.success,
        result: result.result,
        metrics: result.metrics
      };

      this.executed.unshift(record);
      this.saveExecuted();

      analyticsTracker.track("improvement_executed", "executor", 1, {
        key, title, target, success: true, executionTime
      });

      return { ...result, executionTime };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      const record: ExecutedImprovement = {
        id: `${key}-${Date.now()}`,
        title,
        key,
        target,
        executedAt: Date.now(),
        success: false,
        error: errorMsg
      };

      this.executed.unshift(record);
      this.saveExecuted();

      analyticsTracker.track("improvement_executed", "executor", 0, {
        key, title, target, error: errorMsg
      });

      return { success: false, result: errorMsg, executionTime };
    }
  }

  canExecute(title: string): boolean {
    return getExecutorKey(title) !== null;
  }

  getExecutableKey(title: string): string | null {
    return getExecutorKey(title);
  }

  getExecutedImprovements(): ExecutedImprovement[] {
    return [...this.executed];
  }

  getRecentExecutions(hours = 1): ExecutedImprovement[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.executed.filter(e => e.executedAt > cutoff);
  }

  getStats(): ExecutorStats {
    const total = this.executed.length;
    const successful = this.executed.filter(e => e.success).length;
    const recentHour = this.getRecentExecutions(1);

    const byCategory: Record<ImprovementCategory, number> = {
      performance: 0, ux: 0, reliability: 0, security: 0, developer: 0, analytics: 0
    };

    for (const exec of this.executed) {
      const cat = getExecutorCategory(exec.key) as ImprovementCategory;
      if (cat in byCategory) byCategory[cat]++;
    }

    const avgTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
      : 0;

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      recentCount: recentHour.length,
      lastExecution: this.executed[0]?.executedAt
        ? new Date(this.executed[0].executedAt).toISOString()
        : null,
      byCategory,
      averageExecutionTime: Math.round(avgTime)
    };
  }

  getAvailableImprovements(): string[] {
    return Object.keys(EXECUTORS);
  }

  getUnexecutedImprovements(): string[] {
    const executedKeys = new Set(this.executed.filter(e => e.success).map(e => e.key));
    return Object.keys(EXECUTORS).filter(k => !executedKeys.has(k));
  }

  getPriorityQueue(): Array<{ key: string; priority: number; category: string }> {
    return this.getUnexecutedImprovements()
      .map(key => ({
        key,
        priority: getExecutorPriority(key),
        category: getExecutorCategory(key)
      }))
      .sort((a, b) => b.priority - a.priority);
  }

  clearHistory() {
    this.executed = [];
    this.executionTimes = [];
    this.saveExecuted();
    analyticsTracker.track("improvement_history_cleared", "executor", 1);
  }
}

export const improvementExecutor = new ImprovementExecutor();
