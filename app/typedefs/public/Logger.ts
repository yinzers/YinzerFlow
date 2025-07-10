/**
 * Logger Interface for YinzerFlow
 *
 * Users can implement this interface to use their own logging system
 * (Winston, Pino, etc.) instead of the built-in YinzerFlow logger
 */
export interface Logger {
  info: (...args: Array<unknown>) => void;
  warn: (...args: Array<unknown>) => void;
  error: (...args: Array<unknown>) => void;
  debug?: (...args: Array<unknown>) => void;
  trace?: (...args: Array<unknown>) => void;
}
