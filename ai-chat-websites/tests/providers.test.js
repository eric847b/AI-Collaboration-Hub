/**
 * Providers Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach } = require('@jest/globals');

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = {
  NETWORK_TIMEOUT: 60000,
  AI_PROVIDERS: {
    OPENAI: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
    ANTHROPIC: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20241022' },
    GEMINI: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', model: 'gemini-pro' },
    OLLAMA: { endpoint: 'http://localhost:11434/api/generate', model: 'llama2' }
  }
};
global.window.UnifiedSuite.state = { apiKey: '', config: { enableStreaming: false } };
global.window.UnifiedSuite.updateState = () => {};
global.window.UnifiedSuite.debugLog = () => {};
global.window.UnifiedSuite.sanitizeText = (text) => String(text ?? '').replace(/\u0000/g, '').trim();

describe('Providers Module', () => {
  let ProvidersModule;

  beforeAll(() => {
    ProvidersModule = require('../Userscripts/modules/providers.js').ProvidersModule;
  });

  beforeEach(() => {
    global.window.UnifiedSuite.state.apiKey = '';
    global.window.UnifiedSuite.state.config.enableStreaming = false;
    global.window.UnifiedSuite.state.streamController = null;
  });

  describe('generateWithLocalAI', () => {
    it('should generate a fallback userscript', async () => {
      const result = await ProvidersModule.generateWithLocalAI('make a button');
      expect(result.provider).toBe('LOCAL');
      expect(result.timestamp).toBeDefined();
      expect(result.content).toContain('==UserScript==');
      expect(result.content).toContain('@name');
    });

    it('should include prompt in TODO comment', async () => {
      const result = await ProvidersModule.generateWithLocalAI('test');
      expect(result.content).toContain('TODO: Implement based on: test');
    });
  });

  describe('generateWithProvider - unknown provider', () => {
    it('should throw for unknown provider', async () => {
      await expect(ProvidersModule.generateWithProvider('UNKNOWN', 'prompt'))
        .rejects.toThrow('Unknown AI provider');
    });
  });

  describe('provider methods - missing API key', () => {
    it('should throw for OpenAI without API key', async () => {
      await expect(ProvidersModule.generateWithOpenAI('prompt'))
        .rejects.toThrow('OpenAI API key not configured');
    });

    it('should throw for Anthropic without API key', async () => {
      await expect(ProvidersModule.generateWithAnthropic('prompt'))
        .rejects.toThrow('Anthropic API key not configured');
    });

    it('should throw for Gemini without API key', async () => {
      await expect(ProvidersModule.generateWithGemini('prompt'))
        .rejects.toThrow('Gemini API key not configured');
    });

    it('should throw for Ollama without API key', async () => {
      await expect(ProvidersModule.generateWithOllama('prompt'))
        .rejects.toThrow('Ollama API key not configured');
    });
  });

  describe('generateWithProvider - with API key', () => {
    beforeEach(() => {
      global.window.UnifiedSuite.state.apiKey = 'test-api-key';
    });

    it('should route to correct provider method', async () => {
      const mockJson = { choices: [{ message: { content: 'generated' } }] };
      global.GM_xmlhttpRequest = jest.fn((opts) => {
        opts.onload({ status: 200, responseText: JSON.stringify(mockJson), response: mockJson });
      });

      const result = await ProvidersModule.generateWithOpenAI('make a script');
      expect(result.provider).toBe('OPENAI');
      expect(result.content).toBe('generated');
    });
  });
});