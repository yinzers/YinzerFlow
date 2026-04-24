# Session State: yinzerflow

**Last Updated**: 2026-04-24

---

## Current Context (REPLACE each update)

**Goal**: WebSocket Milestone 1 COMPLETE. All 6 phases committed to main.
**Immediate Task**: None — milestone done. Awaiting user direction (Milestone 2, other work, or release).

**Milestone 1 Summary** (6 commits on main):
- Phase 1 (`4237a80`): Frame protocol — parser, encoder, constants, types (38 tests)
- Phase 2 (`6b4ca03`): Handshake + Connection class — state machine, fragmentation, backpressure (47 tests)
- Phase 3 (`d344156`): YinzerFlow integration — routing, config, hooks, upgrade detection
- Phase 4 (`97de59a`): Pub/sub — encode-once broadcast, channel manager (22 tests)
- Phase 5 (`3e6a2f5`): Security — origin validation, per-IP limits, integration tests (22 tests)
- Phase 6 (`3bbfb6a`): Exports, docs, verification sweep

**Test Status**: 1051 tests pass, 0 failures, lint clean

**Key Files**:
- Implementation: `app/core/modules/websocket/` (7 source files)
- Types: `app/typedefs/public/WebSocket.d.ts`, `app/typedefs/internal/modules/websocket/index.d.ts`, `app/typedefs/constants/websocket.d.ts`
- Constants: `app/constants/websocket.ts`
- Docs: `docs/core/websockets.md`
- Tests: `app/core/modules/websocket/__tests__/` (5 test files, 129 WS-specific tests)

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

- [2026-04-24] **WebSocket: raw RFC 6455**: Full raw TCP, no dependencies, consistent with framework.
- [2026-04-24] **WebSocket: backpressure default**: `'buffer'` (safe). Trading apps set `'drop'`.
- [2026-04-24] **WebSocket: pub/sub in Milestone 1**: User's immediate need is trading quote distribution.
- [2026-04-24] **WebSocket: `app.publish()`**: On YinzerFlow instance for HTTP→WS push.

---

## Remember for This Project

- WebSocket Milestone 1 is COMPLETE (6 phases, ~3000 lines, 129 WS tests)
- Milestone 2 (deferred): compression (permessage-deflate), heartbeat/keepalive, message rate limiting
- YinzerFlow.ts has `max-lines` eslint-disable (WS upgrade handler adds ~120 lines)
- Connection class has pub/sub via channel manager (injected via `setChannelManager`)
- Security module tracks per-IP connections with auto-decrement on close
- Code-indexer path is `/code/development/npm/yinzerflow`
- Default logging level is `'warn'`
