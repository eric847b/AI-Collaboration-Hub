/**
 * Hybrid Data Manager - Seamlessly switches between remote and local storage
 */

import { supabase } from "@/integrations/supabase/client";
import { localStorageManager, Script, ActivityLog, Improvement } from "./localStorageManager";
import { checkBackendHealth } from "./connectionUtils";

export type DataMode = 'remote' | 'local' | 'hybrid';

class HybridDataManager {
  private currentMode: DataMode = 'hybrid';
  private isBackendHealthy = false;

  async initialize() {
    const health = await checkBackendHealth();
    this.isBackendHealthy = health.healthy;
    return this.isBackendHealthy;
  }

  setMode(mode: DataMode) {
    this.currentMode = mode;
  }

  getMode(): DataMode {
    return this.currentMode;
  }

  isOnline(): boolean {
    return this.isBackendHealthy;
  }

  // Scripts
  async getScripts(): Promise<Script[]> {
    if (this.currentMode === 'local' || !this.isBackendHealthy) {
      return localStorageManager.getScripts();
    }

    try {
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map database schema to Script type
      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        code: item.code,
        language: 'typescript',
        status: item.status as 'active' | 'inactive' | 'testing',
        version: parseInt(item.version) || 1,
        created_at: item.created_at,
        updated_at: item.updated_at,
        performance_score: item.confidence_score,
        metadata: {},
      }));
    } catch (error) {
      console.warn('Falling back to local storage for scripts:', error);
      return localStorageManager.getScripts();
    }
  }

  async addScript(script: Omit<Script, 'id' | 'created_at' | 'updated_at'>): Promise<Script> {
    const localScript = localStorageManager.addScript(script);

    if (this.currentMode !== 'local' && this.isBackendHealthy) {
      try {
        const { data, error } = await supabase
          .from('scripts')
          .insert([{
            name: script.name,
            code: script.code,
            status: script.status,
            version: script.version.toString(),
            confidence_score: script.performance_score || 0,
          }])
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            name: data.name,
            code: data.code,
            language: 'typescript',
            status: data.status as 'active' | 'inactive' | 'testing',
            version: parseInt(data.version) || 1,
            created_at: data.created_at,
            updated_at: data.updated_at,
            performance_score: data.confidence_score,
            metadata: {},
          };
        }
      } catch (error) {
        console.warn('Failed to save to remote, using local:', error);
      }
    }

    return localScript;
  }

  async updateScript(id: string, updates: Partial<Script>): Promise<Script | null> {
    const localResult = localStorageManager.updateScript(id, updates);

    if (this.currentMode !== 'local' && this.isBackendHealthy) {
      try {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.code) dbUpdates.code = updates.code;
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.version) dbUpdates.version = updates.version.toString();
        if (updates.performance_score !== undefined) dbUpdates.confidence_score = updates.performance_score;

        const { data, error } = await supabase
          .from('scripts')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            name: data.name,
            code: data.code,
            language: 'typescript',
            status: data.status as 'active' | 'inactive' | 'testing',
            version: parseInt(data.version) || 1,
            created_at: data.created_at,
            updated_at: data.updated_at,
            performance_score: data.confidence_score,
            metadata: {},
          };
        }
      } catch (error) {
        console.warn('Failed to update remote, using local:', error);
      }
    }

    return localResult;
  }

  async deleteScript(id: string): Promise<boolean> {
    const localResult = localStorageManager.deleteScript(id);

    if (this.currentMode !== 'local' && this.isBackendHealthy) {
      try {
        const { error } = await supabase
          .from('scripts')
          .delete()
          .eq('id', id);

        if (!error) return true;
      } catch (error) {
        console.warn('Failed to delete from remote, using local:', error);
      }
    }

    return localResult;
  }

  // Activity Logs
  async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    if (this.currentMode === 'local' || !this.isBackendHealthy) {
      return localStorageManager.getActivityLogs(limit);
    }

    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Falling back to local storage for logs:', error);
      return localStorageManager.getActivityLogs(limit);
    }
  }

  async addActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog> {
    const localLog = localStorageManager.addActivityLog(log);

    if (this.currentMode !== 'local' && this.isBackendHealthy) {
      try {
        await supabase.from('activity_logs').insert([log]);
      } catch (error) {
        console.warn('Failed to save log to remote:', error);
      }
    }

    return localLog;
  }

  // Improvements (stored locally only for now - backend table doesn't match)
  async getImprovements(): Promise<Improvement[]> {
    return localStorageManager.getImprovements();
  }

  async addImprovement(improvement: Omit<Improvement, 'id' | 'created_at'>): Promise<Improvement> {
    return localStorageManager.addImprovement(improvement);
  }

  async updateImprovement(id: string, updates: Partial<Improvement>): Promise<Improvement | null> {
    return localStorageManager.updateImprovement(id, updates);
  }

  // Stats
  async getStats() {
    if (this.currentMode === 'local' || !this.isBackendHealthy) {
      return localStorageManager.getStats();
    }

    try {
      const scripts = await this.getScripts();
      const logs = await this.getActivityLogs(1000);
      const improvements = await this.getImprovements();

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
    } catch (error) {
      console.warn('Failed to get remote stats, using local:', error);
      return localStorageManager.getStats();
    }
  }

  // Sync
  async syncToRemote() {
    if (!this.isBackendHealthy) {
      throw new Error('Backend is not available for sync');
    }

    const queue = localStorageManager.getSyncQueue();
    const errors = [];

    for (const item of queue) {
      try {
        if (item.operation === 'insert') {
          await supabase.from(item.table).insert([item.data]);
        } else if (item.operation === 'update') {
          await supabase.from(item.table).update(item.data).eq('id', item.data.id);
        } else if (item.operation === 'delete') {
          await supabase.from(item.table).delete().eq('id', item.data.id);
        }
      } catch (error) {
        errors.push({ item, error });
      }
    }

    if (errors.length === 0) {
      localStorageManager.clearSyncQueue();
    }

    return { synced: queue.length - errors.length, errors };
  }

  // Export/Import
  exportData() {
    return localStorageManager.exportData();
  }

  importData(data: any) {
    localStorageManager.importData(data);
  }
}

export const hybridDataManager = new HybridDataManager();
