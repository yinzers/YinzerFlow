import { describe, expect, it } from 'bun:test';
import { RequestParser } from 'core/RequestParser.ts';

describe('RequestParser.parseBody', () => {
  const parser = new RequestParser();

  it('should parse JSON body correctly', () => {
    const headers = { 'Content-Type': 'application/json' };
    const body = '{"name":"John","age":30}';

    const result = parser.parseBody(headers, body);

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('should throw error for invalid JSON', () => {
    const headers = { 'Content-Type': 'application/json' };
    const body = '{"name":"John",age:30}'; // Missing quotes around age

    expect(() => parser.parseBody(headers, body)).toThrow('Invalid body');
  });

  it('should parse form-urlencoded body correctly', () => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = 'name=John&age=30';

    const result = parser.parseBody(headers, body);

    expect(result).toEqual({ name: 'John', age: '30' });
  });

  it('should parse multipart form data correctly', () => {
    const headers = { 'Content-Type': 'multipart/form-data; boundary=X' };
    const body = 'Content-Disposition: form-data; name="name"\r\n\r\nJohn\r\nContent-Disposition: form-data; name="age"\r\n\r\n30\r\n';

    const result = parser.parseBody(headers, body);

    expect(result).toEqual({ name: 'John', age: '30' });
  });

  it('should throw error if Content-Type header is missing', () => {
    const headers = {};
    const body = '{"name":"John","age":30}';

    expect(() => parser.parseBody(headers, body)).toThrow('Missing Content-Type header');
  });
});
