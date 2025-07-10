import { createServer } from 'net';
import type { Socket } from 'net';

import { RequestHandlerImpl } from '@core/execution/RequestHandlerImpl.ts';
import { ContextImpl } from '@core/execution/ContextImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { log } from '@core/utils/log.ts';
import { colors, networkLog } from '@core/utils/networkLog.ts';
import type { ServerConfiguration } from '@typedefs/public/Configuration.js';

export class YinzerFlow extends SetupImpl {
  private _isListening = false;
  private _server?: ReturnType<typeof createServer>;

  constructor(configuration?: ServerConfiguration) {
    super(configuration);

    // Set custom logger if provided (routes all log calls to user's logger)
    if (this._configuration.logger) {
      log.setCustomLogger(this._configuration.logger);
    }

    // Set log level on built-in logger (always available)
    log.setLogLevel(this._configuration.logLevel);

    // Configure network logging - simple boolean toggle
    networkLog.setEnabled(this._configuration.networkLogs);

    // Set network logger if provided (optional - can be same as app logger or different)
    if (this._configuration.networkLogger) {
      networkLog.setNetworkLogger(this._configuration.networkLogger);
    }

    // This will route to custom logger if set, otherwise use built-in styling
    log.info(
      'YinzerFlow initialized with logging enabled',
      `${colors.green}level: ${this._configuration.logLevel}, networkLogs: ${this._configuration.networkLogs}${colors.reset}`,
    );

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
      networkLog.serverError(this._configuration.port, this._configuration.host, error.message);
      reject(error);
    });

    this._server.on('listening', () => {
      this._isListening = true;
      networkLog.serverStart(this._configuration.port, this._configuration.host);
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

    log.info('Processing incoming request', { clientAddress, dataSize: data.length });

    const context = new ContextImpl(data, this, clientAddress);

    await requestHandler.handle(context);

    socket.write(context._response._stringBody);
    socket.end();

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Log request
    networkLog.request(context, startTime, endTime);
    if (processingTime > 500) {
      log.warn('Slow request detected', {
        method: context.request.method,
        path: context.request.path,
        statusCode: context._response._statusCode,
        responseTime: `${processingTime}ms`,
        clientAddress,
      });
    }
  }

  /**
   * Handle socket connection and all its events
   */
  private _handleConnection(socket: Socket, requestHandler: RequestHandlerImpl): void {
    const clientAddress = socket.remoteAddress ?? 'unknown';

    networkLog.connection('connect', clientAddress);

    socket.on('data', (data) => {
      this._processRequest({ data, socket, requestHandler, clientAddress }).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        networkLog.connection('error', clientAddress, `Unexpected error: ${errorMessage}`);
        socket.destroy();
      });
    });

    socket.on('error', (error: Error) => {
      networkLog.connection('error', clientAddress, error.message);
    });

    socket.on('close', () => {
      networkLog.connection('disconnect', clientAddress);
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
        networkLog.serverStop(this._configuration.port, this._configuration.host);
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
