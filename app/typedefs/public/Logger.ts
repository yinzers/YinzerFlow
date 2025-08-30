/**
 * Logger Interface for YinzerFlow.
 *
 * Users can implement this interface to use their own logging system
 * (Winston, Pino, etc.) instead of the built-in YinzerFlow logger.
 *
 * ## Logging Levels
 *
 * - **info**: General application information and status updates
 * - **warn**: Warning messages for potentially problematic situations
 * - **error**: Error messages for failed operations and exceptions
 * - **debug**: Detailed debugging information (optional)
 * - **trace**: Very detailed tracing information (optional)
 *
 * ## Implementation Requirements
 *
 * - **Required**: `info`, `warn`, `error` methods must be implemented
 * - **Optional**: `debug` and `trace` methods can be omitted
 * - **Arguments**: All methods accept variable arguments for flexible logging
 * - **Return**: Methods should not return values (void)
 *
 * @example
 * ```typescript
 * import { YinzerFlow } from 'yinzerflow';
 *
 * // Winston logger implementation
 * import winston from 'winston';
 *
 * const winstonLogger: Logger = {
 *   info: (...args) => winston.info(args.join(' ')),
 *   warn: (...args) => winston.warn(args.join(' ')),
 *   error: (...args) => winston.error(args.join(' ')),
 *   debug: (...args) => winston.debug(args.join(' ')),
 *   trace: (...args) => winston.verbose(args.join(' '))
 * };
 *
 * const app = new YinzerFlow({
 *   port: 3000,
 *   logger: winstonLogger
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Pino logger implementation
 * import pino from 'pino';
 *
 * const pinoLogger = pino({ level: 'info' });
 *
 * const logger: Logger = {
 *   info: (...args) => pinoLogger.info(args),
 *   warn: (...args) => pinoLogger.warn(args),
 *   error: (...args) => pinoLogger.error(args),
 *   debug: (...args) => pinoLogger.debug(args)
 * };
 *
 * const app = new YinzerFlow({
 *   port: 3000,
 *   logger
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Console-based custom logger
 * const customLogger: Logger = {
 *   info: (...args) => {
 *     const timestamp = new Date().toISOString();
 *     console.log(`[${timestamp}] [INFO]`, ...args);
 *   },
 *   warn: (...args) => {
 *     const timestamp = new Date().toISOString();
 *     console.warn(`[${timestamp}] [WARN]`, ...args);
 *   },
 *   error: (...args) => {
 *     const timestamp = new Date().toISOString();
 *     console.error(`[${timestamp}] [ERROR]`, ...args);
 *   },
 *   debug: (...args) => {
 *     if (process.env.NODE_ENV === 'development') {
 *       const timestamp = new Date().toISOString();
 *       console.debug(`[${timestamp}] [DEBUG]`, ...args);
 *     }
 *   }
 * };
 *
 * const app = new YinzerFlow({
 *   port: 3000,
 *   logger: customLogger
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Structured logging with JSON output
 * const structuredLogger: Logger = {
 *   info: (...args) => {
 *     const logEntry = {
 *       timestamp: new Date().toISOString(),
 *       level: 'info',
 *       message: args.map(arg =>
 *         typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
 *       ).join(' '),
 *       args: args
 *     };
 *     console.log(JSON.stringify(logEntry));
 *   },
 *   warn: (...args) => {
 *     const logEntry = {
 *       timestamp: new Date().toISOString(),
 *       level: 'warn',
 *       message: args.map(arg =>
 *         typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
 *       ).join(' '),
 *       args: args
 *     };
 *     console.warn(JSON.stringify(logEntry));
 *   },
 *   error: (...args) => {
 *     const logEntry = {
 *       timestamp: new Date().toISOString(),
 *       level: 'error',
 *       message: args.map(arg =>
 *         typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
 *       ).join(' '),
 *       args: args
 *     };
 *     console.error(JSON.stringify(logEntry));
 *   }
 * };
 *
 * const app = new YinzerFlow({
 *   port: 3000,
 *   logger: structuredLogger
 * });
 * ```
 *
 * @see {@link YinzerFlow} for how to use custom loggers
 * @see {@link ServerConfiguration} for logger configuration options
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
   * Logs detailed debugging information (optional).
   *
   * Use this level for detailed information that's only needed during
   * development and debugging. This method is optional and can be omitted.
   *
   * @param args - Variable arguments to log (strings, objects, etc.)
   *
   * @example
   * ```typescript
   * // Debug examples
   * logger.debug('Request headers received', { headers: request.headers });
   * logger.debug('SQL query executed', { query: sql, params: values });
   * logger.debug('Cache miss for key', { key: 'user:123', reason: 'expired' });
   *
   * // Conditional debug logging
   * if (process.env.NODE_ENV === 'development') {
   *   logger.debug('Processing step completed', { step: 'validation', data: input });
   * }
   * ```
   */
  debug?: (...args: Array<unknown>) => void;

  /**
   * Logs very detailed tracing information (optional).
   *
   * Use this level for the most detailed information, typically only
   * needed for deep debugging. This method is optional and can be omitted.
   *
   * @param args - Variable arguments to log (strings, objects, etc.)
   *
   * @example
   * ```typescript
   * // Trace examples
   * logger.trace('Function entry', {
   *   function: 'validateUser',
   *   parameters: { email, password },
   *   timestamp: Date.now()
   * });
   *
   * logger.trace('Database query details', {
   *   connection: 'pool-1',
   *   query: 'SELECT * FROM users WHERE id = ?',
   *   parameters: [userId],
   *   executionPlan: queryPlan
   * });
   *
   * // Performance tracing
   * logger.trace('Performance checkpoint', {
   *   operation: 'userAuthentication',
   *   duration: '15ms',
   *   memoryUsage: process.memoryUsage()
   * });
   * ```
   */
  trace?: (...args: Array<unknown>) => void;
}
