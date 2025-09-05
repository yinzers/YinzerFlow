import { createServer } from 'net';
import type { Socket } from 'net';

import { RequestHandlerImpl } from '@core/execution/RequestHandlerImpl.ts';
import { ContextImpl } from '@core/execution/ContextImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { log } from '@core/utils/log.ts';
import type { ServerConfiguration } from '@typedefs/public/Configuration.js';
import { getStatusEmoji, logPerformanceDetails, networkLog } from '@core/utils/networkLog.ts';
import { calculateContentSizeInBytes } from '@core/utils/calculateContentSizeInBytes.ts';

/**
 * Main YinzerFlow application class for building HTTP servers.
 *
 * YinzerFlow is a lightweight, high-performance HTTP server framework built on Node.js
 * that provides an elegant API for routing, middleware, and request handling. It extends
 * the Setup interface to provide all route configuration capabilities plus server management.
 *
 * ## Key Features
 *
 * - **High Performance**: Built on Node.js net module for maximum performance
 * - **Type Safety**: Full TypeScript support with generics for type-safe contexts
 * - **Route Groups**: Nested route organization with shared hooks and middleware
 * - **Global Hooks**: beforeAll/afterAll hooks for cross-cutting concerns
 * - **State Management**: Request-scoped state for sharing data between middleware
 * - **Graceful Shutdown**: Automatic graceful shutdown handling
 * - **Logging**: Built-in logging with custom logger support
 * - **Network Logging**: Request/response logging with performance metrics
 *
 * ## Basic Usage
 *
 * @example
 * ```typescript
 * import { YinzerFlow } from 'yinzerflow';
 *
 * // Create app with basic configuration
 * const app = new YinzerFlow({ port: 3000 });
 *
 * // Register routes
 * app.get('/api/users', async (ctx) => {
 *   return { users: ['John', 'Jane'] };
 * });
 *
 * app.post('/api/users', async (ctx) => {
 *   const { name, email } = ctx.request.body;
 *   return { message: 'User created', name, email };
 * });
 *
 * // Set up global hooks
 * app.beforeAll([
 *   async (ctx) => {
 *     ctx.state.requestId = generateRequestId();
 *     ctx.state.startTime = Date.now();
 *   }
 * ]);
 *
 * app.afterAll([
 *   async (ctx) => {
 *     const processingTime = Date.now() - ctx.state.startTime;
 *     ctx.response.addHeaders({
 *       'X-Processing-Time': `${processingTime}ms`,
 *       'X-Request-ID': ctx.state.requestId
 *     });
 *   }
 * ]);
 *
 * // Create route groups
 * app.group('/api/v1', (api) => {
 *   api.group('/admin', (admin) => {
 *     admin.get('/users', async (ctx) => {
 *       return { adminUsers: ['Admin1', 'Admin2'] };
 *     });
 *   });
 * });
 *
 * // Start the server
 * app.listen();
 * ```
 *
 * ## Advanced Configuration
 *
 * @example
 * ```typescript
 * // Advanced configuration with custom logging
 * const app = new YinzerFlow({
 *   port: 8080,
 *   host: '0.0.0.0',
 *   logLevel: 'debug',
 *   networkLogs: true,
 *   autoGracefulShutdown: true,
 *   logger: {
 *     info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
 *     warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
 *     error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
 *     debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args)
 *   },
 *   networkLogger: {
 *     info: (message, ...args) => console.log(`[NETWORK] ${message}`, ...args)
 *   }
 * });
 *
 * // Custom error handling
 * app.onError(async (ctx, error) => {
 *   ctx.response.setStatusCode(500);
 *   return {
 *     error: 'Internal server error',
 *     message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
 *   };
 * });
 *
 * // Custom not-found handling
 * app.onNotFound(async (ctx) => {
 *   ctx.response.setStatusCode(404);
 *   return {
 *     error: 'Not found',
 *     path: ctx.request.path,
 *     availableEndpoints: ['/api/users', '/api/posts', '/health']
 *   };
 * });
 * ```
 *
 * ## Server Lifecycle
 *
 * 1. **Initialization**: Constructor sets up logging and configuration
 * 2. **Route Setup**: Register routes, hooks, and middleware
 * 3. **Server Start**: Call `listen()` to start accepting connections
 * 4. **Request Processing**: Handle incoming HTTP requests
 * 5. **Graceful Shutdown**: Automatic cleanup on process termination
 *
 * @see {@link SetupImpl} for route configuration capabilities
 * @see {@link ServerConfiguration} for configuration options
 * @see {@link ContextImpl} for request context implementation
 * @see {@link RequestHandlerImpl} for request processing
 */
export class YinzerFlow extends SetupImpl {
  private _isListening = false;
  private _server?: ReturnType<typeof createServer>;

  constructor(configuration?: ServerConfiguration) {
    super(configuration);

    // Replace global logger if custom logger is provided
    if (this._configuration.logger) {
      // Replace the global log instance with the custom logger
      Object.assign(log, this._configuration.logger);
    }

    // Set network logger if provided (optional - can be same as app logger or different)
    if (this._configuration.networkLogs) {
      networkLog.enable(this._configuration.networkLogger);
    }

    // Setup automatic graceful shutdown if enabled
    if (this._configuration.autoGracefulShutdown) {
      this._setupGracefulShutdown();
    }
  }

  /**
   * Setup server with all event listeners
   */
  private _setupServer(resolve: () => void, reject: (error: Error) => void, requestHandler: RequestHandlerImpl): void {
    if (!this._server) return;

    this._server.on('error', (error: Error) => {
      networkLog.log.error(`YinzerFlow server error at ${this._configuration.host}:${this._configuration.port} - ${error.message}`);
      reject(error);
    });

    this._server.on('listening', () => {
      this._isListening = true;
      networkLog.log.info(`YinzerFlow server at ${this._configuration.host}:${this._configuration.port} is up and running`);
      resolve();
    });

    this._server.on('connection', (socket) => {
      this._handleConnection(socket, requestHandler);
    });
  }

  /**
   * Process incoming request data
   */
  private async _processRequest({
    data,
    socket,
    requestHandler,
    clientAddress,
  }: {
    data: Buffer;
    socket: Socket;
    requestHandler: RequestHandlerImpl;
    clientAddress: string;
  }): Promise<void> {
    const startTime = Date.now();

    // Log incoming request
    networkLog.log.info('Incoming request', `${clientAddress} ${calculateContentSizeInBytes(data)}bytes`);

    const context = new ContextImpl(data, this, clientAddress);

    await requestHandler.handle(context);

    socket.write(context._response._stringBody);
    socket.end();

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Log request response
    networkLog.log.info(
      `${getStatusEmoji(context._response._statusCode)} ${clientAddress} "${context.request.method} ${context.request.path} ${context.request.protocol}" ${context._response._statusCode} ${calculateContentSizeInBytes(context._response._body)}bytes "${context.request.headers.referer ?? '-'}" "${context.request.headers['user-agent'] ?? '-'}" ${processingTime}ms`,
    );
    logPerformanceDetails(processingTime);
  }

  /**
   * Handle incoming TCP socket connections and their complete lifecycle
   *
   * This method manages both legitimate HTTP requests and various types of probes:
   * - Health checks from monitoring tools (Datadog, New Relic, etc.)
   * - Load balancer health probes
   * - API testing tools connectivity checks (Postman, Apidog, etc.)
   * - Potential security probes or DoS attempts
   */
  private _handleConnection(socket: Socket, requestHandler: RequestHandlerImpl): void {
    // Extract client information for logging and security tracking
    const clientAddress = socket.remoteAddress ?? 'unknown';
    const connectionStartTime = Date.now();

    // Track connection state to distinguish between probes and real requests
    let hasReceivedData = false;
    let dataReceiveTime: number | null = null;

    /**
     * Log every TCP connection for comprehensive network monitoring
     * This helps identify connection patterns, DoS attempts, and client behavior
     */
    networkLog.log.info(`New visitor from ${clientAddress}`);

    /**
     * Handle incoming data on the socket
     * This fires when the client sends HTTP request data
     */
    socket.on('data', (data) => {
      // Track first data receipt for timing analysis
      if (!hasReceivedData) {
        hasReceivedData = true;
        dataReceiveTime = Date.now();
        const connectionToDataDelay = dataReceiveTime - connectionStartTime;

        /**
         * Flag connections with unusual delays between connect and data
         * Normal HTTP clients send data immediately after connecting
         * Delays >100ms might indicate:
         * - Slow/problematic clients
         * - Potential reconnaissance attempts
         * - Network issues
         */
        if (connectionToDataDelay > 100) {
          networkLog.log.warn(`Delayed data from ${clientAddress} (${connectionToDataDelay}ms connection delay)`);
        }
      }

      /**
       * Process the HTTP request data
       * This handles parsing, routing, middleware, and response generation
       */
      this._processRequest({ data, socket, requestHandler, clientAddress }).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        networkLog.log.error(`Visitor from ${clientAddress} experienced an error during request processing: ${errorMessage}`, error);
        socket.destroy(); // Force close on processing errors
      });
    });

    /**
     * Handle socket errors (network issues, malformed connections, etc.)
     * These are typically infrastructure problems, not application errors
     */
    socket.on('error', (error: Error) => {
      networkLog.log.error(`Visitor from ${clientAddress} experienced an error during socket connection: ${error.message}`, error);
    });

    /**
     * Handle socket closure - both graceful and forced disconnections
     * This is where we analyze connection patterns for security and diagnostics
     */
    socket.on('close', () => {
      const connectionDuration = Date.now() - connectionStartTime;

      if (hasReceivedData) {
        /**
         * Normal HTTP request lifecycle completed
         * Log successful completion with total connection time
         */
        networkLog.log.info(`Visitor from ${clientAddress} headed out (${connectionDuration}ms total)`);
        return;
      }

      // Connection closed without sending HTTP data - analyze the pattern
      if (connectionDuration < 10) {
        /**
         * Fast disconnect (< 10ms) = likely legitimate health check
         * Common with:
         * - Monitoring tools (Datadog, New Relic, Prometheus)
         * - Load balancers (AWS ALB, nginx, HAProxy)
         * - API testing tools (Postman, Apidog, Insomnia)
         */
        networkLog.log.info(`${clientAddress} quick connectivity check (${connectionDuration}ms) - health probe`);
      } else {
        /**
         * Slower disconnect without data = potentially suspicious
         * Could indicate:
         * - Port scanning attempts
         * - DoS reconnaissance
         * - Misconfigured clients
         * - Network connectivity issues
         */
        networkLog.log.warn(`${clientAddress} disconnected without sending data (${connectionDuration}ms) - potential probe`);
      }
    });
  }

  async listen(): Promise<void> {
    if (this._isListening) {
      throw new Error('Server is already listening');
    }

    return new Promise((resolve, reject) => {
      const requestHandler = new RequestHandlerImpl(this);
      this._server = createServer();

      this._setupServer(resolve, reject, requestHandler);
      this._server.listen(this._configuration.port, this._configuration.host);
    });
  }

  async close(): Promise<void> {
    if (!this._isListening || !this._server) {
      return;
    }

    return new Promise((resolve) => {
      if (!this._server) {
        this._isListening = false; // Probably redundant but just in case
        resolve();
        return;
      }

      this._server.close(() => {
        this._isListening = false;
        networkLog.log.warn(`YinzerFlow server at ${this._configuration.host}:${this._configuration.port} is shutting down - See yinz later`);
        resolve();
      });
    });
  }

  status(): {
    isListening: boolean;
    port: number | undefined;
    host: string | undefined;
  } {
    return {
      isListening: this._isListening,
      port: this._configuration.port,
      host: this._configuration.host,
    };
  }

  /**
   * Setup automatic graceful shutdown handlers
   */
  private _setupGracefulShutdown(): void {
    // Only setup if no handlers are already registered
    if (process.listenerCount('SIGTERM') === 0 && process.listenerCount('SIGINT') === 0) {
      const shutdown = (signal: string): void => {
        log.info(`🛑 Received ${signal}, shutting down gracefully...`);
        this.close()
          .then(() => {
            log.info('✅ Server shut down gracefully');
            process.exit(0);
          })
          .catch((error) => {
            log.error('❌ Error during graceful shutdown:', error);
            process.exit(1);
          });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }
  }
}
