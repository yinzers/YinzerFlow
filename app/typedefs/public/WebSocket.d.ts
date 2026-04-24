/**
 * User-facing WebSocket types for YinzerFlow.
 *
 * These types define the public API surface for WebSocket support:
 * route handlers, the per-connection `ws` object, upgrade requests,
 * route options, and backpressure configuration.
 */

// ============================================
// WebSocket Connection Object
// ============================================

/**
 * A live WebSocket connection exposed to route handlers.
 *
 * @template T - Shape of per-socket data attached during upgrade
 *
 * @example
 * ```typescript
 * app.ws<{ userId: string }>('/feed', {
 *   message(ws, data) {
 *     ws.send(`Echo: ${data}`);
 *     ws.publish('updates', data as string);
 *     console.log(ws.data.userId, ws.readyState);
 *   }
 * });
 * ```
 */
export interface WebSocket<T = unknown> {
  /** Send a text or binary message to this client. */
  send: (data: Buffer | string) => void;
  /** Write a pre-encoded WebSocket frame directly (used internally by pub/sub broadcast). */
  sendRaw: (encodedFrame: Buffer) => void;
  /** Initiate a graceful close handshake. */
  close: (code?: number, reason?: string) => void;
  /** Send a ping frame (payload must be ≤125 bytes per RFC 6455 §5.5). */
  ping: (data?: Buffer) => void;
  /** Subscribe this connection to a named channel for pub/sub. */
  subscribe: (channel: string) => void;
  /** Unsubscribe this connection from a named channel. */
  unsubscribe: (channel: string) => void;
  /** Publish a message to all subscribers of a channel (excluding this connection). Returns recipient count. */
  publish: (channel: string, data: Buffer | string) => number;
  /** Check if this connection is subscribed to a channel. */
  isSubscribed: (channel: string) => boolean;
  /** Per-socket data attached during the upgrade handler. */
  readonly data: T;
  /** Current connection state (use wsReadyState constants for comparison). */
  readonly readyState: number;
  /** Remote IP address of the connected client. */
  readonly remoteAddress: string;
  /** Number of bytes queued in the socket's write buffer. */
  readonly bufferedAmount: number;
}

// ============================================
// Upgrade Request
// ============================================

/**
 * Parsed HTTP upgrade request passed to the `upgrade` handler.
 * Contains everything needed to decide whether to accept the connection
 * and what per-socket data to attach.
 */
export interface WebSocketUpgradeRequest {
  /** HTTP headers from the upgrade request (lowercased keys). */
  headers: Record<string, string>;
  /** URL path of the upgrade request. */
  path: string;
  /** Parsed query string parameters. */
  query: Record<string, string>;
  /** Route parameters extracted from parameterized paths (e.g., `/ws/:room` → `{ room: 'lobby' }`). */
  params: Record<string, string>;
  /** Remote IP address of the client. */
  remoteAddress: string;
}

// ============================================
// Route Handlers
// ============================================

/**
 * Handler functions for a WebSocket route.
 *
 * @template T - Shape of per-socket data returned from `upgrade`
 *
 * @example
 * ```typescript
 * app.ws<{ username: string }>('/chat', {
 *   upgrade(req) {
 *     const user = validateToken(req.headers.authorization);
 *     return user ? { username: user.name } : false;
 *   },
 *   open(ws) {
 *     ws.subscribe('chat');
 *   },
 *   message(ws, data, isBinary) {
 *     ws.publish('chat', data as string);
 *   },
 *   close(ws, code, reason) {
 *     // cleanup — unsubscribe is automatic
 *   }
 * });
 * ```
 */
export interface WebSocketHandlers<T = unknown> {
  /**
   * Called before the handshake completes. Return per-socket data to accept,
   * or `false` to reject the connection with a 403 response.
   * If omitted, the connection is accepted with `undefined` as data.
   */
  upgrade?: (request: WebSocketUpgradeRequest) => Promise<T | false> | T | false;
  /** Called when the connection is established and ready. */
  open?: (ws: WebSocket<T>) => void;
  /** Called when a complete message (text or binary) is received. */
  message?: (ws: WebSocket<T>, data: Buffer | string, isBinary: boolean) => void;
  /** Called when the connection is closed (after close handshake or on error). */
  close?: (ws: WebSocket<T>, code: number, reason: string) => void;
  /** Called when a socket error occurs. */
  error?: (ws: WebSocket<T>, error: Error) => void;
  /** Called when a backpressured socket's write buffer drains. */
  drain?: (ws: WebSocket<T>) => void;
}

// ============================================
// Route Options
// ============================================

/**
 * Per-route WebSocket options that override global websocket configuration.
 */
export interface WebSocketRouteOptions {
  /** Maximum incoming message payload in bytes (default: global `websocket.maxPayloadLength`). */
  maxPayloadLength?: number;
  /** Seconds of inactivity before closing the connection (default: global `websocket.idleTimeout`). 0 = no timeout. */
  idleTimeout?: number;
  /** Backpressure handling for this route. */
  backpressure?: WebSocketBackpressureOptions;
}

/**
 * Backpressure configuration for WebSocket connections.
 */
export interface WebSocketBackpressureOptions {
  /**
   * Strategy when the client can't keep up with outgoing data:
   * - `'buffer'`: Queue messages up to `limit` bytes, then close the connection (safe default)
   * - `'drop'`: Silently discard messages (ideal for real-time data like trading quotes)
   * @default 'buffer'
   */
  strategy: 'buffer' | 'drop';
  /** Maximum buffered bytes before the connection is closed (only applies to 'buffer' strategy). @default 1048576 (1MB) */
  limit?: number;
}

/**
 * WebSocket message hook handler signature.
 * Used for `wsBeforeMessage` and `wsAfterMessage` global hooks.
 */
export type WebSocketMessageHook = (ws: WebSocket, data: Buffer | string, isBinary: boolean) => Promise<void> | void;
