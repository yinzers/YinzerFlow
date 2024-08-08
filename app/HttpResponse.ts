import dayjs from 'dayjs';
import type { THttpMethod } from 'root/HttpRequest.ts';
import type HttpRequest from 'root/HttpRequest.ts';
import type { Enum } from 'root/index.ts';
import calculateContentLength from 'utils/calculateContentLength.utils.ts';

export const HttpStatus = <const>{
  OK: 'OK',
  CREATED: 'Created',
  NO_CONTENT: 'No Content',
  BAD_REQUEST: 'Bad Request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not Found',
  METHOD_NOT_ALLOWED: 'Method Not Allowed',
  TOO_MANY_REQUESTS: 'Too Many Requests',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
};

export type THttpStatus = Enum<typeof HttpStatus>;

export const HttpStatusCode = <const>{
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

export type THttpStatusCode = Enum<typeof HttpStatusCode>;

interface IHeaders {
  /* eslint-disable @typescript-eslint/naming-convention */
  /** ======================================== Authentication ============================================ */
  /**
   * Contains the credentials to authenticate a user-agent with a server.
   */
  Authorization?: string;
  /**
   * Contains the credentials to authenticate a user-agent with a proxy server.
   */
  Proxy_Authorization?: string;
  /**
   * Defines the authentication method that should be used to access a resource.
   */
  'WWW-Authenticate'?: string;
  /** ======================================== Caching ============================================ */
  /**
   * The time, in seconds, that the object has been in a proxy cache.
   */
  Age?: string;
  /**
   * Specifies directives for caching mechanisms in both requests and responses.
   */
  'Cache-Control'?: string;
  /**
   * Clears browsing data (e.g. cookies, storage, cache) associated with the requesting website.
   */
  'Clear-Site-Data'?: string;
  /**
   * The date/time after which the response is considered stale.
   */
  Expires?: string;
  /**
   * Specifies a set of rules that define how a URL's query parameters will affect cache matching.
   * These rules dictate whether the same URL with different URL parameters should be saved as separate browser cache entries.
   */
  'No-Vary-Search'?: string;
  /** ======================================== Conditionals ============================================ */
  'Last-Modified'?: string;
  ETag?: string;
  'If-Match'?: string;
  'If-None-Match'?: string;
  'If-Modified-Since'?: string;
  'If-Unmodified-Since'?: string;
  Vary?: string;
  /** ======================================== Connection management ============================================ */
  Connection?: string;
  'Keep-Alive'?: string;
  /** ======================================== Content negotiation ============================================ */
  Accept?: string;
  'Accept-Encoding'?: string;
  'Accept-Language'?: string;
  /** ======================================== Controls ============================================ */
  Expect?: string;
  'Max-Forwards'?: string;
  /** ======================================== Cookies ============================================ */
  Cookie?: string;
  'Set-Cookie'?: string;
  /** ======================================== CORS ============================================ */
  'Access-Control-Allow-Credentials'?: string;
  'Access-Control-Allow-Methods'?: string;
  'Access-Control-Allow-Headers'?: string;
  'Access-Control-Allow-Origin'?: string;
  'Access-Control-Expose-Headers'?: string;
  'Access-Control-Max-Age'?: string;
  'Access-Control-Request-Headers'?: string;
  'Access-Control-Request-Method'?: string;
  Origin?: string;
  'Timing-Allow-Origin'?: string;
  /** ======================================== Downloads ============================================ */
  'Content-Disposition'?: string;
  /** ======================================== Message body information ============================================ */
  'Content-Length'?: string;
  'Content-Type'?: string | 'application/json' | 'text/html' | 'text/plain';
  'Content-Encoding'?: string;
  'Content-Language'?: string;
  'Content-Location'?: string;
  /** ======================================== Proxies ============================================ */
  Forwarded?: string;
  Via?: string;
  /** ======================================== Redirects ============================================ */
  Location?: string;
  Refresh?: string;
  /** ======================================== Request context ============================================ */
  From?: string;
  Host?: string;
  Referer?: string;
  'Referrer-Policy'?: string;
  'User-Agent'?: string;
  /** ======================================== Response context ============================================ */
  Allow?: string;
  Server?: string;
  /** ======================================== Range requests ============================================ */
  Range?: string;
  'Accept-Ranges'?: string;
  'Content-Range'?: string;
  'If-Range'?: string;
  /** ======================================== Security ============================================ */
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
  'Content-Security-Policy'?: string;
  'Content-Security-Policy-Report-Only'?: string;
  'Permissions-Policy'?: string;
  'Strict-Transport-Security'?: string;
  'Upgrade-Insecure-Requests'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frames-Options'?: string;
  'X-Permitted-Cross-Domain-Policies'?: string;
  'X-Powered-By'?: string;
  'X-XSS-Protection'?: string;
  /** ======================================== Server-sent events ============================================ */
  'Report-To'?: string;
  /** ======================================== Transfer coding ============================================ */
  TE?: string;
  Trailer?: string;
  'Transfer-Encoding'?: string;
  /** ======================================== Other ================================= */
  'Alt-Svc'?: string;
  'Alt-Used'?: string;
  Date?: string;
  Link?: string;
  'Retry-After'?: string;
  'Server-Timing'?: string;
  'Service-Worker-Allowed'?: string;
  SourceMap?: string;
  Upgrade?: string;
  Priority?: string;
  /** ======================================== Privacy ================================= */
  /**
   * Indicates whether the user consents to a website or service selling or sharing their personal information with third parties.
   */
  'Sec-GPC'?: string;
  /* eslint-enable @typescript-eslint/naming-convention */
}
export type TResponseBody<T> = T;

interface IResponse {
  status: THttpStatus;
  statusCode: THttpStatusCode;
  protocol: string;
  method: THttpMethod;
  path: string;
  headers: IHeaders;
  body: TResponseBody<unknown>;
}

export default class HttpResponse {
  protected readonly protocol: IResponse['protocol'];
  protected readonly method: IResponse['method'];
  protected readonly path: IResponse['path'];
  protected status: IResponse['status'];
  protected statusCode: IResponse['statusCode'];
  protected headers: IResponse['headers'] = {};
  protected body: IResponse['body'] = '';

  /**
   * Default status is 200 OK
   *
   * Default headers are:
   * - Server: YinzerFlow
   * - Content-Type: text/plain (If the content is an object, it will be stringified and the Content-Type will be application/json)
   * - Date: Current date in UTC
   * - Connection: keep-alive
   * - Keep-Alive: timeout=5, max=1000
   */
  constructor(request: HttpRequest) {
    this.method = request.method;
    this.path = request.path;
    this.protocol = request.protocol;
    this.statusCode = HttpStatusCode.OK;
    this.status = HttpStatus.OK;
    this.headers = {
      Date: dayjs().format('ddd, DD MMM YYYY HH:mm:ss [GMT]'),
      Connection: 'keep-alive',
      'Keep-Alive': 'timeout=5, max=1000',
    };
  }

  addHeaders(headers: Array<IResponse['headers']>): void {
    for (const header of headers) {
      this.headers = { ...this.headers, ...header };
    }
  }
  removeHeaders(headers: Array<keyof IHeaders>): void {
    for (const header of headers) delete this.headers[header];
  }
  setStatus(status: THttpStatusCode): void {
    switch (status) {
      case HttpStatusCode.OK:
        this.statusCode = HttpStatusCode.OK;
        this.status = HttpStatus.OK;
        break;
      case HttpStatusCode.CREATED:
        this.statusCode = HttpStatusCode.CREATED;
        this.status = HttpStatus.CREATED;
        break;
      case HttpStatusCode.BAD_REQUEST:
        this.statusCode = HttpStatusCode.BAD_REQUEST;
        this.status = HttpStatus.BAD_REQUEST;
        break;
      case HttpStatusCode.UNAUTHORIZED:
        this.statusCode = HttpStatusCode.UNAUTHORIZED;
        this.status = HttpStatus.UNAUTHORIZED;
        break;
      case HttpStatusCode.FORBIDDEN:
        this.statusCode = HttpStatusCode.FORBIDDEN;
        this.status = HttpStatus.FORBIDDEN;
        break;
      case HttpStatusCode.NOT_FOUND:
        this.statusCode = HttpStatusCode.NOT_FOUND;
        this.status = HttpStatus.NOT_FOUND;
        break;
      case HttpStatusCode.METHOD_NOT_ALLOWED:
        this.statusCode = HttpStatusCode.METHOD_NOT_ALLOWED;
        this.status = HttpStatus.METHOD_NOT_ALLOWED;
        break;
      case HttpStatusCode.TOO_MANY_REQUESTS:
        this.statusCode = HttpStatusCode.TOO_MANY_REQUESTS;
        this.status = HttpStatus.TOO_MANY_REQUESTS;
        break;
      case HttpStatusCode.INTERNAL_SERVER_ERROR:
        this.statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
        this.status = HttpStatus.INTERNAL_SERVER_ERROR;
        break;
      default:
        throw new Error('Invalid status or status argument not set');
    }
  }

  setBody(body: TResponseBody<unknown>): void {
    this.body = body;

    if (typeof body === 'object') {
      this.addHeaders([{ 'Content-Type': 'application/json', 'Content-Length': String(calculateContentLength(JSON.stringify(body))) }]);
    }

    if (typeof body === 'string' && body.includes('<html>')) {
      this.addHeaders([{ 'Content-Type': 'text/html', 'Content-Length': String(calculateContentLength(body)) }]);
      return void 0;
    }

    if (typeof body === 'string') {
      this.addHeaders([{ 'Content-Type': 'text/plain', 'Content-Length': String(calculateContentLength(body)) }]);
    }
  }

  formatHttpResponse(): string {
    let { body } = this;
    if (typeof body === 'object') body = JSON.stringify(this.body);

    const formattedHeaders = Object.entries(this.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');

    return `HTTP/1.1 ${this.statusCode} ${this.status}\r\n${formattedHeaders}\r\n\r\n${String(body)}`;
  }
}
