/**
 * Authentication Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = {
  NETWORK_TIMEOUT: 60000,
  STORAGE_KEYS: { sessionApiKey: 'test_session_api_key' },
  AI_PROVIDERS: {
    OPENAI: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
    ANTHROPIC: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20241022' },
    GEMINI: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', model: 'gemini-pro' },
    OLLAMA: { endpoint: 'http://localhost:11434/api/generate', model: 'llama2' }
  }
};
global.window.UnifiedSuite.state = { apiKey: '' };
global.window.UnifiedSuite.updateState = (key, val) => { global.window.UnifiedSuite.state[key] = val; };
global.window.UnifiedSuite.debugLog = () => {};
global.window.UnifiedSuite.sanitizeText = (text) => String(text ?? '').trim();

global.sessionStorage = global.sessionStorage || {
  store: {},
  getItem: (k) => global.sessionStorage.store[k] || null,
  setItem: (k, v) => { global.sessionStorage.store[k] = v; },
  removeItem: (k) => { delete global.sessionStorage.store[k]; }
};

describe('Auth Module', () => {
  let AuthModule;

  beforeAll(() => {
    AuthModule = require('../Userscripts/modules/auth.js').AuthModule;
  });

  beforeEach(() => {
    global.window.UnifiedSuite.state.apiKey = '';
    global.sessionStorage.store = {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('maskApiKey', () => {
    it('should mask short keys completely', () => {
      expect(AuthModule.maskApiKey('')).toBe('****');
      expect(AuthModule.maskApiKey('abc')).toBe('****');
      expect(AuthModule.maskApiKey(null)).toBe('****');
    });

    it('should show last 4 chars with bullet prefix', () => {
      expect(AuthModule.maskApiKey('sk-abcdefghijklmnop')).toBe('••••mnop');
      expect(AuthModule.maskApiKey('1234567890')).toBe('••••7890');
    });
  });

  describe('getKeyFingerprint', () => {
    it('should return N/A for short keys', () => {
      expect(AuthModule.getKeyFingerprint('')).toBe('N/A');
      expect(AuthModule.getKeyFingerprint('abc')).toBe('N/A');
      expect(AuthModule.getKeyFingerprint(null)).toBe('N/A');
    });

    it('should return last 4 characters', () => {
      expect(AuthModule.getKeyFingerprint('sk-abcdefghijklmnop')).toBe('mnop');
      expect(AuthModule.getKeyFingerprint('1234567890')).toBe('7890');
    });
  });

  describe('validateApiKeyFormat', () => {
    it('should reject empty keys', () => {
      expect(AuthModule.validateApiKeyFormat('', 'OPENAI')).toBe(false);
      expect(AuthModule.validateApiKeyFormat(null, 'OPENAI')).toBe(false);
    });

    it('should validate OpenAI keys', () => {
      expect(AuthModule.validateApiKeyFormat('sk-abcdefghijklmnopqrstu', 'OPENAI')).toBe(true);
      expect(AuthModule.validateApiKeyFormat('invalid', 'OPENAI')).toBe(false);
      expect(AuthModule.validateApiKeyFormat('sk-short', 'OPENAI')).toBe(false);
    });

    it('should validate Anthropic keys', () => {
      expect(AuthModule.validateApiKeyFormat('sk-ant-abcdefghijklmnop', 'ANTHROPIC')).toBe(true);
      expect(AuthModule.validateApiKeyFormat('sk-abcdefghijklmnop', 'ANTHROPIC')).toBe(true);
      expect(AuthModule.validateApiKeyFormat('short', 'ANTHROPIC')).toBe(false);
    });

    it('should validate Gemini keys', () => {
      expect(AuthModule.validateApiKeyFormat('abcdefghijklmnopqrstuv', 'GEMINI')).toBe(true);
      expect(AuthModule.validateApiKeyFormat('short', 'GEMINI')).toBe(false);
    });

    it('should validate default provider keys by length', () => {
      expect(AuthModule.validateApiKeyFormat('12345678', 'UNKNOWN')).toBe(true);
      expect(AuthModule.validateApiKeyFormat('1234567', 'UNKNOWN')).toBe(false);
    });
  });

  describe('clearSession', () => {
    it('should clear apiKey from state', () => {
      global.window.UnifiedSuite.state.apiKey = 'test-key';
      AuthModule.clearSession();
      expect(global.window.UnifiedSuite.state.apiKey).toBe('');
    });

    it('should remove sessionStorage key', () => {
      global.sessionStorage.setItem('test_session_api_key', 'value');
      AuthModule.clearSession();
      expect(global.sessionStorage.getItem('test_session_api_key')).toBeNull();
    });

    it('should not throw if sessionStorage access fails', () => {
      global.sessionStorage.setItem = () => { throw new Error('storage error'); };
      expect(() => AuthModule.clearSession()).not.toThrow();
    });
  });

  describe('init', () => {
    it('should return a module interface with expected methods', () => {
      const iface = AuthModule.init();
      expect(typeof iface.isSessionValid).toBe('function');
      expect(typeof iface.authenticateUser).toBe('function');
      expect(typeof iface.refreshSessionToken).toBe('function');
      expect(typeof iface.clearSession).toBe('function');
      expect(iface.isSessionValid()).toBe(true);
    });
  });
});