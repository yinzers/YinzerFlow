import type { InternalHttpEncoding } from '@typedefs/constants/http.js';

/**
 * Common binary file signatures (magic numbers)
 * Used for detecting file types when Content-Type header is missing
 */
const BINARY_SIGNATURES = {
  // Images
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47],
  GIF87A: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
  GIF89A: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  BMP: [0x42, 0x4d],
  TIFF_LE: [0x49, 0x49, 0x2a, 0x00], // Little endian
  TIFF_BE: [0x4d, 0x4d, 0x00, 0x2a], // Big endian
  WEBP: [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP has 'WEBP' at offset 8)
  ICO: [0x00, 0x00, 0x01, 0x00],

  // Audio
  MP3_ID3: [0x49, 0x44, 0x33], // ID3 tag
  MP3_FRAME: [0xff, 0xfb], // MP3 frame
  WAV: [0x52, 0x49, 0x46, 0x46], // RIFF header (WAV has 'WAVE' at offset 8)
  FLAC: [0x66, 0x4c, 0x61, 0x43], // fLaC
  OGG: [0x4f, 0x67, 0x67, 0x53], // OggS

  // Video
  MP4_FTYP: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // Common MP4 signature
  MP4_FTYP_ALT: [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], // Alternative MP4
  AVI: [0x52, 0x49, 0x46, 0x46], // RIFF header (AVI has 'AVI ' at offset 8)
  WEBM: [0x1a, 0x45, 0xdf, 0xa3], // EBML header

  // Documents
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF

  // Archives
  ZIP: [0x50, 0x4b, 0x03, 0x04], // ZIP file
  ZIP_EMPTY: [0x50, 0x4b, 0x05, 0x06], // Empty ZIP
  ZIP_SPANNED: [0x50, 0x4b, 0x07, 0x08], // Spanned ZIP
  RAR: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00], // Rar!
  RAR5: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00], // Rar! v5
  SEVENZ: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], // 7z
  GZIP: [0x1f, 0x8b], // gzip

  // Executables
  EXE: [0x4d, 0x5a], // MZ (DOS/Windows executable)
  ELF: [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux executable)

  // Office Documents (modern Office files are ZIP-based)
  OFFICE_OLD: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // Old MS Office
} as const;

/**
 * Check if buffer matches a binary signature
 */
const matchesSignature = (buffer: Buffer, signature: ReadonlyArray<number>): boolean => {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
};

/**
 * Check for special cases that require additional validation
 */
const validateSpecialSignatures = (buffer: Buffer): boolean => {
  // WebP: RIFF header + 'WEBP' at offset 8
  if (matchesSignature(buffer, BINARY_SIGNATURES.WEBP) && buffer.length >= 12) {
    const webpMarker = buffer.subarray(8, 12);
    return webpMarker.toString('ascii') === 'WEBP';
  }

  // WAV: RIFF header + 'WAVE' at offset 8
  if (matchesSignature(buffer, BINARY_SIGNATURES.WAV) && buffer.length >= 12) {
    const waveMarker = buffer.subarray(8, 12);
    return waveMarker.toString('ascii') === 'WAVE';
  }

  // AVI: RIFF header + 'AVI ' at offset 8
  if (matchesSignature(buffer, BINARY_SIGNATURES.AVI) && buffer.length >= 12) {
    const aviMarker = buffer.subarray(8, 12);
    return aviMarker.toString('ascii') === 'AVI ';
  }

  return false;
};

/**
 * Determine the appropriate encoding based on Content-Type header
 * Falls back to content inspection if no header is present
 */
export const determineEncoding = (contentType?: string, body?: unknown): InternalHttpEncoding => {
  if (!contentType) {
    // No content-type header, infer from body content
    return inferEncodingFromBody(body);
  }

  const lowerContentType = contentType.toLowerCase();

  // Binary content types that should use base64 encoding
  if (
    lowerContentType.startsWith('image/') ||
    lowerContentType.startsWith('video/') ||
    lowerContentType.startsWith('audio/') ||
    lowerContentType === 'application/pdf' ||
    lowerContentType === 'application/octet-stream' ||
    lowerContentType.startsWith('application/zip') ||
    lowerContentType.startsWith('application/x-') // Many binary formats use x- prefix
  ) {
    return 'base64';
  }

  // Text-based content types use utf8
  if (
    lowerContentType.startsWith('text/') ||
    lowerContentType.startsWith('application/json') ||
    lowerContentType.startsWith('application/xml') ||
    lowerContentType.startsWith('application/javascript')
  ) {
    return 'utf8';
  }

  // Default to binary for unknown types
  return 'binary';
};

/**
 * Infer encoding when no Content-Type header is present
 */
export const inferEncodingFromBody = (body?: unknown): 'base64' | 'binary' | 'utf8' => {
  // If it's a Buffer, check for binary signatures
  if (Buffer.isBuffer(body)) {
    return detectBinaryFormat(body) ? 'base64' : 'utf8';
  }

  // Objects and arrays should be JSON, use utf8
  if (typeof body === 'object' && body !== null) return 'utf8';

  // Strings use utf8
  if (typeof body === 'string') return 'utf8';

  // Everything else defaults to utf8
  return 'utf8';
};

/**
 * Detect if buffer contains binary data based on file signatures
 */
const detectBinaryFormat = (buffer: Buffer): boolean => {
  if (buffer.length === 0) return false;

  // Check all known binary signatures
  const signatures = Object.values(BINARY_SIGNATURES);

  for (const signature of signatures) {
    if (matchesSignature(buffer, signature)) {
      return true;
    }
  }

  // Check special cases that need additional validation
  if (validateSpecialSignatures(buffer)) {
    return true;
  }

  // Heuristic: if buffer contains a lot of null bytes or non-printable chars, likely binary
  const nullBytes = buffer.filter((byte) => byte === 0).length;
  const nonPrintableBytes = buffer.filter((byte) => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13).length;

  // If more than 10% null bytes or 30% non-printable, consider it binary
  return nullBytes / buffer.length > 0.1 || nonPrintableBytes / buffer.length > 0.3;
};
