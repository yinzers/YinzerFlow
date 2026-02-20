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

**Goal**: Awaiting commit. All D1/D2/2.4 + audit code fixes applied. 933 tests, lint clean.
**Immediate Task**: User deciding on docs rewrite (H1) and `logging.requests` rename. Then commit.

**In Progress**:
- Nothing actively in progress — all code fixes done

**Recently Completed** (last 3-5 items):
- Audit fix phase: 12 fixes applied (C1, C2, H2-H6, M3-M5, D2 rename)
- Audit coordination: 7 agents, 20 findings, coordinated report in .analysis/audit-report.md
- D1/D2/2.4: Per-instance loggers + Symbol brand — 6 phases

**Audit Fixes Applied**:
- C1: accessLog singleton → per-instance (accessLog.ts, YinzerFlow.ts)
- C2: Branded logger mutation → extract output sink, no mutation (YinzerFlow.ts)
- H2: Regex hoist in sanitizer (sanitize.ts)
- H3: Pre-sanitize method/path once for both channels (YinzerFlow.ts, DiagnosticsMonitor.ts)
- H4: Separate access log guard — absorbed into C1 (YinzerFlow.ts)
- H5: `_formatBytesForDisplay` helper (bytes.ts + 3 consumer files)
- H6: Format examples in threshold errors (handleCustomConfiguration.ts)
- M3: Remove redundant ternary (RateLimitConfig.ts)
- M4: Skip deep-merge keys in shallow merge (handleCustomConfiguration.ts)
- M5: Unicode BiDi chars in sanitizer (sanitize.ts)
- D2: `LOGGER_BRAND` → `loggerBrand` rename (5 files)

**Skipped (with reasoning)**:
- M1: Timer race already mitigated by `_destroyed` flag, closure/sec negligible
- M2: Changes timestamps local→UTC — behavioral change, not perf fix
- D3: TypeScript catches unknown keys, not worth it at 0.x
- D4: User said keep `getStatusEmoji` internal only

**Deferred**:
- H1: Docs rewrite — `docs/core/logging.md` 88% stale, `docs/configuration/configuration.md` 30% stale
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
