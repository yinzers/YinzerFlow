import { describe, expect, it } from 'bun:test';
import { calculateContentLength, divideString } from 'utils/string.utils.ts';

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

  describe('calculateContentLength', () => {
    it('should calculate the byte length of a string', () => {
      const body = 'Hello, world!';
      const result = calculateContentLength(body);

      expect(result).toBe(13);
    });

    it('should handle empty strings', () => {
      const body = '';
      const result = calculateContentLength(body);

      expect(result).toBe(0);
    });

    it('should handle strings with non-ASCII characters', () => {
      const body = 'Hello, 世界!';
      const result = calculateContentLength(body);

      // '世界' is 6 bytes in UTF-8 (3 bytes per character)
      expect(result).toBe(14);
    });

    it('should handle strings with emojis', () => {
      const body = 'Hello, 🌍!';
      const result = calculateContentLength(body);

      // '🌍' is 4 bytes in UTF-8
      expect(result).toBe(12);
    });
  });
});
