/**
 * Internal types for WebSocket module
 *
 * Frame-level protocol types, parse results, and channel/hook infrastructure.
 */

// ============================================
// Frame Protocol Types
// ============================================

/**
 * A decoded WebSocket frame as read from the wire.
 * The opcode is `number` (not the narrower union type) because the parser reads
 * raw bytes — opcode validation happens at the connection layer.
 */
export interface InternalWebSocketFrame {
  /** Final fragment flag — true if this is the last (or only) frame of a message */
  fin: boolean;
  /** Raw opcode from the wire (validated by the connection class, not the frame parser) */
  opcode: number;
  /** Whether the payload was masked (client→server frames MUST be masked) */
  masked: boolean;
  /** Decoded payload length in bytes */
  payloadLength: number;
  /** Unmasked payload data */
  payload: Buffer;
}

/**
 * Result of attempting to parse a frame from a buffer.
 * `null` means the buffer doesn't contain a complete frame yet — need more data.
 */
export type InternalWebSocketParseResult = {
  frame: InternalWebSocketFrame;
  bytesConsumed: number;
} | null;
