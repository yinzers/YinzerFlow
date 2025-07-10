import { describe, expect, it } from 'bun:test';
import { formatBodyIntoString } from '../formatBodyIntoString.ts';

describe('formatBodyIntoString', () => {
  describe('Null and undefined handling', () => {
    it('should return empty string for null', () => {
      expect(formatBodyIntoString(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatBodyIntoString(undefined)).toBe('');
    });
  });

  describe('String handling', () => {
    it('should return strings as-is', () => {
      expect(formatBodyIntoString('Hello, world!')).toBe('Hello, world!');
      expect(formatBodyIntoString('')).toBe('');
      expect(formatBodyIntoString('   ')).toBe('   ');
    });

    it('should handle multiline strings', () => {
      const multiline = 'Line 1\nLine 2\rLine 3\r\nLine 4';
      expect(formatBodyIntoString(multiline)).toBe(multiline);
    });

    it('should handle unicode strings', () => {
      const unicode = '🚀 Hello 世界 🌍';
      expect(formatBodyIntoString(unicode)).toBe(unicode);
    });
  });

  describe('Object and array handling', () => {
    it('should JSON stringify objects', () => {
      const obj = { message: 'Hello, world!', count: 42 };
      expect(formatBodyIntoString(obj)).toBe('{"message":"Hello, world!","count":42}');
    });

    it('should JSON stringify arrays', () => {
      const arr = [1, 2, 3, 'hello', true];
      expect(formatBodyIntoString(arr)).toBe('[1,2,3,"hello",true]');
    });

    it('should handle nested objects', () => {
      const nested = {
        user: { name: 'John', age: 30 },
        items: [1, 2, 3],
      };
      expect(formatBodyIntoString(nested)).toBe('{"user":{"name":"John","age":30},"items":[1,2,3]}');
    });

    it('should handle Date objects', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      expect(formatBodyIntoString(date)).toBe('"2023-01-01T00:00:00.000Z"');
    });

    it('should handle empty objects and arrays', () => {
      expect(formatBodyIntoString({})).toBe('{}');
      expect(formatBodyIntoString([])).toBe('[]');
    });

    it('should handle objects with circular references', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Should fallback to String() conversion
      const result = formatBodyIntoString(circular);
      expect(result).toBe('[object Object]');
    });
  });

  describe('Primitive handling', () => {
    it('should handle numbers', () => {
      expect(formatBodyIntoString(42)).toBe('42');
      expect(formatBodyIntoString(3.14)).toBe('3.14');
      expect(formatBodyIntoString(0)).toBe('0');
      expect(formatBodyIntoString(-1)).toBe('-1');
      expect(formatBodyIntoString(NaN)).toBe('NaN');
      expect(formatBodyIntoString(Infinity)).toBe('Infinity');
    });

    it('should handle booleans', () => {
      expect(formatBodyIntoString(true)).toBe('true');
      expect(formatBodyIntoString(false)).toBe('false');
    });

    it('should handle bigint', () => {
      expect(formatBodyIntoString(BigInt(123))).toBe('123');
      expect(formatBodyIntoString(BigInt('9007199254740991'))).toBe('9007199254740991');
    });

    it('should handle symbols', () => {
      const sym = Symbol('test');
      expect(formatBodyIntoString(sym)).toBe('Symbol(test)');

      const globalSym = Symbol.for('global');
      expect(formatBodyIntoString(globalSym)).toBe('Symbol(global)');
    });

    it('should handle functions', () => {
      // eslint-disable-next-line func-name-matching
      const func = function test() {
        return 42;
      };
      const result = formatBodyIntoString(func);
      expect(result).toContain('function test()');

      const arrow = () => 'hello';
      const arrowResult = formatBodyIntoString(arrow);
      expect(arrowResult).toContain('=>');
    });
  });

  describe('Buffer handling with encoding options', () => {
    const testData = 'Hello, world!';
    const buffer = Buffer.from(testData);

    it('should handle Buffer with default utf8 encoding', () => {
      expect(formatBodyIntoString(buffer)).toBe(testData);
    });

    it('should handle Buffer with explicit utf8 encoding', () => {
      expect(formatBodyIntoString(buffer, { encoding: 'utf8' })).toBe(testData);
    });

    it('should handle Buffer with base64 encoding', () => {
      const base64Expected = buffer.toString('base64');
      expect(formatBodyIntoString(buffer, { encoding: 'base64' })).toBe(base64Expected);
    });

    it('should handle Buffer with binary encoding', () => {
      const binaryExpected = buffer.toString('binary');
      expect(formatBodyIntoString(buffer, { encoding: 'binary' })).toBe(binaryExpected);
    });

    it('should handle binary data with base64 encoding', () => {
      const binaryBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const base64Expected = binaryBuffer.toString('base64');
      expect(formatBodyIntoString(binaryBuffer, { encoding: 'base64' })).toBe(base64Expected);
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      expect(formatBodyIntoString(emptyBuffer)).toBe('');
      expect(formatBodyIntoString(emptyBuffer, { encoding: 'base64' })).toBe('');
    });
  });

  describe('Uint8Array handling', () => {
    it('should handle Uint8Array with default utf8 encoding', () => {
      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(formatBodyIntoString(uint8Array)).toBe('Hello');
    });

    it('should handle Uint8Array with base64 encoding', () => {
      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]);
      const expected = Buffer.from(uint8Array).toString('base64');
      expect(formatBodyIntoString(uint8Array, { encoding: 'base64' })).toBe(expected);
    });

    it('should handle Uint8Array with binary encoding', () => {
      const uint8Array = new Uint8Array([255, 216, 255, 224]);
      const expected = Buffer.from(uint8Array).toString('binary');
      expect(formatBodyIntoString(uint8Array, { encoding: 'binary' })).toBe(expected);
    });

    it('should handle empty Uint8Array', () => {
      const emptyArray = new Uint8Array([]);
      expect(formatBodyIntoString(emptyArray)).toBe('');
    });
  });

  describe('ArrayBuffer handling', () => {
    it('should handle ArrayBuffer with default utf8 encoding', () => {
      const arrayBuffer = new ArrayBuffer(5);
      const view = new Uint8Array(arrayBuffer);
      view.set([72, 101, 108, 108, 111]); // "Hello"

      expect(formatBodyIntoString(arrayBuffer)).toBe('Hello');
    });

    it('should handle ArrayBuffer with base64 encoding', () => {
      const arrayBuffer = new ArrayBuffer(4);
      const view = new Uint8Array(arrayBuffer);
      view.set([255, 216, 255, 224]);

      const expected = Buffer.from(arrayBuffer).toString('base64');
      expect(formatBodyIntoString(arrayBuffer, { encoding: 'base64' })).toBe(expected);
    });

    it('should handle ArrayBuffer with binary encoding', () => {
      const arrayBuffer = new ArrayBuffer(4);
      const view = new Uint8Array(arrayBuffer);
      view.set([255, 216, 255, 224]);

      const expected = Buffer.from(arrayBuffer).toString('binary');
      expect(formatBodyIntoString(arrayBuffer, { encoding: 'binary' })).toBe(expected);
    });

    it('should handle empty ArrayBuffer', () => {
      const emptyBuffer = new ArrayBuffer(0);
      expect(formatBodyIntoString(emptyBuffer)).toBe('');
    });
  });

  describe('Real-world examples', () => {
    it('should handle API response', () => {
      const apiResponse = {
        status: 'success',
        data: {
          users: [
            { id: 1, name: 'John' },
            { id: 2, name: 'Jane' },
          ],
        },
        timestamp: '2023-01-01T00:00:00Z',
      };

      const expected = JSON.stringify(apiResponse);
      expect(formatBodyIntoString(apiResponse)).toBe(expected);
    });

    it('should handle HTML content', () => {
      const html = '<html><body><h1>Hello, World!</h1></body></html>';
      expect(formatBodyIntoString(html)).toBe(html);
    });

    it('should handle binary image data', () => {
      // JPEG header
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const base64Expected = jpegBuffer.toString('base64');

      expect(formatBodyIntoString(jpegBuffer, { encoding: 'base64' })).toBe(base64Expected);
    });

    it('should handle error responses', () => {
      const errorResponse = {
        error: true,
        message: 'Something went wrong',
        statusCode: 500,
      };

      expect(formatBodyIntoString(errorResponse)).toBe(JSON.stringify(errorResponse));
    });
  });

  describe('Edge cases', () => {
    it('should handle objects with special characters in values', () => {
      const obj = {
        message: 'Hello "world"\n\tHow are you?',
        emoji: '🚀🌍',
      };

      const result = formatBodyIntoString(obj);
      expect(result).toContain('"Hello \\"world\\"\\n\\tHow are you?"');
      expect(result).toContain('🚀🌍');
    });

    it('should handle very large numbers', () => {
      expect(formatBodyIntoString(Number.MAX_SAFE_INTEGER)).toBe('9007199254740991');
      expect(formatBodyIntoString(Number.MIN_SAFE_INTEGER)).toBe('-9007199254740991');
    });

    it('should handle special number values', () => {
      expect(formatBodyIntoString(Number.POSITIVE_INFINITY)).toBe('Infinity');
      expect(formatBodyIntoString(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
      expect(formatBodyIntoString(Number.NaN)).toBe('NaN');
    });
  });
});
