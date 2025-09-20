'use client';

/**
 * Comprehensive logging utility for MusicBuddy integrations
 * Provides structured logging with different levels and integration-specific contexts
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
}

class Logger {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    enableConsole: true,
    enableStorage: true,
    maxStorageEntries: 1000,
  };

  private storage: LogEntry[] = [];

  constructor(config?: Partial<LoggerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createEntry(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    error?: Error,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: Date.now(),
      level,
      component,
      message,
      data,
      error,
      metadata,
    };
  }

  private formatForConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] ${levelName} [${entry.component}]`;

    const consoleMethod = this.getConsoleMethod(entry.level);

    if (entry.error) {
      consoleMethod(`${prefix} ${entry.message}`, entry.error);
      if (entry.data) {
        console.log('Data:', entry.data);
      }
    } else if (entry.data) {
      consoleMethod(`${prefix} ${entry.message}`, entry.data);
    } else {
      consoleMethod(`${prefix} ${entry.message}`);
    }

    if (entry.metadata) {
      console.log('Metadata:', entry.metadata);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  private storeEntry(entry: LogEntry): void {
    if (!this.config.enableStorage) return;

    this.storage.push(entry);

    // Maintain max storage size
    if (this.storage.length > this.config.maxStorageEntries) {
      this.storage.shift();
    }
  }

  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    error?: Error,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, component, message, data, error, metadata);
    
    this.formatForConsole(entry);
    this.storeEntry(entry);
  }

  debug(component: string, message: string, data?: any, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, component, message, data, undefined, metadata);
  }

  info(component: string, message: string, data?: any, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, component, message, data, undefined, metadata);
  }

  warn(component: string, message: string, data?: any, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, component, message, data, undefined, metadata);
  }

  error(component: string, message: string, error?: Error, data?: any, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, component, message, data, error, metadata);
  }

  // Integration-specific logging methods
  vibeCheck(message: string, data?: any, metadata?: Record<string, any>): void {
    this.info('VibeCheck', message, data, metadata);
  }

  anthropic(message: string, data?: any, metadata?: Record<string, any>): void {
    this.info('Anthropic', message, data, metadata);
  }

  anthropicError(message: string, error: Error, metadata?: Record<string, any>): void {
    this.error('Anthropic', message, error, undefined, metadata);
  }

  elevenlabs(message: string, data?: any, metadata?: Record<string, any>): void {
    this.info('ElevenLabs', message, data, metadata);
  }

  elevenlabsError(message: string, error: Error, metadata?: Record<string, any>): void {
    this.error('ElevenLabs', message, error, undefined, metadata);
  }

  spotify(message: string, data?: any, metadata?: Record<string, any>): void {
    this.info('Spotify', message, data, metadata);
  }

  spotifyError(message: string, error: Error, metadata?: Record<string, any>): void {
    this.error('Spotify', message, error, undefined, metadata);
  }

  localPlayer(message: string, data?: any, metadata?: Record<string, any>): void {
    this.info('LocalPlayer', message, data, metadata);
  }

  localPlayerError(message: string, error: Error, metadata?: Record<string, any>): void {
    this.error('LocalPlayer', message, error, undefined, metadata);
  }

  adaptivePlayer(message: string, data?: any, metadata?: Record<string, any>): void {
    this.info('AdaptivePlayer', message, data, metadata);
  }

  adaptivePlayerError(message: string, error: Error, metadata?: Record<string, any>): void {
    this.error('AdaptivePlayer', message, error, undefined, metadata);
  }

  mcp(message: string, data?: any, metadata?: Record<string, any>): void {
    this.info('MCP', message, data, metadata);
  }

  mcpError(message: string, error: Error, metadata?: Record<string, any>): void {
    this.error('MCP', message, error, undefined, metadata);
  }

  // Utility methods
  getLogs(component?: string, level?: LogLevel): LogEntry[] {
    return this.storage.filter(entry => {
      const componentMatch = !component || entry.component === component;
      const levelMatch = level === undefined || entry.level >= level;
      return componentMatch && levelMatch;
    });
  }

  clearLogs(): void {
    this.storage = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.storage, null, 2);
  }

  getStats(): {
    totalEntries: number;
    byLevel: Record<string, number>;
    byComponent: Record<string, number>;
    oldestEntry?: number;
    newestEntry?: number;
  } {
    const byLevel: Record<string, number> = {};
    const byComponent: Record<string, number> = {};

    this.storage.forEach(entry => {
      const levelName = LogLevel[entry.level];
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;
      byComponent[entry.component] = (byComponent[entry.component] || 0) + 1;
    });

    return {
      totalEntries: this.storage.length,
      byLevel,
      byComponent,
      oldestEntry: this.storage[0]?.timestamp,
      newestEntry: this.storage[this.storage.length - 1]?.timestamp,
    };
  }
}

// Singleton logger instance
let loggerInstance: Logger | null = null;

export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(config);
  }
  return loggerInstance;
}

// Convenience exports
export const logger = getLogger();

// Performance monitoring utilities
export class PerformanceMonitor {
  private startTimes = new Map<string, number>();

  start(operation: string): void {
    this.startTimes.set(operation, performance.now());
    logger.debug('Performance', `Started: ${operation}`);
  }

  end(operation: string, metadata?: Record<string, any>): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      logger.warn('Performance', `No start time found for operation: ${operation}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    logger.info('Performance', `Completed: ${operation}`, { duration }, {
      ...metadata,
      durationMs: duration,
    });

    return duration;
  }

  measure<T>(operation: string, fn: () => T | Promise<T>, metadata?: Record<string, any>): T | Promise<T> {
    this.start(operation);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          this.end(operation, metadata);
        });
      } else {
        this.end(operation, metadata);
        return result;
      }
    } catch (error) {
      this.end(operation, { ...metadata, error: true });
      throw error;
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Error boundary utilities
export class ErrorHandler {
  static async withErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>,
    fallback?: () => T,
    metadata?: Record<string, any>
  ): Promise<T> {
    try {
      return await performanceMonitor.measure(operation, fn, metadata);
    } catch (error) {
      logger.error(
        'ErrorHandler',
        `Operation failed: ${operation}`,
        error instanceof Error ? error : new Error(String(error)),
        undefined,
        metadata
      );

      if (fallback) {
        logger.info('ErrorHandler', `Using fallback for: ${operation}`, undefined, metadata);
        return fallback();
      }

      throw error;
    }
  }

  static withErrorHandlingSync<T>(
    operation: string,
    fn: () => T,
    fallback?: () => T,
    metadata?: Record<string, any>
  ): T {
    try {
      logger.debug('ErrorHandler', `Starting: ${operation}`, undefined, metadata);
      const result = fn();
      logger.debug('ErrorHandler', `Completed: ${operation}`, undefined, metadata);
      return result;
    } catch (error) {
      logger.error(
        'ErrorHandler',
        `Operation failed: ${operation}`,
        error instanceof Error ? error : new Error(String(error)),
        undefined,
        metadata
      );

      if (fallback) {
        logger.info('ErrorHandler', `Using fallback for: ${operation}`, undefined, metadata);
        return fallback();
      }

      throw error;
    }
  }
}

export default Logger;
