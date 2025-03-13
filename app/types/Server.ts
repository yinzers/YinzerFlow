import type { TErrorFunction } from 'types/Response.ts';

export interface IServerOptions {
  port?: number;
  errorHandler?: TErrorFunction;
  connectionOptions?: {
    socketTimeout?: number;
    gracefulShutdownTimeout?: number;
  };
  parserOptions?: {
    json?: {
      raw?: boolean;
    };
    yaml?: {
      raw?: boolean;
    };
  };
}
