/**
 * YinzerFlow Logging Levels
 *
 * String-based logging levels for intuitive configuration:
 * - 'off': No logging at all
 * - 'error': Only errors
 * - 'warn': Warnings and errors (includes security warnings)
 * - 'info': Info, warnings, and errors (standard application logging)
 * - 'debug': All messages including verbose connection details
 *
 * Access logging (request/response lines) is controlled separately via `logging.requests`.
 */
export const logLevels = {
  off: 'off',
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
} as const;
