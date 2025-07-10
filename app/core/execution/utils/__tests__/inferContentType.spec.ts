import { describe, expect, it } from 'bun:test';
import { inferContentType, inferContentTypeFromString } from '../inferContentType.ts';
import { contentType } from '@constants/http.ts';

describe('inferContentType', () => {
  // =============================================================================
  // Null/Undefined Tests
  // =============================================================================

  describe('null/undefined handling', () => {
    it('should return text/plain for null', () => {
      expect(inferContentType(null)).toBe('text/plain');
    });

    it('should return text/plain for undefined', () => {
      expect(inferContentType(undefined)).toBe('text/plain');
    });
  });

  // =============================================================================
  // Object Type Tests
  // =============================================================================

  describe('object type detection', () => {
    it('should return application/json for plain objects', () => {
      expect(inferContentType({ message: 'hello' })).toBe(contentType.json);
      expect(inferContentType({ nested: { data: true } })).toBe(contentType.json);
      expect(inferContentType({})).toBe(contentType.json);
    });

    it('should return application/json for arrays', () => {
      expect(inferContentType([1, 2, 3])).toBe(contentType.json);
      expect(inferContentType(['a', 'b', 'c'])).toBe(contentType.json);
      expect(inferContentType([])).toBe(contentType.json);
    });

    it('should return text/plain for Date objects', () => {
      expect(inferContentType(new Date())).toBe('text/plain');
      expect(inferContentType(new Date('2024-01-01'))).toBe('text/plain');
    });
  });

  // =============================================================================
  // String Content Type Tests
  // =============================================================================

  describe('string content detection', () => {
    it('should delegate to inferContentTypeFromString for strings', () => {
      expect(inferContentType('plain text')).toBe('text/plain');
      expect(inferContentType('{"json": true}')).toBe(contentType.json);
    });
  });

  // =============================================================================
  // Binary Data Tests
  // =============================================================================

  describe('binary data detection', () => {
    it('should handle Buffer objects', () => {
      const textBuffer = Buffer.from('hello world', 'utf8');
      const result = inferContentType(textBuffer);
      expect(['application/octet-stream', 'text/plain']).toContain(result);
    });

    it('should handle Uint8Array', () => {
      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = inferContentType(uint8Array);
      expect(['application/octet-stream', 'text/plain']).toContain(result);
    });

    it('should handle ArrayBuffer', () => {
      const arrayBuffer = new ArrayBuffer(5);
      const result = inferContentType(arrayBuffer);
      expect(['application/octet-stream', 'text/plain']).toContain(result);
    });

    it('should detect binary JPEG data', () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic numbers
      const result = inferContentType(jpegHeader);
      expect(result).toBe('application/octet-stream'); // Should be detected as binary
    });
  });

  // =============================================================================
  // Primitive Type Tests
  // =============================================================================

  describe('primitive type handling', () => {
    it('should return text/plain for numbers', () => {
      expect(inferContentType(42)).toBe('text/plain');
      expect(inferContentType(3.14)).toBe('text/plain');
      expect(inferContentType(0)).toBe('text/plain');
    });

    it('should return text/plain for booleans', () => {
      expect(inferContentType(true)).toBe('text/plain');
      expect(inferContentType(false)).toBe('text/plain');
    });

    it('should return text/plain for bigint', () => {
      expect(inferContentType(BigInt(123))).toBe('text/plain');
    });

    it('should return text/plain for symbols', () => {
      expect(inferContentType(Symbol('test'))).toBe('text/plain');
    });

    it('should return text/plain for functions', () => {
      expect(inferContentType(() => {})).toBe('text/plain');
      expect(inferContentType(() => {})).toBe('text/plain');
    });
  });
});

describe('inferContentTypeFromString', () => {
  // =============================================================================
  // JSON Detection Tests
  // =============================================================================

  describe('JSON detection', () => {
    it('should detect valid JSON objects', () => {
      expect(inferContentTypeFromString('{"key": "value"}')).toBe(contentType.json);
      expect(inferContentTypeFromString('{"number": 42, "boolean": true}')).toBe(contentType.json);
      expect(inferContentTypeFromString('{}')).toBe(contentType.json);
    });

    it('should detect valid JSON arrays', () => {
      expect(inferContentTypeFromString('[1, 2, 3]')).toBe(contentType.json);
      expect(inferContentTypeFromString('["a", "b", "c"]')).toBe(contentType.json);
      expect(inferContentTypeFromString('[]')).toBe(contentType.json);
    });

    it('should reject invalid JSON that looks like JSON', () => {
      expect(inferContentTypeFromString('{key: "value"}')).toBe('text/plain'); // Missing quotes on key
      expect(inferContentTypeFromString('{invalid json}')).toBe('text/plain');
      expect(inferContentTypeFromString('[1, 2, 3')).toBe('text/plain'); // Missing closing bracket
    });

    it('should handle JSON with whitespace', () => {
      expect(inferContentTypeFromString('  {"test": true}  ')).toBe(contentType.json);
    });

    it('should handle complex JSON', () => {
      const complexJson = '{"users": [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]}';
      expect(inferContentTypeFromString(complexJson)).toBe(contentType.json);
    });
  });

  // =============================================================================
  // Form Data Detection Tests
  // =============================================================================

  describe('form data detection', () => {
    it('should detect URL-encoded form data', () => {
      expect(inferContentTypeFromString('key=value&test=123')).toBe(contentType.form);
      expect(inferContentTypeFromString('name=John&age=30&city=NYC')).toBe(contentType.form);
    });

    it('should NOT detect single key-value as form data', () => {
      expect(inferContentTypeFromString('single=value')).toBe('text/plain'); // Needs both = and &
    });

    it('should detect multipart form data', () => {
      expect(inferContentTypeFromString('--boundary=test\r\nContent-Type: text/plain')).toBe(contentType.multipart);
      expect(inferContentTypeFromString('multipart/form-data; boundary=something')).toBe(contentType.multipart);
    });

    it('should handle form data with whitespace', () => {
      expect(inferContentTypeFromString('  key=value&test=123  ')).toBe(contentType.form);
    });

    it('should handle URL-encoded special characters', () => {
      expect(inferContentTypeFromString('email=test%40example.com&name=John+Doe')).toBe(contentType.form);
    });
  });

  // =============================================================================
  // Default/Plain Text Tests
  // =============================================================================

  describe('plain text fallback', () => {
    it('should default to text/plain for unrecognized content', () => {
      expect(inferContentTypeFromString('Just plain text here')).toBe('text/plain');
      expect(inferContentTypeFromString('Random content 12345')).toBe('text/plain');
      expect(inferContentTypeFromString('No special patterns')).toBe('text/plain');
    });

    it('should handle empty strings', () => {
      expect(inferContentTypeFromString('')).toBe('text/plain');
      expect(inferContentTypeFromString('   ')).toBe('text/plain'); // Just whitespace
    });

    it('should treat HTML/XML/CSS as plain text', () => {
      expect(inferContentTypeFromString('<html><body>test</body></html>')).toBe('text/plain');
      expect(inferContentTypeFromString('<?xml version="1.0"?><root></root>')).toBe('text/plain');
      expect(inferContentTypeFromString('body { color: red; }')).toBe('text/plain');
      expect(inferContentTypeFromString('function test() { return true; }')).toBe('text/plain');
    });

    it('should handle very long strings', () => {
      const longText = 'x'.repeat(10000);
      expect(inferContentTypeFromString(longText)).toBe('text/plain');
    });

    it('should handle mixed content', () => {
      expect(inferContentTypeFromString('This has {brackets} and key=value but no ampersand')).toBe('text/plain');
      expect(inferContentTypeFromString('Almost JSON but {not quite valid}')).toBe('text/plain');
    });
  });

  // =============================================================================
  // Edge Cases Tests
  // =============================================================================

  describe('edge cases', () => {
    it('should prioritize JSON over form-like content', () => {
      const jsonWithEquals = '{"query": "search=term&page=1"}';
      expect(inferContentTypeFromString(jsonWithEquals)).toBe(contentType.json);
    });

    it('should handle nested structures correctly', () => {
      expect(inferContentTypeFromString('{"form": "key=value&test=123"}')).toBe(contentType.json);
      expect(inferContentTypeFromString('[{"id": 1}, {"id": 2}]')).toBe(contentType.json);
    });

    it('should handle boundary cases', () => {
      expect(inferContentTypeFromString('{}')).toBe(contentType.json); // Empty object
      expect(inferContentTypeFromString('[]')).toBe(contentType.json); // Empty array
      expect(inferContentTypeFromString('=')).toBe('text/plain'); // Just equals
      expect(inferContentTypeFromString('&')).toBe('text/plain'); // Just ampersand
    });
  });
});
