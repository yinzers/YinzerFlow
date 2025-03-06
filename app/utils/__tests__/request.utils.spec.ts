import { describe, expect, test } from 'bun:test';
import {
  extractContentType,
  handleApplicationJson,
  handleCsv,
  handleMultipartFormData,
  handlePlainText,
  handleUrlEncodedJson,
  handleXml,
  handleXwwwFormUrlencoded,
  handleYaml,
  parseContentDisposition,
  parseCsvLine,
  parseKeyValuePairs,
  parseXmlElements,
  parseYamlValue,
  splitMultipartSection,
} from '../request.utils.ts';
import { isCsvData, isMultipartFormData, isUrlEncodedJson, isYamlData } from '../contentType.utils.ts';

describe('Request Utilities', () => {
  describe('handleApplicationJson', () => {
    test('should parse valid JSON correctly', () => {
      // Arrange
      const body = JSON.stringify({ name: 'Test User', email: 'test@example.com' });

      // Act
      const result = handleApplicationJson(body);

      // Assert
      expect(result).toEqual({ name: 'Test User', email: 'test@example.com' });
    });

    test('should throw error for invalid JSON', () => {
      // Arrange
      const body = '{ invalid json }';

      // Act & Assert
      expect(() => handleApplicationJson(body)).toThrow('Invalid JSON');
    });
  });

  describe('handleXwwwFormUrlencoded', () => {
    test('should parse form-urlencoded data correctly', () => {
      // Arrange
      const body = 'name=Test+User&email=test%40example.com';

      // Act
      const result = handleXwwwFormUrlencoded(body);

      // Assert
      expect(result).toEqual({ name: 'Test User', email: 'test@example.com' });
    });

    test('should handle empty form data', () => {
      // Act
      const result = handleXwwwFormUrlencoded('');

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('parseKeyValuePairs', () => {
    test('should parse key-value pairs correctly', () => {
      // Arrange
      const data = 'key1=value1&key2=value2&key3=value3';

      // Act
      const result = parseKeyValuePairs(data, '&', '=');

      // Assert
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });

    test('should handle URL-encoded values', () => {
      // Arrange
      const data = 'key1=value%201&key2=value%40two';

      // Act
      const result = parseKeyValuePairs(data, '&', '=');

      // Assert
      expect(result).toEqual({
        key1: 'value 1',
        key2: 'value@two',
      });
    });

    test('should handle plus signs in values', () => {
      // Arrange
      const data = 'key1=value+one&key2=value+two';

      // Act
      const result = parseKeyValuePairs(data, '&', '=');

      // Assert
      expect(result).toEqual({
        key1: 'value one',
        key2: 'value two',
      });
    });
  });

  describe('handleMultipartFormData', () => {
    test('should parse multipart form data correctly', () => {
      // Arrange
      const boundary = 'X-BOUNDARY';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"',
        '',
        'Test User',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"',
        '',
        'test@example.com',
        `--${boundary}--`,
      ].join('\r\n');

      // Act
      const result = handleMultipartFormData(body);
      if (!isMultipartFormData(result)) throw new Error('Result is not a multipart form data object');

      // Assert
      expect(result).toHaveProperty('fields');
      expect(result).toHaveProperty('files');
      expect(result.fields).toEqual({ name: 'Test User', email: 'test@example.com' });
      expect(result.files).toEqual({});
    });

    test('should handle file uploads in multipart form data', () => {
      // Arrange
      const boundary = 'X-BOUNDARY';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'File content here',
        `--${boundary}--`,
      ].join('\r\n');

      // Act
      const result = handleMultipartFormData(body);
      if (!isMultipartFormData(result)) throw new Error('Result is not a multipart form data object');

      // Assert
      expect(result.files).toHaveProperty('file');
      expect(result.files.file).toHaveProperty('filename', 'test.txt');
      expect(result.files.file).toHaveProperty('contentType', 'text/plain');
      expect(result.files.file).toHaveProperty('content', 'File content here');
    });

    test('should throw error for missing boundary', () => {
      // Arrange
      const body = 'Content-Disposition: form-data; name="name"\r\n\r\nTest User';

      // Act & Assert
      expect(() => handleMultipartFormData(body)).toThrow('Invalid multipart form data: missing boundary');
    });
  });

  describe('splitMultipartSection', () => {
    test('should split headers and content correctly', () => {
      // Arrange
      const section = 'Content-Disposition: form-data; name="field1"\r\n\r\nValue1';

      // Act
      const [headers, content] = splitMultipartSection(section);

      // Assert
      expect(headers).toBe('Content-Disposition: form-data; name="field1"');
      expect(content).toBe('Value1');
    });

    test('should handle sections with leading newlines', () => {
      // Arrange
      const section = '\r\nContent-Disposition: form-data; name="field1"\r\n\r\nValue1';

      // Act
      const [headers, content] = splitMultipartSection(section);

      // Assert
      expect(headers).toBe('Content-Disposition: form-data; name="field1"');
      expect(content).toBe('Value1');
    });
  });

  describe('parseContentDisposition', () => {
    test('should parse name correctly', () => {
      // Arrange
      const header = 'Content-Disposition: form-data; name="fieldName"';

      // Act
      const result = parseContentDisposition(header);

      // Assert
      expect(result.name).toBe('fieldName');
      expect(result.filename).toBeUndefined();
    });

    test('should parse name and filename correctly', () => {
      // Arrange
      const header = 'Content-Disposition: form-data; name="fieldName"; filename="file.txt"';

      // Act
      const result = parseContentDisposition(header);

      // Assert
      expect(result.name).toBe('fieldName');
      expect(result.filename).toBe('file.txt');
    });
  });

  describe('extractContentType', () => {
    test('should extract content type correctly', () => {
      // Arrange
      const headers = 'Content-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain';

      // Act
      const result = extractContentType(headers);

      // Assert
      expect(result).toBe('text/plain');
    });

    test('should return undefined for missing content type', () => {
      // Arrange
      const headers = 'Content-Disposition: form-data; name="field1"';

      // Act
      const result = extractContentType(headers);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('handleXml', () => {
    test('should parse simple XML correctly', () => {
      // Arrange
      const body = '<root><n>Test User</n><email>test@example.com</email></root>';

      // Act
      const result = handleXml(body) as Record<string, string>;

      // Assert
      expect(result).toEqual({
        n: 'Test User',
        email: 'test@example.com',
      });
    });

    test('should throw error for invalid XML', () => {
      // Arrange
      const body = '<root><name>Test User</name><email>test@example.com</email>';

      // Act & Assert
      expect(() => handleXml(body)).toThrow('Invalid XML');
    });
  });

  describe('parseXmlElements', () => {
    test('should parse XML elements correctly', () => {
      // Arrange
      const content = '<n>Test User</n><email>test@example.com</email>';

      // Act
      const result = parseXmlElements(content) as Record<string, string>;

      // Assert
      expect(result).toEqual({
        n: 'Test User',
        email: 'test@example.com',
      });
    });

    test('should handle nested elements', () => {
      // Arrange
      const content = '<user><n>Test User</n><contact><email>test@example.com</email></contact></user>';

      // Act
      const result = parseXmlElements(content);

      // Assert
      expect(result).toEqual({
        user: {
          n: 'Test User',
          contact: {
            email: 'test@example.com',
          },
        },
      });
    });
  });

  describe('handlePlainText', () => {
    test('should wrap plain text in content property', () => {
      // Arrange
      const body = 'Hello, world!';

      // Act
      const result = handlePlainText(body);

      // Assert
      expect(result).toEqual({ content: 'Hello, world!' });
    });
  });

  describe('handleUrlEncodedJson', () => {
    test('should parse URL-encoded JSON correctly', () => {
      // Arrange
      const body = `user=${encodeURIComponent(JSON.stringify({ name: 'Test User', email: 'test@example.com' }))}`;

      // Act
      const result = handleUrlEncodedJson(body) as Record<string, string>;

      // Assert
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({ name: 'Test User', email: 'test@example.com' });
    });

    test('should handle non-JSON values', () => {
      // Arrange
      const body = 'name=Test+User&email=test%40example.com';

      // Act
      const result = handleUrlEncodedJson(body) as Record<string, string>;

      // Assert
      expect(result).toEqual({ name: 'Test User', email: 'test@example.com' });
    });
  });

  describe('handleCsv', () => {
    test('should parse CSV correctly', () => {
      // Arrange
      const body = 'name,email\nTest User,test@example.com\nAnother User,another@example.com';

      // Act
      const result = handleCsv(body);
      if (!isCsvData(result)) throw new Error('Result is not a CSV object');

      // Assert
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
      expect(result.headers).toEqual(['name', 'email']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual(['Test User', 'test@example.com']);
      expect(result.rows[1]).toEqual(['Another User', 'another@example.com']);
    });

    test('should handle empty CSV', () => {
      // Arrange
      const body = '';

      // Act
      const result = handleCsv(body);
      if (!isCsvData(result)) throw new Error('Result is not a CSV object');

      // Assert
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });

  describe('parseCsvLine', () => {
    test('should parse CSV line correctly', () => {
      // Arrange
      const line = 'value1,value2,value3';

      // Act
      const result = parseCsvLine(line);

      // Assert
      expect(result).toEqual(['value1', 'value2', 'value3']);
    });

    test('should handle quoted values', () => {
      // Arrange
      const line = 'value1,"value, with comma",value3';

      // Act
      const result = parseCsvLine(line);

      // Assert
      expect(result).toEqual(['value1', 'value, with comma', 'value3']);
    });

    test('should handle escaped quotes', () => {
      // Arrange
      const line = 'value1,"value with ""quoted"" text",value3';

      // Act
      const result = parseCsvLine(line);

      // Assert
      expect(result).toEqual(['value1', 'value with "quoted" text', 'value3']);
    });
  });

  describe('handleYaml', () => {
    test('should parse simple YAML correctly', () => {
      // Arrange
      const body = 'name: Test User\nemail: test@example.com';

      // Act
      const result = handleYaml(body);

      // Assert
      expect(result).toEqual({
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    test('should handle nested YAML', () => {
      // Arrange
      const body = 'user:\n  name: Test User\n  contact:\n    email: test@example.com';

      // Act
      const result = handleYaml(body);

      // Verify it's YAML data
      expect(isYamlData(result)).toBe(true);

      // Type assertion for TypeScript
      const yamlResult = result;
      if (!isYamlData(yamlResult)) throw new Error('Result is not a YAML object');

      // Assert
      expect(yamlResult).toHaveProperty('user');
      expect(yamlResult).toHaveProperty('user');
      expect(yamlResult.user).toHaveProperty('name', 'Test User');
      expect(yamlResult.user).toHaveProperty('contact');
      // @ts-expect-error - This is a test
      expect(yamlResult.user.contact).toHaveProperty('email', 'test@example.com');
    });

    test('should parse string values correctly', () => {
      expect(parseYamlValue('simple string')).toBe('simple string');
      expect(parseYamlValue('"quoted string"')).toBe('quoted string');
      expect(parseYamlValue("'single quoted'")).toBe('single quoted');
    });

    test('should parse numeric values correctly', () => {
      expect(parseYamlValue('123')).toBe(123);
      expect(parseYamlValue('-456')).toBe(-456);
      expect(parseYamlValue('3.14')).toBe(3.14);
    });

    test('should parse boolean values correctly', () => {
      expect(parseYamlValue('true')).toBe(true);
      expect(parseYamlValue('false')).toBe(false);
      expect(parseYamlValue('TRUE')).toBe(true);
      expect(parseYamlValue('FALSE')).toBe(false);
    });

    test('should parse null values correctly', () => {
      expect(parseYamlValue('null')).toBe(null);
      expect(parseYamlValue('~')).toBe(null);
      expect(parseYamlValue('')).toBe(null);
    });
  });
});
