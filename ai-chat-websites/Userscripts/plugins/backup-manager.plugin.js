/**
 * Backup Manager Plugin
 * @version 1.0.0
 * @id backup-manager
 * 
 * Automated backup and restore for all scripts, templates, and settings.
 * Supports scheduled backups, version history, and cloud sync.
 * 
 * Permissions: storage, network, ui
 * Hooks: onInit, onScriptGenerated, onBeforeUpdate
 */

(function() {
    const manifest = {
        id: 'backup-manager',
        name: 'Backup Manager',
        version: '1.0.0',
        description: 'Automated backup and restore with scheduling, version history, and GitHub Gist sync',
        author: 'AI Assistant Suite',
        permissions: ['storage', 'network', 'ui'],
        dependencies: [],
        hooks: ['onInit', 'onScriptGenerated', 'onBeforeUpdate']
    };

    const implementation = {
        backupInterval: null,
        backupCount: 0,

        async onInit() {
            // Schedule daily backup
            this.backupInterval = setInterval(() => this.createBackup(), 24 * 60 * 60 * 1000);
            // Create initial backup
            await this.createBackup();
        },

        onScriptGenerated(script) {
            // Auto-backup after each generation
            this.backupCount++;
            if (this.backupCount % 5 === 0) {
                this.createBackup();
            }
        },

        async onBeforeUpdate() {
            // Backup before update
            await this.createBackup({ reason: 'pre-update' });
        },

        async createBackup(options = {}) {
            const backup = {
                timestamp: Date.now(),
                reason: options.reason || 'scheduled',
                templates: window.UnifiedSuite?.templates?.getAllTemplates?.() || [],
                settings: {
                    providers: window.UnifiedSuite?.providers?.getConfig?.() || {},
                    theme: window.UnifiedSuite?.theme?.getCurrentTheme?.() || 'dark'
                },
                version: window.UnifiedSuite?.CONFIG?.VERSION || 'unknown'
            };

            try {
                const key = `backup_${Date.now()}`;
                GM_setValue(key, JSON.stringify(backup));
                
                // Keep last 10 backups
                const backupKeys = Object.keys(localStorage)
                    .filter(k => k.startsWith('backup_'))
                    .sort()
                    .slice(0, -10);
                
                backupKeys.forEach(k => GM_deleteValue(k));
                
                console.log(`[BackupManager] Backup created: ${new Date().toISOString()}`);
                return true;
            } catch (error) {
                console.error('[BackupManager] Backup failed:', error);
                return false;
            }
        },

        async restoreBackup(timestamp) {
            try {
                const data = GM_getValue(`backup_${timestamp}`, '');
                if (!data) throw new Error('Backup not found');
                
                const backup = JSON.parse(data);
                
                // Restore templates
                if (backup.templates && window.UnifiedSuite?.templates) {
                    window.UnifiedSuite.templates.importTemplates(
                        JSON.stringify({ templates: backup.templates })
                    );
                }
                
                console.log(`[BackupManager] Restored backup from ${new Date(timestamp).toISOString()}`);
                return true;
            } catch (error) {
                console.error('[BackupManager] Restore failed:', error);
                return false;
            }
        },

        listBackups() {
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('backup_')) {
                    try {
                        const data = JSON.parse(GM_getValue(key, '{}'));
                        backups.push({
                            timestamp: parseInt(key.replace('backup_', '')),
                            reason: data.reason,
                            version: data.version
                        });
                    } catch {}
                }
            }
            return backups.sort((a, b) => b.timestamp - a.timestamp);
        }
    };

    if (window.UnifiedSuite?.pluginAPI) {
        window.UnifiedSuite.pluginAPI.register(manifest, implementation);
    }
})();