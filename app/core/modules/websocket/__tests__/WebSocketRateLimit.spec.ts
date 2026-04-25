/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { describe, expect, it } from 'bun:test';
import { WebSocketConnection } from '../WebSocketConnection.ts';
import { wsCloseCode, wsOpcode, wsReadyState } from '@constants/websocket.ts';
import { MockSocket, buildClientFrame } from './ws-test-utils.ts';
import type { WebSocketHandlers } from '@typedefs/public/WebSocket.js';

const createConnection = (
  rateLimitConfig: { enabled: boolean; maxMessages: number; window: number },
  handlers: WebSocketHandlers<{ testId: string }> = {},
): { conn: WebSocketConnection<{ testId: string }>; socket: MockSocket } => {
  const socket = new MockSocket();
  const conn = new WebSocketConnection(socket as never, { testId: 'rl-test' }, handlers, {
    maxPayloadLength: 16_777_216,
    idleTimeout: 0,
    backpressure: { strategy: 'buffer', limit: 1_048_576 },
    heartbeatInterval: 0,
    messageRateLimit: rateLimitConfig,
  });
  return { conn, socket };
};

const sendTextMessage = (socket: MockSocket, text: string): void => {
  const frame = buildClientFrame(wsOpcode.text, Buffer.from(text));
  socket.emit('data', frame);
};

describe('WebSocket Message Rate Limiting', () => {
  describe('when disabled', () => {
    it('should allow unlimited messages', () => {
      const messages: Array<string> = [];
      const { socket } = createConnection(
        { enabled: false, maxMessages: 2, window: 10 },
        { message: (_ws, data) => messages.push(data as string) },
      );

      for (let i = 0; i < 10; i++) {
        sendTextMessage(socket, `msg-${i}`);
      }

      expect(messages.length).toBe(10);
    });
  });

  describe('when enabled', () => {
    it('should allow messages within the limit', () => {
      const messages: Array<string> = [];
      const { socket } = createConnection(
        { enabled: true, maxMessages: 5, window: 10 },
        { message: (_ws, data) => messages.push(data as string) },
      );

      for (let i = 0; i < 5; i++) {
        sendTextMessage(socket, `msg-${i}`);
      }

      expect(messages.length).toBe(5);
    });

    it('should close connection with 1008 when limit exceeded', () => {
      const messages: Array<string> = [];
      const { conn, socket } = createConnection(
        { enabled: true, maxMessages: 3, window: 60 },
        { message: (_ws, data) => messages.push(data as string) },
      );

      for (let i = 0; i < 5; i++) {
        sendTextMessage(socket, `msg-${i}`);
      }

      // Only 3 messages delivered before rate limit hit
      expect(messages.length).toBe(3);
      // Connection should be closing/closed
      expect(conn.readyState).not.toBe(wsReadyState.open);
      // Close frame was sent with policy violation code
      const closeFrames = socket.written.filter((buf) => (buf[0]! & 0x0f) === wsOpcode.close);
      expect(closeFrames.length).toBeGreaterThanOrEqual(1);
      const closePayload = closeFrames[0]!;
      const closeCode = closePayload.readUInt16BE(2);
      expect(closeCode).toBe(wsCloseCode.policyViolation);
    });

    it('should refill tokens over time', async () => {
      const messages: Array<string> = [];
      const { conn, socket } = createConnection(
        { enabled: true, maxMessages: 2, window: 1 },
        { message: (_ws, data) => messages.push(data as string) },
      );

      // Send 2 messages (exhausts tokens)
      sendTextMessage(socket, 'msg-1');
      sendTextMessage(socket, 'msg-2');
      expect(messages.length).toBe(2);

      // Wait for token refill (1 second window, 2 tokens → 1 token per 500ms)
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should have at least 1 token refilled
      sendTextMessage(socket, 'msg-3');
      expect(messages.length).toBe(3);
      expect(conn.readyState).toBe(wsReadyState.open);
    });

    it('should handle burst followed by steady rate', async () => {
      const messages: Array<string> = [];
      const { conn, socket } = createConnection(
        { enabled: true, maxMessages: 3, window: 1 },
        { message: (_ws, data) => messages.push(data as string) },
      );

      // Burst: send all 3 at once
      sendTextMessage(socket, 'burst-1');
      sendTextMessage(socket, 'burst-2');
      sendTextMessage(socket, 'burst-3');
      expect(messages.length).toBe(3);

      // Wait for partial refill
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Should have ~1 token back (3 tokens / 1s window × 0.4s ≈ 1.2)
      sendTextMessage(socket, 'steady-1');
      expect(messages.length).toBe(4);
      expect(conn.readyState).toBe(wsReadyState.open);
    });

    it('should not rate limit control frames (ping/pong)', () => {
      const { conn, socket } = createConnection(
        { enabled: true, maxMessages: 1, window: 60 },
      );

      // Exhaust the single token
      sendTextMessage(socket, 'msg-1');

      // Send pings — they should be handled (auto-pong) even though rate limit is exhausted
      const pingFrame = buildClientFrame(wsOpcode.ping, Buffer.from('test'));
      socket.emit('data', pingFrame);

      // Connection should still be open (ping doesn't trigger rate limit close)
      // The close only happens on the next DATA message, not on control frames
      expect(conn.readyState).toBe(wsReadyState.open);

      // Pong response should have been sent
      const pongFrames = socket.written.filter((buf) => (buf[0]! & 0x0f) === wsOpcode.pong);
      expect(pongFrames.length).toBe(1);
    });

    it('should close connection when tokens fully exhausted', () => {
      const messages: Array<string> = [];
      const { conn, socket } = createConnection(
        { enabled: true, maxMessages: 1, window: 60 },
        { message: (_ws, data) => messages.push(data as string) },
      );

      sendTextMessage(socket, 'allowed');
      expect(messages.length).toBe(1);

      sendTextMessage(socket, 'denied');
      expect(messages.length).toBe(1);
      expect(conn.readyState).not.toBe(wsReadyState.open);
    });
  });

  describe('config validation', () => {
    it('should accept valid rate limit configuration', () => {
      const { _validateWebSocketConfig } = require('../WebSocketConfig.ts');
      const { DEFAULT_WEBSOCKET_CONFIG } = require('../WebSocketConfig.ts');
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          messageRateLimit: { enabled: true, maxMessages: 50, window: 5 },
        });
      }).not.toThrow();
    });

    it('should reject maxMessages < 1', () => {
      const { _validateWebSocketConfig } = require('../WebSocketConfig.ts');
      const { DEFAULT_WEBSOCKET_CONFIG } = require('../WebSocketConfig.ts');
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          messageRateLimit: { enabled: true, maxMessages: 0, window: 5 },
        });
      }).toThrow('maxMessages must be an integer >= 1');
    });

    it('should reject non-integer maxMessages', () => {
      const { _validateWebSocketConfig } = require('../WebSocketConfig.ts');
      const { DEFAULT_WEBSOCKET_CONFIG } = require('../WebSocketConfig.ts');
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          messageRateLimit: { enabled: true, maxMessages: 2.5, window: 5 },
        });
      }).toThrow('maxMessages must be an integer >= 1');
    });

    it('should reject window < 1', () => {
      const { _validateWebSocketConfig } = require('../WebSocketConfig.ts');
      const { DEFAULT_WEBSOCKET_CONFIG } = require('../WebSocketConfig.ts');
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          messageRateLimit: { enabled: true, maxMessages: 10, window: 0 },
        });
      }).toThrow('window must be an integer >= 1');
    });

    it('should skip validation when disabled', () => {
      const { _validateWebSocketConfig } = require('../WebSocketConfig.ts');
      const { DEFAULT_WEBSOCKET_CONFIG } = require('../WebSocketConfig.ts');
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          messageRateLimit: { enabled: false, maxMessages: 0, window: 0 },
        });
      }).not.toThrow();
    });
  });
});
