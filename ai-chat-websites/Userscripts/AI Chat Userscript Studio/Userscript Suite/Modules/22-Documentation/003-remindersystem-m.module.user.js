// ==UserScript==
// @name         ReminderSystem. M
// @namespace    hub.modules
// @version      2026.05.04.0
// @description  Hub‑native reminder engine (event‑driven, AI‑aware, UI‑integrated)
// @author       AI
// @license      MIT
// @match        https://chatgpt.com/*
// @match        https://www.duck.ai/*
// @match        https://www.phind.com/*
// @match        https://www.blackbox.ai/*
// @match        https://www.t3n.chat/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// ==/UserScript==

(function() {
  'use strict';

  class ReminderSystemModule {
    constructor() {
      this.name = 'ReminderSystem.M';
      this.version = '2026.05.04.0';
      this.dependencies = ['HubEvents', 'HubUI', 'HubState'];
      this.critical = false;

      this.reminders = [];
      this.timers = new Map();
    }

    init() {
      console.log('[ReminderSystem.M] init');

      this.loadState();
      this.bindEvents();
      this.registerUIPanel();

      return true;
    }

    /* ---------------------------------------------------------
     * STATE
     * --------------------------------------------------------- */

    loadState() {
      const stored = window.HubState.get('reminders', []);
      this.reminders = stored;
      this.restoreTimers();
    }

    saveState() {
      window.HubState.set('reminders', this.reminders);
    }

    /* ---------------------------------------------------------
     * EVENT BUS
     * --------------------------------------------------------- */

    bindEvents() {
      const E = window.HubEvents;

      E.on('reminder.add', data => this.addReminder(data));
      E.on('reminder.clear', id => this.clearReminder(id));
      E.on('reminder.list', () => this.emitList());
      E.on('session.change', () => this.syncSession());
      E.on('ai.intent.reminder', payload => this.handleAIIntent(payload));
    }

    /* ---------------------------------------------------------
     * CORE LOGIC
     * --------------------------------------------------------- */

    addReminder({ title, delay }) {
      const id = Date.now();

      const reminder = {
        id,
        title,
        triggerAt: Date.now() + delay,
        created: new Date().toISOString(),
        triggered: false
      };

      this.reminders.push(reminder);
      this.saveState();
      this.scheduleTimer(reminder);

      window.HubEvents.emit('ui.toast', {
        type: 'success',
        message: `Reminder set: ${title}`
      });

      return reminder;
    }

    clearReminder(id) {
      this.reminders = this.reminders.filter(r => r.id !== id);
      this.saveState();

      if (this.timers.has(id)) {
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
      }

      window.HubEvents.emit('ui.toast', {
        type: 'info',
        message: `Reminder cleared`
      });
    }

    emitList() {
      window.HubEvents.emit('reminder.list.response', {
        reminders: this.reminders.filter(r => !r.triggered)
      });
    }

    /* ---------------------------------------------------------
     * TIMER ENGINE (NO POLLING)
     * --------------------------------------------------------- */

    scheduleTimer(reminder) {
      const ms = reminder.triggerAt - Date.now();
      if (ms <= 0) return this.triggerReminder(reminder);

      const timer = setTimeout(() => this.triggerReminder(reminder), ms);
      this.timers.set(reminder.id, timer);
    }

    restoreTimers() {
      this.reminders
        .filter(r => !r.triggered)
        .forEach(r => this.scheduleTimer(r));
    }

    triggerReminder(reminder) {
      reminder.triggered = true;
      this.saveState();

      // Notify UI
      window.HubEvents.emit('ui.notification', {
        title: 'Reminder',
        message: reminder.title
      });

      // Notify AI layer
      window.HubEvents.emit('ai.notify', {
        type: 'reminder',
        id: reminder.id,
        title: reminder.title
      });

      // Notify task system
      window.HubEvents.emit('task.event', {
        type: 'reminder.trigger',
        reminder
      });

      console.log('[ReminderSystem.M] Triggered:', reminder.title);
    }

    /* ---------------------------------------------------------
     * AI INTEGRATION
     * --------------------------------------------------------- */

    handleAIIntent({ text, minutes }) {
      const delay = minutes * 60 * 1000;

      this.addReminder({
        title: text,
        delay
      });
    }

    /* ---------------------------------------------------------
     * UI PANEL
     * --------------------------------------------------------- */

    registerUIPanel() {
      window.HubUI.registerPanel({
        id: 'reminders',
        title: 'Reminders',
        icon: '⏰',
        render: () => this.renderPanel()
      });
    }

    renderPanel() {
      const active = this.reminders.filter(r => !r.triggered);

      return `
        <div class="hub-reminders">
          <h3>Active Reminders</h3>
          ${
            active.length === 0
              ? `<div class="empty">No active reminders</div>`
              : active
                  .map(r => {
                    const mins = Math.round((r.triggerAt - Date.now()) / 60000);
                    return `
                      <div class="reminder-item">
                        <div class="title">${r.title}</div>
                        <div class="time">${mins} min</div>
                        <button data-clear="${r.id}">Clear</button>
                      </div>
                    `;
                  })
                  .join('')
          }
        </div>
      `;
    }

    /* ---------------------------------------------------------
     * SESSION SYNC
     * --------------------------------------------------------- */

    syncSession() {
      // Future: session‑aware reminder routing
    }

    /* ---------------------------------------------------------
     * LIFECYCLE
     * --------------------------------------------------------- */

    destroy() {
      this.timers.forEach(t => clearTimeout(t));
      this.timers.clear();
      console.log('[ReminderSystem.M] destroyed');
    }
  }

  // Register with Hub
  const instance = new ReminderSystemModule();
  window.ModuleRegistry.register(instance);

})();
