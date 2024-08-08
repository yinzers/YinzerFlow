/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'bun:test';
import HttpRequest from 'root/HttpRequest.ts';

describe('HttpRequest', () => {
  it('should throw an error for no request', () => {
    const request = '';
    expect(() => new HttpRequest(request)).toThrow('Invalid request');
  });

  it('should throw an error for an invalid header', () => {
    /**
     * The Accept header is missing a colon
     */
    const request = `GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept */*\r\n\r\n`;
    expect(() => new HttpRequest(request)).toThrow('Invalid header');
  });

  it('should parse a valid GET request', () => {
    const request = `GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n`;
    const httpRequest = new HttpRequest(request);

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('GET');
    expect(httpRequest.path).toBe('/');
    expect(httpRequest.headers).toEqual({ Host: 'localhost:5000', 'User-Agent': 'curl/7.64.1', Accept: '*/*' });
    expect(httpRequest.body).toEqual({});
  });

  it('should parse a valid POST request', () => {
    const request = `POST / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\nContent-Length: 11\r\nContent-Type: application/json\r\n\r\n{"key":"value"}`;
    const httpRequest = new HttpRequest(request);

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('POST');
    expect(httpRequest.path).toBe('/');
    expect(httpRequest.headers).toEqual({
      Host: 'localhost:5000',
      'User-Agent': 'curl/7.64.1',
      Accept: '*/*',
      'Content-Length': '11',
      'Content-Type': 'application/json',
    });
    expect(httpRequest.body).toEqual({ key: 'value' });
  });

  it('should parse a valid PATCH request', () => {
    const request = `PATCH / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\nContent-Length: 11\r\nContent-Type: application/json\r\n\r\n{"key":"value"}`;
    const httpRequest = new HttpRequest(request);

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('PATCH');
    expect(httpRequest.path).toBe('/');
    expect(httpRequest.headers).toEqual({
      Host: 'localhost:5000',
      'User-Agent': 'curl/7.64.1',
      Accept: '*/*',
      'Content-Length': '11',
      'Content-Type': 'application/json',
    });
    expect(httpRequest.body).toEqual({ key: 'value' });
  });

  it('should parse a valid PUT request', () => {
    const request = `PUT / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\nContent-Length: 11\r\nContent-Type: application/json\r\n\r\n{"key":"value"}`;
    const httpRequest = new HttpRequest(request);

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('PUT');
    expect(httpRequest.path).toBe('/');
    expect(httpRequest.headers).toEqual({
      Host: 'localhost:5000',
      'User-Agent': 'curl/7.64.1',
      Accept: '*/*',
      'Content-Length': '11',
      'Content-Type': 'application/json',
    });
    expect(httpRequest.body).toEqual({ key: 'value' });
  });

  it('should parse a valid DELETE request', () => {
    const request = `DELETE / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\nContent-Length: 11\r\nContent-Type: application/json\r\n\r\n{"key":"value"}`;
    const httpRequest = new HttpRequest(request);

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('DELETE');
    expect(httpRequest.path).toBe('/');
    expect(httpRequest.headers).toEqual({
      Host: 'localhost:5000',
      'User-Agent': 'curl/7.64.1',
      Accept: '*/*',
      'Content-Length': '11',
      'Content-Type': 'application/json',
    });
    expect(httpRequest.body).toEqual({ key: 'value' });
  });

  it('should parse a valid OPTIONS request', () => {
    const request = `OPTIONS / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\nContent-Length: 11\r\nContent-Type: application/json\r\n\r\n{"key":"value"}`;
    const httpRequest = new HttpRequest(request);

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('OPTIONS');
    expect(httpRequest.path).toBe('/');
    expect(httpRequest.headers).toEqual({
      Host: 'localhost:5000',
      'User-Agent': 'curl/7.64.1',
      Accept: '*/*',
      'Content-Length': '11',
      'Content-Type': 'application/json',
    });
    expect(httpRequest.body).toEqual({ key: 'value' });
  });

  it('should parse a valid request with a query', () => {
    const request = `GET /?key=value HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n`;
    const httpRequest = new HttpRequest(request);

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('GET');
    expect(httpRequest.path).toBe('/?key=value');
    expect(httpRequest.headers).toEqual({ Host: 'localhost:5000', 'User-Agent': 'curl/7.64.1', Accept: '*/*' });
    expect(httpRequest.body).toEqual({});
    expect(httpRequest.query).toEqual({ key: 'value' });
  });

  it('should parse a valid request with params', () => {
    const request = `GET /users/1/post/3 HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n`;
    const httpRequest = new HttpRequest(request);

    httpRequest.parseParams({
      path: '/users/:id/post/:post',
      handler: () => ({}),
      method: 'GET',
    });

    expect(httpRequest.protocol).toBe('HTTP/1.1');
    expect(httpRequest.method).toBe('GET');
    expect(httpRequest.path).toBe('/users/1/post/3');
    expect(httpRequest.headers).toEqual({ Host: 'localhost:5000', 'User-Agent': 'curl/7.64.1', Accept: '*/*' });
    expect(httpRequest.body).toEqual({});
    expect(httpRequest.params).toEqual({ id: '1', post: '3' });
  });
});
