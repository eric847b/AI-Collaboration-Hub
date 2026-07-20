// src/lib/microkernel.ts
// Shared Microkernel Modules (Task 11)

import registry from './commandRegistry';

import logger from './universalLogger'; // Assuming it exists

// Core utilities as microkernel modules
export const microkernel = {
  utils: {
    debounce: (fn: Function, delay: number) => {
      let timeout: NodeJS.Timeout;
      return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    },

    throttle: (fn: Function, limit: number) => {
      let inThrottle = false;
      return (...args: any[]) => {
        if (!inThrottle) {
          fn(...args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    deepClone: (obj: any): any => JSON.parse(JSON.stringify(obj)),
  },

  registerCoreCommands() {
    registry.register({
      name: 'log',
      description: 'Universal logging command',
      execute: async (args) => logger.info(args.message, args.context),
      metadata: { category: 'core' }
    });

    registry.register({
      name: 'selfAnalyze',
      description: 'Trigger recursive self-analysis',
      execute: async () => {
        logger.info('Self-analysis initiated');
        // TODO: connect to Task 37 pipeline
        return { status: 'analyzing', timestamp: Date.now() };
      },
      metadata: { category: 'autonomous' }
    });
  }
};

// Auto-register on import
microkernel.registerCoreCommands();

export default microkernel;
