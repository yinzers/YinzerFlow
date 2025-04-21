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
 * Default socket timeout in milliseconds (30 seconds)
 *
 * Standard timeout for most socket connections.
 * It is long enough for slow clients but short enough to prevent idle connections from staying open indefinitely.
 */
export const DEFAULT_SOCKET_TIMEOUT = 30000;

/**
 * Default keep-alive timeout in milliseconds (65 seconds)
 *
 * This is the maximum time a connection can be idle before the server will close it.
 * This is to allow for a connection to stay open for a period of time so subsequent requests can be handled without a new connection.
 * This is also to prevent a connection from staying open indefinitely.
 * This is also useful for load balancing and preventing a single server from being overwhelmed by a large number of connections.
 * AWS recommends a keep-alive timeout of 65 seconds because there idle timeout is 60 seconds.
 */
export const DEFAULT_KEEP_ALIVE_TIMEOUT = 65000;

/**
 * Default headers timeout in milliseconds (66 seconds)
 *
 * This is the maximum time to wait for a header from the client.
 * This is to allow for a connection to stay open for a period of time so subsequent requests can be handled without a new connection.
 * This is also to prevent a connection from staying open indefinitely.
 * This is also useful for load balancing and preventing a single server from being overwhelmed by a large number of connections.
 * It is recommended to set this value to be greater than the keep-alive timeout to prevent the server from closing the connection prematurely
 * before the keep-alive timeout has expired.
 */
export const DEFAULT_HEADERS_TIMEOUT = 66000;

/**
 * Default graceful shutdown timeout in milliseconds (30 seconds)
 *
 * This is the maximum time to wait for a connection to complete before the server will close it.
 */
export const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT = 30000;

/**
 * Default port for the server
 */
export const DEFAULT_PORT = 5000;
