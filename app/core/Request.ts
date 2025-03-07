import type { IRoute } from '../types/Route.ts';
import type { IRequest, THttpMethod, TRequestBody } from '../types/http/Request.ts';
import { ContentType, HttpMethod } from '../constants/http.ts';
import { divideString } from '../utils/string.utils.ts';
import * as requestUtils from '../utils/request.utils.ts';

/**
 * Handles HTTP request parsing and parameter extraction
 */
export class Request {
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

  /**
   * Parse URL parameters from route pattern
   *
   * @param route - Route object containing path pattern
   * @param path - Actual request path
   * @returns Object with parsed parameters
   */
  parseParams = (route: IRoute): Record<string, string> => {
    const params: Record<string, string> = {};

    // Early returns for invalid inputs
    if (typeof route.path !== 'string') return params;
    if (typeof this.path !== 'string') return params;

    // Extract parameter names from route pattern
    const paramMatches = route.path.match(/:[^/]+/g);
    const paramNames = paramMatches ? paramMatches.map((param) => param.slice(1)) : [];

    if (paramNames.length === 0) return params;

    // Convert route pattern to regex with capture groups
    const pattern = route.path.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${pattern}$`);

    // Extract parameter values from path
    const match = this.path.match(regex);
    if (!match) return params;

    // Map parameter names to values (skip first match which is the full string)
    for (let i = 0; i < paramNames.length; i++) {
      const value = match[i + 1];
      const paramName = paramNames[i];

      // Only add to params if both value and paramName are defined
      if (value && paramName) {
        params[paramName] = value;
      }
    }

    return params;
  };

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

    const parsedHeaders = this._parseHeaders(headersRaw);
    const parsedQuery = this._parseQuery(path);

    let parsedBody: IRequest['body'] = {};
    if (bodyRaw && method !== HttpMethod.GET && method !== HttpMethod.HEAD) {
      parsedBody = this._parseBody(parsedHeaders, bodyRaw);
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

  /**
   * Parse request body based on Content-Type
   *
   * @param headers - Request headers containing Content-Type
   * @param body - Raw request body string
   * @returns Parsed request body object
   * @throws Error if Content-Type is missing or body format is invalid
   */
  private readonly _parseBody = (headers: IRequest['headers'], body: string): TRequestBody => {
    if (!headers['Content-Type']) {
      throw new Error('Missing Content-Type header');
    }

    const contentType = headers['Content-Type'];

    // Use a more efficient approach with early returns
    if (contentType === ContentType.JSON) {
      return requestUtils.handleApplicationJson(body);
    }

    if (contentType === ContentType.FORM) {
      return requestUtils.handleXwwwFormUrlencoded(body);
    }

    if (contentType.includes(ContentType.MULTIPART)) {
      return requestUtils.handleMultipartFormData(body);
    }

    if (contentType === ContentType.XML || contentType === 'text/xml') {
      return requestUtils.handleXml(body);
    }

    if (contentType === ContentType.TEXT) {
      return requestUtils.handlePlainText(body);
    }

    if (contentType === ContentType.URL_ENCODED_JSON) {
      return requestUtils.handleUrlEncodedJson(body);
    }

    if (contentType === ContentType.CSV || contentType === 'application/csv') {
      return requestUtils.handleCsv(body);
    }

    if (contentType === ContentType.YAML || contentType === 'application/x-yaml' || contentType === 'text/yaml') {
      return requestUtils.handleYaml(body);
    }

    // Default case - return empty object for unsupported content types
    return {};
  };

  /**
   * Parse request headers
   *
   * @param rawHeaders - Raw header string
   * @returns Object with parsed headers
   */
  private readonly _parseHeaders = (rawHeaders: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!rawHeaders) return headers;

    // Normalize line endings and split
    const normalizedHeaders = rawHeaders.replace(/\r\n|\r|\n/g, '\n');
    const headerLines = normalizedHeaders.split('\n');

    for (const line of headerLines) {
      if (!line) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (key) {
        headers[key] = value;
      }
    }

    return headers;
  };

  /**
   * Parse query parameters from URL
   *
   * @param url - URL string potentially containing query parameters
   * @returns Object with parsed query parameters
   */
  private readonly _parseQuery = (url: string): Record<string, string> => {
    if (!url) return {};

    if (!url.includes('?')) return {};

    const [, queryString] = url.split('?');
    if (!queryString) return {};

    const params: Record<string, string> = {};
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }

    return params;
  };
}
