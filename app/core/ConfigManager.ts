import type { IServerOptions } from 'types/Server.ts';

/**
 * Manages application configuration in a centralized way
 *
 * This class provides a single source of truth for all configuration options,
 * making it easier to access configuration throughout the application without
 * passing options through multiple layers.
 */
export class ConfigManager {
  private readonly options: IServerOptions;

  constructor(options?: IServerOptions) {
    this.options = options ?? {};
  }

  /**
   * Get parser options
   */
  get parserOptions(): IServerOptions['parserOptions'] {
    return this.options.parserOptions;
  }

  /**
   * Get connection options
   */
  get connectionOptions(): IServerOptions['connectionOptions'] {
    return this.options.connectionOptions;
  }

  /**
   * Get error handler
   */
  get errorHandler(): IServerOptions['errorHandler'] {
    return this.options.errorHandler;
  }

  /**
   * Get port
   */
  get port(): number | undefined {
    return this.options.port;
  }

  /**
   * Get the full options object
   */
  getOptions(): IServerOptions {
    return { ...this.options };
  }
}
