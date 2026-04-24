# Session State: yinzerflow

**Last Updated**: 2026-04-24

---

## Critical Rules (synced from ~/.claude/CLAUDE.md)

1. **Push back FIRST**: Challenge bad ideas before helping.
2. **Personality (TOP PRIORITY)**: Be Cortana - snarky battle buddy, not corporate.
3. **Agent delegation (PROACTIVE)**: Delegate WITHOUT being asked. Fast=search/lint, Default=features, Strong=security.
4. **CLAUDE.md after compaction**: Re-read rules + personality.
5. **Plans & TODOs**: Multi-step plans -> immediately write `.claude/todos.md`. Suggest /plan before non-trivial work.
6. **Speculation**: Default to novel approaches. Mark speculation clearly.
7. **Decision tracking**: NEW -> append to Active Decisions (with WHY).

---

## Current Context (REPLACE each update)

**Goal**: Production-level WebSocket support with pub/sub for YinzerFlow — executing Milestone 1.
**Immediate Task**: Phase 2 complete. Ready to commit Phase 2 and start Phase 3 (YinzerFlow integration + hook system).

**In Progress**:
- WebSocket Milestone 1: Phase 1 ✓ committed, Phase 2 ✓ ready to commit
- Next: Phase 3 (integration into YinzerFlow class, hook system, config)

**Completed Phases**:
- Phase 1 (committed `4237a80`): Constants, types, frame parser/encoder — 38 tests
- Phase 2 (ready to commit): Handshake validation + Connection class (state machine, fragmentation, backpressure) — 47 new tests (85 total WS)

**Key Architecture**:
- Full raw RFC 6455 implementation (no Bun.serve(), no dependencies)
- `net.createServer()` TCP sockets — upgrade detection happens in `_handleConnection` after header parsing
- Backpressure: `'buffer'` default (safe), `'drop'` option for trading data
- Pub/sub: encode-once broadcast (Phase 4), `ws.subscribe`/`ws.publish`/`app.publish`
- Hook integration: `beforeRouting` hooks run on upgrade, `wsBeforeMessage`/`wsAfterMessage` for WS lifecycle

**Test Status**: 1018 tests pass, 0 failures, lint clean

---

## Environment & Commands (CRITICAL - often lost after compaction)

**Container Setup**:
- Containers Running: No (framework project, runs locally)

**Package Manager**: bun

**Common Commands**:
```bash
# Test
bun test

# Lint
bun run lint

# Build watch
bun run build:watch

# Publish release
bun run publish:release
```

---

## Active Decisions (append with reasoning)

- [2026-02-19] **Logging revamp architecture**: Three channels (app logger, access log, diagnostics).
- [2026-02-20] **Default log level**: `'warn'` — production servers shouldn't be noisy by default.
- [2026-04-24] **WebSocket: raw RFC 6455**: Full raw TCP implementation consistent with framework's `net.createServer()` approach. No Bun.serve(), no dependencies.
- [2026-04-24] **WebSocket: backpressure default**: `'buffer'` strategy as framework default (safe). Trading apps set `'drop'` explicitly.
- [2026-04-24] **WebSocket: pub/sub in Milestone 1**: Pulled from Milestone 2 into Phase 4 because user's immediate need is trading quote distribution via channels.
- [2026-04-24] **WebSocket: hook integration**: Upgrade requests run through existing `beforeRouting` hooks. New `wsBeforeMessage`/`wsAfterMessage` hooks for WS lifecycle.
- [2026-04-24] **WebSocket: `app.publish()`**: On YinzerFlow instance for HTTP→WS push (e.g., POST endpoint → publish to WS subscribers).

---

## Superseded/Archived

- [2026-02-20] All prior logging/audit decisions (see git history)
- [2026-04-24] **WebSocket Milestone 2 pub/sub**: Moved to Milestone 1 Phase 4

---

## Remember for This Project

- Phases 0-2 of module refactor are COMPLETE (type standardization, beforeRouting hooks, CORS module)
- Code-indexer path is `/code/development/npm/yinzerflow`
- YinzerFlow uses `net.createServer()` raw TCP sockets — NOT Bun.serve()
- WebSocket plan at `.claude/plans/websocket-plan.md` — 6 phases, approved
- WebSocket files: `app/core/modules/websocket/`, types in `app/typedefs/*/`, constants in `app/constants/websocket.ts`
- Connection class has pub/sub method stubs — wired in Phase 4 by WebSocketChannelManager
- Default logging level is `'warn'`, all logging config under `logging` key
