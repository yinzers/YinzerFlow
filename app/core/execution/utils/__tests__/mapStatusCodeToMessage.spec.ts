import { describe, expect, it } from 'bun:test';
import { mapStatusCodeToMessage } from '../mapStatusCodeToMessage.ts';
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

  // Bug (0.10.x): every code outside a 16-entry table threw, so setStatusCode(503) answered 500.
  // Tier: High (validator). Only codes a status line can't carry throw now.
  it.each([
    [100, 'Continue'],
    [418, "I'm a teapot"],
    [503, 'Service Unavailable'],
    [199, 'Informational'],
    [299, 'Success'],
    [399, 'Redirection'],
    [499, 'Client Error'],
    [599, 'Server Error'],
  ])('should give %d the reason phrase %p', (statusCode, phrase) => {
    expect(mapStatusCodeToMessage(statusCode)).toBe(phrase);
  });

  it.each([[99], [600], [0], [-1], [200.5], [Number.NaN]])('should refuse %p with a clear error', (statusCode) => {
    expect(() => mapStatusCodeToMessage(statusCode)).toThrow('Status codes must be integers from 100 to 599');
  });
});
