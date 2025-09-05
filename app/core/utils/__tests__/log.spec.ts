import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createLogger, log } from '@core/utils/log.js';
import { getStatusEmoji, logPerformanceDetails, networkLog } from '@core/utils/networkLog.js';
import type { Logger } from '@typedefs/public/Logger.js';

// Mock console methods to capture output
const mockConsole = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
};

describe('YinzerFlow Logging System', () => {
  beforeEach(() => {
    // Reset all mocks
    mockConsole.info.mockClear();
    mockConsole.warn.mockClear();
    mockConsole.error.mockClear();

    // Mock console methods
    global.console = {
      ...global.console,
      info: mockConsole.info,
      warn: mockConsole.warn,
      error: mockConsole.error,
    };
  });

  afterEach(() => {
    // Restore original console
    global.console = console;
  });

  describe('Default Logger Instance', () => {
    describe('Basic Functionality', () => {
      it('should have all required logging methods', () => {
        expect(typeof log.info).toBe('function');
        expect(typeof log.warn).toBe('function');
        expect(typeof log.error).toBe('function');
        expect(typeof log.levels).toBe('object');
      });

      it('should log info messages', () => {
        log.info('Test message');
        expect(mockConsole.info).toHaveBeenCalledTimes(1);
      });

      it('should log warning messages', () => {
        log.warn('Warning message');
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      });

      it('should log error messages', () => {
        log.error('Error message');
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('should include timestamp and prefix in log output', () => {
        log.info('Test message');
        const [call] = mockConsole.info.mock.calls;
        expect(call).toBeDefined();
        if (call) {
          const logMessage = call as Array<string>;
          expect(logMessage[0]).toContain('[YINZER]');
          expect(logMessage[0]).toContain('[INFO]');
          expect(logMessage[0]).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
        }
      });

      it('should include YinzerFlow personality phrases', () => {
        log.info('Test message');
        const [call] = mockConsole.info.mock.calls;
        expect(call).toBeDefined();
        if (call) {
          const logMessage = call as Array<string>;
          expect(logMessage[logMessage.length - 1]).toMatch(/n'at!|yinz are good!|that's the way!|right on!|lookin' good!|way to go!|keep it up!/);
        }
      });
    });

    describe('Data Handling', () => {
      it('should handle objects as data parameter', () => {
        const testData = { key: 'value', number: 42 };
        log.info('Test with data', testData);
        expect(mockConsole.info).toHaveBeenCalledTimes(1);
      });

      it('should handle arrays as data parameter', () => {
        log.info('Test with array', [1, 2, 3]);
        expect(mockConsole.info).toHaveBeenCalledTimes(1);
      });

      it('should handle primitives as data parameter', () => {
        log.info('Test with number', 42);
        log.info('Test with boolean', true);
        log.info('Test with null', null);
        expect(mockConsole.info).toHaveBeenCalledTimes(3);
      });

      it('should handle multiple arguments', () => {
        log.info('Message', 'arg1', { data: 'value' }, 42);
        expect(mockConsole.info).toHaveBeenCalledTimes(1);
      });
    });

    describe('Edge Cases', () => {
      it('should handle null and undefined gracefully', () => {
        expect(() => log.info('Test', null)).not.toThrow();
        expect(() => log.info('Test', undefined)).not.toThrow();
      });

      it('should handle circular references in objects', () => {
        const circular: any = { name: 'test' };
        circular.self = circular;
        expect(() => log.info('Test', circular)).not.toThrow();
      });

      it('should handle very long messages', () => {
        const longMessage = 'A'.repeat(1000);
        expect(() => log.info(longMessage)).not.toThrow();
      });

      it('should handle empty strings', () => {
        expect(() => log.info('')).not.toThrow();
        expect(() => log.warn('')).not.toThrow();
        expect(() => log.error('')).not.toThrow();
      });

      it('should handle special characters and emojis', () => {
        expect(() => log.info('Test with émojis 🎉 and spéciál chars')).not.toThrow();
      });
    });
  });

  describe('createLogger Factory', () => {
    describe('Custom Configuration', () => {
      it('should create logger with custom prefix', () => {
        const customLogger = createLogger({ prefix: 'CUSTOM' });
        customLogger.info('Test message');

        const [call] = mockConsole.info.mock.calls;
        expect(call).toBeDefined();
        if (call) {
          const logMessage = call as Array<string>;
          expect(logMessage[0]).toContain('[CUSTOM]');
        }
      });

      it('should create logger with custom log level', () => {
        const customLogger = createLogger({ logLevel: 'error' });
        customLogger.info('This should not log');
        customLogger.warn('This should not log');
        customLogger.error('This should log');

        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).not.toHaveBeenCalled();
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('should create logger with custom logger implementation', () => {
        const customLoggerImpl: Logger = {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
        };

        const customLogger = createLogger({ logger: customLoggerImpl });
        customLogger.info('Test message');
        customLogger.warn('Warning message');
        customLogger.error('Error message');

        expect(customLoggerImpl.info).toHaveBeenCalledTimes(1);
        expect(customLoggerImpl.warn).toHaveBeenCalledTimes(1);
        expect(customLoggerImpl.error).toHaveBeenCalledTimes(1);
        expect(mockConsole.info).not.toHaveBeenCalled();
      });
    });

    describe('Log Level Filtering', () => {
      it('should respect off level (no logging)', () => {
        const logger = createLogger({ logLevel: 'off' });
        logger.info('Should not log');
        logger.warn('Should not log');
        logger.error('Should not log');

        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).not.toHaveBeenCalled();
        expect(mockConsole.error).not.toHaveBeenCalled();
      });

      it('should respect error level (only errors)', () => {
        const logger = createLogger({ logLevel: 'error' });
        logger.info('Should not log');
        logger.warn('Should not log');
        logger.error('Should log');

        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).not.toHaveBeenCalled();
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('should respect warn level (warnings and errors)', () => {
        const logger = createLogger({ logLevel: 'warn' });
        logger.info('Should not log');
        logger.warn('Should log');
        logger.error('Should log');

        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('should respect info level (all messages)', () => {
        const logger = createLogger({ logLevel: 'info' });
        logger.info('Should log');
        logger.warn('Should log');
        logger.error('Should log');

        expect(mockConsole.info).toHaveBeenCalledTimes(1);
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });
    });

    describe('Logger State Isolation', () => {
      it('should maintain separate state for different logger instances', () => {
        const logger1 = createLogger({ prefix: 'LOGGER1', logLevel: 'error' });
        const logger2 = createLogger({ prefix: 'LOGGER2', logLevel: 'info' });

        logger1.info('Should not log');
        logger2.info('Should log');

        expect(mockConsole.info).toHaveBeenCalledTimes(1);
        const [call] = mockConsole.info.mock.calls;
        expect(call).toBeDefined();
        if (call) {
          const logMessage = call as Array<string>;
          expect(logMessage[0]).toContain('[LOGGER2]');
        }
      });
    });
  });

  describe('Network Logging', () => {
    describe('networkLog Object', () => {
      it('should have log property with logger methods', () => {
        expect(networkLog.log).toBeDefined();
        expect(typeof networkLog.log.info).toBe('function');
        expect(typeof networkLog.log.warn).toBe('function');
        expect(typeof networkLog.log.error).toBe('function');
      });

      it('should have enable method', () => {
        expect(typeof networkLog.enable).toBe('function');
      });

      it('should use NETWORK prefix by default', () => {
        // Enable network logging first
        networkLog.enable();
        networkLog.log.info('Test message');
        const [call] = mockConsole.info.mock.calls;
        expect(call).toBeDefined();
        if (call) {
          const logMessage = call as Array<string>;
          expect(logMessage[0]).toContain('[NETWORK]');
        }
      });
    });

    describe('enable Method', () => {
      it('should enable logging with default configuration', () => {
        networkLog.enable();
        networkLog.log.info('Test message');
        expect(mockConsole.info).toHaveBeenCalledTimes(1);
      });

      it('should enable logging with custom logger', () => {
        const customLogger: Logger = {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
        };

        networkLog.enable(customLogger);
        networkLog.log.info('Test message');

        expect(customLogger.info).toHaveBeenCalledTimes(1);
        expect(mockConsole.info).not.toHaveBeenCalled();
      });
    });
  });

  describe('Status Emoji Function', () => {
    it('should return correct emoji for 2xx status codes', () => {
      expect(getStatusEmoji(200)).toBe('✅');
      expect(getStatusEmoji(201)).toBe('✅');
      expect(getStatusEmoji(299)).toBe('✅');
    });

    it('should return correct emoji for 3xx status codes', () => {
      expect(getStatusEmoji(300)).toBe('🔄');
      expect(getStatusEmoji(301)).toBe('🔄');
      expect(getStatusEmoji(399)).toBe('🔄');
    });

    it('should return correct emoji for 4xx status codes', () => {
      expect(getStatusEmoji(400)).toBe('❌');
      expect(getStatusEmoji(404)).toBe('❌');
      expect(getStatusEmoji(499)).toBe('❌');
    });

    it('should return correct emoji for 5xx status codes', () => {
      expect(getStatusEmoji(500)).toBe('💥');
      expect(getStatusEmoji(503)).toBe('💥');
      expect(getStatusEmoji(599)).toBe('💥');
    });

    it('should return question mark for unknown status codes', () => {
      expect(getStatusEmoji(100)).toBe('❓');
      expect(getStatusEmoji(150)).toBe('❓');
      expect(getStatusEmoji(199)).toBe('❓');
    });

    it('should return explosion emoji for 5xx+ status codes', () => {
      expect(getStatusEmoji(500)).toBe('💥');
      expect(getStatusEmoji(999)).toBe('💥');
    });
  });

  describe('Performance Logging', () => {
    beforeEach(() => {
      // Reset network log to ensure clean state
      networkLog.log = createLogger({ prefix: 'NETWORK', logLevel: 'off' });
      // Enable network logging for performance tests
      networkLog.enable();
    });

    it('should log performance details for very fast responses', () => {
      logPerformanceDetails(25);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[2]).toContain('⚡');
        expect(logMessage[2]).toContain('faster than a Stillers touchdown!');
      }
    });

    it('should log performance details for fast responses', () => {
      logPerformanceDetails(75);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[2]).toContain('🔥');
        expect(logMessage[2]).toContain("smooth as butter n'at!");
      }
    });

    it('should log performance details for good responses', () => {
      logPerformanceDetails(150);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[2]).toContain('✅');
        expect(logMessage[2]).toContain('not bad yinz!');
      }
    });

    it('should log performance details for slow responses', () => {
      logPerformanceDetails(300);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[2]).toContain('⚠️');
        expect(logMessage[2]).toContain("slowin' down a bit there");
      }
    });

    it('should log performance details for very slow responses', () => {
      logPerformanceDetails(750);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[2]).toContain('🐌');
        expect(logMessage[2]).toContain("that's draggin' n'at");
      }
    });

    it('should log performance details for extremely slow responses', () => {
      logPerformanceDetails(1500);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[2]).toContain('💥');
        expect(logMessage[2]).toContain('what a jagoff response time!');
      }
    });

    it('should include response time in milliseconds', () => {
      logPerformanceDetails(123);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[2]).toContain('123ms');
      }
    });

    it('should use NETWORK prefix for performance logging', () => {
      logPerformanceDetails(100);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[0]).toContain('[NETWORK]');
      }
    });

    it('should include warning emoji and timestamp', () => {
      logPerformanceDetails(200);
      const [call] = mockConsole.warn.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[0]).toContain('⚠️');
        expect(logMessage[0]).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid log levels gracefully', () => {
      const logger = createLogger({ logLevel: 'invalid' as any });
      // Should default to info level
      logger.info('Should log');
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });

    it('should handle missing configuration gracefully', () => {
      const logger = createLogger();
      logger.info('Should log with defaults');
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('Type Safety', () => {
    it('should accept various argument types', () => {
      expect(() => {
        log.info('string');
        log.info('string', { object: 'value' });
        log.info('string', [1, 2, 3]);
        log.info('string', 42, true, null, undefined);
      }).not.toThrow();
    });

    it('should handle complex nested objects', () => {
      const complexObject = {
        nested: {
          array: [1, 2, { deep: 'value' }],
          string: 'test',
          number: 42,
        },
      };
      expect(() => log.info('Complex object', complexObject)).not.toThrow();
    });
  });
});
