/* eslint-disable max-lines -- WebSocket upgrade handler temporarily increases file size during Phase 3 integration. Will be extracted to dedicated module in Phase 4 (pub/sub implementation). */
import { createServer } from 'net';
import type { Socket } from 'net';

import { RequestHandlerImpl } from '@core/execution/RequestHandlerImpl.ts';
import { canonicalizeRequestPath } from '@core/execution/utils/canonicalizeRequestPath.ts';
import { ContextImpl } from '@core/execution/ContextImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { createLogger, loggerBrand } from '@core/utils/log.ts';
import type { ServerOptions } from '@typedefs/public/Configuration.js';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalRouteRegistry } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import { accessLogBaseConfig, getStatusEmoji } from '@core/utils/accessLog.ts';
import { _createGlobalRateLimitHook, _rateLimiterOfHook, _withStoreNamespace } from '@core/modules/rateLimit/rateLimithooks.ts';
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
import { _buildHandshakeResponse, _generateAcceptKey, _isWebSocketUpgrade, _validateHandshake } from '@core/modules/websocket/WebSocketHandshake.ts';
import { _buildCompressionResponse, _negotiatedServerWindowBits, _parseCompressionOffer } from '@core/modules/websocket/WebSocketCompression.ts';
import { WebSocketConnection } from '@core/modules/websocket/WebSocketConnection.ts';
import { WebSocketChannelManager } from '@core/modules/websocket/WebSocketChannelManager.ts';
import { WebSocketSecurity } from '@core/modules/websocket/WebSocketSecurity.ts';
import { _wrapWebSocketHandlers } from '@core/modules/websocket/WebSocketHandlerPipeline.ts';
import { _isUpgradeRejection } from '@core/modules/websocket/WebSocketUpgradeRejection.ts';
import { wsCloseCode } from '@constants/websocket.ts';
import { httpStatusCode } from '@constants/http.ts';
import { parseRequestHeaders } from '@core/execution/utils/parseRequestHeaders.ts';
import { mapStatusCodeToMessage } from '@core/execution/utils/mapStatusCodeToMessage.ts';
import type { InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { WebSocketHandlers, WebSocketRouteOptions } from '@typedefs/public/WebSocket.js';

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
  private readonly _globalRateLimiter?: RateLimiter | undefined;
  /** The global rate limiter's stage hook, assigned once below; see InternalSetupImpl._globalRateLimitHook. */
  declare readonly _globalRateLimitHook: HandlerCallback | undefined;
  private _diagnostics?: DiagnosticsMonitor | undefined;
  private readonly _maxBufferSize: number;
  private _accessLog?: ReturnType<typeof createLogger>;
  private _accessLogEnabled = false;
  private _wsConnections?: Set<WebSocketConnection>;
  private _wsChannelManager?: WebSocketChannelManager;
  private _wsSecurity?: WebSocketSecurity;
  private _wsHeartbeatTimer?: ReturnType<typeof setInterval> | undefined;

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

    // Global rate limiting is enabled by default: gate on the RESOLVED config, never the raw user input,
    // or an app that passes no rateLimit options (the documented default) silently gets no limiter.
    // The hook itself is registered after CORS below.
    // The global limiter's Redis keys live under `<keyPrefix>global:`, apart from every rateLimitHook's namespace
    const rateLimitConfig = new RateLimitConfig(_withStoreNamespace(configuration?.rateLimit, 'global'), this._log);

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

    // Global rate limiting runs in its own stage in RequestHandlerImpl (not a hook entry users can reorder):
    // after beforeRouting hooks (CORS included, so 429s carry CORS headers) and route matching, so keyGenerator
    // sees params and beforeRouting state; before the 404 and beforeAll, so unmatched paths are throttled too.
    if (rateLimitConfig.enabled) {
      this._globalRateLimiter = new RateLimiter(rateLimitConfig);
      const onRateLimitHit = this._diagnostics ? (ip: string, path: string): void => this._diagnostics?.onRateLimitHit(ip, path) : undefined;
      this._globalRateLimitHook = _createGlobalRateLimitHook(this._globalRateLimiter, onRateLimitHit);
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
    if (loggerSink && loggerBrand in (loggerSink as unknown as Record<string | symbol, unknown>)) {
      const brandedState = (loggerSink as unknown as Record<string | symbol, unknown>)[loggerBrand] as { logger?: typeof loggerSink };
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

    this._sendContextResponse({ context, socket, startTime, requestBytes: data.length });
  }

  /**
   * Write a context's built response, end the socket, then write the access log line and run diagnostics.
   * Shared by HTTP requests and refused WebSocket upgrades, so both reach the client and the log the same way.
   */
  private _sendContextResponse({
    context,
    socket,
    startTime,
    requestBytes,
  }: {
    context: ContextImpl;
    socket: Socket;
    startTime: number;
    requestBytes: number;
  }): void {
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
          `${getStatusEmoji(context._response._statusCode)} ${_sanitizeLogField(context.request.ipAddress)} "${safeMethod} ${safePath} ${context.request.protocol}" ${context._response._statusCode} ${responseBytes}bytes "${_sanitizeLogField(context.request.headers.referer ?? '-')}" "${_sanitizeLogField(context.request.headers['user-agent'] ?? '-')}" ${processingTime}ms`,
        );
      }

      // Diagnostics — check thresholds after response is sent (receives pre-sanitized values)
      this._diagnostics?.checkRequest({
        duration: processingTime,
        reqBytes: requestBytes,
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
    // The message can quote client bytes (a header parse error names the header), so it is sanitized, and the stack is
    // logged without its first line, which repeats that message raw; the frames below it are code locations only.
    const errorMessage = _sanitizeLogField(error instanceof Error ? error.message : 'Unknown error', 200);
    const stackFrames = error instanceof Error ? (error.stack ?? '').split('\n').slice(1).join('\n') : '';
    this._log.error(`Request processing error from ${clientAddress}: ${errorMessage}`, stackFrames);
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
  private _looksLikeHttp(buffer: Buffer, requestStart: number): boolean {
    // Only the empty lines RFC 9112 §2.2 lets a client send before the request line so far: wait for more
    if (requestStart >= buffer.length) return true;

    if (buffer.length - requestStart >= 1) {
      const firstByte = buffer[requestStart] ?? 0;
      // cspell:disable-next-line
      // HTTP methods start with: G(ET)=0x47, P(OST/UT/ATCH)=0x50, D(ELETE)=0x44, H(EAD)=0x48, O(PTIONS)=0x4f
      if (firstByte !== 0x47 && firstByte !== 0x50 && firstByte !== 0x44 && firstByte !== 0x48 && firstByte !== 0x4f) {
        return false;
      }
    }
    if (buffer.length - requestStart >= 8) {
      const start = buffer.subarray(requestStart, requestStart + 8).toString();
      if (!/^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s/.test(start)) {
        return false;
      }
    }
    return true;
  }

  /** Index of the first byte that is not CR or LF: where the request line starts after any leading empty lines. */
  private _skipLeadingEmptyLines(buffer: Buffer): number {
    let index = 0;
    while (index < buffer.length && (buffer[index] === 0x0d || buffer[index] === 0x0a)) index++;
    return index;
  }

  /**
   * Decide how long the request body is, from the header block parsed into a map by the same parser the request uses,
   * never by searching the raw text (a decoy `X-Note: content-length: 9` or `X-Content-Length` decided framing that way).
   * RFC 9112 §6: Transfer-Encoding gets 501 until chunked decoding exists, and with Content-Length as well 400 (§6.1, a
   * smuggling shape); a repeated or non-numeric Content-Length is 400 (§6.3). No Content-Length means no body.
   * A head the parser rejects is framed as bodiless here and answered by the request path, as before.
   */
  private _requestFraming(
    buffer: Buffer,
    requestStart: number,
    headerEndIndex: number,
  ): { bodyLength: number } | { statusCode: InternalHttpStatusCode; message: string } {
    const requestLineEnd = buffer.indexOf('\r\n', requestStart);
    const headersRaw = requestLineEnd >= headerEndIndex ? '' : buffer.subarray(requestLineEnd + 2, headerEndIndex).toString();
    const report = { repeatedNames: new Set<string>(), malformed: false };
    let headers: ReturnType<typeof parseRequestHeaders> = {};
    try {
      headers = parseRequestHeaders(headersRaw, report);
    } catch {
      return { bodyLength: 0 };
    }

    const contentLength = headers['content-length'];
    if (headers['transfer-encoding'] !== undefined) {
      if (contentLength !== undefined) {
        return { statusCode: httpStatusCode.badRequest, message: 'A request may not carry both Content-Length and Transfer-Encoding' };
      }
      return { statusCode: httpStatusCode.notImplemented, message: 'Transfer-Encoding is not supported; send the body with a Content-Length' };
    }
    if (contentLength === undefined) return { bodyLength: 0 };
    if (report.repeatedNames.has('content-length') || !/^\d+$/.test(contentLength)) {
      return { statusCode: httpStatusCode.badRequest, message: 'Content-Length must be a single number of bytes' };
    }
    return { bodyLength: Number(contentLength) };
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

    const state = { headersParsed: false, expectedBodyLength: 0, headerEndIndex: -1, requestDispatched: false };

    socket.on('data', (chunk) => {
      this._handleConnectionData({
        chunk,
        socket,
        requestHandler,
        clientAddress,
        connectionStartTime,
        chunks,
        state,
        hasReceivedData: () => hasReceivedData,
        setHasReceivedData: (val: boolean) => {
          hasReceivedData = val;
        },
        totalLength: () => totalLength,
        setTotalLength: (val: number) => {
          totalLength = val;
        },
        shouldDispatch: () => state.requestDispatched,
      });
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

  /**
   * Handle a single data chunk in the TCP stream reassembly state machine.
   */
  private _handleConnectionData({
    chunk,
    socket,
    requestHandler,
    clientAddress,
    connectionStartTime,
    chunks,
    state,
    hasReceivedData,
    setHasReceivedData,
    totalLength,
    setTotalLength,
    shouldDispatch,
  }: {
    chunk: Buffer;
    socket: Socket;
    requestHandler: RequestHandlerImpl;
    clientAddress: string;
    connectionStartTime: number;
    chunks: Array<Buffer>;
    state: { headersParsed: boolean; expectedBodyLength: number; headerEndIndex: number; requestDispatched: boolean };
    hasReceivedData: () => boolean;
    setHasReceivedData: (val: boolean) => void;
    totalLength: () => number;
    setTotalLength: (val: number) => void;
    shouldDispatch: () => boolean;
  }): void {
    if (!hasReceivedData()) {
      setHasReceivedData(true);
      const delay = Date.now() - connectionStartTime;
      if (delay > 100) {
        this._log.debug(`Delayed data from ${clientAddress} (${delay}ms connection delay)`);
      }
    }

    if (shouldDispatch()) return;

    chunks.push(chunk);
    setTotalLength(totalLength() + chunk.length);

    if (totalLength() > this._maxBufferSize) {
      this._rejectOversizedRequest({ socket, clientAddress, totalLength: totalLength(), headersParsed: state.headersParsed });
      return;
    }

    // Header phase: find \r\n\r\n boundary and parse Content-Length
    if (!state.headersParsed) {
      this._handleHeaderPhase({ chunks, totalLength: totalLength(), state, socket, requestHandler, clientAddress });
      return;
    }

    // Body phase: check if accumulated length satisfies Content-Length
    if (totalLength() - (state.headerEndIndex + 4) >= state.expectedBodyLength) {
      state.requestDispatched = true;
      this._dispatchRequest({ data: Buffer.concat(chunks, totalLength()), socket, requestHandler, clientAddress });
    }
  }

  /**
   * Handle the header phase of TCP stream reassembly.
   */
  private _handleHeaderPhase({
    chunks,
    totalLength,
    state,
    socket,
    requestHandler,
    clientAddress,
  }: {
    chunks: Array<Buffer>;
    totalLength: number;
    state: { headersParsed: boolean; expectedBodyLength: number; headerEndIndex: number; requestDispatched: boolean };
    socket: Socket;
    requestHandler: RequestHandlerImpl;
    clientAddress: string;
  }): void {
    const buffer = Buffer.concat(chunks, totalLength);
    // Skip the empty lines RFC 9112 §2.2 allows before the request line, or `\r\n\r\n` at offset 0 would read as an
    // empty header block and dispatch early. The parser strips the same run. The 413 buffer cap above bounds it.
    const requestStart = this._skipLeadingEmptyLines(buffer);
    state.headerEndIndex = buffer.indexOf('\r\n\r\n', requestStart);

    if (state.headerEndIndex === -1) {
      if (!this._looksLikeHttp(buffer, requestStart)) {
        state.requestDispatched = true;
        this._dispatchRequest({ data: buffer, socket, requestHandler, clientAddress });
      }
      return;
    }

    state.headersParsed = true;

    // WebSocket upgrade check — before body assembly (zero overhead when no WS routes)
    if (this._wsRouter._hasRoutes()) {
      const headersStr = buffer.subarray(0, state.headerEndIndex).toString();
      if (_isWebSocketUpgrade(headersStr)) {
        state.requestDispatched = true;
        this._handleWebSocketUpgrade({ buffer, socket, peerAddress: clientAddress, requestHandler });
        return;
      }
    }

    const framing = this._requestFraming(buffer, requestStart, state.headerEndIndex);
    if ('statusCode' in framing) {
      // The body's end is unknown, so the connection can't be reused: answer and close
      state.requestDispatched = true;
      this._log.debug(`Refused request framing from ${clientAddress}: ${framing.message}`);
      this._sendHttpError(socket, framing.statusCode, framing.message);
      return;
    }
    state.expectedBodyLength = framing.bodyLength;
    const bodyStart = state.headerEndIndex + 4;

    if (buffer.length - bodyStart >= state.expectedBodyLength) {
      state.requestDispatched = true;
      this._dispatchRequest({ data: buffer, socket, requestHandler, clientAddress });
    }
  }

  /**
   * Handle a WebSocket upgrade request: validate the handshake and path, run the global HTTP request stages
   * (beforeRouting, global rate limiter, beforeAll), check origin and the per-IP cap, call the route's upgrade
   * handler, then send 101 and create the connection. Any refusal is answered as a real HTTP response.
   */
  private _handleWebSocketUpgrade(upgrade: { buffer: Buffer; socket: Socket; peerAddress: string; requestHandler: RequestHandlerImpl }): void {
    this._handleWebSocketUpgradeAsync(upgrade).catch((error: unknown) => this._handleRequestError(error, upgrade.peerAddress, upgrade.socket));
  }

  // eslint-disable-next-line max-statements
  private async _handleWebSocketUpgradeAsync({
    buffer,
    socket,
    peerAddress,
    requestHandler,
  }: {
    buffer: Buffer;
    socket: Socket;
    peerAddress: string;
    requestHandler: RequestHandlerImpl;
  }): Promise<void> {
    const startTime = Date.now();

    const context = this._buildUpgradeContext(buffer, socket, peerAddress);
    if (!context) return;
    const clientAddress = context.request.ipAddress;

    // One request-line parser for hooks, routing and the handshake: the shared HTTP parser's
    // Origin decides the cross-site check and Host the same-origin compare, so neither may be repeated on an upgrade
    if (requestHandler._rejectMalformedHead(context, ['host', 'origin'])) {
      this._sendContextResponse({ context, socket, startTime, requestBytes: buffer.length });
      return;
    }

    const validation = _validateHandshake({ method: context.request.method, protocol: context.request.protocol, headers: context.request.headers });
    if (!validation.valid) {
      // Malformed like a bad request line or path: answered before any stage, so no afterAll
      context.response.setStatusCode(httpStatusCode.badRequest);
      context._response._setBody({ error: validation.reason });
      context._response._parseResponseIntoString();
      this._sendContextResponse({ context, socket, startTime, requestBytes: buffer.length });
      return;
    }

    // Same canonical form, and the same rejections, as HTTP routing (canonicalizeRequestPath drops the query string)
    const canonicalPath = canonicalizeRequestPath(context.request.path);
    const rawPath = context.request.path.split('?', 1)[0] ?? '/';
    if (canonicalPath === null) {
      requestHandler._rejectMalformedPath(context);
      this._sendContextResponse({ context, socket, startTime, requestBytes: buffer.length });
      return;
    }

    // Every refusal from here on is an ordinary response: default headers, afterAll hooks, the access log
    const refuse = async (statusCode: InternalHttpStatusCode, body: unknown): Promise<void> =>
      this._refuseWebSocketUpgrade({ context, socket, startTime, requestBytes: buffer.length, requestHandler, canonicalPath, statusCode, body });

    // Security checks (lazy allocation)
    this._wsSecurity ??= new WebSocketSecurity();
    const wsConfig = this._configuration.websocket;
    const match = this._wsRouter._match(canonicalPath);
    let data: unknown = undefined;

    // Everything that runs app code (global hooks, the upgrade handler) sits in one try: a throw anywhere in it is
    // answered with the app's onError response as a real HTTP response, never a silently dropped socket.
    try {
      // Cheap pre-check, not authoritative: an IP already at its cap is refused before any app code runs, so a flood from
      // a held cap never reaches the hooks or upgrade(). It reads the count and takes no slot; the check after the last
      // await below is the one that decides, since slots can fill while this upgrade awaits.
      if (!this._wsSecurity.canConnect(clientAddress, wsConfig.maxConnectionsPerIp)) {
        await refuse(httpStatusCode.tooManyRequests, { error: 'Too many WebSocket connections from this IP' });
        return;
      }

      // Global hooks and the global limiter decide before anything else does, exactly as for an HTTP request to this path
      if (!(await requestHandler._handleUpgrade(context, canonicalPath, () => match)) || !match) {
        this._sendContextResponse({ context, socket, startTime, requestBytes: buffer.length });
        return;
      }

      const originAllowed = this._wsSecurity.validateOrigin({
        origin: validation.origin,
        host: context.request.headers.host,
        allowedOrigins: wsConfig.allowedOrigins,
        allowMissingOrigin: wsConfig.allowMissingOrigin,
      });
      if (!originAllowed) {
        await refuse(httpStatusCode.forbidden, { error: 'Origin not allowed' });
        return;
      }

      const upgradeRequest = {
        headers: context.request.headers as Record<string, string>,
        path: rawPath,
        query: context.request.query as Record<string, string>,
        params: match.params,
        remoteAddress: clientAddress,
        state: context.state,
      };
      data = match.handlers.upgrade ? await match.handlers.upgrade(upgradeRequest) : undefined;
    } catch (error) {
      await this._answerUpgradeError({ context, socket, startTime, requestBytes: buffer.length, requestHandler, error });
      return;
    }

    // The client may have gone while a hook or upgrade() was awaiting: its close event has fired already, so nothing
    // would ever release a slot taken now. Everything below up to the close wiring in _setupWsConnection is
    // synchronous, so a socket alive here is still alive when the slot is taken and the close handler attached.
    if (socket.destroyed || !socket.writable) return;

    if (data === false) {
      await refuse(httpStatusCode.forbidden, { error: 'WebSocket upgrade rejected' });
      return;
    }

    if (_isUpgradeRejection(data)) {
      await refuse(data.statusCode, data.body);
      return;
    }

    const compression = this._negotiateWsCompression(context.request.headers['sec-websocket-extensions']);

    // The per-IP cap is checked here, after the last await, so concurrent upgrades can't all pass it while awaiting and
    // then all take a slot; check, 101, trackConnect and close wiring run in one synchronous stretch.
    if (!this._wsSecurity.canConnect(clientAddress, wsConfig.maxConnectionsPerIp)) {
      // Refusing takes no slot, so the await in afterAll can't leak one
      await refuse(httpStatusCode.tooManyRequests, { error: 'Too many WebSocket connections from this IP' });
      return;
    }

    // Send 101 handshake response
    const acceptKey = _generateAcceptKey(validation.key);
    socket.write(_buildHandshakeResponse(acceptKey, undefined, compression?.header));
    socket.removeAllListeners();

    this._wsSecurity.trackConnect(clientAddress);
    this._setupWsConnection(socket, data, match.handlers, match.options, clientAddress, rawPath, compression?.serverWindowBits);
  }

  /**
   * Build the hook context for an upgrade request. A request whose headers the shared parser rejects (an invalid
   * header name, too many or too long headers) is answered 400 and logged at debug with the parser's reason passed
   * through _sanitizeLogField (control characters, newlines and BiDi overrides stripped, cut to 200 characters).
   * Returns null when the request was answered.
   */
  private _buildUpgradeContext(buffer: Buffer, socket: Socket, peerAddress: string): ContextImpl | null {
    try {
      return new ContextImpl(buffer, this, peerAddress);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this._log.debug(`Malformed WebSocket upgrade request from ${peerAddress}: ${_sanitizeLogField(reason, 200)}`);
      this._sendHttpError(socket, httpStatusCode.badRequest, 'Malformed request headers');
      return null;
    }
  }

  /**
   * Negotiate permessage-deflate: when the server has compression enabled and the client's Sec-WebSocket-Extensions
   * offer is acceptable, return the extension response header value and the window the server agreed to compress with
   * (the connection and broadcast must use that value, not the configured one); otherwise undefined (no compression).
   */
  private _negotiateWsCompression(extensionsHeader: string | undefined): { header: string; serverWindowBits: number } | undefined {
    const { compression } = this._configuration.websocket;
    if (!compression.enabled || !extensionsHeader) return undefined;
    const offer = _parseCompressionOffer(extensionsHeader);
    if (!offer) return undefined;
    return {
      header: _buildCompressionResponse(offer, {
        serverMaxWindowBits: compression.serverMaxWindowBits,
        clientMaxWindowBits: compression.clientMaxWindowBits,
      }),
      serverWindowBits: _negotiatedServerWindowBits(offer, compression.serverMaxWindowBits),
    };
  }

  /**
   * Refuse an upgrade after the hook stages (origin 403, `upgrade()` returning false or rejectUpgrade, the per-IP cap
   * 429) as an ordinary response: status and body, afterAll hooks, default headers, then the access log. A throw from
   * an afterAll hook here goes to onError like any other upgrade error.
   */
  private async _refuseWebSocketUpgrade({
    context,
    socket,
    startTime,
    requestBytes,
    requestHandler,
    canonicalPath,
    statusCode,
    body,
  }: {
    context: ContextImpl;
    socket: Socket;
    startTime: number;
    requestBytes: number;
    requestHandler: RequestHandlerImpl;
    canonicalPath: string;
    statusCode: InternalHttpStatusCode;
    body: unknown;
  }): Promise<void> {
    try {
      context.response.setStatusCode(statusCode);
      context._response._setBody(body);
      await requestHandler._finishResponse(context, canonicalPath);
      this._sendContextResponse({ context, socket, startTime, requestBytes });
    } catch (error) {
      await this._answerUpgradeError({ context, socket, startTime, requestBytes, requestHandler, error });
    }
  }

  /**
   * Answer a throw from a global hook or the upgrade handler through the app's onError handler, as HTTP does, then
   * close the socket. An onError that leaves the status at 200 still gets 500: an upgrade can't succeed with a 2xx.
   */
  private async _answerUpgradeError({
    context,
    socket,
    startTime,
    requestBytes,
    requestHandler,
    error,
  }: {
    context: ContextImpl;
    socket: Socket;
    startTime: number;
    requestBytes: number;
    requestHandler: RequestHandlerImpl;
    error: unknown;
  }): Promise<void> {
    await requestHandler._handleError(context, error);
    if (context._response._statusCode === httpStatusCode.ok) {
      context.response.setStatusCode(httpStatusCode.internalServerError);
      context._response._parseResponseIntoString();
    }
    this._sendContextResponse({ context, socket, startTime, requestBytes });
  }

  // eslint-disable-next-line max-params
  private _setupWsConnection(
    socket: Socket,
    data: unknown,
    handlers: WebSocketHandlers,
    routeOptions: WebSocketRouteOptions | undefined,
    clientAddress: string,
    path: string,
    compressionWindowBits?: number,
  ): void {
    const connectionOptions = this._mergeWsConnectionOptions(routeOptions, compressionWindowBits);
    const wrappedHandlers = _wrapWebSocketHandlers(handlers, this._hooks, this._log);
    const connection = new WebSocketConnection(socket, data, wrappedHandlers, connectionOptions);

    this._wsChannelManager ??= new WebSocketChannelManager();
    if (this._configuration.websocket.compression.enabled) {
      const comp = this._configuration.websocket.compression;
      this._wsChannelManager.setCompressionConfig(comp.level, comp.threshold);
    }
    connection.setChannelManager(this._wsChannelManager);

    this._wsConnections ??= new Set();
    this._wsConnections.add(connection);
    this._ensureHeartbeatSweep();

    const originalClose = wrappedHandlers.close;
    wrappedHandlers.close = (ws, code, reason): void => {
      this._wsConnections?.delete(connection);
      this._wsSecurity?.trackDisconnect(clientAddress);
      originalClose?.(ws, code, reason);
    };

    this._log.debug(`WebSocket connection established from ${clientAddress} on ${path}`);
    wrappedHandlers.open?.(connection as never);
  }

  // eslint-disable-next-line complexity
  private _mergeWsConnectionOptions(
    routeOpts?: WebSocketRouteOptions,
    compressionWindowBits?: number,
  ): {
    maxPayloadLength: number;
    idleTimeout: number;
    backpressure: { strategy: 'buffer' | 'drop'; limit: number };
    heartbeatInterval: number;
    messageRateLimit: { enabled: boolean; maxMessages: number; window: number };
    compression: { enabled: boolean; level: number; threshold: number; serverMaxWindowBits: number };
  } {
    const wsConfig = this._configuration.websocket;
    const globalHeartbeat = wsConfig.heartbeat.enabled ? wsConfig.heartbeat.interval : 0;
    const heartbeatInterval = routeOpts?.heartbeatInterval ?? globalHeartbeat;
    const rl = wsConfig.messageRateLimit;
    const comp = wsConfig.compression;
    return {
      maxPayloadLength: routeOpts?.maxPayloadLength ?? wsConfig.maxPayloadLength,
      idleTimeout: routeOpts?.idleTimeout ?? wsConfig.idleTimeout,
      backpressure: {
        strategy: routeOpts?.backpressure?.strategy ?? wsConfig.backpressure.strategy,
        limit: routeOpts?.backpressure?.limit ?? wsConfig.backpressure.limit,
      },
      heartbeatInterval,
      messageRateLimit: {
        enabled: rl.enabled,
        maxMessages: routeOpts?.messageRateLimit?.maxMessages ?? rl.maxMessages,
        window: routeOpts?.messageRateLimit?.window ?? rl.window,
      },
      compression: {
        enabled: compressionWindowBits !== undefined,
        level: comp.level,
        threshold: routeOpts?.compressionThreshold ?? comp.threshold,
        serverMaxWindowBits: compressionWindowBits ?? comp.serverMaxWindowBits,
      },
    };
  }

  /**
   * Start the heartbeat sweep timer if not already running.
   * Uses the global heartbeat interval — per-route overrides are checked per-connection.
   */
  private _ensureHeartbeatSweep(): void {
    if (this._wsHeartbeatTimer) return;

    const wsConfig = this._configuration.websocket;
    if (!wsConfig.heartbeat.enabled) return;

    this._wsHeartbeatTimer = setInterval(() => {
      if (!this._wsConnections?.size) return;

      for (const connection of this._wsConnections) {
        if (!connection._heartbeatEnabled) continue;

        if (!connection._isAlive) {
          connection.close(wsCloseCode.normal, 'Heartbeat timeout');
          continue;
        }

        connection._isAlive = false;
        connection.ping();
      }
    }, wsConfig.heartbeat.interval * 1000);

    // Don't let the sweep timer keep the process alive during shutdown
    this._wsHeartbeatTimer.unref();
  }

  /**
   * Send an HTTP error response on a socket and destroy it. Only for an upgrade whose headers couldn't be parsed, so
   * there is no context to build an ordinary response from; every other refusal goes through _sendContextResponse.
   */
  private _sendHttpError(socket: Socket, statusCode: InternalHttpStatusCode, message: string): void {
    const body = JSON.stringify({ error: message });
    socket.write(
      `HTTP/1.1 ${statusCode} ${mapStatusCodeToMessage(statusCode)}\r\n` +
        `Content-Type: application/json\r\n` +
        `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n` +
        `Connection: close\r\n\r\n${body}`,
    );
    socket.destroy();
  }

  /**
   * Publish a message to all subscribers of a WebSocket channel. Returns how many subscribers took the frame (sent or
   * buffered); subscribers whose `'drop'` backpressure strategy discarded it, or whose buffer overflowed, aren't counted.
   */
  publish(channel: string, data: Buffer | string): number {
    return this._wsChannelManager?.publish(channel, data) ?? 0;
  }

  /** Get the number of subscribers on a WebSocket channel. */
  subscriberCount(channel: string): number {
    return this._wsChannelManager?.subscriberCount(channel) ?? 0;
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

  /** Every rate limiter owned by this app: the global one plus each rateLimitHook on a route or global hook. */
  private _collectRateLimiters(): Set<RateLimiter> {
    const limiters = new Set<RateLimiter>();
    if (this._globalRateLimiter) limiters.add(this._globalRateLimiter);

    const addFromHooks = (hooks: Iterable<HandlerCallback>): void => {
      for (const hook of hooks) {
        const limiter = _rateLimiterOfHook(hook, this);
        if (limiter) limiters.add(limiter);
      }
    };
    const addFromRoute = (route: InternalRouteRegistry): void => {
      addFromHooks(route.options.beforeHooks ?? []);
      addFromHooks(route.options.afterHooks ?? []);
    };

    for (const routes of this._routeRegistry._exactRoutes.values()) for (const route of routes.values()) addFromRoute(route);
    for (const routes of this._routeRegistry._parameterizedRoutes.values()) for (const route of routes) addFromRoute(route);
    for (const stage of [this._hooks._beforeRouting, this._hooks._beforeAll, this._hooks._afterAll]) {
      addFromHooks([...stage].map((entry) => entry.handler));
    }
    return limiters;
  }

  async close(): Promise<void> {
    if (!this._isListening || !this._server) {
      return;
    }

    // Clean up every rate limiter this app holds (global, per-route, and rateLimitHook in global hooks).
    // Destroy is restart-safe: each limiter recreates its store on next use, so close() then listen() works.
    await Promise.all([...this._collectRateLimiters()].map(async (limiter) => limiter.destroy()));

    // Clean up diagnostics timers
    if (this._diagnostics) {
      this._diagnostics.destroy();
      this._diagnostics = undefined;
    }

    // Stop heartbeat sweep before closing connections
    if (this._wsHeartbeatTimer) {
      clearInterval(this._wsHeartbeatTimer);
      this._wsHeartbeatTimer = undefined;
    }

    // Close all active WebSocket connections gracefully
    if (this._wsConnections?.size) {
      for (const conn of this._wsConnections) {
        conn.close(1001, 'Server shutting down');
      }
      this._wsConnections.clear();
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
