/**
 * Determine the Content-Length header value for a response body
 *
 * Calculates the byte length of the response body after it's been
 * formatted into a string for HTTP transmission. This accounts for
 * different encodings and body types.
 */

/**
 * Calculates the byte size of a response body for Content-Length,
 * supporting Buffer (binary), string (utf8), and JSON-serializable objects.
 *
 * - Buffers: returns .length (raw binary)
 * - Strings: returns byte length in utf8 (handles text, base64, and "binary" as string)
 * - Objects: JSON.stringify, then utf8 byte length
 * - null/undefined/unknown: returns 0
 *
 * Yes, this covers binary data—if you pass a Buffer, you get the true binary size.
 * If you pass a "binary" string (e.g., '\xFF\xD8'), you get the utf8 byte length,
 * which matches Node's Content-Length calculation for string bodies.
 */
export const calculateContentSizeInBytes = (responseBody: unknown): number => {
  if (_isBuffer(responseBody)) {
    return responseBody.length;
  }

  if (typeof responseBody === 'string') {
    // Handles text, base64, and "binary" as string (e.g., '\xFF\xD8')
    return Buffer.byteLength(responseBody, 'utf8');
  }

  if (_isJsonSerializableObject(responseBody)) {
    try {
      const json = JSON.stringify(responseBody);
      return Buffer.byteLength(json, 'utf8');
    } catch {
      return 0;
    }
  }

  return 0;
};

const _isBuffer = (val: unknown): val is Buffer =>
  // Node.js Buffer check (covers binary data)
  typeof Buffer !== 'undefined' && Buffer.isBuffer(val);

const _isJsonSerializableObject = (val: unknown): val is object => typeof val === 'object' && val !== null;
