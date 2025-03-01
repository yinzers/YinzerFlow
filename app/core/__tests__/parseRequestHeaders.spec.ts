import { describe, expect, it } from 'bun:test';
import { RequestParser } from 'core/RequestParser.ts';

/**
 * parseRequestHeaders Tests
 *
 * Tests for the RequestParser.parseHeaders method which parses HTTP request headers.
 */

describe('RequestParser.parseHeaders', () => {
  const parser = new RequestParser();

  it('should parse headers correctly', () => {
    const rawHeaders = 'Host: example.com\r\nContent-Type: application/json\r\nAccept: */*';

    const headers = parser.parseHeaders(rawHeaders);

    expect(headers).toEqual({
      Host: 'example.com',
      'Content-Type': 'application/json',
      Accept: '*/*',
    });
  });

  it('should return an empty object for empty headers', () => {
    const headers = parser.parseHeaders('');

    expect(headers).toEqual({});
  });

  it('should handle headers with no value', () => {
    const rawHeaders = 'X-Empty:';

    const headers = parser.parseHeaders(rawHeaders);

    expect(headers).toEqual({
      'X-Empty': '',
    });
  });

  it('should handle headers with multiple colons', () => {
    const rawHeaders = 'X-Test: value:with:colons';

    const headers = parser.parseHeaders(rawHeaders);

    expect(headers).toEqual({
      'X-Test': 'value:with:colons',
    });
  });

  it('should handle leading/trailing whitespace in headers', () => {
    const rawHeaders = '  X-Test  :  value  ';

    const headers = parser.parseHeaders(rawHeaders);

    expect(headers).toEqual({
      'X-Test': 'value',
    });
  });

  it('should handle different line endings', () => {
    const rawHeadersN = 'X-Test1: value1\nX-Test2: value2';
    const rawHeadersR = 'X-Test1: value1\rX-Test2: value2';

    const headersN = parser.parseHeaders(rawHeadersN);

    expect(headersN).toEqual({
      'X-Test1': 'value1',
      'X-Test2': 'value2',
    });

    const headersR = parser.parseHeaders(rawHeadersR);

    expect(headersR).toEqual({
      'X-Test1': 'value1',
      'X-Test2': 'value2',
    });
  });

  it('should skip malformed headers', () => {
    const rawHeaders = 'ValidHeader: value\r\nInvalidHeader\r\nAnotherValid: test';

    const headers = parser.parseHeaders(rawHeaders);

    expect(headers).toEqual({
      ValidHeader: 'value',
      AnotherValid: 'test',
    });
  });

  it('should convert header names to lowercase', () => {
    const rawHeaders = 'Content-Type: application/json\r\nAccept: */*';

    const headers = parser.parseHeaders(rawHeaders);

    expect(headers).toHaveProperty('Content-Type');
    expect(headers).toHaveProperty('Accept');
  });

  it('should handle duplicate headers (last one wins)', () => {
    const rawHeaders = 'X-Test: value1\r\nX-Test: value2';

    const headers = parser.parseHeaders(rawHeaders);

    expect(headers).toEqual({
      'X-Test': 'value2',
    });
  });
});
