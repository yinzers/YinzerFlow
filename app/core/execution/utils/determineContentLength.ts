import type { InternalHttpEncoding } from '@typedefs/constants/http.js';
import { httpEncoding } from '@constants/http.ts';

/**
 * Determine the Content-Length header value for a response body
 *
 * Calculates the byte length of the response body after it's been
 * formatted into a string for HTTP transmission. This accounts for
 * different encodings and body types.
 */

export const determineContentLength = (body: string | null | undefined, encoding?: InternalHttpEncoding): string => {
  if (!body) return '0';

  // Calculate byte length based on encoding
  let byteLength = 0;

  if (encoding === httpEncoding.base64) {
    // For base64, we need the length of the base64 string
    byteLength = Buffer.byteLength(body, 'utf8');
  }
  if (encoding === httpEncoding.binary) {
    // For binary encoding, each character represents one byte
    byteLength = body.length;
  }

  // For utf8 and default cases
  if (encoding === httpEncoding.utf8) {
    byteLength = Buffer.byteLength(body, 'utf8');
  }

  return String(byteLength);
};
