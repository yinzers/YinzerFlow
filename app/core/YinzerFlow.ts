import { createServer } from 'net';
import type { Socket } from 'net';

import { RequestHandlerImpl } from '@core/execution/RequestHandlerImpl.ts';
import { ContextImpl } from '@core/execution/ContextImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { createLogger, loggerBrand } from '@core/utils/log.ts';
import type { ServerOptions } from '@typedefs/public/Configuration.js';
import { accessLogBaseConfig, getStatusEmoji } from '@core/utils/accessLog.ts';
import { _createGlobalRateLimitHook } from '@core/modules/rateLimit/rateLimithooks.ts';
import { RateLimiter } from '@core/modules/rateLimit/RateLimiter.ts';
import { _convertTimeToMs } from '@core/utils/time.ts';
import { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import { cookieParserHook } from '@core/modules/cookieParser/cookieParserHooks.ts';
import { CookieParserConfig } from '@core/modules/cookieParser/CookieParserConfig.ts';
import { corsHook } from '@core/modules/cors/corsHooks.ts';
import { CorsConfig } from '@core/modules/cors/CorsConfig.ts';
import type { InternalCorsEnabledOptions } from '@typedefs/internal/InternalConfiguration.js';
import { DiagnosticsMonitor } from '@core/modules/diagnostics/DiagnosticsMonitor.ts';
import { _sanitizeLogField } from '@core/utils/sanitize.ts';

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
 *   logging: {
 *     level: 'debug',
 *     personality: true,
 *     requests: true,
 *     logger: {
 *       info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
 *       warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
 *       error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
 *       debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args)
 *     }
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
  private _diagnostics?: DiagnosticsMonitor | undefined;
  private readonly _maxBufferSize: number;
  private _accessLog?: ReturnType<typeof createLogger>;
  private _accessLogEnabled = false;

  constructor(configuration?: ServerOptions) {
    super(configuration);

    // Pre-compute max buffer size from body parser limits (immutable after construction)
    this._maxBufferSize =
      Math.max(
        this._configuration.bodyParser.json.maxSize,
        this._configuration.bodyParser.urlEncoded.maxSize,
        this._configuration.bodyParser.fileUploads.maxTotalSize,
      ) + maxHeaderOverhead;

    this._configureLogging();

    // Setup global rate limiting, if there is none provided, it will be enabled by default. We need to set the confgratin before the conditional since it is defaulted on and users might not pass it in the configuration.
    const rateLimitConfig = new RateLimitConfig(configuration?.rateLimit, this._log);
    if (configuration?.rateLimit?.enabled) {
      this._globalRateLimiter = new RateLimiter(rateLimitConfig);
      const onRateLimitHit = this._diagnostics ? (ip: string, path: string): void => this._diagnostics?.onRateLimitHit(ip, path) : undefined;
      const hook = _createGlobalRateLimitHook(this._globalRateLimiter, onRateLimitHit);
      this.beforeAll([hook]);
    }

    // Setup cookie parser, if enabled, since it is deisabled by default we can set the configuration after the conditional
    if (configuration?.cookieParser?.enabled) {
      const cookieParserConfig = new CookieParserConfig(configuration.cookieParser, this._log);
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

  /** Public accessor for this instance's logger. */
  get log(): typeof this._log {
    return this._log;
  }

  /**
   * Configure all three logging channels: app logger, access logs, diagnostics.
   *
   * Creates a per-instance logger (D1 fix — no more singleton mutation).
   * Uses Symbol brand to detect framework loggers (D2/2.4 fix — replaces duck-typed `_state`).
   */
  private _configureLogging(): void {
    const loggingConfig = this._configuration.logging;

    // C2 fix: If a branded logger was provided, extract its underlying output sink
    // instead of mutating the user's branded logger state. Mutating caused cross-instance
    // side effects when the same branded logger was shared between YinzerFlow instances.
    // The per-instance this._log handles its own formatting (prefix, personality).
    let loggerSink = loggingConfig.logger;
    if (loggerSink && loggerBrand in (loggerSink as Record<string | symbol, unknown>)) {
      const brandedState = (loggerSink as Record<string | symbol, unknown>)[loggerBrand] as { logger?: typeof loggerSink };
      loggerSink = brandedState.logger ?? undefined;
    }

    // Create per-instance logger (D1 fix: no more Object.assign to module-level singleton)
    this._log = createLogger({
      level: loggingConfig.level,
      prefix: loggingConfig.prefix,
      personality: loggingConfig.personality,
      logger: loggerSink,
    });

    // Thread logger into subsystems
    this._hooks.setLogger(this._log);

    // C1 fix: Create per-instance access log (no more module-level singleton)
    if (loggingConfig.requests) {
      this._accessLog = createLogger({
        ...accessLogBaseConfig,
        level: 'info',
        logger: loggingConfig.accessLogger,
      });
      this._accessLogEnabled = true;
    }

    // Setup diagnostics monitor if any thresholds are configured
    const diagnostics = new DiagnosticsMonitor(loggingConfig.diagnostics, loggingConfig.personality);
    if (diagnostics.hasAnyEnabled()) {
      this._diagnostics = diagnostics;
      this._diagnostics.start();
    }
  }

  /**
   * Setup server with all event listeners
   */
  private _setupServer(resolve: () => void, reject: (error: Error) => void, requestHandler: RequestHandlerImpl): void {
    if (!this._server) return;

    this._server.on('error', (error: Error) => {
      this._log.error(`YinzerFlow server error at ${this._configuration.host}:${this._configuration.port} - ${error.message}`);
      // Clean up the failed server to prevent handle leaks on re-listen
      this._server?.close();
      delete this._server;
      reject(error);
    });

    this._server.on('listening', () => {
      this._isListening = true;
      this._log.info(`YinzerFlow server at ${this._configuration.host}:${this._configuration.port} is up and running`);
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

    const context = new ContextImpl(data, this, clientAddress);

    await requestHandler.handle(context);

    // Guard against writing to a socket that was destroyed (client disconnect, timeout, etc.)
    if (!socket.destroyed) {
      socket.write(context._response._stringBody);
      socket.end();
    }

    const processingTime = Date.now() - startTime;

    // Only compute byte length and build log strings when something will consume them
    if (this._accessLogEnabled || this._diagnostics) {
      const responseBytes = Buffer.byteLength(context._response._stringBody, 'utf8');

      // H3 fix: Sanitize attacker-controlled fields once for both channels
      const safeMethod = _sanitizeLogField(context.request.method);
      const safePath = _sanitizeLogField(context.request.path);

      // Access log — one nginx-style line per request (C1: per-instance, H4: separate guard)
      if (this._accessLogEnabled) {
        this._accessLog?.info(
          `${getStatusEmoji(context._response._statusCode)} ${clientAddress} "${safeMethod} ${safePath} ${context.request.protocol}" ${context._response._statusCode} ${responseBytes}bytes "${_sanitizeLogField(context.request.headers.referer ?? '-')}" "${_sanitizeLogField(context.request.headers['user-agent'] ?? '-')}" ${processingTime}ms`,
        );
      }

      // Diagnostics — check thresholds after response is sent (receives pre-sanitized values)
      this._diagnostics?.checkRequest({
        duration: processingTime,
        reqBytes: data.length,
        resBytes: responseBytes,
        method: safeMethod,
        path: safePath,
      });
    }
  }

  /**
   * Handle errors from request processing — log and destroy socket
   */
  private _handleRequestError(error: unknown, clientAddress: string, socket: Socket): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this._log.error(`Request processing error from ${clientAddress}: ${errorMessage}`, error);
    if (!socket.destroyed) {
      socket.destroy();
    }
  }

  /**
   * Dispatch assembled request buffer to the request processor.
   * Wraps `_processRequest` with the standard error catch handler.
   */
  private _dispatchRequest({
    data,
    socket,
    requestHandler,
    clientAddress,
  }: {
    data: Buffer;
    socket: Socket;
    requestHandler: RequestHandlerImpl;
    clientAddress: string;
  }): void {
    this._processRequest({ data, socket, requestHandler, clientAddress }).catch((error: unknown) => this._handleRequestError(error, clientAddress, socket));
  }

  /**
   * Reject an oversized request with HTTP 413 (if headers were parsed) and destroy the socket.
   * Logs the current body parser limits for debugging.
   */
  private _rejectOversizedRequest({
    socket,
    clientAddress,
    totalLength,
    headersParsed,
  }: {
    socket: Socket;
    clientAddress: string;
    totalLength: number;
    headersParsed: boolean;
  }): void {
    if (headersParsed) {
      const errorBody = JSON.stringify({
        error: 'Payload too large',
        maxSize: this._maxBufferSize,
        received: totalLength,
      });
      socket.write(
        `HTTP/1.1 413 Payload Too Large\r\n` +
          `Content-Type: application/json\r\n` +
          `Content-Length: ${Buffer.byteLength(errorBody, 'utf8')}\r\n` +
          `Connection: close\r\n\r\n${errorBody}`,
      );
    }
    this._log.warn(
      `Request from ${clientAddress} exceeded maximum buffer size (${totalLength} > ${this._maxBufferSize} bytes). ` +
        `Current limits: json=${this._configuration.bodyParser.json.maxSize}, ` +
        `urlEncoded=${this._configuration.bodyParser.urlEncoded.maxSize}, ` +
        `fileUploads=${this._configuration.bodyParser.fileUploads.maxTotalSize}`,
    );
    socket.destroy();
  }

  /**
   * Check if buffered data looks like the start of an HTTP request.
   *
   * First checks the first byte against known HTTP method start characters
   * (G, P, D, H, O), then validates the first 8 bytes against the full method pattern.
   * Returns `false` for non-HTTP traffic so it can be dispatched for a graceful error.
   */
  private _looksLikeHttp(chunks: Array<Buffer>, totalLength: number, buffer: Buffer): boolean {
    if (totalLength >= 1) {
      const firstByte = chunks[0]?.[0] ?? 0;
      // cspell:disable-next-line
      // HTTP methods start with: G(ET)=0x47, P(OST/UT/ATCH)=0x50, D(ELETE)=0x44, H(EAD)=0x48, O(PTIONS)=0x4f
      if (firstByte !== 0x47 && firstByte !== 0x50 && firstByte !== 0x44 && firstByte !== 0x48 && firstByte !== 0x4f) {
        return false;
      }
    }
    if (totalLength >= 8) {
      const start = buffer.subarray(0, 8).toString();
      if (!/^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s/.test(start)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Extract Content-Length value from raw HTTP headers.
   * Returns 0 if the header is missing (e.g. GET requests with no body).
   */
  private _parseContentLength(buffer: Buffer, headerEndIndex: number): number {
    const headersStr = buffer.subarray(0, headerEndIndex).toString();
    const match = /content-length:\s*(?<digits>\d+)/i.exec(headersStr);
    return match?.groups?.digits ? parseInt(match.groups.digits, 10) : 0;
  }

  /**
   * Handle incoming TCP socket connections and their complete lifecycle.
   *
   * Implements a TCP stream reassembly state machine that buffers chunks until the
   * complete HTTP request is received, then dispatches to `_processRequest`.
   *
   * **Header Phase**: Accumulate chunks, search for `\r\n\r\n`, parse Content-Length.
   * **Body Phase**: Track totalLength without concatenating until body is complete.
   * **Dispatch**: `Buffer.concat(chunks)` once to produce the final contiguous buffer.
   *
   * @see _looksLikeHttp for non-HTTP early detection
   * @see _rejectOversizedRequest for DoS protection (413 + socket destroy)
   * @see _processRequest for how the assembled buffer is parsed and handled
   */
  private _handleConnection(socket: Socket, requestHandler: RequestHandlerImpl): void {
    const clientAddress = socket.remoteAddress ?? 'unknown';
    const connectionStartTime = Date.now();
    let hasReceivedData = false;

    this._log.debug(`New connection from ${clientAddress}`);

    // TCP stream reassembly state — mutable, read/written by data handler
    const chunks: Array<Buffer> = [];
    let totalLength = 0;
    let headersParsed = false;
    let expectedBodyLength = 0;
    let headerEndIndex = -1;
    let requestDispatched = false;

    socket.on('data', (chunk) => {
      if (!hasReceivedData) {
        hasReceivedData = true;
        const delay = Date.now() - connectionStartTime;
        if (delay > 100) {
          this._log.debug(`Delayed data from ${clientAddress} (${delay}ms connection delay)`);
        }
      }

      if (requestDispatched) return;

      chunks.push(chunk);
      totalLength += chunk.length;

      if (totalLength > this._maxBufferSize) {
        this._rejectOversizedRequest({ socket, clientAddress, totalLength, headersParsed });
        return;
      }

      // Header phase: find \r\n\r\n boundary and parse Content-Length
      if (!headersParsed) {
        const buffer = Buffer.concat(chunks, totalLength);
        headerEndIndex = buffer.indexOf('\r\n\r\n');

        if (headerEndIndex === -1) {
          if (!this._looksLikeHttp(chunks, totalLength, buffer)) {
            requestDispatched = true;
            this._dispatchRequest({ data: buffer, socket, requestHandler, clientAddress });
          }
          return;
        }

        headersParsed = true;
        expectedBodyLength = this._parseContentLength(buffer, headerEndIndex);
        const bodyStart = headerEndIndex + 4;

        if (buffer.length - bodyStart >= expectedBodyLength) {
          requestDispatched = true;
          this._dispatchRequest({ data: buffer, socket, requestHandler, clientAddress });
        }
        return;
      }

      // Body phase: check if accumulated length satisfies Content-Length
      if (totalLength - (headerEndIndex + 4) >= expectedBodyLength) {
        requestDispatched = true;
        this._dispatchRequest({ data: Buffer.concat(chunks, totalLength), socket, requestHandler, clientAddress });
      }
    });

    socket.on('error', (error: Error) => {
      this._log.error(`Socket error from ${clientAddress}: ${error.message}`, error);
    });

    socket.on('close', () => {
      const connectionDuration = Date.now() - connectionStartTime;

      if (hasReceivedData) {
        this._log.debug(`Connection closed from ${clientAddress} (${connectionDuration}ms total)`);
        return;
      }

      if (connectionDuration < 10) {
        this._log.debug(`${clientAddress} quick connectivity check (${connectionDuration}ms) - health probe`);
      } else {
        this._log.debug(`${clientAddress} disconnected without sending data (${connectionDuration}ms) - potential probe`);
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

    // Clean up diagnostics timers
    if (this._diagnostics) {
      this._diagnostics.destroy();
      this._diagnostics = undefined;
    }

    return new Promise((resolve) => {
      if (!this._server) {
        this._isListening = false; // Probably redundant but just in case
        resolve();
        return;
      }

      this._server.close(() => {
        this._isListening = false;
        this._log.warn(`YinzerFlow server at ${this._configuration.host}:${this._configuration.port} is shutting down`);
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
        this._log.info(`🛑 Received ${signal}, shutting down gracefully in ${this._configuration.gracefulShutdownTimeout}...`);
        setTimeout(() => {
          this.close()
            .then(() => {
              this._log.info('✅ Server shut down gracefully');
              process.exit(0);
            })
            .catch((error) => {
              this._log.error('❌ Error during graceful shutdown:', error);
              process.exit(1);
            });
        }, gracefulShutdownTimeout);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }
  }
}
