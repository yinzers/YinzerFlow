/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { describe, expect, it, mock } from 'bun:test';
import { WebSocketChannelManager } from '../WebSocketChannelManager.ts';
import { WebSocketConnection } from '../WebSocketConnection.ts';
import { _encodeFrame } from '../WebSocketFrame.ts';
import { MockSocket } from './ws-test-utils.ts';
import { wsOpcode } from '@constants/websocket.ts';

const createTestConnection = (): { conn: WebSocketConnection; socket: MockSocket } => {
  const socket = new MockSocket();
  const conn = new WebSocketConnection(
    socket as any,
    {},
    {},
    { maxPayloadLength: 16_777_216, idleTimeout: 0, backpressure: { strategy: 'buffer', limit: 1_048_576 }, heartbeatInterval: 0, messageRateLimit: { enabled: false, maxMessages: 100, window: 10 }, compression: { enabled: false, level: 1, threshold: 128, serverMaxWindowBits: 11, clientMaxWindowBits: 15 } },
  );
  return { conn, socket };
};

describe('WebSocketChannelManager', () => {
  describe('subscribe', () => {
    it('should add connection to channel subscriber set', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'quotes');

      expect(manager.subscriberCount('quotes')).toBe(1);
    });

    it('should track which channels a connection is subscribed to', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'quotes');
      manager.subscribe(conn, 'trades');

      expect(manager.isSubscribed(conn, 'quotes')).toBe(true);
      expect(manager.isSubscribed(conn, 'trades')).toBe(true);
      expect(manager.isSubscribed(conn, 'orders')).toBe(false);
    });

    it('should handle multiple connections on the same channel', () => {
      const manager = new WebSocketChannelManager();
      const { conn: conn1 } = createTestConnection();
      const { conn: conn2 } = createTestConnection();
      manager.subscribe(conn1, 'quotes');
      manager.subscribe(conn2, 'quotes');

      expect(manager.subscriberCount('quotes')).toBe(2);
    });
  });

  describe('unsubscribe', () => {
    it('should remove connection from channel', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'quotes');
      manager.unsubscribe(conn, 'quotes');

      expect(manager.subscriberCount('quotes')).toBe(0);
      expect(manager.isSubscribed(conn, 'quotes')).toBe(false);
    });

    it('should delete empty channels (no memory leak)', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'temp-channel');
      manager.unsubscribe(conn, 'temp-channel');

      expect(manager.channels()).not.toContain('temp-channel');
    });

    it('should not throw for unsubscribing from non-existent channel', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      expect(() => manager.unsubscribe(conn, 'nope')).not.toThrow();
    });
  });

  describe('unsubscribeAll', () => {
    it('should remove connection from all channels', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'quotes');
      manager.subscribe(conn, 'trades');
      manager.subscribe(conn, 'orders');

      manager.unsubscribeAll(conn);

      expect(manager.isSubscribed(conn, 'quotes')).toBe(false);
      expect(manager.isSubscribed(conn, 'trades')).toBe(false);
      expect(manager.isSubscribed(conn, 'orders')).toBe(false);
    });

    it('should clean up empty channels after unsubscribeAll', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'solo-channel');

      manager.unsubscribeAll(conn);

      expect(manager.channels()).toEqual([]);
    });

    it('should not affect other connections on shared channels', () => {
      const manager = new WebSocketChannelManager();
      const { conn: conn1 } = createTestConnection();
      const { conn: conn2 } = createTestConnection();
      manager.subscribe(conn1, 'shared');
      manager.subscribe(conn2, 'shared');

      manager.unsubscribeAll(conn1);

      expect(manager.subscriberCount('shared')).toBe(1);
      expect(manager.isSubscribed(conn2, 'shared')).toBe(true);
    });

    it('should not throw for connection with no subscriptions', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      expect(() => manager.unsubscribeAll(conn)).not.toThrow();
    });
  });

  describe('publish', () => {
    it('should send encoded frame to all subscribers via sendRaw', () => {
      const manager = new WebSocketChannelManager();
      const { conn: conn1, socket: sock1 } = createTestConnection();
      const { conn: conn2, socket: sock2 } = createTestConnection();
      manager.subscribe(conn1, 'quotes');
      manager.subscribe(conn2, 'quotes');

      const count = manager.publish('quotes', '{"price":42.50}');

      expect(count).toBe(2);
      expect(sock1.written.length).toBe(1);
      expect(sock2.written.length).toBe(1);
    });

    it('should encode the frame only once (same Buffer reference to all subscribers)', () => {
      const manager = new WebSocketChannelManager();
      const { conn: conn1, socket: sock1 } = createTestConnection();
      const { conn: conn2, socket: sock2 } = createTestConnection();
      manager.subscribe(conn1, 'quotes');
      manager.subscribe(conn2, 'quotes');

      manager.publish('quotes', 'identical-data');

      // Both subscribers should receive the exact same Buffer object (not copies)
      expect(sock1.written[0]).toBe(sock2.written[0]);
    });

    it('should exclude sender from broadcast', () => {
      const manager = new WebSocketChannelManager();
      const { conn: sender, socket: senderSock } = createTestConnection();
      const { conn: receiver, socket: receiverSock } = createTestConnection();
      manager.subscribe(sender, 'chat');
      manager.subscribe(receiver, 'chat');

      const count = manager.publish('chat', 'hello', sender);

      expect(count).toBe(1);
      expect(senderSock.written.length).toBe(0);
      expect(receiverSock.written.length).toBe(1);
    });

    it('should return 0 for non-existent channel', () => {
      const manager = new WebSocketChannelManager();
      expect(manager.publish('nonexistent', 'data')).toBe(0);
    });

    it('should return 0 for empty channel', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'temp');
      manager.unsubscribe(conn, 'temp');

      expect(manager.publish('temp', 'data')).toBe(0);
    });

    it('should encode text messages with text opcode', () => {
      const manager = new WebSocketChannelManager();
      const { conn, socket } = createTestConnection();
      manager.subscribe(conn, 'ch');

      manager.publish('ch', 'text message');

      const frame = socket.written[0]!;
      expect(frame[0]).toBe(0x80 | wsOpcode.text);
    });

    it('should encode binary messages with binary opcode', () => {
      const manager = new WebSocketChannelManager();
      const { conn, socket } = createTestConnection();
      manager.subscribe(conn, 'ch');

      manager.publish('ch', Buffer.from([0xde, 0xad]));

      const frame = socket.written[0]!;
      expect(frame[0]).toBe(0x80 | wsOpcode.binary);
    });
  });

  describe('subscriberCount', () => {
    it('should return correct count', () => {
      const manager = new WebSocketChannelManager();
      const { conn: c1 } = createTestConnection();
      const { conn: c2 } = createTestConnection();
      const { conn: c3 } = createTestConnection();

      manager.subscribe(c1, 'ch');
      manager.subscribe(c2, 'ch');
      manager.subscribe(c3, 'ch');

      expect(manager.subscriberCount('ch')).toBe(3);
    });

    it('should return 0 for non-existent channel', () => {
      const manager = new WebSocketChannelManager();
      expect(manager.subscriberCount('nope')).toBe(0);
    });
  });

  describe('channels', () => {
    it('should list all active channels', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      manager.subscribe(conn, 'alpha');
      manager.subscribe(conn, 'beta');
      manager.subscribe(conn, 'gamma');

      const chs = manager.channels();
      expect(chs).toContain('alpha');
      expect(chs).toContain('beta');
      expect(chs).toContain('gamma');
      expect(chs.length).toBe(3);
    });
  });

  describe('connection integration', () => {
    it('should work through connection.subscribe/publish delegation', () => {
      const manager = new WebSocketChannelManager();
      const { conn: publisher, socket: pubSock } = createTestConnection();
      const { conn: subscriber, socket: subSock } = createTestConnection();
      publisher.setChannelManager(manager);
      subscriber.setChannelManager(manager);

      subscriber.subscribe('updates');
      publisher.subscribe('updates');

      const count = publisher.publish('updates', 'new data');

      expect(count).toBe(1);
      expect(subSock.written.length).toBe(1);
      expect(pubSock.written.length).toBe(0);
    });

    it('should report subscription status via isSubscribed', () => {
      const manager = new WebSocketChannelManager();
      const { conn } = createTestConnection();
      conn.setChannelManager(manager);

      expect(conn.isSubscribed('ch')).toBe(false);
      conn.subscribe('ch');
      expect(conn.isSubscribed('ch')).toBe(true);
      conn.unsubscribe('ch');
      expect(conn.isSubscribed('ch')).toBe(false);
    });
  });
});
