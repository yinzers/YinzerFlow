import type { IServerOptions } from 'types/Server.ts';
import type { TErrorFunction } from 'types/Response.ts';
import type { Context } from 'core/Context.ts';
import type { TResponseBody } from 'types/http/Response.ts';
import {
  DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT,
  DEFAULT_HEADERS_TIMEOUT,
  DEFAULT_KEEP_ALIVE_TIMEOUT,
  DEFAULT_PORT,
  DEFAULT_SOCKET_TIMEOUT,
} from 'constants/connection.ts';
import { HttpStatusCode } from 'constants/http.ts';

/**
 * Manages application configuration in a centralized way
 *
 * This class provides a single source of truth for all configuration options,
 * making it easier to access configuration throughout the application without
 * passing options through multiple layers.
 */
export class ConfigManager {
  readonly port: number;
  readonly errorHandler: TErrorFunction;
  readonly connectionOptions: Required<IServerOptions>['connectionOptions'];
  readonly parserOptions: Required<IServerOptions>['parserOptions'];

  constructor(options?: IServerOptions) {
    this.port = this._setPort(options?.port);
    this.errorHandler = this._setErrorHandler(options?.errorHandler);
    this.connectionOptions = this._setConnectionOptions(options?.connectionOptions);
    this.parserOptions = this._setParserOptions(options?.parserOptions);
  }

  /**
   * Sets the port number and normalizes it to a number
   */
  private _setPort(port?: number | string): number {
    const normalizedPort = typeof port === 'string' ? parseInt(port, 10) : (port ?? DEFAULT_PORT);
    if (isNaN(normalizedPort) || normalizedPort < 0 || normalizedPort > 65535) {
      throw new Error('Invalid port number');
    }
    return normalizedPort;
  }

  /**
   * Sets the error handler with validation
   */
  private _setErrorHandler(handler?: TErrorFunction): TErrorFunction {
    if (handler && typeof handler !== 'function') {
      throw new Error('Error handler must be a function');
    }
    return (
      handler ??
      (({ response }: Context, error: unknown): TResponseBody<unknown> => {
        console.error('Server error: \n', error);
        response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
        if (error instanceof Error) {
          return { success: false, message: error.message };
        }
        return { success: false, message: 'An unknown error occurred' };
      })
    );
  }

  /**
   * Sets and validates connection options
   */
  private _setConnectionOptions(options?: IServerOptions['connectionOptions']): Required<IServerOptions>['connectionOptions'] {
    const normalizedOptions = {
      socketTimeout: this._normalizeTimeout(options?.socketTimeout, DEFAULT_SOCKET_TIMEOUT),
      gracefulShutdownTimeout: this._normalizeTimeout(options?.gracefulShutdownTimeout, DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT),
      keepAliveTimeout: this._normalizeTimeout(options?.keepAliveTimeout, DEFAULT_KEEP_ALIVE_TIMEOUT),
      headersTimeout: this._normalizeTimeout(options?.headersTimeout, DEFAULT_HEADERS_TIMEOUT),
    };

    if (normalizedOptions.headersTimeout <= normalizedOptions.keepAliveTimeout) {
      throw new Error('headersTimeout must be greater than keepAliveTimeout');
    }

    return normalizedOptions;
  }

  /**
   * Normalizes a timeout value to a positive number
   */
  private _normalizeTimeout(value: number | string | undefined, defaultValue: number): number {
    const normalized = typeof value === 'string' ? parseInt(value, 10) : (value ?? defaultValue);
    if (isNaN(normalized) || normalized < 0) {
      throw new Error('Timeout must be a positive number');
    }
    return normalized;
  }

  /**
   * Sets and validates parser options
   */
  private _setParserOptions(options?: IServerOptions['parserOptions']): Required<IServerOptions>['parserOptions'] {
    const normalizedOptions = options ?? {};

    // Validate JSON parser options
    if (normalizedOptions.json?.raw !== undefined && typeof normalizedOptions.json.raw !== 'boolean') {
      throw new Error('JSON parser raw option must be a boolean');
    }

    // Validate YAML parser options
    if (normalizedOptions.yaml?.raw !== undefined && typeof normalizedOptions.yaml.raw !== 'boolean') {
      throw new Error('YAML parser raw option must be a boolean');
    }

    return normalizedOptions;
  }
}
