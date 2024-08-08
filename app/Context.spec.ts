import { describe, expect, it } from 'bun:test';
import { Context } from 'root/Context.utils.ts';
import HttpRequest from 'root/HttpRequest.ts';
import HttpResponse from 'root/HttpResponse.ts';

/**
 * The majority of the tests for the Context class are covered in the HttpRequest and HttpResponse classes.
 */
describe('Context', () => {
  it('should create a new context', () => {
    const httpRequest = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const { request, response } = new Context(httpRequest, new HttpResponse(httpRequest));

    expect(request).toMatchObject({
      protocol: 'HTTP/1.1',
      method: 'GET',
      path: '/',
      headers: { Host: 'localhost:5000', 'User-Agent': 'curl/7.64.1', Accept: '*/*' },
      body: {},
      query: {},
      params: {},
    });

    expect(response).toMatchObject({
      statusCode: 200,
      headers: {
        Connection: 'keep-alive',
        Date: expect.any(String),
        'Keep-Alive': 'timeout=5, max=1000',
      },
      body: '',
    });
  });
});
