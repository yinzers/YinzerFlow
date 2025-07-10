import { describe, expect, it } from 'bun:test';
import { divideString } from '@core/utils/string.ts';

/**
 * String Utilities Tests
 *
 * Tests for the string manipulation utilities used throughout the framework.
 */

describe('String Utilities', () => {
  describe('divideString', () => {
    it('should divide a string into two parts based on a separator', () => {
      const body = 'first,second';
      const result = divideString(body, ',');

      expect(result).toEqual(['first', 'second']);
    });

    it('should handle empty strings', () => {
      const body = '';
      const result = divideString(body, ',');

      expect(result).toEqual(['', '']);
    });

    it('should handle strings without the separator', () => {
      const body = 'noseparator';
      const result = divideString(body, ',');

      expect(result).toEqual(['noseparator', '']);
    });

    it('should handle multi-character separators', () => {
      const body = 'first||second';
      const result = divideString(body, '||');

      expect(result).toEqual(['first', 'second']);
    });

    it('should handle multiple occurrences of the separator (only split on first)', () => {
      const body = 'first,second,third';
      const result = divideString(body, ',');

      expect(result).toEqual(['first', 'second,third']);
    });
  });
});
