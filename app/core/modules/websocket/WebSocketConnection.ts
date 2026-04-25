import type { Socket } from 'net';
import { _encodeCloseFrame, _encodeFrame, _parseFrame } from './WebSocketFrame.ts';
import type { WebSocketChannelManager } from './WebSocketChannelManager.ts';
import { wsCloseCode, wsOpcode, wsReadyState } from '@constants/websocket.ts';
import type { WebSocketBackpressureOptions, WebSocketHandlers } from '@typedefs/public/WebSocket.js';

/**
 * Options passed to the WebSocketConnection constructor.
 */
interface ConnectionOptions {
  maxPayloadLength: number;
  idleTimeout: number;
  backpressure: Required<WebSocketBackpressureOptions>;
  heartbeatInterval: number;
}

/**
 * Manages a single WebSocket connection's lifecycle over a raw TCP socket.
 *
 * This is a class (per coding rules: lifecycle management + shared socket state justifies it).
 * The class owns the socket event wiring, frame-level state machine, fragment reassembly,
 * backpressure tracking, and idle timeout management.
 *
 * @template T - Per-socket data type attached during upgrade
 */
export class WebSocketConnection<T = unknown> {
  private _readyState: number = wsReadyState.open;
  private readonly _socket: Socket;
  private readonly _data: T;
  private readonly _handlers: WebSocketHandlers<T>;
  private readonly _options: ConnectionOptions;
  private readonly _remoteAddress: string;

  // TCP chunk → frame reassembly
  private _receiveBuffer = Buffer.alloc(0);

  // WebSocket message fragment reassembly
  private _fragmentBuffers: Array<Buffer> = [];
  private _fragmentOpcode = 0;

  // Backpressure state
  private _backpressured = false;
  private _bufferedAmount = 0;

  // Idle timeout
  private _idleTimer: ReturnType<typeof setTimeout> | undefined;

  // Heartbeat — accessed by YinzerFlow sweep timer (framework-internal, not user-facing)
  _isAlive = true;
  readonly _heartbeatEnabled: boolean;

  // Channel manager (set externally after construction)
  private _channelManager?: WebSocketChannelManager;

  // eslint-disable-next-line max-params
  constructor(socket: Socket, data: T, handlers: WebSocketHandlers<T>, options: ConnectionOptions) {
    this._socket = socket;
    this._data = data;
    this._handlers = handlers;
    this._options = options;
    this._remoteAddress = socket.remoteAddress ?? 'unknown';
    this._heartbeatEnabled = options.heartbeatInterval > 0;

    socket.on('data', (chunk: Buffer) => this._onSocketData(chunk));
    socket.on('close', () => this._onSocketClose());
    socket.on('error', (err: Error) => this._onSocketError(err));
    socket.on('drain', () => this._onSocketDrain());

    this._resetIdleTimeout();
  }

  // ============================================
  // Public API (implements WebSocket<T> interface)
  // ============================================

  get readyState(): number {
    return this._readyState;
  }

  get data(): T {
    return this._data;
  }

  get remoteAddress(): string {
    return this._remoteAddress;
  }

  get bufferedAmount(): number {
    return this._bufferedAmount;
  }

  setChannelManager(manager: WebSocketChannelManager): void {
    this._channelManager = manager;
  }

  send(data: Buffer | string): void {
    if (this._readyState !== wsReadyState.open) return;

    const isString = typeof data === 'string';
    const payload = isString ? Buffer.from(data, 'utf8') : data;
    const opcode = isString ? wsOpcode.text : wsOpcode.binary;
    const frame = _encodeFrame(opcode, payload);

    this._writeFrame(frame);
  }

  sendRaw(encodedFrame: Buffer): void {
    if (this._readyState !== wsReadyState.open) return;
    this._writeFrame(encodedFrame);
  }

  close(code: number = wsCloseCode.normal, reason?: string): void {
    if (this._readyState !== wsReadyState.open) return;

    this._readyState = wsReadyState.closing;
    const frame = _encodeCloseFrame(code, reason);
    this._socket.write(frame);

    // Give the client 5 seconds to echo the close frame before force-destroying
    setTimeout(() => {
      if (this._readyState !== wsReadyState.closed) {
        this._readyState = wsReadyState.closed;
        if (!this._socket.destroyed) {
          this._socket.destroy();
        }
      }
    }, 5000);
  }

  ping(data?: Buffer): void {
    if (this._readyState !== wsReadyState.open) return;
    const payload = data ?? Buffer.alloc(0);
    const frame = _encodeFrame(wsOpcode.ping, payload);
    this._socket.write(frame);
  }

  subscribe(channel: string): void {
    this._channelManager?.subscribe(this as WebSocketConnection, channel);
  }

  unsubscribe(channel: string): void {
    this._channelManager?.unsubscribe(this as WebSocketConnection, channel);
  }

  publish(channel: string, data: Buffer | string): number {
    return this._channelManager?.publish(channel, data, this as WebSocketConnection) ?? 0;
  }

  isSubscribed(channel: string): boolean {
    return this._channelManager?.isSubscribed(this as WebSocketConnection, channel) ?? false;
  }

  // ============================================
  // Socket event handlers
  // ============================================

  private _onSocketData(chunk: Buffer): void {
    if (this._readyState === wsReadyState.closed) return;

    this._isAlive = true;
    this._resetIdleTimeout();

    // Append chunk to receive buffer
    this._receiveBuffer = this._receiveBuffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([this._receiveBuffer, chunk]);

    // Parse all complete frames in the buffer
    let offset = 0;
    while (offset < this._receiveBuffer.length) {
      const result = _parseFrame(this._receiveBuffer, offset);
      if (result === null) break;

      const { frame, bytesConsumed } = result;
      offset += bytesConsumed;

      // RFC 6455 §5.1: server MUST close if client frame is not masked
      if (!frame.masked) {
        this.close(wsCloseCode.protocolError, 'Client frames must be masked');
        this._destroySocket();
        return;
      }

      // Max payload enforcement — check before processing
      if (frame.payloadLength > this._options.maxPayloadLength) {
        this.close(wsCloseCode.tooLarge, 'Payload too large');
        this._destroySocket();
        return;
      }

      this._handleFrame(frame);

      if (this._readyState === wsReadyState.closed) return;
    }

    // Keep unconsumed bytes for next chunk
    this._receiveBuffer = offset > 0 ? this._receiveBuffer.subarray(offset) : this._receiveBuffer;
  }

  private _onSocketClose(): void {
    this._clearIdleTimeout();
    this._channelManager?.unsubscribeAll(this as WebSocketConnection);
    if (this._readyState === wsReadyState.closed) return;

    const prevState = this._readyState;
    this._readyState = wsReadyState.closed;

    if (prevState !== wsReadyState.closed) {
      this._handlers.close?.(this._asPublic(), wsCloseCode.abnormal, 'Connection closed unexpectedly');
    }
  }

  private _onSocketError(error: Error): void {
    this._clearIdleTimeout();
    this._handlers.error?.(this._asPublic(), error);

    if (!this._socket.destroyed) {
      this._socket.destroy();
    }
  }

  private _onSocketDrain(): void {
    this._backpressured = false;
    this._bufferedAmount = 0;
    this._handlers.drain?.(this._asPublic());
  }

  // ============================================
  // Frame handling
  // ============================================

  private _handleFrame(frame: { fin: boolean; opcode: number; payload: Buffer }): void {
    const { fin, opcode, payload } = frame;

    // Control frames (opcode >= 0x8) — handle immediately, even mid-fragmentation
    if (opcode >= 0x8) {
      // RFC 6455 §5.5: control frames MUST NOT be fragmented and payload ≤125 bytes
      if (!fin) {
        this.close(wsCloseCode.protocolError, 'Control frames must not be fragmented');
        this._destroySocket();
        return;
      }
      if (payload.length > 125) {
        this.close(wsCloseCode.protocolError, 'Control frame payload exceeds 125 bytes');
        this._destroySocket();
        return;
      }
      this._handleControlFrame(opcode, payload);
      return;
    }

    // Data frames — handle fragmentation
    if (opcode === wsOpcode.continuation) {
      // Continuation frame
      this._fragmentBuffers.push(payload);

      if (fin) {
        // Final fragment — reassemble and deliver
        const completePayload = Buffer.concat(this._fragmentBuffers);
        const originalOpcode = this._fragmentOpcode;
        this._fragmentBuffers = [];
        this._fragmentOpcode = 0;
        this._deliverMessage(originalOpcode, completePayload);
      }
    } else if (fin) {
      // Complete single-frame message
      this._deliverMessage(opcode, payload);
    } else {
      // Start of fragmented message
      this._fragmentOpcode = opcode;
      this._fragmentBuffers = [payload];
    }
  }

  private _handleControlFrame(opcode: number, payload: Buffer): void {
    if (opcode === wsOpcode.ping) {
      // Respond with pong echoing the same payload
      if (this._readyState === wsReadyState.open) {
        const pongFrame = _encodeFrame(wsOpcode.pong, payload);
        this._socket.write(pongFrame);
      }
      return;
    }

    if (opcode === wsOpcode.pong) {
      this._isAlive = true;
      return;
    }

    if (opcode === wsOpcode.close) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : wsCloseCode.noStatus;
      const reason = payload.length > 2 ? payload.subarray(2).toString('utf8') : '';

      if (this._readyState === wsReadyState.open) {
        // Client initiated close — echo the close frame back
        this._readyState = wsReadyState.closed;
        const echoFrame = _encodeCloseFrame(code, reason);
        this._socket.write(echoFrame);
        this._destroySocket();
        this._handlers.close?.(this._asPublic(), code, reason);
      } else if (this._readyState === wsReadyState.closing) {
        // We initiated close, client echoed — complete the handshake
        this._readyState = wsReadyState.closed;
        this._destroySocket();
        this._handlers.close?.(this._asPublic(), code, reason);
      }
    }
  }

  private _deliverMessage(opcode: number, payload: Buffer): void {
    if (this._readyState === wsReadyState.closed) return;

    const isBinary = opcode === wsOpcode.binary;
    const data = isBinary ? payload : payload.toString('utf8');
    this._handlers.message?.(this._asPublic(), data, isBinary);
  }

  // ============================================
  // Write with backpressure
  // ============================================

  private _writeFrame(frame: Buffer): void {
    if (this._backpressured) {
      if (this._options.backpressure.strategy === 'drop') {
        return;
      }
      // Buffer strategy — check if we'd exceed the limit
      this._bufferedAmount += frame.length;
      if (this._bufferedAmount > this._options.backpressure.limit) {
        this.close(wsCloseCode.tooLarge, 'Send buffer overflow');
        this._destroySocket();
        return;
      }
    }

    const flushed = this._socket.write(frame);
    if (!flushed) {
      this._backpressured = true;
      this._bufferedAmount += frame.length;
    }
  }

  // ============================================
  // Idle timeout
  // ============================================

  private _resetIdleTimeout(): void {
    this._clearIdleTimeout();
    if (this._options.idleTimeout > 0) {
      this._idleTimer = setTimeout(() => {
        this.close(wsCloseCode.normal, 'Idle timeout');
        setTimeout(() => this._destroySocket(), 1000);
      }, this._options.idleTimeout * 1000);
    }
  }

  private _clearIdleTimeout(): void {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = undefined;
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private _destroySocket(): void {
    this._clearIdleTimeout();
    if (!this._socket.destroyed) {
      this._socket.destroy();
    }
  }

  /**
   * Return `this` cast to the public WebSocket<T> interface.
   * The class implements all WebSocket<T> properties/methods, so this is safe.
   */
  private _asPublic(): WebSocketConnection<T> {
    return this;
  }
}
