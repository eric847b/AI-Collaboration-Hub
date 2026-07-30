const { minifyBundle } = require('../bundle-minify.cjs');

describe('bundle minify', () => {
  test('throws when the merged bundle input is missing', () => {
    expect(() => minifyBundle({
      distDir: '/workspace/dist',
      inputFile: '/workspace/dist/source.user.js',
      outputFile: '/workspace/dist/source.min.user.js',
      fs: {
        readFileSync: jest.fn(),
        writeFileSync: jest.fn(),
        renameSync: jest.fn()
      },
      utils: {
        ensureDir: jest.fn(),
        getFileSizeKB: jest.fn(),
        log: jest.fn(),
        minify: jest.fn(),
        success: jest.fn(),
        validateFile: jest.fn(() => {
          throw new Error('File not found: /workspace/dist/source.user.js');
        }),
        backupFile: jest.fn(() => {})
      }
    })).toThrow('File not found: /workspace/dist/source.user.js');
  });

  test('writes the minified bundle and returns size metrics', () => {
    const writes = [];
    const fs = {
      readFileSync: jest.fn(() => 'const x = 1;  // comment'),
      writeFileSync: jest.fn((filePath, content, encoding) => {
        writes.push({ filePath, content, encoding });
      }),
      renameSync: jest.fn()
    };
    const utils = {
      ensureDir: jest.fn(),
      extractHeader: jest.fn(() => ''),
      getFileSizeKB: jest
        .fn()
        .mockReturnValueOnce('10.00')  // finalSize check (outputFile)
        .mockReturnValueOnce('10.00')  // sizeOriginal (inputFile)
        .mockReturnValueOnce('4.00'),  // sizeMinified (outputFile)
      getModuleFilesRecursive: jest.fn(() => []),
      log: jest.fn(),
      minify: jest.fn(() => 'const x=1;'),
      success: jest.fn(),
      validateFile: jest.fn(() => true),
      backupFile: jest.fn(() => {})
    };

    const result = minifyBundle({
      distDir: '/workspace/dist',
      inputFile: '/workspace/dist/source.user.js',
      outputFile: '/workspace/dist/source.min.user.js',
      fs,
      utils
    });

    expect(writes[0]).toEqual({
      filePath: '/workspace/dist/source.min.user.js.tmp',
      content: 'const x=1;',
      encoding: 'utf-8'
    });
    expect(fs.renameSync).toHaveBeenCalledWith('/workspace/dist/source.min.user.js.tmp', '/workspace/dist/source.min.user.js');
    expect(result).toEqual({
      outputFile: '/workspace/dist/source.min.user.js',
      reductionPercent: '60.00',
      sizeMinifiedKB: '4.00',
      sizeOriginalKB: '10.00'
    });
    expect(utils.success).toHaveBeenCalledWith('Minified bundle created: /workspace/dist/source.min.user.js');
    expect(utils.success).toHaveBeenCalledWith('Original size: 10.00 KB');
    expect(utils.success).toHaveBeenCalledWith('Minified size: 4.00 KB');
    expect(utils.success).toHaveBeenCalledWith('Reduction: 60.00%');
  });

  test('reports zero reduction when the original size is zero', () => {
    const writes = [];
    const fs = {
      readFileSync: jest.fn(() => ''),
      writeFileSync: jest.fn((filePath, content, encoding) => {
        writes.push({ filePath, content, encoding });
      }),
      renameSync: jest.fn()
    };
    const utils = {
      ensureDir: jest.fn(),
      extractHeader: jest.fn(() => ''),
      getFileSizeKB: jest
        .fn()
        .mockReturnValueOnce('1.00')  // finalSize check (outputFile) - must be >= 1 to pass
        .mockReturnValueOnce('0.00')  // sizeOriginal (inputFile)
        .mockReturnValueOnce('0.00'), // sizeMinified (outputFile)
      getModuleFilesRecursive: jest.fn(() => []),
      log: jest.fn(),
      minify: jest.fn(() => ''),
      success: jest.fn(),
      validateFile: jest.fn(() => true),
      backupFile: jest.fn(() => {})
    };

    const result = minifyBundle({
      distDir: '/workspace/dist',
      inputFile: '/workspace/dist/source.user.js',
      outputFile: '/workspace/dist/source.min.user.js',
      fs,
      utils
    });

    expect(writes[0]).toEqual({
      filePath: '/workspace/dist/source.min.user.js.tmp',
      content: '',
      encoding: 'utf-8'
    });
    expect(fs.renameSync).toHaveBeenCalledWith('/workspace/dist/source.min.user.js.tmp', '/workspace/dist/source.min.user.js');
    expect(result.reductionPercent).toBe('0.00');
  });
});