import { describe, expect, it } from 'bun:test';
import divideStringUtils from 'utils/divideString.utils.ts';

describe('divideString', () => {
  it('should return a tuple of strings based on a search value', () => {
    const body = 'Hello, world!';
    const result = divideStringUtils(body, ',');
    expect(result).toEqual(['Hello', ' world!']);
    expect(result).toHaveLength(2);
  });
});
