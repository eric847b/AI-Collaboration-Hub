/**
 * Notification Center Plugin
 * @version 1.0.0
 * @id notification-center
 * 
 * Centralized notification system for updates, errors, and events.
 * Supports desktop notifications, in-app toast, and notification history.
 * 
 * Permissions: storage, ui
 * Hooks: onInit, onError, onUpdateAvailable
 */

(function() {
    const manifest = {
        id: 'notification-center',
        name: 'Notification Center',
        version: '1.0.0',
        description: 'Centralized notification system with desktop alerts, toast messages, and history',
        author: 'AI Assistant Suite',
        permissions: ['storage', 'ui'],
        dependencies: [],
        hooks: ['onInit', 'onError', 'onUpdateAvailable']
    };

    const implementation = {
        notifications: [],
        maxNotifications: 100,
        container: null,

        async onInit() {
            this.loadHistory();
            this.createContainer();
        },

        loadHistory() {
            try {
                const stored = GM_getValue('notification_history', '[]');
                this.notifications = JSON.parse(stored);
            } catch {
                this.notifications = [];
            }
        },

        saveHistory() {
            try {
                GM_setValue('notification_history', JSON.stringify(
                    this.notifications.slice(-this.maxNotifications)
                ));
            } catch {}
        },

        createContainer() {
            this.container = document.createElement('div');
            this.container.id = 'notification-center';
            this.container.style.cssText = 'position:fixed;top:20px;right:20px;width:360px;z-index:100000;display:flex;flex-direction:column;gap:8px;pointer-events:none';
            document.body.appendChild(this.container);
        },

        show(type, title, message, options = {}) {
            const id = `notif_${Date.now()}`;
            const notification = {
                id,
                type, // 'info', 'success', 'warning', 'error'
                title,
                message,
                timestamp: Date.now(),
                read: false,
                ...options
            };

            // Add to history
            this.notifications.push(notification);
            this.saveHistory();

            // Show toast
            const colors = {
                info: '#1f6feb',
                success: '#238636',
                warning: '#9e6a03',
                error: '#da3633'
            };

            const toast = document.createElement('div');
            toast.id = id;
            toast.style.cssText = `
                background:${colors[type] || colors.info};color:white;
                padding:12px 16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);
                font-family:system-ui;font-size:13px;
                transform:translateX(120%);opacity:0;
                transition:all 0.3s ease;cursor:pointer;pointer-events:all;
                max-width:360px;word-wrap:break-word
            `;
            toast.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <strong>${title}</strong>
                    <span style="font-size:16px;cursor:pointer;opacity:0.7;margin-left:8px" class="notif-close">×</span>
                </div>
                <div style="margin-top:4px;opacity:0.9;font-size:12px">${message}</div>
            `;

            toast.querySelector('.notif-close').onclick = (e) => {
                e.stopPropagation();
                this.dismiss(id);
            };

            toast.onclick = () => {
                if (options.onClick) options.onClick();
                this.dismiss(id);
            };

            this.container.appendChild(toast);

            // Animate in
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(0)';
                toast.style.opacity = '1';
            });

            // Auto-dismiss
            if (options.timeout !== false) {
                setTimeout(() => this.dismiss(id), options.duration || 5000);
            }

            // Desktop notification
            if (options.desktop !== false && typeof GM_notification !== 'undefined') {
                try {
                    GM_notification({
                        title,
                        text: message,
                        timeout: 5000
                    });
                } catch {}
            }

            return id;
        },

        dismiss(id) {
            const toast = document.getElementById(id);
            if (toast) {
                toast.style.transform = 'translateX(120%)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }
            const notif = this.notifications.find(n => n.id === id);
            if (notif) notif.read = true;
        },

        getUnread() {
            return this.notifications.filter(n => !n.read);
        },

        getHistory(limit = 50) {
            return this.notifications.slice(-limit).reverse();
        },

        markAllRead() {
            this.notifications.forEach(n => n.read = true);
        },

        clearHistory() {
            this.notifications = [];
            this.saveHistory();
        },

        onError(error) {
            this.show('error', 'Error Occurred', error.message || String(error), {
                duration: 10000,
                desktop: true
            });
        },

        onUpdateAvailable(update) {
            this.show('info', 'Update Available', 
                `v${update.currentVersion} → v${update.latestVersion}`, {
                duration: 0, // Stay until dismissed
                desktop: true,
                onClick: () => {
                    if (update.downloadUrl) window.open(update.downloadUrl, '_blank');
                }
            });
        }
    };

    if (window.UnifiedSuite?.pluginAPI) {
        window.UnifiedSuite.pluginAPI.register(manifest, implementation);
    }
})();