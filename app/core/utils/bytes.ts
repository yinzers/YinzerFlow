import type { ByteString } from '@typedefs/public/Bytes.js';

const BYTE_MULTIPLIERS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

/**
 * Convert byte size string or raw number to bytes.
 *
 * Accepts human-readable byte strings (`'256kb'`, `'1mb'`) or raw numbers.
 * Raw numbers pass through unchanged.
 *
 * @param size - ByteString (e.g. '256kb', '1mb') or raw byte count
 * @returns Size in bytes
 * @throws Error if format is invalid or value is not positive
 *
 * @example
 * ```typescript
 * _convertBytesToBytes('1kb')   // 1024
 * _convertBytesToBytes('256kb') // 262144
 * _convertBytesToBytes('1mb')   // 1048576
 * _convertBytesToBytes(4096)    // 4096
 * ```
 *
 * @internal
 */
export const _convertBytesToBytes = (size: ByteString | number): number => {
  if (typeof size === 'number') {
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`Invalid byte value: "${size}". Must be a positive number`);
    }
    return size;
  }

  if (typeof size !== 'string') {
    throw new Error('Invalid byte format. Expected format: 512b, 256kb, 1mb, 2gb');
  }

  const match = /^(?<value>\d+(?:\.\d+)?)(?<unit>b|kb|mb|gb)$/.exec(size);
  if (!match?.groups) {
    throw new Error(`Invalid byte format: "${size}". Expected format: 512b, 256kb, 1mb, 2gb`);
  }

  const value = parseFloat(match.groups.value ?? '0');
  const unit = match.groups.unit ?? '';
  const multiplier = BYTE_MULTIPLIERS[unit];

  if (!multiplier) {
    throw new Error(`Invalid byte unit: "${unit}". Expected: b, kb, mb, gb`);
  }

  if (value <= 0) {
    throw new Error(`Invalid byte value: "${value}". Must be a positive number`);
  }

  return Math.floor(value * multiplier);
};

/**
 * Format byte count for display in warning/log messages.
 * Auto-selects the most readable unit.
 *
 * @internal
 */
export const _formatBytesForDisplay = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 / 1024 / 1024)}GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
};
