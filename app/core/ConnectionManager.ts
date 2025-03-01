import type { Server, Socket } from 'net';

/**
 * Manages socket connections to the server
 */
export class ConnectionManager {
  private readonly _connections = new Set<Socket>();
  private _server: Server | null = null;
  private _isListening = false;

  /**
   * Set the server instance
   */
  setServer(server: Server | null): void {
    this._server = server;
  }

  /**
   * Add a socket connection
   */
  addConnection(socket: Socket): void {
    this._connections.add(socket);

    socket.on('close', () => {
      this._connections.delete(socket);
    });
  }

  /**
   * Get all active connections
   */
  getConnections(): Set<Socket> {
    return this._connections;
  }

  /**
   * Set the listening state
   */
  setListening(isListening: boolean): void {
    this._isListening = isListening;
  }

  /**
   * Get the listening state
   */
  isListening(): boolean {
    return this._isListening;
  }

  /**
   * Get the server instance
   */
  getServer(): Server | null {
    return this._server;
  }

  /**
   * Close all connections
   */
  closeAllConnections(): void {
    for (const socket of this._connections) {
      socket.destroy();
    }
    this._connections.clear();
  }
}
