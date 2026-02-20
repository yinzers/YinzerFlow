# Todos: yinzerflow

## Current Goal
All code fixes + docs rewrite complete. 933 tests pass, lint clean. Ready for commit.

---

## Completed: D1/D2/2.4 Per-Instance Logger Refactor + Audit Fixes + Docs

### Code Fixes — COMPLETE
- [x] C1: accessLog singleton → per-instance (`YinzerFlow.ts`, `accessLog.ts`)
- [x] C2: Branded logger mutation → extract output sink, no mutation (`YinzerFlow.ts`)
- [x] H2: Regex hoist in sanitizer (`sanitize.ts`)
- [x] H3: Redundant sanitize → pre-sanitize once in `_processRequest` (`YinzerFlow.ts`, `DiagnosticsMonitor.ts`)
- [x] H4: Template literal waste → separate access log guard (absorbed into C1)
- [x] H5: Byte formatting DRY → `_formatBytesForDisplay` helper (`bytes.ts` + 5 call sites)
- [x] H6: Threshold error messages → added format examples (`handleCustomConfiguration.ts`)
- [x] M3: Redundant ternary → direct `_convertTimeToMs` call (`RateLimitConfig.ts`)
- [x] M4: Shallow merge → skip deep-merge keys (`handleCustomConfiguration.ts`)
- [x] M5: Unicode BiDi chars → added to sanitizer regex (`sanitize.ts`)
- [x] D2: `LOGGER_BRAND` → `loggerBrand` rename (5 files)
- **Skipped**: M1 (timer race already mitigated), M2 (timezone change), D3 (TS catches it), D4 (internal only)

### Default Level + Docs — COMPLETE
- [x] Default logging level changed from `'info'` → `'warn'` (handleCustomConfiguration.ts, 2 test assertions)
- [x] H1: Full rewrite of `docs/core/logging.md` — all options, 3-channel architecture, 4 diagnostic presets
- [x] Updated `docs/configuration/configuration.md` — replaced stale `logger`/`networkLogs`/`networkLogger` with `logging` block
- [x] Fixed ambiguous "minimum log level" wording → "log level threshold" in docs + JSDoc

### Deferred
- [ ] **D1 (discussion): Rename `logging.requests` → `logging.accessLog`** — deferred pending user input

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
- [ ] Research if testing structure is good and testing philosophy is good, right, production ready, etc

---

## Architecture (Active Plan)

See `.claude/plans/module-refactor-plan.md` for the full roadmap.

- [x] Phase 0: Type Naming Standardization
- [x] Phase 1: beforeRouting Hook System
- [x] Phase 2: CORS Module Conversion
- [ ] Phase 3: ipSecurity Module Refactor (after logging revamp)
- [ ] Phase 4: bodyParser Module Refactor
- [ ] Phase 5: Final Documentation
