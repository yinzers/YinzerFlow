import { describe, expect, it } from 'bun:test';
import { parseHttpRequest } from '../parseHttpRequest.ts';
import type { InternalHttpMethod } from '@typedefs/constants/http.js';

describe('parseHttpRequest', () => {
  describe('Basic HTTP request parsing', () => {
    it('should parse simple GET request', () => {
      const rawRequest = 'GET /api/users HTTP/1.1\r\nHost: example.com\r\nUser-Agent: test\r\n\r\nbody content';

      const result = parseHttpRequest(rawRequest);

      expect(result.method).toBe('GET');
      expect(result.path).toBe('/api/users');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headersRaw).toBe('Host: example.com\r\nUser-Agent: test');
      expect(result.rawBody).toBe('body content');
    });

    it('should parse POST request with JSON body', () => {
      const rawRequest = 'POST /api/users HTTP/1.1\r\nContent-Type: application/json\r\nContent-Length: 25\r\n\r\n{"name": "John", "age": 30}';

      const result = parseHttpRequest(rawRequest);

      expect(result.method).toBe('POST');
      expect(result.path).toBe('/api/users');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headersRaw).toBe('Content-Type: application/json\r\nContent-Length: 25');
      expect(result.rawBody).toBe('{"name": "John", "age": 30}');
    });

    it('should parse PUT request with query parameters', () => {
      const rawRequest = 'PUT /api/users/123?include=profile&fields=name,email HTTP/1.1\r\nAuthorization: Bearer token123\r\n\r\nupdate data';

      const result = parseHttpRequest(rawRequest);

      expect(result.method).toBe('PUT');
      expect(result.path).toBe('/api/users/123?include=profile&fields=name,email');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headersRaw).toBe('Authorization: Bearer token123');
      expect(result.rawBody).toBe('update data');
    });

    it('should parse DELETE request without body', () => {
      const rawRequest = 'DELETE /api/users/123 HTTP/1.1\r\nAuthorization: Bearer token123\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.method).toBe('DELETE');
      expect(result.path).toBe('/api/users/123');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headersRaw).toBe('Authorization: Bearer token123');
      expect(result.rawBody).toBe('');
    });
  });

  describe('HTTP methods', () => {
    it('should handle all standard HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as Array<InternalHttpMethod>;

      for (const method of methods) {
        const rawRequest = `${method} /test HTTP/1.1\r\nHost: example.com\r\n\r\n`;
        const result = parseHttpRequest(rawRequest);

        expect(result.method).toBe(method);
        expect(result.path).toBe('/test');
        expect(result.protocol).toBe('HTTP/1.1');
      }
    });
  });

  describe('Path variations', () => {
    it('should handle root path', () => {
      const rawRequest = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.path).toBe('/');
    });

    it('should handle paths with special characters', () => {
      const rawRequest = 'GET /api/users/test@example.com HTTP/1.1\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.path).toBe('/api/users/test@example.com');
    });

    it('should handle encoded paths', () => {
      const rawRequest = 'GET /api/users/john%20doe HTTP/1.1\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.path).toBe('/api/users/john%20doe');
    });

    it('should handle complex query strings', () => {
      const rawRequest = 'GET /search?q=test+query&limit=10&offset=0&sort=name&order=asc HTTP/1.1\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.path).toBe('/search?q=test+query&limit=10&offset=0&sort=name&order=asc');
    });
  });

  describe('HTTP versions', () => {
    it('should handle HTTP/1.0', () => {
      const rawRequest = 'GET /test HTTP/1.0\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.protocol).toBe('HTTP/1.0');
    });

    it('should handle HTTP/1.1', () => {
      const rawRequest = 'GET /test HTTP/1.1\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.protocol).toBe('HTTP/1.1');
    });

    it('should handle HTTP/2', () => {
      const rawRequest = 'GET /test HTTP/2\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.protocol).toBe('HTTP/2');
    });
  });

  describe('Headers handling', () => {
    it('should handle multiple headers', () => {
      const rawRequest = [
        'GET /test HTTP/1.1',
        'Host: example.com',
        'User-Agent: Mozilla/5.0',
        'Accept: application/json',
        'Authorization: Bearer token123',
        'Content-Type: application/json',
        '',
        'body',
      ].join('\r\n');

      const result = parseHttpRequest(rawRequest);

      expect(result.headersRaw).toBe(
        ['Host: example.com', 'User-Agent: Mozilla/5.0', 'Accept: application/json', 'Authorization: Bearer token123', 'Content-Type: application/json'].join(
          '\r\n',
        ),
      );
    });

    it('should handle request with no headers', () => {
      const rawRequest = 'GET /test HTTP/1.1\r\n\r\n\r\nbody';

      const result = parseHttpRequest(rawRequest);

      expect(result.headersRaw).toBe('');
      expect(result.rawBody).toBe('body');
    });

    it('should handle headers with extra whitespace', () => {
      const rawRequest = 'GET /test HTTP/1.1\r\nHost:   example.com   \r\nUser-Agent:test\r\n\r\nbody';

      const result = parseHttpRequest(rawRequest);

      expect(result.headersRaw).toBe('Host:   example.com   \r\nUser-Agent:test');
    });
  });

  describe('Body variations', () => {
    it('should handle empty body', () => {
      const rawRequest = 'GET /test HTTP/1.1\r\nHost: example.com\r\n\r\n';

      const result = parseHttpRequest(rawRequest);

      expect(result.rawBody).toBe('');
    });

    it('should handle basic body content', () => {
      const bodyContent = 'Some body content here';
      const rawRequest = `POST /test HTTP/1.1\r\nHost: example.com\r\n\r\n${bodyContent}`;

      const result = parseHttpRequest(rawRequest);

      expect(result.rawBody).toBe(bodyContent);
    });
  });

  describe('Edge cases', () => {
    it('should handle request with multiple empty lines in headers', () => {
      const rawRequest = 'GET /test HTTP/1.1\r\nHost: example.com\r\n\r\n\r\nbody with extra newlines';

      const result = parseHttpRequest(rawRequest);

      expect(result.headersRaw).toBe('Host: example.com');
      expect(result.rawBody).toBe('\r\nbody with extra newlines');
    });

    it('should handle invalid HTTP method gracefully by defaulting to GET', () => {
      const rawRequest = 'INVALID /test HTTP/1.1\r\nHost: example.com\r\n\r\nbody';

      const result = parseHttpRequest(rawRequest);

      expect(result.method).toBe('GET');
      expect(result.path).toBe('/test');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headersRaw).toBe('Host: example.com');
      expect(result.rawBody).toBe('body');
    });

    it('should handle malformed request line with no method gracefully', () => {
      const rawRequest = '\r\nHost: example.com\r\n\r\nbody';

      const result = parseHttpRequest(rawRequest);

      expect(result.method).toBe('GET');
      expect(result.path).toBe('/');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headersRaw).toBe('Host: example.com');
      expect(result.rawBody).toBe('body');
    });

    it('should handle request with body containing header-like content', () => {
      const bodyWithHeaders = 'Content-Type: fake\r\nHost: fake\r\n\r\nThis looks like headers but is body';
      const rawRequest = `POST /test HTTP/1.1\r\nHost: example.com\r\n\r\n${bodyWithHeaders}`;

      const result = parseHttpRequest(rawRequest);

      expect(result.headersRaw).toBe('Host: example.com');
      expect(result.rawBody).toBe(bodyWithHeaders);
    });
  });
});
