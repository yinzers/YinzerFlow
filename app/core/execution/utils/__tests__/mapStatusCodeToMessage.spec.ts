import { describe, expect, it } from 'bun:test';
import { isValidStatusCode, mapStatusCodeToMessage } from '../mapStatusCodeToMessage.ts';
import { httpStatusCode } from '@constants/http.ts';

describe('mapStatusCodeToMessage', () => {
  it('should map all defined status codes from constants', () => {
    // Test all status codes defined in httpStatusCode - this covers all valid mappings
    for (const [_, code] of Object.entries(httpStatusCode)) {
      expect(() => mapStatusCodeToMessage(code)).not.toThrow();

      const message = mapStatusCodeToMessage(code);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('should throw error for unsupported status codes', () => {
    expect(() => mapStatusCodeToMessage(100 as any)).toThrow('Unknown status code: 100');
    expect(() => mapStatusCodeToMessage(418 as any)).toThrow('Unknown status code: 418');
    expect(() => mapStatusCodeToMessage(999 as any)).toThrow('Unknown status code: 999');
  });

  it('should provide clear error messages', () => {
    const statusCode = 123;
    expect(() => mapStatusCodeToMessage(statusCode as any)).toThrow(`Unknown status code: ${statusCode}`);
  });
});

describe('isValidStatusCode', () => {
  it('should return true for all defined status codes', () => {
    for (const code of Object.values(httpStatusCode)) {
      expect(isValidStatusCode(code)).toBe(true);
    }
  });

  it('should return false for undefined status codes', () => {
    expect(isValidStatusCode(100)).toBe(false);
    expect(isValidStatusCode(418)).toBe(false);
    expect(isValidStatusCode(999)).toBe(false);
    expect(isValidStatusCode(0)).toBe(false);
    expect(isValidStatusCode(-1)).toBe(false);
  });

  it('should work as type guard', () => {
    const statusCode = 200;

    if (isValidStatusCode(statusCode)) {
      const message = mapStatusCodeToMessage(statusCode);
      expect(message).toBe('OK');
    }
  });
});
