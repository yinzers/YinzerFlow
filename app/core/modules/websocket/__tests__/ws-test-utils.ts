/* eslint-disable no-bitwise, @typescript-eslint/no-non-null-assertion */
import { EventEmitter } from 'events';

/**
 * Build a masked client WebSocket frame (simulates what a real browser sends).
 * Used across all WS test files — single source of truth.
 */
export const buildClientFrame = (opcode: number, payload: Buffer, fin = true): Buffer => {
  const maskKey = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) {
    masked[i] = masked[i]! ^ maskKey[i & 3]!;
  }

  const payloadLength = payload.length;
  let headerSize = 2;
  if (payloadLength >= 126 && payloadLength < 65536) headerSize = 4;
  else if (payloadLength >= 65536) headerSize = 10;

  const frame = Buffer.allocUnsafe(headerSize + 4 + payloadLength);
  frame[0] = (fin ? 0x80 : 0x00) | opcode;

  if (payloadLength < 126) {
    frame[1] = 0x80 | payloadLength;
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
 * Build an unmasked server frame (for testing server→client encoding).
 */
export const buildUnmaskedFrame = (opcode: number, payload: Buffer, fin = true): Buffer => {
  const payloadLength = payload.length;
  let headerSize = 2;
  if (payloadLength >= 126 && payloadLength < 65536) headerSize = 4;
  else if (payloadLength >= 65536) headerSize = 10;

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

/**
 * Mock socket that extends EventEmitter to simulate net.Socket behavior.
 */
export class MockSocket extends EventEmitter {
  destroyed = false;
  written: Array<Buffer> = [];
  remoteAddress = '127.0.0.1';
  private _shouldBackpressure = false;

  write(data: Buffer | string): boolean {
    if (this.destroyed) return false;
    this.written.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return !this._shouldBackpressure;
  }

  destroy(): void {
    this.destroyed = true;
    this.emit('close');
  }

  simulateBackpressure(): void {
    this._shouldBackpressure = true;
  }

  clearBackpressure(): void {
    this._shouldBackpressure = false;
    this.emit('drain');
  }
}
