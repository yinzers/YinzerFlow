/**
 * YinzerFlow Logging Levels
 *
 * String-based logging levels for intuitive configuration:
 * - 'off': No logging except errors
 * - 'error': Only errors
 * - 'warn': Warnings and errors (includes security warnings, slow requests)
 * - 'info': Info, warnings, and errors (standard application logging)
 *
 * Network logging is controlled separately via boolean networkLogging config.
 */
export const logLevels = {
  off: 'off',
  error: 'error',
  warn: 'warn',
  info: 'info',
} as const;
