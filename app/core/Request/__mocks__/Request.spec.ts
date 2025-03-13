import { HttpMethod } from '../../../constants/http.ts';
import type { Request } from '../Request.ts';

/**
 * Creates a mock Request object for testing
 *
 * @param method - HTTP method
 * @param path - Request path
 * @returns A mock Request object
 */
export const createMockRequest = (method: string = HttpMethod.GET, path = '/test'): Request =>
  ({
    method,
    path,
    params: {},
    query: {},
    headers: {},
    body: null,
  }) as unknown as Request;

/**
 * Mock Request class for testing Response
 */
export class MockRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
  params: Record<string, string>;
  query: Record<string, string>;
  protocol: string;

  constructor(
    options: {
      method?: string;
      path?: string;
      headers?: Record<string, string>;
      body?: any;
      params?: Record<string, string>;
      query?: Record<string, string>;
      protocol?: string;
    } = {},
  ) {
    this.method = options.method ?? HttpMethod.GET;
    this.path = options.path ?? '/';
    this.headers = options.headers ?? {};
    this.body = options.body ?? null;
    this.params = options.params ?? {};
    this.query = options.query ?? {};
    this.protocol = options.protocol ?? 'HTTP/1.1';
  }

  static createDefault(): MockRequest {
    return new MockRequest();
  }
}
