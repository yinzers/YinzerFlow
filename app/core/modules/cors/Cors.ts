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
  constructor(private readonly config: InternalCorsEnabledOptions) {}

  /**
   * Handle CORS for a request
   * @returns Response object if CORS should short-circuit, undefined to continue
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
    const isOriginAllowed = this._validateOrigin(context);

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
    const allowedOrigin = this._determineAllowedOrigin(context);

    // Configure allowed methods and headers
    context._response._setHeadersIfNotSet({
      [httpHeaders.accessControlAllowOrigin]: allowedOrigin,
      [httpHeaders.accessControlAllowMethods]: this.config.methods.join(', '),
      [httpHeaders.accessControlAllowHeaders]: typeof this.config.allowedHeaders === 'string' ? this.config.allowedHeaders : this.config.allowedHeaders.join(', '),
      [httpHeaders.accessControlAllowCredentials]: this.config.credentials ? 'true' : 'false',
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
   * Handle actual (non-preflight) request
   */
  private _handleActualRequest(context: InternalContextImpl): undefined {
    // For non-OPTIONS requests, still validate origin and set appropriate headers
    const isOriginAllowed = this._validateOrigin(context);

    if (isOriginAllowed) {
      const allowedOrigin = this._determineAllowedOrigin(context);
      context._response._setHeadersIfNotSet({
        [httpHeaders.accessControlAllowOrigin]: allowedOrigin,
        [httpHeaders.accessControlAllowCredentials]: this.config.credentials ? 'true' : 'false',
      });
    }

    // Let normal request processing continue
    return undefined;
  }

  /**
   * Determine the correct origin value to send back in Access-Control-Allow-Origin
   * SECURITY: Never echo back the request origin without validation
   */
  private _determineAllowedOrigin(context: InternalContextImpl): string {
    if (this.config.origin === '*') {
      // SECURITY: Block dangerous wildcard + credentials combination (CORS spec violation)
      if (this.config.credentials) {
        throw new Error(
          'CORS Security Error: origin: "*" with credentials: true is forbidden by CORS spec and creates security vulnerabilities. Use specific origins instead.',
        );
      }

      // SECURITY: For wildcard, always return literal '*', never echo back the request origin
      // Echoing back the request origin defeats the purpose of CORS validation
      return '*';
    }

    // For specific origins, echo back the validated request origin
    const requestOrigin = context.request.headers.origin;
    if (requestOrigin) {
      // At this point, validation should have already passed
      return requestOrigin;
    }

    // If no request origin (shouldn't happen for validated requests), return first configured origin
    if (typeof this.config.origin === 'string') {
      return this.config.origin;
    }

    if (Array.isArray(this.config.origin) && this.config.origin.length > 0) {
      const [firstOrigin] = this.config.origin;
      return firstOrigin ?? 'null';
    }

    // This shouldn't happen if validation passed, but safety fallback
    return 'null';
  }

  /**
   * Validate if the request origin is allowed
   */
  private _validateOrigin(context: InternalContextImpl): boolean {
    if (this.config.origin === '*') return true;

    const normalizedOrigin = context.request.headers.origin?.toLowerCase() ?? '';

    if (typeof this.config.origin === 'function') {
      return Boolean(this.config.origin(normalizedOrigin, context.request));
    }

    if (typeof this.config.origin === 'string') {
      return normalizedOrigin === this.config.origin.toLowerCase();
    }

    if (Array.isArray(this.config.origin)) {
      return this.config.origin.some((origin) => normalizedOrigin === origin.toLowerCase());
    }

    if (this.config.origin instanceof RegExp) {
      return this.config.origin.test(normalizedOrigin);
    }

    return false;
  }
}
