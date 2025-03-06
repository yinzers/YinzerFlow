import dayjs from 'dayjs';
import type { IHeaders, IResponse, THttpStatusCode, TResponseBody } from '../types/http/Response.ts';
import { calculateContentLength } from '../utils/string.utils.ts';
import { ContentType, HttpStatus, HttpStatusCode } from '../constants/http.ts';
import type { HttpRequest } from './HttpRequest.ts';

/**
 * Handles HTTP response formatting and status management
 */
export class HttpResponse {
  protected readonly protocol: IResponse['protocol'];
  protected readonly method: IResponse['method'];
  protected readonly path: IResponse['path'];
  protected status: IResponse['status'];
  protected statusCode: IResponse['statusCode'];
  protected statusText: string;
  protected headers: IResponse['headers'] = {};
  protected body: IResponse['body'] = '';

  // TODO - add cookie support

  /**
   * Default status is 200 OK
   *
   * Default headers are:
   * - Date: Current date in UTC
   * - Connection: keep-alive
   * - Keep-Alive: timeout=5, max=1000
   * - Content-Type: application/json (Default for API responses)
   * - Content-Length: 0 (Default for empty body)
   */
  constructor(request: HttpRequest) {
    this.method = request.method;
    this.path = request.path;
    this.protocol = request.protocol;
    this.statusCode = HttpStatusCode.OK;
    this.status = HttpStatus.OK;
    this.statusText = HttpStatus.OK;
    this.headers = {
      Date: dayjs().format('ddd, DD MMM YYYY HH:mm:ss [GMT]'),
      Connection: 'keep-alive',
      'Keep-Alive': 'timeout=5, max=1000',
      'Content-Type': ContentType.JSON, // Default to JSON for API responses
      'Content-Length': '0', // Default for empty body
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

  modifyHeader(header: keyof IHeaders, value: string): void {
    this.headers[header] = value;
  }

  setStatus(status: THttpStatusCode): void {
    switch (status) {
      case HttpStatusCode.OK:
        this.statusCode = HttpStatusCode.OK;
        this.status = HttpStatus.OK;
        this.statusText = HttpStatus.OK;
        break;
      case HttpStatusCode.CREATED:
        this.statusCode = HttpStatusCode.CREATED;
        this.status = HttpStatus.CREATED;
        this.statusText = HttpStatus.CREATED;
        break;
      case HttpStatusCode.BAD_REQUEST:
        this.statusCode = HttpStatusCode.BAD_REQUEST;
        this.status = HttpStatus.BAD_REQUEST;
        this.statusText = HttpStatus.BAD_REQUEST;
        break;
      case HttpStatusCode.UNAUTHORIZED:
        this.statusCode = HttpStatusCode.UNAUTHORIZED;
        this.status = HttpStatus.UNAUTHORIZED;
        this.statusText = HttpStatus.UNAUTHORIZED;
        break;
      case HttpStatusCode.FORBIDDEN:
        this.statusCode = HttpStatusCode.FORBIDDEN;
        this.status = HttpStatus.FORBIDDEN;
        this.statusText = HttpStatus.FORBIDDEN;
        break;
      case HttpStatusCode.NOT_FOUND:
        this.statusCode = HttpStatusCode.NOT_FOUND;
        this.status = HttpStatus.NOT_FOUND;
        this.statusText = HttpStatus.NOT_FOUND;
        break;
      case HttpStatusCode.METHOD_NOT_ALLOWED:
        this.statusCode = HttpStatusCode.METHOD_NOT_ALLOWED;
        this.status = HttpStatus.METHOD_NOT_ALLOWED;
        this.statusText = HttpStatus.METHOD_NOT_ALLOWED;
        break;
      case HttpStatusCode.TOO_MANY_REQUESTS:
        this.statusCode = HttpStatusCode.TOO_MANY_REQUESTS;
        this.status = HttpStatus.TOO_MANY_REQUESTS;
        this.statusText = HttpStatus.TOO_MANY_REQUESTS;
        break;
      case HttpStatusCode.INTERNAL_SERVER_ERROR:
        this.statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
        this.status = HttpStatus.INTERNAL_SERVER_ERROR;
        this.statusText = HttpStatus.INTERNAL_SERVER_ERROR;
        break;
      default:
        this.statusCode = HttpStatusCode.OK;
        this.status = HttpStatus.OK;
        this.statusText = HttpStatus.OK;
        break;
    }
  }

  setBody(body: TResponseBody<unknown>): void {
    // Format the body based on its type
    if (typeof body === 'object') {
      const formattedBody = JSON.stringify(body);
      this.body = formattedBody;
      this.headers['Content-Length'] = String(calculateContentLength(formattedBody));
    } else {
      const formattedBody = String(body);
      this.body = formattedBody;

      // By default, we keep JSON as the Content-Type for all responses
      // The user can override this with text(), html(), etc. if needed
      if (!this.headers['Content-Type']) {
        this.headers['Content-Type'] = ContentType.JSON;
      }

      this.headers['Content-Length'] = String(calculateContentLength(formattedBody));
    }
  }

  formatHttpResponse(): string {
    const statusLine = `${this.protocol} ${this.statusCode} ${this.status}`;
    let formattedBody = '';

    if (this.body) {
      if (this.headers['Content-Type'] === ContentType.JSON) {
        formattedBody = typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
      } else {
        formattedBody = String(this.body);
      }
      this.headers['Content-Length'] = String(calculateContentLength(formattedBody));
    }

    const headerLines = Object.entries(this.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');

    return `${statusLine}\r\n${headerLines}\r\n\r\n${formattedBody}`;
  }
}
