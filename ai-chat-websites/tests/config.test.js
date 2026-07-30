/**
 * Configuration Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll } = require('@jest/globals');

describe('CONFIG Module', () => {
  let CONFIG;

  beforeAll(() => {
    const module = require('../Userscripts/modules/config.js');
    CONFIG = module.CONFIG;
  });

  describe('Core Configuration', () => {
    it('should have a valid version string', () => {
      expect(CONFIG.VERSION).toBeDefined();
      expect(typeof CONFIG.VERSION).toBe('string');
      expect(CONFIG.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have DEBUG_MODE as boolean', () => {
      expect(typeof CONFIG.DEBUG_MODE).toBe('boolean');
    });

    it('should have positive number limits', () => {
      expect(CONFIG.MAX_SCRIPT_LENGTH).toBeGreaterThan(0);
      expect(CONFIG.MAX_HISTORY_ITEMS).toBeGreaterThan(0);
      expect(CONFIG.NETWORK_TIMEOUT).toBeGreaterThan(0);
      expect(CONFIG.MAX_VERSIONS_PER_SCRIPT).toBeGreaterThan(0);
      expect(CONFIG.MAX_TEMPLATES).toBeGreaterThan(0);
    });
  });

  describe('Retry Configuration', () => {
    it('should have retry config with all required fields', () => {
      expect(CONFIG.RETRY).toBeDefined();
      expect(CONFIG.RETRY.maxRetries).toBeGreaterThan(0);
      expect(CONFIG.RETRY.baseDelay).toBeGreaterThan(0);
      expect(CONFIG.RETRY.maxTotalTime).toBeGreaterThan(0);
      expect(CONFIG.RETRY.backoffFactor).toBeGreaterThan(1);
    });

    it('should have reasonable retry limits', () => {
      expect(CONFIG.RETRY.maxRetries).toBeLessThanOrEqual(10);
      expect(CONFIG.RETRY.baseDelay).toBeLessThanOrEqual(10000);
      expect(CONFIG.RETRY.maxTotalTime).toBeLessThanOrEqual(300000);
    });
  });

  describe('Storage Keys', () => {
    it('should have all required storage keys', () => {
      expect(CONFIG.STORAGE_KEYS).toBeDefined();
      expect(CONFIG.STORAGE_KEYS.history).toBeDefined();
      expect(CONFIG.STORAGE_KEYS.settings).toBeDefined();
      expect(CONFIG.STORAGE_KEYS.sessionApiKey).toBeDefined();
      expect(CONFIG.STORAGE_KEYS.versions).toBeDefined();
      expect(CONFIG.STORAGE_KEYS.templates).toBeDefined();
      expect(CONFIG.STORAGE_KEYS.moduleHealth).toBeDefined();
    });

    it('should have unique storage keys', () => {
      const keys = Object.values(CONFIG.STORAGE_KEYS);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('AI Providers', () => {
    it('should have all required AI providers', () => {
      expect(CONFIG.AI_PROVIDERS).toBeDefined();
      expect(CONFIG.AI_PROVIDERS.OPENAI).toBeDefined();
      expect(CONFIG.AI_PROVIDERS.ANTHROPIC).toBeDefined();
      expect(CONFIG.AI_PROVIDERS.GEMINI).toBeDefined();
      expect(CONFIG.AI_PROVIDERS.OLLAMA).toBeDefined();
    });

    it('should have valid endpoints for all providers', () => {
      Object.values(CONFIG.AI_PROVIDERS).forEach(provider => {
        expect(provider.endpoint).toBeDefined();
        expect(typeof provider.endpoint).toBe('string');
        expect(provider.endpoint).toMatch(/^https?:\/\//);
      });
    });

    it('should have model names for all providers', () => {
      Object.values(CONFIG.AI_PROVIDERS).forEach(provider => {
        expect(provider.model).toBeDefined();
        expect(typeof provider.model).toBe('string');
        expect(provider.model.length).toBeGreaterThan(0);
      });
    });
  });

  describe('UI Configuration', () => {
    it('should have UI identification strings', () => {
      expect(CONFIG.UI_ID).toBeDefined();
      expect(typeof CONFIG.UI_ID).toBe('string');
      expect(CONFIG.UI_ID.length).toBeGreaterThan(0);

      expect(CONFIG.STYLE_ID).toBeDefined();
      expect(typeof CONFIG.STYLE_ID).toBe('string');
      expect(CONFIG.STYLE_ID.length).toBeGreaterThan(0);
    });
  });

  describe('Excluded Domains', () => {
    it('should have a list of excluded domains', () => {
      expect(CONFIG.EXCLUDED_DOMAINS).toBeDefined();
      expect(Array.isArray(CONFIG.EXCLUDED_DOMAINS)).toBe(true);
      expect(CONFIG.EXCLUDED_DOMAINS.length).toBeGreaterThan(0);
    });

    it('should exclude security-sensitive domains', () => {
      const domains = CONFIG.EXCLUDED_DOMAINS;
      expect(domains).toEqual(expect.arrayContaining([
        'google.com', 'amazon.com', 'paypal.com'
      ]));
    });
  });
});