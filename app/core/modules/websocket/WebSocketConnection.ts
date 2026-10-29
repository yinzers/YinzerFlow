import type { Socket } from 'net';
import { _encodeCloseFrame, _encodeFrame, _maxFrameHeaderSize, _parseFrame, _parseFrameHeader } from './WebSocketFrame.ts';
import { _compressPayload, _decompressPayload, _inflateWindowBits } from './WebSocketCompression.ts';
import type { WebSocketChannelManager } from './WebSocketChannelManager.ts';
import { wsCloseCode, wsOpcode, wsReadyState, wsSendStatus } from '@constants/websocket.ts';
import type { InternalWsSendStatus } from '@typedefs/constants/websocket.js';
import type { WebSocketBackpressureOptions, WebSocketHandlers } from '@typedefs/public/WebSocket.js';

/**
 * Options passed to the WebSocketConnection constructor.
 */
interface RateLimitOptions {
  enabled: boolean;
  maxMessages: number;
  window: number;
}

interface CompressionOptions {
  enabled: boolean;
  level: number;
  threshold: number;
  /** The window negotiated for this connection (see _negotiatedServerWindowBits), not the configured one */
  serverMaxWindowBits: number;
}

interface ConnectionOptions {
  maxPayloadLength: number;
  idleTimeout: number;
  backpressure: Required<WebSocketBackpressureOptions>;
  heartbeatInterval: number;
  messageRateLimit: RateLimitOptions;
  compression: CompressionOptions;
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
  /** Received bytes not yet parsed, kept as the chunks they arrived in and joined only once a whole frame is here */
  private _receiveChunks: Array<Buffer> = [];
  private _receivedBytes = 0;

  // WebSocket message fragment reassembly
  private _fragmentBuffers: Array<Buffer> = [];
  private _fragmentOpcode = 0;
  private _fragmentCompressed = false;
  /** Bytes buffered so far for the fragmented message in progress, held to maxPayloadLength like a whole message */
  private _fragmentBytes = 0;

  // Backpressure state
  private _backpressured = false;
  private _bufferedAmount = 0;

  // Idle timeout
  private _idleTimer: ReturnType<typeof setTimeout> | undefined;

  // Heartbeat — accessed by YinzerFlow sweep timer (framework-internal, not user-facing)
  _isAlive = true;
  readonly _heartbeatEnabled: boolean;
  readonly _compressionEnabled: boolean;
  /** The LZ77 window this connection's client agreed to; broadcast compresses one frame per distinct value */
  readonly _compressionWindowBits: number;

  // Token bucket rate limiting
  private _rateLimitTokens: number;
  private _rateLimitLastRefill: number;

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
    this._compressionEnabled = options.compression.enabled;
    this._compressionWindowBits = options.compression.serverMaxWindowBits;
    this._rateLimitTokens = options.messageRateLimit.enabled ? options.messageRateLimit.maxMessages : 0;
    this._rateLimitLastRefill = options.messageRateLimit.enabled ? Date.now() : 0;

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

  send(data: Buffer | string): InternalWsSendStatus {
    if (this._readyState !== wsReadyState.open) return wsSendStatus.dropped;

    const isString = typeof data === 'string';
    const payload = isString ? Buffer.from(data, 'utf8') : data;
    const opcode = isString ? wsOpcode.text : wsOpcode.binary;

    const compress = this._options.compression.enabled && payload.length >= this._options.compression.threshold;
    if (compress) {
      const compressed = _compressPayload(payload, this._options.compression.level, this._options.compression.serverMaxWindowBits);
      return this._writeFrame(_encodeFrame(opcode, compressed, true, true));
    }
    return this._writeFrame(_encodeFrame(opcode, payload));
  }

  sendRaw(encodedFrame: Buffer): InternalWsSendStatus {
    if (this._readyState !== wsReadyState.open) return wsSendStatus.dropped;
    return this._writeFrame(encodedFrame);
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

  subscribe(channel: string): boolean {
    // Channels are cleaned once, when the socket closes; a connection added after that (an async open() resuming after
    // the client left, a close() handler) would stay in the channel forever. A closing connection gets no more frames.
    if (this._readyState !== wsReadyState.open || this._socket.destroyed || !this._channelManager) return false;
    this._channelManager.subscribe(this as WebSocketConnection, channel);
    return true;
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

    this._receiveChunks.push(chunk);
    this._receivedBytes += chunk.length;

    // Parse all complete frames. Each frame leaves the buffer BEFORE it is acted on, so nothing a handler does (a throw
    // included) can leave it behind to be parsed and delivered again on the next read.
    while (this._receivedBytes > 0) {
      // The header first: its announced length is refused before a single body byte is waited for or buffered
      const header = _parseFrameHeader(this._joinFirst(Math.min(this._receivedBytes, _maxFrameHeaderSize)), 0);
      if (!header) return;
      if (this._announcesTooMuch(header.opcode, header.payloadLength)) {
        this._rejectTooLarge();
        return;
      }

      const frameSize = header.headerSize + header.payloadLength;
      if (this._receivedBytes < frameSize) return;
      const result = _parseFrame(this._joinFirst(frameSize), 0);
      this._consumeReceived(frameSize);
      if (!result) return; // unreachable: the whole frame is here

      // RFC 6455 §5.1: server MUST close if client frame is not masked
      if (!result.frame.masked) {
        this.close(wsCloseCode.protocolError, 'Client frames must be masked');
        this._destroySocket();
        return;
      }

      this._handleFrame(result.frame);

      if (this._readyState === wsReadyState.closed) return;
    }
  }

  /**
   * True when a frame's announced length alone breaks maxPayloadLength: a data frame longer than the limit, or a
   * continuation that would take the fragmented message in progress past it. Control frames are capped at 125 bytes
   * separately in _handleFrame.
   */
  private _announcesTooMuch(opcode: number, payloadLength: number): boolean {
    if (opcode >= 0x8) return false;
    const max = this._options.maxPayloadLength;
    if (payloadLength > max) return true;
    return opcode === wsOpcode.continuation && this._fragmentBytes + payloadLength > max;
  }

  /** The first `length` received bytes as one buffer, joining leading chunks only when the first one is shorter. */
  private _joinFirst(length: number): Buffer {
    const [first] = this._receiveChunks;
    if (first && first.length >= length) return first;

    let joinedLength = 0;
    let count = 0;
    for (const chunk of this._receiveChunks) {
      if (joinedLength >= length) break;
      joinedLength += chunk.length;
      count++;
    }
    const joined = Buffer.concat(this._receiveChunks.slice(0, count), joinedLength);
    this._receiveChunks.splice(0, count, joined);
    return joined;
  }

  /** Drop `length` bytes from the front of the received chunks. */
  private _consumeReceived(length: number): void {
    let remaining = length;
    let [first] = this._receiveChunks;
    while (remaining > 0 && first) {
      if (first.length <= remaining) {
        remaining -= first.length;
        this._receiveChunks.shift();
        [first] = this._receiveChunks;
      } else {
        this._receiveChunks[0] = first.subarray(remaining);
        remaining = 0;
      }
    }
    this._receivedBytes -= length;
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

  // eslint-disable-next-line max-statements
  private _handleFrame(frame: { fin: boolean; rsv1: boolean; opcode: number; payload: Buffer }): void {
    const { fin, rsv1, opcode, payload } = frame;

    // Control frames (opcode >= 0x8) — handle immediately, even mid-fragmentation
    if (opcode >= 0x8) {
      if (rsv1) {
        this.close(wsCloseCode.protocolError, 'RSV1 must not be set on control frames');
        this._destroySocket();
        return;
      }
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

    // RSV1 on data frame without compression negotiated = protocol error
    if (rsv1 && !this._options.compression.enabled) {
      this.close(wsCloseCode.protocolError, 'RSV1 set but no compression negotiated');
      this._destroySocket();
      return;
    }

    // Data frames — handle fragmentation
    if (opcode === wsOpcode.continuation) {
      if (rsv1) {
        this.close(wsCloseCode.protocolError, 'RSV1 must not be set on continuation frames');
        this._destroySocket();
        return;
      }
      // Already held to maxPayloadLength from the announced length in _onSocketData
      this._fragmentBytes += payload.length;
      this._fragmentBuffers.push(payload);

      if (fin) {
        // Final fragment — reassemble and deliver (decompress if first fragment had RSV1)
        const completePayload = Buffer.concat(this._fragmentBuffers);
        const originalOpcode = this._fragmentOpcode;
        const compressed = this._fragmentCompressed;
        this._fragmentBuffers = [];
        this._fragmentOpcode = 0;
        this._fragmentCompressed = false;
        this._fragmentBytes = 0;
        this._deliverMessage(originalOpcode, completePayload, compressed);
      }
    } else if (fin) {
      // Complete single-frame message
      this._deliverMessage(opcode, payload, rsv1);
    } else {
      // Start of fragmented message — RSV1 only valid here (first fragment)
      this._fragmentOpcode = opcode;
      this._fragmentCompressed = rsv1;
      this._fragmentBuffers = [payload];
      this._fragmentBytes = payload.length;
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

  private _deliverMessage(opcode: number, payload: Buffer, compressed = false): void {
    if (this._readyState === wsReadyState.closed) return;

    if (this._options.messageRateLimit.enabled && !this._consumeRateLimitToken()) {
      this.close(wsCloseCode.policyViolation, 'Message rate limit exceeded');
      this._destroySocket();
      return;
    }

    let finalPayload = payload;
    if (compressed) {
      try {
        // Inflation is capped at maxPayloadLength: the frame check only bounds the compressed size
        finalPayload = _decompressPayload(payload, _inflateWindowBits, this._options.maxPayloadLength);
      } catch (error) {
        if (_isOutputTooLarge(error)) {
          this._rejectTooLarge();
          return;
        }
        this.close(wsCloseCode.invalidPayload, 'Decompression failed');
        this._destroySocket();
        return;
      }
    }

    const isBinary = opcode === wsOpcode.binary;
    const data = isBinary ? finalPayload : finalPayload.toString('utf8');
    this._handlers.message?.(this._asPublic(), data, isBinary);
  }

  private _consumeRateLimitToken(): boolean {
    const rl = this._options.messageRateLimit;
    const now = Date.now();
    const elapsed = (now - this._rateLimitLastRefill) / 1000;
    const refillRate = rl.maxMessages / rl.window;
    const refilledTokens = elapsed * refillRate;
    this._rateLimitTokens = Math.min(this._rateLimitTokens + refilledTokens, rl.maxMessages);
    this._rateLimitLastRefill = now;

    if (this._rateLimitTokens < 1) return false;

    this._rateLimitTokens -= 1;
    return true;
  }

  // ============================================
  // Write with backpressure
  // ============================================

  /** Write a frame under the backpressure strategy and report what happened to it. */
  private _writeFrame(frame: Buffer): InternalWsSendStatus {
    // Destroyed but its close event not yet delivered: readyState is still open, but nothing written now can leave
    if (this._socket.destroyed) return wsSendStatus.dropped;

    const wasBackpressured = this._backpressured;
    if (wasBackpressured) {
      if (this._options.backpressure.strategy === 'drop') {
        return wsSendStatus.dropped;
      }
      // Buffer strategy — check if we'd exceed the limit
      this._bufferedAmount += frame.length;
      if (this._bufferedAmount > this._options.backpressure.limit) {
        this.close(wsCloseCode.tooLarge, 'Send buffer overflow');
        this._destroySocket();
        return wsSendStatus.dropped;
      }
    }

    const flushed = this._socket.write(frame);
    if (!flushed) {
      this._backpressured = true;
      this._bufferedAmount += frame.length;
    }
    return flushed && !wasBackpressured ? wsSendStatus.sent : wsSendStatus.buffered;
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

  /** Close 1009 for a message over maxPayloadLength: one frame, the fragments so far, or what it inflates to. */
  private _rejectTooLarge(): void {
    this._fragmentBuffers = [];
    this._fragmentBytes = 0;
    this.close(wsCloseCode.tooLarge, 'Payload too large');
    this._destroySocket();
  }

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

/** zlib refused to inflate past maxOutputLength (Node and Bun both report ERR_BUFFER_TOO_LARGE). */
const _isOutputTooLarge = (error: unknown): boolean => error instanceof Error && (error as Error & { code?: unknown }).code === 'ERR_BUFFER_TOO_LARGE';
