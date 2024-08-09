import { describe, expect, it } from 'bun:test';
import calculateContentLength from 'utils/calculateContentLength.utils.ts';

describe('calculateContentLength', () => {
  it('should return the length of the body', () => {
    const body = 'Hello, world!';
    const result = calculateContentLength(body);
    expect(result).toBe(13);
  });
});
