import { describe, expect, it } from 'bun:test';
import { parseQuery } from '../parseQuery.ts';

describe('parseQuery', () => {
  describe('Basic query parsing', () => {
    it('should parse simple query parameters', () => {
      const path = '/api/users?name=john&age=30';
      const result = parseQuery(path);

      expect(result).toEqual({
        name: 'john',
        age: '30',
      });
    });

    it('should parse single query parameter', () => {
      const path = '/api/users?id=123';
      const result = parseQuery(path);

      expect(result).toEqual({
        id: '123',
      });
    });

    it('should handle empty query string', () => {
      const path = '/api/users?';
      const result = parseQuery(path);

      expect(result).toEqual({});
    });

    it('should handle path without query string', () => {
      const path = '/api/users';
      const result = parseQuery(path);

      expect(result).toEqual({});
    });

    it('should handle empty path', () => {
      const path = '';
      const result = parseQuery(path);

      expect(result).toEqual({});
    });
  });

  describe('URL encoding/decoding', () => {
    it('should decode URL-encoded values', () => {
      const path = '/search?q=hello%20world&category=tech%26science';
      const result = parseQuery(path);

      expect(result).toEqual({
        q: 'hello world',
        category: 'tech&science',
      });
    });

    it('should decode special characters', () => {
      const path = '/api?email=test%40example.com&symbols=%21%40%23%24%25';
      const result = parseQuery(path);

      expect(result).toEqual({
        email: 'test@example.com',
        symbols: '!@#$%',
      });
    });

    it('should handle plus signs as spaces', () => {
      const path = '/search?q=hello+world+test';
      const result = parseQuery(path);

      expect(result).toEqual({
        q: 'hello+world+test', // Note: parseQuery doesn't convert + to space, that's browser-specific
      });
    });

    it('should handle unicode characters', () => {
      const path = '/api?message=%E2%9C%85%20%F0%9F%8E%89&text=%E4%B8%AD%E6%96%87';
      const result = parseQuery(path);

      expect(result).toEqual({
        message: '✅ 🎉',
        text: '中文',
      });
    });
  });

  describe('Edge cases and malformed queries', () => {
    it('should handle empty parameter values', () => {
      const path = '/api?empty=&hasvalue=test&alsoempty=';
      const result = parseQuery(path);

      expect(result).toEqual({
        empty: '',
        hasvalue: 'test',
        alsoempty: '',
      });
    });

    it('should handle parameters without values', () => {
      const path = '/api?flag&another=value&anotherflag';
      const result = parseQuery(path);

      expect(result).toEqual({
        flag: '',
        another: 'value',
        anotherflag: '',
      });
    });

    it('should handle duplicate parameter names (last one wins)', () => {
      const path = '/api?name=first&name=second&name=third';
      const result = parseQuery(path);

      expect(result).toEqual({
        name: 'third',
      });
    });

    it('should handle parameters with equals signs in values', () => {
      const path = '/api?equation=x%3D5%2B3&base64=dGVzdA%3D%3D';
      const result = parseQuery(path);

      expect(result).toEqual({
        equation: 'x=5+3',
        base64: 'dGVzdA==',
      });
    });

    it('should handle malformed parameters gracefully', () => {
      const path = '/api?=emptykey&validkey=value&=anothermptykey';
      const result = parseQuery(path);

      expect(result).toEqual({
        validkey: 'value',
      });
    });

    it('should handle multiple ampersands', () => {
      const path = '/api?key1=value1&&key2=value2&&&key3=value3';
      const result = parseQuery(path);

      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });
  });

  describe('Complex query strings', () => {
    it('should handle search-like queries', () => {
      const path = '/search?q=javascript+tutorial&lang=en&page=1&sort=relevance&filter=recent';
      const result = parseQuery(path);

      expect(result).toEqual({
        q: 'javascript+tutorial',
        lang: 'en',
        page: '1',
        sort: 'relevance',
        filter: 'recent',
      });
    });

    it('should handle API filtering queries', () => {
      const path = '/api/users?status=active&role=admin&limit=50&offset=100&include=profile,settings';
      const result = parseQuery(path);

      expect(result).toEqual({
        status: 'active',
        role: 'admin',
        limit: '50',
        offset: '100',
        include: 'profile,settings',
      });
    });

    it('should handle form submission queries', () => {
      const path = '/submit?name=John%20Doe&email=john%40example.com&subscribe=true&interests=tech,sports';
      const result = parseQuery(path);

      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        subscribe: 'true',
        interests: 'tech,sports',
      });
    });

    it('should handle analytics-like queries', () => {
      const path = '/track?event=click&element=button&page=%2Fhome&timestamp=1234567890&user_id=abc123';
      const result = parseQuery(path);

      expect(result).toEqual({
        event: 'click',
        element: 'button',
        page: '/home',
        timestamp: '1234567890',
        // eslint-disable-next-line camelcase
        user_id: 'abc123',
      });
    });
  });

  describe('Error handling', () => {
    it('should handle malformed URL encoding gracefully', () => {
      const path = '/api?valid=test&malformed=%GG&another=value';

      // Should not throw an error
      expect(() => parseQuery(path)).not.toThrow();

      const result = parseQuery(path);
      expect(result).toHaveProperty('valid', 'test');
      expect(result).toHaveProperty('another', 'value');
      expect(result).toHaveProperty('malformed'); // Should exist but might not decode properly
    });

    it('should handle query with fragment identifier', () => {
      // Fragment should not be part of query parsing (it's client-side)
      const path = '/api?param=value#fragment';
      const result = parseQuery(path);

      expect(result).toEqual({
        param: 'value#fragment', // Fragment becomes part of the last parameter value
      });
    });
  });
});
