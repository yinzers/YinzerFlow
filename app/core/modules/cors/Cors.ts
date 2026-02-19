import { httpHeaders } from '@constants/http.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.js';
import type { InternalCorsEnabledOptions } from '@typedefs/internal/InternalConfiguration.js';

/**
 * Core CORS handling logic
 *
 * This module implements Cross-Origin Resource Sharing (CORS) as a beforeRouting hook.
 * It validates origins, handles preflight requests, and sets appropriate CORS headers.
 *
 * Security features:
 * - Origin validation (never blindly echo back request origin)
 * - Prevents wildcard + credentials combination (CORS spec violation)
 * - Rejects unauthorized preflight requests with 403
 */
export class Cors {
  private readonly _normalizedOrigins: Set<string> | null;

  constructor(private readonly config: InternalCorsEnabledOptions) {
    // Fail fast: wildcard + credentials is forbidden by CORS spec
    if (config.origin === '*' && config.credentials) {
      throw new Error(
        'CORS Configuration Error: Cannot use origin: "*" with credentials: true. ' +
          'The CORS specification forbids this combination as it creates security vulnerabilities. ' +
          'Choose one of these solutions:\n' +
          '  1) Set credentials: false (recommended for public APIs)\n' +
          '  2) Use specific origins instead of "*" (e.g., origin: ["https://example.com"])\n' +
          '  3) Disable CORS entirely (enabled: false)',
      );
    }

    // Pre-normalize array origins for O(1) lookup per request instead of O(m)
    if (Array.isArray(config.origin)) {
      this._normalizedOrigins = new Set(config.origin.map((o) => o.toLowerCase()));
    } else {
      this._normalizedOrigins = null;
    }
  }

  /**
   * Handle CORS for an incoming request.
   *
   * For OPTIONS (preflight) requests: validates origin, sets all CORS headers,
   * and short-circuits with the configured success status (default 204).
   * Returns a response object to short-circuit, or undefined if preflightContinue is true.
   *
   * For actual requests: validates origin and sets Access-Control-Allow-Origin +
   * Access-Control-Allow-Credentials headers. Always returns undefined to let
   * normal request processing continue (CORS enforcement is browser-side for
   * non-preflight requests per the CORS specification).
   *
   * @param context - The request context with headers and response object
   * @returns Response object to short-circuit (preflight), or undefined to continue
   */
  handle(context: InternalContextImpl): unknown {
    if (context.request.method === 'OPTIONS') {
      return this._handlePreflightRequest(context);
    }

    return void this._handleActualRequest(context);
  }

  /**
   * Handle OPTIONS preflight request
   */
  private _handlePreflightRequest(context: InternalContextImpl): unknown {
    // Validate origin is accepted - SECURITY CRITICAL
    const normalizedOrigin = context.request.headers.origin?.toLowerCase() ?? '';
    const isOriginAllowed = this._isOriginAllowed(normalizedOrigin, context);

    if (!isOriginAllowed) {
      // Reject unauthorized CORS preflight requests
      context.response.setStatusCode(403);
      return {
        error: 'CORS: Origin not allowed',
        origin: context.request.headers.origin,
      };
    }

    // Set response headers ONLY for allowed origins
    context.response.setStatusCode(this.config.optionsSuccessStatus);

    // Determine the allowed origin to echo back
    const allowedOrigin = this._resolveAllowedOrigin(context);

    // Set common CORS headers (origin + credentials)
    this._setCommonCorsHeaders(context, allowedOrigin);

    // Set preflight-specific headers
    context._response._setHeadersIfNotSet({
      [httpHeaders.accessControlAllowMethods]: this.config.methods.join(', '),
      [httpHeaders.accessControlAllowHeaders]:
        typeof this.config.allowedHeaders === 'string' ? this.config.allowedHeaders : this.config.allowedHeaders.join(', '),
      [httpHeaders.accessControlExposeHeaders]: this.config.exposedHeaders.join(', '),
      [httpHeaders.accessControlMaxAge]: this.config.maxAge.toString(),
    });

    if (this.config.preflightContinue) {
      // Don't short-circuit, let next handler run
      return undefined;
    }

    // Short-circuit with empty body (204 No Content typical response)
    return '';
  }

  /**
   * Handle actual (non-preflight) request — validate origin and set CORS headers.
   * For disallowed origins, no CORS headers are set (browser will block the response).
   */
  private _handleActualRequest(context: InternalContextImpl): undefined {
    const normalizedOrigin = context.request.headers.origin?.toLowerCase() ?? '';
    const isOriginAllowed = this._isOriginAllowed(normalizedOrigin, context);

    if (isOriginAllowed) {
      const allowedOrigin = this._resolveAllowedOrigin(context);
      this._setCommonCorsHeaders(context, allowedOrigin);
    }

    return undefined;
  }

  /**
   * Set CORS headers common to both preflight and actual requests
   */
  private _setCommonCorsHeaders(context: InternalContextImpl, allowedOrigin: string): void {
    context._response._setHeadersIfNotSet({
      [httpHeaders.accessControlAllowOrigin]: allowedOrigin,
      [httpHeaders.accessControlAllowCredentials]: this.config.credentials ? 'true' : 'false',
    });
  }

  /**
   * Determine the correct origin value for the Access-Control-Allow-Origin header.
   * SECURITY: Never echo back the request origin without prior validation.
   */
  private _resolveAllowedOrigin(context: InternalContextImpl): string {
    if (this.config.origin === '*') {
      return '*';
    }

    // For specific origins, echo back the validated request origin
    const requestOrigin = context.request.headers.origin;
    if (requestOrigin) {
      return requestOrigin;
    }

    // Fallback: no request origin (shouldn't happen for validated requests)
    if (typeof this.config.origin === 'string') {
      return this.config.origin;
    }

    if (Array.isArray(this.config.origin) && this.config.origin.length > 0) {
      const [firstOrigin] = this.config.origin;
      return firstOrigin ?? 'null';
    }

    return 'null';
  }

  /**
   * Check if a normalized (lowercased) origin is allowed by the CORS configuration
   */
  private _isOriginAllowed(normalizedOrigin: string, context?: InternalContextImpl): boolean {
    if (this.config.origin === '*') return true;

    if (typeof this.config.origin === 'function') {
      return Boolean(this.config.origin(normalizedOrigin, context?.request));
    }

    if (typeof this.config.origin === 'string') {
      return normalizedOrigin === this.config.origin.toLowerCase();
    }

    if (this._normalizedOrigins) {
      return this._normalizedOrigins.has(normalizedOrigin);
    }

    if (this.config.origin instanceof RegExp) {
      return this.config.origin.test(normalizedOrigin);
    }

    return false;
  }
}
