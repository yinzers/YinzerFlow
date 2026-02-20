import type { LogLevel } from '@typedefs/constants/log.js';

/**
 * Logger Interface for YinzerFlow.
 *
 * Any object with `info`, `warn`, and `error` methods satisfies this interface.
 * Most logging libraries (Winston, Pino, Bunyan, Datadog) work out of the box.
 *
 * ## How It Works
 *
 * Pass your logger to `logging.logger` in the framework config. YinzerFlow sends
 * raw args to your logger — no ANSI formatting, no timestamps. Your logger handles
 * its own formatting.
 *
 * This wires **framework-internal logs** (startup, shutdown, errors, warnings)
 * to your logger instead of `console`. In your own route handlers, import your
 * logger directly — you keep the full API (child loggers, serializers, metadata)
 * and avoid double log-level filtering.
 *
 * ## Recommended Setup
 *
 * ```
 * // your-logger.ts — your Winston/Pino/custom logger
 * import winston from 'winston';
 * export default winston.createLogger({ ... });
 *
 * // app.ts — wire framework logs to your logger
 * import logger from './your-logger';
 * const app = new YinzerFlow({
 *   logging: { logger },  // Framework internal logs → Winston
 * });
 *
 * // routes/*.ts — import YOUR logger, not the framework's
 * import logger from '../your-logger';
 * app.get('/api/users', () => {
 *   logger.info('handling request', { correlationId: '...' });
 *   return { users: [] };
 * });
 * ```
 *
 * **Why import your logger directly instead of `import { log } from 'yinzerflow'`?**
 *
 * - **Full API**: Winston child loggers, Pino serializers/redaction, structured
 *   metadata — the framework `log` only exposes `info`/`warn`/`error`/`debug`.
 * - **No double filtering**: The framework applies its own `logging.level` before
 *   delegating. If framework level is `'warn'` but your logger is `'info'`,
 *   `log.info()` through the framework is silently dropped.
 * - **Ecosystem convention**: Every Winston/Pino guide imports the logger directly.
 *   `logging.logger` exists to capture framework-internal logs, not to replace
 *   your logger in your own code.
 *
 * ## Two Logger Channels
 *
 * - `logging.logger` — receives framework app logs (startup, errors, warnings)
 * - `logging.accessLogger` — receives per-request access log lines
 *
 * ## Required Methods
 *
 * - `info`, `warn`, `error` — must be implemented
 * - `debug` — optional, debug messages are dropped if omitted
 *
 * @example
 * ```typescript
 * // Winston — pass directly, no wrapper needed
 * import winston from 'winston';
 * import { YinzerFlow } from 'yinzerflow';
 *
 * const winstonLogger = winston.createLogger({
 *   level: 'info',
 *   transports: [new winston.transports.Console()],
 * });
 *
 * const app = new YinzerFlow({
 *   logging: {
 *     logger: winstonLogger,        // Framework logs → Winston
 *     accessLogger: winstonLogger,   // Access logs → Winston (can be separate)
 *   },
 * });
 *
 * // In route handlers, import your logger directly for the full API:
 * app.get('/api/users', () => {
 *   winstonLogger.info('handling request', { correlationId: 'abc' });
 *   return { users: [] };
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Pino — same pattern
 * import pino from 'pino';
 * import { YinzerFlow } from 'yinzerflow';
 *
 * const pinoLogger = pino({ level: 'info' });
 *
 * const app = new YinzerFlow({
 *   logging: {
 *     logger: pinoLogger,
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Minimal custom logger
 * import { YinzerFlow } from 'yinzerflow';
 *
 * const app = new YinzerFlow({
 *   logging: {
 *     logger: {
 *       info: (...args) => console.log('[INFO]', ...args),
 *       warn: (...args) => console.warn('[WARN]', ...args),
 *       error: (...args) => console.error('[ERROR]', ...args),
 *     },
 *   },
 * });
 * ```
 *
 * @see {@link ServerOptions} for full logging configuration options
 */
export interface Logger {
  /**
   * Logs informational messages about application status and operations.
   *
   * Use this level for general application flow, successful operations,
   * and status updates that are useful for monitoring and debugging.
   *
   * @param args - Variable arguments to log (strings, objects, etc.)
   *
   * @example
   * ```typescript
   * // Basic info logging
   * logger.info('Server started on port 3000');
   * logger.info('User authenticated successfully', { userId: '123' });
   * logger.info('Database connection established');
   *
   * // Multiple arguments
   * logger.info('Request processed', {
   *   method: 'POST',
   *   path: '/api/users',
   *   duration: '45ms',
   *   statusCode: 201
   * });
   * ```
   */
  info: (...args: Array<unknown>) => void;

  /**
   * Logs warning messages for potentially problematic situations.
   *
   * Use this level for situations that aren't errors but might indicate
   * problems or require attention in the future.
   *
   * @param args - Variable arguments to log (strings, objects, etc.)
   *
   * @example
   * ```typescript
   * // Warning examples
   * logger.warn('High memory usage detected', { usage: '85%' });
   * logger.warn('Deprecated API endpoint called', { endpoint: '/api/v1/users' });
   * logger.warn('Rate limit approaching threshold', { current: 95, limit: 100 });
   *
   * // Warning with context
   * logger.warn('Slow database query detected', {
   *   query: 'SELECT * FROM users',
   *   duration: '2.5s',
   *   threshold: '1s'
   * });
   * ```
   */
  warn: (...args: Array<unknown>) => void;

  /**
   * Logs error messages for failed operations and exceptions.
   *
   * Use this level for actual errors that prevent normal operation
   * or indicate system failures that need immediate attention.
   *
   * @param args - Variable arguments to log (strings, objects, etc.)
   *
   * @example
   * ```typescript
   * // Error examples
   * logger.error('Database connection failed', {
   *   error: 'Connection timeout',
   *   host: 'db.example.com',
   *   port: 5432
   * });
   *
   * logger.error('Failed to process request', {
   *   error: error.message,
   *   stack: error.stack,
   *   requestId: 'req-123',
   *   userId: 'user-456'
   * });
   *
   * // Error with stack trace
   * try {
   *   await riskyOperation();
   * } catch (error) {
   *   logger.error('Operation failed', error);
   * }
   * ```
   */
  error: (...args: Array<unknown>) => void;

  /**
   * Logs detailed debugging information.
   *
   * Use this level for verbose connection details, internal state,
   * and information only needed during active debugging.
   * This method is optional — if not provided on a custom logger,
   * debug messages will be silently dropped.
   *
   * @param args - Variable arguments to log (strings, objects, etc.)
   */
  debug?: ((...args: Array<unknown>) => void) | undefined;
}

export interface LoggerConfig {
  level?: LogLevel | undefined;
  prefix?: string | undefined;
  /** @deprecated Use `level` instead. Will be removed in a future version. */
  logLevel?: LogLevel | undefined;
}
