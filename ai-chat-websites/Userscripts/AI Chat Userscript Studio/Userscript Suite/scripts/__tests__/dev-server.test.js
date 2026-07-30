const path = require('path');
const { createDevServer } = require('../dev-server.cjs');

describe('dev server', () => {
  test('spawns the merged bundle builder using the cjs entrypoint', () => {
    const listeners = {};
    const spawnCalls = [];
    const server = createDevServer({
      process: {
        execPath: '/mock/node',
        platform: 'win32'
      },
      path,
      scriptDir: '/workspace/scripts',
      spawn(command, args, options) {
        spawnCalls.push({ command, args, options });
        return {
          on(eventName, handler) {
            listeners[eventName] = handler;
          }
        };
      },
      utils: {
        log: jest.fn(),
        success: jest.fn(),
        error: jest.fn()
      }
    });

    server.runBuild('initial build');

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0]).toEqual({
      command: '/mock/node',
      args: [path.join('/workspace/scripts', 'bundle-merge.cjs')],
      options: {
        cwd: path.join('/workspace/scripts', '..'),
        stdio: 'inherit'
      }
    });

    listeners.exit(0);
  });

  test('queues a second build request until the active build finishes', () => {
    const listeners = {};
    const spawnCalls = [];
    const log = jest.fn();
    const success = jest.fn();
    const server = createDevServer({
      process: {
        execPath: '/mock/node',
        platform: 'win32'
      },
      path,
      scriptDir: '/workspace/scripts',
      spawn(command, args, options) {
        spawnCalls.push({ command, args, options });
        return {
          on(eventName, handler) {
            listeners[`call-${spawnCalls.length}-${eventName}`] = handler;
          }
        };
      },
      utils: {
        log,
        success,
        error: jest.fn()
      }
    });

    server.runBuild('initial build');
    server.runBuild('settings-ui.js');

    expect(spawnCalls).toHaveLength(1);

    listeners['call-1-exit'](0);

    expect(spawnCalls).toHaveLength(2);
    expect(log).toHaveBeenCalledWith('Starting merged bundle build (settings-ui.js (queued))...');

    listeners['call-2-exit'](0);
    expect(success).toHaveBeenCalledTimes(2);
  });
});
