/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { describe, expect, it } from 'bun:test';
import { _encodeCloseFrame, _encodeFrame, _parseFrame, _unmask } from '../WebSocketFrame.ts';
import { wsCloseCode, wsOpcode } from '@constants/websocket.ts';

/**
 * Helper: build a masked client frame from a payload and opcode.
 * Applies the mask key via XOR, same as a real client would.
 */
const buildMaskedFrame = (opcode: number, payload: Buffer, fin = true): Buffer => {
  const maskKey = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) {
    masked[i] = masked[i]! ^ maskKey[i & 3]!;
  }

  let headerSize: number;
  const payloadLength = payload.length;

  if (payloadLength < 126) {
    headerSize = 2;
  } else if (payloadLength < 65536) {
    headerSize = 4;
  } else {
    headerSize = 10;
  }

  const frame = Buffer.allocUnsafe(headerSize + 4 + payloadLength);
  frame[0] = (fin ? 0x80 : 0x00) | opcode;

  if (payloadLength < 126) {
    frame[1] = 0x80 | payloadLength; // MASK bit set
    maskKey.copy(frame, 2);
    masked.copy(frame, 6);
  } else if (payloadLength < 65536) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(payloadLength, 2);
    maskKey.copy(frame, 4);
    masked.copy(frame, 8);
  } else {
    frame[1] = 0x80 | 127;
    frame.writeUInt32BE(0, 2);
    frame.writeUInt32BE(payloadLength, 6);
    maskKey.copy(frame, 10);
    masked.copy(frame, 14);
  }

  return frame;
};

/**
 * Helper: build an unmasked server frame (for testing server→client encoding).
 */
const buildUnmaskedFrame = (opcode: number, payload: Buffer, fin = true): Buffer => {
  let headerSize: number;
  const payloadLength = payload.length;

  if (payloadLength < 126) {
    headerSize = 2;
  } else if (payloadLength < 65536) {
    headerSize = 4;
  } else {
    headerSize = 10;
  }

  const frame = Buffer.allocUnsafe(headerSize + payloadLength);
  frame[0] = (fin ? 0x80 : 0x00) | opcode;

  if (payloadLength < 126) {
    frame[1] = payloadLength;
  } else if (payloadLength < 65536) {
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
  } else {
    frame[1] = 127;
    frame.writeUInt32BE(0, 2);
    frame.writeUInt32BE(payloadLength, 6);
  }

  payload.copy(frame, headerSize);
  return frame;
};

// ============================================
// _unmask
// ============================================

describe('_unmask', () => {
  it('should XOR-unmask a payload in-place with a 4-byte rotating key', () => {
    const maskKey = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
    const original = Buffer.from('Hello');
    const masked = Buffer.from(original);
    for (let i = 0; i < masked.length; i++) {
      masked[i] = masked[i]! ^ maskKey[i & 3]!;
    }

    _unmask(masked, maskKey);
    expect(masked.toString()).toBe('Hello');
  });

  it('should handle empty payload', () => {
    const maskKey = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const payload = Buffer.alloc(0);
    _unmask(payload, maskKey);
    expect(payload.length).toBe(0);
  });

  it('should modify the buffer in-place (no new allocation)', () => {
    const maskKey = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);
    const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const ref = payload;
    _unmask(payload, maskKey);
    expect(payload).toBe(ref);
  });
});

// ============================================
// _parseFrame — Small text frame (7-bit length)
// ============================================

describe('_parseFrame', () => {
  it('should parse a small masked text frame (7-bit payload length)', () => {
    const payload = Buffer.from('Hello');
    const frame = buildMaskedFrame(wsOpcode.text, payload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.fin).toBe(true);
    expect(result!.frame.opcode).toBe(wsOpcode.text);
    expect(result!.frame.masked).toBe(true);
    expect(result!.frame.payloadLength).toBe(5);
    expect(result!.frame.payload.toString()).toBe('Hello');
    expect(result!.bytesConsumed).toBe(frame.length);
  });

  // ============================================
  // Medium frame (16-bit extended length)
  // ============================================

  it('should parse a masked frame with 16-bit extended payload length (126-65535 bytes)', () => {
    const payload = Buffer.alloc(300, 0x42);
    const frame = buildMaskedFrame(wsOpcode.binary, payload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.payloadLength).toBe(300);
    expect(result!.frame.opcode).toBe(wsOpcode.binary);
    expect(result!.frame.payload.length).toBe(300);
    expect(result!.frame.payload[0]).toBe(0x42);
    expect(result!.frame.payload[299]).toBe(0x42);
  });

  // ============================================
  // Large frame (64-bit extended length)
  // ============================================

  it('should parse a masked frame with 64-bit extended payload length (>65535 bytes)', () => {
    const payload = Buffer.alloc(70000, 0xab);
    const frame = buildMaskedFrame(wsOpcode.binary, payload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.payloadLength).toBe(70000);
    expect(result!.frame.payload.length).toBe(70000);
    expect(result!.frame.payload[0]).toBe(0xab);
    expect(result!.frame.payload[69999]).toBe(0xab);
  });

  // ============================================
  // Binary frame
  // ============================================

  it('should parse a binary frame with arbitrary byte data', () => {
    const payload = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]);
    const frame = buildMaskedFrame(wsOpcode.binary, payload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.opcode).toBe(wsOpcode.binary);
    expect(result!.frame.payload).toEqual(payload);
  });

  // ============================================
  // Unmasked frame (server→client direction, or testing)
  // ============================================

  it('should parse an unmasked frame', () => {
    const payload = Buffer.from('Unmasked');
    const frame = buildUnmaskedFrame(wsOpcode.text, payload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.masked).toBe(false);
    expect(result!.frame.payload.toString()).toBe('Unmasked');
  });

  // ============================================
  // Control frames: ping, pong, close
  // ============================================

  it('should parse a ping frame with payload', () => {
    const payload = Buffer.from('ping-data');
    const frame = buildMaskedFrame(wsOpcode.ping, payload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.opcode).toBe(wsOpcode.ping);
    expect(result!.frame.fin).toBe(true);
    expect(result!.frame.payload.toString()).toBe('ping-data');
  });

  it('should parse a pong frame with payload', () => {
    const payload = Buffer.from('pong-data');
    const frame = buildMaskedFrame(wsOpcode.pong, payload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.opcode).toBe(wsOpcode.pong);
    expect(result!.frame.payload.toString()).toBe('pong-data');
  });

  it('should parse a close frame with code and reason', () => {
    const codeAndReason = Buffer.allocUnsafe(2 + 6);
    codeAndReason.writeUInt16BE(wsCloseCode.normal, 0);
    Buffer.from('bye!!\0').copy(codeAndReason, 2);
    const reasonText = 'bye!!!';
    const closePayload = Buffer.allocUnsafe(2 + reasonText.length);
    closePayload.writeUInt16BE(wsCloseCode.normal, 0);
    Buffer.from(reasonText).copy(closePayload, 2);

    const frame = buildMaskedFrame(wsOpcode.close, closePayload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.opcode).toBe(wsOpcode.close);
    const code = result!.frame.payload.readUInt16BE(0);
    const reason = result!.frame.payload.subarray(2).toString('utf8');
    expect(code).toBe(1000);
    expect(reason).toBe('bye!!!');
  });

  it('should parse a close frame with only status code (no reason)', () => {
    const closePayload = Buffer.allocUnsafe(2);
    closePayload.writeUInt16BE(wsCloseCode.goingAway, 0);

    const frame = buildMaskedFrame(wsOpcode.close, closePayload);

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.opcode).toBe(wsOpcode.close);
    expect(result!.frame.payload.length).toBe(2);
    expect(result!.frame.payload.readUInt16BE(0)).toBe(1001);
  });

  it('should parse a close frame with no payload at all', () => {
    const frame = buildMaskedFrame(wsOpcode.close, Buffer.alloc(0));

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.opcode).toBe(wsOpcode.close);
    expect(result!.frame.payload.length).toBe(0);
  });

  // ============================================
  // Zero-length payload
  // ============================================

  it('should parse a frame with zero-length payload', () => {
    const frame = buildMaskedFrame(wsOpcode.text, Buffer.alloc(0));

    const result = _parseFrame(frame, 0);
    expect(result).not.toBeNull();
    expect(result!.frame.payloadLength).toBe(0);
    expect(result!.frame.payload.length).toBe(0);
  });

  // ============================================
  // Incomplete buffer → returns null
  // ============================================

  it('should return null for an incomplete header (less than 2 bytes)', () => {
    expect(_parseFrame(Buffer.from([0x81]), 0)).toBeNull();
  });

  it('should return null for a 16-bit length frame with incomplete extended header', () => {
    // Indicates 16-bit length (126) but only 3 bytes total
    const partial = Buffer.from([0x81, 0xfe, 0x00]);
    expect(_parseFrame(partial, 0)).toBeNull();
  });

  it('should return null for a 64-bit length frame with incomplete extended header', () => {
    // Indicates 64-bit length (127) but only 6 bytes total
    const partial = Buffer.from([0x81, 0xff, 0x00, 0x00, 0x00, 0x00]);
    expect(_parseFrame(partial, 0)).toBeNull();
  });

  it('should return null when header is complete but payload is incomplete', () => {
    const payload = Buffer.from('Hello');
    const fullFrame = buildMaskedFrame(wsOpcode.text, payload);
    // Truncate the last 2 bytes
    const partial = fullFrame.subarray(0, fullFrame.length - 2);

    expect(_parseFrame(partial, 0)).toBeNull();
  });

  // ============================================
  // Multiple frames in one buffer
  // ============================================

  it('should parse multiple frames from a single buffer using bytesConsumed offset', () => {
    const frame1Payload = Buffer.from('First');
    const frame2Payload = Buffer.from('Second');
    const frame1 = buildMaskedFrame(wsOpcode.text, frame1Payload);
    const frame2 = buildMaskedFrame(wsOpcode.text, frame2Payload);
    const combined = Buffer.concat([frame1, frame2]);

    const result1 = _parseFrame(combined, 0);
    expect(result1).not.toBeNull();
    expect(result1!.frame.payload.toString()).toBe('First');
    expect(result1!.bytesConsumed).toBe(frame1.length);

    const result2 = _parseFrame(combined, result1!.bytesConsumed);
    expect(result2).not.toBeNull();
    expect(result2!.frame.payload.toString()).toBe('Second');
    expect(result2!.bytesConsumed).toBe(frame2.length);
  });

  // ============================================
  // Fragmented message frames
  // ============================================

  it('should parse fragmented frames (FIN=0 first, FIN=1 continuation)', () => {
    const frag1 = buildMaskedFrame(wsOpcode.text, Buffer.from('Hel'), false);
    const frag2 = buildMaskedFrame(wsOpcode.continuation, Buffer.from('lo'), true);
    const combined = Buffer.concat([frag1, frag2]);

    const result1 = _parseFrame(combined, 0);
    expect(result1).not.toBeNull();
    expect(result1!.frame.fin).toBe(false);
    expect(result1!.frame.opcode).toBe(wsOpcode.text);
    expect(result1!.frame.payload.toString()).toBe('Hel');

    const result2 = _parseFrame(combined, result1!.bytesConsumed);
    expect(result2).not.toBeNull();
    expect(result2!.frame.fin).toBe(true);
    expect(result2!.frame.opcode).toBe(wsOpcode.continuation);
    expect(result2!.frame.payload.toString()).toBe('lo');
  });

  // ============================================
  // Offset parameter
  // ============================================

  it('should respect the offset parameter', () => {
    const garbage = Buffer.alloc(10, 0xff);
    const frame = buildMaskedFrame(wsOpcode.text, Buffer.from('Offset'));
    const combined = Buffer.concat([garbage, frame]);

    const result = _parseFrame(combined, 10);
    expect(result).not.toBeNull();
    expect(result!.frame.payload.toString()).toBe('Offset');
  });

  it('should return null when offset is at buffer end', () => {
    const frame = buildMaskedFrame(wsOpcode.text, Buffer.from('X'));
    expect(_parseFrame(frame, frame.length)).toBeNull();
  });
});

// ============================================
// _encodeFrame — Server→client encoding
// ============================================

describe('_encodeFrame', () => {
  it('should encode a small text frame (7-bit length, no mask)', () => {
    const payload = Buffer.from('Hello');
    const frame = _encodeFrame(wsOpcode.text, payload);

    expect(frame[0]).toBe(0x80 | wsOpcode.text); // FIN=1, opcode=text
    expect(frame[1]).toBe(5); // MASK=0, length=5
    expect(frame.subarray(2).toString()).toBe('Hello');
    expect(frame.length).toBe(2 + 5);
  });

  it('should encode a frame with FIN=0 (non-final fragment)', () => {
    const payload = Buffer.from('Part');
    const frame = _encodeFrame(wsOpcode.text, payload, false);

    expect(frame[0]).toBe(wsOpcode.text); // FIN=0, opcode=text
    expect(frame.subarray(2).toString()).toBe('Part');
  });

  it('should encode a medium frame with 16-bit extended length', () => {
    const payload = Buffer.alloc(200, 0x42);
    const frame = _encodeFrame(wsOpcode.binary, payload);

    expect(frame[0]).toBe(0x80 | wsOpcode.binary);
    expect(frame[1]).toBe(126); // 16-bit extended
    expect(frame.readUInt16BE(2)).toBe(200);
    expect(frame.length).toBe(4 + 200);
    expect(frame[4]).toBe(0x42);
  });

  it('should encode a large frame with 64-bit extended length', () => {
    const payload = Buffer.alloc(70000, 0xcd);
    const frame = _encodeFrame(wsOpcode.binary, payload);

    expect(frame[0]).toBe(0x80 | wsOpcode.binary);
    expect(frame[1]).toBe(127); // 64-bit extended
    expect(frame.readUInt32BE(2)).toBe(0); // upper 32 = 0
    expect(frame.readUInt32BE(6)).toBe(70000);
    expect(frame.length).toBe(10 + 70000);
  });

  it('should never set the mask bit on server frames', () => {
    const payload = Buffer.from('NoMask');
    const frame = _encodeFrame(wsOpcode.text, payload);
    expect(frame[1]! & 0x80).toBe(0);
  });

  it('should handle empty payload', () => {
    const frame = _encodeFrame(wsOpcode.text, Buffer.alloc(0));
    expect(frame.length).toBe(2);
    expect(frame[1]).toBe(0);
  });

  it('should encode a ping frame', () => {
    const payload = Buffer.from('keepalive');
    const frame = _encodeFrame(wsOpcode.ping, payload);
    expect(frame[0]).toBe(0x80 | wsOpcode.ping);
    expect(frame.subarray(2).toString()).toBe('keepalive');
  });

  it('should roundtrip: encode then parse produces original data', () => {
    const original = Buffer.from('Roundtrip test with some data!');
    const encoded = _encodeFrame(wsOpcode.text, original);
    const parsed = _parseFrame(encoded, 0);

    expect(parsed).not.toBeNull();
    expect(parsed!.frame.payload.toString()).toBe('Roundtrip test with some data!');
    expect(parsed!.frame.opcode).toBe(wsOpcode.text);
    expect(parsed!.frame.fin).toBe(true);
    expect(parsed!.frame.masked).toBe(false);
  });

  it('should handle boundary payload length at 125 (max 7-bit)', () => {
    const payload = Buffer.alloc(125, 0x61);
    const frame = _encodeFrame(wsOpcode.text, payload);
    expect(frame[1]).toBe(125);
    expect(frame.length).toBe(2 + 125);
  });

  it('should handle boundary payload length at 126 (min 16-bit)', () => {
    const payload = Buffer.alloc(126, 0x61);
    const frame = _encodeFrame(wsOpcode.text, payload);
    expect(frame[1]).toBe(126);
    expect(frame.readUInt16BE(2)).toBe(126);
    expect(frame.length).toBe(4 + 126);
  });

  it('should handle boundary payload length at 65535 (max 16-bit)', () => {
    const payload = Buffer.alloc(65535, 0x61);
    const frame = _encodeFrame(wsOpcode.text, payload);
    expect(frame[1]).toBe(126);
    expect(frame.readUInt16BE(2)).toBe(65535);
    expect(frame.length).toBe(4 + 65535);
  });

  it('should handle boundary payload length at 65536 (min 64-bit)', () => {
    const payload = Buffer.alloc(65536, 0x61);
    const frame = _encodeFrame(wsOpcode.binary, payload);
    expect(frame[1]).toBe(127);
    expect(frame.readUInt32BE(2)).toBe(0);
    expect(frame.readUInt32BE(6)).toBe(65536);
    expect(frame.length).toBe(10 + 65536);
  });
});

// ============================================
// _encodeCloseFrame
// ============================================

describe('_encodeCloseFrame', () => {
  it('should encode a close frame with code and reason', () => {
    const frame = _encodeCloseFrame(wsCloseCode.normal, 'goodbye');
    const parsed = _parseFrame(frame, 0);

    expect(parsed).not.toBeNull();
    expect(parsed!.frame.opcode).toBe(wsOpcode.close);
    expect(parsed!.frame.fin).toBe(true);
    expect(parsed!.frame.payload.readUInt16BE(0)).toBe(1000);
    expect(parsed!.frame.payload.subarray(2).toString('utf8')).toBe('goodbye');
  });

  it('should encode a close frame with code only (no reason)', () => {
    const frame = _encodeCloseFrame(wsCloseCode.goingAway);
    const parsed = _parseFrame(frame, 0);

    expect(parsed).not.toBeNull();
    expect(parsed!.frame.payload.length).toBe(2);
    expect(parsed!.frame.payload.readUInt16BE(0)).toBe(1001);
  });

  it('should truncate reason to fit within 125-byte control frame payload limit', () => {
    const longReason = 'A'.repeat(200);
    const frame = _encodeCloseFrame(wsCloseCode.normal, longReason);
    const parsed = _parseFrame(frame, 0);

    expect(parsed).not.toBeNull();
    // 2 bytes for code + max 123 bytes for reason = 125 total
    expect(parsed!.frame.payload.length).toBeLessThanOrEqual(125);
    expect(parsed!.frame.payload.readUInt16BE(0)).toBe(1000);
  });

  it('should encode different close codes correctly', () => {
    for (const [, code] of Object.entries(wsCloseCode)) {
      const frame = _encodeCloseFrame(code);
      const parsed = _parseFrame(frame, 0);
      expect(parsed).not.toBeNull();
      expect(parsed!.frame.payload.readUInt16BE(0)).toBe(code);
    }
  });
});
