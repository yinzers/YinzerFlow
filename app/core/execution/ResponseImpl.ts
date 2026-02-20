import { formatBodyIntoString } from '@core/execution/utils/formatBodyIntoString.ts';
import { determineEncoding } from '@core/execution/utils/determineEncoding.ts';
import { inferContentType } from '@core/execution/utils/inferContentType.ts';
import { mapStatusCodeToMessage } from '@core/execution/utils/mapStatusCodeToMessage.ts';
import { filterAndValidateHeaders } from '@core/execution/utils/validateResponseHeaders.ts';
import { httpEncoding, httpStatus, httpStatusCode } from '@constants/http.ts';
import type { InternalHttpEncoding, InternalHttpHeaders, InternalHttpStatus, InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { Request } from '@typedefs/public/Request.ts';
import type { InternalResponseImpl } from '@typedefs/internal/InternalResponseImpl.d.ts';

/** Format current time as HTTP Date header (RFC 7231 §7.1.1.1) */
const _formatHttpDate = (): string => {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${days[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`;
};

/** Cached HTTP Date header — refreshed every second. Avoids Date allocation per response. */
let _cachedDateHeader = _formatHttpDate();
const _dateRefreshTimer = setInterval(() => {
  _cachedDateHeader = _formatHttpDate();
}, 1000);
_dateRefreshTimer.unref();

export class ResponseImpl implements InternalResponseImpl {
  readonly _request: Request;

  _statusCode: InternalHttpStatusCode = httpStatusCode.ok;
  _status: InternalHttpStatus = httpStatus.ok;
  _headers: Partial<Record<InternalHttpHeaders, string>> = {};
  _setCookies: Array<string> = []; // Track multiple Set-Cookie headers
  _body: unknown = '';
  _stringBody = '';
  _encoding: InternalHttpEncoding = httpEncoding.utf8;

  constructor(request: Request) {
    this._request = request;
    this._setSecurityHeaders();
  }

  _parseResponseIntoString(): void {
    const statusLine = `${this._request.protocol} ${this._statusCode} ${this._status}`;
    const encoding = determineEncoding(this._headers['content-type'], this._body);
    const body = formatBodyIntoString(this._body, { encoding });

    // Set Date + Content-Length BEFORE assembling headers into the response string.
    // Content-Length = body bytes only (not status line + headers), per HTTP/1.1 spec.
    this._setHeadersIfNotSet({
      Date: _cachedDateHeader,
      'Content-Length': String(Buffer.byteLength(body, 'utf8')),
    });

    this._encoding = encoding;

    const headerLines = Object.entries(this._headers).map(([key, value]) => `${key}: ${value}`);
    const setCookieLines = this._setCookies.map((value) => `Set-Cookie: ${value}`);
    const allHeaderLines = [...headerLines, ...setCookieLines];
    const headersSection = allHeaderLines.length > 0 ? `${allHeaderLines.join('\r\n')}\r\n` : '';

    this._stringBody = `${statusLine}\r\n${headersSection}\r\n${body}`;
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

    // Handle Set-Cookie specially - support multiple values
    for (const [key, value] of Object.entries(validatedHeaders)) {
      if (key === 'Set-Cookie') {
        if (value) {
          this._setCookies.push(value);
        }
      } else {
        // Regular headers overwrite if duplicate
        this._headers[key] = value;
      }
    }
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
