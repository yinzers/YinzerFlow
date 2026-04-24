/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { wsOpcode } from '@constants/websocket.ts';
import type { InternalWebSocketParseResult } from '@typedefs/internal/modules/websocket/index.js';

// Pre-computed constants to avoid repeated property lookups in hot path
const OPCODE_CLOSE = wsOpcode.close;

/**
 * XOR-unmask a payload buffer in-place using a 4-byte rotating mask key.
 * Mutates `payload` directly — zero allocation.
 *
 * Per RFC 6455 §5.3: `j = i MOD 4`, `transformed[i] = original[i] XOR maskKey[j]`
 */
export const _unmask = (payload: Buffer, maskKey: Buffer): void => {
  for (let i = 0; i < payload.length; i++) {
    payload[i] = payload[i]! ^ maskKey[i & 3]!;
  }
};

/**
 * Attempt to parse one WebSocket frame from a buffer starting at `offset`.
 *
 * Returns `null` if the buffer doesn't contain a complete frame (need more TCP data).
 * Otherwise returns the decoded frame and the number of bytes consumed so callers
 * can advance their offset and parse the next frame in the same buffer.
 *
 * Frame wire format (RFC 6455 §5.2):
 * ```
 * Byte 0: [FIN:1][RSV1-3:3][OPCODE:4]
 * Byte 1: [MASK:1][PAYLOAD_LEN:7]
 *   if PAYLOAD_LEN == 126 → next 2 bytes are uint16 length
 *   if PAYLOAD_LEN == 127 → next 8 bytes are uint64 length
 * If MASK == 1 → next 4 bytes are masking key
 * Remaining bytes: payload data
 * ```
 */
export const _parseFrame = (buffer: Buffer, offset: number): InternalWebSocketParseResult => {
  const available = buffer.length - offset;

  // Need at least 2 bytes for the minimal frame header
  if (available < 2) return null;

  const byte0 = buffer[offset]!;
  const byte1 = buffer[offset + 1]!;

  const fin = (byte0 & 0x80) !== 0;
  const opcode = byte0 & 0x0f;
  const masked = (byte1 & 0x80) !== 0;
  let payloadLength = byte1 & 0x7f;
  let headerSize = 2;

  // Extended payload length: 16-bit
  if (payloadLength === 126) {
    if (available < 4) return null;
    payloadLength = buffer.readUInt16BE(offset + 2);
    headerSize = 4;
  }
  // Extended payload length: 64-bit
  else if (payloadLength === 127) {
    if (available < 10) return null;
    // Read as two 32-bit values — upper 32 bits must be zero (we don't support >4GB frames)
    const upper = buffer.readUInt32BE(offset + 2);
    if (upper !== 0) {
      throw new Error('WebSocket frame payload too large (>4GB not supported)');
    }
    payloadLength = buffer.readUInt32BE(offset + 6);
    headerSize = 10;
  }

  // Add masking key size if present
  if (masked) {
    headerSize += 4;
  }

  const totalFrameSize = headerSize + payloadLength;

  // Not enough data for the full frame yet
  if (available < totalFrameSize) return null;

  const payload = masked
    ? ((): Buffer => {
      const maskKeyOffset = offset + headerSize - 4;
      const maskKey = buffer.subarray(maskKeyOffset, maskKeyOffset + 4);
      const unmaskedPayload = Buffer.from(
        buffer.subarray(offset + headerSize, offset + totalFrameSize),
      );
      _unmask(unmaskedPayload, maskKey);
      return unmaskedPayload;
    })()
    : Buffer.from(buffer.subarray(offset + headerSize, offset + totalFrameSize));

  return {
    frame: {
      fin,
      opcode,
      masked,
      payloadLength,
      payload,
    },
    bytesConsumed: totalFrameSize,
  };
};

/**
 * Encode an outgoing WebSocket frame (server→client, never masked).
 * Uses `Buffer.allocUnsafe` for performance — the entire buffer is written before use.
 */
export const _encodeFrame = (opcode: number, payload: Buffer, fin = true): Buffer => {
  const payloadLength = payload.length;
  let headerSize = 2;
  let extendedLengthWriter: ((buf: Buffer) => void) | undefined = undefined;

  if (payloadLength >= 126 && payloadLength < 65536) {
    headerSize = 4;
    extendedLengthWriter = (buf: Buffer): void => {
      buf.writeUInt16BE(payloadLength, 2);
    };
  } else if (payloadLength >= 65536) {
    headerSize = 10;
    extendedLengthWriter = (buf: Buffer): void => {
      buf.writeUInt32BE(0, 2); // upper 32 bits = 0
      buf.writeUInt32BE(payloadLength, 6);
    };
  }

  const frame = Buffer.allocUnsafe(headerSize + payloadLength);

  // Byte 0: FIN + opcode
  frame[0] = (fin ? 0x80 : 0x00) | opcode;

  // Byte 1: MASK=0 + payload length indicator
  if (payloadLength < 126) {
    frame[1] = payloadLength;
  } else if (payloadLength < 65536) {
    frame[1] = 126;
  } else {
    frame[1] = 127;
  }

  // Extended length bytes
  if (extendedLengthWriter) {
    extendedLengthWriter(frame);
  }

  // Copy payload into frame buffer
  payload.copy(frame, headerSize);

  return frame;
};

/**
 * Encode a close frame with a status code and optional reason string.
 * Close frame payload: 2-byte BE status code + optional UTF-8 reason text.
 * Total payload must be ≤125 bytes (control frame limit per RFC 6455 §5.5).
 */
export const _encodeCloseFrame = (code: number, reason?: string): Buffer => {
  const payload = reason
    ? ((): Buffer => {
      const reasonBytes = Buffer.from(reason, 'utf8');
      // Truncate reason to fit within 125-byte control frame payload limit (2 bytes for code)
      const maxReasonLength = Math.min(reasonBytes.length, 123);
      const buf = Buffer.allocUnsafe(2 + maxReasonLength);
      buf.writeUInt16BE(code, 0);
      reasonBytes.copy(buf, 2, 0, maxReasonLength);
      return buf;
    })()
    : ((): Buffer => {
      const buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(code, 0);
      return buf;
    })();

  return _encodeFrame(OPCODE_CLOSE, payload);
};
