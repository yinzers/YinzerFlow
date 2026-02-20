/**
 * Byte size string format
 *
 * Format: number followed by unit (b, kb, mb, gb)
 *
 * Units:
 * - b: bytes
 * - kb: kilobytes (1024 bytes)
 * - mb: megabytes (1048576 bytes)
 * - gb: gigabytes (1073741824 bytes)
 *
 * @example
 * ```typescript
 * '512b'   // 512 bytes
 * '256kb'  // 256 kilobytes
 * '1mb'    // 1 megabyte
 * '2gb'    // 2 gigabytes
 * ```
 */
export type ByteString = `${number}${'b' | 'gb' | 'kb' | 'mb'}`;
