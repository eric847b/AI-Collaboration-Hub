/**
 * Unified AI Assistant Suite - Internationalization Module
 * @version 1.8.0
 * 
 * Multi-language support with translation system and dynamic switching.
 * Supports Spanish, Chinese, Japanese, and RTL layout.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const i18n = {
    currentLocale: 'en',
    fallbackLocale: 'en',
    translations: new Map(),
    rtlLocales: ['ar', 'he', 'fa'],

    /**
     * Translation strings
     */
    strings: {
        en: {
            app_title: 'AI Assistant Suite',
            dashboard: 'Dashboard',
            generator: 'Script Generator',
            templates: 'Templates',
            versions: 'Versions',
            security: 'Security',
            scripts_generated: 'Scripts Generated',
            modules_active: 'Modules Active',
            export_all: 'Export All Scripts',
            import_scripts: 'Import Scripts',
            clear_history: 'Clear History',
            ai_provider: 'AI Provider',
            api_key: 'API Key',
            streaming: 'Streaming',
            context_awareness: 'Context Awareness',
            describe_prompt: 'Describe what you want the script to do:',
            generate: 'Generate Script',
            save: 'Save Script',
            copy: 'Copy',
            download: 'Download',
            search_templates: 'Search templates...',
            create_template: '+ Create Template',
            template_gallery: 'Template Gallery',
            category_all: 'All',
            category_productivity: 'Productivity',
            category_security: 'Security',
            category_ui: 'UI Enhancement',
            category_devtools: 'Developer Tools',
            use_template: 'Use Template',
            idle: 'Idle',
            streaming_active: 'Streaming...',
            update_available: 'Update Available',
            no_templates: 'No templates available',
            loaded_template: 'Loaded template:',
            enter_prompt: 'Describe what you want the script to do first.',
            generating: 'Generating...',
            generated: 'Generated',
            saved: 'Saved',
            copied: 'Script copied to clipboard',
            downloaded: 'Downloaded',
            error_prefix: 'Error:',
            validation_valid: 'Valid',
            validation_review: 'Needs review',
            theme_toggle: 'Toggle theme',
            close_ui: 'Close UI',
            test_connection: 'Test Connection',
            auth_status: 'Authentication',
            session_status: 'Session',
            retry_count: 'Retry Count',
            module_health: 'Module Health'
        },
        es: {
            app_title: 'Suite Asistente IA',
            dashboard: 'Panel',
            generator: 'Generador',
            templates: 'Plantillas',
            versions: 'Versiones',
            security: 'Seguridad',
            scripts_generated: 'Scripts Generados',
            modules_active: 'Módulos Activos',
            export_all: 'Exportar Scripts',
            import_scripts: 'Importar Scripts',
            clear_history: 'Limpiar Historial',
            ai_provider: 'Proveedor IA',
            api_key: 'Clave API',
            streaming: 'Transmisión',
            context_awareness: 'Contexto',
            describe_prompt: 'Describe lo que debe hacer el script:',
            generate: 'Generar Script',
            save: 'Guardar Script',
            copy: 'Copiar',
            download: 'Descargar',
            search_templates: 'Buscar plantillas...',
            create_template: '+ Crear Plantilla',
            template_gallery: 'Galería de Plantillas',
            category_all: 'Todas',
            category_productivity: 'Productividad',
            category_security: 'Seguridad',
            category_ui: 'Mejora UI',
            category_devtools: 'Herramientas Dev',
            use_template: 'Usar Plantilla',
            idle: 'Inactivo',
            streaming_active: 'Transmitiendo...',
            update_available: 'Actualización Disponible',
            no_templates: 'No hay plantillas disponibles',
            loaded_template: 'Plantilla cargada:',
            enter_prompt: 'Describe lo que debe hacer el script.',
            generating: 'Generando...',
            generated: 'Generado',
            saved: 'Guardado',
            copied: 'Script copiado al portapapeles',
            downloaded: 'Descargado',
            error_prefix: 'Error:',
            validation_valid: 'Válido',
            validation_review: 'Requiere revisión',
            theme_toggle: 'Cambiar tema',
            close_ui: 'Cerrar UI',
            test_connection: 'Probar Conexión',
            auth_status: 'Autenticación',
            session_status: 'Sesión',
            retry_count: 'Intentos',
            module_health: 'Estado Módulos'
        },
        zh: {
            app_title: 'AI助手套件',
            dashboard: '仪表板',
            generator: '脚本生成器',
            templates: '模板',
            versions: '版本',
            security: '安全',
            scripts_generated: '已生成脚本',
            modules_active: '活跃模块',
            export_all: '导出所有脚本',
            import_scripts: '导入脚本',
            clear_history: '清除历史',
            ai_provider: 'AI提供商',
            api_key: 'API密钥',
            streaming: '流式传输',
            context_awareness: '上下文感知',
            describe_prompt: '描述您希望脚本执行的操作：',
            generate: '生成脚本',
            save: '保存脚本',
            copy: '复制',
            download: '下载',
            search_templates: '搜索模板...',
            create_template: '+ 创建模板',
            template_gallery: '模板库',
            category_all: '全部',
            category_productivity: '生产力',
            category_security: '安全',
            category_ui: 'UI增强',
            category_devtools: '开发工具',
            use_template: '使用模板',
            idle: '空闲',
            streaming_active: '流式传输中...',
            update_available: '有可用更新',
            no_templates: '没有可用模板',
            loaded_template: '已加载模板：',
            enter_prompt: '描述您希望脚本执行的操作。',
            generating: '生成中...',
            generated: '已生成',
            saved: '已保存',
            copied: '脚本已复制到剪贴板',
            downloaded: '已下载',
            error_prefix: '错误：',
            validation_valid: '有效',
            validation_review: '需要审查',
            theme_toggle: '切换主题',
            close_ui: '关闭界面',
            test_connection: '测试连接',
            auth_status: '身份验证',
            session_status: '会话',
            retry_count: '重试次数',
            module_health: '模块健康'
        },
        ja: {
            app_title: 'AIアシスタントスイート',
            dashboard: 'ダッシュボード',
            generator: 'スクリプト生成',
            templates: 'テンプレート',
            versions: 'バージョン',
            security: 'セキュリティ',
            scripts_generated: '生成済みスクリプト',
            modules_active: 'アクティブモジュール',
            export_all: 'すべてエクスポート',
            import_scripts: 'インポート',
            clear_history: '履歴クリア',
            ai_provider: 'AIプロバイダー',
            api_key: 'APIキー',
            streaming: 'ストリーミング',
            context_awareness: 'コンテキスト認識',
            describe_prompt: 'スクリプトの動作を説明してください：',
            generate: 'スクリプト生成',
            save: '保存',
            copy: 'コピー',
            download: 'ダウンロード',
            search_templates: 'テンプレート検索...',
            create_template: '+ テンプレート作成',
            template_gallery: 'テンプレートギャラリー',
            category_all: 'すべて',
            category_productivity: '生産性',
            category_security: 'セキュリティ',
            category_ui: 'UI改善',
            category_devtools: '開発ツール',
            use_template: 'テンプレート使用',
            idle: '待機中',
            streaming_active: 'ストリーミング中...',
            update_available: 'アップデートあり',
            no_templates: 'テンプレートがありません',
            loaded_template: 'テンプレートを読み込みました：',
            enter_prompt: 'スクリプトの動作を説明してください。',
            generating: '生成中...',
            generated: '生成完了',
            saved: '保存完了',
            copied: 'クリップボードにコピーしました',
            downloaded: 'ダウンロード完了',
            error_prefix: 'エラー：',
            validation_valid: '有効',
            validation_review: 'レビューが必要',
            theme_toggle: 'テーマ切替',
            close_ui: 'UIを閉じる',
            test_connection: '接続テスト',
            auth_status: '認証',
            session_status: 'セッション',
            retry_count: 'リトライ回数',
            module_health: 'モジュール状態'
        }
    },

    /**
     * Get current locale
     * @returns {string} Current locale code
     */
    getLocale() {
        return this.currentLocale;
    },

    /**
     * Set current locale
     * @param {string} locale - Locale code
     */
    setLocale(locale) {
        if (this.strings[locale]) {
            this.currentLocale = locale;
            document.documentElement.lang = locale;
            
            // Handle RTL
            if (this.rtlLocales.includes(locale)) {
                document.documentElement.dir = 'rtl';
            } else {
                document.documentElement.dir = 'ltr';
            }
            
            try { GM_setValue('user_locale', locale); } catch {}
            debugLog(`Locale changed to: ${locale}`);
        }
    },

    /**
     * Translate a key
     * @param {string} key - Translation key
     * @param {Object} [params] - Interpolation parameters
     * @returns {string} Translated string
     */
    t(key, params = {}) {
        const locale = this.currentLocale;
        let text = this.strings[locale]?.[key] || this.strings[this.fallbackLocale]?.[key] || key;
        
        // Interpolate params
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, v);
        });
        
        return text;
    },

    /**
     * Get available locales
     * @returns {Array} Available locales
     */
    getAvailableLocales() {
        return Object.keys(this.strings).map(code => ({
            code,
            name: this.getLocaleName(code),
            isRTL: this.rtlLocales.includes(code)
        }));
    },

    /**
     * Get human-readable locale name
     * @param {string} code - Locale code
     * @returns {string} Locale name
     */
    getLocaleName(code) {
        const names = {
            en: 'English',
            es: 'Español',
            zh: '中文',
            ja: '日本語'
        };
        return names[code] || code;
    },

    /**
     * Detect browser locale
     * @returns {string} Detected locale
     */
    detectBrowserLocale() {
        try {
            const lang = (navigator.language || navigator.userLanguage || '').split('-')[0];
            if (this.strings[lang]) return lang;
        } catch {}
        return 'en';
    },

    /**
     * Initialize i18n with saved or detected locale
     */
    init() {
        try {
            const saved = GM_getValue('user_locale', '');
            if (saved && this.strings[saved]) {
                this.setLocale(saved);
            } else {
                this.setLocale(this.detectBrowserLocale());
            }
        } catch {
            this.setLocale('en');
        }
    },

    /**
     * Check if module is available
     */
    isAvailable() {
        return true;
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { i18n };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.i18n = i18n;
}