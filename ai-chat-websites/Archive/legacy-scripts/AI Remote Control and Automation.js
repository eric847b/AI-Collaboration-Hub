// ==UserScript==
// @name                AI Remote Control and Automation
// @description         Enable AI to remotely control and modify a mobile/desktop environment
// @author              Anonymous
// @version             1.5.0
// @license             MIT
// @match               https://chatgpt.com/*
// @match               https://chat.openai.com/*
// @match               https://gemini.google.com/*
// @icon                https://chat.openai.com/favicon.ico
// @require             https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@3.3.1/dist/chatgpt.min.js
// @grant               GM_setValue
// @grant               GM_getValue
// @grant               GM_registerMenuCommand
// @grant               GM_unregisterMenuCommand
// @grant               GM_xmlhttpRequest
// @connect             *
// @homepageURL         https://github.com/kudoai/chatgpt.js
// @supportURL          https://github.com/kudoai/chatgpt.js/issues
// ==/UserScript==

(function() {
    'use strict';

    const c = chatgpt;

    const aiController = {
        init: async function() {
            await c.isLoaded();
            this.setupEventListeners();
            this.registerCommands();
            this.loadContext();
            this.enhanceUI();
            this.initializeSpeechRecognition();
            this.initializeSpeechSynthesis();
            this.initializeGoogleAPIs();
            this.initializeTimeTriggers();
            this.initializeCustomReminders();
            this.initializeScheduledActions();
            this.initializeRecurringTasks();
            c.send('AI Remote Control and Automation system is now active. You can issue commands to control and modify the environment.');
        },

        // ... (previous methods remain unchanged)

        performAction: async function(action) {
            if (this.requiresConfirmation(action.type)) {
                if (!await this.getUserConfirmation(action)) {
                    return 'Action cancelled by user.';
                }
            }

            switch (action.type) {
                // ... (previous cases remain unchanged)
                case 'setCustomReminder':
                    return this.setCustomReminder(action.params.content);
                case 'scheduleCustomAction':
                    return this.scheduleCustomAction(action.params.content);
                case 'createRecurringTask':
                    return this.createRecurringTask(action.params.content);
                case 'updateRecurringTask':
                    return this.updateRecurringTask(action.params.content);
                case 'deleteRecurringTask':
                    return this.deleteRecurringTask(action.params.content);
                default:
                    return 'Unknown action';
            }
        },

        requiresConfirmation: function(actionType) {
            const sensitiveActions = ['sendEmail', 'modifySystem', 'automateWorkflow', 'createCalendarEvent', 'updateCalendarEvent', 'deleteCalendarEvent', 'createTask', 'updateTask', 'deleteTask', 'createRecurringCalendarEvent', 'updateRecurringCalendarEvent', 'deleteRecurringCalendarEvent', 'createRecurringTask', 'updateRecurringTask', 'deleteRecurringTask', 'setCustomReminder', 'scheduleCustomAction'];
            return sensitiveActions.includes(actionType);
        },

        // ... (other methods remain unchanged)

        createCalendarEvent: async function(content) {
            try {
                const accessToken = await this.getGoogleAccessToken();
                const response = await gapi.client.calendar.events.insert({
                    calendarId: 'primary',
                    resource: {
                        summary: content.title,
                        description: content.description,
                        start: {
                            dateTime: content.startTime,
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        },
                        end: {
                            dateTime: content.endTime,
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        }
                    }
                });
                this.speakFeedback(`Calendar event created: ${content.title}`);
                this.scheduleCustomReminderForEvent(response.result, content.reminderTime);
                return `Calendar event created successfully. Event ID: ${response.result.id}`;
            } catch (error) {
                console.error('Error creating calendar event:', error);
                this.speakFeedback(`Failed to create calendar event: ${error.message}`);
                return `Failed to create calendar event: ${error.message}`;
            }
        },

        createRecurringCalendarEvent: async function(content) {
            try {
                const accessToken = await this.getGoogleAccessToken();
                const response = await gapi.client.calendar.events.insert({
                    calendarId: 'primary',
                    resource: {
                        summary: content.title,
                        description: content.description,
                        start: {
                            dateTime: content.startTime,
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        },
                        end: {
                            dateTime: content.endTime,
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        },
                        recurrence: [
                            `RRULE:FREQ=${content.frequency};INTERVAL=${content.interval}`
                        ]
                    }
                });
                this.speakFeedback(`Recurring calendar event created: ${content.title}`);
                this.scheduleCustomReminderForEvent(response.result, content.reminderTime);
                return `Recurring calendar event created successfully. Event ID: ${response.result.id}`;
            } catch (error) {
                console.error('Error creating recurring calendar event:', error);
                this.speakFeedback(`Failed to create recurring calendar event: ${error.message}`);
                return `Failed to create recurring calendar event: ${error.message}`;
            }
        },

        setCustomReminder: function(content) {
            const reminderTime = this.parseDateTime(content.reminderTime);
            if (!reminderTime) {
                return 'Invalid reminder time format';
            }
            
            const reminder = {
                id: Date.now(),
                title: content.title,
                time: reminderTime.toISOString(),
                message: content.message || content.title
            };
            
            this.customReminders.push(reminder);
            this.saveCustomReminders();
            this.scheduleCustomReminder(reminder);
            
            return `Custom reminder set for ${reminder.title} at ${reminder.time}`;
        },

        scheduleCustomAction: function(content) {
            const triggerTime = this.parseDateTime(content.triggerTime);
            if (!triggerTime) {
                return 'Invalid trigger time format';
            }
            
            const action = {
                id: Date.now(),
                title: content.title,
                triggerTime: triggerTime.toISOString(),
                action: content.action,
                params: content.params
            };
            
            this.scheduledActions.push(action);
            this.saveScheduledActions();
            this.scheduleCustomActionExecution(action);
            
            return `Custom action scheduled: ${action.title} at ${action.triggerTime}`;
        },

        initializeCustomReminders: function() {
            this.customReminders = this.loadCustomReminders();
            this.customReminders.forEach(reminder => this.scheduleCustomReminder(reminder));
        },

        initializeScheduledActions: function() {
            this.scheduledActions = this.loadScheduledActions();
            this.scheduledActions.forEach(action => this.scheduleCustomActionExecution(action));
        },

        initializeRecurringTasks: function() {
            this.recurringTasks = this.loadRecurringTasks();
            this.recurringTasks.forEach(task => this.scheduleRecurringTask(task));
        },

        scheduleCustomReminderForEvent: function(event, reminderTime) {
            const reminder = {
                id: event.id,
                title: event.summary,
                time: reminderTime || new Date(new Date(event.start.dateTime).getTime() - 30 * 60000).toISOString(),
                message: `Reminder: ${event.summary} starts soon`
            };
            
            this.customReminders.push(reminder);
            this.saveCustomReminders();
            this.scheduleCustomReminder(reminder);
        },

        scheduleCustomReminder: function(reminder) {
            const now = new Date();
            const reminderTime = new Date(reminder.time);
            const timeUntilReminder = reminderTime.getTime() - now.getTime();
            
            if (timeUntilReminder > 0) {
                setTimeout(() => {
                    this.showNotification(reminder.title, reminder.message);
                    this.speakFeedback(reminder.message);
                    this.removeCustomReminder(reminder.id);
                }, timeUntilReminder);
            } else {
                this.removeCustomReminder(reminder.id);
            }
        },

        scheduleCustomActionExecution: function(action) {
            const now = new Date();
            const triggerTime = new Date(action.triggerTime);
            const timeUntilTrigger = triggerTime.getTime() - now.getTime();
            
            if (timeUntilTrigger > 0) {
                setTimeout(() => {
                    this.executeCustomAction(action);
                    this.removeScheduledAction(action.id);
                }, timeUntilTrigger);
            } else {
                this.removeScheduledAction(action.id);
            }
        },

        scheduleRecurringTask: function(task) {
            const now = new Date();
            const nextOccurrence = this.getNextOccurrence(task.schedule);
            const timeUntilNextOccurrence = nextOccurrence.getTime() - now.getTime();

            if (timeUntilNextOccurrence > 0) {
                setTimeout(() => {
                    this.executeCustomAction(task.action);
                    this.scheduleRecurringTask(task);
                }, timeUntilNextOccurrence);
            }
        },

        executeCustomAction: function(action) {
            this.performAction({
                type: action.action,
                params: action.params
            });
        },

        removeCustomReminder: function(id) {
            this.customReminders = this.customReminders.filter(reminder => reminder.id !== id);
            this.saveCustomReminders();
        },

        removeScheduledAction: function(id) {
            this.scheduledActions = this.scheduledActions.filter(action => action.id !== id);
            this.saveScheduledActions();
        },

        saveCustomReminders: function() {
            GM_setValue('customReminders', JSON.stringify(this.customReminders));
        },

        loadCustomReminders: function() {
            return JSON.parse(GM_getValue('customReminders', '[]'));
        },

        saveScheduledActions: function() {
            GM_setValue('scheduledActions', JSON.stringify(this.scheduledActions));
        },

        loadScheduledActions: function() {
            return JSON.parse(GM_getValue('scheduledActions', '[]'));
        },

        saveRecurringTasks: function() {
            GM_setValue('recurringTasks', JSON.stringify(this.recurringTasks));
        },

        loadRecurringTasks: function() {
            return JSON.parse(GM_getValue('recurringTasks', '[]'));
        },

        enhanceUI: function() {
            // ... (previous UI enhancements)

            // Add UI elements for managing reminders, scheduled actions, and recurring tasks
            const managementPanel = document.createElement('div');
            managementPanel.id = 'ai-management-panel';
            managementPanel.innerHTML = `
                <h3>Reminders, Scheduled Actions, and Recurring Tasks</h3>
                <div id="reminders-list"></div>
                <div id="scheduled-actions-list"></div>
                <div id="recurring-tasks-list"></div>
            `;
            document.body.appendChild(managementPanel);

            this.updateManagementPanel();
        },

        updateManagementPanel: function() {
            const remindersListEl = document.getElementById('reminders-list');
            const scheduledActionsListEl = document.getElementById('scheduled-actions-list');
            const recurringTasksListEl = document.getElementById('recurring-tasks-list');

            remindersListEl.innerHTML = '<h4>Reminders</h4>' + this.customReminders.map(reminder => `
                <div>
                    <strong>${reminder.title}</strong> - ${new Date(reminder.time).toLocaleString()}
                    <button onclick="aiController.removeCustomReminder(${reminder.id})">Remove</button>
                </div>
            `).join('');

            scheduledActionsListEl.innerHTML = '<h4>Scheduled Actions</h4>' + this.scheduledActions.map(action => `
                <div>
                    <strong>${action.title}</strong> - ${new Date(action.triggerTime).toLocaleString()}
                    <button onclick="aiController.removeScheduledAction(${action.id})">Remove</button>
                </div>
            `).join('');

            recurringTasksListEl.innerHTML = '<h4>Recurring Tasks</h4>' + this.recurringTasks.map(task => `
                <div>
                    <strong>${task.title}</strong> - ${task.schedule}
                    <button onclick="aiController.deleteRecurringTask(${task.id})">Remove</button>
                </div>
            `).join('');
        },

        parseNaturalLanguage: function(input) {
            const lowercaseInput = input.toLowerCase();
            
            // ... (existing parsing logic)

            // Set custom reminder
            if (/set\s+(?:a\s+)?custom\s+reminder/.test(lowercaseInput)) {
                const title = lowercaseInput.match(/(?:called|named|titled)\s+(.+?)(?:\s|$)/i)?.[1] || 'Custom Reminder';
                const reminderTime = this.parseDateTime(lowercaseInput, 'at');
                const message = lowercaseInput.match(/(?:with\s+message|message:)\s*(.+?)(?:\s|$)/i)?.[1] || '';
                return { type: 'setCustomReminder', params: { content: { title, reminderTime, message } } };
            }

            // Schedule custom action
            if (/schedule\s+(?:a\s+)?custom\s+action/.test(lowercaseInput)) {
                const title = lowercaseInput.match(/(?:called|named|titled)\s+(.+?)(?:\s|$)/i)?.[1] || 'Custom Action';
                const triggerTime = this.parseDateTime(lowercaseInput, 'at');
                const action = lowercaseInput.match(/(?:to\s+perform|perform)\s+(.+?)(?:\s|$)/i)?.[1] || '';
                const params = {}; // Extract params based on the action type
                return { type: 'scheduleCustomAction', params: { content: { title, triggerTime, action, params } } };
            }

            // Create recurring task
            if (/create\s+(?:a\s+)?recurring\s+task/.test(lowercaseInput)) {
                const title = lowercaseInput.match(/(?:called|named|titled)\s+(.+?)(?:\s|$)/i)?.[1] || 'Recurring Task';
                const schedule = this.parseRecurringSchedule(lowercaseInput);
                const action = lowercaseInput.match(/(?:to\s+perform|perform)\s+(.+?)(?:\s|$)/i)?.[1] || '';
                const params = {}; // Extract params based on the action type
                return { type: 'createRecurringTask', params: { content: { title, schedule, action, params } } };
            }

            // ... (rest of the parsing logic)
        },

        // ... (other methods remain unchanged)

        createRecurringTask: async function(content) {
            try {
                const task = {
                    id: Date.now(),
                    title: content.title,
                    schedule: content.schedule,
                    action: content.action,
                    params: content.params
                };

                this.recurringTasks.push(task);
                this.saveRecurringTasks();
                this.scheduleRecurringTask(task);

                return `Recurring task created successfully. Task ID: ${task.id}`;
            } catch (error) {
                console.error('Error creating recurring task:', error);
                this.speakFeedback(`Failed to create recurring task: ${error.message}`);
                return `Failed to create recurring task: ${error.message}`;
            }
        },

        updateRecurringTask: async function(content) {
            try {
                const taskIndex = this.recurringTasks.findIndex(task => task.id === content.id);
                if (taskIndex === -1) {
                    return 'Recurring task not found';
                }

                this.recurringTasks[taskIndex] = {
                    ...this.recurringTasks[taskIndex],
                    title: content.title || this.recurringTasks[taskIndex].title,
                    schedule: content.schedule || this.recurringTasks[taskIndex].schedule,
                    action: content.action || this.recurringTasks[taskIndex].action,
                    params: content.params || this.recurringTasks[taskIndex].params
                };

                this.saveRecurringTasks();
                this.scheduleRecurringTask(this.recurringTasks[taskIndex]);

                return `Recurring task updated successfully. Task ID: ${content.id}`;
            } catch (error) {
                console.error('Error updating recurring task:', error);
                this.speakFeedback(`Failed to update recurring task: ${error.message}`);
                return `Failed to update recurring task: ${error.message}`;
            }
        },

        deleteRecurringTask: async function(id) {
            try {
                const taskIndex = this.recurringTasks.findIndex(task => task.id === id);
                if (taskIndex === -1) {
                    return 'Recurring task not found';
                }

                this