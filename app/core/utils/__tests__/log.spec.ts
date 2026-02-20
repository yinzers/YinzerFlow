import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createLogger, log, loggerBrand } from '@core/utils/log.js';
import { accessLogBaseConfig, getStatusEmoji } from '@core/utils/accessLog.js';
import type { Logger } from '@typedefs/public/Logger.js';

// Mock console methods to capture output
const mockConsole = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

describe('YinzerFlow Logging System', () => {
  beforeEach(() => {
    // Reset all mocks
    mockConsole.info.mockClear();
    mockConsole.warn.mockClear();
    mockConsole.error.mockClear();
    mockConsole.debug.mockClear();

    // Mock console methods
    global.console = {
      ...global.console,
      info: mockConsole.info,
      warn: mockConsole.warn,
      error: mockConsole.error,
      debug: mockConsole.debug,
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
        const customLogger = createLogger({ level: 'error' });
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
        const logger = createLogger({ level: 'off' });
        logger.info('Should not log');
        logger.warn('Should not log');
        logger.error('Should not log');

        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).not.toHaveBeenCalled();
        expect(mockConsole.error).not.toHaveBeenCalled();
      });

      it('should respect error level (only errors)', () => {
        const logger = createLogger({ level: 'error' });
        logger.info('Should not log');
        logger.warn('Should not log');
        logger.error('Should log');

        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).not.toHaveBeenCalled();
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('should respect warn level (warnings and errors)', () => {
        const logger = createLogger({ level: 'warn' });
        logger.info('Should not log');
        logger.warn('Should log');
        logger.error('Should log');

        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('should respect info level (all messages)', () => {
        const logger = createLogger({ level: 'info' });
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
        const logger1 = createLogger({ prefix: 'LOGGER1', level: 'error' });
        const logger2 = createLogger({ prefix: 'LOGGER2', level: 'info' });

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

  describe('Debug Level', () => {
    it('should log debug messages when level is debug', () => {
      const logger = createLogger({ level: 'debug' });
      logger.debug('Debug message');
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
    });

    it('should not log debug messages at info level', () => {
      const logger = createLogger({ level: 'info' });
      logger.debug('Should not appear');
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });

    it('should log all levels when set to debug', () => {
      const logger = createLogger({ level: 'debug' });
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');
      logger.debug('Debug');

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
    });

    it('should include DEBUG tag in output', () => {
      const logger = createLogger({ level: 'debug' });
      logger.debug('Test');
      const [call] = mockConsole.debug.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        expect(logMessage[0]).toContain('[DEBUG]');
      }
    });

    it('should pass through to custom logger debug method', () => {
      const customLogger = {
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
        debug: mock(() => {}),
      };
      const logger = createLogger({ level: 'debug', logger: customLogger });
      logger.debug('Test');
      expect(customLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should silently drop debug if custom logger has no debug method', () => {
      const customLogger = {
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
      };
      const logger = createLogger({ level: 'debug', logger: customLogger });
      expect(() => logger.debug('Test')).not.toThrow();
    });
  });

  describe('Personality Toggle', () => {
    it('should include phrases when personality is true (default)', () => {
      const logger = createLogger({ personality: true });
      logger.info('Test');
      const [call] = mockConsole.info.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        const lastArg = logMessage[logMessage.length - 1] ?? '';
        // Should end with a phrase (contains " - ")
        expect(lastArg).toMatch(/ - /);
      }
    });

    it('should not include phrases when personality is false', () => {
      const logger = createLogger({ personality: false });
      logger.info('Test');
      const [call] = mockConsole.info.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        const lastArg = logMessage[logMessage.length - 1] ?? '';
        // Should NOT contain " - " phrase suffix
        expect(lastArg).not.toMatch(/n'at|yinz|jagoff|what can ya do/);
      }
    });

    it('should default to personality enabled', () => {
      const logger = createLogger();
      logger.info('Test');
      const [call] = mockConsole.info.mock.calls;
      expect(call).toBeDefined();
      if (call) {
        const logMessage = call as Array<string>;
        const lastArg = logMessage[logMessage.length - 1] ?? '';
        expect(lastArg).toMatch(/ - /);
      }
    });
  });

  describe('Access Logging', () => {
    describe('accessLogBaseConfig', () => {
      it('should have ACCESS prefix', () => {
        expect(accessLogBaseConfig.prefix).toBe('ACCESS');
      });

      it('should default to level off', () => {
        expect(accessLogBaseConfig.level).toBe('off');
      });

      it('should have personality disabled', () => {
        expect(accessLogBaseConfig.personality).toBe(false);
      });
    });

    describe('per-instance access log creation', () => {
      it('should create access log with ACCESS prefix when enabled', () => {
        const accessLogger = createLogger({ ...accessLogBaseConfig, level: 'info' });
        accessLogger.info('Test message');
        const [call] = mockConsole.info.mock.calls;
        expect(call).toBeDefined();
        if (call) {
          const logMessage = call as Array<string>;
          expect(logMessage[0]).toContain('[ACCESS]');
        }
      });

      it('should delegate to custom logger when provided', () => {
        const customLogger: Logger = {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
        };

        const accessLogger = createLogger({ ...accessLogBaseConfig, level: 'info', logger: customLogger });
        accessLogger.info('Test message');

        expect(customLogger.info).toHaveBeenCalledTimes(1);
        expect(mockConsole.info).not.toHaveBeenCalled();
      });

      it('should not log when level is off (default config)', () => {
        const accessLogger = createLogger(accessLogBaseConfig);
        accessLogger.info('Should be silent');
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

  describe('Error Handling', () => {
    it('should handle invalid log levels gracefully', () => {
      const logger = createLogger({ level: 'invalid' as any });
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

  describe('loggerBrand Symbol', () => {
    it('should have Symbol brand on created loggers', () => {
      const logger = createLogger();
      expect(loggerBrand in logger).toBe(true);
    });

    it('should expose state via Symbol brand', () => {
      const logger = createLogger({ level: 'debug', prefix: 'TEST' });
      const state = logger[loggerBrand];
      expect(state.level).toBe('debug');
      expect(state.prefix).toBe('TEST');
    });

    it('should not match plain objects (unforgeable)', () => {
      const fakeLogger = {
        info: () => {},
        warn: () => {},
        error: () => {},
        _state: { level: 'info', prefix: 'FAKE', personality: true },
      };
      expect(loggerBrand in fakeLogger).toBe(false);
    });

    it('should have Symbol brand on default log instance', () => {
      expect(loggerBrand in log).toBe(true);
      expect(log[loggerBrand].level).toBe('info');
    });

    it('should support deprecated logLevel parameter', () => {
      const logger = createLogger({ logLevel: 'error' });
      expect(logger[loggerBrand].level).toBe('error');
    });

    it('should prefer level over logLevel when both provided', () => {
      const logger = createLogger({ level: 'debug', logLevel: 'error' });
      expect(logger[loggerBrand].level).toBe('debug');
    });
  });
});
