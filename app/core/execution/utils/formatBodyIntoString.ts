/**
 * Format the body into a string for HTTP response transmission
 *
 * Handles various body types including:
 * - Objects/Arrays: JSON stringified
 * - Strings: returned as-is
 * - Binary data (Buffer/Uint8Array): converted to base64 or kept as binary string
 * - Primitives: converted to string
 * - null/undefined: empty string
 *
 * @example
 * ```typescript
 * // JSON object
 * const body = { message: 'Hello, world!' };
 * const formattedBody = formatBodyIntoString(body);
 * // formattedBody === '{"message":"Hello, world!"}'
 *
 * // Binary data
 * const binaryBody = Buffer.from('binary data');
 * const formattedBinary = formatBodyIntoString(binaryBody);
 * // formattedBinary === 'binary data' (as string)
 *
 * // Base64 encoding option for true binary
 * const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]); // JPEG header
 * const base64Body = formatBodyIntoString(imageBuffer, { encoding: 'base64' });
 * // base64Body === '/9j/' (base64 encoded)
 * ```
 */
export const formatBodyIntoString = (body: unknown, options?: { encoding?: 'base64' | 'binary' | 'utf8' }): string => {
  const encoding = options?.encoding ?? 'utf8';

  // Handle null/undefined
  if (body === null || body === undefined) return '';

  // Handle binary data types
  if (Buffer.isBuffer(body)) return handleBuffer(body, encoding);
  if (body instanceof Uint8Array) return handleUint8Array(body, encoding);
  if (body instanceof ArrayBuffer) return handleArrayBuffer(body, encoding);

  // Handle strings
  if (typeof body === 'string') return body;

  // Handle objects and arrays (including Date, etc.)
  if (typeof body === 'object') return handleObjectsAndArrays(body);

  // Handle all primitives and functions - they all stringify the same way
  // This covers: number, boolean, bigint, symbol, function
  return String(body as string);
};

const handleBuffer = (body: Buffer, encoding: 'base64' | 'binary' | 'utf8'): string => {
  if (encoding === 'base64') return body.toString('base64');
  if (encoding === 'binary') return body.toString('binary');
  return body.toString('utf8');
};

const handleUint8Array = (body: Uint8Array, encoding: 'base64' | 'binary' | 'utf8'): string => {
  const buffer = Buffer.from(body);
  return handleBuffer(buffer, encoding);
};

const handleArrayBuffer = (body: ArrayBuffer, encoding: 'base64' | 'binary' | 'utf8'): string => {
  const buffer = Buffer.from(body);
  return handleBuffer(buffer, encoding);
};

const handleObjectsAndArrays = (body: unknown): string => {
  try {
    return JSON.stringify(body);
  } catch (_) {
    // Fallback for non-serializable objects (circular refs, etc.)
    // This will return something like "[object Object]" but that's better than crashing
    return String(body);
  }
};
