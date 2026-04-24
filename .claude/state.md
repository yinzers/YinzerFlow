# Session State: yinzerflow

**Last Updated**: 2026-04-24

---

## Critical Rules (synced from ~/.claude/CLAUDE.md)

1. **Push back FIRST**: Challenge bad ideas before helping.
2. **Personality (TOP PRIORITY)**: Be Cortana - snarky battle buddy, not corporate.
3. **Agent delegation (PROACTIVE)**: Delegate WITHOUT being asked.
4. **CLAUDE.md after compaction**: Re-read rules + personality.
5. **Plans & TODOs**: Multi-step plans -> immediately write `.claude/todos.md`.
6. **Speculation**: Default to novel approaches. Mark speculation clearly.
7. **Decision tracking**: NEW -> append to Active Decisions (with WHY).

---

## Current Context (REPLACE each update)

**Goal**: Production-level WebSocket support with pub/sub for YinzerFlow — executing Milestone 1.
**Immediate Task**: Phase 3 complete and committed. Waiting for user to confirm Phase 4 start (pub/sub with encode-once broadcast).

**Completed Phases**:
- Phase 1 (commit `4237a80`): Constants, types, frame parser/encoder — 38 tests
- Phase 2 (commit `6b4ca03`): Handshake + Connection class — 47 tests (85 total WS)
- Phase 3 (commit `d344156`): YinzerFlow integration — route registration, upgrade detection, config, hooks, graceful shutdown

**Remaining Phases**:
- Phase 4: Channel-based pub/sub with encode-once broadcast (the trading data engine)
- Phase 5: Security (origin validation, per-IP limits) + integration tests
- Phase 6: Exports, docs, verification sweep

**Key Architecture**:
- Full raw RFC 6455 (no Bun.serve(), no dependencies)
- `net.createServer()` TCP sockets — upgrade detection in `_handleConnection` after header parsing
- Zero overhead when no `app.ws()` routes registered
- Backpressure: `'buffer'` default, `'drop'` for trading data
- Hook integration: `wsBeforeMessage`/`wsAfterMessage` wrap message handlers
- Connection tracking in `_wsConnections` Set (lazy allocation)
- Graceful shutdown sends close(1001) to all WS connections
- `publish()`/`subscriberCount()` stubs on YinzerFlow — wired in Phase 4
- `subscribe()`/`unsubscribe()`/`publish()`/`isSubscribed()` stubs on WebSocketConnection — wired in Phase 4

**Test Status**: 1018 tests pass, 0 failures, lint clean

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
- [2026-04-24] **WebSocket: hook integration**: `wsBeforeMessage`/`wsAfterMessage` hooks. beforeRouting hooks on upgrade deferred.
- [2026-04-24] **WebSocket: `app.publish()`**: On YinzerFlow instance for HTTP→WS push.

---

## Remember for This Project

- WebSocket plan at `.claude/plans/websocket-plan.md` — 6 phases, approved
- WebSocket files: `app/core/modules/websocket/`, types in `app/typedefs/*/`, constants in `app/constants/websocket.ts`
- Connection class has pub/sub stubs — wired in Phase 4 by WebSocketChannelManager
- YinzerFlow.ts has `max-lines` eslint-disable (temporary, WS upgrade handler adds ~120 lines)
- Code-indexer path is `/code/development/npm/yinzerflow`
- Default logging level is `'warn'`, all logging config under `logging` key
