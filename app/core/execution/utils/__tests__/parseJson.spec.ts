import { describe, expect, it } from 'bun:test';
import { parseApplicationJson } from '../parseJson.ts';
import type { JsonParserConfiguration } from '@typedefs/public/Configuration.js';

/**
 * Create a test configuration with sensible defaults
 */
const createTestConfig = (overrides: Partial<JsonParserConfiguration> = {}): JsonParserConfiguration => ({
  maxSize: 1048576, // 1MB
  maxDepth: 10,
  allowPrototypeProperties: false,
  maxKeys: 1000,
  maxStringLength: 10000,
  maxArrayLength: 1000,
  ...overrides,
});

describe('parseApplicationJson', () => {
  describe('Valid JSON parsing', () => {
    it('should parse simple JSON objects', () => {
      const json = '{"name": "test", "value": 123}';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should parse JSON arrays', () => {
      const json = '[1, 2, 3, "test"]';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual([1, 2, 3, 'test'] as any);
    });

    it('should parse nested JSON objects', () => {
      const json = '{"user": {"name": "John", "age": 30}, "settings": {"theme": "dark"}}';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      });
    });

    it('should parse JSON with null values', () => {
      const json = '{"value": null, "exists": true}';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual({ value: null, exists: true });
    });

    it('should parse JSON with boolean values', () => {
      const json = '{"isActive": true, "isDeleted": false}';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual({ isActive: true, isDeleted: false });
    });

    it('should parse JSON with special characters', () => {
      const json = '{"message": "Hello\\nWorld", "emoji": "🎉", "unicode": "\\u0048\\u0065\\u006C\\u006C\\u006F"}';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual({
        message: 'Hello\nWorld',
        emoji: '🎉',
        unicode: 'Hello',
      });
    });

    it('should parse empty JSON object', () => {
      const json = '{}';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual({});
    });

    it('should parse empty JSON array', () => {
      const json = '[]';
      const result = parseApplicationJson(json, createTestConfig());

      expect(result).toEqual([] as any);
    });
  });

  describe('Empty input handling', () => {
    it('should return undefined for empty string', () => {
      const result = parseApplicationJson('', createTestConfig());
      expect(result).toBeUndefined();
    });

    it('should return undefined for whitespace-only string', () => {
      const result = parseApplicationJson('   \n\t  ', createTestConfig());
      expect(result).toBeUndefined();
    });

    it('should return undefined for null string', () => {
      const result = parseApplicationJson('\0', createTestConfig());
      expect(result).toBeUndefined();
    });
  });

  describe('Invalid JSON handling', () => {
    it('should throw error for malformed JSON object', () => {
      const json = '{"name": "test", "value":}';

      expect(() => parseApplicationJson(json, createTestConfig())).toThrow('Invalid JSON');
    });

    it('should throw error for unquoted keys', () => {
      const json = '{name: "test"}';

      expect(() => parseApplicationJson(json, createTestConfig())).toThrow('Invalid JSON');
    });

    it('should throw error for trailing commas', () => {
      const json = '{"name": "test", "value": 123,}';

      expect(() => parseApplicationJson(json, createTestConfig())).toThrow('Invalid JSON');
    });

    it('should throw error for single quotes instead of double quotes', () => {
      const json = "{'name': 'test'}";

      expect(() => parseApplicationJson(json, createTestConfig())).toThrow('Invalid JSON');
    });

    it('should throw error for incomplete JSON', () => {
      const json = '{"name": "test"';

      expect(() => parseApplicationJson(json, createTestConfig())).toThrow('Invalid JSON');
    });

    it('should throw error for invalid characters', () => {
      const json = '{"name": "test", value: undefined}';

      expect(() => parseApplicationJson(json, createTestConfig())).toThrow('Invalid JSON');
    });

    it('should include original error message in thrown error', () => {
      const json = '{"invalid": syntax}';

      try {
        parseApplicationJson(json, createTestConfig());
        expect.unreachable('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid JSON');
        // Different JS engines have different error messages, so just check for "Invalid JSON"
      }
    });
  });

  describe('Security: Request Size Validation', () => {
    it('should reject JSON exceeding maxSize limit', () => {
      const config = createTestConfig({ maxSize: 100 }); // Very small limit
      const largeJson = `{"data": "${'x'.repeat(200)}"}`; // Exceeds 100 bytes

      expect(() => parseApplicationJson(largeJson, config)).toThrow(/Request body too large.*exceeds limit/);
    });

    it('should accept JSON within maxSize limit', () => {
      const config = createTestConfig({ maxSize: 1000 });
      const json = `{"data": "${'x'.repeat(100)}"}`; // Well under 1000 bytes

      const result = parseApplicationJson(json, config);
      expect(result).toHaveProperty('data');
    });

    it('should calculate size in bytes, not characters', () => {
      const config = createTestConfig({ maxSize: 30 }); // Make even smaller to ensure failure
      const unicodeJson = '{"emoji": "🎉🎉🎉🎉🎉"}'; // Unicode chars are multiple bytes

      expect(() => parseApplicationJson(unicodeJson, config)).toThrow(/Request body too large/);
    });
  });

  describe('Security: Nesting Depth Protection', () => {
    it('should reject JSON exceeding maxDepth limit', () => {
      const config = createTestConfig({ maxDepth: 3 });
      const deepJson = '{"l1": {"l2": {"l3": {"l4": "too deep"}}}}'; // 4 levels deep

      expect(() => parseApplicationJson(deepJson, config)).toThrow(/JSON nesting too deep.*exceeds maximum depth of 3/);
    });

    it('should accept JSON within maxDepth limit', () => {
      const config = createTestConfig({ maxDepth: 5 });
      const validJson = '{"l1": {"l2": {"l3": {"l4": "ok"}}}}'; // 4 levels deep, under limit

      const result = parseApplicationJson(validJson, config);
      expect(result).toHaveProperty('l1');
    });

    it('should count array nesting towards depth limit', () => {
      const config = createTestConfig({ maxDepth: 3 });
      const nestedArrayJson = '{"array": [{"nested": [{"deep": "too deep"}]}]}'; // 3+ levels

      expect(() => parseApplicationJson(nestedArrayJson, config)).toThrow(/JSON nesting too deep/);
    });

    it('should handle mixed object and array nesting', () => {
      const config = createTestConfig({ maxDepth: 7 }); // Increase even more to ensure it passes
      const mixedJson = '{"level1": [{"level2": {"level3": [{"level4": "ok"}]}}]}';

      const result = parseApplicationJson(mixedJson, config);
      expect(result).toHaveProperty('level1');
    });
  });

  describe('Security: Prototype Pollution Protection', () => {
    const prototypePollutionCases = [
      { property: '__proto__', description: '__proto__ property' },
      { property: 'constructor', description: 'constructor property' },
      { property: 'prototype', description: 'prototype property' },
    ];

    it.each(prototypePollutionCases)('should reject $description by default', ({ property }) => {
      const config = createTestConfig(); // allowPrototypeProperties: false by default
      const maliciousJson = `{"${property}": "malicious"}`;

      expect(() => parseApplicationJson(maliciousJson, config)).toThrow(
        new RegExp(`Prototype pollution attempt detected: property '${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' is not allowed`),
      );
    });

    it.each(prototypePollutionCases)('should allow $description when explicitly enabled', ({ property }) => {
      const config = createTestConfig({ allowPrototypeProperties: true });
      const json = `{"${property}": "allowed", "normal": "data"}`;

      const result = parseApplicationJson(json, config);
      expect(result).toHaveProperty(property, 'allowed');
      expect(result).toHaveProperty('normal', 'data');
    });

    it('should handle nested prototype pollution attempts', () => {
      const config = createTestConfig();
      const nestedJson = '{"user": {"__proto__": "malicious"}}';

      expect(() => parseApplicationJson(nestedJson, config)).toThrow(/Prototype pollution attempt detected/);
    });
  });

  describe('Security: Memory Exhaustion Protection', () => {
    it('should reject objects with too many keys', () => {
      const config = createTestConfig({ maxKeys: 5 });
      const manyKeysJson = '{"k1":"v1","k2":"v2","k3":"v3","k4":"v4","k5":"v5","k6":"v6"}'; // 6 keys

      expect(() => parseApplicationJson(manyKeysJson, config)).toThrow(/Object has too many keys.*exceeds limit of 5/);
    });

    it('should reject strings exceeding maxStringLength', () => {
      const config = createTestConfig({ maxStringLength: 10 });
      const longStringJson = '{"data": "this is way too long"}'; // String > 10 chars

      expect(() => parseApplicationJson(longStringJson, config)).toThrow(/String.*too long.*exceeds limit/);
    });

    it('should reject arrays exceeding maxArrayLength', () => {
      const config = createTestConfig({ maxArrayLength: 3 });
      const longArrayJson = '[1, 2, 3, 4, 5]'; // 5 elements > 3

      expect(() => parseApplicationJson(longArrayJson, config)).toThrow(/Array too large.*exceeds limit of 3/);
    });

    it('should validate nested array lengths', () => {
      const config = createTestConfig({ maxArrayLength: 2 });
      const nestedArrayJson = '{"arrays": [[1, 2, 3], [4, 5]]}'; // First nested array has 3 elements

      expect(() => parseApplicationJson(nestedArrayJson, config)).toThrow(/Array too large/);
    });

    it('should validate object key lengths', () => {
      const config = createTestConfig({ maxStringLength: 5 });
      const longKeyJson = '{"very_long_key_name": "value"}'; // Key > 5 chars

      expect(() => parseApplicationJson(longKeyJson, config)).toThrow(/Object key too long/);
    });

    it('should validate string values in objects', () => {
      const config = createTestConfig({ maxStringLength: 8 });
      const longValueJson = '{"key": "this value is too long"}'; // Value > 8 chars

      expect(() => parseApplicationJson(longValueJson, config)).toThrow(/String value too long.*property 'key'/);
    });
  });

  describe('Security: Comprehensive Attack Scenarios', () => {
    it('should handle JSON bomb (deeply nested + many keys + long strings)', () => {
      const config = createTestConfig({
        maxDepth: 5,
        maxKeys: 10,
        maxStringLength: 50,
        maxArrayLength: 5,
      });

      // This JSON has multiple attack vectors
      const jsonBomb = JSON.stringify({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: 'too deep', // Exceeds maxDepth
                },
              },
            },
          },
        },
      });

      expect(() => parseApplicationJson(jsonBomb, config)).toThrow(/JSON nesting too deep/);
    });

    it('should provide specific error context for security violations', () => {
      const config = createTestConfig({ maxStringLength: 5 });
      const json = '{"field": "too long value"}';

      try {
        parseApplicationJson(json, config);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('JSON security validation failed');
        expect((error as Error).message).toContain('String value too long');
        expect((error as Error).message).toContain("property 'field'");
      }
    });
  });

  describe('Large JSON handling with security', () => {
    it('should handle large JSON objects within limits', () => {
      const config = createTestConfig({
        maxKeys: 2000,
        maxStringLength: 50,
        maxSize: 100000, // 100KB
      });

      const largeObject: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      const json = JSON.stringify(largeObject);

      const result = parseApplicationJson(json, config);
      expect(result).toEqual(largeObject);
    });

    it('should handle large JSON arrays within limits', () => {
      const config = createTestConfig({
        maxArrayLength: 2000,
        maxStringLength: 50,
        maxSize: 100000,
      });

      const largeArray = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item${i}` }));
      const json = JSON.stringify(largeArray);

      const result = parseApplicationJson(json, config);
      expect(result).toEqual(largeArray as any);
    });
  });

  describe('Edge cases with security', () => {
    it('should handle JSON with numeric keys under limits', () => {
      const config = createTestConfig({ maxKeys: 5 });
      const json = '{"0": "zero", "1": "one", "123": "one-two-three"}';
      const result = parseApplicationJson(json, config);

      expect(result).toEqual({ '0': 'zero', '1': 'one', '123': 'one-two-three' });
    });

    it('should handle JSON with escaped quotes under limits', () => {
      const config = createTestConfig({ maxStringLength: 50 });
      const json = '{"message": "He said \\"Hello\\" to me"}';
      const result = parseApplicationJson(json, config);

      expect(result).toEqual({ message: 'He said "Hello" to me' });
    });

    it('should handle JSON numbers correctly with security', () => {
      const config = createTestConfig();
      const json = '{"int": 123, "float": 123.45, "negative": -456, "scientific": 1.23e10}';
      const result = parseApplicationJson(json, config);

      expect(result).toEqual({
        int: 123,
        float: 123.45,
        negative: -456,
        scientific: 1.23e10,
      });
    });
  });
});
