# Todos: yinzerflow

## Current Goal
WebSocket Milestone 2 — Hardening (heartbeat, rate limiting, compression)

---

## Active: WebSocket Milestone 2

See `.claude/plans/websocket-milestone2-plan.md` for full plan.

### Phase 1: Heartbeat/Keepalive — COMPLETE ✓
- [x] 1.1 Add `heartbeat` to `InternalWebSocketOptions` (enabled, interval)
- [x] 1.2 Add `heartbeatInterval` to `WebSocketRouteOptions` (per-route override)
- [x] 1.3 Config defaults (enabled: true, interval: 30) + validation + warning
- [x] 1.4 `_isAlive` + `_heartbeatEnabled` on WebSocketConnection, pong/data set alive
- [x] 1.5 `_ensureHeartbeatSweep()` in YinzerFlow — lazy init, unref, shutdown cleanup
- [x] 1.6 Config merge includes `heartbeatInterval`
- [x] 1.7 Tests — 12 tests (liveness tracking, sweep sim, ping method, heartbeatEnabled)

### Phase 2: Message Rate Limiting — NEXT
- [ ] 2.1 Add `messageRateLimit` to `InternalWebSocketOptions` (enabled, maxMessages, window)
- [ ] 2.2 Add `messageRateLimit` to `WebSocketRouteOptions` (per-route override)
- [ ] 2.3 Config defaults (disabled, 100 msgs, 10s) + validation
- [ ] 2.4 Token bucket in WebSocketConnection (`_rateLimitTokens`, `_rateLimitLastRefill`)
- [ ] 2.5 Rate limit check in `_deliverMessage` — close with 1008 on exceed
- [ ] 2.6 Config merge includes messageRateLimit
- [ ] 2.7 Tests — within limit, exceed closes, token refill, burst, disabled, per-route

### Phase 3: Compression (permessage-deflate) — pending
- [ ] 3.1 Frame parser RSV1 support + RSV2/RSV3 validation
- [ ] 3.2 WebSocketCompression.ts (compress/decompress, extension negotiation)
- [ ] 3.3 Handshake extension negotiation
- [ ] 3.4 Config (enabled, level, threshold, windowBits)
- [ ] 3.5 Connection integration (compress send, decompress receive)
- [ ] 3.6 Broadcast integration (compress-once)
- [ ] 3.7 Upgrade flow wiring
- [ ] 3.8 Tests

### Phase 4: Docs, Exports & Verification Sweep — pending
- [ ] 4.1 Update docs/core/websockets.md
- [ ] 4.2 Export new constants if any
- [ ] 4.3 Verification sweep

---

## Deferred

- [ ] **D1 (discussion): Rename `logging.requests` → `logging.accessLog`** — deferred pending user input
- [ ] **Milestone 3 (future)**: Context takeover compression, per-route compression config

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
