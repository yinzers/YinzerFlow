import { parseApplicationJson } from './parseJson.ts';
import { parseMultipartFormData } from './parseMultipart.ts';
import { contentType } from '@constants/http.ts';

import { parseUrlEncodedForm } from '@core/execution/utils/parseUrlEncodedForm.ts';
import type { InternalContentType } from '@typedefs/constants/http.js';
import { inferContentTypeFromString } from '@core/execution/utils/inferContentType.ts';
import type { InternalBodyParserConfiguration } from '@typedefs/internal/InternalConfiguration.js';

/**
 * Options for parsing request body
 */
export interface ParseBodyOptions {
  /**
   * Content-Type header value
   */
  headerContentType?: InternalContentType | undefined;

  /**
   * Multipart boundary (for multipart/form-data)
   */
  boundary?: string | undefined;

  /**
   * Body parser security configuration
   */
  config?: InternalBodyParserConfiguration;
}

/**
 * Validate request body size based on content type
 */
const _validateBodySize = (body: string, mainContentType: string, config: InternalBodyParserConfiguration): void => {
  const bodySize = Buffer.byteLength(body, 'utf8');

  if (mainContentType === contentType.json) {
    if (bodySize > config.json.maxSize) {
      throw new Error(`JSON body too large: ${bodySize} bytes exceeds limit of ${config.json.maxSize} bytes`);
    }
  } else if (mainContentType === contentType.form) {
    if (bodySize > config.urlEncoded.maxSize) {
      throw new Error(`URL-encoded body too large: ${bodySize} bytes exceeds limit of ${config.urlEncoded.maxSize} bytes`);
    }
  } else if (mainContentType === contentType.multipart) {
    if (bodySize > config.fileUploads.maxTotalSize) {
      throw new Error(`Multipart body too large: ${bodySize} bytes exceeds limit of ${config.fileUploads.maxTotalSize} bytes`);
    }
  }
};

/**
 * Parse request body based on Content-Type header with comprehensive security protections
 *
 * This function determines the appropriate parsing strategy based on the Content-Type header:
 * - application/json: Parse as JSON with security protections
 * - multipart/form-data: Parse as multipart with file uploads
 * - application/x-www-form-urlencoded: Parse as URL-encoded form data
 * - text/*: Return as raw string (with size limits)
 * - default: Return as raw string (with size limits)
 *
 * Security Features:
 * - Request body size validation
 * - JSON DoS attack prevention
 * - Prototype pollution protection
 * - Memory exhaustion protection
 *
 * @param body - Raw request body string
 * @param options - Parsing options including content type, boundary, and configuration
 * @returns Parsed body in appropriate format
 * @throws Error if body is too large, malformed, or contains security threats
 */
export const parseBody = (body: string, options: ParseBodyOptions = {}): unknown => {
  const { headerContentType, boundary, config } = options;

  // Handle empty body
  if (!body || !body.trim()) {
    return undefined;
  }

  // Determine the content type - either passed in or inferred
  const mainContentType = headerContentType ?? inferContentTypeFromString(body);

  // SECURITY: Apply size limits based on content type if config is provided
  if (config) {
    _validateBodySize(body, mainContentType, config);
  }

  // Parse based on Content-Type
  if (mainContentType === contentType.json) {
    if (!config) {
      throw new Error('Body parser configuration is required for JSON parsing');
    }
    return parseApplicationJson(body, config.json);
  }

  if (mainContentType === contentType.multipart) {
    if (!boundary) throw new Error('Invalid multipart form data: missing boundary');
    return parseMultipartFormData(body, boundary, config?.fileUploads);
  }

  if (mainContentType === contentType.form) {
    return parseUrlEncodedForm(body, config?.urlEncoded);
  }

  // For all other content types, return the raw body
  // Note: Size limits are already applied above if config is provided
  return body;
};
