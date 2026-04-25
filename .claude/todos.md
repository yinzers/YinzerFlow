# Todos: yinzerflow

## Current Goal
WebSocket Milestone 2 COMPLETE + TS cleanup done. Awaiting user direction.

---

## Completed: WebSocket Milestone 2 ✓

All 4 phases + TS strict fix committed to main. 59 new WS tests (1110 total), lint clean, 0 WS TS errors.

---

## Deferred

- [ ] **D1 (discussion): Rename `logging.requests` → `logging.accessLog`** — deferred pending user input
- [ ] **Milestone 3 (future)**: Context takeover compression, per-route compression config, heartbeat per-route interval

---

## Priority 2: Pre-existing TS Errors (37 total, non-WS files)

- [ ] `app/__tests__/test-utils/create-server.spec.ts` — missing `ServerConfiguration` export
- [ ] `app/core/__tests__/YinzerFlow.spec.ts` — `string | undefined` arg types, `body` unknown
- [ ] `app/core/execution/__tests__/ContextImpl.spec.ts` — unused `name` variable
- [ ] `app/core/execution/utils/__tests__/parseBody.spec.ts` — missing type exports
- [ ] `app/core/execution/utils/__tests__/parseJson.spec.ts` — missing type export
- [ ] `app/core/execution/utils/__tests__/parseUrlEncodedForm.spec.ts` — missing type export
- [ ] `app/core/setup/__tests__/GroupApp.spec.ts` — TS errors
- [ ] `app/core/setup/__tests__/SetupImpl.spec.ts` — TS errors
- [ ] `app/core/setup/utils/__tests__/compileRoutePattern.spec.ts` — TS errors
- [ ] `app/core/setup/utils/__tests__/handleCustomConfiguration.spec.ts` — unused import

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
