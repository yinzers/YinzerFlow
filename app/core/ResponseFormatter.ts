import { calculateContentLength } from 'utils/string.utils.ts';
import type { TResponseBody } from 'types/http/Response.ts';

/**
 * Handles formatting of HTTP responses
 */
export class ResponseFormatter {
  /**
   * Format a response body as a string
   */
  formatResponseBody(body: TResponseBody<unknown>): string {
    if (typeof body === 'string') return body;
    if (typeof body === 'object') return JSON.stringify(body);
    return String(body);
  }

  /**
   * Format a complete HTTP response
   */
  formatHttpResponse(statusCode: number, headers: Record<string, string>, body: TResponseBody<unknown>): string {
    const formattedBody = this.formatResponseBody(body);
    const contentLength = calculateContentLength(formattedBody);

    // Combine headers with content length
    const allHeaders = {
      ...headers,
      'Content-Length': contentLength.toString(),
    };

    // Format headers
    const headerLines = Object.entries(allHeaders)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');

    // Format the complete response
    return `HTTP/1.1 ${statusCode}\r\n${headerLines}\r\n\r\n${formattedBody}`;
  }
}
