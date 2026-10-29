import { httpStatus, httpStatusCode } from '@constants/http.ts';
import type { InternalHttpStatusCode } from '@typedefs/constants/http.js';

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
 * RFC 9110 §15 class names, used as the reason phrase for a valid code that isn't in the status table.
 * HTTP/1.1 reason phrases are informational (clients must ignore them), so any text is valid on the wire.
 */
const statusClassPhrases = ['Informational', 'Success', 'Redirection', 'Client Error', 'Server Error'] as const;

/**
 * Map a status code to the reason phrase for its status line.
 *
 * A code in the status table gets its registered phrase. Any other integer from 100 to 599 gets its class's phrase
 * (`Informational`, `Success`, `Redirection`, `Client Error`, `Server Error`).
 *
 * @param statusCode - The HTTP status code to map
 * @returns The reason phrase
 * @throws When the code is not an integer from 100 to 599, which a status line can't carry
 *
 * @example
 * ```typescript
 * mapStatusCodeToMessage(404) // "Not Found"
 * mapStatusCodeToMessage(503) // "Service Unavailable"
 * mapStatusCodeToMessage(299) // "Success"
 * mapStatusCodeToMessage(600) // throws
 * ```
 */
export const mapStatusCodeToMessage = (statusCode: InternalHttpStatusCode): string => {
  const message = statusCodeMap.get(statusCode);
  if (message) return message;

  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw new Error(`Invalid status code: ${String(statusCode)}. Status codes must be integers from 100 to 599, n'at.`);
  }

  return statusClassPhrases[Math.floor(statusCode / 100) - 1] ?? 'Unknown';
};
