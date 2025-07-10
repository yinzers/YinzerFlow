import { determineEncoding } from './determineEncoding.ts';
import { contentType } from '@constants/http.ts';

// =============================================================================
// JSON Detection
// =============================================================================

/**
 * Detect if string content is valid JSON
 * Validates by attempting to parse the content
 */
const isJsonContent = (content: string): boolean => {
  if (!((content.startsWith('{') && content.endsWith('}')) || (content.startsWith('[') && content.endsWith(']')))) {
    return false;
  }

  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
};

// =============================================================================
// Form Data Detection
// =============================================================================

/**
 * Detect if string content is URL-encoded form data
 */
const isUrlEncodedFormContent = (content: string): boolean => content.includes('=') && content.includes('&');

/**
 * Detect if string content is multipart form data
 */
const isMultipartFormContent = (content: string): boolean => content.includes('boundary=');

// =============================================================================
// Object Type Detection
// =============================================================================

/**
 * Check if value is a plain object or array (but not special object types)
 */
const isPlainObjectOrArray = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Buffer.isBuffer(value) &&
  !(value instanceof Uint8Array) &&
  !(value instanceof ArrayBuffer) &&
  !(value instanceof Date);

/**
 * Check if value is a Date object
 */
const isDateObject = (value: unknown): value is Date => value instanceof Date;

// =============================================================================
// Binary Data Helpers
// =============================================================================

/**
 * Convert various binary types to Buffer for consistent processing
 */
const convertToBuffer = (data: ArrayBuffer | Buffer | Uint8Array): Buffer => {
  if (Buffer.isBuffer(data)) return data;
  return Buffer.from(data as ArrayBuffer);
};

/**
 * Determine content type for binary data using encoding detection
 */
const inferBinaryContentType = (buffer: Buffer): string => {
  const encoding = determineEncoding(undefined, buffer);
  return encoding === 'base64' ? 'application/octet-stream' : 'text/plain';
};

// =============================================================================
// Main String Content Type Inference
// =============================================================================

/**
 * Infer content type from string body content when Content-Type header is missing
 * Focuses on main HTTP content types: JSON, form data, plain text
 *
 * @param body - String content to analyze
 * @returns Detected content type
 */
export const inferContentTypeFromString = (body: string): string => {
  const trimmedBody = body.trim();

  // Check for JSON first (most specific)
  if (isJsonContent(trimmedBody)) {
    return contentType.json;
  }

  // Check for form data
  if (isUrlEncodedFormContent(trimmedBody)) {
    return contentType.form;
  }

  if (isMultipartFormContent(trimmedBody)) {
    return contentType.multipart;
  }

  // Default to plain text for everything else
  return 'text/plain';
};

// =============================================================================
// Main Content Type Inference
// =============================================================================

/**
 * Infer content type from any response body type when Content-Type header is missing
 * Handles the main types: objects (JSON), strings, binary data, primitives
 *
 * @param body - Response body of any supported type
 * @returns Detected content type
 */
export const inferContentType = (body: unknown): string => {
  // Handle null/undefined
  if (body === null || body === undefined) {
    return 'text/plain';
  }

  // Handle Date objects specially (convert to string)
  if (isDateObject(body)) {
    return 'text/plain';
  }

  // Handle plain objects and arrays -> JSON
  if (isPlainObjectOrArray(body)) {
    return contentType.json;
  }

  // Handle strings with basic detection
  if (typeof body === 'string') {
    return inferContentTypeFromString(body);
  }

  // Handle binary data types
  if (Buffer.isBuffer(body) || body instanceof Uint8Array || body instanceof ArrayBuffer) {
    const buffer = convertToBuffer(body);
    return inferBinaryContentType(buffer);
  }

  // All other primitives -> plain text
  return 'text/plain';
};
