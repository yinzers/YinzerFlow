# Plan: WebSocket Milestone 2 — Hardening

Created: 2026-04-24
Status: pending_approval

---

## Context & Why

**Goal**: Add heartbeat/keepalive, message rate limiting, and permessage-deflate compression to YinzerFlow's WebSocket implementation.

**Why**: Milestone 1 shipped the core protocol, pub/sub, and security (v0.8.0). These three features are production hardening — without them, dead connections accumulate silently, misbehaving clients can flood handlers, and bandwidth is wasted on compressible data. The user's primary use case is trading data distribution where all three are important: heartbeat detects dropped trader connections, rate limiting prevents abuse, and compression reduces bandwidth for JSON quote streams.

**Background**: Milestone 1 (6 phases, ~3000 lines, 129 tests) built raw RFC 6455 over TCP with pub/sub and an encode-once broadcast pattern. All three M2 features are internal with new configuration options — no handler signature changes. The existing `idleTimeout` handles idle connections but can't detect half-open TCP connections (network died without clean close).

**Success criteria**:
- Server detects and closes dead connections within one heartbeat interval
- Per-connection message rate limiting with configurable thresholds
- permessage-deflate negotiation, compression/decompression, broadcast-safe
- All existing tests pass, new tests for each feature
- Docs updated

---

## Research Findings

### Heartbeat
- Connection already auto-replies to client pings (line 267-274 of WebSocketConnection.ts) and has a public `ping()` method
- Pong handler currently does nothing (line 276-278) — needs to track liveness
- The `ws` library uses a two-state sweep pattern: mark dead, send ping, check at next sweep. One `setInterval` for all connections — O(1) timers regardless of connection count

### Message Rate Limiting
- Token bucket is O(1) per message vs sliding window O(maxMessages) — use token bucket
- Rate check belongs in `_deliverMessage()` (after fragment reassembly, before handler call) — only complete messages count
- Control frames (ping/pong/close) must NOT be rate-limited

### Compression (permessage-deflate, RFC 7692)
- **Critical finding**: Context takeover breaks encode-once broadcast. Each connection has unique zlib state, so compressed bytes for connection A can't be sent to connection B. Solution: **no-context-takeover only** for v1 — compressed frame is connection-independent, preserving broadcast.
- Negotiation via `Sec-WebSocket-Extensions` header in handshake request/response
- RSV1 bit marks compressed frames — only on FIRST fragment of data frames, never on control frames
- Frame parser currently **ignores RSV bits entirely** (`byte0 & 0x0f` discards them). Must extract RSV1 and validate RSV2/RSV3 = 0.
- Compression: deflateRawSync with `finishFlush: Z_SYNC_FLUSH`, strip trailing `0x00 0x00 0xFF 0xFF`
- Decompression: append `0x00 0x00 0xFF 0xFF`, inflateRawSync
- `deflateRawSync`/`inflateRawSync` available in Bun (zlib-ng with SIMD acceleration)
- With no-context-takeover, sync one-shot ops are ideal — no state to preserve between messages
- Memory at windowBits=11: ~10-20KB per operation vs ~300KB at windowBits=15. Compression ratio: 68-74% vs 73-77%. windowBits=11 is the sweet spot.
- Fragmented compressed messages: compress whole message, split compressed output into fragments. Decompress by concatenating all fragment payloads, then decompressing.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Compression breaks encode-once broadcast | Eliminated | High | v1: no-context-takeover only; compressed frame is identical for all recipients |
| zlib sync ops block event loop on large payloads | Low | Medium | `threshold` skips small msgs; `maxPayloadLength` caps large msgs; zlib-ng SIMD is fast |
| Heartbeat sweep timer leaks on shutdown | Low | High | Clear interval in existing graceful shutdown path (`_handleServerClose`) |
| RSV1 changes break uncompressed clients | Low | High | RSV1 only set when compression negotiated; existing uncompressed path unchanged |
| Fragmented compressed message edge cases | Medium | Medium | Follow RFC 7692 exactly: compress whole message, split output; decompress concatenated fragments |
| Rate limit false positives from burst traffic | Low | Low | Token bucket with continuous refill handles bursts naturally; configurable thresholds |

---

## Questions

1. **Heartbeat default**: I'm defaulting to **enabled** (30s interval). For trading data, silent dead connections waste resources. Any reason to default to disabled?
2. **Rate limit action**: When exceeded, close connection with code 1008 (policy violation). Alternative: drop messages silently. Close is clearer — thoughts?

---

## Risk Assessment & Rollout Strategy

**Risk level: LOW**

| Criteria | Applies? | Notes |
|---|---|---|
| Touches payments/billing | No | |
| Touches auth/permissions | No | |
| Raw SQL / literals | No | |
| Modifies existing data | No | |
| Third-party integration | No | |
| Changes existing endpoints | No | All new config options default to current behavior |

All three features are additive:
- Heartbeat defaults to enabled but is purely internal (no breaking change)
- Rate limiting defaults to disabled (opt-in)
- Compression defaults to disabled (opt-in)

No feature flags needed — this is a framework library, not an application. Users control behavior via config.

---

## Phases

### Phase 1: Heartbeat/Keepalive
**Commit scope**: Server-initiated ping/pong dead connection detection
**Est. lines**: ~200
**Objective**: Detect and close half-open TCP connections that didn't cleanly disconnect. Uses the efficient two-state sweep pattern (one `setInterval` for all connections, O(1) timers).
**Why this phase exists**: Without heartbeat, a client whose network dies leaves a ghost connection consuming memory and receiving broadcast data that goes nowhere.

**Config shape**:
```typescript
heartbeat: {
  enabled: boolean;   // @default true
  interval: number;   // seconds between pings / dead detection window. @default 30
}
```

**Files**:
- `app/typedefs/internal/InternalConfiguration.d.ts` — add `heartbeat` to `InternalWebSocketOptions`
- `app/typedefs/public/WebSocket.d.ts` — add optional `heartbeat` to `WebSocketRouteOptions` (per-route interval override)
- `app/core/modules/websocket/WebSocketConfig.ts` — defaults + validation (interval >= 1)
- `app/core/modules/websocket/WebSocketConnection.ts` — add `_isAlive` boolean, set `true` on pong receipt + any data, expose `_checkAlive()` / `_markForPing()` for sweep
- `app/core/YinzerFlow.ts` — single `setInterval` sweep: check `_isAlive`, close dead connections, send pings. Clear on graceful shutdown.
- `app/core/modules/websocket/__tests__/WebSocketHeartbeat.test.ts` — NEW: heartbeat tests (pong resets liveness, missed pong triggers close, sweep timer, disabled config)

**Steps**:
1. Add `heartbeat` interface to `InternalWebSocketOptions` (enabled: boolean, interval: number)
2. Add optional `heartbeat` to `WebSocketRouteOptions` for per-route override
3. Add defaults to `DEFAULT_WEBSOCKET_CONFIG`: `{ enabled: true, interval: 30 }`
4. Add validation: `interval >= 1` when enabled
5. Add warning when heartbeat disabled: "Dead connections won't be detected automatically"
6. In `WebSocketConnection`: add `_isAlive = true` field. In `_handleControlFrame` pong handler: set `_isAlive = true`. In `_onSocketData`: set `_isAlive = true` (any data = alive). Add `_checkAlive(): boolean` (returns and resets `_isAlive`).
7. In `YinzerFlow`: start sweep `setInterval` when first WS connection opens (lazy). On each tick: iterate `_wsConnections`, close connections where `_checkAlive()` returns false, then send ping to remaining. Clear interval on graceful shutdown.
8. Merge heartbeat config in `_mergeWsConnectionOptions`
9. Tests: pong receipt resets liveness, missed pong closes connection, data receipt resets liveness, sweep timer lifecycle, disabled heartbeat skips sweep

**Quality gate**:
- [ ] Sweep timer cleared on graceful shutdown (no leak)
- [ ] Heartbeat disabled = no timer created, zero overhead
- [ ] Per-route interval override works
- [ ] Existing idle timeout still functions independently
- [ ] All existing tests pass

**Verification**: `bun test && bun run lint`

---

### Phase 2: Message Rate Limiting
**Commit scope**: Per-connection token bucket rate limiting on incoming messages
**Est. lines**: ~180
**Objective**: Prevent clients from flooding the server with messages. Token bucket algorithm: O(1) per message, handles bursts naturally. Only limits complete messages (after fragment reassembly), not control frames.
**Why this phase exists**: Without rate limiting, a single misbehaving client can overwhelm the message handler and degrade service for all connections.

**Config shape**:
```typescript
messageRateLimit: {
  enabled: boolean;     // @default false (opt-in)
  maxMessages: number;  // max messages per window. @default 100
  window: number;       // seconds. @default 10
}
```

**Files**:
- `app/typedefs/internal/InternalConfiguration.d.ts` — add `messageRateLimit` to `InternalWebSocketOptions`
- `app/typedefs/public/WebSocket.d.ts` — add optional `messageRateLimit` to `WebSocketRouteOptions` (per-route override)
- `app/core/modules/websocket/WebSocketConfig.ts` — defaults + validation
- `app/core/modules/websocket/WebSocketConnection.ts` — token bucket state + check in `_deliverMessage`
- `app/core/modules/websocket/__tests__/WebSocketRateLimit.test.ts` — NEW: rate limiting tests

**Steps**:
1. Add `messageRateLimit` interface to `InternalWebSocketOptions` (enabled, maxMessages, window)
2. Add optional `messageRateLimit` to `WebSocketRouteOptions`
3. Add defaults: `{ enabled: false, maxMessages: 100, window: 10 }`
4. Add validation: `maxMessages >= 1`, `window >= 1` (seconds), both must be integers
5. In `WebSocketConnection`: add `_rateLimitTokens: number` (starts at maxMessages), `_rateLimitLastRefill: number` (Date.now()). Add `_checkRateLimit(): boolean` — refills tokens based on elapsed time, deducts one, returns false if tokens < 1.
6. In `_deliverMessage`: if rate limiting enabled, call `_checkRateLimit()`. If false: close with 1008 "Message rate limit exceeded" and return.
7. Merge rate limit config in `_mergeWsConnectionOptions`
8. Tests: messages within limit pass through, exceeding limit closes connection with 1008, token refill after window, burst handling, disabled config, per-route override

**Quality gate**:
- [ ] Control frames (ping/pong/close) are NOT rate limited
- [ ] Only complete messages count (fragments don't trigger limit)
- [ ] Token bucket refills continuously (not fixed windows)
- [ ] Rate limiting disabled = zero overhead (no Date.now() calls)
- [ ] All existing tests pass

**Verification**: `bun test && bun run lint`

---

### Phase 3: Compression (permessage-deflate)
**Commit scope**: RFC 7692 compression with no-context-takeover, broadcast-safe
**Est. lines**: ~450
**Objective**: Negotiate and apply permessage-deflate compression. Uses `deflateRawSync`/`inflateRawSync` (no-context-takeover = no state to preserve). Broadcast uses compress-once pattern (identical compressed frame to all subscribers).
**Why this phase exists**: Reduces bandwidth for text-heavy WebSocket traffic (JSON trading data, chat messages). No-context-takeover ensures encode-once broadcast remains functional.

**Config shape**:
```typescript
compression: {
  enabled: boolean;              // @default false (opt-in)
  level: number;                 // zlib level 1-9 (1=fast, 9=best). @default 1
  threshold: number;             // bytes — skip compression below this. @default 128
  serverMaxWindowBits: number;   // 9-15, server LZ77 window. @default 11 (2KB, best tradeoff)
  clientMaxWindowBits: number;   // 9-15, client LZ77 window. @default 15 (let client choose)
}
```

**Files**:
- `app/constants/websocket.ts` — add `wsCompressionDefaults` (level, threshold, window bits)
- `app/typedefs/internal/InternalConfiguration.d.ts` — add `compression` to `InternalWebSocketOptions`
- `app/typedefs/internal/modules/websocket/index.d.ts` — add `rsv1: boolean` to `InternalWebSocketFrame`
- `app/typedefs/public/WebSocket.d.ts` — add optional `compression` to `WebSocketRouteOptions` (enable/threshold overrides)
- `app/core/modules/websocket/WebSocketCompression.ts` — **NEW**: compress/decompress functions, extension header parsing/building
- `app/core/modules/websocket/WebSocketFrame.ts` — extract RSV1 from byte0, validate RSV2/RSV3 = 0, add `rsv1` param to `_encodeFrame`
- `app/core/modules/websocket/WebSocketHandshake.ts` — accept `extensions` param in `_buildHandshakeResponse`, add `_negotiateCompression` function
- `app/core/modules/websocket/WebSocketConnection.ts` — inject compression options, compress in `send()` (above threshold), decompress in `_handleFrame()` (when RSV1 set)
- `app/core/modules/websocket/WebSocketChannelManager.ts` — compress-once in `publish()` when compression enabled
- `app/core/modules/websocket/WebSocketConfig.ts` — defaults + validation
- `app/core/YinzerFlow.ts` — pass compression config, add extension negotiation to upgrade flow
- `app/core/modules/websocket/__tests__/WebSocketCompression.test.ts` — **NEW**: compression tests

**Steps**:
1. **Frame parser RSV1 support**: In `_parseFrame`, extract `rsv1 = (byte0 & 0x40) !== 0`. Validate `(byte0 & 0x30) === 0` (RSV2+RSV3 must be 0, else protocol error). Add `rsv1` to returned frame object. In `_encodeFrame`, add optional `rsv1` param: `(fin ? 0x80 : 0x00) | (rsv1 ? 0x40 : 0x00) | opcode`.
2. **WebSocketCompression.ts**: Implement `_compressPayload(payload, level, windowBits)` using `deflateRawSync` with `finishFlush: Z_SYNC_FLUSH`, strip trailing `[0x00, 0x00, 0xFF, 0xFF]`. Implement `_decompressPayload(payload, windowBits)` — append tail bytes, `inflateRawSync`. Implement `_parseExtensionHeader(header)` — parse `Sec-WebSocket-Extensions` value into structured params. Implement `_buildExtensionResponse(clientExt, serverConfig)` — negotiate params, return response header value or null (no match).
3. **Handshake extension negotiation**: Modify `_buildHandshakeResponse` to accept optional `extensions?: string` param. Add `Sec-WebSocket-Extensions: {value}` header line when present. Add `_negotiateCompression(clientHeaders, serverConfig)` to WebSocketHandshake — parses client's extension header, negotiates with server config, returns agreed params or null.
4. **Config**: Add `compression` to `InternalWebSocketOptions`, `WebSocketRouteOptions`. Add defaults. Add validation: level 1-9, threshold >= 0, windowBits 9-15. No warnings needed (disabled by default).
5. **Connection integration**: Add `_compressionEnabled: boolean` and `_compressionOptions` to connection constructor options. In `send()`: if compression enabled and payload >= threshold, compress payload, encode with RSV1=true. If below threshold, encode normally (RSV1=false). In `_handleFrame()`: if frame.rsv1 is true but compression not negotiated, close with protocol error. If rsv1 true and compression negotiated, decompress payload before fragment handling. For fragmented messages: collect compressed fragments, concatenate, then decompress.
6. **Broadcast integration**: In `WebSocketChannelManager.publish()`, accept optional compression options. If compression enabled: compress payload once, encode frame with RSV1, broadcast compressed frame via `sendRaw()`. Add flag to connections indicating compression was negotiated (so broadcast only sends compressed frames to connections that negotiated compression).
7. **Upgrade flow**: In YinzerFlow upgrade handler, check if compression config enabled. If yes, negotiate with client's `Sec-WebSocket-Extensions` header. Pass negotiation result into handshake response and connection constructor.
8. **Tests**: Compress/decompress roundtrip, tail byte strip/append, extension header parsing, negotiation (accept, reject, parameter validation), compressed send/receive, RSV1 set correctly, uncompressed fallback below threshold, broadcast compress-once (Buffer identity check), mixed compressed/uncompressed connections in broadcast, RSV2/RSV3 rejection.

**Quality gate**:
- [ ] Uncompressed connections unaffected (RSV1=0, no zlib calls)
- [ ] Compression disabled = zero overhead
- [ ] Broadcast sends compressed frames only to connections that negotiated compression
- [ ] RSV1 only on first fragment of data frames, never control frames
- [ ] RSV2/RSV3 set = protocol error, connection closed
- [ ] Client that doesn't offer permessage-deflate connects normally (uncompressed)
- [ ] deflateRawSync/inflateRawSync available in Bun (verify in test)
- [ ] All existing tests pass

**Verification**: `bun test && bun run lint`

---

### Phase 4: Docs, Exports & Verification Sweep
**Commit scope**: Documentation for all three M2 features + final sweep
**Est. lines**: ~200 (mostly docs)
**Objective**: Update WebSocket docs with heartbeat, rate limiting, and compression sections. Export any new constants. Final verification sweep.
**Why this phase exists**: Users need to know the new config options exist and how to use them.

**Files**:
- `docs/core/websockets.md` — add sections for heartbeat, rate limiting, compression
- `app/typedefs/constants/websocket.d.ts` — update if new constants added
- `app/index.ts` — export new constants if any

**Steps**:
1. Add heartbeat section to docs (config, behavior, how dead connections are detected)
2. Add rate limiting section (config, token bucket behavior, close code)
3. Add compression section (config, permessage-deflate negotiation, threshold, broadcast interaction, performance tradeoffs with window bits table)
4. Update existing settings table with new config options
5. Verification sweep: grep for TODO/FIXME/HACK, confirm all tests pass, lint clean
6. Cross-check todos.md for completeness

**Quality gate**:
- [ ] All examples are valid TypeScript
- [ ] Settings show defaults in green per docs template
- [ ] No orphaned TODOs in code
- [ ] All tests pass, lint clean
- [ ] Compression tradeoff table included (window bits vs memory vs ratio)

**Verification**: `bun test && bun run lint`, read docs for accuracy

---

## Anti-Pattern Check

- **Splitting into commits instead of PRs** → N/A: this project commits to main directly (no branch/PR workflow, same as Milestone 1)
- **Shadow main branches** → ✅ Avoided: all work on main
- **Building the engine before shipping value** → ✅ Avoided: each phase delivers a usable, independent feature
- **Hotfix that isn't** → N/A
- **Abandoned branches** → N/A
- **Flag graveyards** → N/A: framework library, no feature flags — users control behavior via config

---

## Post-Plan Checklist

**Security**:
- [x] No new user input beyond config (validated at startup via _validateWebSocketConfig)
- [x] No SQL, no auth, no secrets
- [x] RSV bit validation prevents protocol abuse
- [x] Rate limiting prevents message flooding

**Performance**:
- [x] Heartbeat: O(1) timers via single sweep, O(N) per tick (iterate connections)
- [x] Rate limiting: O(1) per message (token bucket)
- [x] Compression: sync zlib ops — fast for typical message sizes, threshold skips small msgs
- [x] No-context-takeover: no per-connection zlib state overhead between messages
- [x] Broadcast: compress once, write N times (encode-once pattern preserved)

**Idempotency**: N/A (no mutations, webhooks, or payments)

**Error Handling**:
- [x] Heartbeat dead → close with 1000 "Heartbeat timeout" (clean)
- [x] Rate limit exceeded → close with 1008 "Message rate limit exceeded" (policy violation)
- [x] RSV bit violation → close with 1002 "Protocol error" (per RFC)
- [x] Decompression failure → close with 1007 "Invalid payload" (per RFC)

---

## Quality Checklist (verify at completion)
- [ ] All inputs validated (config validation in _validateWebSocketConfig)
- [ ] No security surfaces added (internal implementation)
- [ ] Error handling: specific close codes per RFC 6455
- [ ] Performance: O(1) rate limiting, O(1) heartbeat timers, threshold-gated compression
- [ ] Tests: each feature has happy path + error cases + edge cases
- [ ] Existing 1051 tests still pass
- [ ] Types complete (no `any`)
- [ ] Follows existing codebase conventions
