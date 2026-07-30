// ==UserScript==
// @name         Task Manager
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Task management module for tracking and managing AI chat tasks
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
  'use strict';

  class TaskManagerModule {
    constructor() {
      this.name = 'TaskManager';
      this.version = '2026.04.28.0';
      this.dependencies = [];
      this.critical = false;
      this.tasks = [];
    }

    init() {
      console.log('[TaskManager] Module initialized');
      this.loadTasks();
      this.registerMenuCommands();
      return true;
    }

    loadTasks() {
      try {
        const stored = GM_getValue('aiTasks', '[]');
        this.tasks = JSON.parse(stored);
      } catch (e) {
        this.tasks = [];
      }
    }

    saveTasks() {
      try {
        GM_setValue('aiTasks', JSON.stringify(this.tasks));
      } catch (e) {
        console.warn('[TaskManager] Failed to save tasks:', e);
      }
    }

    addTask(title, description = '') {
      const task = {
        id: Date.now(),
        title,
        description,
        created: new Date().toISOString(),
        completed: false
      };
      this.tasks.push(task);
      this.saveTasks();
      console.log('[TaskManager] Task added:', task.id);
      return task;
    }

    completeTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        task.completed = true;
        task.completedAt = new Date().toISOString();
        this.saveTasks();
        console.log('[TaskManager] Task completed:', taskId);
        return true;
      }
      return false;
    }

    getTasks() {
      return this.tasks;
    }

    getPendingTasks() {
      return this.tasks.filter(t => !t.completed);
    }

    registerMenuCommands() {
      if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('Task Manager: List Tasks', () => {
          const pending = this.getPendingTasks();
          const msg = pending.length > 0 
            ? pending.map(t => `- ${t.title}`).join('\n')
            : 'No pending tasks';
          alert(`Pending Tasks:\n${msg}`);
        });

        GM_registerMenuCommand('Task Manager: Clear Completed', () => {
          this.tasks = this.tasks.filter(t => !t.completed);
          this.saveTasks();
          console.log('[TaskManager] Cleared completed tasks');
        });
      }
    }

    execute() {
      console.log('[TaskManager] Execute called');
    }

    onConfigUpdate(settings) {
      console.log('[TaskManager] Config updated:', settings);
    }

    destroy() {
      console.log('[TaskManager] Module destroyed');
    }
  }

  // Register with hub
  const instance = new TaskManagerModule();
  if (typeof window !== 'undefined') {
    if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
      window.ModuleRegistry.register(instance);
    } else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
      window.ChatGPTModules.register(instance);
    }
  }
})();
