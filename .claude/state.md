# Session State: yinzerflow

**Last Updated**: 2026-02-20

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

**Goal**: All code fixes + docs rewrite complete. 933 tests pass, lint clean. Ready for commit.
**Immediate Task**: Awaiting user — commit, or further changes.

**In Progress**:
- Nothing actively in progress — all work done

**Recently Completed** (last 3-5 items):
- Fixed ambiguous "minimum log level" → "log level threshold" wording (docs + JSDoc)
- Default logging level changed from `'info'` → `'warn'`
- H1: Full rewrite of `docs/core/logging.md` — all options, 3-channel architecture, 4 diagnostic presets
- Updated `docs/configuration/configuration.md` — replaced stale logger/networkLogs/networkLogger with logging block
- Audit fix phase: 12 code fixes applied (C1, C2, H2-H6, M3-M5, D2 rename)

**All Changes This Session**:
- **Code**: C1, C2, H2, H3, H4, H5, H6, M3, M4, M5, D2 (12 code fixes)
- **Default level**: `'info'` → `'warn'` in handleCustomConfiguration.ts + 2 test assertions
- **Docs**: Full rewrite of logging.md, updated configuration.md stale references
- **JSDoc**: Fixed level description in InternalConfiguration.d.ts and log.ts

**Skipped (with reasoning)**:
- M1: Timer race already mitigated by `_destroyed` flag, closure/sec negligible
- M2: Changes timestamps local→UTC — behavioral change, not perf fix
- D3: TypeScript catches unknown keys, not worth it at 0.x
- D4: User said keep `getStatusEmoji` internal only

**Deferred**:
- D1 discussion: Rename `logging.requests` → `logging.accessLog` — pending user input

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
- [2026-02-20] **Default log level**: Changed from `'info'` to `'warn'`. Rationale: production servers shouldn't be noisy by default. Users who want verbose output set `level: 'info'` or `'debug'` explicitly. Security warnings and errors still visible at `'warn'`.
- [2026-02-20] **Log level description**: Changed from "Minimum log level" to "Log level threshold — messages at this severity and above are output" to avoid ambiguity about what "minimum" means.

---

## Superseded/Archived

- [2026-02-20] **External logger ANSI formatting (Path 2)**: Originally designed to format output for external loggers. Replaced with raw delegation — external loggers handle their own formatting.
- [2026-02-20] **_sanitizeLogField co-located**: Originally defined locally in both YinzerFlow.ts and DiagnosticsMonitor.ts. Superseded by shared util in sanitize.ts.
- [2026-02-20] **accessLog module singleton**: Module-level mutable singleton replaced by per-instance access log in C1 fix.
- [2026-02-20] **Branded logger state mutation**: `_configureLogging()` used to mutate user's branded logger state (personality/prefix). Replaced by output sink extraction in C2 fix.

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
