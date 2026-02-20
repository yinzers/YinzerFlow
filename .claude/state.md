# Session State: yinzerflow

**Last Updated**: 2026-02-19

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

**Goal**: Fix critical bugs + logging revamp per `.claude/plans/response-bugs-and-logging-revamp.md`
**Immediate Task**: Phase 1 — Fix response header bugs (Date/Content-Length)

**In Progress**:
- Bug fix plan Phases 1-4 (Phase 0 complete, audit fixes complete, Phase 1 next)

**Recently Completed** (last 3-5 items):
- Merged `scripts/build.ts` into `scripts/publish.ts` — quality checks now run in pre-flight (before mutations), build inlined in mutation phase. Deleted `build.ts`, removed `build`/`clean` scripts from package.json.
- Created `scripts/publish.ts` — full release script with pre-flight checks, AI changelog, rollback, npm publish
- Audit fixes: O(n²) buffer fix, CORS Set optimization, DRY extractions, test infra improvements, dead code cleanup — 899 tests passing
- Phase 0: TCP stream reassembly fix — buffered TCP data handler in `_handleConnection`, +5 tests, 938 passing
- Created `.claude/plans/response-bugs-and-logging-revamp.md` with 5 phases

---

## Environment & Commands (CRITICAL - often lost after compaction)

**Container Setup**:
- Containers Running: No (framework project, runs locally)

**Package Manager**: bun

**Common Commands**:
```bash
# Test
bun test

# Build watch
bun run build:watch

# Publish release
bun run publish:release
```

---

## Active Decisions (append with reasoning)

- [2026-02-17] **Docs consolidation**: Moved loose root MD files into .claude/ structure per project conventions. TODO split into active todos + architecture plan. FUTURE_IDEAS became a plans doc. SECURITY.md was an audit dump, actionable item extracted to todos.
- [2026-02-19] **Publish script**: Replaced bare-bones `publish.sh` (Docker-based `npm publish` only) with comprehensive `scripts/publish.ts` — zero-dep Bun script with 9 pre-flight checks, semver bumping, AI changelog (Claude Haiku), git tagging, rollback on failure, optional GitHub release. Run via `bun run publish:release`.

---

## Superseded/Archived

- (none yet)

---

## Remember for This Project

- Phases 0-2 of module refactor are COMPLETE (type standardization, beforeRouting hooks, CORS module)
- Phase 3 (ipSecurity module refactor) is next on the architecture roadmap
- There are 3 outstanding bugs to verify (IP security, beforeAll route filtering, error info disclosure)
- Code-indexer path is `/code/development/npm/yinzerflow` (not `/home/patrick/...`)
- Publish script is at `scripts/publish.ts` — uses Claude Haiku API for changelogs, falls back to raw commits
