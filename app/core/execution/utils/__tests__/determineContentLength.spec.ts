import { describe, expect, it } from 'bun:test';
import { determineContentLength } from '../determineContentLength.ts';
import { httpEncoding } from '@constants/http.ts';

describe('determineContentLength', () => {
  describe('null and undefined handling', () => {
    it('should return "0" for null body', () => {
      expect(determineContentLength(null)).toBe('0');
    });

    it('should return "0" for undefined body', () => {
      expect(determineContentLength(undefined)).toBe('0');
    });

    it('should return "0" for empty string', () => {
      expect(determineContentLength('')).toBe('0');
    });
  });

  describe('UTF-8 encoding (default)', () => {
    it('should calculate length for simple string', () => {
      const body = 'Hello, world!';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe('13');
    });

    it('should calculate length for UTF-8 string with multi-byte characters', () => {
      const body = 'Hello 世界'; // Contains multi-byte UTF-8 characters
      const result = determineContentLength(body, httpEncoding.utf8);
      // 'Hello ' = 6 bytes, '世界' = 6 bytes (3 bytes each)
      expect(result).toBe('12');
    });

    it('should calculate length for string with newlines', () => {
      const body = 'Line 1\nLine 2\r\nLine 3';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should calculate length for JSON string', () => {
      const body = '{"message":"Hello","count":42}';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should handle emoji and special characters', () => {
      const body = '🚀🌟✨ Hello 你好世界 ©®™€£¥';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });
  });

  describe('base64 encoding', () => {
    it('should calculate length for base64 string', () => {
      const body = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      const result = determineContentLength(body, httpEncoding.base64);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should calculate length for image data as base64', () => {
      // Simulate base64 encoded image data
      const body = '/9j/4AAQSkZJRgABAQEAYABgAAD'; // Sample base64 image data
      const result = determineContentLength(body, httpEncoding.base64);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should handle empty base64 string', () => {
      const body = '';
      const result = determineContentLength(body, httpEncoding.base64);
      expect(result).toBe('0');
    });
  });

  describe('binary encoding', () => {
    it('should calculate length for binary string', () => {
      const body = 'Hello'; // Each character = 1 byte in binary
      const result = determineContentLength(body, httpEncoding.binary);
      expect(result).toBe('5');
    });

    it('should calculate length for binary data string', () => {
      // Simulate binary data as string
      const body = '\xFF\xD8\xFF\xE0'; // 4 bytes of binary data
      const result = determineContentLength(body, httpEncoding.binary);
      expect(result).toBe('4');
    });

    it('should handle empty binary string', () => {
      const body = '';
      const result = determineContentLength(body, httpEncoding.binary);
      expect(result).toBe('0');
    });
  });

  describe('no encoding specified', () => {
    it('should default to 0 for any encoding when body is provided but no encoding', () => {
      const body = 'Hello, world!';
      const result = determineContentLength(body);
      expect(result).toBe('0'); // No encoding specified, defaults to 0
    });

    it('should return 0 for null with no encoding', () => {
      const result = determineContentLength(null);
      expect(result).toBe('0');
    });
  });

  describe('edge cases', () => {
    it('should handle very large strings with utf8', () => {
      const body = 'x'.repeat(10000);
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe('10000');
    });

    it('should handle very large strings with binary', () => {
      const body = 'x'.repeat(10000);
      const result = determineContentLength(body, httpEncoding.binary);
      expect(result).toBe('10000');
    });

    it('should handle strings with only whitespace', () => {
      const body = '   \n\t\r   ';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should handle single character strings', () => {
      expect(determineContentLength('a', httpEncoding.utf8)).toBe('1');
      expect(determineContentLength('a', httpEncoding.binary)).toBe('1');
      expect(determineContentLength('a', httpEncoding.base64)).toBe('1');
    });
  });

  describe('realistic HTTP response scenarios', () => {
    it('should calculate length for typical JSON API response', () => {
      const body = '{"users":[{"id":1,"name":"John"},{"id":2,"name":"Jane"}],"total":2}';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should calculate length for HTML response', () => {
      const body = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should calculate length for plain text response', () => {
      const body = 'This is a plain text response with some content.';
      const result = determineContentLength(body, httpEncoding.utf8);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });

    it('should calculate length for base64 file download', () => {
      const body = 'UEsDBBQAAAAIAK6G'; // Sample base64 file content
      const result = determineContentLength(body, httpEncoding.base64);
      expect(result).toBe(Buffer.byteLength(body, 'utf8').toString());
    });
  });
});
