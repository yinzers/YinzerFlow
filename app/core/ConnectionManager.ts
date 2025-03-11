import type { Server, Socket } from 'net';
import { EventEmitter } from 'events';
import { ConnectionEvent, DEFAULT_SOCKET_TIMEOUT } from '../constants/connection.ts';
import type { IConnectionStats } from '../types/Connection.ts';

/**
 * Manages socket connections to the server
 *
 * The ConnectionManager is responsible for:
 * - Tracking active socket connections
 * - Managing the server's listening state
 * - Providing connection statistics
 * - Gracefully closing connections when the server shuts down
 */
export class ConnectionManager extends EventEmitter {
  /** Active socket connections */
  private readonly _connections = new Set<Socket>();
  /** Server instance */
  private _server: Server | null = null;
  /** Server listening state */
  private _isListening = false;
  /** Server start time */
  private _startTime = 0;
  /** Total connections since server start */
  private _totalConnections = 0;
  /** Total connection errors */
  private _connectionErrors = 0;
  /** Default socket timeout in milliseconds */
  private readonly _socketTimeout: number;

  /**
   * Creates a new ConnectionManager instance
   *
   * @param socketTimeout Optional socket timeout in milliseconds (default: 2 minutes)
   */
  constructor(socketTimeout?: number) {
    super();
    this._socketTimeout = socketTimeout ?? DEFAULT_SOCKET_TIMEOUT;
  }

  /**
   * Sets the server instance and configures event listeners
   *
   * @param server The server instance to manage
   */
  setServer(server: Server | null): void {
    this._server = server;

    if (server) {
      // Reset statistics when a new server is set
      this._totalConnections = 0;
      this._connectionErrors = 0;
    }
  }

  /**
   * Adds a socket connection to the manager and sets up event listeners
   *
   * @param socket The client socket connection
   * @param timeout Optional timeout for this specific connection
   */
  addConnection(socket: Socket, timeout?: number): void {
    try {
      // Configure socket timeout
      socket.setTimeout(timeout ?? this._socketTimeout);

      // Add to active connections
      this._connections.add(socket);
      this._totalConnections++;

      // Emit connection added event
      this.emit(ConnectionEvent.CONNECTION_ADDED, socket);

      // Set up event listeners
      socket.on('close', () => {
        this._connections.delete(socket);
        this.emit(ConnectionEvent.CONNECTION_CLOSED, socket);
      });

      socket.on('error', (err) => {
        this._connectionErrors++;
        this.emit(ConnectionEvent.CONNECTION_ERROR, socket, err);
      });

      socket.on('timeout', () => {
        // Destroy the socket on timeout
        socket.end('HTTP/1.1 408 Request Timeout\r\n\r\n');
        socket.destroy();
      });
    } catch (err) {
      this._connectionErrors++;
      this.emit(ConnectionEvent.CONNECTION_ERROR, socket, err);
    }
  }

  /**
   * Gets all active socket connections
   *
   * @returns A set of active socket connections
   */
  getConnections(): Set<Socket> {
    return this._connections;
  }

  /**
   * Gets the current number of active connections
   *
   * @returns The number of active connections
   */
  getConnectionCount(): number {
    return this._connections.size;
  }

  /**
   * Sets the server's listening state
   *
   * @param isListening Whether the server is listening for connections
   */
  setListening(isListening: boolean): void {
    const wasListening = this._isListening;
    this._isListening = isListening;

    // Update start time and emit events when state changes
    if (isListening && !wasListening) {
      this._startTime = Date.now();
      this.emit(ConnectionEvent.SERVER_STARTED);
    } else if (!isListening && wasListening) {
      this.emit(ConnectionEvent.SERVER_STOPPED);
    }
  }

  /**
   * Checks if the server is currently listening
   *
   * @returns True if the server is listening, false otherwise
   */
  isListening(): boolean {
    return this._isListening;
  }

  /**
   * Gets the server instance
   *
   * @returns The server instance or null if not set
   */
  getServer(): Server | null {
    return this._server;
  }

  /**
   * Gets connection statistics
   *
   * @returns Connection statistics object
   */
  getStats(): IConnectionStats {
    return {
      activeConnections: this._connections.size,
      totalConnections: this._totalConnections,
      connectionErrors: this._connectionErrors,
      uptime: this._isListening ? Date.now() - this._startTime : 0,
    };
  }

  /**
   * Closes all active connections gracefully
   *
   * @param gracePeriod Optional grace period in milliseconds before forcefully closing connections
   * @returns Promise that resolves when all connections are closed
   */
  async closeAllConnections(gracePeriod?: number): Promise<void> {
    // If there are no connections, resolve immediately
    if (this._connections.size === 0) {
      this.emit(ConnectionEvent.ALL_CONNECTIONS_CLOSED);
      return;
    }

    // Create a copy of the connections to avoid modification during iteration
    const connections = [...this._connections];

    // If grace period is provided, attempt graceful shutdown
    if (gracePeriod !== undefined && gracePeriod > 0) {
      // End each connection with a proper HTTP response
      for (const socket of connections) {
        try {
          socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        } catch (_err) {
          // Ignore errors during shutdown
        }
      }

      // Wait for the grace period
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), gracePeriod);
      });
    }

    // Force close any remaining connections
    for (const socket of this._connections) {
      try {
        socket.destroy();
      } catch (_err) {
        // Ignore errors during shutdown
      }
    }

    // Clear the connections set
    this._connections.clear();

    // Emit the all connections closed event
    this.emit(ConnectionEvent.ALL_CONNECTIONS_CLOSED);
  }
}
