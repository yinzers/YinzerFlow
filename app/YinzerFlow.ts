import { createServer } from 'net';
import type { Socket } from 'net';
import ip from 'ip';
import { HttpMethod, HttpStatusCode } from 'constants/http.ts';
import type { IRoute } from 'types/Route.ts';
import type { TErrorFunction } from 'types/Response.ts';
import { RouteRegistry } from 'core/RouteRegistry.ts';
import { RouteFinder } from 'core/RouteFinder.ts';
import { MiddlewareManager } from 'core/MiddlewareManager.ts';
import { RequestHandler } from 'core/RequestHandler.ts';
import { ConnectionManager } from 'core/ConnectionManager.ts';

/**
 * Main YinzerFlow server class
 *
 * This class orchestrates all the components of the server:
 * - Route management
 * - Middleware processing
 * - Request handling
 * - Connection management
 */
export class YinzerFlow {
  // === COMPONENT MANAGERS ===
  private readonly routeRegistry = new RouteRegistry();
  private readonly routeFinder = new RouteFinder(this.routeRegistry);
  private readonly middlewareManager = new MiddlewareManager();
  private readonly connectionManager = new ConnectionManager();
  private readonly requestHandler: RequestHandler;

  // === SERVER CONFIGURATION ===
  private readonly _ip: string = ip.address();
  private readonly _port: number = 5000;

  /**
   * Create a new YinzerFlow server instance
   */
  constructor(options?: { port?: number; errorHandler?: TErrorFunction }) {
    if (options?.port) this._port = options.port;

    // Set up the error handler
    const errorHandler = options?.errorHandler ?? this._defaultErrorHandler;

    // Initialize the request handler with the managers
    this.requestHandler = new RequestHandler(this.routeFinder, this.middlewareManager, errorHandler);
  }

  // === ERROR HANDLING ===
  private readonly _defaultErrorHandler: TErrorFunction = ({ response }, error): unknown => {
    console.error('Server error: \n', error);
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
    return { success: false, message: 'Internal server error' };
  };

  // === ROUTE DEFINITION METHODS ===

  /**
   * Register a GET route
   */
  get(path: IRoute['path'], handler: IRoute['handler'], options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] }): IRoute {
    return this.routeRegistry.addRoute({
      path,
      handler,
      method: HttpMethod.GET,
      ...options,
    });
  }

  /**
   * Register a POST route
   */
  post(path: IRoute['path'], handler: IRoute['handler'], options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] }): IRoute {
    return this.routeRegistry.addRoute({
      path,
      handler,
      method: HttpMethod.POST,
      ...options,
    });
  }

  /**
   * Register a PUT route
   */
  put(path: IRoute['path'], handler: IRoute['handler'], options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] }): IRoute {
    return this.routeRegistry.addRoute({
      path,
      handler,
      method: HttpMethod.PUT,
      ...options,
    });
  }

  /**
   * Register a DELETE route
   */
  delete(
    path: IRoute['path'],
    handler: IRoute['handler'],
    options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] },
  ): IRoute {
    return this.routeRegistry.addRoute({
      path,
      handler,
      method: HttpMethod.DELETE,
      ...options,
    });
  }

  /**
   * Register a PATCH route
   */
  patch(
    path: IRoute['path'],
    handler: IRoute['handler'],
    options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] },
  ): IRoute {
    return this.routeRegistry.addRoute({
      path,
      handler,
      method: HttpMethod.PATCH,
      ...options,
    });
  }

  /**
   * Register a group of routes with a common prefix
   */
  group(prefix: IRoute['path'], routes: Array<IRoute>, options?: { beforeGroup: IRoute['beforeGroup'] }): void {
    this.routeRegistry.addGroup(prefix, routes, options);
  }

  // === MIDDLEWARE METHODS ===

  /**
   * Register middleware to be executed before route handlers
   */
  beforeAll(fn: Parameters<MiddlewareManager['add']>[0], options?: Parameters<MiddlewareManager['add']>[1]): void {
    this.middlewareManager.add(fn, options);
  }

  // === SERVER LIFECYCLE METHODS ===

  /**
   * Start the server and listen for incoming connections
   */
  async listen(): Promise<void> {
    return new Promise((resolve) => {
      const server = createServer().listen(this._port, this._ip);
      this.connectionManager.setServer(server);

      server.on('listening', () => {
        this.connectionManager.setListening(true);
        resolve();
      });

      server.on('connection', (socket: Socket) => {
        this.connectionManager.addConnection(socket);

        socket.on('data', (buffer) => {
          this.requestHandler.handleSocketRequest(socket, buffer).catch((err) => {
            console.error('Error handling request:', err);
          });
        });

        socket.on('error', (error) => {
          console.error('An error occurred with yinzerflow. Please open an issue on GitHub.', error);
        });
      });

      server.on('error', (error) => {
        console.error('An error occurred with yinzerflow. Please open an issue on GitHub.', error);
      });
    });
  }

  /**
   * Stop the server and close all connections
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connectionManager.isListening() || !this.connectionManager.getServer()) {
        resolve();
        return;
      }

      // Close all existing connections
      this.connectionManager.closeAllConnections();

      const server = this.connectionManager.getServer();
      if (server) {
        server.close(() => {
          this.connectionManager.setListening(false);
          this.connectionManager.setServer(null);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the current server status
   */
  getStatus(): { isListening: boolean; port: number; ip: string } {
    return {
      isListening: this.connectionManager.isListening(),
      port: this._port,
      ip: this._ip,
    };
  }
}
