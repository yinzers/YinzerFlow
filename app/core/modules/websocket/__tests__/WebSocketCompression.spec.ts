/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import { describe, expect, it } from 'bun:test';
import {
  _buildCompressionResponse,
  _compressPayload,
  _decompressPayload,
  _parseCompressionOffer,
} from '../WebSocketCompression.ts';
import { _encodeFrame, _parseFrame } from '../WebSocketFrame.ts';
import { WebSocketConnection } from '../WebSocketConnection.ts';
import { WebSocketChannelManager } from '../WebSocketChannelManager.ts';
import { DEFAULT_WEBSOCKET_CONFIG, _validateWebSocketConfig } from '../WebSocketConfig.ts';
import { MockSocket, buildClientFrame } from './ws-test-utils.ts';
import { wsOpcode, wsReadyState } from '@constants/websocket.ts';
import type { WebSocketHandlers } from '@typedefs/public/WebSocket.js';

const defaultCompressionOpts = { enabled: true, level: 1, threshold: 0, serverMaxWindowBits: 11, clientMaxWindowBits: 15 };
const disabledCompressionOpts = { enabled: false, level: 1, threshold: 128, serverMaxWindowBits: 11, clientMaxWindowBits: 15 };

const createConnection = (
  compressionOpts: typeof defaultCompressionOpts,
  handlers: WebSocketHandlers<{ testId: string }> = {},
): { conn: WebSocketConnection<{ testId: string }>; socket: MockSocket } => {
  const socket = new MockSocket();
  const conn = new WebSocketConnection(socket as never, { testId: 'comp-test' }, handlers, {
    maxPayloadLength: 16_777_216,
    idleTimeout: 0,
    backpressure: { strategy: 'buffer', limit: 1_048_576 },
    heartbeatInterval: 0,
    messageRateLimit: { enabled: false, maxMessages: 100, window: 10 },
    compression: compressionOpts,
  });
  return { conn, socket };
};

describe('WebSocket Compression', () => {
  describe('_compressPayload / _decompressPayload roundtrip', () => {
    it('should compress and decompress to original data', () => {
      const original = Buffer.from('Hello, WebSocket compression!');
      const compressed = _compressPayload(original, 1, 11);
      const decompressed = _decompressPayload(compressed, 11);
      expect(decompressed.toString()).toBe(original.toString());
    });

    it('should handle empty payload', () => {
      const original = Buffer.alloc(0);
      const compressed = _compressPayload(original, 1, 11);
      const decompressed = _decompressPayload(compressed, 11);
      expect(decompressed.length).toBe(0);
    });

    it('should handle large payload', () => {
      const original = Buffer.alloc(100_000, 'A');
      const compressed = _compressPayload(original, 1, 11);
      expect(compressed.length).toBeLessThan(original.length);
      const decompressed = _decompressPayload(compressed, 11);
      expect(decompressed.equals(original)).toBe(true);
    });

    it('should strip trailing sync marker from compressed output', () => {
      const original = Buffer.from('test data for compression');
      const compressed = _compressPayload(original, 1, 15);
      const tail = compressed.subarray(-4);
      // Should NOT end with 0x00 0x00 0xFF 0xFF (stripped per RFC 7692)
      const isSyncMarker = tail[0] === 0x00 && tail[1] === 0x00 && tail[2] === 0xff && tail[3] === 0xff;
      expect(isSyncMarker).toBe(false);
    });

    it('should work with different window bits', () => {
      const original = Buffer.from('Testing window bits compatibility');
      for (const bits of [9, 11, 13, 15]) {
        const compressed = _compressPayload(original, 1, bits);
        const decompressed = _decompressPayload(compressed, bits);
        expect(decompressed.toString()).toBe(original.toString());
      }
    });

    it('should work with different compression levels', () => {
      const original = Buffer.from('Testing compression levels 1 through 9');
      for (const level of [1, 6, 9]) {
        const compressed = _compressPayload(original, level, 11);
        const decompressed = _decompressPayload(compressed, 11);
        expect(decompressed.toString()).toBe(original.toString());
      }
    });
  });

  describe('_parseCompressionOffer', () => {
    it('should parse basic permessage-deflate offer', () => {
      const result = _parseCompressionOffer('permessage-deflate');
      expect(result).not.toBeNull();
      expect(result!.serverNoContextTakeover).toBe(false);
      expect(result!.clientNoContextTakeover).toBe(false);
      expect(result!.clientMaxWindowBitsOffered).toBe(false);
    });

    it('should parse offer with all parameters', () => {
      const result = _parseCompressionOffer(
        'permessage-deflate; server_no_context_takeover; client_no_context_takeover; server_max_window_bits=11; client_max_window_bits=13',
      );
      expect(result).not.toBeNull();
      expect(result!.serverNoContextTakeover).toBe(true);
      expect(result!.clientNoContextTakeover).toBe(true);
      expect(result!.serverMaxWindowBits).toBe(11);
      expect(result!.clientMaxWindowBitsOffered).toBe(true);
      expect(result!.clientMaxWindowBits).toBe(13);
    });

    it('should parse client_max_window_bits without value', () => {
      const result = _parseCompressionOffer('permessage-deflate; client_max_window_bits');
      expect(result).not.toBeNull();
      expect(result!.clientMaxWindowBitsOffered).toBe(true);
      expect(result!.clientMaxWindowBits).toBeUndefined();
    });

    it('should return null for non-deflate extension', () => {
      const result = _parseCompressionOffer('x-custom-extension');
      expect(result).toBeNull();
    });

    it('should return null for invalid window bits', () => {
      const result = _parseCompressionOffer('permessage-deflate; server_max_window_bits=7');
      expect(result).toBeNull();
    });

    it('should pick first valid offer from multiple', () => {
      const result = _parseCompressionOffer(
        'x-custom, permessage-deflate; client_max_window_bits',
      );
      expect(result).not.toBeNull();
      expect(result!.clientMaxWindowBitsOffered).toBe(true);
    });
  });

  describe('_buildCompressionResponse', () => {
    it('should always include no-context-takeover', () => {
      const response = _buildCompressionResponse(
        { serverNoContextTakeover: false, clientNoContextTakeover: false, serverMaxWindowBits: undefined, clientMaxWindowBitsOffered: false, clientMaxWindowBits: undefined },
        { serverMaxWindowBits: 15, clientMaxWindowBits: 15 },
      );
      expect(response).toContain('server_no_context_takeover');
      expect(response).toContain('client_no_context_takeover');
    });

    it('should include server_max_window_bits when less than 15', () => {
      const response = _buildCompressionResponse(
        { serverNoContextTakeover: false, clientNoContextTakeover: false, serverMaxWindowBits: undefined, clientMaxWindowBitsOffered: false, clientMaxWindowBits: undefined },
        { serverMaxWindowBits: 11, clientMaxWindowBits: 15 },
      );
      expect(response).toContain('server_max_window_bits=11');
    });

    it('should omit server_max_window_bits when 15', () => {
      const response = _buildCompressionResponse(
        { serverNoContextTakeover: false, clientNoContextTakeover: false, serverMaxWindowBits: undefined, clientMaxWindowBitsOffered: false, clientMaxWindowBits: undefined },
        { serverMaxWindowBits: 15, clientMaxWindowBits: 15 },
      );
      expect(response).not.toContain('server_max_window_bits');
    });

    it('should respect client offer for window bits', () => {
      const response = _buildCompressionResponse(
        { serverNoContextTakeover: false, clientNoContextTakeover: false, serverMaxWindowBits: 10, clientMaxWindowBitsOffered: true, clientMaxWindowBits: 12 },
        { serverMaxWindowBits: 11, clientMaxWindowBits: 15 },
      );
      expect(response).toContain('server_max_window_bits=10');
      expect(response).toContain('client_max_window_bits=12');
    });
  });

  describe('frame RSV1 handling', () => {
    it('should have no frames before any sends', () => {
      const { socket } = createConnection(defaultCompressionOpts);
      expect(socket.written.length).toBe(0);
    });

    it('should set RSV1 bit when compression is enabled and sending', () => {
      const { conn, socket } = createConnection(defaultCompressionOpts);
      conn.send('Hello compressed world');

      const frame = socket.written[0]!;
      expect(frame[0]! & 0x40).toBe(0x40);
    });

    it('should not set RSV1 when compression is disabled', () => {
      const { conn, socket } = createConnection(disabledCompressionOpts);
      conn.send('Hello uncompressed');

      const frame = socket.written[0]!;
      expect(frame[0]! & 0x40).toBe(0);
    });

    it('should parse RSV1 from incoming frames', () => {
      const result = _parseFrame(Buffer.from([0xc1, 0x80, 0x00, 0x00, 0x00, 0x00]), 0);
      expect(result).not.toBeNull();
      expect(result!.frame.rsv1).toBe(true);
    });

    it('should parse RSV1=false from normal frames', () => {
      const result = _parseFrame(Buffer.from([0x81, 0x80, 0x00, 0x00, 0x00, 0x00]), 0);
      expect(result).not.toBeNull();
      expect(result!.frame.rsv1).toBe(false);
    });

    it('should throw on RSV2 or RSV3 being set', () => {
      // RSV2 set (0x20)
      expect(() => _parseFrame(Buffer.from([0xa1, 0x80, 0x00, 0x00, 0x00, 0x00]), 0)).toThrow('RSV2 and RSV3 must be zero');
      // RSV3 set (0x10)
      expect(() => _parseFrame(Buffer.from([0x91, 0x80, 0x00, 0x00, 0x00, 0x00]), 0)).toThrow('RSV2 and RSV3 must be zero');
    });
  });

  describe('connection compression', () => {
    it('should compress outgoing messages above threshold', () => {
      const { conn, socket } = createConnection({ ...defaultCompressionOpts, threshold: 10 });
      const longMessage = 'A'.repeat(200);
      conn.send(longMessage);

      const frame = socket.written[0]!;
      // RSV1 should be set
      expect(frame[0]! & 0x40).toBe(0x40);
      // Compressed frame should be smaller than uncompressed
      expect(frame.length).toBeLessThan(200 + 10);
    });

    it('should not compress messages below threshold', () => {
      const { conn, socket } = createConnection({ ...defaultCompressionOpts, threshold: 1000 });
      conn.send('short');

      const frame = socket.written[0]!;
      // RSV1 should NOT be set (below threshold)
      expect(frame[0]! & 0x40).toBe(0);
    });

    it('should close with protocol error when RSV1 set but compression not negotiated', () => {
      const { conn, socket } = createConnection(disabledCompressionOpts);

      // Simulate receiving a frame with RSV1 set (0xC1 = FIN + RSV1 + text opcode)
      const compressedFrame = buildClientFrame(0x41, Buffer.from('data'));
      // Manually set RSV1 in the first byte
      compressedFrame[0] = compressedFrame[0]! | 0x40;
      socket.emit('data', compressedFrame);

      expect(conn.readyState).not.toBe(wsReadyState.open);
    });

    it('should close with protocol error when RSV1 set on control frame', () => {
      const { conn, socket } = createConnection(defaultCompressionOpts);

      // Build a ping frame with RSV1 set (invalid per RFC)
      const pingFrame = buildClientFrame(wsOpcode.ping, Buffer.alloc(0));
      pingFrame[0] = pingFrame[0]! | 0x40;
      socket.emit('data', pingFrame);

      expect(conn.readyState).not.toBe(wsReadyState.open);
    });

    it('should close with protocol error when RSV1 set on continuation frame', () => {
      const { conn, socket } = createConnection(defaultCompressionOpts);

      // Send start of fragmented message (no RSV1)
      const startFrame = buildClientFrame(wsOpcode.text, Buffer.from('start'), false);
      socket.emit('data', startFrame);

      // Send continuation with RSV1 set (invalid — RSV1 only on first fragment)
      const contFrame = buildClientFrame(wsOpcode.continuation, Buffer.from('cont'));
      contFrame[0] = contFrame[0]! | 0x40;
      socket.emit('data', contFrame);

      expect(conn.readyState).not.toBe(wsReadyState.open);
    });
  });

  describe('broadcast compression', () => {
    it('should send compressed frame to compressed connections', () => {
      const manager = new WebSocketChannelManager();
      manager.setCompressionConfig(1, 11, 0);

      const { conn: compConn, socket: compSocket } = createConnection(defaultCompressionOpts);
      compConn.setChannelManager(manager);
      manager.subscribe(compConn as WebSocketConnection, 'test');

      manager.publish('test', 'A'.repeat(200));

      const frame = compSocket.written[compSocket.written.length - 1]!;
      // RSV1 should be set on the broadcast frame
      expect(frame[0]! & 0x40).toBe(0x40);
    });

    it('should send uncompressed frame to uncompressed connections', () => {
      const manager = new WebSocketChannelManager();
      manager.setCompressionConfig(1, 11, 0);

      const { conn: plainConn, socket: plainSocket } = createConnection(disabledCompressionOpts);
      plainConn.setChannelManager(manager);
      manager.subscribe(plainConn as WebSocketConnection, 'test');

      manager.publish('test', 'A'.repeat(200));

      const frame = plainSocket.written[plainSocket.written.length - 1]!;
      // RSV1 should NOT be set
      expect(frame[0]! & 0x40).toBe(0);
    });

    it('should encode compressed frame only once for multiple compressed subscribers', () => {
      const manager = new WebSocketChannelManager();
      manager.setCompressionConfig(1, 11, 0);

      const { conn: conn1, socket: socket1 } = createConnection(defaultCompressionOpts);
      const { conn: conn2, socket: socket2 } = createConnection(defaultCompressionOpts);
      conn1.setChannelManager(manager);
      conn2.setChannelManager(manager);
      manager.subscribe(conn1 as WebSocketConnection, 'test');
      manager.subscribe(conn2 as WebSocketConnection, 'test');

      manager.publish('test', 'A'.repeat(200));

      const frame1 = socket1.written[socket1.written.length - 1]!;
      const frame2 = socket2.written[socket2.written.length - 1]!;
      // Same Buffer reference (encode-once)
      expect(frame1).toBe(frame2);
    });

    it('should not compress broadcast below threshold', () => {
      const manager = new WebSocketChannelManager();
      manager.setCompressionConfig(1, 11, 1000);

      const { conn, socket } = createConnection(defaultCompressionOpts);
      conn.setChannelManager(manager);
      manager.subscribe(conn as WebSocketConnection, 'test');

      manager.publish('test', 'short');

      const frame = socket.written[socket.written.length - 1]!;
      expect(frame[0]! & 0x40).toBe(0);
    });
  });

  describe('config validation', () => {
    it('should accept valid compression config', () => {
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          compression: { enabled: true, level: 6, threshold: 256, serverMaxWindowBits: 11, clientMaxWindowBits: 15 },
        });
      }).not.toThrow();
    });

    it('should reject level outside 1-9', () => {
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          compression: { enabled: true, level: 0, threshold: 128, serverMaxWindowBits: 11, clientMaxWindowBits: 15 },
        });
      }).toThrow('level must be between 1 and 9');
    });

    it('should reject windowBits outside 9-15', () => {
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          compression: { enabled: true, level: 1, threshold: 128, serverMaxWindowBits: 8, clientMaxWindowBits: 15 },
        });
      }).toThrow('serverMaxWindowBits must be between 9 and 15');
    });

    it('should skip validation when disabled', () => {
      expect(() => {
        _validateWebSocketConfig({
          ...DEFAULT_WEBSOCKET_CONFIG,
          compression: { enabled: false, level: 0, threshold: -1, serverMaxWindowBits: 0, clientMaxWindowBits: 0 },
        });
      }).not.toThrow();
    });
  });
});
