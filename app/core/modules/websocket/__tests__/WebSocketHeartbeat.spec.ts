/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { describe, expect, it, spyOn } from 'bun:test';
import { WebSocketConnection } from '../WebSocketConnection.ts';
import { MockSocket, buildClientFrame } from './ws-test-utils.ts';
import { wsCloseCode, wsOpcode, wsReadyState } from '@constants/websocket.ts';
import type { WebSocketHandlers, WebSocketRouteOptions } from '@typedefs/public/WebSocket.js';
import { YinzerFlow } from '@core/YinzerFlow.ts';
import { log } from '@core/utils/log.ts';

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
    compression: { enabled: false, level: 1, threshold: 128, serverMaxWindowBits: 11 },
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

  // Bug (0.10.x): with idleTimeout at or below the heartbeat interval a listen-only client is closed for idleness before
  // the next ping keeps it alive, and nothing said so at startup or on app.ws(). Tier: Medium (config warning a user acts on).
  describe('idleTimeout at or below the heartbeat interval', () => {
    it.each([
      ['global idleTimeout equal to the interval', { idleTimeout: 30 }, undefined, true],
      ['global idleTimeout below the interval', { idleTimeout: 10, heartbeat: { interval: 30 } }, undefined, true],
      ['global idleTimeout above the interval', { idleTimeout: 31 }, undefined, false],
      ['global idleTimeout 0 (no timeout)', { idleTimeout: 0 }, undefined, false],
      ['heartbeat disabled (warned separately)', { idleTimeout: 10, heartbeat: { enabled: false } }, undefined, false],
      ['a route idleTimeout below the global interval', {}, { idleTimeout: 20 }, true],
      ['a route that turns its heartbeat off', {}, { idleTimeout: 20, heartbeatInterval: 0 }, false],
      ['a route idleTimeout above the global interval', {}, { idleTimeout: 60 }, false],
    ] as const)('%s', (_label, websocket, routeOptions, shouldWarn) => {
      // Config warnings go to the module logger, route warnings to the app's logger; collect both
      const warn = spyOn(log, 'warn').mockImplementation(() => {});
      const appWarnings: Array<string> = [];
      const logger = { info: () => {}, error: () => {}, warn: (...args: Array<unknown>) => void appWarnings.push(args.map(String).join(' ')) };
      try {
        const app = new YinzerFlow({ websocket: { ...websocket }, logging: { logger } });
        app.ws('/ws', {}, routeOptions as WebSocketRouteOptions | undefined);
        const messages = [...warn.mock.calls.map((call) => String(call[0])), ...appWarnings];
        const warned = messages.some((message) => message.includes('below the heartbeat'));
        expect(warned).toBe(shouldWarn);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
