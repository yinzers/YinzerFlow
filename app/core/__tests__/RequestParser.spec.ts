import { beforeEach, describe, expect, test } from 'bun:test';
import { RequestParser } from '../RequestParser.ts';
import { ContentType } from '../../constants/http.ts';
import type { IRoute } from '../../types/Route.ts';

describe('RequestParser', () => {
  let parser: RequestParser;

  beforeEach(() => {
    parser = new RequestParser();
  });

  describe('parseBody', () => {
    test('should parse JSON body correctly', () => {
      // Arrange
      const headers = { 'Content-Type': ContentType.JSON };
      const body = JSON.stringify({ name: 'Test User', email: 'test@example.com' });

      // Act
      const result = parser.parseBody(headers, body);

      // Assert
      expect(result).toEqual({ name: 'Test User', email: 'test@example.com' });
    });

    test('should throw error for invalid JSON', () => {
      // Arrange
      const headers = { 'Content-Type': ContentType.JSON };
      const body = '{ invalid json }';

      // Act & Assert
      expect(() => parser.parseBody(headers, body)).toThrow('Invalid JSON body');
    });

    test('should parse form-urlencoded body correctly', () => {
      // Arrange
      const headers = { 'Content-Type': ContentType.FORM };
      const body = 'name=Test+User&email=test%40example.com';

      // Act
      const result = parser.parseBody(headers, body);

      // Assert
      expect(result).toEqual({ name: 'Test+User', email: 'test%40example.com' });
    });

    test('should parse multipart form data correctly', () => {
      // Arrange
      const boundary = 'X-BOUNDARY';
      const headers = { 'Content-Type': `${ContentType.MULTIPART}; boundary=${boundary}` };
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"',
        '',
        'Test User',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"',
        '',
        'test@example.com',
        `--${boundary}--`,
      ].join('\r\n');

      // Act
      const result = parser.parseBody(headers, body) as Record<string, any>;

      // Assert
      expect(result).toHaveProperty('fields');
      expect(result).toHaveProperty('files');
      expect(result.fields).toEqual({ name: 'Test User', email: 'test@example.com' });
      expect(result.files).toEqual({});
    });

    test('should parse multipart form data with file uploads correctly', () => {
      // Arrange
      const boundary = 'X-BOUNDARY';
      const headers = { 'Content-Type': `${ContentType.MULTIPART}; boundary=${boundary}` };
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="field1"',
        '',
        'value1',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file1"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'This is the content of the file',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file2"; filename="image.jpg"',
        'Content-Type: image/jpeg',
        '',
        'MOCK_BINARY_IMAGE_DATA',
        `--${boundary}--`,
      ].join('\r\n');

      // Act
      const result = parser.parseBody(headers, body) as Record<string, any>;

      // Assert
      expect(result).toHaveProperty('fields');
      expect(result).toHaveProperty('files');

      // Check fields
      expect(result.fields).toHaveProperty('field1', 'value1');

      // Check files
      expect(result.files).toHaveProperty('file1');
      expect(result.files.file1).toHaveProperty('filename', 'test.txt');
      expect(result.files.file1).toHaveProperty('contentType', 'text/plain');
      expect(result.files.file1).toHaveProperty('content', 'This is the content of the file');
      expect(result.files.file1).toHaveProperty('size', 'This is the content of the file'.length);

      expect(result.files).toHaveProperty('file2');
      expect(result.files.file2).toHaveProperty('filename', 'image.jpg');
      expect(result.files.file2).toHaveProperty('contentType', 'image/jpeg');
      expect(result.files.file2).toHaveProperty('content', 'MOCK_BINARY_IMAGE_DATA');
      expect(result.files.file2).toHaveProperty('size', 'MOCK_BINARY_IMAGE_DATA'.length);
    });

    test('should handle multipart form data with mixed fields and files', () => {
      // Arrange
      const boundary = 'X-BOUNDARY';
      const headers = { 'Content-Type': `${ContentType.MULTIPART}; boundary=${boundary}` };
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="username"',
        '',
        'testuser',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"',
        '',
        'test@example.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="avatar"; filename="profile.png"',
        'Content-Type: image/png',
        '',
        'MOCK_PNG_DATA',
        `--${boundary}`,
        'Content-Disposition: form-data; name="document"; filename="doc.pdf"',
        'Content-Type: application/pdf',
        '',
        'MOCK_PDF_DATA',
        `--${boundary}--`,
      ].join('\r\n');

      // Act
      const result = parser.parseBody(headers, body) as Record<string, any>;

      // Assert
      // Check fields
      expect(result.fields).toHaveProperty('username', 'testuser');
      expect(result.fields).toHaveProperty('email', 'test@example.com');

      // Check files
      expect(result.files).toHaveProperty('avatar');
      expect(result.files.avatar).toHaveProperty('filename', 'profile.png');
      expect(result.files.avatar).toHaveProperty('contentType', 'image/png');

      expect(result.files).toHaveProperty('document');
      expect(result.files.document).toHaveProperty('filename', 'doc.pdf');
      expect(result.files.document).toHaveProperty('contentType', 'application/pdf');

      // Check metadata
      expect(result.files.avatar).toHaveProperty('metadata');
      expect(result.files.avatar.metadata).toHaveProperty('uploadedAt');
    });

    test('should parse XML body correctly', () => {
      // Arrange
      const headers = { 'Content-Type': 'application/xml' };
      const body = '<user id="123"><name>Test User</name><email>test@example.com</email></user>';

      // Act
      const result = parser.parseBody(headers, body) as Record<string, any>;

      // Assert
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('_attributes');
      expect(result.user._attributes).toHaveProperty('id', '123');
      expect(result.user).toHaveProperty('name', 'Test User');
      expect(result.user).toHaveProperty('email', 'test@example.com');
    });

    test('should parse plain text body correctly', () => {
      // Arrange
      const headers = { 'Content-Type': 'text/plain' };
      const body = 'Hello, world!';

      // Act
      const result = parser.parseBody(headers, body) as Record<string, string>;

      // Assert
      expect(result).toEqual({ content: 'Hello, world!' });
    });

    test('should parse URL-encoded JSON body correctly', () => {
      // Arrange
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded+json' };
      const body = `user=${encodeURIComponent(JSON.stringify({ name: 'Test User', email: 'test@example.com' }))}`;

      // Act
      const result = parser.parseBody(headers, body) as Record<string, any>;
      console.log('URL-encoded JSON result:', JSON.stringify(result));

      // Assert
      expect(result).toHaveProperty('user');
      // The user property should be a parsed JSON object
      const { user } = result;
      console.log('User object:', JSON.stringify(user));
      expect(typeof user).toBe('object');
      expect(user).not.toBeNull();
      if (user && typeof user === 'object') {
        expect(user.name).toBe('Test User');
        expect(user.email).toBe('test@example.com');
      }
    });

    test('should parse CSV body correctly', () => {
      // Arrange
      const headers = { 'Content-Type': 'text/csv' };
      const body = 'name,email\nTest User,test@example.com\nAnother User,another@example.com';

      // Act
      const result = parser.parseBody(headers, body) as { headers: Array<string>; rows: Array<Record<string, string>> };

      // Assert
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
      expect(result.headers).toEqual(['name', 'email']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ name: 'Test User', email: 'test@example.com' });
      expect(result.rows[1]).toEqual({ name: 'Another User', email: 'another@example.com' });
    });

    test('should parse CSV body with quoted values correctly', () => {
      // Arrange
      const headers = { 'Content-Type': 'text/csv' };
      const body = 'name,email,description\n"User, Test",test@example.com,"This is a ""quoted"" description"';

      // Act
      const result = parser.parseBody(headers, body) as { headers: Array<string>; rows: Array<Record<string, string>> };

      // Assert
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
      expect(result.headers).toEqual(['name', 'email', 'description']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        name: 'User, Test',
        email: 'test@example.com',
        description: 'This is a "quoted" description',
      });
    });

    test('should parse YAML body correctly', () => {
      // Arrange
      const headers = { 'Content-Type': 'application/yaml' };
      const body = `
user:
  name: Test User
  email: test@example.com
  active: true
  score: 42
  settings:
    notifications: true
    theme: dark
`;

      // Act
      const result = parser.parseBody(headers, body) as Record<string, any>;

      // Assert
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('name', 'Test User');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).toHaveProperty('active', true);
      expect(result.user).toHaveProperty('score', 42);
      expect(result.user).toHaveProperty('settings');
      expect(result.user.settings).toHaveProperty('notifications', true);
      expect(result.user.settings).toHaveProperty('theme', 'dark');
    });

    test('should throw error for missing Content-Type header', () => {
      // Arrange
      const headers = {};
      const body = 'test';

      // Act & Assert
      expect(() => parser.parseBody(headers, body)).toThrow('Missing Content-Type header');
    });
  });

  describe('parseHeaders', () => {
    test('should parse headers correctly', () => {
      // Arrange
      const rawHeaders = 'Host: example.com\r\nContent-Type: application/json\r\nContent-Length: 123';

      // Act
      const result = parser.parseHeaders(rawHeaders);

      // Assert
      expect(result).toEqual({
        Host: 'example.com',
        'Content-Type': 'application/json',
        'Content-Length': '123',
      });
    });

    test('should handle different line endings', () => {
      // Arrange
      const rawHeaders = 'Host: example.com\nContent-Type: application/json\rContent-Length: 123';

      // Act
      const result = parser.parseHeaders(rawHeaders);

      // Assert
      expect(result).toEqual({
        Host: 'example.com',
        'Content-Type': 'application/json',
        'Content-Length': '123',
      });
    });

    test('should handle empty headers', () => {
      // Arrange
      const rawHeaders = '';

      // Act
      const result = parser.parseHeaders(rawHeaders);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('parseParams', () => {
    test('should parse route parameters correctly', () => {
      // Arrange
      const route: IRoute = {
        path: '/users/:id/posts/:postId',
        method: 'GET',
        handler: () => ({}),
      };
      const path = '/users/123/posts/456';

      // Act
      const result = parser.parseParams(route, path);

      // Assert
      expect(result).toEqual({ id: '123', postId: '456' });
    });

    test('should handle routes without parameters', () => {
      // Arrange
      const route: IRoute = {
        path: '/users',
        method: 'GET',
        handler: () => ({}),
      };
      const path = '/users';

      // Act
      const result = parser.parseParams(route, path);

      // Assert
      expect(result).toEqual({});
    });

    test('should handle non-matching paths', () => {
      // Arrange
      const route: IRoute = {
        path: '/users/:id',
        method: 'GET',
        handler: () => ({}),
      };
      const path = '/posts/123';

      // Act
      const result = parser.parseParams(route, path);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('parseQuery', () => {
    test('should parse query parameters correctly', () => {
      // Arrange
      const url = '/search?q=test&page=1&limit=10';

      // Act
      const result = parser.parseQuery(url);

      // Assert
      expect(result).toEqual({ q: 'test', page: '1', limit: '10' });
    });

    test('should handle URLs without query parameters', () => {
      // Arrange
      const url = '/users';

      // Act
      const result = parser.parseQuery(url);

      // Assert
      expect(result).toEqual({});
    });

    test('should handle empty query parameters', () => {
      // Arrange
      const url = '/search?q=&page=';

      // Act
      const result = parser.parseQuery(url);

      // Assert
      expect(result).toEqual({ q: '', page: '' });
    });

    test('should handle query parameters without values', () => {
      // Arrange
      const url = '/search?q&page';

      // Act
      const result = parser.parseQuery(url);

      // Assert
      expect(result).toEqual({ q: '', page: '' });
    });
  });
});
