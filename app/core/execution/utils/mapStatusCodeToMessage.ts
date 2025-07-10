import { httpStatus, httpStatusCode } from '@constants/http.ts';
import type { InternalHttpStatus, InternalHttpStatusCode } from '@typedefs/constants/http.js';

/**
 * Map of status codes to their corresponding status messages
 * Built dynamically from the constants to ensure they stay in sync
 */
const statusCodeMap = new Map<number, string>();

// Build the map from the constants
for (const [key, code] of Object.entries(httpStatusCode)) {
  const statusKey = key as keyof typeof httpStatus;
  const message = httpStatus[statusKey];

  statusCodeMap.set(code, message);
}

/**
 * Map a status code to its corresponding HTTP status message
 *
 * @param statusCode - The HTTP status code to map
 * @returns The corresponding HTTP status message
 *
 * @example
 * ```typescript
 * mapStatusCodeToMessage(200) // returns "OK"
 * mapStatusCodeToMessage(404) // returns "Not Found"
 * mapStatusCodeToMessage(500) // returns "Internal Server Error"
 * ```
 */
export const mapStatusCodeToMessage = (statusCode: InternalHttpStatusCode): InternalHttpStatus => {
  const message = statusCodeMap.get(statusCode);

  if (!message) {
    throw new Error(`Unknown status code: ${statusCode}`);
  }

  return message as InternalHttpStatus;
};

/**
 * Check if a status code is valid/supported
 *
 * @param statusCode - The status code to validate
 * @returns true if the status code is supported
 */
export const isValidStatusCode = (statusCode: number): statusCode is InternalHttpStatusCode => statusCodeMap.has(statusCode);
