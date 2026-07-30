/**
 * State Management Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach } = require('@jest/globals');

describe('State Module', () => {
  let stateModule;

  beforeAll(() => {
    stateModule = require('../Userscripts/modules/state.js');
  });

  beforeEach(() => {
    stateModule.resetState();
  });

  describe('State Initialization', () => {
    it('should have default state values', () => {
      const state = stateModule.getState();
      expect(state).toBeDefined();
      expect(state.modules).toEqual({});
      expect(state.config.enabled).toBe(true);
      expect(state.config.theme).toBe('dark');
      expect(state.generatedScripts).toEqual([]);
      expect(state.validationResults).toEqual([]);
      expect(state.isInitialized).toBe(false);
    });

    it('should have default config with all required fields', () => {
      const state = stateModule.getState();
      expect(state.config).toHaveProperty('enabled', true);
      expect(state.config).toHaveProperty('autoGenerate', false);
      expect(state.config).toHaveProperty('showDashboard', true);
      expect(state.config).toHaveProperty('showGenerator', true);
      expect(state.config).toHaveProperty('showSecurity', true);
      expect(state.config).toHaveProperty('enableStreaming', false);
      expect(state.config).toHaveProperty('theme', 'dark');
    });
  });

  describe('updateState', () => {
    it('should update existing state properties', () => {
      stateModule.updateState('isInitialized', true);
      expect(stateModule.getState().isInitialized).toBe(true);
    });

    it('should update nested config properties', () => {
      const newConfig = { ...stateModule.getState().config, theme: 'light' };
      stateModule.updateState('config', newConfig);
      expect(stateModule.getState().config.theme).toBe('light');
    });

    it('should ignore non-existent state keys', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      stateModule.updateState('nonExistentKey', 'value');
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(stateModule.getState()).not.toHaveProperty('nonExistentKey');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('resetState', () => {
    it('should reset all state to defaults', () => {
      stateModule.updateState('isInitialized', true);
      stateModule.updateState('retryCount', 5);
      stateModule.updateState('apiKey', 'test-key');
      stateModule.resetState();

      const state = stateModule.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.retryCount).toBe(0);
      expect(state.apiKey).toBe('');
      expect(state.config.enabled).toBe(true);
      expect(state.config.theme).toBe('dark');
    });

    it('should clear generated scripts on reset', () => {
      stateModule.getState().generatedScripts.push({ id: 1, content: 'test' });
      stateModule.resetState();
      expect(stateModule.getState().generatedScripts).toEqual([]);
    });
  });

  describe('Module Health Tracking', () => {
    it('should initialize with empty module health', () => {
      expect(stateModule.getState().moduleHealth).toEqual({});
    });

    it('should allow module health updates', () => {
      const health = { status: 'healthy', lastCheck: Date.now() };
      stateModule.getState().moduleHealth['config'] = health;
      expect(stateModule.getState().moduleHealth.config).toEqual(health);
    });
  });
});