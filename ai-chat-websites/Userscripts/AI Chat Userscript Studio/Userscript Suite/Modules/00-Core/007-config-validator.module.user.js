// ==UserScript==
// @name         ConfigValidator
// @version      2026.05.04.0
// @description  ChatGPT - Configuration validation and schema enforcement
// @author       AI RMD
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
// @grant        none
// ==/UserScript==

/**
 * ConfigValidator - Configuration validation and schema enforcement
 * Validates configuration values against expected types and constraints
 */
(function() {
    'use strict';

    class ConfigValidator {
        /**
         * Validate a configuration object
         * @param {Object} config - Configuration to validate
         * @param {Object} defaults - Default values schema
         * @returns {Object} Validated configuration
         */
        static validate(config, defaults = {}) {
            if (!config || typeof config !== 'object') {
                return Object.assign({}, defaults);
            }
            const valid = {};
            for (const [key, defaultVal] of Object.entries(defaults)) {
                valid[key] = this.validateProperty(key, config[key], defaultVal);
            }
            return Object.freeze(valid);
        }

        /**
         * Validate a single configuration property
         * @param {string} key - Property name
         * @param {*} value - Property value
         * @param {*} defaultValue - Default value
         * @returns {*} Validated value
         */
        static validateProperty(key, value, defaultValue) {
            if (value == null) return defaultValue;
            try {
                switch (typeof defaultValue) {
                    case 'boolean':
                        return Boolean(value);
                    case 'number':
                        return Number.isFinite(Number(value)) ? Number(value) : defaultValue;
                    case 'string':
                        return String(value).trim() || defaultValue;
                    case 'object':
                        if (Array.isArray(defaultValue)) {
                            return Array.isArray(value) ? Object.freeze([...new Set(value.filter(Boolean))]) : [...defaultValue];
                        }
                        if (value && typeof value === 'object') {
                            return Object.freeze(value);
                        }
                        return defaultValue;
                    default:
                        return defaultValue;
                }
            } catch (e) {
                console.warn(`[ConfigValidator] Invalid value for ${key}:`, e.message);
                return defaultValue;
            }
        }

        /**
         * Validate a configuration value against a schema
         * @param {*} value - Value to validate
         * @param {Object} schema - Validation schema
         * @returns {Object} Validation result with isValid and errors
         */
        static validateAgainstSchema(value, schema) {
            const errors = [];

            if (schema.type && typeof value !== schema.type) {
                errors.push(`Expected type ${schema.type}, got ${typeof value}`);
            }

            if (schema.required && (value == null || value === '')) {
                errors.push('Value is required');
            }

            if (schema.min !== undefined && Number(value) < schema.min) {
                errors.push(`Value must be >= ${schema.min}`);
            }

            if (schema.max !== undefined && Number(value) > schema.max) {
                errors.push(`Value must be <= ${schema.max}`);
            }

            if (schema.pattern && !new RegExp(schema.pattern).test(String(value))) {
                errors.push(`Value does not match pattern ${schema.pattern}`);
            }

            if (schema.enum && !schema.enum.includes(value)) {
                errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
            }

            return {
                isValid: errors.length === 0,
                errors: errors,
                value: errors.length === 0 ? value : undefined
            };
        }

        /**
         * Validate module configuration
         * @param {string} moduleName - Module name
         * @param {Object} config - Module configuration
         * @returns {Object} Validation result
         */
        static validateModuleConfig(moduleName, config) {
            const schema = {
                hub: {
                    theme: { type: 'string', enum: ['light', 'dark', 'system'] },
                    debugMode: { type: 'boolean' },
                    autoScroll: { type: 'boolean' },
                    infinityMode: { type: 'boolean' },
                    maxMemoryUsage: { type: 'number', min: 256, max: 32768 },
                    maxConcurrentRequests: { type: 'number', min: 1, max: 100 }
                },
                automation: {
                    infinityModeActive: { type: 'boolean' },
                    delayAfterApply: { type: 'number', min: 0, max: 60000 },
                    delayAfterSkip: { type: 'number', min: 0, max: 60000 },
                    maxRetries: { type: 'number', min: 0, max: 10 }
                },
                errorHandling: {
                    maxRetries: { type: 'number', min: 0, max: 10 },
                    retryDelay: { type: 'number', min: 0, max: 60000 },
                    circuitBreaker: {
                        type: 'object',
                        required: true
                    }
                },
                ui: {
                    theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
                    enableKeyboardShortcuts: { type: 'boolean' },
                    feedbackDuration: { type: 'number', min: 0, max: 10000 }
                },
                'autonomous-agent-runner': {
                    maxConcurrentTasks: { type: 'number', min: 1, max: 10 },
                    defaultTimeout: { type: 'number', min: 1000, max: 3600000 },
                    maxRetries: { type: 'number', min: 0, max: 10 },
                    enableThrottling: { type: 'boolean' },
                    maxTasksPerMinute: { type: 'number', min: 1, max: 200 }
                },
                'bookmark-manager': {
                    maxBookmarks: { type: 'number', min: 100, max: 100000 },
                    enableNotifications: { type: 'boolean' },
                    enableBatchOps: { type: 'boolean' },
                    autoSave: { type: 'boolean' }
                }
            };

            const moduleSchema = schema[moduleName];
            if (!moduleSchema) {
                return { isValid: true, errors: [], config };
            }

            const result = { isValid: true, errors: [], config: {} };
            
            for (const [key, value] of Object.entries(config)) {
                if (moduleSchema[key]) {
                    const fieldValidation = this.validateAgainstSchema(value, moduleSchema[key]);
                    if (!fieldValidation.isValid) {
                        result.isValid = false;
                        result.errors.push(...fieldValidation.errors.map(e => `${key}: ${e}`));
                    } else {
                        result.config[key] = fieldValidation.value || value;
                    }
                } else {
                    result.config[key] = value;
                }
            }

            return result;
        }

        /**
         * Deep merge configurations
         * @param {...Object} configs - Configurations to merge
         * @returns {Object} Merged configuration
         */
        static merge(...configs) {
            const result = {};
            for (const config of configs) {
                if (!config || typeof config !== 'object') continue;
                for (const [key, value] of Object.entries(config)) {
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        result[key] = ConfigValidator.merge(result[key] || {}, value);
                    } else {
                        result[key] = value;
                    }
                }
            }
            return result;
        }

        /**
         * Validate against schema
         * @param {Object} config - Configuration to validate
         * @param {Object} schema - Validation schema
         * @returns {Object} Validation result
         */
        static validateSchema(config, schema) {
            const errors = [];
            const warnings = [];

            for (const [key, rules] of Object.entries(schema)) {
                const value = config[key];

                // Required check
                if (rules.required && value == null) {
                    errors.push(`Missing required field: ${key}`);
                    continue;
                }

                if (value == null) continue;

                // Type check
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`Type mismatch for ${key}: expected ${rules.type}, got ${typeof value}`);
                }

                // Range check
                if (rules.min !== undefined && Number(value) < rules.min) {
                    errors.push(`Value too low for ${key}: ${value} < ${rules.min}`);
                }
                if (rules.max !== undefined && Number(value) > rules.max) {
                    errors.push(`Value too high for ${key}: ${value} > ${rules.max}`);
                }

                // Enum check
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`Invalid value for ${key}: ${value} not in ${rules.enum.join(', ')}`);
                }

                // Pattern check
                if (rules.pattern && !new RegExp(rules.pattern).test(String(value))) {
                    errors.push(`Pattern mismatch for ${key}: ${value}`);
                }

                // Custom validator
                if (rules.validate && !rules.validate(value)) {
                    warnings.push(`Custom validation failed for ${key}`);
                }
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                config: this.merge(config, {})
            };
        }

        /**
         * Get validation schema for a module
         * @param {string} moduleName - Module name
         * @returns {Object} Schema
         */
        static getSchema(moduleName) {
            const schemas = {
                hub: {
                    maxMemoryUsage: { type: 'number', min: 256, max: 32768 },
                    maxConcurrentRequests: { type: 'number', min: 1, max: 100 },
                    requestTimeout: { type: 'number', min: 1000, max: 300000 },
                    theme: { type: 'string', enum: ['light', 'dark', 'system'] }
                },
                'autonomous-agent-runner': {
                    maxConcurrentTasks: { type: 'number', min: 1, max: 10 },
                    defaultTimeout: { type: 'number', min: 1000, max: 3600000 },
                    maxRetries: { type: 'number', min: 0, max: 10 }
                },
                default: {}
            };
            return schemas[moduleName] || schemas.default;
        }

        /**
         * Sanitize configuration values
         * @param {Object} config - Configuration
         * @returns {Object} Sanitized configuration
         */
        static sanitize(config) {
            if (!config || typeof config !== 'object') return {};

            const sanitized = {};
            for (const [key, value] of Object.entries(config)) {
                if (typeof value === 'string') {
                    sanitized[key] = value.replace(/[<>]/g, '').trim();
                } else if (Array.isArray(value)) {
                    sanitized[key] = value.map(item => 
                        typeof item === 'string' ? item.replace(/[<>]/g, '').trim() : item
                    );
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }

        /**
         * Compare two configurations
         * @param {Object} config1 - First config
         * @param {Object} config2 - Second config
         * @returns {Object} Differences
         */
        static diff(config1, config2) {
            const diff = {};
            const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

            for (const key of allKeys) {
                const val1 = config1[key];
                const val2 = config2[key];

                if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                    diff[key] = { from: val1, to: val2 };
                }
            }

            return diff;
        }

        /**
         * Validate and return sanitized config
         * @param {Object} config - Raw config
         * @param {string} moduleName - Module name
         * @returns {Object} Validated and sanitized config
         */
        static validateAndSanitize(config, moduleName) {
            const schema = this.getSchema(moduleName);
            const validated = this.validate(config);
            const sanitized = this.sanitize(validated);
            
            if (schema && Object.keys(schema).length > 0) {
                const schemaResult = this.validateSchema(sanitized, schema);
                if (!schemaResult.valid) {
                    console.warn(`[ConfigValidator] Schema validation warnings:`, schemaResult.errors);
                }
                return schemaResult.config;
            }

            return sanitized;
        }
    }

    // Export to global scope
    window.ConfigValidator = ConfigValidator;

    console.log('[ConfigValidator] Initialized v2026.05.04.0');
})();