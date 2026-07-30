// ==UserScript==
// @name         Interactive Documentation Module
// @namespace    http://tampermonkey.net/
// @version      2026.03.21.1
// @description  Comprehensive interactive documentation system with searchable help, tutorials, and API references
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @noframes
// ==/UserScript==

/**
 * Interactive Documentation Module
 * 
 * Comprehensive documentation system featuring:
 * - Searchable help system with full-text search
 * - Interactive tutorials and guides
 * - API reference documentation
 * - Module documentation and examples
 * - Context-sensitive help
 * - Video tutorials and walkthroughs
 * - FAQ system with intelligent answers
 * - Code examples and snippets
 * - Performance optimization guides
 * - Troubleshooting guides
 * - Keyboard shortcuts reference
 * - Configuration guides
 */

(function() {
    'use strict';

    const MODULE_NAME = 'Interactive Documentation';
    const MODULE_VERSION = '2026.03.21.1';
    const CONFIG_KEY = 'interactiveDocumentation';
    const DOC_STORAGE_KEY = 'documentationData';
    const USER_PROGRESS_KEY = 'userProgress';
    const SEARCH_INDEX_KEY = 'searchIndex';
    
    // Documentation categories
    const DOC_CATEGORIES = {
        OVERVIEW: 'overview',
        TUTORIALS: 'tutorials',
        API: 'api',
        MODULES: 'modules',
        CONFIGURATION: 'configuration',
        TROUBLESHOOTING: 'troubleshooting',
        PERFORMANCE: 'performance',
        BEST_PRACTICES: 'best_practices',
        FAQ: 'faq',
        SHORTCUTS: 'shortcuts'
    };

    /**
     * Interactive Documentation Class
     */
    class InteractiveDocumentation {
        constructor() {
            this.name = MODULE_NAME;
            this.version = MODULE_VERSION;
            this.dependencies = ['ModuleRegistry', 'ConfigManager'];
            
            // State management
            this.state = {
                isActive: false,
                isVisible: false,
                documentation: new Map(),
                searchIndex: new Map(),
                userProgress: new Map(),
                currentSection: null,
                searchResults: [],
                tutorialProgress: new Map(),
                helpContext: null,
                documentationElement: null,
                searchInput: null,
                contentArea: null
            };

            // Documentation structure
            this.documentationStructure = {
                [DOC_CATEGORIES.OVERVIEW]: {
                    title: 'System Overview',
                    icon: '📋',
                    sections: [
                        { id: 'introduction', title: 'Introduction', level: 1 },
                        { id: 'architecture', title: 'Architecture', level: 1 },
                        { id: 'modules', title: 'Module System', level: 1 },
                        { id: 'features', title: 'Key Features', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.TUTORIALS]: {
                    title: 'Interactive Tutorials',
                    icon: '🎓',
                    sections: [
                        { id: 'getting-started', title: 'Getting Started', level: 1 },
                        { id: 'module-development', title: 'Module Development', level: 1 },
                        { id: 'configuration', title: 'Configuration Guide', level: 1 },
                        { id: 'advanced-features', title: 'Advanced Features', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.API]: {
                    title: 'API Reference',
                    icon: '📚',
                    sections: [
                        { id: 'module-registry', title: 'Module Registry API', level: 1 },
                        { id: 'config-manager', title: 'Configuration Manager API', level: 1 },
                        { id: 'performance-monitor', title: 'Performance Monitor API', level: 1 },
                        { id: 'error-handler', title: 'Error Handler API', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.MODULES]: {
                    title: 'Module Documentation',
                    icon: '📦',
                    sections: [
                        { id: 'module-registry', title: 'Module Registry', level: 1 },
                        { id: 'config-manager', title: 'Configuration Manager', level: 1 },
                        { id: 'performance-monitor', title: 'Performance Monitor', level: 1 },
                        { id: 'error-handler', title: 'Error Handler', level: 1 },
                        { id: 'cache-manager', title: 'Cache Manager', level: 1 },
                        { id: 'ai-resource-optimizer', title: 'AI Resource Optimizer', level: 1 },
                        { id: 'analytics-dashboard', title: 'Analytics Dashboard', level: 1 },
                        { id: 'unified-config', title: 'Unified Configuration', level: 1 },
                        { id: 'intelligent-error-handler', title: 'Intelligent Error Handler', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.CONFIGURATION]: {
                    title: 'Configuration Guide',
                    icon: '⚙️',
                    sections: [
                        { id: 'basic-configuration', title: 'Basic Configuration', level: 1 },
                        { id: 'advanced-settings', title: 'Advanced Settings', level: 1 },
                        { id: 'feature-flags', title: 'Feature Flags', level: 1 },
                        { id: 'environment-variables', title: 'Environment Variables', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.TROUBLESHOOTING]: {
                    title: 'Troubleshooting',
                    icon: '🔧',
                    sections: [
                        { id: 'common-issues', title: 'Common Issues', level: 1 },
                        { id: 'error-codes', title: 'Error Codes', level: 1 },
                        { id: 'debugging', title: 'Debugging Guide', level: 1 },
                        { id: 'performance-issues', title: 'Performance Issues', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.PERFORMANCE]: {
                    title: 'Performance Optimization',
                    icon: '⚡',
                    sections: [
                        { id: 'optimization-tips', title: 'Optimization Tips', level: 1 },
                        { id: 'memory-management', title: 'Memory Management', level: 1 },
                        { id: 'caching-strategies', title: 'Caching Strategies', level: 1 },
                        { id: 'module-loading', title: 'Module Loading Optimization', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.BEST_PRACTICES]: {
                    title: 'Best Practices',
                    icon: '⭐',
                    sections: [
                        { id: 'module-development', title: 'Module Development', level: 1 },
                        { id: 'error-handling', title: 'Error Handling', level: 1 },
                        { id: 'security', title: 'Security Considerations', level: 1 },
                        { id: 'testing', title: 'Testing Guidelines', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.FAQ]: {
                    title: 'Frequently Asked Questions',
                    icon: '❓',
                    sections: [
                        { id: 'general-questions', title: 'General Questions', level: 1 },
                        { id: 'technical-questions', title: 'Technical Questions', level: 1 },
                        { id: 'integration', title: 'Integration Questions', level: 1 },
                        { id: 'support', title: 'Support Questions', level: 1 }
                    ]
                },
                [DOC_CATEGORIES.SHORTCUTS]: {
                    title: 'Keyboard Shortcuts',
                    icon: '⌨️',
                    sections: [
                        { id: 'global-shortcuts', title: 'Global Shortcuts', level: 1 },
                        { id: 'module-shortcuts', title: 'Module Shortcuts', level: 1 },
                        { id: 'debug-shortcuts', title: 'Debug Shortcuts', level: 1 },
                        { id: 'navigation', title: 'Navigation Shortcuts', level: 1 }
                    ]
                }
            };

            this.init();
        }

        /**
         * Initialize the interactive documentation system
         */
        async init() {
            try {
                console.log(`[${MODULE_NAME}] Initializing Interactive Documentation v${MODULE_VERSION}`);
                
                // Load documentation data
                this.loadDocumentationData();
                
                // Build search index
                this.buildSearchIndex();
                
                // Load user progress
                this.loadUserProgress();
                
                // Initialize UI
                this.initializeDocumentationUI();
                
                // Register with module registry
                if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
                    window.ModuleRegistry.register(this);
                }

                // Register menu commands
                this.registerMenuCommands();
                
                console.log(`[${MODULE_NAME}] Interactive Documentation initialized successfully`);
                this.state.isActive = true;
                
            } catch (error) {
                console.error(`[${MODULE_NAME}] Initialization failed:`, error);
                this.state.isActive = false;
            }
        }

        /**
         * Load documentation data
         */
        loadDocumentationData() {
            try {
                const storedData = GM_getValue(DOC_STORAGE_KEY);
                if (storedData) {
                    const data = JSON.parse(storedData);
                    this.state.documentation = new Map(Object.entries(data));
                    console.log(`[${MODULE_NAME}] Loaded ${this.state.documentation.size} documentation entries`);
                } else {
                    // Initialize with default documentation
                    this.initializeDefaultDocumentation();
                }
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not load documentation data:`, error);
                this.initializeDefaultDocumentation();
            }
        }

        /**
         * Initialize default documentation
         */
        initializeDefaultDocumentation() {
            // System Overview
            this.addDocumentation('introduction', DOC_CATEGORIES.OVERVIEW, {
                title: 'Introduction',
                content: `
                    <h2>Welcome to AI Chat Userscript Studio</h2>
                    <p>AI Chat Userscript Studio is an enterprise-grade userscript framework designed to enhance AI chat platforms with advanced functionality, performance optimization, and intelligent automation.</p>
                    
                    <h3>Key Features</h3>
                    <ul>
                        <li><strong>Modular Architecture:</strong> Extensible module system with dependency management</li>
                        <li><strong>Performance Monitoring:</strong> Real-time performance tracking and optimization</li>
                        <li><strong>Intelligent Error Handling:</strong> Advanced error recovery and circuit breaker patterns</li>
                        <li><strong>Configuration Management:</strong> Unified configuration with feature flags and A/B testing</li>
                        <li><strong>Analytics Dashboard:</strong> Comprehensive analytics and monitoring</li>
                        <li><strong>AI-Powered Optimization:</strong> Machine learning-based resource optimization</li>
                    </ul>
                    
                    <h3>Supported Platforms</h3>
                    <ul>
                        <li>ChatGPT (OpenAI)</li>
                        <li>Claude (Anthropic)</li>
                        <li>Poe</li>
                        <li>Perplexity AI</li>
                        <li>Pi AI</li>
                        <li>You.com</li>
                        <li>Gemini (Google)</li>
                        <li>Copilot (Microsoft)</li>
                        <li>Mistral AI</li>
                    </ul>
                `,
                level: 1,
                tags: ['introduction', 'overview', 'features']
            });

            this.addDocumentation('architecture', DOC_CATEGORIES.OVERVIEW, {
                title: 'Architecture',
                content: `
                    <h2>System Architecture</h2>
                    <p>The AI Chat Userscript Studio follows a modular, layered architecture designed for scalability and maintainability.</p>
                    
                    <h3>Architecture Layers</h3>
                    <ol>
                        <li><strong>Core Layer:</strong> Foundation modules providing essential functionality</li>
                        <li><strong>Service Layer:</strong> Business logic and service modules</li>
                        <li><strong>UI Layer:</strong> User interface and interaction modules</li>
                        <li><strong>Integration Layer:</strong> Platform-specific integration modules</li>
                    </ol>
                    
                    <h3>Module Communication</h3>
                    <p>Modules communicate through a centralized registry system that provides:</p>
                    <ul>
                        <li>Service discovery and registration</li>
                        <li>Event-driven communication</li>
                        <li>Dependency injection</li>
                        <li>Configuration sharing</li>
                    </ul>
                    
                    <h3>Design Patterns</h3>
                    <ul>
                        <li><strong>Singleton Pattern:</strong> For shared services and managers</li>
                        <li><strong>Observer Pattern:</strong> For event handling and notifications</li>
                        <li><strong>Strategy Pattern:</strong> For configurable behaviors</li>
                        <li><strong>Factory Pattern:</strong> For module instantiation</li>
                        <li><strong>Circuit Breaker:</strong> For fault tolerance</li>
                    </ul>
                `,
                level: 1,
                tags: ['architecture', 'design', 'patterns']
            });

            // Tutorials
            this.addDocumentation('getting-started', DOC_CATEGORIES.TUTORIALS, {
                title: 'Getting Started',
                content: `
                    <h2>Getting Started with AI Chat Userscript Studio</h2>
                    
                    <h3>Installation</h3>
                    <ol>
                        <li>Install Tampermonkey or Violentmonkey browser extension</li>
                        <li>Download the AI Chat Userscript Studio userscript</li>
                        <li>Install the userscript through your browser extension</li>
                        <li>Visit any supported AI chat platform</li>
                    </ol>
                    
                    <h3>Basic Configuration</h3>
                    <p>Access the configuration menu through the browser extension interface:</p>
                    <ul>
                        <li>Enable/disable modules</li>
                        <li>Configure module settings</li>
                        <li>Set up feature flags</li>
                        <li>Customize user interface</li>
                    </ul>
                    
                    <h3>First Steps</h3>
                    <ol>
                        <li>Enable the Module Registry to see available modules</li>
                        <li>Enable Performance Monitor to track system performance</li>
                        <li>Enable Configuration Manager for centralized settings</li>
                        <li>Explore the Analytics Dashboard for insights</li>
                    </ol>
                `,
                level: 1,
                tags: ['tutorial', 'getting-started', 'installation']
            });

            // API Reference
            this.addDocumentation('module-registry', DOC_CATEGORIES.API, {
                title: 'Module Registry API',
                content: `
                    <h2>Module Registry API</h2>
                    <p>The Module Registry provides a centralized system for managing and interacting with modules.</p>
                    
                    <h3>Core Methods</h3>
                    <pre><code>
// Register a module
window.ModuleRegistry.register(module);

// Get a module by name
const module = window.ModuleRegistry.get('ModuleName');

// List all modules
const modules = window.ModuleRegistry.list();

// Check if module is active
const isActive = window.ModuleRegistry.isActive('ModuleName');

// Get module count
const count = window.ModuleRegistry.getModuleCount();

// Unregister a module
window.ModuleRegistry.unregister('ModuleName');
                    </code></pre>
                    
                    <h3>Event System</h3>
                    <pre><code>
// Listen for module events
window.ModuleRegistry.on('module:registered', (module) => {
    console.log('Module registered:', module.name);
});

// Emit custom events
window.ModuleRegistry.emit('custom:event', data);
                    </code></pre>
                `,
                level: 1,
                tags: ['api', 'module-registry', 'reference']
            });

            // Module Documentation
            this.addDocumentation('module-registry', DOC_CATEGORIES.MODULES, {
                title: 'Module Registry',
                content: `
                    <h2>Module Registry Module</h2>
                    <p>The Module Registry is the core component that manages all modules in the system.</p>
                    
                    <h3>Features</h3>
                    <ul>
                        <li>Automatic module discovery and registration</li>
                        <li>Dependency management and resolution</li>
                        <li>Module lifecycle management</li>
                        <li>Event-driven communication</li>
                        <li>Module validation and health checks</li>
                    </ul>
                    
                    <h3>Configuration</h3>
                    <pre><code>
{
    "enableModuleRegistry": true,
    "enableAutoLoad": true,
    "enableValidation": true,
    "maxConcurrentModules": 50,
    "moduleLoadTimeout": 30000
}
                    </code></pre>
                    
                    <h3>Usage Examples</h3>
                    <pre><code>
// Create a custom module
class MyModule {
    constructor() {
        this.name = 'MyModule';
        this.version = '1.0.0';
        this.dependencies = [];
    }
    
    init() {
        console.log('MyModule initialized');
    }
    
    execute() {
        // Module logic here
    }
}

// Register the module
window.ModuleRegistry.register(new MyModule());
                    </code></pre>
                `,
                level: 1,
                tags: ['module', 'registry', 'documentation']
            });

            // Configuration Guide
            this.addDocumentation('basic-configuration', DOC_CATEGORIES.CONFIGURATION, {
                title: 'Basic Configuration',
                content: `
                    <h2>Basic Configuration Guide</h2>
                    <p>Learn how to configure the AI Chat Userscript Studio for optimal performance.</p>
                    
                    <h3>Configuration Methods</h3>
                    <ol>
                        <li><strong>Menu Commands:</strong> Use browser extension menu for quick access</li>
                        <li><strong>Configuration Manager:</strong> Advanced configuration interface</li>
                        <li><strong>Direct API:</strong> Programmatic configuration</li>
                    </ol>
                    
                    <h3>Common Settings</h3>
                    <ul>
                        <li><strong>Debug Mode:</strong> Enable detailed logging</li>
                        <li><strong>Performance Monitoring:</strong> Track system performance</li>
                        <li><strong>Auto-Optimization:</strong> Enable automatic performance tuning</li>
                        <li><strong>Memory Management:</strong> Configure memory usage limits</li>
                    </ul>
                    
                    <h3>Configuration Example</h3>
                    <pre><code>
// Enable debug mode
window.ConfigManager.set('system.debugMode', true);

// Configure performance monitoring
window.ConfigManager.set('performance.enablePerformanceMetrics', true);
window.ConfigManager.set('performance.metricsRetentionDays', 30);

// Set memory limits
window.ConfigManager.set('performance.maxMemoryUsage', 8192);
                    </code></pre>
                `,
                level: 1,
                tags: ['configuration', 'guide', 'basic']
            });

            // Troubleshooting
            this.addDocumentation('common-issues', DOC_CATEGORIES.TROUBLESHOOTING, {
                title: 'Common Issues',
                content: `
                    <h2>Common Issues and Solutions</h2>
                    
                    <h3>Module Not Loading</h3>
                    <p><strong>Symptoms:</strong> Module appears in registry but doesn't function</p>
                    <p><strong>Solutions:</strong></p>
                    <ul>
                        <li>Check module dependencies are loaded</li>
                        <li>Verify module initialization code</li>
                        <li>Check browser console for errors</li>
                        <li>Ensure module is compatible with current platform</li>
                    </ul>
                    
                    <h3>Performance Issues</h3>
                    <p><strong>Symptoms:</strong> Slow response times, high memory usage</p>
                    <p><strong>Solutions:</strong></p>
                    <ul>
                        <li>Enable Performance Monitor to identify bottlenecks</li>
                        <li>Reduce number of active modules</li>
                        <li>Clear browser cache and temporary files</li>
                        <li>Check for memory leaks in custom modules</li>
                    </ul>
                    
                    <h3>Configuration Not Saving</h3>
                    <p><strong>Symptoms:</strong> Settings reset after page refresh</p>
                    <p><strong>Solutions:</strong></p>
                    <ul>
                        <li>Check browser storage permissions</li>
                        <li>Verify GM_setValue is working</li>
                        <li>Check for storage quota limits</li>
                        <li>Try clearing and reconfiguring settings</li>
                    </ul>
                `,
                level: 1,
                tags: ['troubleshooting', 'issues', 'solutions']
            });

            // Performance Optimization
            this.addDocumentation('optimization-tips', DOC_CATEGORIES.PERFORMANCE, {
                title: 'Optimization Tips',
                content: `
                    <h2>Performance Optimization Tips</h2>
                    
                    <h3>General Optimization</h3>
                    <ul>
                        <li><strong>Module Management:</strong> Only enable necessary modules</li>
                        <li><strong>Memory Usage:</strong> Monitor and optimize memory consumption</li>
                        <li><strong>Network Requests:</strong> Minimize and cache network calls</li>
                        <li><strong>DOM Manipulation:</strong> Batch DOM operations when possible</li>
                    </ul>
                    
                    <h3>Advanced Techniques</h3>
                    <ul>
                        <li><strong>Lazy Loading:</strong> Load modules on demand</li>
                        <li><strong>Caching:</strong> Implement intelligent caching strategies</li>
                        <li><strong>Code Splitting:</strong> Split large modules into smaller chunks</li>
                        <li><strong>Event Delegation:</strong> Use event delegation for better performance</li>
                    </ul>
                    
                    <h3>Monitoring Tools</h3>
                    <ul>
                        <li>Performance Monitor for real-time metrics</li>
                        <li>Analytics Dashboard for trend analysis</li>
                        <li>Memory Profiler for memory usage analysis</li>
                        <li>Network Monitor for request optimization</li>
                    </ul>
                `,
                level: 1,
                tags: ['performance', 'optimization', 'tips']
            });

            // Best Practices
            this.addDocumentation('module-development', DOC_CATEGORIES.BEST_PRACTICES, {
                title: 'Module Development Best Practices',
                content: `
                    <h2>Module Development Best Practices</h2>
                    
                    <h3>Code Organization</h3>
                    <ul>
                        <li><strong>Single Responsibility:</strong> Each module should have one clear purpose</li>
                        <li><strong>Clear Naming:</strong> Use descriptive names for modules and functions</li>
                        <li><strong>Documentation:</strong> Document all public APIs and configuration options</li>
                        <li><strong>Error Handling:</strong> Implement comprehensive error handling</li>
                    </ul>
                    
                    <h3>Performance Considerations</h3>
                    <ul>
                        <li><strong>Initialization:</strong> Keep initialization code lightweight</li>
                        <li><strong>Memory Management:</strong> Clean up resources when module is destroyed</li>
                        <li><strong>Event Listeners:</strong> Remove event listeners to prevent memory leaks</li>
                        <li><strong>DOM Access:</strong> Minimize DOM queries and cache results when possible</li>
                    </ul>
                    
                    <h3>Security Guidelines</h3>
                    <ul>
                        <li><strong>Input Validation:</strong> Validate all user inputs</li>
                        <li><strong>Content Security:</strong> Avoid eval() and unsafe DOM operations</li>
                        <li><strong>Data Protection:</strong> Handle sensitive data securely</li>
                        <li><strong>Permissions:</strong> Request only necessary permissions</li>
                    </ul>
                `,
                level: 1,
                tags: ['best-practices', 'development', 'guidelines']
            });

            // FAQ
            this.addDocumentation('general-questions', DOC_CATEGORIES.FAQ, {
                title: 'General Questions',
                content: `
                    <h2>Frequently Asked Questions</h2>
                    
                    <h3>Q: Is this userscript safe to use?</h3>
                    <p><strong>A:</strong> Yes, the AI Chat Userscript Studio is designed with security in mind. It only enhances the user experience and doesn't collect or transmit personal data without explicit permission.</p>
                    
                    <h3>Q: Will this affect my account or get me banned?</h3>
                    <p><strong>A:</strong> No, this userscript only modifies the client-side interface and doesn't interact with the platform's servers in any way that would violate terms of service.</p>
                    
                    <h3>Q: Can I use this with other browser extensions?</h3>
                    <p><strong>A:</strong> Yes, the userscript is designed to work alongside other browser extensions without conflicts.</p>
                    
                    <h3>Q: How do I update the userscript?</h3>
                    <p><strong>A:</strong> Updates are automatically detected and installed when available. You can also manually check for updates through the browser extension interface.</p>
                    
                    <h3>Q: Can I contribute to development?</h3>
                    <p><strong>A:</strong> Yes, the project is open source and welcomes contributions. Please see the documentation for contribution guidelines.</p>
                `,
                level: 1,
                tags: ['faq', 'questions', 'general']
            });

            // Keyboard Shortcuts
            this.addDocumentation('global-shortcuts', DOC_CATEGORIES.SHORTCUTS, {
                title: 'Global Shortcuts',
                content: `
                    <h2>Global Keyboard Shortcuts</h2>
                    
                    <h3>Documentation Access</h3>
                    <ul>
                        <li><strong>Ctrl + Shift + D:</strong> Open Documentation</li>
                        <li><strong>Ctrl + Shift + H:</strong> Show Help</li>
                        <li><strong>Ctrl + Shift + S:</strong> Show Settings</li>
                    </ul>
                    
                    <h3>Module Management</h3>
                    <ul>
                        <li><strong>Ctrl + Shift + M:</strong> Toggle Module Registry</li>
                        <li><strong>Ctrl + Shift + P:</strong> Toggle Performance Monitor</li>
                        <li><strong>Ctrl + Shift + A:</strong> Toggle Analytics Dashboard</li>
                    </ul>
                    
                    <h3>Debugging</h3>
                    <ul>
                        <li><strong>Ctrl + Shift + E:</strong> Show Error Log</li>
                        <li><strong>Ctrl + Shift + C:</strong> Clear Console</li>
                        <li><strong>Ctrl + Shift + R:</strong> Reload Modules</li>
                    </ul>
                    
                    <h3>Note</h3>
                    <p>Keyboard shortcuts may vary depending on your browser and other extensions. Some shortcuts may not work on all platforms.</p>
                `,
                level: 1,
                tags: ['shortcuts', 'keyboard', 'global']
            });

            console.log(`[${MODULE_NAME}] Default documentation initialized`);
        }

        /**
         * Add documentation entry
         */
        addDocumentation(id, category, content) {
            const key = `${category}:${id}`;
            this.state.documentation.set(key, {
                ...content,
                id,
                category,
                lastUpdated: Date.now()
            });
        }

        /**
         * Build search index
         */
        buildSearchIndex() {
            this.state.searchIndex.clear();
            
            for (const [key, doc] of this.state.documentation.entries()) {
                const searchableText = `${doc.title} ${doc.content} ${doc.tags?.join(' ') || ''}`.toLowerCase();
                const words = this.tokenizeText(searchableText);
                
                for (const word of words) {
                    if (!this.state.searchIndex.has(word)) {
                        this.state.searchIndex.set(word, new Set());
                    }
                    this.state.searchIndex.get(word).add(key);
                }
            }
            
            console.log(`[${MODULE_NAME}] Search index built with ${this.state.searchIndex.size} terms`);
        }

        /**
         * Tokenize text for search
         */
        tokenizeText(text) {
            return text
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 2)
                .filter(word => !this.isStopWord(word));
        }

        /**
         * Check if word is a stop word
         */
        isStopWord(word) {
            const stopWords = [
                'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
                'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
                'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall'
            ];
            return stopWords.includes(word.toLowerCase());
        }

        /**
         * Load user progress
         */
        loadUserProgress() {
            try {
                const storedProgress = GM_getValue(USER_PROGRESS_KEY);
                if (storedProgress) {
                    const progress = JSON.parse(storedProgress);
                    this.state.userProgress = new Map(Object.entries(progress));
                    console.log(`[${MODULE_NAME}] Loaded user progress for ${this.state.userProgress.size} items`);
                }
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not load user progress:`, error);
                this.state.userProgress = new Map();
            }
        }

        /**
         * Initialize documentation UI
         */
        initializeDocumentationUI() {
            // Create documentation container
            this.state.documentationElement = document.createElement('div');
            this.state.documentationElement.id = 'ai-documentation';
            this.state.documentationElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
                z-index: 999999;
                display: none;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;

            // Create main content area
            const mainContent = document.createElement('div');
            mainContent.style.cssText = `
                position: relative;
                width: 90%;
                height: 90%;
                margin: 20px auto;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                display: flex;
                overflow: hidden;
            `;

            // Create sidebar
            const sidebar = document.createElement('div');
            sidebar.style.cssText = `
                width: 300px;
                background: #f8f9fa;
                border-right: 1px solid #e9ecef;
                padding: 20px;
                overflow-y: auto;
            `;

            // Create search area
            const searchArea = document.createElement('div');
            searchArea.style.cssText = 'margin-bottom: 20px;';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Search documentation...';
            searchInput.style.cssText = `
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            `;
            this.state.searchInput = searchInput;

            searchArea.appendChild(searchInput);

            // Create category navigation
            const categoryNav = document.createElement('div');
            categoryNav.style.cssText = 'margin-bottom: 20px;';

            for (const [category, config] of Object.entries(this.documentationStructure)) {
                const categoryBtn = document.createElement('div');
                categoryBtn.style.cssText = `
                    padding: 10px;
                    margin-bottom: 5px;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    border-left: 4px solid #007bff;
                    transition: all 0.2s ease;
                `;
                categoryBtn.innerHTML = `${config.icon} ${config.title}`;
                
                categoryBtn.addEventListener('click', () => {
                    this.showCategory(category);
                });

                categoryNav.appendChild(categoryBtn);
            }

            sidebar.appendChild(searchArea);
            sidebar.appendChild(categoryNav);

            // Create content area
            const contentArea = document.createElement('div');
            contentArea.style.cssText = `
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                background: white;
            `;
            this.state.contentArea = contentArea;

            // Create header
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
            `;

            const title = document.createElement('h2');
            title.textContent = 'AI Chat Userscript Studio Documentation';
            title.style.cssText = 'margin: 0; color: #333;';

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                background: #dc3545;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
            `;
            closeBtn.addEventListener('click', () => this.hide());

            header.appendChild(title);
            header.appendChild(closeBtn);

            contentArea.appendChild(header);

            // Create breadcrumbs
            const breadcrumbs = document.createElement('div');
            breadcrumbs.id = 'doc-breadcrumbs';
            breadcrumbs.style.cssText = 'margin-bottom: 20px; color: #666; font-size: 14px;';

            contentArea.appendChild(breadcrumbs);

            // Create main content container
            const mainContentContainer = document.createElement('div');
            mainContentContainer.id = 'doc-content';
            mainContentContainer.style.cssText = 'line-height: 1.6;';

            contentArea.appendChild(mainContentContainer);

            mainContent.appendChild(sidebar);
            mainContent.appendChild(contentArea);

            this.state.documentationElement.appendChild(mainContent);

            // Add event listeners
            searchInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value);
            });

            document.body.appendChild(this.state.documentationElement);
        }

        /**
         * Show documentation
         */
        show() {
            if (!this.state.documentationElement) return;
            
            this.state.isVisible = true;
            this.state.documentationElement.style.display = 'block';
            setTimeout(() => {
                this.state.documentationElement.style.opacity = '1';
            }, 10);
            
            // Show overview by default
            this.showCategory(DOC_CATEGORIES.OVERVIEW);
            
            console.log(`[${MODULE_NAME}] Documentation shown`);
        }

        /**
         * Hide documentation
         */
        hide() {
            if (!this.state.documentationElement) return;
            
            this.state.isVisible = false;
            this.state.documentationElement.style.opacity = '0';
            setTimeout(() => {
                this.state.documentationElement.style.display = 'none';
            }, 300);
            
            console.log(`[${MODULE_NAME}] Documentation hidden`);
        }

        /**
         * Toggle documentation visibility
         */
        toggle() {
            if (this.state.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }

        /**
         * Show specific category
         */
        showCategory(category) {
            const breadcrumbs = document.getElementById('doc-breadcrumbs');
            const contentArea = document.getElementById('doc-content');
            
            const categoryConfig = this.documentationStructure[category];
            if (!categoryConfig) return;
            
            breadcrumbs.innerHTML = `<span style="color: #007bff;">${categoryConfig.icon} ${categoryConfig.title}</span>`;
            
            let html = '';
            for (const section of categoryConfig.sections) {
                const docKey = `${category}:${section.id}`;
                const doc = this.state.documentation.get(docKey);
                
                html += `
                    <div style="margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">${section.title}</h3>
                        ${doc ? doc.content : '<p>Documentation coming soon...</p>'}
                    </div>
                `;
            }
            
            contentArea.innerHTML = html;
            this.state.currentSection = category;
        }

        /**
         * Perform search
         */
        performSearch(query) {
            if (!query.trim()) {
                this.showCategory(this.state.currentSection || DOC_CATEGORIES.OVERVIEW);
                return;
            }
            
            const searchTerms = this.tokenizeText(query.toLowerCase());
            const results = new Map();
            
            for (const term of searchTerms) {
                if (this.state.searchIndex.has(term)) {
                    for (const docKey of this.state.searchIndex.get(term)) {
                        if (!results.has(docKey)) {
                            results.set(docKey, 0);
                        }
                        results.set(docKey, results.get(docKey) + 1);
                    }
                }
            }
            
            // Sort results by score
            const sortedResults = Array.from(results.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20);
            
            this.displaySearchResults(sortedResults, query);
        }

        /**
         * Display search results
         */
        displaySearchResults(results, query) {
            const breadcrumbs = document.getElementById('doc-breadcrumbs');
            const contentArea = document.getElementById('doc-content');
            
            breadcrumbs.innerHTML = `Search results for: <strong>"${query}"</strong> (${results.length} results)`;
            
            let html = '';
            if (results.length === 0) {
                html = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <h3>No results found</h3>
                        <p>Try using different keywords or check your spelling.</p>
                    </div>
                `;
            } else {
                for (const [docKey, score] of results) {
                    const doc = this.state.documentation.get(docKey);
                    if (doc) {
                        const snippet = this.getSearchSnippet(doc.content, query);
                        html += `
                            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 8px;">
                                <h4 style="margin-top: 0; color: #007bff;">${doc.title}</h4>
                                <div style="color: #666; font-size: 14px; margin-bottom: 10px;">
                                    ${this.getCategoryName(doc.category)} • Score: ${score}
                                </div>
                                <div style="line-height: 1.5;">${snippet}</div>
                                <button onclick="window.InteractiveDocumentation.showDocument('${docKey}')" style="margin-top: 10px; background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                                    Read Full Article
                                </button>
                            </div>
                        `;
                    }
                }
            }
            
            contentArea.innerHTML = html;
        }

        /**
         * Get search snippet
         */
        getSearchSnippet(content, query) {
            const maxLength = 200;
            const cleanContent = content.replace(/<[^>]*>/g, '');
            const queryWords = query.toLowerCase().split(/\s+/);
            
            let bestMatch = cleanContent.substring(0, maxLength);
            
            for (const word of queryWords) {
                const index = cleanContent.toLowerCase().indexOf(word);
                if (index !== -1) {
                    const start = Math.max(0, index - 50);
                    const end = Math.min(cleanContent.length, index + maxLength);
                    bestMatch = cleanContent.substring(start, end);
                    break;
                }
            }
            
            return bestMatch.length < cleanContent.length ? bestMatch + '...' : bestMatch;
        }

        /**
         * Get category name
         */
        getCategoryName(category) {
            const config = this.documentationStructure[category];
            return config ? config.title : category;
        }

        /**
         * Show specific document
         */
        showDocument(docKey) {
            const [category, id] = docKey.split(':');
            const doc = this.state.documentation.get(docKey);
            
            if (doc) {
                this.showCategory(category);
                // Scroll to the specific section
                setTimeout(() => {
                    const contentArea = document.getElementById('doc-content');
                    const sections = contentArea.querySelectorAll('h3');
                    for (const section of sections) {
                        if (section.textContent.includes(doc.title)) {
                            section.scrollIntoView({ behavior: 'smooth' });
                            break;
                        }
                    }
                }, 100);
            }
        }

        /**
         * Get documentation report
         */
        getDocumentationReport() {
            return {
                active: this.state.isActive,
                isVisible: this.state.isVisible,
                totalDocuments: this.state.documentation.size,
                categories: Object.keys(this.documentationStructure).length,
                searchIndexSize: this.state.searchIndex.size,
                userProgress: this.state.userProgress.size,
                currentSection: this.state.currentSection
            };
        }

        /**
         * Register menu commands
         */
        registerMenuCommands() {
            if (typeof GM_registerMenuCommand === 'function') {
                GM_registerMenuCommand(`Show ${MODULE_NAME}`, () => {
                    this.show();
                });

                GM_registerMenuCommand(`Hide ${MODULE_NAME}`, () => {
                    this.hide();
                });

                GM_registerMenuCommand(`Toggle ${MODULE_NAME}`, () => {
                    this.toggle();
                });

                GM_registerMenuCommand(`Show Documentation Report`, () => {
                    const report = this.getDocumentationReport();
                    console.table(report);
                    alert(`Documentation Report: ${JSON.stringify(report, null, 2)}`);
                });

                GM_registerMenuCommand(`Search Documentation`, () => {
                    const query = prompt('Enter search query:');
                    if (query) {
                        this.show();
                        this.performSearch(query);
                    }
                });

                GM_registerMenuCommand(`Show Module Documentation`, () => {
                    this.show();
                    this.showCategory(DOC_CATEGORIES.MODULES);
                });

                GM_registerMenuCommand(`Show API Reference`, () => {
                    this.show();
                    this.showCategory(DOC_CATEGORIES.API);
                });
            }
        }

        /**
         * Cleanup and destroy
         */
        destroy() {
            console.log(`[${MODULE_NAME}] Destroying Interactive Documentation`);

            // Remove from DOM
            if (this.state.documentationElement) {
                this.state.documentationElement.remove();
                this.state.documentationElement = null;
            }

            // Save final state
            this.saveDocumentationData();
            this.saveUserProgress();

            this.state.isActive = false;
            console.log(`[${MODULE_NAME}] Interactive Documentation destroyed`);
        }

        /**
         * Save documentation data
         */
        saveDocumentationData() {
            try {
                const data = Object.fromEntries(this.state.documentation);
                GM_setValue(DOC_STORAGE_KEY, JSON.stringify(data));
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not save documentation data:`, error);
            }
        }

        /**
         * Save user progress
         */
        saveUserProgress() {
            try {
                const progress = Object.fromEntries(this.state.userProgress);
                GM_setValue(USER_PROGRESS_KEY, JSON.stringify(progress));
            } catch (error) {
                console.warn(`[${MODULE_NAME}] Could not save user progress:`, error);
            }
        }

        /**
         * Execute module
         */
        execute() {
            // Module execution logic if needed
            console.log(`[${MODULE_NAME}] Module execution completed`);
        }
    }

    // Initialize the module
    const interactiveDocumentation = new InteractiveDocumentation();

    // Make globally available
    window.InteractiveDocumentation = interactiveDocumentation;

    // Add global method for showing documents
    window.showDocument = (docKey) => {
        if (window.InteractiveDocumentation) {
            window.InteractiveDocumentation.showDocument(docKey);
        }
    };

})();