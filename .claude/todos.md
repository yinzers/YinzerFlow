# Todos: yinzerflow

## Current Goal
Production-level WebSocket support with pub/sub — Milestone 1 approved, executing Phase 1.

---

## Active: WebSocket Support (Milestone 1)

See `.claude/plans/websocket-plan.md` for full plan.

### Phase 1: Constants, Types & Frame Protocol — COMPLETE ✓
- [x] 1.1 Create `app/constants/websocket.ts` (opcodes, close codes, GUID, readyState, backpressure strategy)
- [x] 1.2 Create `app/typedefs/constants/websocket.d.ts` (CreateEnum types)
- [x] 1.3 Create `app/typedefs/internal/modules/websocket/index.d.ts` (frame, parse result types)
- [x] 1.4 Create `app/typedefs/public/WebSocket.d.ts` (WebSocket, WebSocketHandlers, WebSocketRouteOptions, etc.)
- [x] 1.5 Implement `app/core/modules/websocket/WebSocketFrame.ts` (parser + encoder, in-place unmask, allocUnsafe)
- [x] 1.6 Write `app/core/modules/websocket/__tests__/WebSocketFrame.test.ts` (38 tests, 140 assertions)

### Phase 2: Handshake & Connection Class — COMPLETE ✓
- [x] 2.1 WebSocketHandshake.ts (validation, accept key, response builder)
- [x] 2.2 WebSocketConnection.ts (state machine, fragmentation, backpressure, sendRaw)
- [x] 2.3 Handshake unit tests (RFC test vector, edge cases) — 19 tests
- [x] 2.4 Connection unit tests (lifecycle, fragments, backpressure) — 28 tests

### Phase 3: YinzerFlow Integration + Hook System — COMPLETE ✓
- [x] 3.1 WebSocketRouter.ts (exact + parameterized path matching)
- [x] 3.2 WebSocketConfig.ts (defaults, validation, warnings)
- [x] 3.3 Hook registry: WS hook sets (wsBeforeMessage, wsAfterMessage)
- [x] 3.4 SetupImpl: ws(), wsBeforeMessage(), wsAfterMessage()
- [x] 3.5 InternalConfiguration: InternalWebSocketOptions
- [x] 3.6 handleCustomConfiguration: WS defaults + deep merge + validation
- [x] 3.7 YinzerFlow: upgrade detection, WS dispatch, connection tracking, graceful shutdown, WS hook wrapping

### Phase 4: Pub/Sub with Encode-Once Broadcast — COMPLETE ✓
- [x] 4.1 WebSocketChannelManager.ts (bidirectional maps, encode-once, sender exclusion, empty channel GC)
- [x] 4.2 Wire pub/sub into WebSocketConnection (delegate to manager, auto-unsubscribe on close)
- [x] 4.3 YinzerFlow: app.publish(), app.subscriberCount() (lazy channel manager allocation)
- [x] 4.4 Unit tests — 22 tests (encode-once Buffer identity, sender exclusion, cleanup, delegation)

### Phase 5: Security, Connection Limits & Integration Tests
- [ ] 5.1 WebSocketSecurity.ts (origin validation, per-IP connection tracking)
- [ ] 5.2 Wire security into upgrade flow
- [ ] 5.3 Full integration test suite (core, hooks, pub/sub, HTTP regression)
- [ ] 5.4 Security tests (origin, limits, malformed handshake, oversized frames)

### Phase 6: Exports, Docs & Verification Sweep
- [ ] 6.1 Update index.ts exports
- [ ] 6.2 Write docs/core/websockets.md (full template, trading data example, backpressure docs)
- [ ] 6.3 Update docs/configuration/configuration.md
- [ ] 6.4 Verification sweep (TODO grep, todos cross-check, quality checklist)

---

## Deferred

- [ ] **D1 (discussion): Rename `logging.requests` → `logging.accessLog`** — deferred pending user input
- [ ] **Milestone 2**: Compression (permessage-deflate), heartbeat/keepalive, message rate limiting

---

## Priority 3: Verification / Investigation

- [ ] **Verify IP Security Middleware** — not stopping/warning as expected
- [ ] **Verify beforeAll Hook Route Filtering** — routesToExclude/routesToInclude not working
- [ ] **Verify Import Path Casing: `rateLimithooks`** — may fail on Linux CI
- [ ] **Investigate Graceful Shutdown Default** — JSDoc says `@default true` but type is TimeString|number
- [ ] **Design Decision: CORS Server-Side Origin Blocking** — non-browser clients bypass CORS

---

## Feature Enhancements (After Active Work)

- [ ] IP Security: Enhanced CDN/Proxy Header Support
- [ ] Body Parser: Per-Parser Type Enable/Disable
- [ ] Research if testing structure is good and testing philosophy is good

---

## Architecture (Active Plan)

- [x] Phase 0: Type Naming Standardization
- [x] Phase 1: beforeRouting Hook System
- [x] Phase 2: CORS Module Conversion
- [ ] Phase 3: ipSecurity Module Refactor (after WebSocket milestone)
- [ ] Phase 4: bodyParser Module Refactor
