import dayjs from 'dayjs';
import type { IHeaders, IResponse, THttpStatus, THttpStatusCode, TResponseBody } from 'types/http/Response.ts';
import { calculateContentLength } from 'utils/string.utils.ts';
import { ContentType, HttpStatus, HttpStatusCode } from 'constants/http.ts';
import type { Request } from 'core/Request.ts';

/**
 * Handles HTTP response creation, manipulation, and formatting
 */
export class Response {
  protected readonly protocol: IResponse['protocol'];
  protected readonly method: IResponse['method'];
  protected readonly path: IResponse['path'];
  protected status: IResponse['status'];
  protected statusCode: IResponse['statusCode'];
  protected statusText: string;
  protected headers: IResponse['headers'] = {};

  /**
   * Stores the original response body in its native format (object, string, etc.)
   *
   * This property preserves the original data structure and type information,
   * which is useful for:
   * 1. Maintaining type safety throughout the response lifecycle
   * 2. Allowing for potential modifications before final formatting
   * 3. Enabling different serialization strategies if needed
   * 4. Debugging and introspection of the original data
   */
  protected body: IResponse['body'] = '';

  /**
   * Stores the pre-formatted string representation of the body
   *
   * This property is essential for:
   * 1. Ensuring consistent string representation across the response
   * 2. Avoiding redundant formatting operations when the response is used multiple times
   * 3. Accurate Content-Length calculation based on the actual bytes to be sent
   * 4. Preventing type errors when using the body in string contexts (like template literals)
   *
   * The underscore prefix indicates this is an internal implementation detail
   * that should not be accessed directly from outside the class.
   */
  protected _formattedBody = '';

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
  constructor(request: Request) {
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

  /**
   * Add multiple headers to the response
   */
  addHeaders(headers: Array<IResponse['headers']>): void {
    for (const header of headers) {
      this.headers = { ...this.headers, ...header };
    }
  }

  /**
   * Remove multiple headers from the response
   */
  removeHeaders(headers: Array<keyof IHeaders>): void {
    for (const header of headers) delete this.headers[header];
  }

  /**
   * Modify a single header in the response
   */
  modifyHeader(header: keyof IHeaders, value: string): void {
    this.headers[header] = value;
  }

  /**
   * Set the HTTP status code and corresponding status text
   */
  setStatus(status: THttpStatusCode): void {
    // Map of status codes to their corresponding status and text
    const statusMap: Record<THttpStatusCode, { status: THttpStatus; text: string }> = {
      [HttpStatusCode.OK]: { status: HttpStatus.OK, text: HttpStatus.OK },
      [HttpStatusCode.CREATED]: { status: HttpStatus.CREATED, text: HttpStatus.CREATED },
      [HttpStatusCode.NO_CONTENT]: { status: HttpStatus.NO_CONTENT, text: HttpStatus.NO_CONTENT },
      [HttpStatusCode.BAD_REQUEST]: { status: HttpStatus.BAD_REQUEST, text: HttpStatus.BAD_REQUEST },
      [HttpStatusCode.UNAUTHORIZED]: { status: HttpStatus.UNAUTHORIZED, text: HttpStatus.UNAUTHORIZED },
      [HttpStatusCode.FORBIDDEN]: { status: HttpStatus.FORBIDDEN, text: HttpStatus.FORBIDDEN },
      [HttpStatusCode.NOT_FOUND]: { status: HttpStatus.NOT_FOUND, text: HttpStatus.NOT_FOUND },
      [HttpStatusCode.METHOD_NOT_ALLOWED]: { status: HttpStatus.METHOD_NOT_ALLOWED, text: HttpStatus.METHOD_NOT_ALLOWED },
      [HttpStatusCode.CONFLICT]: { status: HttpStatus.CONFLICT, text: HttpStatus.CONFLICT },
      [HttpStatusCode.UNSUPPORTED_MEDIA_TYPE]: { status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, text: HttpStatus.UNSUPPORTED_MEDIA_TYPE },
      [HttpStatusCode.TOO_MANY_REQUESTS]: { status: HttpStatus.TOO_MANY_REQUESTS, text: HttpStatus.TOO_MANY_REQUESTS },
      [HttpStatusCode.INTERNAL_SERVER_ERROR]: { status: HttpStatus.INTERNAL_SERVER_ERROR, text: HttpStatus.INTERNAL_SERVER_ERROR },
    };

    // Get the status and text from the map, or default to OK
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const statusInfo = statusMap[status] || statusMap[HttpStatusCode.OK];

    this.statusCode = status;
    this.status = statusInfo.status;
    this.statusText = statusInfo.text;
  }

  /**
   * Set the response body and update Content-Length header
   */
  setBody(body: TResponseBody<unknown>): void {
    // Store the original body
    this.body = body;

    // Format the body and store the formatted version
    this._formattedBody = this._formatResponseBody(body);

    // By default, we keep JSON as the Content-Type for all responses
    // The user can override this with text(), html(), etc. if needed
    if (!this.headers['Content-Type']) {
      this.headers['Content-Type'] = ContentType.JSON;
    }

    // Update Content-Length header
    this.headers['Content-Length'] = String(calculateContentLength(this._formattedBody));
  }

  /**
   * Format the complete HTTP response as a string
   */
  formatHttpResponse(): string {
    const statusLine = `${this.protocol} ${this.statusCode} ${String(this.status)}`;

    // Format headers
    const headerLines = Object.entries(this.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');

    // Return the complete response using the formatted body
    return `${statusLine}\r\n${headerLines}\r\n\r\n${this._formattedBody}`;
  }

  /**
   * Format a response body as a string
   * @private Internal method for formatting the response body
   */
  private _formatResponseBody(body: TResponseBody<unknown>): string {
    // Handle null explicitly
    if (body === null) return 'null';

    // Handle different types
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (typeof body) {
      case 'string':
        return body;
      case 'object':
        return JSON.stringify(body);
      default:
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return String(body);
    }
  }
}
