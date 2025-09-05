import { describe, expect, it } from 'bun:test';
import { calculateContentSizeInBytes } from '@core/utils/calculateContentSizeInBytes.ts';

describe('calculateContentSizeInBytes', () => {
  describe('null and undefined handling', () => {
    it('should return "0" for null body', () => {
      expect(calculateContentSizeInBytes(null)).toBe(0);
    });

    it('should return "0" for undefined body', () => {
      expect(calculateContentSizeInBytes(undefined)).toBe(0);
    });

    it('should return "0" for empty string', () => {
      expect(calculateContentSizeInBytes('')).toBe(0);
    });
  });

  describe('UTF-8 encoding (default)', () => {
    it('should calculate length for simple string', () => {
      const body = 'Hello, world!';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(13);
    });

    it('should calculate length for UTF-8 string with multi-byte characters', () => {
      const body = 'Hello 世界'; // Contains multi-byte UTF-8 characters
      const result = calculateContentSizeInBytes(body);
      // 'Hello ' = 6 bytes, '世界' = 6 bytes (3 bytes each)
      expect(result).toBe(12);
    });

    it('should calculate length for string with newlines', () => {
      const body = 'Line 1\nLine 2\r\nLine 3';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should calculate length for JSON string', () => {
      const body = '{"message":"Hello","count":42}';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should handle emoji and special characters', () => {
      const body = '🚀🌟✨ Hello 你好世界 ©®™€£¥';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });
  });

  describe('base64 encoding', () => {
    it('should calculate length for base64 string', () => {
      const body = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should calculate length for image data as base64', () => {
      // Simulate base64 encoded image data
      const body = '/9j/4AAQSkZJRgABAQEAYABgAAD'; // Sample base64 image data
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should handle empty base64 string', () => {
      const body = '';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(0);
    });
  });

  describe('binary encoding', () => {
    it('should calculate length for binary data string', () => {
      // Simulate binary data as string
      const body = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // 4 bytes of binary data
      const result = calculateContentSizeInBytes(body);
      console.log(result);
      expect(result).toBe(4);
    });

    it('should handle empty binary string', () => {
      const body = Buffer.from([]);
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large strings with utf8', () => {
      const body = 'x'.repeat(10000);
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(10000);
    });

    it('should handle strings with only whitespace', () => {
      const body = '   \n\t\r   ';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should handle single character strings', () => {
      expect(calculateContentSizeInBytes('a')).toBe(1);
      expect(calculateContentSizeInBytes('a')).toBe(1);
      expect(calculateContentSizeInBytes('a')).toBe(1);
    });
  });

  describe('realistic HTTP response scenarios', () => {
    it('should calculate length for typical JSON API response', () => {
      const body = '{"users":[{"id":1,"name":"John"},{"id":2,"name":"Jane"}],"total":2}';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should calculate length for HTML response', () => {
      const body = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should calculate length for plain text response', () => {
      const body = 'This is a plain text response with some content.';
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should calculate length for base64 file download', () => {
      const body = 'UEsDBBQAAAAIAK6G'; // Sample base64 file content
      const result = calculateContentSizeInBytes(body);
      expect(result).toBe(Buffer.byteLength(body, 'utf8'));
    });
  });
});
