import { describe, expect, it } from 'bun:test';
import { HttpRequest } from 'core/HttpRequest.ts';
import { HttpResponse } from 'core/HttpResponse.ts';
import { HttpStatusCode } from 'constants/http.ts';

describe('HttpResponse', () => {
  it('should create a new HttpResponse', () => {
    const request = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const response = new HttpResponse(request);

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

  it('should set the status code', () => {
    const request = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const response = new HttpResponse(request);

    response.setStatus(HttpStatusCode.NOT_FOUND);

    expect(response).toMatchObject({
      statusCode: 404,
      status: 'Not Found',
    });
  });

  it('should return a string body and set the appropriate headers', () => {
    const request = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const response = new HttpResponse(request);

    response.setBody('Not Found');

    expect(response).toMatchObject({
      headers: {
        Connection: 'keep-alive',
        Date: expect.any(String),
        'Keep-Alive': 'timeout=5, max=1000',
        'Content-Length': '9',
        'Content-Type': 'text/plain',
      },
      body: 'Not Found',
    });
  });

  it('should return an object body and set the appropriate headers', () => {
    const request = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const response = new HttpResponse(request);

    response.setBody({ success: false, message: 'Not Found' });

    expect(response).toMatchObject({
      headers: {
        Connection: 'keep-alive',
        Date: expect.any(String),
        'Keep-Alive': 'timeout=5, max=1000',
        'Content-Length': '39',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, message: 'Not Found' }),
    });
  });

  it('should add the headers authorization and origin', () => {
    const request = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const response = new HttpResponse(request);

    response.addHeaders([
      {
        Age: '12',
        Origin: 'localhost',
      },
    ]);

    // @ts-expect-error - response.headers is protected
    expect(response.headers).toMatchObject({
      Connection: 'keep-alive',
      Date: expect.any(String),
      'Keep-Alive': 'timeout=5, max=1000',
      Age: '12',
      Origin: 'localhost',
    });
  });

  it('should remove the Date header', () => {
    const request = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const response = new HttpResponse(request);

    response.removeHeaders(['Date']);

    // @ts-expect-error - response.headers is protected
    expect(response.headers).toMatchObject({
      Connection: 'keep-alive',
      'Keep-Alive': 'timeout=5, max=1000',
    });
  });

  it('should return the response as a string', () => {
    const request = new HttpRequest('GET / HTTP/1.1\r\nHost: localhost:5000\r\nUser-Agent: curl/7.64.1\r\nAccept: */*\r\n\r\n');
    const response = new HttpResponse(request);

    response.setBody('Not Found');

    const formattedResponse = response.formatHttpResponse();
    expect(formattedResponse).toContain('HTTP/1.1 200 OK');
    expect(formattedResponse).toContain('Content-Type: text/plain');
    expect(formattedResponse).toContain('Content-Length: 9');
    expect(formattedResponse).toContain('Not Found');
  });
});
