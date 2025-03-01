import type { IRoute } from '../types/Route.ts';
import type { IRequest, THttpMethod } from '../types/http/Request.ts';
import { HttpMethod } from '../constants/http.ts';
import { divideString } from '../utils/string.utils.ts';
import { RequestParser } from './RequestParser.ts';

/**
 * Handles HTTP request parsing and parameter extraction
 */
export class HttpRequest {
  readonly protocol: IRequest['protocol'];
  readonly method: IRequest['method'];
  readonly path: IRequest['path'];
  readonly headers: IRequest['headers'];
  readonly body: IRequest['body'];
  readonly query: IRequest['query'];
  params: IRequest['params'];

  private readonly requestParser = new RequestParser();

  constructor(request: string) {
    const { protocol, method, path, headers, body, query, params } = this._parseRequest(request);
    this.protocol = protocol;
    this.method = method;
    this.path = path;
    this.headers = headers;
    this.body = body;
    this.query = query;
    this.params = params;
  }

  private _parseRequest(request: string): IRequest {
    /**
     * Validate the request
     */
    if (!request) throw new Error('Invalid request');

    /**
     * The request is a string that contains the following information:
     * - The first line contains the request method, path, and protocol
     * - The headers are separated from the body by two newlines
     */
    const [firstLine, rest] = divideString(request, '\r\n');
    const [method, path, protocol] = <[THttpMethod, string, string]>firstLine.split(' ', 3);
    const [headersRaw, bodyRaw] = divideString(rest, '\r\n\r\n');

    const parsedHeaders = this.requestParser.parseHeaders(headersRaw);
    const parsedQuery = this.requestParser.parseQuery(path);

    let parsedBody: IRequest['body'] = {};
    if (bodyRaw && method !== HttpMethod.GET && method !== HttpMethod.HEAD) {
      parsedBody = this.requestParser.parseBody(parsedHeaders, bodyRaw);
    }

    return {
      protocol,
      method,
      path,
      headers: parsedHeaders,
      body: parsedBody,
      query: parsedQuery,
      params: {},
    };
  }

  parseParams(route: IRoute): void {
    this.params = this.requestParser.parseParams(route, this.path);
  }
}
