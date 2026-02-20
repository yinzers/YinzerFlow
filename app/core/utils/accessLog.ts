import { logLevels } from '@constants/log.ts';

/**
 * Access Log — nginx-style request/response logging.
 *
 * Separate channel from the app logger. Controlled by `logging.requests` (on/off).
 * Defaults to off. When enabled, logs one line per request in a parseable format.
 *
 * Format: {statusEmoji} {ip} "{METHOD} {path} {proto}" {statusCode} {bytes} "{referer}" "{ua}" {duration}ms
 *
 * The logger instance is created per YinzerFlow instance (C1 fix — no module-level singleton).
 * See YinzerFlow._configureLogging() for instance creation.
 */

/** Base config for access log loggers. Personality is always off for machine-parseable output. */
export const accessLogBaseConfig = {
  prefix: 'ACCESS',
  level: logLevels.off,
  personality: false,
} as const;

/**
 * Get status emoji for response codes
 */
export const getStatusEmoji = (statusCode: number): string => {
  if (statusCode >= 200 && statusCode < 300) return '✅';
  if (statusCode >= 300 && statusCode < 400) return '🔄';
  if (statusCode >= 400 && statusCode < 500) return '❌';
  if (statusCode >= 500) return '💥';
  return '❓';
};
