import type { TErrorFunction } from 'types/Response.ts';

export interface IServerOptions {
  port?: number;
  errorHandler?: TErrorFunction;
  connectionOptions?: {
    socketTimeout: number; // for active connections
    gracefulShutdownTimeout: number; // for shutdown allowing for active connections to complete
    keepAliveTimeout: number; // for idle keep-alive connections this allows a connection to stay open for a period of time so subsequent requests can be handled without a new connection
    headersTimeout: number; // for waiting for headers this is the maximum time to wait for a header from the client
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
