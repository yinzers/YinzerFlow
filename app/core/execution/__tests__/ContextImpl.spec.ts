import { beforeEach, describe, expect, it } from 'bun:test';
import { ContextImpl } from '../ContextImpl.ts';
import { RequestImpl } from '../RequestImpl.ts';
import { ResponseImpl } from '../ResponseImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';

describe('ContextImpl', () => {
  let setup: SetupImpl;

  beforeEach(() => {
    setup = new SetupImpl();
  });

  describe('when constructing with valid inputs', () => {
    const testCases = [
      {
        name: 'Buffer input',
        rawRequest: Buffer.from('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n'),
        description: 'should handle Buffer input correctly',
      },
      {
        name: 'string input',
        rawRequest: 'POST /api HTTP/1.1\r\nContent-Type: application/json\r\n\r\n{"test": true}',
        description: 'should handle string input correctly',
      },
    ];

    testCases.forEach(({ name, rawRequest, description }) => {
      it(description, () => {
        const context = new ContextImpl(rawRequest, setup);

        // Verify internal objects are created
        expect(context._request).toBeInstanceOf(RequestImpl);
        expect(context._response).toBeInstanceOf(ResponseImpl);

        // Verify public interfaces point to internal objects
        expect(context.request).toBe(context._request);
        expect(context.response).toBe(context._response);

        // Verify readonly properties
        expect(context._request).toBeDefined();
        expect(context._response).toBeDefined();
      });
    });
  });

  describe('when verifying object relationships', () => {
    it('should pass request to response constructor', () => {
      const rawRequest = 'GET /test HTTP/1.1\r\n\r\n';
      const context = new ContextImpl(rawRequest, setup);

      // ResponseImpl constructor should receive the RequestImpl instance
      expect(context._response._request).toBe(context._request);
    });

    it('should maintain reference equality for public interfaces', () => {
      const rawRequest = Buffer.from('PUT /data HTTP/1.1\r\n\r\n');
      const context = new ContextImpl(rawRequest, setup);

      // Public interfaces should be the same objects as internal ones
      expect(context.request).toBe(context._request);
      expect(context.response).toBe(context._response);

      // Should maintain consistency across multiple accesses
      const request1 = context.request;
      const request2 = context.request;
      expect(request1).toBe(request2);
    });
  });

  describe('when handling edge cases', () => {
    it('should handle empty request data', () => {
      const context = new ContextImpl('', setup);

      expect(context._request).toBeInstanceOf(RequestImpl);
      expect(context._response).toBeInstanceOf(ResponseImpl);
      expect(context.request).toBe(context._request);
      expect(context.response).toBe(context._response);
    });

    it('should handle minimal HTTP request', () => {
      const minimalRequest = 'GET / HTTP/1.1\r\n\r\n';
      const context = new ContextImpl(minimalRequest, setup);

      expect(context._request).toBeInstanceOf(RequestImpl);
      expect(context._response).toBeInstanceOf(ResponseImpl);
    });
  });
});
