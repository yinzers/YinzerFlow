/**
 * Connection-related constants
 *
 * This file contains constants related to connection management in YinzerFlow.
 */

/**
 * Connection events emitted by the ConnectionManager
 */
export const ConnectionEvent = <const>{
  /** Emitted when a new connection is established */
  CONNECTION_ADDED: 'connection-added',
  /** Emitted when a connection is closed */
  CONNECTION_CLOSED: 'connection-closed',
  /** Emitted when a connection error occurs */
  CONNECTION_ERROR: 'connection-error',
  /** Emitted when all connections are closed */
  ALL_CONNECTIONS_CLOSED: 'all-connections-closed',
  /** Emitted when the server starts listening */
  SERVER_STARTED: 'server-started',
  /** Emitted when the server stops listening */
  SERVER_STOPPED: 'server-stopped',
};

/**
 * Default socket timeout in milliseconds (2 minutes)
 */
export const DEFAULT_SOCKET_TIMEOUT = 120000;
