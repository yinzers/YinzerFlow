import { createServer } from 'net';
import type { Socket } from 'net';
import ip from 'ip';

import { ConfigManager } from './ConfigManager.ts';
import { addDeleteRoute, addGetRoute, addPatchRoute, addPostRoute, addPutRoute } from 'core/Route/methods/index.ts';
import { RouteRegistry } from 'core/Route/RouteRegistry.ts';
import { RouteRegistryEvent } from 'constants/route.ts';
import { RouteFinder } from 'core/Route/RouteFinder.ts';
import type { IRoute } from 'types/Route.ts';
import { RequestHandler } from 'core/Request/RequestHandler.ts';
import { ConnectionManager } from 'core/ConnectionManager.ts';
import { HooksManager } from 'core/HooksManager.ts';
import type { IServerOptions } from 'types/Server.ts';

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
  private readonly hooksManager = new HooksManager();
  private readonly connectionManager: ConnectionManager;
  private readonly requestHandler: RequestHandler;
  private readonly configManager: ConfigManager;

  // === SERVER CONFIGURATION ===
  private readonly _ip: string = ip.address();

  // === PUBLIC ACCESSORS ===

  /**
   * Get the hooks manager instance
   *
   * This allows direct access to the hooks manager for advanced use cases,
   * such as subscribing to hook events.
   */
  get hooks(): HooksManager {
    return this.hooksManager;
  }

  /**
   * Get the config manager instance
   *
   * This allows direct access to the configuration for advanced use cases.
   */
  get config(): ConfigManager {
    return this.configManager;
  }

  /**
   * Create a new YinzerFlow server instance
   */
  constructor(options?: IServerOptions) {
    // Initialize the config manager with all options
    this.configManager = new ConfigManager(options);

    // Initialize the connection manager with the config manager
    this.connectionManager = new ConnectionManager(this.configManager);

    // Initialize the request handler with the managers
    this.requestHandler = new RequestHandler(this.routeFinder, this.hooksManager, this.configManager);

    // Set up event listeners for route changes
    this.routeRegistry.on(RouteRegistryEvent.ROUTES_CHANGED, () => {
      // Update the route finder's pattern cache when routes change
      this.routeFinder.updatePatternRouteCache();
    });
  }

  // === ROUTE DEFINITION METHODS ===
  /**
   * This tree shaking method is used to optimize the bundle size by including only the HTTP methods that are actually utilized.
   * Here's the process:
   * 1. User imports YinzerFlow: The main class is imported as before.
   * 2. YinzerFlow loads only what's needed: Only the HTTP methods actually used are included in the bundle.
   * 3. User API remains unchanged: Methods like app.get() and app.post() function as they did previously.
   *
   * Benefits to End Users:
   * - Smaller Bundle Size: Unused methods (e.g., PUT, DELETE) won't bloat the final bundle.
   * - Faster Startup: Less code leads to quicker parsing and execution.
   * - Lower Memory Usage: Only essential code is loaded into memory.
   * - Better Performance: Smaller bundles generally enhance overall performance.
   */

  /**
   * Register a GET route
   */
  get = addGetRoute(this.routeRegistry);

  /**
   * Register a POST route
   */
  post = addPostRoute(this.routeRegistry);

  /**
   * Register a PUT route
   */
  put = addPutRoute(this.routeRegistry);

  /**
   * Register a DELETE route
   */
  delete = addDeleteRoute(this.routeRegistry);

  /**
   * Register a PATCH route
   */
  patch = addPatchRoute(this.routeRegistry);

  /**
   * Register a group of routes with a common prefix
   */
  group(prefix: IRoute['path'], routes: Array<IRoute>, options?: { beforeGroup: IRoute['beforeGroup'] }): void {
    this.routeRegistry.addGroup(prefix, routes, options);
  }

  // === MIDDLEWARE METHODS ===

  /**
   * Register hooks to be executed before route handlers
   */
  beforeAll(fn: Parameters<HooksManager['add']>[0], options?: Parameters<HooksManager['add']>[1]): this {
    this.hooksManager.add(fn, options);
    return this;
  }

  // === SERVER LIFECYCLE METHODS ===

  /**
   * Start the server and listen for incoming connections
   */
  async listen(): Promise<void> {
    return new Promise((resolve) => {
      const { port } = this.configManager;
      const server = createServer();

      // Start listening
      server.listen(port, this._ip);

      this.connectionManager.setServer(server);

      server.on('listening', () => {
        this.connectionManager.setListening(true);
        resolve();
      });

      server.on('connection', (socket: Socket) => {
        // Add the connection to the connection manager
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
    // If not listening or no server, resolve immediately
    if (!this.connectionManager.isListening() || !this.connectionManager.getServer()) {
      return;
    }

    // Close all existing connections with the configured grace period
    await this.connectionManager.closeAllConnections();

    // Close the server
    const server = this.connectionManager.getServer();
    if (!server) return;

    return new Promise((resolve) => {
      server.close(() => {
        this.connectionManager.setListening(false);
        resolve();
      });
    });
  }

  /**
   * Get the current server status
   */
  getStatus(): { isListening: boolean; port: number; ip: string } {
    return {
      isListening: this.connectionManager.isListening(),
      port: this.configManager.port,
      ip: this._ip,
    };
  }
}
