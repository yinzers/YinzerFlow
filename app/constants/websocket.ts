/**
 * WebSocket frame opcodes per RFC 6455 §5.2
 *
 * Data frames: continuation (0x0), text (0x1), binary (0x2)
 * Control frames: close (0x8), ping (0x9), pong (0xA)
 */
export const wsOpcode = {
  continuation: 0x0,
  text: 0x1,
  binary: 0x2,
  close: 0x8,
  ping: 0x9,
  pong: 0xa,
} as const;

/**
 * WebSocket close status codes per RFC 6455 §7.4.1
 */
export const wsCloseCode = {
  normal: 1000,
  goingAway: 1001,
  protocolError: 1002,
  unsupported: 1003,
  noStatus: 1005,
  abnormal: 1006,
  invalidPayload: 1007,
  policyViolation: 1008,
  tooLarge: 1009,
  missingExtension: 1010,
  internalError: 1011,
} as const;

/**
 * WebSocket connection ready states per RFC 6455 §5
 */
export const wsReadyState = {
  connecting: 0,
  open: 1,
  closing: 2,
  closed: 3,
} as const;

/**
 * Backpressure strategies for WebSocket connections.
 *
 * - `buffer`: Queue messages up to a configurable limit (safe default — no data loss)
 * - `drop`: Silently discard messages when the client can't keep up (ideal for
 *   real-time data like trading quotes where stale data is worse than gaps)
 */
export const wsBackpressureStrategy = {
  buffer: 'buffer',
  drop: 'drop',
} as const;

/**
 * RFC 6455 §4.2.2 — magic GUID concatenated with Sec-WebSocket-Key for accept hash
 */
export const wsMagicGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
