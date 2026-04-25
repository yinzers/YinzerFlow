import { _encodeFrame } from './WebSocketFrame.ts';
import { _compressPayload } from './WebSocketCompression.ts';
import type { WebSocketConnection } from './WebSocketConnection.ts';
import { wsOpcode } from '@constants/websocket.ts';

/**
 * Channel-based pub/sub engine for WebSocket connections.
 *
 * The critical performance feature is **encode-once broadcast**: when publishing
 * to a channel, the WebSocket frame is encoded once into raw bytes, then those
 * exact bytes are written to every subscriber's socket via `sendRaw`. This avoids
 * per-subscriber serialization — O(messageSize + N×write) instead of O(N×messageSize).
 *
 * Two bidirectional maps ensure O(subscriptions-per-connection) cleanup on disconnect:
 * - `_channels`: channel → Set of connections (for publishing)
 * - `_subscriptions`: connection → Set of channels (for cleanup)
 */
export class WebSocketChannelManager {
  private readonly _channels = new Map<string, Set<WebSocketConnection>>();
  private readonly _subscriptions = new Map<WebSocketConnection, Set<string>>();
  private _compressionLevel = 1;
  private _compressionWindowBits = 11;
  private _compressionThreshold = 128;

  setCompressionConfig(level: number, windowBits: number, threshold: number): void {
    this._compressionLevel = level;
    this._compressionWindowBits = windowBits;
    this._compressionThreshold = threshold;
  }

  subscribe(connection: WebSocketConnection, channel: string): void {
    // Channel → connections map
    let subscribers = this._channels.get(channel);
    if (!subscribers) {
      subscribers = new Set();
      this._channels.set(channel, subscribers);
    }
    subscribers.add(connection);

    // Connection → channels map (for fast cleanup)
    let channels = this._subscriptions.get(connection);
    if (!channels) {
      channels = new Set();
      this._subscriptions.set(connection, channels);
    }
    channels.add(channel);
  }

  unsubscribe(connection: WebSocketConnection, channel: string): void {
    const subscribers = this._channels.get(channel);
    if (subscribers) {
      subscribers.delete(connection);
      if (subscribers.size === 0) {
        this._channels.delete(channel);
      }
    }

    const channels = this._subscriptions.get(connection);
    if (channels) {
      channels.delete(channel);
      if (channels.size === 0) {
        this._subscriptions.delete(connection);
      }
    }
  }

  unsubscribeAll(connection: WebSocketConnection): void {
    const channels = this._subscriptions.get(connection);
    if (!channels) return;

    for (const channel of channels) {
      const subscribers = this._channels.get(channel);
      if (subscribers) {
        subscribers.delete(connection);
        if (subscribers.size === 0) {
          this._channels.delete(channel);
        }
      }
    }

    this._subscriptions.delete(connection);
  }

  /**
   * Publish a message to all subscribers of a channel.
   * Encodes the WebSocket frame ONCE, then writes the raw bytes to each subscriber.
   * Optionally excludes the sender (so publishers don't echo their own messages).
   */
  publish(channel: string, data: Buffer | string, sender?: WebSocketConnection): number {
    const subscribers = this._channels.get(channel);
    if (!subscribers || subscribers.size === 0) return 0;

    const isString = typeof data === 'string';
    const payload = isString ? Buffer.from(data, 'utf8') : data;
    const opcode = isString ? wsOpcode.text : wsOpcode.binary;

    // Encode-once: uncompressed frame always ready, compressed frame lazy
    const uncompressedFrame = _encodeFrame(opcode, payload);
    let compressedFrame: Buffer | undefined = undefined;

    let recipientCount = 0;
    for (const connection of subscribers) {
      if (connection === sender) continue;

      if (connection._compressionEnabled && payload.length >= this._compressionThreshold) {
        compressedFrame ??= _encodeFrame(opcode, _compressPayload(payload, this._compressionLevel, this._compressionWindowBits), true, true);
        connection.sendRaw(compressedFrame);
      } else {
        connection.sendRaw(uncompressedFrame);
      }
      recipientCount++;
    }

    return recipientCount;
  }

  subscriberCount(channel: string): number {
    return this._channels.get(channel)?.size ?? 0;
  }

  isSubscribed(connection: WebSocketConnection, channel: string): boolean {
    return this._subscriptions.get(connection)?.has(channel) ?? false;
  }

  channels(): Array<string> {
    return [...this._channels.keys()];
  }
}
