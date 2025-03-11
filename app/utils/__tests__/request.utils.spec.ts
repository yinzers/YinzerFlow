import { describe, expect, test } from 'bun:test';
import {
  handleApplicationJson,
  handleCsv,
  handlePlainText,
  handleXml,
  handleXwwwFormUrlencoded,
  handleYaml,
  parseCsvLine,
  parseKeyValuePairs,
  parseXmlElements,
  parseYamlValue,
} from '../request.utils.ts';

describe('request.utils', () => {
  describe('handleApplicationJson', () => {
    test('should parse valid JSON', () => {
      const json = '{"name":"John","age":30}';
      const result = handleApplicationJson(json);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    test('should throw error for invalid JSON', () => {
      const json = '{"name":"John",age:30}';
      expect(() => handleApplicationJson(json)).toThrow('Invalid JSON');
    });
  });

  describe('handleXwwwFormUrlencoded', () => {
    test('should parse form data', () => {
      const formData = 'name=John&age=30&city=New%20York';
      const result = handleXwwwFormUrlencoded(formData);
      expect(result).toEqual({ name: 'John', age: '30', city: 'New York' });
    });

    test('should handle empty form data', () => {
      const formData = '';
      const result = handleXwwwFormUrlencoded(formData);
      expect(result).toEqual({});
    });
  });

  describe('parseKeyValuePairs', () => {
    test('should parse key-value pairs with custom separators', () => {
      const data = 'name:John;age:30;city:New York';
      const result = parseKeyValuePairs(data, ';', ':');
      expect(result).toEqual({ name: 'John', age: '30', city: 'New York' });
    });

    test('should handle URL-encoded values', () => {
      const data = 'name=John&city=New%20York';
      const result = parseKeyValuePairs(data, '&', '=');
      expect(result).toEqual({ name: 'John', city: 'New York' });
    });

    test('should handle empty values', () => {
      const data = 'name=John&age=&city=New%20York';
      const result = parseKeyValuePairs(data, '&', '=');
      expect(result).toEqual({ name: 'John', age: '', city: 'New York' });
    });

    test('should handle keys without values', () => {
      const data = 'name=John&subscribe&city=New%20York';
      const result = parseKeyValuePairs(data, '&', '=');
      expect(result).toEqual({ name: 'John', subscribe: '', city: 'New York' });
    });
  });

  describe('handlePlainText', () => {
    test('should wrap plain text in an object', () => {
      const text = 'Hello, world!';
      const result = handlePlainText(text);
      expect(result).toEqual({ content: 'Hello, world!' });
    });

    test('should handle empty text', () => {
      const text = '';
      const result = handlePlainText(text);
      expect(result).toEqual({ content: '' });
    });
  });

  describe('handleXml', () => {
    test('should parse simple XML', () => {
      const xml = '<user><name>John</name><age>30</age></user>';
      const result = handleXml(xml);
      expect(result).toEqual({ name: 'John', age: '30' });
    });

    test('should parse nested XML', () => {
      const xml = '<user><name>John</name><address><city>New York</city><zip>10001</zip></address></user>';
      const result = handleXml(xml);
      expect(result).toEqual({
        name: 'John',
        address: {
          city: 'New York',
          zip: '10001',
        },
      });
    });
  });

  describe('parseXmlElements', () => {
    test('should parse XML elements', () => {
      const content = '<name>John</name><age>30</age>';
      const result = parseXmlElements(content);
      expect(result).toEqual({ name: 'John', age: '30' });
    });

    test('should handle XML with nested elements', () => {
      const content = '<name>John</name><address><city>New York</city><zip>10001</zip></address>';
      const result = parseXmlElements(content);
      expect(result).toEqual({
        name: 'John',
        address: {
          city: 'New York',
          zip: '10001',
        },
      });
    });
  });

  describe('handleCsv', () => {
    test('should parse CSV data', () => {
      const csv = 'name,age,city\nJohn,30,New York\nJane,25,Boston';
      const result = handleCsv(csv) as { headers: Array<string>; rows: Array<Array<string>> };

      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual(['John', '30', 'New York']);
    });

    test('should handle CSV with quoted values', () => {
      const csv = 'name,description\nJohn,"Developer, Senior"\nJane,"Manager, HR"';
      const result = handleCsv(csv) as { headers: Array<string>; rows: Array<Array<string>> };

      expect(result.headers).toEqual(['name', 'description']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual(['John', 'Developer, Senior']);
    });

    test('should handle empty CSV', () => {
      const csv = '';
      const result = handleCsv(csv) as { headers: Array<string>; rows: Array<Array<string>> };
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });

  describe('parseCsvLine', () => {
    test('should parse simple CSV line', () => {
      const line = 'John,30,New York';
      const result = parseCsvLine(line);
      expect(result).toEqual(['John', '30', 'New York']);
    });

    test('should handle quoted values', () => {
      const line = 'John,"Developer, Senior",New York';
      const result = parseCsvLine(line);
      expect(result).toEqual(['John', 'Developer, Senior', 'New York']);
    });

    test('should handle empty fields', () => {
      const line = 'John,,New York';
      const result = parseCsvLine(line);
      expect(result).toEqual(['John', '', 'New York']);
    });

    test('should handle quoted empty fields', () => {
      const line = 'John,"",New York';
      const result = parseCsvLine(line);
      expect(result).toEqual(['John', '', 'New York']);
    });
  });

  describe('handleYaml', () => {
    test('should parse simple YAML', () => {
      const yaml = 'name: John\nage: 30\ncity: New York';
      const result = handleYaml(yaml);
      expect(result).toEqual({ name: 'John', age: 30, city: 'New York' });
    });

    test('should parse nested YAML', () => {
      const yaml = 'name: John\naddress:\n  city: New York\n  zip: 10001';
      const result = handleYaml(yaml);
      expect(result).toEqual({
        name: 'John',
        address: {
          city: 'New York',
          zip: 10001,
        },
      });
    });

    test('should handle YAML with list notation (not fully implemented)', () => {
      const yaml = 'users:\n  - name: John\n    age: 30\n  - name: Jane\n    age: 25';
      const result = handleYaml(yaml);
      expect(result).toHaveProperty('users');
    });
  });

  describe('parseYamlValue', () => {
    test('should parse string value', () => {
      const value = 'John';
      const result = parseYamlValue(value);
      expect(result).toBe('John');
    });

    test('should parse number value', () => {
      const value = '30';
      const result = parseYamlValue(value);
      expect(result).toBe(30);
    });

    test('should parse boolean value', () => {
      const value = 'true';
      const result = parseYamlValue(value);
      expect(result).toBe(true);
    });

    test('should parse null value', () => {
      const value = 'null';
      const result = parseYamlValue(value);
      expect(result).toBe(null);
    });

    test('should handle quoted strings', () => {
      const value = '"John Doe"';
      const result = parseYamlValue(value);
      expect(result).toBe('John Doe');
    });
  });
});
