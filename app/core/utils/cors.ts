import { httpHeaders } from '@constants/http.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.js';
import type { CorsConfiguration } from '@typedefs/public/Configuration.js';
import type { InternalCorsEnabledConfiguration } from '@typedefs/internal/InternalConfiguration.js';

export const handleCors = (context: InternalContextImpl, config: CorsConfiguration): boolean => {
  if (!config.enabled) return false;

  if (context.request.method === 'OPTIONS') {
    // Validate origin is accepted - SECURITY CRITICAL: Actually use the result!
    const isOriginAllowed = _validateOrigin(context, config);

    if (!isOriginAllowed) {
      // Reject unauthorized CORS preflight requests
      context.response.setStatusCode(403);
      context._response._setBody({
        error: 'CORS: Origin not allowed',
        origin: context.request.headers.origin,
      });
      return true; // SECURITY: Return true to prevent RequestHandler from overwriting our rejection
    }

    // Set response headers ONLY for allowed origins
    context.response.setStatusCode(config.optionsSuccessStatus);

    // Determine the allowed origin to echo back
    const allowedOrigin = _determineAllowedOrigin(context, config);

    // Configure allowed methods and headers
    context._response._setHeadersIfNotSet({
      [httpHeaders.accessControlAllowOrigin]: allowedOrigin,
      [httpHeaders.accessControlAllowMethods]: config.methods.join(', '),
      [httpHeaders.accessControlAllowHeaders]: typeof config.allowedHeaders === 'string' ? config.allowedHeaders : config.allowedHeaders.join(', '),
      [httpHeaders.accessControlAllowCredentials]: config.credentials ? 'true' : 'false',
      [httpHeaders.accessControlExposeHeaders]: config.exposedHeaders.join(', '),
      [httpHeaders.accessControlMaxAge]: config.maxAge.toString(),
    });

    if (config.preflightContinue) {
      // Don't set body, let next handler run
      return false; // CORS did not handle, let next handler run
    }
    // Only set body if preflightContinue is false
    context._response._setBody('');
    return true; // CORS handled it
  }

  // For non-OPTIONS requests, still validate origin and set appropriate headers
  const isOriginAllowed = _validateOrigin(context, config);

  if (isOriginAllowed) {
    const allowedOrigin = _determineAllowedOrigin(context, config);
    context._response._setHeadersIfNotSet({
      [httpHeaders.accessControlAllowOrigin]: allowedOrigin,
      [httpHeaders.accessControlAllowCredentials]: config.credentials ? 'true' : 'false',
    });
  }

  return true;
};

/**
 * Determine the correct origin value to send back in Access-Control-Allow-Origin
 * SECURITY: Never echo back the request origin without validation
 */
const _determineAllowedOrigin = (context: InternalContextImpl, config: InternalCorsEnabledConfiguration): string => {
  if (config.origin === '*') {
    // SECURITY: Block dangerous wildcard + credentials combination (CORS spec violation)
    if (config.credentials) {
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
  if (typeof config.origin === 'string') {
    return config.origin;
  }

  if (Array.isArray(config.origin) && config.origin.length > 0) {
    const [firstOrigin] = config.origin;
    return firstOrigin ?? 'null';
  }

  // This shouldn't happen if validation passed, but safety fallback
  return 'null';
};

const _validateOrigin = (context: InternalContextImpl, config: InternalCorsEnabledConfiguration): boolean => {
  if (config.origin === '*') return true;

  const normalizedOrigin = context.request.headers.origin?.toLowerCase() ?? '';

  if (typeof config.origin === 'function') {
    return Boolean(config.origin(normalizedOrigin, context.request));
  }

  if (typeof config.origin === 'string') {
    return normalizedOrigin === config.origin.toLowerCase();
  }

  if (Array.isArray(config.origin)) {
    return config.origin.some((origin) => normalizedOrigin === origin.toLowerCase());
  }

  if (config.origin instanceof RegExp) {
    return config.origin.test(normalizedOrigin);
  }

  return false;
};
