import type { InternalHttpHeaders } from '@typedefs/constants/http.js';

// Security limits to prevent DoS attacks
const MAX_HEADERS = 100;
const MAX_HEADER_NAME_LENGTH = 200;
const MAX_HEADER_VALUE_LENGTH = 8192;

/**
 * Parse incoming request headers from raw headers string with security validation
 *
 * This is the main orchestrator function that delegates to specialized helpers
 * for each processing step: validation → parsing → sanitization → security
 *
 * @example
 * ```ts
 * parseRequestHeaders('Host: example.com\r\nContent-Type: application/json\r\n\r\n');
 * // Returns { host: 'example.com', 'content-type': 'application/json' }
 * ```
 */
export const parseRequestHeaders = (rawHeaders: string): Partial<Record<InternalHttpHeaders, string>> => {
  if (!rawHeaders) return {};

  // Step 1: Pre-parse validation (format, DoS protection)
  validateRawHeaders(rawHeaders);

  // Step 2: Parse header structure into key-value pairs
  const parsedHeaders = parseHeaderStructure(rawHeaders);

  // Step 3: Sanitize header values (remove control chars, etc.)
  const sanitizedHeaders = sanitizeHeaders(parsedHeaders);

  // Step 4: Apply security policies (business logic, injection prevention)
  const securedHeaders = applySecurityPolicies(sanitizedHeaders);

  return securedHeaders;
};

/**
 * Step 1: Validate raw headers before parsing
 * Checks for DoS protection and basic format sanity
 */
export const validateRawHeaders = (rawHeaders: string): void => {
  // SECURITY: Limit number of potential headers to prevent DoS
  const headerLines = rawHeaders.split(/\r\n|\r|\n/);
  if (headerLines.length > MAX_HEADERS) {
    throw new Error(`Too many headers: maximum ${MAX_HEADERS} allowed`);
  }

  // Basic format validation could go here
  // (e.g., overall size limits, obvious malformation)
};

/**
 * Step 2: Parse header structure into key-value pairs
 * Handles line ending normalization and basic parsing
 */
export const parseHeaderStructure = (rawHeaders: string): Record<string, string> => {
  const headers: Record<string, string> = {};

  // Normalize line endings and split
  const normalizedHeaders = rawHeaders.replace(/\r\n|\r|\n/g, '\n');
  const headerLines = normalizedHeaders.split('\n');

  for (const line of headerLines) {
    if (!line.trim()) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (!key) continue;

    // SECURITY: Validate header name against RFC 7230
    if (!isValidHeaderName(key)) {
      throw new Error(`Invalid header name: ${key}`);
    }

    // SECURITY: Limit header name length
    if (key.length > MAX_HEADER_NAME_LENGTH) {
      throw new Error(`Header name too long: maximum ${MAX_HEADER_NAME_LENGTH} characters allowed`);
    }

    // SECURITY: Limit header value length
    if (value.length > MAX_HEADER_VALUE_LENGTH) {
      throw new Error(`Header value too long: maximum ${MAX_HEADER_VALUE_LENGTH} characters allowed`);
    }

    // Store with lowercase key for consistency
    headers[key.toLowerCase()] = value;
  }

  return headers;
};

/**
 * Step 3: Sanitize header values
 * Removes control characters and normalizes values
 */
export const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = sanitizeHeaderValue(value);
  }

  return sanitized;
};

/**
 * Step 4: Apply security policies
 * Business logic validation and injection prevention
 */
export const applySecurityPolicies = (headers: Record<string, string>): Record<string, string> =>
  // Note: CRLF injection detection would go here if we were setting response headers
  // For parsing incoming request headers, this step mainly handles business logic validation

  // Could add checks like:
  // - Suspicious header combinations
  // - Known attack patterns in values
  // - Business-specific header validation

  headers;

/**
 * Validate header name according to RFC 7230
 */
const isValidHeaderName = (name: string): boolean => {
  // RFC 7230: header-name = token
  // token = 1*tchar
  // tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
  //         "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
  const validHeaderNameRegex = /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/;
  return validHeaderNameRegex.test(name);
};

/**
 * Sanitize header value to prevent injection attacks
 */
const sanitizeHeaderValue = (value: string): string => {
  // SECURITY: Remove control characters except horizontal tab
  // Allow printable ASCII, horizontal tab (0x09), and extended ASCII
  const sanitized = value.replace(/[\x00-\x08\x0A-\x1F\x7F]/g, '');
  return sanitized;
};
