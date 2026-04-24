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

**Goal**: Production-level WebSocket support for YinzerFlow framework — in planning phase.
**Immediate Task**: Awaiting user decision on architecture direction before creating full plan.

**In Progress**:
- WebSocket plan: Step 1 (Context & Why) and Step 2 (Research) complete
- Key architectural decision pending: raw TCP framing vs minimal dependency for WebSocket frame parsing

**Key Decision Pending**:
- YinzerFlow uses `net.createServer()` raw TCP sockets with manual HTTP parsing
- Bun.serve() WebSocket API is NOT applicable (different server paradigm)
- Two options presented to user:
  - **Option A**: Full raw TCP WebSocket implementation (handshake + RFC 6455 framing from scratch)
  - **Option B**: Raw handshake + proven framing library for the protocol-level byte parsing
- User's initial instinct: keep it low-level like the rest of the framework
- Waiting for final direction before writing the plan

**Research Completed**:
- Full codebase architecture exploration done (YinzerFlow.ts, modules, hooks, types, build)
- Bun WebSocket API docs fetched via Context7 (not applicable — Bun.serve() only)
- Key finding: framework does HTTP parsing on raw TCP sockets, WebSocket upgrade fits naturally at that level

**Recently Completed** (prior session):
- All audit code fixes (C1, C2, H2-H6, M3-M5, D2)
- Default logging level `'info'` → `'warn'`
- Full docs rewrite (logging.md, configuration.md)
- JSDoc fixes for log level descriptions

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

- [2026-02-17] **Docs consolidation**: Moved loose root MD files into .claude/ structure per project conventions.
- [2026-02-19] **Publish script**: Replaced `publish.sh` with `scripts/publish.ts` — zero-dep Bun script with pre-flight checks, AI changelog, rollback.
- [2026-02-19] **Logging revamp architecture**: Three channels (app logger, access log, diagnostics). Diagnostics independent of app log level. New `logging` config block replaces flat `networkLogs`/`logger`/`networkLogger`. Breaking change (0.x semver, acceptable).
- [2026-02-20] **C2 fix approach**: Instead of mutating branded logger state (cross-instance bug), extract the branded logger's underlying output sink and pass it to the per-instance logger. No mutation, same behavior.
- [2026-02-20] **C1 fix approach**: Removed accessLog module-level singleton. Access log logger now created per-instance in `_configureLogging()` with `_accessLogEnabled` boolean guard.
- [2026-02-20] **loggerBrand rename**: `LOGGER_BRAND` → `loggerBrand` for project camelCase convention. Internal-only symbol, no public API impact.
- [2026-02-20] **Audit disagreements**: M1 (timer race) — already mitigated by _destroyed flag. M2 (timestamp) — changes timezone from local to UTC, not just a perf fix. Both rejected with reasoning.
- [2026-02-20] **Default log level**: Changed from `'info'` to `'warn'`. Rationale: production servers shouldn't be noisy by default.
- [2026-02-20] **Log level description**: Changed from "Minimum log level" to "Log level threshold — messages at this severity and above are output".
- [2026-04-24] **WebSocket architecture direction**: PENDING — user leaning toward raw TCP (consistent with framework). Bun.serve() WebSocket API rejected (wrong server paradigm). Deciding between full raw RFC 6455 implementation vs raw handshake + framing library.

---

## Superseded/Archived

- [2026-02-20] **External logger ANSI formatting (Path 2)**: Replaced with raw delegation — external loggers handle their own formatting.
- [2026-02-20] **_sanitizeLogField co-located**: Superseded by shared util in sanitize.ts.
- [2026-02-20] **accessLog module singleton**: Replaced by per-instance access log in C1 fix.
- [2026-02-20] **Branded logger state mutation**: Replaced by output sink extraction in C2 fix.

---

## Remember for This Project

- Phases 0-2 of module refactor are COMPLETE (type standardization, beforeRouting hooks, CORS module)
- Phase 3 (ipSecurity module refactor) is next on the architecture roadmap
- There are 3 outstanding bugs to verify (IP security, beforeAll route filtering, error info disclosure)
- Code-indexer path is `/code/development/npm/yinzerflow` (not `/home/patrick/...`)
- Publish script is at `scripts/publish.ts` — uses Claude Haiku API for changelogs, falls back to raw commits
- networkLog.ts is deleted — replaced by accessLog.ts
- `_sanitizeLogField` is shared in `app/core/utils/sanitize.ts`
- `loggerBrand` (formerly `LOGGER_BRAND`) is the Symbol used for framework logger identification
- accessLog is now per-instance — no more module-level singleton
- `_formatBytesForDisplay` in bytes.ts handles auto-unit formatting (B/KB/MB/GB)
- Default logging level is now `'warn'` (changed from `'info'`)
- All logging config is under `logging` key — old top-level `logger`/`networkLogs`/`networkLogger` are gone
- YinzerFlow uses `net.createServer()` raw TCP sockets — NOT Bun.serve()
