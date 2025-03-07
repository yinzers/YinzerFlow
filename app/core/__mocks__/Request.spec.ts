import { HttpMethod } from '../../constants/http.ts';
import type { IHeaders } from '../../types/http/Response.ts';
import type { IRequest, THttpMethod, TRequestBody } from '../../types/http/Request.ts';

/**
 * A mock implementation of the Request class for testing
 */
export class MockRequest implements Partial<IRequest> {
  protocol: string;
  method: THttpMethod;
  path: string;
  headers: IHeaders;
  body: TRequestBody;
  query: Record<string, string>;
  params: Record<string, string>;

  constructor({ protocol = 'HTTP/1.1', method = HttpMethod.GET, path = '/', headers = {}, body = {}, query = {}, params = {} }: Partial<IRequest> = {}) {
    this.protocol = protocol;
    this.method = method;
    this.path = path;
    this.headers = headers;
    this.body = body;
    this.query = query as Record<string, string>;
    this.params = params as Record<string, string>;
  }

  /**
   * Creates a default mock request
   */
  static createDefault(): MockRequest {
    return new MockRequest();
  }

  /**
   * Creates a mock GET request
   */
  static createGet(path = '/', query = {}): MockRequest {
    return new MockRequest({ method: HttpMethod.GET, path, query });
  }

  /**
   * Creates a mock POST request
   */
  static createPost(path = '/', body = {}): MockRequest {
    return new MockRequest({
      method: HttpMethod.POST,
      path,
      body,
      headers: { 'Content-Type': 'application/json' } as IHeaders,
    });
  }
}
