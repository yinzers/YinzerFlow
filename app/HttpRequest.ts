import type { IHeaders } from 'root/HttpResponse.ts';
import type { Enum, IRoute } from 'root/index.ts';
import divideStringUtils from 'utils/divideString.utils.ts';
import parseRequestBodyUtils from 'utils/parseRequestBody.utils.ts';
import parseRequestHeadersUtils from 'utils/parseRequestHeaders.utils.ts';
import parseRequestParamsUtils from 'utils/parseRequestParams.utils.ts';
import parseRequestQueryUtils from 'utils/parseRequestQuery.utils.ts';

export const HttpMethod = <const>{
  DELETE: 'DELETE',
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};
export type THttpMethod = Enum<typeof HttpMethod>;

export type TRequestBody<T = unknown> = T;
export type TRequestQuery<T = unknown> = T;
export type TRequestParams<T = unknown> = T;

export interface IRequest {
  protocol: string;
  method: THttpMethod;
  path: string;
  headers: IHeaders;
  body: TRequestBody | object;

  query: TRequestQuery | object;

  params: TRequestParams | object;
}

export default class HttpRequest {
  readonly protocol: IRequest['protocol'];
  readonly method: IRequest['method'];
  readonly path: IRequest['path'];
  readonly headers: IRequest['headers'];
  readonly body: IRequest['body'];
  readonly query: IRequest['query'];
  params: IRequest['params'];

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
    const [firstLine, rest] = divideStringUtils(request, '\r\n');
    const [method, path, protocol] = <[THttpMethod, string, string]>firstLine.split(' ', 3);
    const [headers, body] = divideStringUtils(rest, '\r\n\r\n');

    const parsedHeaders: IRequest['headers'] = parseRequestHeadersUtils(headers);
    const parsedQuery: IRequest['query'] = parseRequestQueryUtils(path);

    let parsedBody: IRequest['body'] = {};
    if (body) parsedBody = parseRequestBodyUtils(parsedHeaders, body);

    /**
     * If the request method is GET or HEAD, the request body is empty
     * This is because GET and HEAD requests are used to retrieve information from the server
     * but do not send any data to the server
     */
    if (method === HttpMethod.GET || method === HttpMethod.HEAD) {
      return { protocol, method, path, headers: parsedHeaders, query: parsedQuery, params: {}, body: {} };
    }
    return { protocol, method, path, headers: parsedHeaders, body: parsedBody, query: parsedQuery, params: {} };
  }

  parseParams(route: IRoute): void {
    this.params = parseRequestParamsUtils(this.path, route);
  }
}
