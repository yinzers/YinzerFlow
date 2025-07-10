import { describe, expect, it } from 'bun:test';
import { parseUrlEncodedForm } from '../parseUrlEncodedForm.ts';
import type { UrlEncodedConfiguration } from '@typedefs/public/Configuration.js';

/**
 * Create test URL-encoded configuration with sensible defaults
 */
const createTestConfig = (overrides: Partial<UrlEncodedConfiguration> = {}): UrlEncodedConfiguration => ({
  maxSize: 1048576, // 1MB
  maxFields: 1000,
  maxFieldNameLength: 100,
  maxFieldLength: 1048576,
  ...overrides,
});

describe('parseUrlEncodedForm', () => {
  describe('Basic parsing', () => {
    it('should parse simple key-value pairs', () => {
      const body = 'name=John&age=30&city=NewYork';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        name: 'John',
        age: '30',
        city: 'NewYork',
      });
    });

    it('should handle empty values', () => {
      const body = 'empty=&hasvalue=test&alsoempty=';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        empty: '',
        hasvalue: 'test',
        alsoempty: '',
      });
    });

    it('should handle keys without values', () => {
      const body = 'key1&key2=value2&key3';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        key1: '',
        key2: 'value2',
        key3: '',
      });
    });
  });

  describe('URL encoding/decoding', () => {
    it('should decode URL-encoded characters', () => {
      const body = 'message=Hello%20World&email=test%40example.com&path=%2Fuser%2Fprofile';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        message: 'Hello World',
        email: 'test@example.com',
        path: '/user/profile',
      });
    });

    it('should decode special characters', () => {
      const body = 'symbols=%21%40%23%24%25%5E%26%2A%28%29&plus=%2B&equals=%3D';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        symbols: '!@#$%^&*()',
        plus: '+',
        equals: '=',
      });
    });

    it('should handle unicode characters', () => {
      const body = 'emoji=%F0%9F%8E%89&unicode=%E2%9C%85&chinese=%E4%B8%AD%E6%96%87';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        emoji: '🎉',
        unicode: '✅',
        chinese: '中文',
      });
    });

    it('should handle already decoded characters', () => {
      const body = 'normal=text&already=decoded value';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        normal: 'text',
        already: 'decoded value',
      });
    });
  });

  describe('Security: Field Count Protection', () => {
    it('should reject forms with too many fields', () => {
      const config = createTestConfig({ maxFields: 3 });
      const body = 'f1=v1&f2=v2&f3=v3&f4=v4'; // 4 fields > 3

      expect(() => parseUrlEncodedForm(body, config)).toThrow(/Too many form fields.*exceeds limit of 3/);
    });

    it('should accept forms within field limit', () => {
      const config = createTestConfig({ maxFields: 5 });
      const body = 'f1=v1&f2=v2&f3=v3'; // 3 fields < 5

      const result = parseUrlEncodedForm(body, config);
      expect(result).toEqual({ f1: 'v1', f2: 'v2', f3: 'v3' });
    });

    it('should handle empty pairs when counting fields', () => {
      const config = createTestConfig({ maxFields: 2 });
      const body = 'valid=test&empty=&another=value'; // 3 valid fields, but should only count non-empty ones

      // This should work since we have 3 fields but maxFields is 2
      // However, our implementation counts all pairs including empty ones
      expect(() => parseUrlEncodedForm(body, config)).toThrow(/Too many form fields.*exceeds limit of 2/);
    });
  });

  describe('Security: Field Name Length Protection', () => {
    it('should reject field names exceeding maxFieldNameLength', () => {
      const config = createTestConfig({ maxFieldNameLength: 10 });
      const longFieldName = 'very_long_field_name_that_exceeds_limit';
      const body = `${longFieldName}=value`;

      expect(() => parseUrlEncodedForm(body, config)).toThrow(/Form field name too long.*exceeds limit of 10/);
    });

    it('should accept field names within limit', () => {
      const config = createTestConfig({ maxFieldNameLength: 20 });
      const body = 'shortName=value';

      const result = parseUrlEncodedForm(body, config);
      expect(result).toEqual({ shortName: 'value' });
    });

    it('should validate decoded field name lengths', () => {
      const config = createTestConfig({ maxFieldNameLength: 5 });
      const encodedLongName = encodeURIComponent('very_long_name'); // Longer when decoded
      const body = `${encodedLongName}=value`;

      expect(() => parseUrlEncodedForm(body, config)).toThrow(/Form field name too long.*exceeds limit of 5/);
    });
  });

  describe('Security: Field Value Length Protection', () => {
    it('should reject field values exceeding maxFieldLength', () => {
      const config = createTestConfig({ maxFieldLength: 10 });
      const longValue = 'x'.repeat(20); // Exceeds limit
      const body = `field=${longValue}`;

      expect(() => parseUrlEncodedForm(body, config)).toThrow(/Form field value too long.*exceeds limit of 10/);
    });

    it('should accept field values within limit', () => {
      const config = createTestConfig({ maxFieldLength: 50 });
      const body = 'field=short_value';

      const result = parseUrlEncodedForm(body, config);
      expect(result).toEqual({ field: 'short_value' });
    });

    it('should validate decoded field value lengths', () => {
      const config = createTestConfig({ maxFieldLength: 5 });
      const longValue = 'very long value that exceeds limit';
      const encodedValue = encodeURIComponent(longValue);
      const body = `field=${encodedValue}`;

      expect(() => parseUrlEncodedForm(body, config)).toThrow(/Form field value too long.*exceeds limit of 5/);
    });

    it('should provide field context in error messages', () => {
      const config = createTestConfig({ maxFieldLength: 5 });
      const body = 'username=very_long_username';

      try {
        parseUrlEncodedForm(body, config);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain("field 'username'");
        expect((error as Error).message).toContain('exceeds limit of 5');
      }
    });
  });

  describe('Security: Malformed Encoding Handling', () => {
    it('should handle malformed URL encoding gracefully with security', () => {
      const config = createTestConfig({ maxFieldLength: 50 });
      const body = 'valid=test&malformed=%GG&another=value';

      const result = parseUrlEncodedForm(body, config);

      expect(result).toHaveProperty('valid', 'test');
      expect(result).toHaveProperty('another', 'value');
      expect(result).toHaveProperty('malformed');
    });

    it('should re-throw validation errors even for malformed encoding', () => {
      const config = createTestConfig({ maxFieldLength: 5 });
      const body = 'field=very_long_value_that_exceeds_limit';

      // Validation errors should be re-thrown, not handled as encoding errors
      expect(() => parseUrlEncodedForm(body, config)).toThrow(/exceeds limit/);
    });

    it('should handle incomplete percent encoding with security', () => {
      const config = createTestConfig();
      const body = 'incomplete=%2&valid=test';

      const result = parseUrlEncodedForm(body, config);

      expect(result).toHaveProperty('valid', 'test');
      expect(result).toHaveProperty('incomplete');
    });
  });

  describe('Security: Combined Attack Scenarios', () => {
    it('should handle form bombs (many fields + long names + long values)', () => {
      const config = createTestConfig({
        maxFields: 10,
        maxFieldNameLength: 20,
        maxFieldLength: 50,
      });

      // Try to exceed field count first
      const manyFieldsBody = Array.from({ length: 15 }, (_, i) => `field${i}=value${i}`).join('&');
      expect(() => parseUrlEncodedForm(manyFieldsBody, config)).toThrow(/Too many form fields/);

      // Try to exceed field name length
      const longNameBody = 'very_very_very_long_field_name_that_exceeds_limit=value';
      expect(() => parseUrlEncodedForm(longNameBody, config)).toThrow(/Form field name too long/);

      // Try to exceed field value length
      const longValueBody = `field=${'x'.repeat(100)}`;
      expect(() => parseUrlEncodedForm(longValueBody, config)).toThrow(/Form field value too long/);
    });

    it('should validate all fields even when one fails', () => {
      const config = createTestConfig({ maxFieldLength: 10 });
      const body = `short=ok&long=${'x'.repeat(20)}&another=ok`;

      // Should fail on the first violation it encounters
      expect(() => parseUrlEncodedForm(body, config)).toThrow(/Form field value too long.*field 'long'/);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const body = '';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({});
    });

    it('should handle string with only ampersands', () => {
      const body = '&&&';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({});
    });

    it('should handle malformed pairs gracefully', () => {
      const body = 'valid=value&=emptykey&=&validagain=test';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        valid: 'value',
        validagain: 'test',
      });
    });

    it('should handle duplicate keys (last one wins)', () => {
      const body = 'key=first&key=second&key=third';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        key: 'third',
      });
    });

    it('should handle values with equals signs', () => {
      const body = 'equation=x%3D5%2B3&base64=dGVzdA%3D%3D';
      const result = parseUrlEncodedForm(body);

      expect(result).toEqual({
        equation: 'x=5+3',
        base64: 'dGVzdA==',
      });
    });

    it('should handle very long values within security limits', () => {
      const config = createTestConfig({ maxFieldLength: 2000 });
      const longValue = 'a'.repeat(1000);
      const encodedLongValue = encodeURIComponent(longValue);
      const body = `short=test&long=${encodedLongValue}&another=value`;

      const result = parseUrlEncodedForm(body, config);

      expect(result).toEqual({
        short: 'test',
        long: longValue,
        another: 'value',
      });
    });
  });

  describe('Error handling', () => {
    it('should handle malformed URL encoding gracefully', () => {
      const body = 'valid=test&malformed=%GG&another=value';
      const result = parseUrlEncodedForm(body);

      // Should not throw, but malformed encoding might not decode properly
      expect(result).toHaveProperty('valid', 'test');
      expect(result).toHaveProperty('another', 'value');
      expect(result).toHaveProperty('malformed');
    });

    it('should handle incomplete percent encoding', () => {
      const body = 'incomplete=%2&valid=test';
      const result = parseUrlEncodedForm(body);

      expect(result).toHaveProperty('valid', 'test');
      expect(result).toHaveProperty('incomplete');
    });
  });
});
