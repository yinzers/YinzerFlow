import { describe, expect, test } from 'bun:test';
import { HttpRequest } from '../HttpRequest.ts';
import { HttpMethod } from '../../constants/http.ts';
import type { IRoute } from '../../types/Route.ts';

describe('HttpRequest', () => {
  describe('constructor', () => {
    test('should parse a simple GET request correctly', () => {
      // Arrange
      const rawRequest = ['GET /api/users HTTP/1.1', 'Host: example.com', 'User-Agent: test-agent', '', ''].join('\r\n');

      // Act
      const request = new HttpRequest(rawRequest);

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
      const request = new HttpRequest(rawRequest);

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
      const request = new HttpRequest(rawRequest);

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

    test('should parse a POST request with form data', () => {
      // Arrange
      const body = 'name=John&email=john%40example.com';
      const rawRequest = [
        'POST /api/users HTTP/1.1',
        'Host: example.com',
        'Content-Type: application/x-www-form-urlencoded',
        `Content-Length: ${body.length}`,
        '',
        body,
      ].join('\r\n');

      // Act
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/users');
      expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      // Type assertion for the body
      const formBody = request.body as Record<string, string>;
      expect(formBody).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    test('should parse a POST request with URL-encoded JSON', () => {
      // Arrange
      const jsonData = JSON.stringify({ name: 'John', email: 'john@example.com' });
      const body = `data=${encodeURIComponent(jsonData)}`;
      const rawRequest = [
        'POST /api/users HTTP/1.1',
        'Host: example.com',
        'Content-Type: application/x-www-form-urlencoded+json',
        `Content-Length: ${body.length}`,
        '',
        body,
      ].join('\r\n');

      // Act
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/users');
      expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded+json');

      // Type assertion for the body
      const jsonBody = request.body as Record<string, any>;
      expect(jsonBody).toHaveProperty('data');
      expect(jsonBody.data).toEqual({ name: 'John', email: 'john@example.com' });
    });

    test('should parse a POST request with XML data', () => {
      // Arrange
      const body = '<user><name>John</name><email>john@example.com</email></user>';
      const rawRequest = ['POST /api/users HTTP/1.1', 'Host: example.com', 'Content-Type: application/xml', `Content-Length: ${body.length}`, '', body].join(
        '\r\n',
      );

      // Act
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/users');
      expect(request.headers['Content-Type']).toBe('application/xml');

      // Type assertion for the body
      const xmlBody = request.body as Record<string, string>;
      expect(xmlBody).toHaveProperty('name');
      expect(xmlBody).toHaveProperty('email');
      expect(xmlBody.name).toBe('John');
      expect(xmlBody.email).toBe('john@example.com');
    });

    test('should parse a POST request with plain text', () => {
      // Arrange
      const body = 'Hello, world!';
      const rawRequest = ['POST /api/messages HTTP/1.1', 'Host: example.com', 'Content-Type: text/plain', `Content-Length: ${body.length}`, '', body].join(
        '\r\n',
      );

      // Act
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/messages');
      expect(request.headers['Content-Type']).toBe('text/plain');

      // Type assertion for the body
      const textBody = request.body as { content: string };
      expect(textBody).toEqual({ content: 'Hello, world!' });
    });

    test('should parse a POST request with CSV data', () => {
      // Arrange
      const body = 'name,email\nJohn,john@example.com\nJane,jane@example.com';
      const rawRequest = ['POST /api/users/import HTTP/1.1', 'Host: example.com', 'Content-Type: text/csv', `Content-Length: ${body.length}`, '', body].join(
        '\r\n',
      );

      // Act
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/users/import');
      expect(request.headers['Content-Type']).toBe('text/csv');

      // Type assertion for the body
      const csvBody = request.body as { headers: Array<string>; rows: Array<Array<string>> };
      expect(csvBody).toHaveProperty('headers');
      expect(csvBody).toHaveProperty('rows');
      expect(csvBody.headers).toEqual(['name', 'email']);
      expect(csvBody.rows).toHaveLength(2);
      expect(csvBody.rows[0]).toEqual(['John', 'john@example.com']);
      expect(csvBody.rows[1]).toEqual(['Jane', 'jane@example.com']);
    });

    test('should parse a POST request with YAML data', () => {
      // Arrange
      const body = 'user:\n  name: John\n  email: john@example.com';
      const rawRequest = ['POST /api/users HTTP/1.1', 'Host: example.com', 'Content-Type: application/yaml', `Content-Length: ${body.length}`, '', body].join(
        '\r\n',
      );

      // Act
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/users');
      expect(request.headers['Content-Type']).toBe('application/yaml');

      // Type assertion for the body
      const yamlBody = request.body as Record<string, any>;
      expect(yamlBody).toHaveProperty('user');
      expect(yamlBody.user).toHaveProperty('name');
      expect(yamlBody.user).toHaveProperty('email');
      expect(yamlBody.user.name).toBe('John');
      expect(yamlBody.user.email).toBe('john@example.com');
    });

    test('should throw an error for invalid requests', () => {
      // Arrange
      const rawRequest = '';

      // Act & Assert
      expect(() => new HttpRequest(rawRequest)).toThrow('Invalid request');
    });

    test('should throw an error for missing Content-Type in POST requests with body', () => {
      // Arrange
      const body = 'Some data';
      const rawRequest = ['POST /api/users HTTP/1.1', 'Host: example.com', '', body].join('\r\n');

      // Act & Assert
      expect(() => new HttpRequest(rawRequest)).toThrow('Missing Content-Type header');
    });
  });

  describe('parseParams', () => {
    test('should parse route parameters correctly', () => {
      // Arrange
      const rawRequest = ['GET /api/users/123/posts/456 HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');
      const request = new HttpRequest(rawRequest);
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
      const request = new HttpRequest(rawRequest);
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
      const request = new HttpRequest(rawRequest);
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
      const request = new HttpRequest(rawRequest);
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
      const request = new HttpRequest(rawRequest);
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
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.headers['Custom-Header']).toBe('value:with:colons');
    });

    test('should handle query parameters with special characters', () => {
      // Arrange
      const rawRequest = ['GET /api/search?q=test%20query&filter=special%26chars HTTP/1.1', 'Host: example.com', '', ''].join('\r\n');

      // Act
      const request = new HttpRequest(rawRequest);

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
      const request = new HttpRequest(rawRequest);

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
      const request = new HttpRequest(rawRequest);

      // Assert
      expect(request.body).toEqual({});
    });
  });
});
