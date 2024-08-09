import { describe, expect, it } from 'bun:test';
import parseRequestBodyUtils from 'utils/parseRequestBody.utils.ts';

describe('parseRequestbody', () => {
  it('should return a TRequestBody given a JSON body', () => {
    const headers = { 'Content-Type': 'application/json' };
    const body = '{"key": "value"}';
    const result = parseRequestBodyUtils(headers, body);

    expect(result).toEqual({ key: 'value' });
  });

  it('should throw an error given bad JSON body', () => {
    const headers = { 'Content-Type': 'application/json' };
    const body = '{"key"="value"}';
    expect(() => parseRequestBodyUtils(headers, body)).toThrow('Invalid body');
  });

  it('should return a TRequestBody given a x-www-form-urlencoded body', () => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = 'key=value&key2=value2';
    const result = parseRequestBodyUtils(headers, body);

    expect(result).toEqual({ key: 'value', key2: 'value2' });
  });

  it('should return a TRequestBody given a multipart/form-data body', () => {
    const headers = { 'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' };
    const body = `----------------------------159925289398485702532211\r\nContent-Disposition: form-data; name="key"\r\n\r\nvalue\r\n----------------------------159925289398485702532211\r\nContent-Disposition: form-data; name="key2"\r\n\r\nvalue2\r\n----------------------------159925289398485702532211--`;

    const result = parseRequestBodyUtils(headers, body);

    expect(result).toEqual({ key: 'value', key2: 'value2' });
  });

  it('should throw an error if the content type header is missing', () => {
    const headers = {};
    const body = 'key=value';
    expect(() => parseRequestBodyUtils(headers, body)).toThrow('Missing Content-Type header');
  });
});
