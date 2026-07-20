// Controlled Background Task Queue
// Typed tasks, priority sorting, exponential backoff, retry/blacklist,
// auto-GC of finished tasks, safe pub/sub, and cancel/remove APIs.

export type BackgroundTaskType =
  | 'HEALTH_CHECK'
  | 'CACHE_WARM'
  | 'ROUTER_TUNE'
  | 'PROVIDER_SCORE_UPDATE'
  | 'SCRIPT_UPGRADE';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cooldown';

export interface BackgroundTask {
  id: string;
  type: BackgroundTaskType;
  priority: number; // higher = runs first
  status: TaskStatus;
  retries: number;
  maxRetries: number;
  cooldownMs: number;          // base cooldown
  nextRunAt: number | null;    // exact ms epoch the task can run again
  lastRunAt: number | null;
  lastResult: string | null;
  createdAt: number;
  finishedAt: number | null;
  error: string | null;
  payload?: any;
}

export interface TaskLogEntry {
  timestamp: number;
  taskId: string;
  taskType: BackgroundTaskType | 'SYSTEM';
  action: string;
  detail: string;
}

const MAX_LOG_ENTRIES = 100;
const FINISHED_TTL_MS = 10 * 60 * 1000;      // GC finished tasks after 10 min
const MAX_BACKOFF_MS = 5 * 60 * 1000;        // cap exponential backoff at 5 min

class TaskQueue {
  private tasks: Map<string, BackgroundTask> = new Map();
  private log: TaskLogEntry[] = [];
  private listeners = new Set<() => void>();
  private idCounter = 0;
  private gcHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof setInterval !== 'undefined') {
      this.gcHandle = setInterval(() => this.gcFinished(), 60_000);
      (this.gcHandle as any)?.unref?.();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    // Snapshot to protect against listeners that unsubscribe during dispatch
    for (const l of Array.from(this.listeners)) {
      try { l(); } catch (e) { console.error('[TaskQueue] listener error', e); }
    }
  }

  private addLog(taskId: string, taskType: BackgroundTaskType | 'SYSTEM', action: string, detail: string) {
    this.log.unshift({ timestamp: Date.now(), taskId, taskType, action, detail });
    if (this.log.length > MAX_LOG_ENTRIES) this.log.length = MAX_LOG_ENTRIES;
    console.log(`[TaskQueue] ${action} | ${taskType} | ${detail}`);
  }

  /** Exponential backoff with cap: base * 2^retries, capped at MAX_BACKOFF_MS */
  private computeBackoff(base: number, retries: number): number {
    return Math.min(MAX_BACKOFF_MS, base * Math.pow(2, Math.max(0, retries - 1)));
  }

  addTask(
    type: BackgroundTaskType,
    priority: number,
    options?: { maxRetries?: number; cooldownMs?: number; payload?: any; allowDuplicate?: boolean }
  ): string {
    // Dedupe: same type already pending/running/cooldown → return existing id
    if (!options?.allowDuplicate) {
      for (const task of this.tasks.values()) {
      if (
        task.type === type &&
        (task.status === 'pending' || task.status === 'running' || task.status === 'cooldown')
      ) {
        this.addLog(task.id, type, 'DUPLICATE_SKIP', 'Task of this type already queued');
        return task.id;
      }
      }
    }

    const id = `task-${++this.idCounter}-${Date.now()}`;
    const task: BackgroundTask = {
      id,
      type,
      priority,
      status: 'pending',
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
      cooldownMs: options?.cooldownMs ?? 5000,
      nextRunAt: null,
      lastRunAt: null,
      lastResult: null,
      createdAt: Date.now(),
      finishedAt: null,
      error: null,
      payload: options?.payload,
    };
    this.tasks.set(id, task);
    this.addLog(id, type, 'ADDED', `Priority: ${priority}, MaxRetries: ${task.maxRetries}`);
    this.notify();
    return id;
  }

  /** Get up to N tasks ready to execute, sorted by priority desc */
  getReady(limit: number): BackgroundTask[] {
    const now = Date.now();
    const ready: BackgroundTask[] = [];
    let promoted = 0;

    for (const task of this.tasks.values()) {
      if (task.status === 'running') continue;

      if (task.status === 'cooldown') {
        if (task.nextRunAt !== null && now >= task.nextRunAt) {
          task.status = 'pending';
          task.nextRunAt = null;
          promoted++;
        } else {
          continue;
        }
      }

      if (task.status === 'pending') ready.push(task);
    }

    if (promoted > 0) this.notify();

    ready.sort((a, b) => b.priority - a.priority);
    return ready.slice(0, limit);
  }

  markRunning(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = 'running';
    task.lastRunAt = Date.now();
    this.addLog(id, task.type, 'RUNNING', `Attempt ${task.retries + 1}/${task.maxRetries}`);
    this.notify();
  }

  markCompleted(id: string, result: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = 'completed';
    task.lastResult = result;
    task.error = null;
    task.finishedAt = Date.now();
    this.addLog(id, task.type, 'COMPLETED', result);
    this.notify();
  }

  markFailed(id: string, error: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.retries++;
    task.error = error;

    if (task.retries >= task.maxRetries) {
      task.status = 'failed';
      task.finishedAt = Date.now();
      this.addLog(id, task.type, 'FAILED_PERMANENT', `${error} (max retries reached — blacklisted)`);
    } else {
      const backoff = this.computeBackoff(task.cooldownMs, task.retries);
      task.status = 'cooldown';
      task.nextRunAt = Date.now() + backoff;
      this.addLog(
        id,
        task.type,
        'FAILED_RETRY',
        `${error} (retry ${task.retries}/${task.maxRetries}, backoff ${backoff}ms)`
      );
    }
    this.notify();
  }

  /** Re-queue a completed or failed task as pending (clears stale finished entries first). */
  requeue(
    type: BackgroundTaskType,
    priority: number,
    options?: { maxRetries?: number; cooldownMs?: number }
  ): string {
    for (const [id, task] of this.tasks.entries()) {
      if (task.type === type && (task.status === 'completed' || task.status === 'failed')) {
        this.tasks.delete(id);
      }
    }
    const id = this.addTask(type, priority, options);
    // Honor cooldown between successful runs — don't fire on the very next tick.
    const task = this.tasks.get(id);
    if (task && task.status === 'pending') {
      task.status = 'cooldown';
      task.nextRunAt = Date.now() + task.cooldownMs;
      this.addLog(id, type, 'COOLDOWN', `Recurring cooldown ${task.cooldownMs}ms`);
    }
    return id;
  }

  /** Cancel a pending or cooldown task; running tasks are flagged failed. */
  cancel(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (task.status === 'completed' || task.status === 'failed') return false;
    task.status = 'failed';
    task.error = 'cancelled';
    task.finishedAt = Date.now();
    this.addLog(id, task.type, 'CANCELLED', 'Task cancelled by caller');
    this.notify();
    return true;
  }

  /** Hard-remove a task from the queue. */
  remove(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    this.tasks.delete(id);
    this.addLog(id, task.type, 'REMOVED', 'Task removed from queue');
    this.notify();
    return true;
  }

  getById(id: string): BackgroundTask | null {
    return this.tasks.get(id) ?? null;
  }

  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.priority - a.priority);
  }

  getLastExecuted(): BackgroundTask | null {
    let last: BackgroundTask | null = null;
    for (const task of this.tasks.values()) {
      if (task.lastRunAt && (!last || task.lastRunAt > (last.lastRunAt || 0))) {
        last = task;
      }
    }
    return last;
  }

  getLog(): TaskLogEntry[] {
    return [...this.log];
  }

  getStats() {
    const all = this.getAllTasks();
    return {
      total: all.length,
      pending: all.filter(t => t.status === 'pending').length,
      running: all.filter(t => t.status === 'running').length,
      completed: all.filter(t => t.status === 'completed').length,
      failed: all.filter(t => t.status === 'failed').length,
      cooldown: all.filter(t => t.status === 'cooldown').length,
    };
  }

  /** Remove finished tasks older than FINISHED_TTL_MS to bound memory. */
  gcFinished(): number {
    const cutoff = Date.now() - FINISHED_TTL_MS;
    let removed = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        task.finishedAt !== null &&
        task.finishedAt < cutoff
      ) {
        this.tasks.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.addLog('system', 'SYSTEM', 'GC', `Removed ${removed} finished tasks`);
      this.notify();
    }
    return removed;
  }

  clear() {
    this.tasks.clear();
    this.log = [];
    this.addLog('system', 'SYSTEM', 'CLEARED', 'All tasks and logs cleared');
    this.notify();
  }

  destroy() {
    if (this.gcHandle) {
      clearInterval(this.gcHandle);
      this.gcHandle = null;
    }
    this.listeners.clear();
  }
}

export const taskQueue = new TaskQueue();
