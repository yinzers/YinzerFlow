import dayjs from 'dayjs';
import { formatBodyIntoString } from '@core/execution/utils/formatBodyIntoString.ts';
import { determineEncoding } from '@core/execution/utils/determineEncoding.ts';
import { inferContentType } from '@core/execution/utils/inferContentType.ts';
import { mapStatusCodeToMessage } from '@core/execution/utils/mapStatusCodeToMessage.ts';
import { filterAndValidateHeaders } from '@core/execution/utils/validateResponseHeaders.ts';
import { httpEncoding, httpStatus, httpStatusCode } from '@constants/http.ts';
import type { InternalHttpEncoding, InternalHttpHeaders, InternalHttpStatus, InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { Request } from '@typedefs/public/Request.ts';
import type { InternalResponseImpl } from '@typedefs/internal/InternalResponseImpl.d.ts';
import { determineContentLength } from '@core/execution/utils/determineContentLength.ts';

export class ResponseImpl implements InternalResponseImpl {
  readonly _request: Request;

  _statusCode: InternalHttpStatusCode = httpStatusCode.ok;
  _status: InternalHttpStatus = httpStatus.ok;
  _headers: Partial<Record<InternalHttpHeaders, string>> = {};
  _body: unknown = '';
  _stringBody = '';
  _encoding: InternalHttpEncoding = httpEncoding.utf8;

  constructor(request: Request) {
    this._request = request;
    this._setSecurityHeaders();
  }

  _parseResponseIntoString(): void {
    // Example: HTTP/1.1 200 OK
    const statusLine = `${this._request.protocol} ${this._statusCode} ${this._status}`;

    // Example: Content-Type: text/html
    const headerLines = Object.entries(this._headers).map(([key, value]) => `${key}: ${value}`);

    // Determine encoding based on Content-Type header and body content
    const encoding = determineEncoding(this._headers['content-type'], this._body);

    // Example: <html><body><h1>Hello, world!</h1></body></html> or { "message": "Hello, world!" }
    const body = formatBodyIntoString(this._body, { encoding });

    // Example: HTTP/1.1 200 OK\nContent-Type: text/html\n\n<html><body><h1>Hello, world!</h1></body></html>
    this._encoding = encoding;
    this._stringBody = `${statusLine}\n${headerLines.join('\n')}\n\n${body}`;

    const contentLength = determineContentLength(this._stringBody, this._encoding);
    this._setHeadersIfNotSet({
      Date: dayjs().format('ddd, DD MMM YYYY HH:mm:ss [GMT]'),
      'Content-Length': contentLength,
    });
  }

  _setHeadersIfNotSet(headers: Partial<Record<InternalHttpHeaders, string>>): void {
    // SECURITY: Filter undefined values and validate response headers for CRLF injection
    // Only validate headers that aren't already set
    const headersToSet: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined && !(key in this._headers)) {
        headersToSet[key] = value;
      }
    }

    const validatedHeaders = filterAndValidateHeaders(headersToSet);

    // Set headers after validation passes
    Object.assign(this._headers, validatedHeaders);
  }

  _setBody(body: unknown): void {
    this._body = body;

    // Auto-set content-type if not already set
    if (!this._headers['content-type']) {
      const detectedContentType = inferContentType(body);
      this._setHeadersIfNotSet({
        'Content-Type': detectedContentType,
      });
    }
  }

  setStatusCode(statusCode: InternalHttpStatusCode): void {
    this._statusCode = statusCode;
    this._status = mapStatusCodeToMessage(statusCode);
  }

  addHeaders(headers: Partial<Record<InternalHttpHeaders, string>>): void {
    // SECURITY: Filter undefined values and validate response headers for CRLF injection
    const validatedHeaders = filterAndValidateHeaders(headers);

    // Set headers after validation passes
    this._headers = { ...this._headers, ...validatedHeaders };
  }

  removeHeaders(headerNames: Array<InternalHttpHeaders>): void {
    for (const headerName of headerNames) {
      delete this._headers[headerName];
    }
  }

  /**
   * Set default security headers to protect against common vulnerabilities
   * These headers are set only if not already present, allowing users to override if needed
   */
  _setSecurityHeaders(): void {
    this._setHeadersIfNotSet({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
  }
}
