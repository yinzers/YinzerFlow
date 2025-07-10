import { describe, expect, it } from 'bun:test';
import { log } from '@core/utils/log.ts';

describe('Log Utility', () => {
  describe('Log Level Management', () => {
    it('should have a setLogLevel function', () => {
      expect(typeof log.setLogLevel).toBe('function');

      // Should not throw when setting valid log levels
      expect(() => log.setLogLevel('error')).not.toThrow();
      expect(() => log.setLogLevel('warn')).not.toThrow();
      expect(() => log.setLogLevel('info')).not.toThrow();
      expect(() => log.setLogLevel('off')).not.toThrow();
    });
  });

  describe('Basic Logging Functions', () => {
    it('should have all required logging methods', () => {
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.perf).toBe('function');
    });

    it('should not throw when logging messages', () => {
      expect(() => log.info('Test message')).not.toThrow();
      expect(() => log.warn('Warning message')).not.toThrow();
      expect(() => log.error('Error message')).not.toThrow();
      expect(() => log.perf('Performance message', 100)).not.toThrow();
    });

    it('should handle data objects without throwing', () => {
      const testData = { key: 'value', number: 42 };
      expect(() => log.info('Test with data', testData)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined data gracefully', () => {
      expect(() => log.info('Test', null)).not.toThrow();
      expect(() => log.info('Test', undefined)).not.toThrow();
    });

    it('should handle circular references in data objects', () => {
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

    it('should handle special characters', () => {
      expect(() => log.info('Test with émojis 🎉 and spéciál chars')).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should accept string messages', () => {
      expect(() => log.info('string message')).not.toThrow();
    });

    it('should accept objects as data parameter', () => {
      expect(() => log.info('message', { data: 'value' })).not.toThrow();
    });

    it('should accept arrays as data parameter', () => {
      expect(() => log.info('message', [1, 2, 3])).not.toThrow();
    });

    it('should accept primitives as data parameter', () => {
      expect(() => log.info('message', 42)).not.toThrow();
      expect(() => log.info('message', true)).not.toThrow();
    });
  });
});
