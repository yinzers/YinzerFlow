/* eslint-disable @typescript-eslint/dot-notation */
import { describe, expect, test } from 'bun:test';
import { Response } from '../Response.ts';
import { MockRequest } from '../__mocks__/Request.spec.ts';
import { ContentType, HttpStatus, HttpStatusCode } from '../../constants/http.ts';
import { calculateContentLength } from '../../utils/string.utils.ts';

describe('Response', () => {
  describe('constructor', () => {
    test('should initialize with default values', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();

      // Act
      const response = new Response(mockRequest as any);

      // Assert
      expect(response['protocol']).toBe('HTTP/1.1');
      expect(response['method']).toBe('GET');
      expect(response['path']).toBe('/');
      expect(response['statusCode']).toBe(HttpStatusCode.OK);
      expect(response['status']).toBe(HttpStatus.OK);
      expect(response['statusText']).toBe(HttpStatus.OK);
      expect(response['headers']).toHaveProperty('Content-Type', ContentType.JSON);
      expect(response['headers']).toHaveProperty('Content-Length', '0');
      expect(response['body']).toBe('');
      expect(response['_formattedBody']).toBe('');
    });
  });

  describe('addHeaders', () => {
    test('should add multiple headers', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      const headers = [{ 'X-Custom-Header': 'Custom Value' }, { 'X-Another-Header': 'Another Value' }];

      // Act
      response.addHeaders(headers);

      // Assert
      expect(response['headers']).toHaveProperty('X-Custom-Header', 'Custom Value');
      expect(response['headers']).toHaveProperty('X-Another-Header', 'Another Value');
    });
  });

  describe('removeHeaders', () => {
    test('should remove specified headers', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      response.addHeaders([{ 'X-Custom-Header': 'Custom Value' }]);

      // Act
      response.removeHeaders(['X-Custom-Header']);

      // Assert
      expect(response['headers']).not.toHaveProperty('X-Custom-Header');
    });
  });

  describe('modifyHeader', () => {
    test('should modify a specific header', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);

      // Act
      response.modifyHeader('Content-Type', ContentType.HTML);

      // Assert
      expect(response['headers']).toHaveProperty('Content-Type', ContentType.HTML);
    });
  });

  describe('setStatus', () => {
    test('should set status code and corresponding status text', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);

      // Act
      response.setStatus(HttpStatusCode.NOT_FOUND);

      // Assert
      expect(response['statusCode']).toBe(HttpStatusCode.NOT_FOUND);
      expect(response['status']).toBe(HttpStatus.NOT_FOUND);
      expect(response['statusText']).toBe(HttpStatus.NOT_FOUND);
    });

    test('should default to OK for unknown status codes', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);

      // Act
      response.setStatus(999 as any);

      // Assert
      expect(response['statusCode']).toBe(999);
      expect(response['status']).toBe(HttpStatus.OK);
      expect(response['statusText']).toBe(HttpStatus.OK);
    });
  });

  describe('_formatResponseBody', () => {
    test('should return string as is', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      const body = 'test string';

      // Act - using type assertion with bracket notation to access private method
      const result = (response as any)['_formatResponseBody'](body);

      // Assert
      expect(result).toBe('test string');
    });

    test('should convert null to "null" string', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);

      // Act - using type assertion with bracket notation to access private method
      const result = (response as any)['_formatResponseBody'](null);

      // Assert
      expect(result).toBe('null');
    });

    test('should convert objects to JSON string', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      const body = { name: 'John', age: 30 };

      // Act - using type assertion with bracket notation to access private method
      const result = (response as any)['_formatResponseBody'](body);

      // Assert
      expect(result).toBe(JSON.stringify(body));
    });

    test('should convert arrays to JSON string', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      const body = [1, 2, 3];

      // Act - using type assertion with bracket notation to access private method
      const result = (response as any)['_formatResponseBody'](body);

      // Assert
      expect(result).toBe(JSON.stringify(body));
    });

    test('should convert numbers to string', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);

      // Act - using type assertion with bracket notation to access private method
      const result = (response as any)['_formatResponseBody'](42);

      // Assert
      expect(result).toBe('42');
    });

    test('should convert booleans to string', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);

      // Act - using type assertion with bracket notation to access private method
      const result = (response as any)['_formatResponseBody'](true);

      // Assert
      expect(result).toBe('true');
    });
  });

  describe('setBody', () => {
    test('should set body and update Content-Length for string', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      const body = 'test body';

      // Act
      response.setBody(body);

      // Assert
      expect(response['body']).toBe(body);
      expect(response['_formattedBody']).toBe(body);
      expect(response['headers']['Content-Length']).toBe(String(calculateContentLength(body)));
    });

    test('should set body and update Content-Length for object', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      const body = { name: 'John', age: 30 };
      const formattedBody = JSON.stringify(body);

      // Act
      response.setBody(body);

      // Assert
      expect(response['body']).toBe(body);
      expect(response['_formattedBody']).toBe(formattedBody);
      expect(response['headers']['Content-Length']).toBe(String(calculateContentLength(formattedBody)));
    });

    test('should set Content-Type if not already set', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      response.removeHeaders(['Content-Type']);

      // Act
      response.setBody('test');

      // Assert
      expect(response['headers']['Content-Type']).toBe(ContentType.JSON);
    });

    test('should not override existing Content-Type', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      response.modifyHeader('Content-Type', ContentType.HTML);

      // Act
      response.setBody('test');

      // Assert
      expect(response['headers']['Content-Type']).toBe(ContentType.HTML);
    });
  });

  describe('formatHttpResponse', () => {
    test('should format a complete HTTP response', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      response.setBody('Hello, World!');

      // Act
      const httpResponse = response.formatHttpResponse();

      // Assert
      const expectedStatusLine = `HTTP/1.1 ${HttpStatusCode.OK} ${HttpStatus.OK}`;
      expect(httpResponse).toContain(expectedStatusLine);
      expect(httpResponse).toContain('Content-Type: application/json');
      expect(httpResponse).toContain('Content-Length: 13');
      expect(httpResponse).toContain('\r\n\r\nHello, World!');
    });

    test('should include all headers in the response', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      response.addHeaders([{ 'X-Custom-Header': 'Custom Value' }]);

      // Act
      const httpResponse = response.formatHttpResponse();

      // Assert
      expect(httpResponse).toContain('X-Custom-Header: Custom Value');
    });

    test('should format response with JSON body', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      const body = { message: 'Success', data: { id: 1, name: 'Test' } };
      response.setBody(body);

      // Act
      const httpResponse = response.formatHttpResponse();

      // Assert
      expect(httpResponse).toContain(JSON.stringify(body));
    });

    test('should format response with empty body', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);

      // Act
      const httpResponse = response.formatHttpResponse();

      // Assert
      expect(httpResponse).toMatch(/Content-Length: 0.*\r\n\r\n$/s);
    });

    test('should format response with different status code', () => {
      // Arrange
      const mockRequest = MockRequest.createDefault();
      const response = new Response(mockRequest as any);
      response.setStatus(HttpStatusCode.CREATED);

      // Act
      const httpResponse = response.formatHttpResponse();

      // Assert
      const expectedStatusLine = `HTTP/1.1 ${HttpStatusCode.CREATED} ${HttpStatus.CREATED}`;
      expect(httpResponse).toContain(expectedStatusLine);
    });
  });
});
