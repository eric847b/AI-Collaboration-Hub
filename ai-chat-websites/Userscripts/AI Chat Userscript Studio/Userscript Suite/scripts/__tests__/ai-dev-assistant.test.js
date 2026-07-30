const path = require('path');
const { AIDevAssistant, parseCliArgs } = require('../ai-dev-assistant.cjs');

describe('AI dev assistant', () => {
  test('flags common module issues and optimization suggestions', () => {
    const assistant = new AIDevAssistant({
      logger: { info: jest.fn() }
    });

    assistant.analyzeFile(
      'demo.module.user.js',
      `
        console.log('debug');
        const a = 'hardcoded string alpha 12345';
        const b = "hardcoded string beta 12345";
        const c = 'hardcoded string gamma 12345';
        const d = "hardcoded string delta 12345";
        const e = 'hardcoded string epsilon 12345';
        try { work(); }
        setInterval(tick, 1000);
        document.querySelectorAll('.item').forEach(render);
        element.innerHTML = html;
      `
    );

    expect(assistant.issues.map(issue => issue.type)).toEqual([
      'logging',
      'i18n',
      'error-handling',
      'performance',
      'security'
    ]);
    expect(assistant.suggestions).toEqual([
      expect.objectContaining({
        type: 'optimization',
        file: 'demo.module.user.js'
      })
    ]);
  });

  test('skips the innerHTML security warning when DOMPurify is present', () => {
    const assistant = new AIDevAssistant({
      logger: { info: jest.fn() }
    });

    assistant.analyzeFile(
      'safe.module.user.js',
      `
        const markup = DOMPurify.sanitize(input);
        element.innerHTML = markup;
      `
    );

    expect(assistant.issues).toEqual([]);
  });

  test('skips string-literal innerHTML references when there is no DOM assignment', () => {
    const assistant = new AIDevAssistant({
      logger: { info: jest.fn() }
    });

    assistant.analyzeFile(
      'generator.module.user.js',
      `
        if (/\\.innerHTML\\s*=/.test(normalizedScript)) {
          return false;
        }
      `
    );

    expect(assistant.issues).toEqual([]);
  });

  test('counts unmatched try/catch and interval cleanup more accurately', () => {
    const assistant = new AIDevAssistant({
      logger: { info: jest.fn() }
    });

    assistant.analyzeFile(
      'balanced.module.user.js',
      `
        try {
          doWork();
        } catch (error) {
          handleError(error);
        }
        const intervalId = setInterval(tick, 1000);
        clearInterval(intervalId);
      `
    );

    expect(assistant.issues).toEqual([]);

    assistant.analyzeFile(
      'unbalanced.module.user.js',
      `
        try { doOne(); } catch (error) { report(error); }
        try { doTwo(); }
        const first = setInterval(tickOne, 1000);
        const second = setInterval(tickTwo, 2000);
        clearInterval(first);
      `
    );

    expect(assistant.issues).toEqual([
      expect.objectContaining({ file: 'unbalanced.module.user.js', type: 'error-handling' }),
      expect.objectContaining({ file: 'unbalanced.module.user.js', type: 'performance' })
    ]);
  });

  test('analyzeModules reads module files and reports by basename', () => {
    const logger = { info: jest.fn() };
    const assistant = new AIDevAssistant({
      fs: {
        readFileSync: jest.fn(() => 'console.log("debug");')
      },
      logger,
      modulesDir: '/workspace/Modules',
      path,
      utils: {
        getModuleFiles: jest.fn(() => [
          '/workspace/Modules/alpha.module.user.js',
          '/workspace/Modules/beta.module.user.js'
        ])
      }
    });

    assistant.analyzeModules();

    expect(assistant.issues).toEqual([
      expect.objectContaining({ file: 'alpha.module.user.js', type: 'logging' }),
      expect.objectContaining({ file: 'beta.module.user.js', type: 'logging' })
    ]);
    expect(logger.info).toHaveBeenCalledWith('\n[Summary] Files analyzed: 2');
    expect(logger.info).toHaveBeenCalledWith('[Summary] Issue types: logging: 2');
  });

  test('run emits the startup banner and feature suggestions', () => {
    const logger = { info: jest.fn() };
    const assistant = new AIDevAssistant({
      logger
    });

    jest.spyOn(assistant, 'analyzeModules').mockImplementation(() => {});
    jest.spyOn(assistant, 'suggestNewFeatures').mockImplementation(() => {});

    assistant.run();

    expect(logger.info).toHaveBeenCalledWith('Starting AI Development Assistant...');
    expect(assistant.analyzeModules).toHaveBeenCalledTimes(1);
    expect(assistant.suggestNewFeatures).toHaveBeenCalledTimes(1);
  });

  test('generateReport summarizes types, trims output, and returns a normalized health score', () => {
    const logger = { info: jest.fn() };
    const assistant = new AIDevAssistant({
      logger,
      maxDisplayIssues: 1,
      maxDisplaySuggestions: 1
    });

    assistant.analyzedFiles = ['alpha.module.user.js', 'beta.module.user.js'];
    assistant.issues = [
      {
        file: 'beta.module.user.js',
        type: 'logging',
        message: 'Logging issue',
        suggestion: 'Use logger'
      },
      {
        file: 'alpha.module.user.js',
        type: 'security',
        message: 'Security issue',
        suggestion: 'Sanitize HTML'
      }
    ];
    assistant.suggestions = [
      {
        file: 'beta.module.user.js',
        type: 'optimization',
        message: 'Optimization idea',
        suggestion: 'Use faster DOM lookup'
      },
      {
        file: 'alpha.module.user.js',
        type: 'optimization',
        message: 'Another optimization idea',
        suggestion: 'Cache the selector'
      }
    ];

    const report = assistant.generateReport();

    expect(report).toEqual(
      expect.objectContaining({
        analyzedFileCount: 2,
        issueCount: 2,
        suggestionCount: 2,
        healthScore: expect.any(Number),
        issueTypes: [
          { type: 'security', count: 1 },
          { type: 'logging', count: 1 }
        ],
        suggestionTypes: [{ type: 'optimization', count: 2 }]
      })
    );
    expect(report.healthScore).toBeGreaterThan(0);
    expect(report.healthScore).toBeLessThan(100);
    expect(logger.info).toHaveBeenCalledWith(
      '[Summary] Most affected files: alpha.module.user.js (1), beta.module.user.js (1)'
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[Issues] 1 additional finding(s) omitted for readability.'
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[Suggestions] 1 additional finding(s) omitted for readability.'
    );
  });

  test('parseCliArgs supports --all and explicit display limits', () => {
    expect(parseCliArgs(['--all'])).toEqual({
      maxDisplayIssues: Number.POSITIVE_INFINITY,
      maxDisplaySuggestions: Number.POSITIVE_INFINITY
    });
    expect(parseCliArgs(['--issues=5', '--suggestions', '3'])).toEqual({
      maxDisplayIssues: 5,
      maxDisplaySuggestions: 3
    });
    expect(() => parseCliArgs(['--issues', '0'])).toThrow('--issues must be a positive integer.');
    expect(() => parseCliArgs(['--unknown'])).toThrow('Unknown argument: --unknown');
  });
});
