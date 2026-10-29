import type { InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { InternalWsSendStatus } from '@typedefs/constants/websocket.js';

/**
 * What a send did with the frame: `'sent'` (taken by the socket), `'buffered'` (queued behind backpressure, goes out
 * on drain) or `'dropped'` (discarded: connection not open, `'drop'` strategy, or over the `'buffer'` limit, which
 * also closes the connection). Compare against the `wsSendStatus` constant.
 */
export type WebSocketSendStatus = InternalWsSendStatus;

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
  /**
   * Send a text or binary message to this client. Returns what happened to it: `'sent'`, `'buffered'` (queued behind
   * backpressure) or `'dropped'` (see {@link WebSocketSendStatus}).
   */
  send: (data: Buffer | string) => WebSocketSendStatus;
  /** Write a pre-encoded WebSocket frame directly (used internally by pub/sub broadcast). Returns the same status as `send`. */
  sendRaw: (encodedFrame: Buffer) => WebSocketSendStatus;
  /** Initiate a graceful close handshake. */
  close: (code?: number, reason?: string) => void;
  /** Send a ping frame (payload must be ≤125 bytes per RFC 6455 §5.5). */
  ping: (data?: Buffer) => void;
  /**
   * Subscribe this connection to a named channel for pub/sub. Returns `true` when the connection is subscribed, and
   * `false` (doing nothing) when it is closing or already closed, so a late subscribe can't keep a dead connection in
   * the channel.
   */
  subscribe: (channel: string) => boolean;
  /** Unsubscribe this connection from a named channel. */
  unsubscribe: (channel: string) => void;
  /**
   * Publish a message to all subscribers of a channel (excluding this connection). Returns how many subscribers took
   * the frame (sent or buffered); subscribers that dropped it aren't counted.
   */
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
  /**
   * URL path of the upgrade request exactly as sent, with the query string removed (`//ws/admin` stays `//ws/admin`).
   *
   * Route matching does not use this raw value: it uses the canonical path (decoded once, repeated and trailing
   * slashes collapsed), and upgrades whose path contains `.` / `..` segments, encoded slashes (`%2f`, `%5c`),
   * a backslash, a NUL or invalid percent-encoding are rejected with 400 before this handler runs. Don't make
   * access decisions by comparing this raw string; use `params` from the matched route instead.
   */
  path: string;
  /** Parsed query string parameters. */
  query: Record<string, string>;
  /** Route parameters extracted from parameterized paths (e.g., `/ws/:room` → `{ room: 'lobby' }`). */
  params: Record<string, string>;
  /** Remote IP address of the client. */
  remoteAddress: string;
  /**
   * The `ctx.state` object the global `beforeRouting` / `beforeAll` hooks wrote to on this upgrade (the same object,
   * not a copy). It lives for the upgrade request only: return what the connection needs from `upgrade()` to keep it
   * on `ws.data`.
   *
   * @example
   * ```typescript
   * app.beforeAll([async (ctx) => { ctx.state.userId = await verify(ctx.request.headers.authorization); }]);
   * app.ws<{ userId: string }>('/feed', {
   *   upgrade(req) {
   *     return { userId: String(req.state.userId) };
   *   },
   * });
   * ```
   */
  state: Record<string, unknown>;
}

/**
 * A refusal returned from an `upgrade` handler, built with `rejectUpgrade(statusCode, body?)`. The client gets an
 * HTTP response with this status and body instead of the handshake.
 */
export interface WebSocketUpgradeRejection {
  /** The 4xx or 5xx status the client receives. */
  readonly statusCode: InternalHttpStatusCode;
  /** The response body, serialized like a route handler's return value. */
  readonly body: unknown;
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
   * Called before the handshake completes. Return per-socket data to accept, `false` to reject the connection with
   * a 403 response, or `rejectUpgrade(statusCode, body?)` to reject it with another 4xx/5xx status and body.
   * If omitted, the connection is accepted with `undefined` as data.
   * Runs after the global `beforeRouting` / `beforeAll` hooks and the global rate limiter. A throw (or rejection) here
   * is answered through the app's `onError` handler as an HTTP response (500 by default) before any handshake.
   */
  upgrade?: (request: WebSocketUpgradeRequest) => Promise<T | WebSocketUpgradeRejection | false> | T | WebSocketUpgradeRejection | false;
  /** Called when the connection is established and ready. */
  open?: (ws: WebSocket<T>) => void;
  /** Called when a complete message (text or binary) is received. */
  message?: (ws: WebSocket<T>, data: Buffer | string, isBinary: boolean) => void;
  /** Called when the connection is closed (after close handshake or on error). */
  close?: (ws: WebSocket<T>, code: number, reason: string) => void;
  /**
   * Called when a socket error occurs, and when `open`, `message`, `close` or `drain` throws or rejects. A handler
   * error leaves the connection open and the message consumed; without this handler it is logged once at error level.
   */
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
  /**
   * `0` disables the heartbeat for this route; a positive value keeps it on. The ping sweep runs at the global
   * `websocket.heartbeat.interval` for every route, so a different positive value here does not change the timing, and
   * with the global heartbeat disabled no route is pinged.
   */
  heartbeatInterval?: number;
  /** Per-connection message rate limiting override for this route. */
  messageRateLimit?: {
    /** Max messages per window. */
    maxMessages?: number;
    /** Window duration in seconds. */
    window?: number;
  };
  /** Override compression threshold for this route (bytes). Set to 0 to compress all messages. */
  compressionThreshold?: number;
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
 *
 * A `wsBeforeMessage` hook that returns (or resolves to) `false` drops the message: later before hooks, the route's
 * `message` handler and the after hooks don't run, and nothing is logged. To also end the connection, call
 * `ws.close(code, reason)` before returning `false`. A throw is still an error and goes to the route's `error` handler.
 * The return value of a `wsAfterMessage` hook is ignored.
 *
 * @example
 * ```typescript
 * app.wsBeforeMessage([
 *   (ws, data) => {
 *     if (String(data).length > 4096) {
 *       ws.close(wsCloseCode.policyViolation, 'Message too long');
 *       return false;
 *     }
 *     if (String(data) === 'ping') return false; // app-level keepalive, nothing to handle
 *   },
 * ]);
 * ```
 */
export type WebSocketMessageHook = (ws: WebSocket, data: Buffer | string, isBinary: boolean) => Promise<false | void> | false | void;
