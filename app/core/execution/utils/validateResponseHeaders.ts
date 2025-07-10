/**
 * Response header validation utilities for security and format compliance
 *
 * This module contains security-focused header validation functions,
 * particularly for preventing CRLF injection attacks in outgoing response headers.
 */

/**
 * Validate response header value for CRLF injection attempts
 * Use this when setting response headers with user input
 */
export const validateResponseHeaderValue = (headerName: string, headerValue: string): void => {
  // SECURITY: Check for CRLF injection in response header values
  // This is where CRLF injection actually matters - when setting response headers

  if (typeof headerValue !== 'string') {
    throw new Error(`Header value must be a string, got ${typeof headerValue}`);
  }

  // SECURITY: Detect CRLF injection patterns that could inject additional headers
  if (headerValue.includes('\r') || headerValue.includes('\n')) {
    throw new Error(`Header value contains invalid line break characters: ${headerName}`);
  }

  // SECURITY: Detect common injection patterns
  const suspiciousPatterns = [
    // Pattern: value\r\nSet-Cookie: or value\nLocation: etc.
    /[\r\n](?:set-cookie|location|authorization|www-authenticate):/i,
    // Pattern: Double CRLF (could inject HTTP response)
    /\r\n\r\n|\n\n/,
    // Pattern: HTTP response line injection
    /[\r\n]http\/\d\.\d\s+\d+/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(headerValue)) {
      throw new Error(`Header value contains suspicious injection pattern: ${headerName}`);
    }
  }
};

/**
 * Validate multiple response header values
 * Convenience function for validating header objects
 */
export const validateResponseHeaders = (headers: Record<string, string>): void => {
  for (const [name, value] of Object.entries(headers)) {
    validateResponseHeaderValue(name, value);
  }
};

/**
 * Filter and validate headers, removing undefined values and validating security
 * Returns only valid, defined header entries
 */
export const filterAndValidateHeaders = (headers: Partial<Record<string, string | undefined>>): Record<string, string> => {
  // Filter out undefined values using simple, readable approach
  const definedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      definedHeaders[key] = value;
    }
  }

  // Validate the filtered headers
  validateResponseHeaders(definedHeaders);

  return definedHeaders;
};
