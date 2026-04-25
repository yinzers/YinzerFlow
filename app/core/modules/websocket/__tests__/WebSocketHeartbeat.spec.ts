/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { WebSocketConnection } from '../WebSocketConnection.ts';
import { MockSocket, buildClientFrame } from './ws-test-utils.ts';
import { wsCloseCode, wsOpcode, wsReadyState } from '@constants/websocket.ts';
import type { WebSocketHandlers } from '@typedefs/public/WebSocket.js';

const createConnection = (
  handlers: WebSocketHandlers<{ testId: string }> = {},
  heartbeatInterval = 30,
): { conn: WebSocketConnection<{ testId: string }>; socket: MockSocket } => {
  const socket = new MockSocket();
  const conn = new WebSocketConnection(socket as never, { testId: 'hb-test' }, handlers, {
    maxPayloadLength: 16_777_216,
    idleTimeout: 0,
    backpressure: { strategy: 'buffer', limit: 1_048_576 },
    heartbeatInterval,
    messageRateLimit: { enabled: false, maxMessages: 100, window: 10 },
  });
  return { conn, socket };
};

describe('WebSocket Heartbeat', () => {
  describe('liveness tracking', () => {
    it('should start with _isAlive = true', () => {
      const { conn } = createConnection();
      expect(conn._isAlive).toBe(true);
    });

    it('should set _isAlive = true on pong receipt', () => {
      const { conn, socket } = createConnection();
      conn._isAlive = false;

      const pongFrame = buildClientFrame(wsOpcode.pong, Buffer.alloc(0));
      socket.emit('data', pongFrame);

      expect(conn._isAlive).toBe(true);
    });

    it('should set _isAlive = true on any data receipt', () => {
      const { conn, socket } = createConnection();
      conn._isAlive = false;

      const textFrame = buildClientFrame(wsOpcode.text, Buffer.from('hello'));
      socket.emit('data', textFrame);

      expect(conn._isAlive).toBe(true);
    });

    it('should set _isAlive = true on pong with payload', () => {
      const { conn, socket } = createConnection();
      conn._isAlive = false;

      const pongFrame = buildClientFrame(wsOpcode.pong, Buffer.from('payload'));
      socket.emit('data', pongFrame);

      expect(conn._isAlive).toBe(true);
    });
  });

  describe('_heartbeatEnabled', () => {
    it('should be true when heartbeatInterval > 0', () => {
      const { conn } = createConnection({}, 30);
      expect(conn._heartbeatEnabled).toBe(true);
    });

    it('should be false when heartbeatInterval = 0', () => {
      const { conn } = createConnection({}, 0);
      expect(conn._heartbeatEnabled).toBe(false);
    });
  });

  describe('sweep simulation', () => {
    it('should detect dead connection when _isAlive is false', () => {
      const { conn, socket } = createConnection();

      conn._isAlive = false;

      // Sweep would check _isAlive and close — simulate that action
      conn.close(wsCloseCode.normal, 'Heartbeat timeout');

      expect(conn.readyState).toBe(wsReadyState.closing);
      // Close frame was written to socket
      const closeFrame = socket.written[socket.written.length - 1]!;
      expect(closeFrame[0]! & 0x0f).toBe(wsOpcode.close);
    });

    it('should allow alive connection to continue after sweep resets _isAlive', () => {
      const { conn, socket } = createConnection();

      // Sweep: mark not alive, send ping
      conn._isAlive = false;
      conn.ping();

      // Verify ping was sent (server→client ping frame)
      const lastWrite = socket.written[socket.written.length - 1]!;
      expect(lastWrite[0]! & 0x0f).toBe(wsOpcode.ping);

      // Client responds with pong
      const pongFrame = buildClientFrame(wsOpcode.pong, Buffer.alloc(0));
      socket.emit('data', pongFrame);

      // Connection should be alive again
      expect(conn._isAlive).toBe(true);
    });

    it('should detect dead connection when pong never arrives', () => {
      const { conn } = createConnection();

      // Sweep 1: mark not alive, send ping
      conn._isAlive = false;
      conn.ping();

      // No pong arrives...

      // Sweep 2: still not alive → dead
      expect(conn._isAlive).toBe(false);
    });
  });

  describe('ping method', () => {
    it('should send a ping frame', () => {
      const { conn, socket } = createConnection();
      conn.ping();

      expect(socket.written.length).toBe(1);
      const frame = socket.written[0]!;
      expect(frame[0]! & 0x0f).toBe(wsOpcode.ping);
    });

    it('should send ping with custom payload', () => {
      const { conn, socket } = createConnection();
      const payload = Buffer.from('keepalive');
      conn.ping(payload);

      expect(socket.written.length).toBe(1);
      const frame = socket.written[0]!;
      expect(frame[0]! & 0x0f).toBe(wsOpcode.ping);
      expect(frame.subarray(2).toString()).toBe('keepalive');
    });

    it('should not send ping when connection is closing', () => {
      const { conn, socket } = createConnection();
      conn.close();
      const writtenCount = socket.written.length;
      conn.ping();
      expect(socket.written.length).toBe(writtenCount);
    });
  });
});
