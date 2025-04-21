import { describe, expect, test } from 'bun:test';
import { Request } from '../Request.ts';
import { HttpMethod } from '../../../constants/http.ts';
import type { IRoute } from '../../../types/Route.ts';

describe('HttpRequest', () => {
  const parserOptions = {
    json: {
      raw: false,
    },
    yaml: {
      raw: false,
    },
  };

  describe('constructor', () => {
    test('should parse a simple GET request correctly', () => {
      // Arrange
      const rawRequest = ['GET /api/users HTTP/1.1', 'Host: example.com', 'User-Agent: test-agent', '', ''].join('\r\n');

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.method).toBe('GET');
      expect(request.path).toBe('/api/users');
      expect(request.protocol).toBe('HTTP/1.1');
      expect(request.headers).toEqual({
        Host: 'example.com',
        'User-Agent': 'test-agent',
      });
      expect(request.body).toEqual({});
      expect(request.query).toEqual({});
      expect(request.params).toEqual({});
    });

    test('should parse a GET request with query parameters', () => {
      // Arrange
      const rawRequest = ['GET /api/users?name=John&age=30 HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.method).toBe('GET');
      expect(request.path).toBe('/api/users?name=John&age=30');
      expect(request.query).toEqual({
        name: 'John',
        age: '30',
      });
    });

    test('should parse a POST request with JSON body', () => {
      // Arrange
      const body = JSON.stringify({ name: 'John', email: 'john@example.com' });
      const rawRequest = ['POST /api/users HTTP/1.1', 'Host: example.com', 'Content-Type: application/json', `Content-Length: ${body.length}`, '', body].join(
        '\r\n',
      );

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/users');
      expect(request.headers['Content-Type']).toBe('application/json');

      // Type assertion for the body
      const jsonBody = request.body as Record<string, any>;
      expect(jsonBody).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    test('should parse a POST request with multipart form data', () => {
      // Arrange
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"',
        '',
        'John',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"',
        '',
        'john@example.com',
        `--${boundary}--`,
        '',
      ].join('\r\n');

      const rawRequest = [
        'POST /api/users HTTP/1.1',
        'Host: example.com',
        `Content-Type: multipart/form-data; boundary=${boundary}`,
        `Content-Length: ${body.length}`,
        '',
        body,
      ].join('\r\n');

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/users');
      expect(request.headers['Content-Type']).toBe(`multipart/form-data; boundary=${boundary}`);

      // Type assertion for the body
      const formBody = request.body as { fields: Record<string, string>; files: Array<any> };
      expect(formBody).toEqual({
        fields: {
          name: 'John',
          email: 'john@example.com',
        },
        files: [],
      });
    });

    test('should throw an error for invalid requests', () => {
      // Arrange
      const rawRequest = '';

      // Act & Assert
      expect(() => new Request(rawRequest, parserOptions)).toThrow('Invalid request');
    });

    test('should throw an error for missing Content-Type in POST requests with body', () => {
      // Arrange
      const body = 'Some data';
      const rawRequest = ['POST /api/users HTTP/1.1', 'Host: example.com', '', body].join('\r\n');

      // Act & Assert
      expect(() => new Request(rawRequest, parserOptions)).toThrow('Missing Content-Type header');
    });
  });

  describe('parseParams', () => {
    test('should parse route parameters correctly', () => {
      // Arrange
      const rawRequest = ['GET /api/users/123/posts/456 HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');
      const request = new Request(rawRequest, parserOptions);
      const route: IRoute = {
        path: '/api/users/:userId/posts/:postId',
        method: HttpMethod.GET,
        handler: () => ({}),
      };

      // Act
      const params = request.parseParams(route);

      // Assert
      expect(params).toEqual({
        userId: '123',
        postId: '456',
      });
    });

    test('should return empty object for non-matching route', () => {
      // Arrange
      const rawRequest = ['GET /api/products/123 HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');
      const request = new Request(rawRequest, parserOptions);
      const route: IRoute = {
        path: '/api/users/:userId',
        method: HttpMethod.GET,
        handler: () => ({}),
      };

      // Act
      const params = request.parseParams(route);

      // Assert
      expect(params).toEqual({});
    });

    test('should return empty object for route without parameters', () => {
      // Arrange
      const rawRequest = ['GET /api/users HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');
      const request = new Request(rawRequest, parserOptions);
      const route: IRoute = {
        path: '/api/users',
        method: HttpMethod.GET,
        handler: () => ({}),
      };

      // Act
      const params = request.parseParams(route);

      // Assert
      expect(params).toEqual({});
    });

    test('should handle routes with multiple parameters', () => {
      // Arrange
      const rawRequest = ['GET /api/users/123/posts/456/comments/789 HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');
      const request = new Request(rawRequest, parserOptions);
      const route: IRoute = {
        path: '/api/users/:userId/posts/:postId/comments/:commentId',
        method: HttpMethod.GET,
        handler: () => ({}),
      };

      // Act
      const params = request.parseParams(route);

      // Assert
      expect(params).toEqual({
        userId: '123',
        postId: '456',
        commentId: '789',
      });
    });

    test('should handle invalid route path', () => {
      // Arrange
      const rawRequest = ['GET /api/users/123 HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');
      const request = new Request(rawRequest, parserOptions);
      const route = {
        path: null,
        method: HttpMethod.GET,
        handler: () => ({}),
      } as unknown as IRoute;

      // Act
      const params = request.parseParams(route);

      // Assert
      expect(params).toEqual({});
    });
  });

  describe('edge cases', () => {
    test('should handle headers with multiple colons', () => {
      // Arrange
      const rawRequest = ['GET /api/users HTTP/1.1', 'Host: example.com', 'Custom-Header: value:with:colons', '', ''].join('\r\n');

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.headers['Custom-Header']).toBe('value:with:colons');
    });

    test('should handle query parameters with special characters', () => {
      // Arrange
      const rawRequest = ['GET /api/search?q=test%20query&filter=special%26chars HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.query).toEqual({
        q: 'test query',
        filter: 'special&chars',
      });
    });

    test('should handle empty query parameters', () => {
      // Arrange
      const rawRequest = ['GET /api/search?q=&empty HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.query).toEqual({
        q: '',
        empty: '',
      });
    });

    test('should ignore body in GET requests', () => {
      // Arrange
      const body = JSON.stringify({ name: 'John' });
      const rawRequest = ['GET /api/users HTTP/1.1', 'Host: example.com', 'Content-Type: application/json', '', body].join('\r\n');

      // Act
      const request = new Request(rawRequest, parserOptions);

      // Assert
      expect(request.body).toEqual({});
    });
  });
});
