import { describe, expect, it } from 'bun:test';
import { parseBody } from '../parseBody.ts';
import type { ParseBodyOptions } from '../parseBody.ts';
import { contentType } from '@constants/http.ts';
import type { BodyParserConfiguration, JsonParserConfiguration, UrlEncodedConfiguration } from '@typedefs/public/Configuration.js';

/**
 * Create test body parser configuration with sensible defaults
 */
const createTestBodyParserConfig = (overrides: Partial<BodyParserConfiguration> = {}): BodyParserConfiguration => ({
  json: {
    maxSize: 1048576, // 1MB
    maxDepth: 10,
    allowPrototypeProperties: false,
    maxKeys: 1000,
    maxStringLength: 10000,
    maxArrayLength: 1000,
    ...overrides.json,
  },
  fileUploads: {
    maxFileSize: 10485760, // 10MB
    maxTotalSize: 52428800, // 50MB
    maxFiles: 10,
    allowedExtensions: [],
    blockedExtensions: ['.exe', '.bat', '.cmd'],
    maxFilenameLength: 255,
    ...overrides.fileUploads,
  },
  urlEncoded: {
    maxSize: 1048576, // 1MB
    maxFields: 1000,
    maxFieldNameLength: 100,
    maxFieldLength: 1048576,
    ...overrides.urlEncoded,
  },
});

describe('parseBody', () => {
  describe('Empty body handling', () => {
    it('should return undefined for empty string', () => {
      const result = parseBody('');
      expect(result).toBeUndefined();
    });

    it('should return undefined for whitespace-only string', () => {
      const result = parseBody('   ');
      expect(result).toBeUndefined();
    });

    it('should handle empty body with options', () => {
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody('', options);
      expect(result).toBeUndefined();
    });
  });

  describe('JSON parsing with new options pattern', () => {
    it('should parse JSON with explicit content type in options', () => {
      const body = '{"name": "test", "value": 123}';
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should require config for JSON parsing', () => {
      const body = '{"name": "test"}';
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        // config is missing
      };

      expect(() => parseBody(body, options)).toThrow('Body parser configuration is required for JSON parsing');
    });

    it('should parse JSON arrays with security config', () => {
      const body = '[1, 2, 3, "test"]';
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toEqual([1, 2, 3, 'test'] as any);
    });

    it('should apply JSON security limits', () => {
      const body = `{"data": "${'x'.repeat(1000)}"}`;
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        config: createTestBodyParserConfig({
          json: { maxStringLength: 100 } as JsonParserConfiguration, // Much smaller than the string
        }),
      };

      expect(() => parseBody(body, options)).toThrow(/String.*too long.*exceeds limit/);
    });

    it('should handle complex nested JSON with security', () => {
      const body = '{"users": [{"name": "John", "settings": {"theme": "dark"}}]}';
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toEqual({
        users: [{ name: 'John', settings: { theme: 'dark' } }],
      });
    });
  });

  describe('JSON parsing with size validation', () => {
    it('should reject JSON body exceeding maxSize', () => {
      const largeBody = `{"data": "${'x'.repeat(10000)}"}`;
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        config: createTestBodyParserConfig({
          json: { maxSize: 1000 } as JsonParserConfiguration, // Much smaller than the body
        }),
      };

      expect(() => parseBody(largeBody, options)).toThrow(/JSON body too large.*exceeds limit/);
    });

    it('should accept JSON body within maxSize', () => {
      const body = '{"small": "data"}';
      const options: ParseBodyOptions = {
        headerContentType: contentType.json,
        config: createTestBodyParserConfig({
          json: { maxSize: 1000 } as JsonParserConfiguration,
        }),
      };

      const result = parseBody(body, options);
      expect(result).toEqual({ small: 'data' });
    });
  });

  describe('Multipart form data parsing', () => {
    it('should parse multipart data with boundary in options', () => {
      const boundary = 'boundary123';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n--${boundary}--`;
      const options: ParseBodyOptions = {
        headerContentType: contentType.multipart,
        boundary,
        config: createTestBodyParserConfig(),
      };

      const result = parseBody(body, options);

      expect(result).toHaveProperty('fields');
      expect(result).toHaveProperty('files');
      expect((result as any).fields.field1).toBe('value1');
    });

    it('should throw error for multipart without boundary', () => {
      const body = '--boundary123\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n--boundary123--';
      const options: ParseBodyOptions = {
        headerContentType: contentType.multipart,
        config: createTestBodyParserConfig(),
      };

      expect(() => parseBody(body, options)).toThrow('Invalid multipart form data: missing boundary');
    });

    it('should handle multipart with file uploads', () => {
      const boundary = 'boundary123';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nfile content\r\n--${boundary}--`;
      const options: ParseBodyOptions = {
        headerContentType: contentType.multipart,
        boundary,
        config: createTestBodyParserConfig(),
      };

      const result = parseBody(body, options);

      expect(result).toHaveProperty('files');
      expect((result as any).files).toHaveLength(1);
      expect((result as any).files[0].filename).toBe('test.txt');
      expect((result as any).files[0].content).toBe('file content');
    });
  });

  describe('URL-encoded form parsing', () => {
    it('should parse URL-encoded form data with security config', () => {
      const body = 'name=test&value=123&encoded=%20space';
      const options: ParseBodyOptions = {
        headerContentType: contentType.form,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toEqual({
        name: 'test',
        value: '123',
        encoded: ' space',
      });
    });

    it('should apply URL-encoded size limits', () => {
      const largeBody = `data=${'x'.repeat(10000)}`;
      const options: ParseBodyOptions = {
        headerContentType: contentType.form,
        config: createTestBodyParserConfig({
          urlEncoded: { maxSize: 1000 } as UrlEncodedConfiguration, // Much smaller than body
        }),
      };

      expect(() => parseBody(largeBody, options)).toThrow(/URL-encoded body too large.*exceeds limit/);
    });

    it('should handle empty values in URL-encoded data', () => {
      const body = 'empty=&hasvalue=test';
      const options: ParseBodyOptions = {
        headerContentType: contentType.form,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toEqual({
        empty: '',
        hasvalue: 'test',
      });
    });

    it('should handle complex URL-encoded data', () => {
      const body = 'user%5Bname%5D=John&user%5Bemail%5D=john%40example.com&tags%5B%5D=dev&tags%5B%5D=js';
      const options: ParseBodyOptions = {
        headerContentType: contentType.form,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toEqual({
        'user[name]': 'John',
        'user[email]': 'john@example.com',
        'tags[]': 'js', // Last value wins (depends on URL parsing implementation)
      });
    });
  });

  describe('Raw body handling', () => {
    it('should return raw body for text content types', () => {
      const body = 'This is plain text content';
      const options: ParseBodyOptions = {
        headerContentType: 'text/plain' as any,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toBe(body);
    });

    it('should return raw body for unknown content types', () => {
      const body = 'Some unknown content';
      const options: ParseBodyOptions = {
        headerContentType: 'application/unknown' as any,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toBe(body);
    });

    it('should handle binary-like content as raw text', () => {
      const body = 'Binary\x00\x01\x02data';
      const options: ParseBodyOptions = {
        headerContentType: 'application/octet-stream' as any,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(body, options);

      expect(result).toBe(body);
    });
  });

  describe('Backward compatibility with old API', () => {
    it('should still work with old parseBody(body, contentType) signature', () => {
      const body = 'key=value&test=123';
      const result = parseBody(body, { headerContentType: contentType.form });

      expect(result).toEqual({ key: 'value', test: '123' });
    });

    it('should still work with old parseBody(body, contentType, boundary) signature', () => {
      const boundary = 'boundary123';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n--${boundary}--`;
      const result = parseBody(body, { headerContentType: contentType.multipart, boundary });

      expect(result).toHaveProperty('fields');
      expect((result as any).fields.field1).toBe('value1');
    });
  });

  describe('Integration with content type inference', () => {
    it('should use inferContentType when no content type provided', () => {
      // JSON inference and parsing - should fail without config
      const jsonBody = '{"inferred": true}';
      expect(() => parseBody(jsonBody)).toThrow('Body parser configuration is required for JSON parsing');

      // With config, should work
      const jsonResult = parseBody(jsonBody, { config: createTestBodyParserConfig() });
      expect(jsonResult).toEqual({ inferred: true });

      // Form data inference and parsing - should work without config
      const formBody = 'key=value&test=123';
      const formResult = parseBody(formBody);
      expect(formResult).toEqual({ key: 'value', test: '123' });

      // Plain text fallback
      const textBody = 'Just plain text';
      const textResult = parseBody(textBody);
      expect(textResult).toBe(textBody);
    });
  });

  describe('Security: Content Type Size Validation', () => {
    const sizeLimitCases = [
      {
        contentType: contentType.json,
        configKey: 'json' as const,
        body: `{"data": "${'x'.repeat(1000)}"}`,
        expectedError: /JSON body too large/,
      },
      {
        contentType: contentType.form,
        configKey: 'urlEncoded' as const,
        body: `data=${'x'.repeat(1000)}`,
        expectedError: /URL-encoded body too large/,
      },
    ];

    it.each(sizeLimitCases)('should apply size limits for $contentType', ({ contentType: ct, configKey, body, expectedError }) => {
      const config = createTestBodyParserConfig({
        [configKey]: { maxSize: 500 }, // Smaller than test body
      });

      const options: ParseBodyOptions = {
        headerContentType: ct,
        config,
      };

      expect(() => parseBody(body, options)).toThrow(expectedError);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very large content with proper limits', () => {
      const largeContent = 'x'.repeat(10000);
      const options: ParseBodyOptions = {
        headerContentType: 'text/plain' as any,
        config: createTestBodyParserConfig(),
      };
      const result = parseBody(largeContent, options);

      expect(result).toBe(largeContent);
    });

    it('should handle malformed data gracefully', () => {
      const config = createTestBodyParserConfig();

      // Malformed JSON should throw with explicit content-type and config
      expect(() => parseBody('{"invalid": json}', { headerContentType: contentType.json, config })).toThrow();

      // But should return raw with inference (no explicit content type)
      const result = parseBody('{"invalid": json}');
      expect(result).toBe('{"invalid": json}');
    });

    it('should handle missing config for secure parsing gracefully', () => {
      // URL-encoded should work without config
      const formResult = parseBody('key=value', { headerContentType: contentType.form });
      expect(formResult).toEqual({ key: 'value' });

      // JSON should require config
      expect(() => parseBody('{"test": true}', { headerContentType: contentType.json })).toThrow(/configuration is required/);
    });
  });
});
