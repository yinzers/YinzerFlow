import { createServer } from 'net';
import type { Socket } from 'net';

import { RequestHandlerImpl } from '@core/execution/RequestHandlerImpl.ts';
import { ContextImpl } from '@core/execution/ContextImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { log } from '@core/utils/log.ts';
import type { ServerOptions } from '@typedefs/public/Configuration.js';
import { getStatusEmoji, logPerformanceDetails, networkLog } from '@core/utils/networkLog.ts';
import { calculateContentSizeInBytes } from '@core/utils/calculateContentSizeInBytes.ts';
import { _createGlobalRateLimitHook } from '@core/modules/rateLimit/rateLimithooks.ts';
import { RateLimiter } from '@core/modules/rateLimit/RateLimiter.ts';
import { _convertTimeToMs } from '@core/utils/time.ts';
import { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import { cookieParserHook } from '@core/modules/cookieParser/cookieParserHooks.ts';
import { CookieParserConfig } from '@core/modules/cookieParser/CookieParserConfig.ts';
import { corsHook } from '@core/modules/cors/corsHooks.ts';
import { CorsConfig } from '@core/modules/cors/CorsConfig.ts';
import type { InternalCorsEnabledOptions } from '@typedefs/internal/InternalConfiguration.js';

/**
 * Maximum overhead allowance for HTTP headers on top of body parser limits (64KB).
 *
 * The TCP buffer limit is `max(bodyParserLimits) + maxHeaderOverhead` because the raw
 * TCP stream contains both headers and body. The body portion is bounded by the user's
 * body parser config (json.maxSize, urlEncoded.maxSize, fileUploads.maxTotalSize), but
 * we also need room for the request line, headers, and the blank line separator.
 *
 * 64KB is generous — most HTTP headers are 2-8KB (nginx defaults to 8KB max). This
 * leaves plenty of room for large cookie headers or verbose auth tokens while still
 * rejecting obviously malicious oversized requests at the TCP level before parsing.
 */
const maxHeaderOverhead = 65_536;

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
 * @see {@link ServerOptions} for configuration options
 * @see {@link ContextImpl} for request context implementation
 * @see {@link RequestHandlerImpl} for request processing
 */
export class YinzerFlow extends SetupImpl {
  private _isListening = false;
  private _server?: ReturnType<typeof createServer>;
  private _globalRateLimiter?: RateLimiter | undefined;
  private _maxBufferSize: number;

  constructor(configuration?: ServerOptions) {
    super(configuration);

    // Pre-compute max buffer size from body parser limits (immutable after construction)
    this._maxBufferSize = Math.max(
      this._configuration.bodyParser.json.maxSize,
      this._configuration.bodyParser.urlEncoded.maxSize,
      this._configuration.bodyParser.fileUploads.maxTotalSize,
    ) + maxHeaderOverhead;

    // Replace global logger if custom logger is provided
    if (this._configuration.logger) {
      // Replace the global log instance with the custom logger
      Object.assign(log, this._configuration.logger);
    }

    // Set network logger if provided (optional - can be same as app logger or different)
    if (this._configuration.networkLogs) {
      networkLog.enable(this._configuration.networkLogger);
    }

    // Setup global rate limiting, if there is none provided, it will be enabled by default. We need to set the confgratin before the conditional since it is defaulted on and users might not pass it in the configuration.
    const rateLimitConfig = new RateLimitConfig(configuration?.rateLimit);
    if (configuration?.rateLimit?.enabled) {
      this._globalRateLimiter = new RateLimiter(rateLimitConfig);
      const hook = _createGlobalRateLimitHook(this._globalRateLimiter);
      this.beforeAll([hook]);
    }

    // Setup cookie parser, if enabled, since it is deisabled by default we can set the configuration after the conditional
    if (configuration?.cookieParser?.enabled) {
      const cookieParserConfig = new CookieParserConfig(configuration.cookieParser);
      const cookieParserHookFunc = cookieParserHook(cookieParserConfig.config);
      this.beforeAll([cookieParserHookFunc]);
    }

    // Setup CORS, if enabled, as a beforeRouting hook
    if (configuration?.cors?.enabled) {
      const corsConfig = CorsConfig.merge(configuration.cors);
      CorsConfig.validate(corsConfig);
      // Type assertion safe here: validate() throws if config is disabled
      const corsHookFunc = corsHook(corsConfig as InternalCorsEnabledOptions);
      this.beforeRouting([corsHookFunc]);
    }

    // Setup automatic graceful shutdown if enabled
    if (this._configuration.gracefulShutdownTimeout) {
      const gracefulShutdownTimeout = _convertTimeToMs(this._configuration.gracefulShutdownTimeout);
      if (gracefulShutdownTimeout > 0) {
        this._setupGracefulShutdown(gracefulShutdownTimeout);
      }
    }
  }

  /**
   * Setup server with all event listeners
   */
  private _setupServer(resolve: () => void, reject: (error: Error) => void, requestHandler: RequestHandlerImpl): void {
    if (!this._server) return;

    this._server.on('error', (error: Error) => {
      networkLog.log.error(`YinzerFlow server error at ${this._configuration.host}:${this._configuration.port} - ${error.message}`);
      // Clean up the failed server to prevent handle leaks on re-listen
      this._server?.close();
      delete this._server;
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

    // Guard against writing to a socket that was destroyed (client disconnect, timeout, etc.)
    if (!socket.destroyed) {
      socket.write(context._response._stringBody);
      socket.end();
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Log request response — use Buffer.byteLength on already-serialized string body
    // instead of re-serializing with calculateContentSizeInBytes
    const responseBytes = Buffer.byteLength(context._response._stringBody, 'utf8');
    networkLog.log.info(
      `${getStatusEmoji(context._response._statusCode)} ${clientAddress} "${context.request.method} ${context.request.path} ${context.request.protocol}" ${context._response._statusCode} ${responseBytes}bytes "${context.request.headers.referer ?? '-'}" "${context.request.headers['user-agent'] ?? '-'}" ${processingTime}ms`,
    );
    logPerformanceDetails(processingTime);
  }

  /**
   * Handle errors from request processing — log and destroy socket
   */
  private _handleRequestError(error: unknown, clientAddress: string, socket: Socket): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    networkLog.log.error(
      `Visitor from ${clientAddress} experienced an error during request processing: ${errorMessage}`,
      error,
    );
    if (!socket.destroyed) {
      socket.destroy();
    }
  }

  /**
   * Handle incoming TCP socket connections and their complete lifecycle.
   *
   * ## TCP Stream Reassembly
   *
   * TCP is a stream protocol — a single HTTP request may arrive across multiple
   * `data` events (especially for bodies > ~1.4KB TCP MSS on real networks).
   * This method implements a state machine to buffer chunks until the complete
   * HTTP request is received:
   *
   * 1. **Header Phase**: Accumulate chunks and search for the `\r\n\r\n` boundary.
   *    Once found, parse `Content-Length` to determine expected body size.
   *    During this phase, `Buffer.concat` is used since headers are small (< 8KB).
   *
   * 2. **Body Phase**: Track `totalLength` without concatenating. When
   *    `totalLength - headerBoundary >= expectedBodyLength`, the request is complete.
   *
   * 3. **Dispatch**: `Buffer.concat(chunks)` is called exactly once to produce
   *    the final contiguous buffer for request parsing.
   *
   * ## Non-HTTP Early Detection
   *
   * If the first bytes don't match any HTTP method start character (G, P, D, H, O),
   * or the first 8 bytes don't match an HTTP method + space pattern, the data is
   * dispatched immediately — the request parser handles malformed data gracefully.
   *
   * ## Security
   *
   * - Buffer size is capped at `_maxBufferSize` (largest body parser limit + 1MB header overhead)
   * - Oversized requests get HTTP 413 if headers were parsed, or silent socket destroy if not
   * - `requestDispatched` flag prevents double-dispatch on trailing TCP segments
   *
   * @see _processRequest for how the assembled buffer is parsed and handled
   */
  private _handleConnection(socket: Socket, requestHandler: RequestHandlerImpl): void {
    const clientAddress = socket.remoteAddress ?? 'unknown';
    const connectionStartTime = Date.now();

    let hasReceivedData = false;
    let dataReceiveTime: number | null = null;

    networkLog.log.info(`New visitor from ${clientAddress}`);

    // TCP stream reassembly state
    const chunks: Buffer[] = [];
    let totalLength = 0;
    let headersParsed = false;
    let expectedBodyLength = 0;
    let headerEndIndex = -1;
    let requestDispatched = false;

    socket.on('data', (chunk) => {
      // Track first data receipt for timing analysis
      if (!hasReceivedData) {
        hasReceivedData = true;
        dataReceiveTime = Date.now();
        const connectionToDataDelay = dataReceiveTime - connectionStartTime;
        if (connectionToDataDelay > 100) {
          networkLog.log.warn(`Delayed data from ${clientAddress} (${connectionToDataDelay}ms connection delay)`);
        }
      }

      if (requestDispatched) return;

      // Accumulate chunks without copying — O(1) per data event
      chunks.push(chunk);
      totalLength += chunk.length;

      // DoS protection: reject requests that exceed the maximum allowed size
      if (totalLength > this._maxBufferSize) {
        if (headersParsed) {
          // We know this is HTTP — send a proper 413 before destroying
          const errorBody = JSON.stringify({
            error: 'Payload too large',
            maxSize: this._maxBufferSize,
            received: totalLength,
          });
          const errorResponse =
            'HTTP/1.1 413 Payload Too Large\r\n' +
            'Content-Type: application/json\r\n' +
            `Content-Length: ${Buffer.byteLength(errorBody, 'utf8')}\r\n` +
            'Connection: close\r\n\r\n' +
            errorBody;
          socket.write(errorResponse);
        }
        networkLog.log.warn(
          `Request from ${clientAddress} exceeded maximum buffer size (${totalLength} > ${this._maxBufferSize} bytes). ` +
          `Current limits: json=${this._configuration.bodyParser.json.maxSize}, ` +
          `urlEncoded=${this._configuration.bodyParser.urlEncoded.maxSize}, ` +
          `fileUploads=${this._configuration.bodyParser.fileUploads.maxTotalSize}`,
        );
        socket.destroy();
        return;
      }

      // Phase 1: Find the end of HTTP headers (\r\n\r\n boundary)
      if (!headersParsed) {
        // Concat accumulated data to search for header boundary.
        // Headers are small (< 8KB typically), so this is negligible overhead.
        const buffer = Buffer.concat(chunks, totalLength);
        headerEndIndex = buffer.indexOf('\r\n\r\n');

        if (headerEndIndex === -1) {
          // No header boundary found yet — check if this even looks like HTTP.
          // If not, dispatch immediately so the parser can return a graceful error.
          let looksLikeHttp = true;

          if (totalLength >= 1) {
            // HTTP methods start with: G(ET)=0x47, P(OST/UT/ATCH)=0x50, D(ELETE)=0x44, H(EAD)=0x48, O(PTIONS)=0x4f
            const firstByte = chunks[0]![0]!;
            looksLikeHttp = firstByte === 0x47 || firstByte === 0x50 || firstByte === 0x44 || firstByte === 0x48 || firstByte === 0x4f;
          }

          // If first byte matched, do a fuller method check once we have enough data
          if (looksLikeHttp && totalLength >= 8) {
            const start = buffer.subarray(0, 8).toString();
            looksLikeHttp = /^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s/.test(start);
          }

          if (!looksLikeHttp) {
            requestDispatched = true;
            this._processRequest({ data: buffer, socket, requestHandler, clientAddress })
              .catch((error: unknown) => this._handleRequestError(error, clientAddress, socket));
          }

          return;
        }

        // Headers found — parse Content-Length to know how much body to expect
        headersParsed = true;
        const headersStr = buffer.subarray(0, headerEndIndex).toString();
        const contentLengthMatch = headersStr.match(/content-length:\s*(\d+)/i);
        expectedBodyLength = contentLengthMatch ? parseInt(contentLengthMatch[1] ?? '0', 10) : 0;

        // Check if body is already complete in this same buffer (common for small requests)
        const bodyStart = headerEndIndex + 4;
        const currentBodyLength = buffer.length - bodyStart;

        if (currentBodyLength >= expectedBodyLength) {
          requestDispatched = true;
          // Reuse the buffer we already concatenated — no second concat needed
          this._processRequest({ data: buffer, socket, requestHandler, clientAddress })
            .catch((error: unknown) => this._handleRequestError(error, clientAddress, socket));
        }

        return;
      }

      // Phase 2: Body accumulation — just check totalLength, no concat needed
      const bodyStart = headerEndIndex + 4;
      const currentBodyLength = totalLength - bodyStart;

      if (currentBodyLength >= expectedBodyLength) {
        requestDispatched = true;
        // Single final concat — O(n) total for the entire request
        const buffer = Buffer.concat(chunks, totalLength);
        this._processRequest({ data: buffer, socket, requestHandler, clientAddress })
          .catch((error: unknown) => this._handleRequestError(error, clientAddress, socket));
      }
    });

    socket.on('error', (error: Error) => {
      networkLog.log.error(`Visitor from ${clientAddress} experienced an error during socket connection: ${error.message}`, error);
    });

    socket.on('close', () => {
      const connectionDuration = Date.now() - connectionStartTime;

      if (hasReceivedData) {
        networkLog.log.info(`Visitor from ${clientAddress} headed out (${connectionDuration}ms total)`);
        return;
      }

      if (connectionDuration < 10) {
        networkLog.log.info(`${clientAddress} quick connectivity check (${connectionDuration}ms) - health probe`);
      } else {
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

    // Clean up rate limiter resources (intervals, memory)
    if (this._globalRateLimiter) {
      await this._globalRateLimiter.destroy();
      this._globalRateLimiter = undefined;
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
  private _setupGracefulShutdown(gracefulShutdownTimeout: number): void {
    if (gracefulShutdownTimeout <= 0) {
      return;
    }

    // Only setup if no handlers are already registered
    if (process.listenerCount('SIGTERM') === 0 && process.listenerCount('SIGINT') === 0) {
      const shutdown = (signal: string): void => {
        log.info(`🛑 Received ${signal}, shutting down gracefully in ${this._configuration.gracefulShutdownTimeout}...`);
        setTimeout(() => {
          this.close()
            .then(() => {
              log.info('✅ Server shut down gracefully');
              process.exit(0);
            })
            .catch((error) => {
              log.error('❌ Error during graceful shutdown:', error);
              process.exit(1);
            });
        }, gracefulShutdownTimeout);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }
  }
}
