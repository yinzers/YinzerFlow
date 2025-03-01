import type { IRequest, TRequestBody } from '../types/http/Request.ts';
import type { IRoute } from '../types/Route.ts';

/**
 * Handles parsing of HTTP request components
 *
 * This class encapsulates all request parsing logic:
 * - Body parsing (JSON, form data, multipart)
 * - Header parsing
 * - Query parameter parsing
 * - URL parameter parsing
 */
export class RequestParser {
  /**
   * Parse request body based on Content-Type
   */
  parseBody(headers: IRequest['headers'], body: string): TRequestBody {
    if (!headers['Content-Type']) throw new Error('Missing Content-Type header');

    let parsedBody: TRequestBody = {};
    if (headers['Content-Type'] === 'application/json') parsedBody = this.handleApplicationJson(body);

    if (headers['Content-Type'] === 'application/x-www-form-urlencoded') parsedBody = this.handleXwwwFormUrlencoded(body);

    if (headers['Content-Type'].includes('multipart/form-data')) parsedBody = this.handleMultipartFormData(body);

    return parsedBody;
  }

  /**
   * Parse JSON request body
   */
  private handleApplicationJson(body: string): TRequestBody {
    try {
      return <TRequestBody>JSON.parse(body);
    } catch (_error) {
      throw new Error('Invalid body');
    }
  }

  /**
   * Parse form-urlencoded request body
   */
  private handleXwwwFormUrlencoded(body: string): TRequestBody {
    const parsedBody: TRequestBody<Record<string, unknown>> = {};

    for (const pair of body.split('&')) {
      if (!pair) continue;
      const [key, value] = pair.split('=', 2);
      if (!key || !value) continue;
      Object.assign(parsedBody, { [key]: value });
    }

    return parsedBody;
  }

  /**
   * Parse multipart form data request body
   */
  private handleMultipartFormData(body: string): TRequestBody {
    const parsedBody = {};

    if (body.includes('Content-Type')) throw new Error('Body type not supported yet');

    const parts = body.split('Content-Disposition: form-data;');
    for (const part of parts) {
      if (!part.includes('name')) continue;
      let [, key] = part.split('name="', 2);
      if (!key) continue;
      [key] = key.split('"', 1);
      if (!key) continue;

      let [, value] = part.split('\r\n\r\n', 2);
      if (!value) continue;
      value = value.slice(0, value.indexOf('\r\n'));

      Object.assign(parsedBody, { [key]: value });
    }

    return parsedBody;
  }

  /**
   * Parse request headers
   */
  parseHeaders(rawHeaders: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // Split by CRLF first, then try other line endings if needed
    let headerLines = rawHeaders.split('\r\n');

    // If we only got one line but it contains \n or \r, try splitting by those
    if (headerLines.length === 1 && (rawHeaders.includes('\n') || rawHeaders.includes('\r'))) {
      // Try splitting by \n
      if (rawHeaders.includes('\n')) {
        headerLines = rawHeaders.split('\n');
      }
      // Try splitting by \r if \n splitting didn't produce multiple lines
      else if (rawHeaders.includes('\r')) {
        headerLines = rawHeaders.split('\r');
      }
    }

    for (const line of headerLines) {
      if (!line) continue;

      // Check if the line contains a colon
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (!key) continue;
      headers[key] = value;
    }

    return headers;
  }

  /**
   * Parse URL parameters from route pattern
   */
  parseParams(route: IRoute, path: string): Record<string, string> {
    const params: Record<string, string> = {};

    // Convert route pattern to regex with capture groups
    const pattern = route.path.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${pattern}$`);

    // Extract parameter names from route pattern
    const paramNames = route.path.match(/:[^/]+/g) ?? [];

    // Extract parameter values from path
    const match = path.match(regex);
    if (!match) return params;

    // Map parameter names to values
    for (let i = 0; i < paramNames.length && i + 1 < match.length; i++) {
      // Ensure paramNames[i] exists before accessing it
      const paramName = paramNames[i];
      if (paramName) {
        const name = paramName.slice(1); // Remove the leading ':'
        const value = match[i + 1]; // +1 because match[0] is the full match
        if (value) {
          params[name] = value;
        }
      }
    }

    return params;
  }

  /**
   * Parse query parameters from URL
   */
  parseQuery(url: string): Record<string, string> {
    const query: Record<string, string> = {};

    const [, queryString] = url.split('?');
    if (!queryString) return query;

    for (const pair of queryString.split('&')) {
      if (!pair) continue;
      const [key, value] = pair.split('=', 2);
      if (!key) continue;
      query[key] = value ?? '';
    }

    return query;
  }
}
