# Session State: yinzerflow

**Last Updated**: 2026-04-25

---

## Current Context (REPLACE each update)

**Goal**: WebSocket Milestone 2 — Hardening (heartbeat, rate limiting, compression)
**Immediate Task**: Phase 1 COMPLETE. Awaiting commit confirmation, then Phase 2 (message rate limiting).

**Plan**: `.claude/plans/websocket-milestone2-plan.md`

**Milestone 2 Progress**:
- Phase 1 (Heartbeat/Keepalive) — **COMPLETE** ✓ (12 tests, 1063 total passing)
- Phase 2 (Message Rate Limiting) — NEXT
- Phase 3 (Compression / permessage-deflate) — pending
- Phase 4 (Docs, Exports & Verification Sweep) — pending

**Phase 1 Changes**:
- `app/typedefs/internal/InternalConfiguration.d.ts` — added `heartbeat` to `InternalWebSocketOptions`
- `app/typedefs/public/WebSocket.d.ts` — added `heartbeatInterval` to `WebSocketRouteOptions`
- `app/core/modules/websocket/WebSocketConfig.ts` — defaults (enabled, 30s), validation, warning
- `app/core/modules/websocket/WebSocketConnection.ts` — `_isAlive` + `_heartbeatEnabled` fields, pong handler sets alive, data handler sets alive
- `app/core/YinzerFlow.ts` — `_wsHeartbeatTimer`, `_ensureHeartbeatSweep()`, sweep cleanup in shutdown, `wsCloseCode` import, heartbeatInterval in config merge
- `app/core/modules/websocket/__tests__/WebSocketHeartbeat.spec.ts` — NEW (12 tests)
- `app/core/modules/websocket/__tests__/WebSocketConnection.spec.ts` — updated defaultOptions

**Test Status**: 1063 tests pass, 0 failures, lint clean

**Key Design Decisions (M2)**:
- Heartbeat: two-state sweep (ws library pattern), single setInterval, lazy init, .unref()
- Heartbeat default: enabled, 30s interval
- Rate limit action: close with 1008 (RFC 6455 Policy Violation)
- Compression: no-context-takeover only (preserves encode-once broadcast)

---

## Environment & Commands (CRITICAL - often lost after compaction)

**Package Manager**: bun

**Common Commands**:
```bash
bun test                    # Test
bun run lint                # Lint
bun run build:watch         # Build watch
bun run publish:release     # Publish release
```

---

## Active Decisions

- [2026-04-24] **WebSocket: raw RFC 6455**: Full raw TCP, no dependencies
- [2026-04-24] **WebSocket: backpressure default**: `'buffer'` (safe)
- [2026-04-25] **Heartbeat default enabled (30s)**: Industry standard — Socket.IO, Bun both default enabled
- [2026-04-25] **Rate limit close with 1008**: RFC 6455 §7.4.1 Policy Violation — by the book
- [2026-04-25] **Compression: no-context-takeover only**: Preserves encode-once broadcast pattern

---

## Remember for This Project

- WebSocket Milestone 1 COMPLETE (v0.8.0)
- Milestone 2 Phase 1 COMPLETE (heartbeat)
- YinzerFlow.ts has `max-lines` eslint-disable
- Code-indexer path is `/code/development/npm/yinzerflow`
- Default logging level is `'warn'`
- ConnectionOptions now includes `heartbeatInterval: number`
- `_isAlive` and `_heartbeatEnabled` are non-private on WebSocketConnection (sweep needs access)
