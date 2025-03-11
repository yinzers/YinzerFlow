/**
 * Connection-related types
 *
 * This file contains type definitions related to connection management in YinzerFlow.
 */

/**
 * Connection statistics
 */
export interface IConnectionStats {
  /** Total number of active connections */
  activeConnections: number;
  /** Total number of connections handled since server start */
  totalConnections: number;
  /** Total number of connection errors */
  connectionErrors: number;
  /** Server uptime in milliseconds */
  uptime: number;
}
