import { describe, expect, it } from 'bun:test';
import { RequestParser } from 'core/RequestParser.ts';

describe('RequestParser.parseQuery', () => {
  const parser = new RequestParser();

  it('should parse query parameters correctly', () => {
    const path = '/users?name=John&age=30';

    const result = parser.parseQuery(path);

    expect(result).toEqual({
      name: 'John',
      age: '30',
    });
  });

  it('should return an empty object for paths without query parameters', () => {
    const path = '/users';

    const result = parser.parseQuery(path);

    expect(result).toEqual({});
  });

  it('should handle query parameters with no value', () => {
    const path = '/users?name=&age=30';

    const result = parser.parseQuery(path);

    expect(result).toEqual({
      name: '',
      age: '30',
    });
  });

  it('should handle query parameters without values', () => {
    const path = '/users?name&age=30';

    const result = parser.parseQuery(path);

    expect(result).toEqual({
      name: '',
      age: '30',
    });
  });

  it('should handle special characters in query parameters', () => {
    const path = '/users?name=John%20Doe&email=john%40example.com';

    const result = parser.parseQuery(path);

    expect(result).toEqual({
      name: 'John%20Doe',
      email: 'john%40example.com',
    });
  });

  it('should handle multiple values for the same parameter (last one wins)', () => {
    const path = '/users?name=John&name=Jane';

    const result = parser.parseQuery(path);

    expect(result).toEqual({
      name: 'Jane',
    });
  });
});
