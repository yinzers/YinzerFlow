import type { TimeString } from '@typedefs/public/Time.js';

/**
 * Convert time string to milliseconds
 *
 * Internal helper for parsing user-friendly time formats into milliseconds.
 * Supports seconds (s), minutes (m), hours (h), and days (d).
 *
 * @param time - Time string in format: number + unit (s/m/h/d)
 * @returns Time in milliseconds
 * @throws Error if time format is invalid
 *
 * @example
 * ```typescript
 * _convertTimeToMs('500ms') // 500
 * _convertTimeToMs('30s')   // 30000
 * _convertTimeToMs('15m')   // 900000
 * _convertTimeToMs('2h')    // 7200000
 * _convertTimeToMs('1d')    // 86400000
 * ```
 *
 * @internal
 */
export const _convertTimeToMs = (time: TimeString | number): number => {
  if (typeof time === 'number') {
    return time;
  }

  // Validate string format
  if (typeof time !== 'string') {
    throw new Error('Invalid time format. Expected format: 1ms, 1s, 1m, 1h, 1d');
  }

  if (time.length < 2) {
    throw new Error('Invalid time format. Expected format: 1ms, 1s, 1m, 1h, 1d');
  }

  if (time.length > 3) {
    throw new Error('Invalid time format. Expected format: 1ms, 1s, 1m, 1h, 1d');
  }

  // Extract unit (last character)
  const unit = time.includes('ms') ? time.slice(-2) : time.slice(-1);
  const value = time.includes('ms') ? time.slice(0, -2) : time.slice(0, -1);

  // Validate unit
  if (!['ms', 's', 'm', 'h', 'd'].includes(unit)) {
    throw new Error(`Invalid time unit: "${unit}". Expected: s (seconds), m (minutes), h (hours), or d (days)`);
  }

  // Parse numeric value
  const numValue = Number(value);
  if (isNaN(numValue) || numValue <= 0) {
    throw new Error(`Invalid time value: "${value}". Must be a positive number`);
  }

  // Convert to milliseconds based on unit
  switch (unit) {
    case 'ms':
      return numValue;
    case 's':
      return numValue * 1000;
    case 'm':
      return numValue * 60 * 1000;
    case 'h':
      return numValue * 60 * 60 * 1000;
    case 'd':
      return numValue * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unsupported time unit: "${unit}"`);
  }
};
