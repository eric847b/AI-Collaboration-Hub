/**
 * Local Storage Manager - Zero-cost offline-first data persistence
 */

export interface Script {
  id: string;
  name: string;
  code: string;
  language: string;
  status: 'active' | 'inactive' | 'testing';
  version: number;
  created_at: string;
  updated_at: string;
  performance_score?: number;
  metadata?: Record<string, any>;
}

export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Improvement {
  id: string;
  target_type: string;
  suggestion_title: string;
  suggestion_description: string;
  implementation_code: string;
  confidence_score: number;
  status: 'pending' | 'applied' | 'rejected';
  created_at: string;
  applied_at?: string;
}

const STORAGE_KEYS = {
  SCRIPTS: 'autonomous_scripts',
  ACTIVITY_LOGS: 'autonomous_activity_logs',
  IMPROVEMENTS: 'autonomous_improvements',
  SETTINGS: 'autonomous_settings',
  SYNC_QUEUE: 'autonomous_sync_queue',
  LAST_SYNC: 'autonomous_last_sync',
};

class LocalStorageManager {
  // Generic get/set for arbitrary keys
  get(key: string): string | null {
    return localStorage.getItem(key);
  }

  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  // Scripts
  getScripts(): Script[] {
    const data = localStorage.getItem(STORAGE_KEYS.SCRIPTS);
    return data ? JSON.parse(data) : [];
  }

  addScript(script: Omit<Script, 'id' | 'created_at' | 'updated_at'>): Script {
    const scripts = this.getScripts();
    const newScript: Script = {
      ...script,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    scripts.push(newScript);
    localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(scripts));
    this.addToSyncQueue('scripts', 'insert', newScript);
    return newScript;
  }

  updateScript(id: string, updates: Partial<Script>): Script | null {
    const scripts = this.getScripts();
    const index = scripts.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    scripts[index] = {
      ...scripts[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(scripts));
    this.addToSyncQueue('scripts', 'update', scripts[index]);
    return scripts[index];
  }

  deleteScript(id: string): boolean {
    const scripts = this.getScripts();
    const filtered = scripts.filter(s => s.id !== id);
    if (filtered.length === scripts.length) return false;
    
    localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(filtered));
    this.addToSyncQueue('scripts', 'delete', { id });
    return true;
  }

  // Activity Logs
  getActivityLogs(limit = 50): ActivityLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    const logs = data ? JSON.parse(data) : [];
    return logs.slice(0, limit);
  }

  addActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'>): ActivityLog {
    const logs = this.getActivityLogs(1000);
    const newLog: ActivityLog = {
      ...log,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs.slice(0, 100)));
    this.addToSyncQueue('activity_logs', 'insert', newLog);
    return newLog;
  }

  // Improvements
  getImprovements(): Improvement[] {
    const data = localStorage.getItem(STORAGE_KEYS.IMPROVEMENTS);
    return data ? JSON.parse(data) : [];
  }

  addImprovement(improvement: Omit<Improvement, 'id' | 'created_at'>): Improvement {
    const improvements = this.getImprovements();
    const newImprovement: Improvement = {
      ...improvement,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    improvements.push(newImprovement);
    localStorage.setItem(STORAGE_KEYS.IMPROVEMENTS, JSON.stringify(improvements));
    this.addToSyncQueue('improvements', 'insert', newImprovement);
    return newImprovement;
  }

  updateImprovement(id: string, updates: Partial<Improvement>): Improvement | null {
    const improvements = this.getImprovements();
    const index = improvements.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    improvements[index] = { ...improvements[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.IMPROVEMENTS, JSON.stringify(improvements));
    this.addToSyncQueue('improvements', 'update', improvements[index]);
    return improvements[index];
  }

  // Settings
  getSettings(): Record<string, any> {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      autonomousMode: false,
      autoImplementThreshold: 0.8,
      useLocalFirst: true,
    };
  }

  updateSettings(settings: Record<string, any>) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // Sync Queue
  private addToSyncQueue(table: string, operation: string, data: any) {
    const queue = this.getSyncQueue();
    queue.push({
      id: crypto.randomUUID(),
      table,
      operation,
      data,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  }

  getSyncQueue(): any[] {
    const data = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    return data ? JSON.parse(data) : [];
  }

  clearSyncQueue() {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  getLastSync(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  // Stats
  getStats() {
    const scripts = this.getScripts();
    const logs = this.getActivityLogs(1000);
    const improvements = this.getImprovements();

    const activeScripts = scripts.filter(s => s.status === 'active').length;
    const avgPerformance = scripts.reduce((acc, s) => acc + (s.performance_score || 0), 0) / scripts.length || 0;
    
    const recentLogs = logs.filter(l => {
      const logTime = new Date(l.created_at).getTime();
      const hourAgo = Date.now() - 3600000;
      return logTime > hourAgo;
    });

    const successLogs = recentLogs.filter(l => 
      l.type === 'success' || l.message.toLowerCase().includes('success')
    ).length;
    const systemHealth = recentLogs.length > 0 
      ? Math.round((successLogs / recentLogs.length) * 100)
      : 100;

    const pendingImprovements = improvements.filter(i => i.status === 'pending').length;

    return {
      totalScripts: scripts.length,
      activeScripts,
      improvements: pendingImprovements,
      systemHealth,
      avgPerformance: Math.round(avgPerformance * 100) / 100,
    };
  }

  // Clear all data
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // Export/Import for backup
  exportData() {
    return {
      scripts: this.getScripts(),
      activityLogs: this.getActivityLogs(1000),
      improvements: this.getImprovements(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString(),
    };
  }

  importData(data: any) {
    if (data.scripts) localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(data.scripts));
    if (data.activityLogs) localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(data.activityLogs));
    if (data.improvements) localStorage.setItem(STORAGE_KEYS.IMPROVEMENTS, JSON.stringify(data.improvements));
    if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
  }
}

export const localStorageManager = new LocalStorageManager();
