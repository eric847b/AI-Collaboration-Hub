export class UniversalLogger {
  private static instance: UniversalLogger;
  private logs: any[] = [];
  private context: any = {};
  private debugLevel: number = 2; // 0=error, 1=warn, 2=info, 3=debug

  private constructor() {}

  public static getInstance(): UniversalLogger {
    if (!UniversalLogger.instance) {
      UniversalLogger.instance = new UniversalLogger();
    }
    return UniversalLogger.instance;
  }

  setDebugLevel(level: number) {
    this.debugLevel = Math.max(0, Math.min(3, level));
    this.info('Logger debug level updated', { level });
  }

  private shouldLog(level: string): boolean {
    const levels = { error: 0, warn: 1, info: 2, debug: 3, success: 2 };
    return (levels[level as keyof typeof levels] || 2) <= this.debugLevel;
  }

  log(level: string, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context: { ...this.context }
    };
    this.logs.push(entry);
    
    const consoleMethod = level === 'success' ? 'info' : level;
    console[consoleMethod as keyof Console](`[${level.toUpperCase()}] ${message}`, data || '');
    
    try {
      localStorage.setItem('universalLogs', JSON.stringify(this.logs.slice(-200)));
    } catch (e) {}
  }

  info(msg: string, data?: any) { this.log('info', msg, data); }
  debug(msg: string, data?: any) { this.log('debug', msg, data); }
  warn(msg: string, data?: any) { this.log('warn', msg, data); }
  error(msg: string, data?: any) { this.log('error', msg, data); }
  success(msg: string, data?: any) { this.log('success', msg, data); }

  setContext(key: string, value: any) {
    this.context[key] = value;
  }

  time(label: string) {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.info(`⏱ ${label}`, { duration: `${duration.toFixed(2)}ms` });
    };
  }

  getRecentLogs(count = 50) {
    return this.logs.slice(-count);
  }
}

export const logger = UniversalLogger.getInstance();