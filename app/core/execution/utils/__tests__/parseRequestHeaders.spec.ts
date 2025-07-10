import { describe, expect, it } from 'bun:test';
import { applySecurityPolicies, parseHeaderStructure, parseRequestHeaders, sanitizeHeaders, validateRawHeaders } from '../parseRequestHeaders.ts';
import { validateResponseHeaderValue, validateResponseHeaders } from '../validateResponseHeaders.ts';

describe('parseRequestHeaders', () => {
  describe('Basic header parsing', () => {
    it('should parse simple headers', () => {
      const rawHeaders = 'Host: example.com\r\nUser-Agent: test-browser\r\nAccept: application/json';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        host: 'example.com',
        'user-agent': 'test-browser',
        accept: 'application/json',
      });
    });

    it('should parse single header', () => {
      const rawHeaders = 'Content-Type: application/json';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'content-type': 'application/json',
      });
    });

    it('should handle empty headers', () => {
      const rawHeaders = '';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({});
    });

    it('should handle headers with multiple values', () => {
      const rawHeaders = 'Accept: text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8\r\nAccept-Language: en-US,en;q=0.5';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        accept: 'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8',
        'accept-language': 'en-US,en;q=0.5',
      });
    });
  });

  describe('Header normalization', () => {
    it('should normalize header names to lowercase', () => {
      const rawHeaders = 'HOST: example.com\r\nUSER-AGENT: test\r\nContent-Type: application/json';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        host: 'example.com',
        'user-agent': 'test',
        'content-type': 'application/json',
      });
    });

    it('should handle mixed case headers', () => {
      const rawHeaders = 'Content-LENGTH: 123\r\nX-Custom-Header: value\r\nauthorization: Bearer token';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'content-length': '123',
        'x-custom-header': 'value',
        authorization: 'Bearer token',
      });
    });

    it('should trim whitespace around header values', () => {
      const rawHeaders = 'Host:   example.com   \r\nUser-Agent:test\r\nContent-Type:  application/json  ';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        host: 'example.com',
        'user-agent': 'test',
        'content-type': 'application/json',
      });
    });

    it('should trim whitespace around header names', () => {
      const rawHeaders = '  Host  : example.com\r\n User-Agent : test\r\n  Content-Type  :application/json';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        host: 'example.com',
        'user-agent': 'test',
        'content-type': 'application/json',
      });
    });
  });

  describe('Line ending handling', () => {
    it('should handle CRLF line endings', () => {
      const rawHeaders = 'Host: example.com\r\nUser-Agent: test\r\nAccept: application/json';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        host: 'example.com',
        'user-agent': 'test',
        accept: 'application/json',
      });
    });

    it('should handle mixed line endings', () => {
      const rawHeaders = 'Host: example.com\r\nUser-Agent: test\nAccept: application/json\rContent-Type: application/json';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        host: 'example.com',
        'user-agent': 'test',
        accept: 'application/json',
        'content-type': 'application/json',
      });
    });
  });

  describe('Standard HTTP headers', () => {
    it('should handle common request headers', () => {
      const rawHeaders = [
        'Host: api.example.com',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept: application/json, text/plain, */*',
        'Accept-Language: en-US,en;q=0.9',
        'Accept-Encoding: gzip, deflate, br',
        'Connection: keep-alive',
        'Content-Type: application/json',
        'Content-Length: 123',
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'Cache-Control: no-cache',
      ].join('\r\n');

      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        host: 'api.example.com',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        connection: 'keep-alive',
        'content-type': 'application/json',
        'content-length': '123',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'cache-control': 'no-cache',
      });
    });

    it('should handle custom headers', () => {
      const rawHeaders = ['X-API-Key: secret123', 'X-Request-ID: req-12345', 'X-Forwarded-For: 192.168.1.1', 'X-Custom-Header: custom-value'].join('\r\n');

      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'x-api-key': 'secret123',
        'x-request-id': 'req-12345',
        'x-forwarded-for': '192.168.1.1',
        'x-custom-header': 'custom-value',
      });
    });
  });

  describe('Edge cases and malformed headers', () => {
    it('should skip headers without colons', () => {
      const rawHeaders = 'Valid-Header: value\r\nInvalidHeaderNoColon\r\nAnother-Valid: value2';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'valid-header': 'value',
        'another-valid': 'value2',
      });
    });

    it('should skip empty header names', () => {
      const rawHeaders = 'Valid-Header: value\r\n: empty-name\r\nAnother-Valid: value2';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'valid-header': 'value',
        'another-valid': 'value2',
      });
    });

    it('should handle headers with empty values', () => {
      const rawHeaders = 'Empty-Value:\r\nAnother-Empty: \r\nValid-Header: value';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'empty-value': '',
        'another-empty': '',
        'valid-header': 'value',
      });
    });

    it('should handle headers with multiple colons', () => {
      const rawHeaders = 'Authorization: Bearer: token:with:colons\r\nTime: 12:34:56\r\nURL: https://example.com:8080';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        authorization: 'Bearer: token:with:colons',
        time: '12:34:56',
        url: 'https://example.com:8080',
      });
    });

    it('should skip empty lines', () => {
      const rawHeaders = 'Header1: value1\r\n\r\nHeader2: value2\r\n\r\n\r\nHeader3: value3';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        header1: 'value1',
        header2: 'value2',
        header3: 'value3',
      });
    });

    it('should handle duplicate header names (last one wins)', () => {
      const rawHeaders = 'Set-Cookie: first=value1\r\nContent-Type: text/html\r\nSet-Cookie: second=value2';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'set-cookie': 'second=value2',
        'content-type': 'text/html',
      });
    });
  });

  describe('Special header values', () => {
    it('should handle headers with special characters', () => {
      const rawHeaders = [
        'Accept: application/json, text/plain; charset=utf-8',
        'Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
        'Content-Disposition: attachment; filename="test file.pdf"',
        'Set-Cookie: session=abc123; Path=/; HttpOnly; Secure',
      ].join('\r\n');

      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        accept: 'application/json, text/plain; charset=utf-8',
        authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
        'content-disposition': 'attachment; filename="test file.pdf"',
        'set-cookie': 'session=abc123; Path=/; HttpOnly; Secure',
      });
    });

    it('should handle headers with unicode characters', () => {
      const rawHeaders = 'X-Custom-Message: Hello 🌍\r\nX-Unicode: 中文测试';
      const result = parseRequestHeaders(rawHeaders);

      expect(result).toEqual({
        'x-custom-message': 'Hello 🌍',
        'x-unicode': '中文测试',
      });
    });
  });

  describe('Security validation', () => {
    describe('Header injection attacks', () => {
      it('should parse legitimate multi-header requests correctly', () => {
        const legitimateHeaders = 'X-Forwarded-For: 192.168.1.1\r\nAuthorization: Bearer token123';
        const result = parseRequestHeaders(legitimateHeaders);

        expect(result).toEqual({
          'x-forwarded-for': '192.168.1.1',
          authorization: 'Bearer token123',
        });
      });

      it('should parse complex request headers normally', () => {
        const complexHeaders = 'Authorization: Bearer token\nSet-Cookie: session=value\r\nUser-Agent: Mozilla/5.0';
        const result = parseRequestHeaders(complexHeaders);

        expect(result).toEqual({
          authorization: 'Bearer token',
          'set-cookie': 'session=value',
          'user-agent': 'Mozilla/5.0',
        });
      });

      it('should remove control characters from header values', () => {
        const headerWithControlChars = 'X-Custom: value\x00\x01\x02with\x1Fcontrol\x7Fchars';
        const result = parseRequestHeaders(headerWithControlChars);

        expect(result['x-custom']).toBe('valuewithcontrolchars');
      });

      it('should preserve horizontal tab in header values', () => {
        const headerWithTab = 'X-Custom: value\twith\ttabs';
        const result = parseRequestHeaders(headerWithTab);

        expect(result['x-custom']).toBe('value\twith\ttabs');
      });
    });

    describe('Header name validation', () => {
      it('should reject invalid header names with spaces', () => {
        const invalidHeaders = 'Invalid Header Name: value';

        expect(() => parseRequestHeaders(invalidHeaders)).toThrow('Invalid header name: Invalid Header Name');
      });

      it('should reject header names with invalid characters', () => {
        const invalidCases = [
          'Header@Name: value',
          'Header[Name]: value',
          'Header{Name}: value',
          'Header(Name): value',
          'Header,Name: value',
          'Header/Name: value',
          'Header;Name: value',
          'Header=Name: value',
          'Header"Name": value',
        ];

        invalidCases.forEach((headers) => {
          expect(() => parseRequestHeaders(headers)).toThrow(/Invalid header name/);
        });
      });

      it('should accept valid header names according to RFC 7230', () => {
        const validHeaders = [
          'Accept: application/json',
          'X-Custom-Header: value',
          'Authorization: Bearer token',
          'Content-Type: application/json',
          'X_Underscore_Header: value',
          'X.Dot.Header: value',
          'X^Caret^Header: value',
          "X'Quote'Header: value",
          'X*Star*Header: value',
          'X+Plus+Header: value',
          'X|Pipe|Header: value',
          'X~Tilde~Header: value',
          'X!Bang!Header: value',
          'X#Hash#Header: value',
          'X$Dollar$Header: value',
          'X%Percent%Header: value',
          'X&Amp&Header: value',
          'X`Backtick`Header: value',
        ].join('\r\n');

        expect(() => parseRequestHeaders(validHeaders)).not.toThrow();
      });
    });

    describe('DoS protection', () => {
      it('should reject too many headers', () => {
        const tooManyHeaders = Array.from({ length: 101 }, (_, i) => `Header${i}: value${i}`).join('\r\n');

        expect(() => parseRequestHeaders(tooManyHeaders)).toThrow('Too many headers: maximum 100 allowed');
      });

      it('should accept maximum allowed headers', () => {
        const maxHeaders = Array.from({ length: 100 }, (_, i) => `Header${i}: value${i}`).join('\r\n');

        expect(() => parseRequestHeaders(maxHeaders)).not.toThrow();
      });

      it('should reject header names that are too long', () => {
        const longHeaderName = `X-${'A'.repeat(200)}: value`;

        expect(() => parseRequestHeaders(longHeaderName)).toThrow('Header name too long: maximum 200 characters allowed');
      });

      it('should accept header names at maximum length', () => {
        const maxLengthName = `X-${'A'.repeat(198)}`; // Total 200 chars
        const headers = `${maxLengthName}: value`;

        expect(() => parseRequestHeaders(headers)).not.toThrow();
      });

      it('should reject header values that are too long', () => {
        const longValue = 'A'.repeat(8193);
        const headers = `X-Custom: ${longValue}`;

        expect(() => parseRequestHeaders(headers)).toThrow('Header value too long: maximum 8192 characters allowed');
      });

      it('should accept header values at maximum length', () => {
        const maxValue = 'A'.repeat(8192);
        const headers = `X-Custom: ${maxValue}`;

        expect(() => parseRequestHeaders(headers)).not.toThrow();
      });
    });

    describe('Edge case security scenarios', () => {
      it('should handle null bytes in header values', () => {
        const headerWithNull = 'X-Custom: value\x00truncated';
        const result = parseRequestHeaders(headerWithNull);

        expect(result['x-custom']).toBe('valuetruncated');
      });

      it('should parse complex legitimate header combinations', () => {
        const legitimateComplexHeaders = [
          'X-Forwarded-For: 192.168.1.1\r\nSet-Cookie: sessionid=abc123',
          'Authorization: Bearer token123\r\nContent-Type: application/json',
          'X-Real-IP: 127.0.0.1\nCache-Control: no-cache',
          'User-Agent: Mozilla/5.0\r\nAccept: application/json',
        ];

        legitimateComplexHeaders.forEach((headers) => {
          expect(() => parseRequestHeaders(headers)).not.toThrow();
          const result = parseRequestHeaders(headers);
          expect(Object.keys(result)).toHaveLength(2); // Should parse into 2 headers
        });
      });

      it('should handle headers with only control characters', () => {
        const controlCharHeader = 'X-Control: \x01\x02\x03\x04\x05';
        const result = parseRequestHeaders(controlCharHeader);

        expect(result['x-control']).toBe('');
      });

      it('should handle mixed valid and invalid characters', () => {
        const mixedHeader = 'X-Mixed: valid\x00\x01text\x1Fmore\x7Fvalid';
        const result = parseRequestHeaders(mixedHeader);

        expect(result['x-mixed']).toBe('validtextmorevalid');
      });
    });
  });

  describe('Modular Architecture', () => {
    describe('validateRawHeaders', () => {
      it('should pass valid headers', () => {
        const validHeaders = 'Accept: application/json\r\nContent-Type: text/html';
        expect(() => validateRawHeaders(validHeaders)).not.toThrow();
      });

      it('should reject too many headers', () => {
        const tooManyHeaders = Array.from({ length: 101 }, (_, i) => `Header${i}: value${i}`).join('\r\n');
        expect(() => validateRawHeaders(tooManyHeaders)).toThrow('Too many headers: maximum 100 allowed');
      });
    });

    describe('parseHeaderStructure', () => {
      it('should parse basic structure correctly', () => {
        const headers = 'Content-Type: application/json\r\nAccept: text/html';
        const result = parseHeaderStructure(headers);

        expect(result).toEqual({
          'content-type': 'application/json',
          accept: 'text/html',
        });
      });

      it('should validate header names', () => {
        const invalidHeaders = 'Invalid Header Name: value';
        expect(() => parseHeaderStructure(invalidHeaders)).toThrow('Invalid header name: Invalid Header Name');
      });
    });

    describe('sanitizeHeaders', () => {
      it('should remove control characters', () => {
        const headers = {
          'x-custom': 'value\x00\x01with\x1Fcontrol\x7Fchars',
          'x-normal': 'normal value',
        };

        const result = sanitizeHeaders(headers);

        expect(result).toEqual({
          'x-custom': 'valuewithcontrolchars',
          'x-normal': 'normal value',
        });
      });

      it('should preserve horizontal tabs', () => {
        const headers = { 'x-tabs': 'value\twith\ttabs' };
        const result = sanitizeHeaders(headers);

        expect(result['x-tabs']).toBe('value\twith\ttabs');
      });
    });

    describe('applySecurityPolicies', () => {
      it('should pass through headers as-is for now', () => {
        const headers = {
          authorization: 'Bearer token',
          'x-forwarded-for': '192.168.1.1',
        };

        const result = applySecurityPolicies(headers);

        expect(result).toEqual(headers);
      });
    });

    describe('Integration of all steps', () => {
      it('should process headers through all steps correctly', () => {
        const rawHeaders = 'Content-Type: application/json\r\nX-Custom: value\x00with\x01control';

        // Step 1: Validate
        expect(() => validateRawHeaders(rawHeaders)).not.toThrow();

        // Step 2: Parse structure
        const parsed = parseHeaderStructure(rawHeaders);
        expect(parsed).toEqual({
          'content-type': 'application/json',
          'x-custom': 'value\x00with\x01control', // Still has control chars
        });

        // Step 3: Sanitize
        const sanitized = sanitizeHeaders(parsed);
        expect(sanitized).toEqual({
          'content-type': 'application/json',
          'x-custom': 'valuewithcontrol', // Control chars removed
        });

        // Step 4: Apply security policies
        const secured = applySecurityPolicies(sanitized);
        expect(secured).toEqual(sanitized); // No changes for now

        // Main function should produce same result
        const mainResult = parseRequestHeaders(rawHeaders);
        expect(mainResult).toEqual(secured);
      });
    });
  });

  describe('CRLF Injection Protection', () => {
    describe('validateResponseHeaderValue', () => {
      it('should accept valid header values', () => {
        const validValues = ['application/json', 'Bearer token123', 'https://example.com', 'text/html; charset=utf-8', 'no-cache, no-store'];

        validValues.forEach((value) => {
          expect(() => validateResponseHeaderValue('test-header', value)).not.toThrow();
        });
      });

      it('should reject header values with CRLF characters', () => {
        const maliciousValues = [
          'value\r\nSet-Cookie: session=hijacked',
          'value\nLocation: https://evil.com',
          'normal\r\nMalicious-Header: injected',
          'text\rAnother-Header: value',
        ];

        maliciousValues.forEach((value) => {
          expect(() => validateResponseHeaderValue('test-header', value)).toThrow('Header value contains invalid line break characters');
        });
      });

      it('should reject header values with suspicious injection patterns', () => {
        const suspiciousValues = [
          'value\r\nSet-Cookie: malicious=true',
          'redirect\nLocation: https://evil.com',
          'auth\r\nAuthorization: Bearer stolen',
          'value\r\nwww-authenticate: Basic realm="fake"',
        ];

        suspiciousValues.forEach((value) => {
          expect(() => validateResponseHeaderValue('test-header', value)).toThrow('Header value contains invalid line break characters');
        });
      });

      it('should reject double CRLF patterns (HTTP response injection)', () => {
        const responseInjectionValues = ['value\r\n\r\nHTTP/1.1 200 OK', 'redirect\n\nContent-Length: 0'];

        responseInjectionValues.forEach((value) => {
          expect(() => validateResponseHeaderValue('test-header', value)).toThrow('Header value contains invalid line break characters');
        });
      });

      it('should reject HTTP response line injection', () => {
        const httpResponseValues = ['value\r\nHTTP/1.1 302 Found', 'value\nHTTP/1.0 404 Not Found'];

        httpResponseValues.forEach((value) => {
          expect(() => validateResponseHeaderValue('test-header', value)).toThrow('Header value contains invalid line break characters');
        });
      });

      it('should reject non-string values', () => {
        const nonStringValues = [123, null, undefined, { object: 'value' }, ['array']];

        nonStringValues.forEach((value) => {
          expect(() => validateResponseHeaderValue('test-header', value as any)).toThrow('Header value must be a string');
        });
      });
    });

    describe('validateResponseHeaders', () => {
      it('should validate all headers in an object', () => {
        const validHeaders = {
          'content-type': 'application/json',
          'cache-control': 'no-cache',
          authorization: 'Bearer token123',
        };

        expect(() => validateResponseHeaders(validHeaders)).not.toThrow();
      });

      it('should reject any header with CRLF injection', () => {
        const maliciousHeaders = {
          'content-type': 'application/json',
          location: 'https://example.com\r\nSet-Cookie: session=hijacked',
          'cache-control': 'no-cache',
        };

        expect(() => validateResponseHeaders(maliciousHeaders)).toThrow('Header value contains invalid line break characters');
      });

      it('should identify which header contains the injection', () => {
        const maliciousHeaders = {
          'content-type': 'application/json',
          'x-redirect': 'evil.com\r\nMalicious-Header: injected',
        };

        expect(() => validateResponseHeaders(maliciousHeaders)).toThrow('x-redirect');
      });
    });
  });
});
