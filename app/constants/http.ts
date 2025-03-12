/**
 * HTTP Constants
 *
 * This file contains all HTTP-related constants used throughout the application.
 * Centralizing these constants makes them easier to maintain and ensures consistency.
 */

/**
 * HTTP Status Text
 * Maps status codes to their standard text representations
 */
export const HttpStatus = <const>{
  OK: 'OK',
  CREATED: 'Created',
  NO_CONTENT: 'No Content',
  BAD_REQUEST: 'Bad Request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not Found',
  METHOD_NOT_ALLOWED: 'Method Not Allowed',
  CONFLICT: 'Conflict',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported Media Type',
  TOO_MANY_REQUESTS: 'Too Many Requests',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
};

/**
 * HTTP Status Codes
 * Standard HTTP status codes used in responses
 */
export const HttpStatusCode = <const>{
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * HTTP Methods
 * Standard HTTP methods used in requests
 */
export const HttpMethod = <const>{
  DELETE: 'DELETE',
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};

/**
 * Common Content Types
 * Frequently used content types for HTTP communication
 */
export const ContentType = <const>{
  JSON: 'application/json',
  HTML: 'text/html',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  XML: 'application/xml',
  TEXT: 'text/plain',
  CSV: 'text/csv',
  YAML: 'application/yaml',
  URL_ENCODED_JSON: 'application/x-www-form-urlencoded+json',
};
