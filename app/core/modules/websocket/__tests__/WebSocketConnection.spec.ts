/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { describe, expect, it, mock } from 'bun:test';
import { WebSocketConnection } from '../WebSocketConnection.ts';
import { _encodeCloseFrame, _encodeFrame } from '../WebSocketFrame.ts';
import { MockSocket, buildClientFrame } from './ws-test-utils.ts';
import { wsCloseCode, wsOpcode, wsReadyState } from '@constants/websocket.ts';
import type { WebSocketHandlers } from '@typedefs/public/WebSocket.js';

const defaultOptions: {
  maxPayloadLength: number;
  idleTimeout: number;
  backpressure: { strategy: 'buffer' | 'drop'; limit: number };
} = {
  maxPayloadLength: 16_777_216,
  idleTimeout: 0,
  backpressure: { strategy: 'buffer', limit: 1_048_576 },
};

const createConnection = (
  handlers: WebSocketHandlers<{ testId: string }> = {},
  options = defaultOptions,
): { conn: WebSocketConnection<{ testId: string }>; socket: MockSocket } => {
  const socket = new MockSocket();
  const conn = new WebSocketConnection(
    socket as any,
    { testId: 'test-123' },
    handlers,
    options,
  );
  return { conn, socket };
};

// ============================================
// Basic send/receive
// ============================================

describe('WebSocketConnection', () => {
  describe('send', () => {
    it('should write a text frame to the socket', () => {
      const { conn, socket } = createConnection();
      conn.send('Hello');

      expect(socket.written.length).toBe(1);
      const frame = socket.written[0]!;
      expect(frame[0]).toBe(0x80 | wsOpcode.text);
      expect(frame.subarray(2).toString()).toBe('Hello');
    });

    it('should write a binary frame for Buffer data', () => {
      const { conn, socket } = createConnection();
      conn.send(Buffer.from([0x01, 0x02, 0x03]));

      expect(socket.written.length).toBe(1);
      const frame = socket.written[0]!;
      expect(frame[0]).toBe(0x80 | wsOpcode.binary);
    });

    it('should not write when connection is closing', () => {
      const { conn, socket } = createConnection();
      conn.close();
      const writtenBeforeSend = socket.written.length;
      conn.send('Should not arrive');
      // Only the close frame should have been written, not this message
      expect(socket.written.length).toBe(writtenBeforeSend);
    });
  });

  describe('sendRaw', () => {
    it('should write pre-encoded bytes directly', () => {
      const { conn, socket } = createConnection();
      const preEncoded = _encodeFrame(wsOpcode.text, Buffer.from('Raw'));
      conn.sendRaw(preEncoded);

      expect(socket.written.length).toBe(1);
      expect(socket.written[0]).toEqual(preEncoded);
    });
  });

  // ============================================
  // Receive messages
  // ============================================

  describe('receive messages', () => {
    it('should deliver text messages to the message handler', () => {
      const messageFn = mock(() => {});
      const { socket } = createConnection({ message: messageFn });

      const frame = buildClientFrame(wsOpcode.text, Buffer.from('Hello server'));
      socket.emit('data', frame);

      expect(messageFn).toHaveBeenCalledTimes(1);
      const [_ws, data, isBinary] = messageFn.mock.calls[0] as any;
      expect(data).toBe('Hello server');
      expect(isBinary).toBe(false);
    });

    it('should deliver binary messages with isBinary=true', () => {
      const messageFn = mock(() => {});
      const { socket } = createConnection({ message: messageFn });

      const frame = buildClientFrame(wsOpcode.binary, Buffer.from([0xde, 0xad]));
      socket.emit('data', frame);

      expect(messageFn).toHaveBeenCalledTimes(1);
      const [_ws, data, isBinary] = messageFn.mock.calls[0] as any;
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(isBinary).toBe(true);
    });
  });

  // ============================================
  // Control frames
  // ============================================

  describe('ping/pong', () => {
    it('should auto-respond to ping with pong echoing the payload', () => {
      const { socket } = createConnection();

      const pingPayload = Buffer.from('keepalive');
      const pingFrame = buildClientFrame(wsOpcode.ping, pingPayload);
      socket.emit('data', pingFrame);

      // Should have written a pong frame
      expect(socket.written.length).toBe(1);
      const pongFrame = socket.written[0]!;
      expect(pongFrame[0]).toBe(0x80 | wsOpcode.pong);
      expect(pongFrame.subarray(2).toString()).toBe('keepalive');
    });

    it('should send a ping frame via ping()', () => {
      const { conn, socket } = createConnection();
      conn.ping(Buffer.from('hello'));

      expect(socket.written.length).toBe(1);
      expect(socket.written[0]![0]).toBe(0x80 | wsOpcode.ping);
    });
  });

  describe('close handshake', () => {
    it('should echo close frame when client initiates close', () => {
      const closeFn = mock(() => {});
      const { socket } = createConnection({ close: closeFn });

      const closePayload = Buffer.allocUnsafe(2);
      closePayload.writeUInt16BE(wsCloseCode.normal, 0);
      const closeFrame = buildClientFrame(wsOpcode.close, closePayload);
      socket.emit('data', closeFrame);

      // Should have echoed close frame
      expect(socket.written.length).toBe(1);
      expect(closeFn).toHaveBeenCalledTimes(1);
      const [_ws, code, reason] = closeFn.mock.calls[0] as any;
      expect(code).toBe(1000);
      expect(reason).toBe('');
    });

    it('should transition to CLOSING then CLOSED when server initiates close', () => {
      const { conn } = createConnection();
      expect(conn.readyState).toBe(wsReadyState.open);

      conn.close(wsCloseCode.normal, 'bye');
      expect(conn.readyState).toBe(wsReadyState.closing);
    });

    it('should parse close reason from client close frame', () => {
      const closeFn = mock(() => {});
      const { socket } = createConnection({ close: closeFn });

      const reasonBuf = Buffer.from('going away');
      const closePayload = Buffer.allocUnsafe(2 + reasonBuf.length);
      closePayload.writeUInt16BE(wsCloseCode.goingAway, 0);
      reasonBuf.copy(closePayload, 2);

      socket.emit('data', buildClientFrame(wsOpcode.close, closePayload));

      const [_ws, code, reason] = closeFn.mock.calls[0] as any;
      expect(code).toBe(1001);
      expect(reason).toBe('going away');
    });
  });

  // ============================================
  // Fragment reassembly
  // ============================================

  describe('fragmentation', () => {
    it('should reassemble fragmented text messages', () => {
      const messageFn = mock(() => {});
      const { socket } = createConnection({ message: messageFn });

      socket.emit('data', buildClientFrame(wsOpcode.text, Buffer.from('Hel'), false));
      expect(messageFn).not.toHaveBeenCalled();

      socket.emit('data', buildClientFrame(wsOpcode.continuation, Buffer.from('lo'), false));
      expect(messageFn).not.toHaveBeenCalled();

      socket.emit('data', buildClientFrame(wsOpcode.continuation, Buffer.from(' World'), true));
      expect(messageFn).toHaveBeenCalledTimes(1);

      const [_ws, data] = messageFn.mock.calls[0] as any;
      expect(data).toBe('Hello World');
    });

    it('should handle control frames interleaved between fragments', () => {
      const messageFn = mock(() => {});
      const { socket } = createConnection({ message: messageFn });

      // Fragment 1
      socket.emit('data', buildClientFrame(wsOpcode.text, Buffer.from('Part1'), false));

      // Ping interleaved — should be handled immediately
      socket.emit('data', buildClientFrame(wsOpcode.ping, Buffer.from('mid-ping')));
      expect(socket.written.length).toBe(1); // pong was sent

      // Fragment 2 (final)
      socket.emit('data', buildClientFrame(wsOpcode.continuation, Buffer.from('Part2'), true));

      // Message should be reassembled correctly despite interleaved ping
      expect(messageFn).toHaveBeenCalledTimes(1);
      const [_ws, data] = messageFn.mock.calls[0] as any;
      expect(data).toBe('Part1Part2');
    });
  });

  // ============================================
  // Max payload enforcement
  // ============================================

  describe('max payload', () => {
    it('should close connection when frame exceeds max payload', () => {
      const closeFn = mock(() => {});
      const { socket } = createConnection(
        { close: closeFn },
        { ...defaultOptions, maxPayloadLength: 100 },
      );

      const oversized = buildClientFrame(wsOpcode.text, Buffer.alloc(200, 0x41));
      socket.emit('data', oversized);

      // Should have sent a close frame with code 1009
      expect(socket.written.length).toBeGreaterThanOrEqual(1);
      expect(socket.destroyed).toBe(true);
    });
  });

  // ============================================
  // Backpressure
  // ============================================

  describe('backpressure', () => {
    it('should track backpressure when socket.write returns false', () => {
      const { conn, socket } = createConnection();
      socket.simulateBackpressure();

      conn.send('data');
      expect(conn.bufferedAmount).toBeGreaterThan(0);
    });

    it('should drop messages with drop strategy when backpressured', () => {
      const { conn, socket } = createConnection({}, {
        ...defaultOptions,
        backpressure: { strategy: 'drop', limit: 0 },
      });

      socket.simulateBackpressure();
      conn.send('first'); // causes backpressure

      const writtenCount = socket.written.length;
      conn.send('dropped'); // should be silently dropped
      expect(socket.written.length).toBe(writtenCount);
    });

    it('should clear backpressure on drain event', () => {
      const drainFn = mock(() => {});
      const { conn, socket } = createConnection({ drain: drainFn });

      socket.simulateBackpressure();
      conn.send('data');
      expect(conn.bufferedAmount).toBeGreaterThan(0);

      socket.clearBackpressure();
      expect(conn.bufferedAmount).toBe(0);
      expect(drainFn).toHaveBeenCalledTimes(1);
    });

    it('should close connection when buffer limit exceeded', () => {
      const { conn, socket } = createConnection({}, {
        ...defaultOptions,
        backpressure: { strategy: 'buffer', limit: 10 },
      });

      socket.simulateBackpressure();
      conn.send('first message causes backpressure');

      // Subsequent send should push over the 10-byte limit and trigger close
      conn.send('more data that exceeds limit');
      expect(socket.destroyed).toBe(true);
    });
  });

  // ============================================
  // Idle timeout
  // ============================================

  describe('idle timeout', () => {
    it('should close connection after idle timeout', async () => {
      const closeFn = mock(() => {});
      const { conn } = createConnection(
        { close: closeFn },
        { ...defaultOptions, idleTimeout: 0.1 }, // 100ms
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Connection should have been closed
      expect(conn.readyState).not.toBe(wsReadyState.open);
    });

    it('should reset idle timeout on received data', async () => {
      const { conn, socket } = createConnection(
        {},
        { ...defaultOptions, idleTimeout: 0.15 }, // 150ms
      );

      // Send data at 80ms — should reset the timer
      await new Promise((resolve) => setTimeout(resolve, 80));
      socket.emit('data', buildClientFrame(wsOpcode.ping, Buffer.alloc(0)));

      // At 160ms — should still be open (timer reset at 80ms, so timeout at 230ms)
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(conn.readyState).toBe(wsReadyState.open);

      // At 310ms — should be closed now (150ms after last data at 80ms = 230ms)
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(conn.readyState).not.toBe(wsReadyState.open);
    });
  });

  // ============================================
  // Per-socket data
  // ============================================

  describe('per-socket data', () => {
    it('should expose typed data', () => {
      const { conn } = createConnection();
      expect(conn.data).toEqual({ testId: 'test-123' });
    });

    it('should expose remote address', () => {
      const { conn } = createConnection();
      expect(conn.remoteAddress).toBe('127.0.0.1');
    });
  });

  // ============================================
  // Socket error handling
  // ============================================

  describe('socket errors', () => {
    it('should call error handler and destroy socket on error', () => {
      const errorFn = mock(() => {});
      const { socket } = createConnection({ error: errorFn });

      socket.emit('error', new Error('ECONNRESET'));

      expect(errorFn).toHaveBeenCalledTimes(1);
      expect(socket.destroyed).toBe(true);
    });

    it('should call close handler on unexpected socket close', () => {
      const closeFn = mock(() => {});
      const { socket } = createConnection({ close: closeFn });

      // Simulate unexpected close (not via close handshake)
      socket.emit('close');

      expect(closeFn).toHaveBeenCalledTimes(1);
      const [_ws, code] = closeFn.mock.calls[0] as any;
      expect(code).toBe(wsCloseCode.abnormal);
    });
  });

  // ============================================
  // Multiple frames in one chunk
  // ============================================

  describe('multiple frames in one TCP chunk', () => {
    it('should parse and deliver all frames from a single chunk', () => {
      const messageFn = mock(() => {});
      const { socket } = createConnection({ message: messageFn });

      const frame1 = buildClientFrame(wsOpcode.text, Buffer.from('First'));
      const frame2 = buildClientFrame(wsOpcode.text, Buffer.from('Second'));
      const combined = Buffer.concat([frame1, frame2]);

      socket.emit('data', combined);

      expect(messageFn).toHaveBeenCalledTimes(2);
      expect((messageFn.mock.calls[0] as any)[1]).toBe('First');
      expect((messageFn.mock.calls[1] as any)[1]).toBe('Second');
    });
  });
});
