# Plan: WebSocket Support (Raw RFC 6455)
Created: 2026-04-24
Status: approved

## Context & Why

**Goal**: Add production-level WebSocket support to YinzerFlow, implemented from scratch at the TCP level — consistent with how the framework already handles HTTP. Must include channel-based pub/sub and be optimized for high-throughput real-time data (trading quotes).

**Why**: Real-time features are table stakes for modern frameworks. The immediate driver is a trading platform that needs to push quote-level market data over WebSockets — high volume, low latency, channel-based subscriptions. Without WebSocket support, users must bolt on a separate server (ws, Socket.IO), fragmenting their architecture and losing framework benefits (logging, config, hooks, graceful shutdown).

**Background**: YinzerFlow builds on `net.createServer()` with a hand-rolled TCP stream reassembly state machine that buffers chunks, parses HTTP headers, assembles bodies, and dispatches to the request handler. There is zero existing WebSocket code. Bun's built-in `Bun.serve()` WebSocket API is not applicable — it's a different server paradigm. We implement RFC 6455 from scratch, matching the framework's existing philosophy of raw TCP control.

**Constraints**:
- Zero external dependencies (framework-level decision)
- Must not break existing HTTP handling
- Must integrate with existing graceful shutdown, logging, configuration, **and hook system**
- Must follow existing module pattern (config → core logic → integration)
- Types in `typedefs/`, implementation in `core/modules/websocket/`
- **Performance**: Must handle high-throughput real-time data (thousands of messages/sec per connection, many concurrent subscribers per channel)

**Success criteria**:
- Users can register WebSocket routes with `app.ws('/path', handlers)`
- Handshake, framing (text/binary), control frames (ping/pong/close), and fragmentation all work per RFC 6455
- Per-socket typed data (set during upgrade)
- Channel-based pub/sub with encode-once broadcast (`ws.subscribe`, `ws.publish`, `app.publish`)
- **Hook integration**: Upgrade requests run through `beforeRouting` hooks; WS-specific lifecycle hooks (`wsBeforeMessage`, `wsAfterMessage`)
- **Performance**: Encode-once broadcast, configurable backpressure strategy, minimal allocations in hot path
- Connection tracking with graceful shutdown
- Security: origin validation, max payload size, max connections per IP
- All existing tests still pass (no HTTP regression)
- Integration tests with real WebSocket connections

## Research Findings

1. **Bun.serve() WebSocket API** (Context7): Not applicable. YinzerFlow uses `net.createServer()`, not `Bun.serve()`. The Bun WS API configures WebSocket handlers at the server level alongside a `fetch` handler — a fundamentally different architecture.

2. **Integration point**: `_handleConnection()` (YinzerFlow.ts:461) is the TCP state machine. After headers are parsed (line 508, `headersParsed = true`), we can detect `Upgrade: websocket` and branch to WebSocket handling instead of continuing HTTP body assembly.

3. **Route registry**: `RouteRegistryImpl` uses two-tier lookup (exact Map + parameterized Array with compiled regex). WebSocket routes need the same path matching but without HTTP method discrimination. Can reuse `compileRoutePattern` and `normalizePath` utilities.

4. **Module pattern**: Rate limiting, CORS, cookie parser all follow Config → Core → Hook → Constructor integration. WebSocket is slightly different — it's not a hook, it's a protocol branch. But configuration and setup integration follow the same pattern.

5. **Hook system**: `HookRegistryImpl` stores hooks in Sets, executed by `RequestHandlerImpl`. For WS upgrade, we need to run `beforeRouting` hooks by building a lightweight ContextImpl from the upgrade request headers. For WS message lifecycle hooks, we need new hook sets on the registry.

6. **Existing `_looksLikeHttp()`** (line 419): WebSocket upgrade requests ARE valid HTTP (GET with Upgrade header), so they pass this check. The branch point is after header parsing, not before.

7. **Performance patterns in codebase**: The framework already uses `Buffer.concat` only when needed (TCP reassembly), pre-computed limits (`_maxBufferSize` at construction), and boolean guards to skip work (`_accessLogEnabled`). We follow the same patterns for WS.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Frame parser bug causes data corruption or security vuln | Medium | Critical | Extensive unit tests for frame parser (known test vectors, edge cases, malformed frames). This is the highest-risk component. |
| TCP chunk boundary mishandling (frame spans chunks, multiple frames per chunk) | Medium | High | State machine pattern already proven in HTTP handling. Dedicated tests for split-frame and multi-frame-per-chunk scenarios. |
| Breaking existing HTTP handling when adding upgrade detection | Low | Critical | Upgrade detection is a simple header check after existing header parsing. Integration tests for HTTP regression. |
| Memory leak from long-lived connections not being cleaned up | Medium | High | Connection Set with explicit cleanup on close/error/timeout. Tracked in graceful shutdown. |
| Broadcast bottleneck under high subscriber count | Medium | High | Encode-once pattern (frame bytes computed once, written to all subscribers). Channel iteration is O(subscribers) which is unavoidable. |
| Slow client backpressure blocks fast publishers | High | High | Configurable backpressure strategy: `'drop'` (default — stale data is worse than no data for trading) or `'buffer'` with configurable limit. Drain handler for recovery. |
| Hook execution overhead on every WS message | Medium | Medium | wsBeforeMessage/wsAfterMessage hooks are optional. When no hooks registered, zero overhead (boolean guard). |
| Fragmentation + interleaved control frames | Medium | Medium | Separate fragment buffer from control frame handling. Control frames processed immediately regardless of fragment state. |

## Questions

*All previous questions resolved through discussion:*
- ~~API naming~~ → `app.ws('/path', handlers)` confirmed
- ~~Upgrade handler~~ → `upgrade(request)` in handler object, returns data or false
- ~~Pub/sub~~ → Pulled into Milestone 1. `ws.subscribe`/`ws.publish`/`app.publish` API confirmed
- ~~Rate limiting for WS~~ → Deferred to Milestone 2

*All questions resolved:*
- ~~Backpressure default~~ → `'buffer'` (safer general-purpose default). Document `'drop'` option prominently in docs phase for trading/real-time use cases.
- ~~`app.publish()` from HTTP routes~~ → Confirmed. `app.publish('channel', data)` on the YinzerFlow instance for HTTP→WS push.

## Risk Assessment & Rollout Strategy

**Risk level: MEDIUM**

| Criteria | Applies? | Notes |
|---|---|---|
| Touches payments/billing | No | |
| Touches auth/permissions | No | Auth is user-space (upgrade handler + beforeRouting hooks) |
| Raw SQL / literals | No | No database involvement |
| Modifies existing data | No | Additive feature |
| Third-party integration | No | Zero dependencies |
| Changes existing endpoints | **Yes** | Modifies `_handleConnection` TCP state machine |

**Mitigations applied:**
- Implicit feature flag (WS routes only activate if user registers any `app.ws()` routes — zero overhead otherwise) → MEDIUM → LOW
- Comprehensive test coverage (frame parser unit tests + integration tests) → confidence in correctness
- Backward compatible (no WS config = exactly current behavior)

**Rollout plan:**
This is a framework — no progressive rollout. Ships in a minor version bump (0.8.0). The feature is opt-in: if you don't call `app.ws()`, nothing changes.

---

## Roadmap (milestones)

### Milestone 1: Production WebSocket with Pub/Sub — ~3-4 weeks
Users can register WebSocket routes, accept connections with typed per-socket data, send/receive text and binary messages, use channel-based pub/sub with encode-once broadcast, hook into the framework's hook system, and handle disconnects gracefully. Optimized for high-throughput real-time data. Enough for trading platforms, chat, live dashboards, and collaborative apps.
**Flag**: Implicit — active only when `app.ws()` is called (zero overhead otherwise)
**Status**: planned

### Milestone 2: Compression, Heartbeat & Message Rate Limiting — ~1-2 weeks
Per-message deflate compression, automatic heartbeat/keepalive, and message-level rate limiting. Polish for production scale.
**Flag**: Same implicit activation
**Status**: planned
**Depends on**: Milestone 1

---

## Current Milestone: Production WebSocket with Pub/Sub

### Phase 1: WebSocket Constants, Types & Frame Protocol
**PR scope**: RFC 6455 frame parser/encoder with constants and type definitions — the foundational byte-level protocol layer
**Branch**: `feature/ws-frame-protocol`
**Flag**: N/A (no integration yet)
**Est. lines**: ~500
**Objective**: Implement a complete, tested WebSocket frame parser and encoder that can decode incoming masked frames from a TCP byte stream and encode outgoing unmasked frames. This is the hardest, most security-critical piece — it must be bulletproof before anything else builds on it.
**Why this phase exists**: Everything else depends on correct frame-level I/O. Isolating it lets us test it exhaustively without integration complexity.

**Files**:
- `app/constants/websocket.ts` — opcodes, close codes, magic GUID, readyState values
- `app/typedefs/constants/websocket.d.ts` — CreateEnum types for opcodes, close codes, readyState
- `app/typedefs/internal/modules/websocket/index.d.ts` — InternalWebSocketFrame, InternalWebSocketParseResult, parser/connection state types, pub/sub types, hook types
- `app/typedefs/public/WebSocket.d.ts` — Public types: WebSocketHandlers, WebSocketRouteOptions, WebSocket (the ws object), WebSocketUpgradeRequest
- `app/core/modules/websocket/WebSocketFrame.ts` — Frame parser (decode) and encoder (encode)
- `app/core/modules/websocket/__tests__/WebSocketFrame.test.ts` — Unit tests

**Steps**:
1. Create `constants/websocket.ts` with:
   - `wsOpcode` object: `{ continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xA }` as const
   - `wsCloseCode` object: `{ normal: 1000, goingAway: 1001, protocolError: 1002, unsupported: 1003, noStatus: 1005, abnormal: 1006, invalidPayload: 1007, policyViolation: 1008, tooLarge: 1009, missingExtension: 1010, internalError: 1011 }` as const
   - `wsReadyState` object: `{ connecting: 0, open: 1, closing: 2, closed: 3 }` as const
   - `wsMagicGuid`: `'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'`
   - `wsBackpressureStrategy` object: `{ buffer: 'buffer', drop: 'drop' }` as const

2. Create `typedefs/constants/websocket.d.ts` with CreateEnum types for each constant object

3. Create `typedefs/internal/modules/websocket/index.d.ts` with:
   - `InternalWebSocketFrame`: `{ fin: boolean; opcode: number; masked: boolean; payloadLength: number; payload: Buffer }`
   - `InternalWebSocketParseResult`: `{ frame: InternalWebSocketFrame; bytesConsumed: number } | null` (null = incomplete, need more data)
   - `InternalWebSocketChannel`: `{ subscribers: Set<WebSocketConnection>; }`
   - `InternalWebSocketHookSets`: types for WS-specific hook storage

4. Create `typedefs/public/WebSocket.d.ts` with:
   - `WebSocket<T = unknown>`: `{ send(data: string | Buffer): void; sendRaw(encodedFrame: Buffer): void; close(code?: number, reason?: string): void; ping(data?: Buffer): void; subscribe(channel: string): void; unsubscribe(channel: string): void; publish(channel: string, data: string | Buffer): number; isSubscribed(channel: string): boolean; readonly data: T; readonly readyState: number; readonly remoteAddress: string; readonly bufferedAmount: number }`
   - `WebSocketHandlers<T = unknown>`: `{ upgrade?(request: WebSocketUpgradeRequest): T | false | Promise<T | false>; open?(ws: WebSocket<T>): void; message?(ws: WebSocket<T>, data: string | Buffer, isBinary: boolean): void; close?(ws: WebSocket<T>, code: number, reason: string): void; error?(ws: WebSocket<T>, error: Error): void; drain?(ws: WebSocket<T>): void }`
   - `WebSocketRouteOptions`: `{ maxPayloadLength?: number; idleTimeout?: number; backpressure?: { strategy: 'buffer' | 'drop'; limit?: number } }`
   - `WebSocketUpgradeRequest`: `{ headers: Record<string, string>; path: string; query: Record<string, string>; remoteAddress: string; params: Record<string, string> }`

5. Implement `WebSocketFrame.ts` (performance-critical — minimize allocations):
   - `_parseFrame(buffer: Buffer, offset: number): InternalWebSocketParseResult` — Reads frame header (2+ bytes), determines payload length (7-bit, 16-bit, or 64-bit extended), reads masking key if present, extracts and unmasks payload. Returns null if buffer doesn't contain a complete frame. Uses `buffer.subarray` (no copy) for payload extraction where possible.
   - `_encodeFrame(opcode: number, payload: Buffer, fin?: boolean): Buffer` — Encodes an outgoing frame (server never masks). Uses `Buffer.allocUnsafe` for the frame buffer. Handles payload length encoding (7-bit, 16-bit, 64-bit). Returns the complete frame as a single Buffer ready for `socket.write`.
   - `_encodeCloseFrame(code: number, reason?: string): Buffer` — Convenience for close frames (2-byte BE code + optional reason text).
   - `_unmask(payload: Buffer, maskKey: Buffer): void` — XOR unmask **in-place** (no allocation — mutates the payload subarray directly). 4-byte rotating key.

6. Write comprehensive unit tests:
   - Small text frame (7-bit length)
   - Medium frame (16-bit extended length, 126-65535 bytes)
   - Large frame (64-bit extended length, >65535 bytes)
   - Binary frame
   - Masked frame (client→server) — verify unmasking
   - Unmasked frame encoding (server→client)
   - Control frames: ping, pong, close with code+reason
   - Incomplete buffer → returns null
   - Multiple frames in one buffer (parse returns bytesConsumed, caller advances)
   - Fragmented message frames (FIN=0, continuation opcode)
   - Zero-length payload
   - Close frame with only status code (no reason)
   - Close frame with no payload at all
   - **Perf**: Verify `_unmask` modifies buffer in-place (no new allocation)
   - **Perf**: Verify `_encodeFrame` uses `allocUnsafe` (check via Buffer.isBuffer, ensure correct output)

**Quality gate**:
- [ ] Frame parser handles all payload length encodings (7-bit, 16-bit, 64-bit)
- [ ] Unmasking is in-place (XOR with 4-byte rotating key, no allocation)
- [ ] Parser returns null for incomplete data (no crash, no partial parse)
- [ ] Encoder never masks server frames (per RFC 6455 §5.1)
- [ ] Encoder uses `Buffer.allocUnsafe` (perf: skip zero-fill)
- [ ] All control frame payloads are ≤125 bytes (per RFC 6455 §5.5)
- [ ] Close frame encodes status code as 2-byte big-endian unsigned integer
- [ ] No `any` types, no non-null assertions

**Verification**: `bun test app/core/modules/websocket/__tests__/WebSocketFrame.test.ts`

---

### Phase 2: WebSocket Handshake & Connection Class
**PR scope**: Upgrade handshake validation/response and the WebSocketConnection class that manages a single connection's lifecycle with backpressure awareness
**Branch**: `feature/ws-connection`
**Flag**: N/A (no integration yet)
**Est. lines**: ~500
**Objective**: Implement the HTTP→WebSocket upgrade handshake per RFC 6455 §4.2 and a connection class that wraps a raw TCP socket, manages frame-level I/O, handles fragmentation reassembly, exposes the user-facing `ws` API (send, close, ping), and tracks backpressure state.
**Why this phase exists**: Phase 1 gave us frame-level I/O. This phase builds connection-level abstractions on top — the handshake to establish connections, and the state machine to manage them. Backpressure tracking is built into the connection from the start since it's fundamental to the high-throughput use case.

**Files**:
- `app/core/modules/websocket/WebSocketHandshake.ts` — Handshake validation and response generation
- `app/core/modules/websocket/WebSocketConnection.ts` — Connection class wrapping socket + frames
- `app/core/modules/websocket/__tests__/WebSocketHandshake.test.ts` — Handshake unit tests
- `app/core/modules/websocket/__tests__/WebSocketConnection.test.ts` — Connection unit tests

**Steps**:
1. Implement `WebSocketHandshake.ts`:
   - `_isWebSocketUpgrade(headersStr: string): boolean` — Check for `Upgrade: websocket` + `Connection: Upgrade` (case-insensitive)
   - `_validateHandshake(headersStr: string): { valid: true; key: string; origin: string | undefined; path: string; protocols: Array<string>; query: Record<string, string> } | { valid: false; reason: string }` — Validates Sec-WebSocket-Key (base64, 16 bytes decoded), Sec-WebSocket-Version (must be 13), extracts origin, path, query string, protocol list
   - `_generateAcceptKey(clientKey: string): string` — SHA-1 hash of `key + wsMagicGuid`, base64 encoded
   - `_buildHandshakeResponse(acceptKey: string, protocol?: string): string` — HTTP 101 response string with correct headers

2. Implement `WebSocketConnection.ts` (class — lifecycle management + shared socket state):
   - Constructor takes: `socket: Socket`, `data: T`, `handlers: WebSocketHandlers<T>`, `options: { maxPayloadLength, idleTimeout, backpressure: { strategy, limit } }`
   - Internal state: `_readyState`, `_socket`, `_data`, `_fragmentBuffer: Array<Buffer>`, `_fragmentOpcode: number`, `_receiveBuffer: Buffer`, `_bufferedAmount: number`, `_backpressured: boolean`
   - **Data sending**:
     - `send(data: string | Buffer): void` — Encode text/binary frame and write. If backpressured with `'drop'` strategy, silently discard. If `'buffer'` strategy, check limit → queue or close(1009).
     - `sendRaw(encodedFrame: Buffer): void` — Write pre-encoded frame bytes directly (used by pub/sub encode-once broadcast). Same backpressure logic.
     - `close(code?: number, reason?: string): void` — Send close frame, transition to CLOSING.
     - `ping(data?: Buffer): void` — Send ping frame (payload ≤125 bytes).
   - **Data receiving** (`_onSocketData(chunk: Buffer): void`):
     - Append chunk to `_receiveBuffer`, parse frames in a loop.
     - Control frames: ping → pong (echo payload), pong → no-op, close → echo close + CLOSED.
     - Data frames: FIN=1 no frag → deliver. FIN=0 → accumulate fragments. Continuation + FIN=1 → concat + deliver.
     - Max payload: check frame header's payloadLength BEFORE buffering. If exceeded → close(1009).
   - **Backpressure tracking**:
     - Listen to `socket.write()` return value. `false` → `_backpressured = true`, increment `_bufferedAmount`.
     - `socket.on('drain')` → `_backpressured = false`, reset `_bufferedAmount`, call `handlers.drain(ws)`.
     - `bufferedAmount` getter for user inspection.
   - **Lifecycle**:
     - `_onSocketClose()` → CLOSED, call close handler
     - `_onSocketError(error)` → call error handler, destroy socket
     - Idle timeout: `setTimeout` reset on every received frame. On timeout → close + destroy.
   - Getters: `readyState`, `data`, `remoteAddress`, `bufferedAmount`

3. Write handshake tests:
   - Valid upgrade request → generates correct accept key
   - Known test vector: key `dGhlIHNhbXBsZSBub25jZQ==` → accept `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=` (RFC 6455 §4.2.2 example)
   - Missing Sec-WebSocket-Key → validation fails
   - Wrong Sec-WebSocket-Version → validation fails
   - Case-insensitive header matching
   - Query string extraction from upgrade path

4. Write connection tests:
   - Send text message → correct frame written to socket
   - Send binary message → correct frame written to socket
   - Receive ping → pong sent automatically with same payload
   - Receive close → close echoed, socket destroyed
   - Close initiated by server → close frame sent, state transitions to CLOSING
   - Fragmented message reassembly (3 fragments → one complete message delivered)
   - Control frame interleaved between fragments → control handled, fragments still reassemble correctly
   - Max payload exceeded → close(1009) sent, socket destroyed
   - Idle timeout → close sent, socket destroyed
   - **Backpressure**: socket.write returns false → backpressured state. Send during backpressure with `'drop'` → message silently dropped. `'buffer'` strategy → message queued until limit.
   - **Backpressure drain**: socket drain event → backpressured clears, drain handler called
   - `sendRaw` writes pre-encoded buffer directly (no re-encoding)

**Quality gate**:
- [ ] Handshake accept key matches RFC 6455 test vector exactly
- [ ] Connection state machine: OPEN → CLOSING → CLOSED transitions are correct
- [ ] Fragment reassembly handles interleaved control frames
- [ ] Max payload check happens on frame header, before buffering payload
- [ ] Idle timeout resets on every received frame
- [ ] Server close frame always includes status code
- [ ] No data delivered to handlers after readyState is CLOSED
- [ ] Backpressure tracking works: write returns false → backpressured, drain → cleared
- [ ] Drop strategy silently discards during backpressure (no error, no queue growth)

**Verification**: `bun test app/core/modules/websocket/__tests__/`

---

### Phase 3: YinzerFlow Integration + Hook System
**PR scope**: Wire WebSocket into the framework — `app.ws()` registration, upgrade detection in TCP handler, configuration, hook system integration (beforeRouting on upgrade + WS lifecycle hooks)
**Branch**: `feature/ws-integration`
**Flag**: Implicit (active only when WS routes registered)
**Est. lines**: ~500
**Objective**: Connect the WebSocket module to the YinzerFlow class. Users can call `app.ws('/path', handlers)` to register routes. The TCP connection handler detects upgrade requests, runs beforeRouting hooks (for auth, CORS, rate limiting), then routes to the WebSocket module. WS-specific lifecycle hooks (`wsBeforeMessage`, `wsAfterMessage`) are available for cross-cutting concerns.
**Why this phase exists**: Phases 1-2 built the protocol layer in isolation. This phase integrates it into the framework and — critically — connects it to the hook system so that existing middleware (auth, CORS, logging) works on WebSocket connections.

**Files**:
- `app/core/modules/websocket/WebSocketRouter.ts` — WS route registry (exact + parameterized path matching)
- `app/core/modules/websocket/WebSocketConfig.ts` — Config normalization and validation
- Modify `app/core/setup/SetupImpl.ts` — Add `ws()`, `wsBeforeMessage()`, `wsAfterMessage()` methods
- Modify `app/typedefs/public/Setup.d.ts` — Add WS methods to Setup interface
- Modify `app/typedefs/internal/InternalConfiguration.d.ts` — Add `InternalWebSocketOptions` + field on `InternalServerOptions`
- Modify `app/core/execution/HookRegistryImpl.ts` — Add WS hook sets
- Modify `app/typedefs/internal/InternalHookRegistryImpl.d.ts` — Add WS hook types
- Modify `app/core/setup/utils/handleCustomConfiguration.ts` — Add WS defaults + validation
- Modify `app/core/YinzerFlow.ts` — Upgrade detection, beforeRouting hook execution on upgrade, WS route dispatch, hook execution on messages

**Steps**:
1. Create `WebSocketRouter.ts`:
   - Reuse `compileRoutePattern` and `normalizePath` from existing route utils
   - `_register(path: string, handlers: WebSocketHandlers, options?: WebSocketRouteOptions)` — Store route with compiled pattern
   - `_match(path: string): { handlers, options, params } | undefined` — Exact lookup first, then parameterized
   - `_hasRoutes(): boolean` — Used by YinzerFlow to know if WS is active (implicit flag)

2. Create `WebSocketConfig.ts`:
   - Default config: `{ maxPayloadLength: 16_777_216 (16MB), idleTimeout: 120 (seconds), maxConnectionsPerIp: 50, allowedOrigins: [], backpressure: { strategy: 'buffer', limit: 1_048_576 (1MB) } }`
   - Validation: maxPayloadLength ≥ 1, idleTimeout ≥ 0, maxConnectionsPerIp ≥ 1, backpressure.limit ≥ 0
   - Warnings: maxPayloadLength > 64MB, idleTimeout === 0 (no timeout)

3. Add WS hook sets to `HookRegistryImpl`:
   - `_wsBeforeMessage: Set<{ handler, options? }>` — Runs before each WS message is delivered to the route handler
   - `_wsAfterMessage: Set<{ handler, options? }>` — Runs after each WS message handler completes
   - Registration methods: `_addWsBeforeMessageHooks()`, `_addWsAfterMessageHooks()`
   - Hook handler signature: `(ws: WebSocket, data: string | Buffer, isBinary: boolean) => void | Promise<void>`

4. Add methods to `SetupImpl`:
   - `ws<T>(path: string, handlers: WebSocketHandlers<T>, options?: WebSocketRouteOptions): void` — Delegates to `_wsRouter`
   - `wsBeforeMessage(handlers: Array<WsMessageHook>): void` — Global WS message hooks
   - `wsAfterMessage(handlers: Array<WsMessageHook>): void` — Global WS message hooks

5. Add `InternalWebSocketOptions` to `InternalConfiguration.d.ts`:
   - `maxPayloadLength: number`, `idleTimeout: number`, `maxConnectionsPerIp: number`, `allowedOrigins: Array<string>`, `backpressure: { strategy: 'buffer' | 'drop'; limit: number }`

6. Add `websocket?: InternalWebSocketOptions` to `InternalServerOptions`

7. Add WS defaults to `handleCustomConfiguration.ts`:
   - Add `DEFAULT_WEBSOCKET_CONFIG` constant
   - Add `_handleWebSocketConfig` handler (merge + validate + warn)
   - Add `'websocket'` to `DEEP_MERGE_KEYS` set

8. Modify `_handleConnection()` in `YinzerFlow.ts`:
   - Early exit: if `!this._wsRouter?._hasRoutes()`, skip all WS detection (zero overhead)
   - After `headersParsed = true`, before Content-Length parsing:
     - Call `_isWebSocketUpgrade(headersStr)` to check
     - If upgrade:
       a. Parse headers into a lightweight context (reuse ContextImpl or build minimal WS-specific context)
       b. Run `beforeRouting` hooks on the upgrade context — if any short-circuit, send that HTTP response and close socket (this gives users CORS, auth, rate limiting on WS for free)
       c. Match WS route → if no match, respond 404
       d. Call `upgrade(request)` handler → if returns false, respond 403
       e. Send 101 handshake response
       f. Create `WebSocketConnection`, add to `_wsConnections` Set
       g. Wire message delivery through WS hooks: `wsBeforeMessage` → `handlers.message` → `wsAfterMessage`
       h. Call `open` handler
       i. Rewire socket `data` event to `connection._onSocketData`
     - If not upgrade: continue existing HTTP flow (unchanged)

9. Modify `close()` in `YinzerFlow.ts`:
   - If `_wsConnections` has entries, send close frame to each and wait briefly for echoes before destroying

**Quality gate**:
- [ ] `app.ws()` follows same registration pattern as `app.get()` etc.
- [ ] `beforeRouting` hooks run on upgrade requests (auth, CORS work on WS connections)
- [ ] WS lifecycle hooks (`wsBeforeMessage`, `wsAfterMessage`) execute around message handlers
- [ ] Zero overhead when no `app.ws()` calls (no Set allocated, no header checks, no hook overhead)
- [ ] Config validation catches invalid values with clear error messages
- [ ] Route matching reuses existing path compilation utilities
- [ ] Graceful shutdown closes all WS connections before server shuts down

**Verification**: Manual test with a simple echo server + browser WebSocket client. `bun test` for full regression.

---

### Phase 4: Channel-Based Pub/Sub with Encode-Once Broadcast
**PR scope**: Channel subscription system with high-performance broadcast — encode frame once, write raw bytes to all subscribers
**Branch**: `feature/ws-pubsub`
**Flag**: N/A (additive to existing WS support)
**Est. lines**: ~400
**Objective**: Implement channel-based pub/sub where clients subscribe to named channels and receive pushed messages. The critical performance feature is encode-once broadcast: when publishing to a channel, the WebSocket frame is encoded once into raw bytes, then those exact bytes are written to every subscriber's socket via `sendRaw`. This avoids per-subscriber serialization — essential for high-throughput trading data where one quote update goes to thousands of subscribers.
**Why this phase exists**: Pub/sub is the immediate need (trading quote distribution). Without encode-once broadcast, publishing to N subscribers means encoding the same frame N times — O(N × messageSize) work that should be O(messageSize + N × write).

**Files**:
- `app/core/modules/websocket/WebSocketChannelManager.ts` — Channel subscription and broadcast engine
- Modify `app/core/modules/websocket/WebSocketConnection.ts` — Add subscribe/unsubscribe/publish/isSubscribed methods
- Modify `app/core/YinzerFlow.ts` — Add `publish()` and `subscriberCount()` instance methods, wire channel cleanup on connection close
- Modify `app/typedefs/public/WebSocket.d.ts` — Already defined in Phase 1 (subscribe/unsubscribe/publish on WebSocket type)
- `app/core/modules/websocket/__tests__/WebSocketChannelManager.test.ts` — Pub/sub unit tests
- `app/core/modules/websocket/__tests__/websocket.pubsub.integration.test.ts` — Pub/sub integration tests

**Steps**:
1. Implement `WebSocketChannelManager.ts`:
   - `_channels: Map<string, Set<WebSocketConnection>>` — Channel → subscriber set
   - `_subscriptions: Map<WebSocketConnection, Set<string>>` — Connection → channels (for fast cleanup on disconnect)
   - `subscribe(connection: WebSocketConnection, channel: string): void` — Add to both maps
   - `unsubscribe(connection: WebSocketConnection, channel: string): void` — Remove from both maps. Delete channel entry if empty (prevents memory leak from abandoned channels).
   - `unsubscribeAll(connection: WebSocketConnection): void` — Remove from all channels (called on disconnect). O(channels-subscribed) not O(total-channels).
   - `publish(channel: string, data: string | Buffer, sender?: WebSocketConnection): number`:
     a. Encode the data into a WebSocket frame ONCE using `_encodeFrame` (text for string, binary for Buffer)
     b. Get subscriber Set for channel
     c. Iterate subscribers, call `connection.sendRaw(encodedFrame)` for each (skipping sender if provided)
     d. Return number of recipients
   - `subscriberCount(channel: string): number` — Returns subscriber count (0 if channel doesn't exist)
   - `channels(): Array<string>` — List active channels (useful for monitoring)

2. Add methods to `WebSocketConnection`:
   - `subscribe(channel: string): void` — Delegates to channel manager
   - `unsubscribe(channel: string): void` — Delegates to channel manager
   - `publish(channel: string, data: string | Buffer): number` — Delegates to channel manager (sender = this connection, so sender doesn't get their own message)
   - `isSubscribed(channel: string): boolean` — Check via connection's subscription set
   - On connection close/error: call `channelManager.unsubscribeAll(this)` automatically

3. Add `publish()` and `subscriberCount()` to `YinzerFlow`:
   - `publish(channel: string, data: string | Buffer): number` — Delegates to channel manager. This is the server-level publish for HTTP route → WS broadcast.
   - `subscriberCount(channel: string): number` — Monitoring/debugging

4. Write unit tests for channel manager:
   - Subscribe → appears in channel set and connection's subscription set
   - Unsubscribe → removed from both
   - Publish → all subscribers receive encoded frame via sendRaw
   - Publish with sender → sender excluded from broadcast
   - `unsubscribeAll` → connection removed from all channels
   - Empty channel after last unsubscribe → channel entry deleted (no memory leak)
   - `subscriberCount` returns correct count
   - Publish to non-existent channel → returns 0, no error

5. Write integration tests:
   - Two clients subscribe to same channel → publish reaches both
   - Client subscribes to multiple channels → receives from all
   - Client unsubscribes → stops receiving
   - Client disconnects → automatically unsubscribed from all channels
   - `app.publish()` from outside WS handler (simulating HTTP→WS push)
   - High-volume publish: verify encode-once (message encoded once regardless of subscriber count — verify by checking `_encodeFrame` call count or by checking all subscribers receive identical Buffer reference)
   - Backpressure during broadcast: slow subscriber with `'drop'` strategy → doesn't block fast subscribers

**Quality gate**:
- [ ] Encode-once: frame bytes computed once per publish, same Buffer written to all subscribers
- [ ] `unsubscribeAll` is O(subscriptions-per-connection), not O(total-channels)
- [ ] Empty channels are cleaned up (no memory leak from stale channel names)
- [ ] `publish` skips sender (no echo back to publisher by default)
- [ ] `app.publish()` works from non-WS context (HTTP routes, timers, etc.)
- [ ] Backpressured subscribers don't block the broadcast loop
- [ ] No `any` types

**Verification**: `bun test app/core/modules/websocket/__tests__/`

---

### Phase 5: Security, Connection Limits & Integration Tests
**PR scope**: Origin validation, connection limits, comprehensive integration tests covering the full stack
**Branch**: `feature/ws-security-tests`
**Flag**: N/A
**Est. lines**: ~450
**Objective**: Harden the WebSocket implementation with security controls (origin validation, per-IP connection limits) and write comprehensive integration tests that exercise the full stack — real TCP connections, real WebSocket handshakes, real message exchange, pub/sub, hooks.
**Why this phase exists**: Phases 1-4 built the feature. This phase proves it works end-to-end and hardens it against abuse.

**Files**:
- `app/core/modules/websocket/WebSocketSecurity.ts` — Origin validation, connection tracking per IP
- Modify `app/core/YinzerFlow.ts` — Wire in security checks during upgrade
- `app/core/modules/websocket/__tests__/websocket.integration.test.ts` — Full integration tests
- `app/core/modules/websocket/__tests__/websocket.security.test.ts` — Security-specific tests

**Steps**:
1. Implement `WebSocketSecurity.ts`:
   - `_validateOrigin(origin: string | undefined, allowedOrigins: Array<string>): boolean` — Empty allowedOrigins = allow all. Otherwise case-insensitive match against list. Missing origin header on a browser request = reject.
   - `_connectionTracker`: Map<string, number> tracking active connections per IP. Increment on connect, decrement on close.
   - `_canConnect(ip: string, maxPerIp: number): boolean` — Check current count < max.

2. Wire security into upgrade flow in `YinzerFlow.ts`:
   - Before handshake acceptance: validate origin against config
   - Before connection creation: check connection limit
   - On connection close: decrement counter
   - Rejected upgrades: respond with 403 (bad origin) or 429 (too many connections) HTTP response

3. Write integration tests:
   - **Core**: connect, send text, receive echo, close cleanly
   - **Binary**: binary message round-trip
   - **Per-socket data**: upgrade handler returns data, accessible in message/close handlers
   - **Multiple connections**: concurrent connections on same server
   - **Upgrade rejection**: handler returns false → 403 response
   - **Graceful shutdown**: server close() sends close frames to all connected clients
   - **HTTP regression**: non-WebSocket request to WS-enabled server still works as normal HTTP
   - **404**: HTTP request to non-existent route → normal 404; WS upgrade to non-existent WS path → 404
   - **Hook integration**: beforeRouting hook short-circuits upgrade → HTTP error response returned
   - **WS message hooks**: wsBeforeMessage runs before handler, wsAfterMessage runs after
   - **Pub/sub integration**: subscribe, publish, broadcast, unsubscribe, auto-cleanup
   - **Server publish**: `app.publish()` from outside WS context reaches subscribers

4. Write security tests:
   - Valid origin → accepted
   - Invalid origin → 403
   - No origin (non-browser client) with empty allowedOrigins → accepted
   - Connection limit exceeded → 429
   - Oversized frame → connection closed with 1009
   - Malformed handshake (bad key, wrong version) → 400 Bad Request

**Quality gate**:
- [ ] Origin validation is case-insensitive for scheme+host
- [ ] Connection counter never goes negative (decrement only if was tracked)
- [ ] Rejected upgrades return proper HTTP error responses (not just socket.destroy)
- [ ] Integration tests use real network I/O, not mocks
- [ ] HTTP regression: all existing tests still pass
- [ ] Hook integration tested (beforeRouting on upgrade, wsBeforeMessage/wsAfterMessage)
- [ ] Pub/sub tested end-to-end with real connections
- [ ] No new `any` types

**Verification**: `bun test` (full suite including new integration tests)

---

### Phase 6: Exports, Documentation & Verification Sweep
**PR scope**: Public API exports, comprehensive documentation, final cleanup
**Branch**: `feature/ws-docs-exports`
**Flag**: N/A
**Est. lines**: ~400
**Objective**: Export WebSocket types and constants from the public API, write framework-quality documentation covering all features (including pub/sub, hooks, backpressure, trading data patterns), and perform the final verification sweep.
**Why this phase exists**: The feature is built and tested but not yet publicly accessible or documented. This phase makes it ship-ready.

**Files**:
- Modify `app/index.ts` — Export WebSocket-related constants
- `docs/core/websockets.md` — Full documentation following docs template
- Verify/update `docs/configuration/configuration.md` — Add websocket config section
- Verification sweep of all changes

**Steps**:
1. Update `app/index.ts`:
   - Export `wsOpcode`, `wsCloseCode`, `wsReadyState`, `wsBackpressureStrategy` from constants
   - No runtime function exports needed (ws() is a method on the YinzerFlow instance)

2. Write `docs/core/websockets.md` following the docs template:
   - **Overview**: What WebSocket support provides, when to use it
   - **Settings**: All config options with defaults (maxPayloadLength, idleTimeout, maxConnectionsPerIp, allowedOrigins, backpressure)
   - **Usage**:
     - `app.ws()` API, handler signatures, per-socket typed data
     - Pub/sub: `ws.subscribe`, `ws.unsubscribe`, `ws.publish`, `app.publish`
     - Hook integration: `wsBeforeMessage`, `wsAfterMessage`, `beforeRouting` on upgrade
     - Backpressure: strategies, `drain` handler, `bufferedAmount`
   - **Best Practices**: Connection cleanup, authentication in upgrade, channel naming conventions
   - **Examples**:
     - Echo server (dev)
     - Authenticated chat with channels (production)
     - Real-time data distribution (trading pattern: HTTP ingest → `app.publish` → WS subscribers)
   - **Performance Notes**: Encode-once broadcast, backpressure strategies, connection limits
   - **Security Notes**: Origin validation, payload limits, connection limits, auth via beforeRouting hooks
   - **Troubleshooting**: Common issues (CORS, missing upgrade headers, connection drops, backpressure)

3. Update `docs/configuration/configuration.md`:
   - Add `websocket` section alongside existing logging/cors/bodyParser/ipSecurity/rateLimit docs

4. Verification sweep:
   - Grep for TODO/FIXME/HACK in new files
   - Verify all todos items are done
   - Run full test suite
   - Run lint
   - Type check

**Quality gate**:
- [ ] All WebSocket constants exported from index.ts
- [ ] Public types available via `import type { WebSocket, WebSocketHandlers } from 'yinzerflow'`
- [ ] Documentation follows existing template (emojis, color spans, settings format)
- [ ] Trading data pattern example is copy-pasteable and functional
- [ ] No orphaned TODOs in code
- [ ] `bun test` passes, `bun run lint` clean

**Verification**: `bun test && bun run lint`

---

## Anti-Pattern Check

- **Splitting into commits instead of PRs** → ❌ avoided: each phase is a separate branch + PR, 400-500 lines each
- **Shadow main branches** → ❌ avoided: every PR targets main, each phase is independently coherent
- **Building the engine before shipping value** → ❌ avoided: Milestone 1 delivers complete WS + pub/sub. Frame protocol (Phase 1) is tested in isolation, but the milestone isn't "done" until Phase 6. No "build infra first, ship later."
- **Hotfix that isn't** → ❌ N/A: this is a feature, not a hotfix
- **Abandoned branches** → ❌ avoided: phases are scoped to 2-3 days each max
- **Flag graveyards** → ❌ avoided: implicit activation (ws routes registered = active), no flag to clean up

## Quality Checklist (verify at completion)

- [ ] All inputs validated (handshake headers, frame headers, payload sizes, channel names)
- [ ] No new endpoints exposed (WS routes are user-defined)
- [ ] Error handling: specific close codes per RFC 6455, no stack traces to client
- [ ] No SQL injection, XSS, path traversal, or secret exposure (N/A — no DB, no HTML, no filesystem, no secrets)
- [ ] Performance: encode-once broadcast, in-place unmasking, allocUnsafe for outgoing frames, backpressure handling
- [ ] Tests: handshake, framing, connection lifecycle, fragmentation, pub/sub, hooks, security, integration
- [ ] Existing tests still pass (HTTP regression)
- [ ] Types are complete (no `any`, no non-null assertions)
- [ ] Follows existing codebase conventions (module pattern, underscore privates, camelCase constants)
