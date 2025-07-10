import { describe, expect, it } from 'bun:test';
import { RequestImpl } from '@core/execution/RequestImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';

describe('RequestImpl', () => {
  const createRawRequest = (requestString: string) => Buffer.from(requestString);

  describe('Integration and orchestration', () => {
    it('should orchestrate all parsing utilities correctly', () => {
      const rawRequest = createRawRequest(
        'GET /users/123?include=profile HTTP/1.1\r\nHost: api.example.com\r\nContent-Type: application/json\r\n\r\n{"test": "data"}',
      );
      const setup = new SetupImpl();
      const request = new RequestImpl(rawRequest, setup);

      // Verify all components are integrated
      expect(request.method).toBe('GET');
      expect(request.path).toBe('/users/123?include=profile');
      expect(request.protocol).toBe('HTTP/1.1');
      expect(request.headers.host).toBe('api.example.com');
      expect(request.query).toEqual({ include: 'profile' });
      expect(request.body).toEqual({ test: 'data' });
      expect(request.params).toEqual({});
      expect(request.ipAddress).toBe('');
    });
  });

  describe('Route integration', () => {
    it('should extract route parameters when route matches', () => {
      const rawRequest = createRawRequest('GET /users/123/posts/456 HTTP/1.1\r\nHost: example.com\r\n\r\n');
      const setup = new SetupImpl();

      // Register a route to test parameter extraction
      setup.get('/users/:userId/posts/:postId', () => ({}));

      const request = new RequestImpl(rawRequest, setup);

      expect(request.params).toEqual({
        userId: '123',
        postId: '456',
      });
    });

    it('should have empty params when no route matches', () => {
      const rawRequest = createRawRequest('GET /unknown/path HTTP/1.1\r\nHost: example.com\r\n\r\n');
      const setup = new SetupImpl();
      const request = new RequestImpl(rawRequest, setup);

      expect(request.params).toEqual({});
    });
  });

  describe('Configuration integration', () => {
    it('should use proxy configuration for IP extraction', () => {
      const rawRequest = createRawRequest('GET /test HTTP/1.1\r\nHost: example.com\r\nX-Forwarded-For: 203.0.113.1, 127.0.0.1\r\n\r\n');

      const setupWithProxy = new SetupImpl({
        ipSecurity: { trustedProxies: ['127.0.0.1'] },
      });
      const request = new RequestImpl(rawRequest, setupWithProxy);

      expect(request.ipAddress).toBe('203.0.113.1');
    });

    it('should handle basic IP extraction', () => {
      const rawRequest = createRawRequest('GET /test HTTP/1.1\r\nHost: example.com\r\nX-Forwarded-For: 203.0.113.1\r\n\r\n');

      const setup = new SetupImpl();
      const request = new RequestImpl(rawRequest, setup);

      expect(request.ipAddress).toBe('203.0.113.1');
    });
  });

  describe('Content-Type and boundary extraction', () => {
    it('should extract content type and pass to body parser', () => {
      const rawRequest = createRawRequest(
        'POST /upload HTTP/1.1\r\nContent-Type: multipart/form-data; boundary=test123\r\n\r\n--test123\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--test123--',
      );
      const setup = new SetupImpl();
      const request = new RequestImpl(rawRequest, setup);

      // Should be parsed as multipart (has fields and files properties)
      expect(request.body).toHaveProperty('fields');
      expect(request.body).toHaveProperty('files');
    });

    it('should handle content type with parameters', () => {
      const rawRequest = createRawRequest('POST /api HTTP/1.1\r\nContent-Type: application/json; charset=utf-8\r\n\r\n{"test": true}');
      const setup = new SetupImpl();
      const request = new RequestImpl(rawRequest, setup);

      expect(request.body).toEqual({ test: true });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid HTTP methods gracefully by defaulting to GET', () => {
      const rawRequest = createRawRequest('INVALID /test HTTP/1.1\r\nHost: example.com\r\n\r\n');
      const setup = new SetupImpl();

      const request = new RequestImpl(rawRequest, setup);
      expect(request.method).toBe('GET');
      expect(request.path).toBe('/test');
      expect(request.protocol).toBe('HTTP/1.1');
    });
  });
});
