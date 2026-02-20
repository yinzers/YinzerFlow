# Todos: yinzerflow

## Current Goal
Fix critical response bugs, then revamp logging for better DX, then continue module refactoring.

Full plan: `.claude/plans/response-bugs-and-logging-revamp.md`

---

## Active Work — Critical Bugs + Logging Revamp

### Phase 0: Fix TCP Stream Reassembly (REQUEST SIDE) — COMPLETE
- [x] Buffer incoming TCP data until complete HTTP request is received
- [x] Parse `Content-Length` from headers to know when body is complete
- [x] Only call `_processRequest` once full request is assembled
- [x] Compute max buffer size from body parser config (json/urlEncoded/fileUpload limits)
- [x] Early detection of non-HTTP data (first-byte + 8-byte method check)
- [x] DoS protection: reject oversized requests at TCP level before parsing
- [x] Add 5 new tests for TCP reassembly (chunked 2KB, 10KB, 64KB, GET, header-split)
- **Result**: 938 tests passing, 0 failures

### Audit Fixes (YinzerFlow.ts, Cors.ts, YinzerFlow.spec.ts) — COMPLETE
- [x] **YinzerFlow.ts**: O(n²) → O(n) buffer allocation (chunks array instead of Buffer.concat per event)
- [x] **YinzerFlow.ts**: `_maxBufferSize` computed once in constructor (was per-connection)
- [x] **YinzerFlow.ts**: `_handleRequestError` extracted (DRY — was duplicated in 2 catch blocks)
- [x] **YinzerFlow.ts**: `socket.destroyed` check before writing response (prevents EPIPE)
- [x] **YinzerFlow.ts**: HTTP 413 response on buffer overflow (when headers parsed)
- [x] **YinzerFlow.ts**: Listen error cleanup — close/delete server on EADDRINUSE
- [x] **YinzerFlow.ts**: Response logging uses `Buffer.byteLength(_stringBody)` (was double JSON.stringify)
- [x] **YinzerFlow.ts**: `looksLikeHttp` positive logic + comprehensive TSDoc
- [x] **Cors.ts**: Constructor validates wildcard+credentials invariant (was hot-path throw)
- [x] **Cors.ts**: Pre-normalized origins `Set` for O(1) lookup (was O(m) Array.some per request)
- [x] **Cors.ts**: `_setCommonCorsHeaders` helper (DRY for preflight + actual)
- [x] **Cors.ts**: Renamed `_validateOrigin` → `_isOriginAllowed`, `_determineAllowedOrigin` → `_resolveAllowedOrigin`
- [x] **YinzerFlow.spec.ts**: Static `import net` (was dynamic import per helper call)
- [x] **YinzerFlow.spec.ts**: Port counter (was random — collision risk)
- [x] **YinzerFlow.spec.ts**: `connectWithTimeout` base helper (DRY for send/chunked helpers)
- [x] **YinzerFlow.spec.ts**: `Buffer.byteLength` in `createJsonRequest` (was `.length`)
- [x] **YinzerFlow.spec.ts**: `any` → `unknown` in test helpers
- [x] **YinzerFlow.spec.ts**: `[_, body]` → `[, body]` destructuring
- [x] **Cleanup**: Deleted dead `app/core/utils/cors.ts` (89 lines) + `app/core/utils/__tests__/cors.spec.ts` (637 lines)
- **Result**: 899 tests passing (39 removed with dead cors.spec.ts), 0 failures

### Publish Script — COMPLETE
- [x] Created `scripts/publish.ts` — zero-dep release script with pre-flight checks, AI changelog, rollback
- [x] Added `publish:release` script to package.json
- [x] Added `scripts/` to .npmignore
- [x] Deleted old `publish.sh`

### Phase 1: Fix Response Header Bugs (RESPONSE SIDE) — COMPLETE
- [x] Created detailed implementation plan (`.claude/plans/response-bugs-and-logging-revamp.md` Phase 1 section)
- [x] Fix `_parseResponseIntoString()` ordering — set Date/Content-Length BEFORE building `_stringBody`
- [x] Fix `Content-Length` to measure body bytes only (`Buffer.byteLength(body)` not entire response)
- [x] Remove duplicate header logic from error paths in `RequestHandlerImpl.ts` (lines 118-121, 134-137)
- [x] Remove unused `dayjs` import from `RequestHandlerImpl.ts`
- [x] Remove unused `calculateContentSizeInBytes` import from `ResponseImpl.ts`
- [x] Add 5 tests: Date header present, Content-Length = body bytes, multi-byte correctness, error response headers, not-found response headers
- **Result**: 904 tests passing, 0 failures

### Phase 1.5: Audit Bug Fixes (ResponseImpl, RequestHandlerImpl, HookRegistryImpl, Tests) — COMPLETE
- [x] **ResponseImpl.ts**: CRLF `\n` → `\r\n` (RFC 7230 compliance)
- [x] **ResponseImpl.ts**: Replace `dayjs()` with cached Date header (1s setInterval, `.unref()`)
- [x] **ResponseImpl.ts**: Fix `_formatHttpDate` hoisting (moved before `_cachedDateHeader` init)
- [x] **RequestHandlerImpl.ts**: Move `_setBody(routeResponse)` before afterHooks (error flow fix)
- [x] **RequestHandlerImpl.ts**: Remove no-op try/catch around handler call
- [x] **RequestHandlerImpl.ts**: Fix error handler blame message ("internal error" → "your onError handler")
- [x] **RequestHandlerImpl.ts**: Fix `_matchesPattern` prefix match bug (`/api/*` no longer matches `/api-internal`)
- [x] **RequestHandlerImpl.ts**: Add defensive defaults to `_shouldRunHook` destructuring
- [x] **RequestHandlerImpl.ts**: Remove `private` keyword from underscore-prefixed methods (consistency)
- [x] **RequestHandlerImpl.ts**: Extract `_applyHookResponse()` DRY helper (3 identical blocks → 1)
- [x] **HookRegistryImpl.ts**: Fix "handeling" → "handling" typo
- [x] **YinzerFlow.spec.ts**: Fix `connectWithTimeout` timer leak (clearTimeout on end/error)
- [x] **YinzerFlow.spec.ts**: Replace `forEach` with `for...of` using `entries()`
- [x] **Tests**: Update `\n\n` splits to `\r\n\r\n` in ResponseImpl.spec.ts and YinzerFlow.spec.ts
- **Result**: 904 tests passing, 0 failures

### Phase 2: Fix Information Disclosure
- [ ] **STOP: Create detailed implementation plan for Phase 2 before coding**
- [ ] Audit `console.log`/`console.error` in framework code (should only be in log utility)
- [ ] Sanitize error responses (generic to client, details to internal log)

### Phase 3: Logging Revamp
- [ ] **STOP: Create detailed implementation plan for Phase 3 before coding**
- [ ] Add `debug` log level (currently only off/error/warn/info)
- [ ] Add `logLevel` to server config (`InternalServerOptions`)
- [ ] Reclassify noisy network logs to `debug` level
- [ ] Clean up network log output (parseable, less noise at default level)
- [ ] Wire `logLevel` through YinzerFlow constructor
- [ ] **Logging: Slow Request/Response Thresholds**
  - `logSlowRequestsThreshold` (ms), `logResponseSizeOver` (bytes)
  - Builds on the logging revamp foundation

- [ ] **Heap/Memory Usage Logging**
  - Periodic heap/memory stats at configurable intervals
  - Development/benchmarking mode feature

### Phase 4: Tests & Cleanup
- [ ] **STOP: Create detailed implementation plan for Phase 4 before coding**
- [ ] Update existing log tests for new debug level and reclassified levels
- [ ] Verify all 933+ existing tests still pass
- [ ] Add new tests from Phases 1-3
- [x] ~~Delete dead `app/core/utils/cors.ts`~~ — done in audit fixes
- [x] ~~Delete dead `app/core/utils/__tests__/cors.spec.ts`~~ — done in audit fixes
- [x] ~~Fix test helper `any` types~~ — done in audit fixes
- [x] ~~Fix destructuring pattern `[_, body]`~~ — done in audit fixes

---

## Priority 3: Verification / Investigation

- [ ] **Verify IP Security Middleware**
  - Test that `ipSecurity` middleware properly blocks/warns for unauthorized IPs
  - Test inside Docker container environment
  - Issue: Tested on another app and it didn't stop or warn as expected
  - Test with various IP scenarios (blocked, allowed, localhost, etc.)

- [ ] **Verify beforeAll Hook Route Filtering**
  - Test that `routesToExclude` and `routesToInclude` work properly in beforeAll hooks
  - Test at all levels: groups, routes, and global beforeAll
  - Issue: These options don't appear to be working as expected
  - Test with: exact paths, wildcards, arrays, nested groups, edge cases (root `/`, trailing slashes)

- [ ] **Verify Import Path Casing: `rateLimithooks`** (from audit)
  - `YinzerFlow.ts:11` imports `@core/modules/rateLimit/rateLimithooks.ts`
  - Other imports use camelCase: `cookieParserHooks.ts`, `corsHooks.ts`
  - May work on case-insensitive FS but would fail on Linux CI — verify actual filename

- [ ] **Investigate Graceful Shutdown Default** (Bug #6 from audit)
  - JSDoc says `@default true` but type is `TimeString | number`
  - If default is boolean `true`, `_convertTimeToMs(true)` may return NaN → graceful shutdown silently broken
  - Check `handleCustomConfiguration.ts` for actual default value
  - Check `_convertTimeToMs` for boolean handling

- [ ] **Design Decision: CORS Server-Side Origin Blocking** (Bug #5 from audit)
  - Currently: actual (non-OPTIONS) requests from disallowed origins still execute handlers server-side
  - Browser enforces CORS, but non-browser clients (curl, scripts) bypass it
  - Decision: Add optional `blockNonBrowserRequests: true` config? Or document as expected behavior?

---

## Feature Enhancements (After Active Work)

- [ ] **IP Security: Enhanced CDN/Proxy Header Support**
  - CloudFront, Fastly, Azure, Fly.io header support
  - Auto-detect CDN, skip proxy chain validation for single-value CDN headers

- [ ] **Body Parser: Per-Parser Type Enable/Disable**
  - Add `enabled` flag to each parser type (json, urlEncoded, fileUploads)
  - Part of bodyParser module refactor (Architecture Phase 4)



---

## Architecture (Active Plan)

See `.claude/plans/module-refactor-plan.md` for the full roadmap.

- [x] Phase 0: Type Naming Standardization
- [x] Phase 1: beforeRouting Hook System
- [x] Phase 2: CORS Module Conversion
- [ ] **Phase 3: ipSecurity Module Refactor** (after active work)
- [ ] Phase 4: bodyParser Module Refactor
- [ ] Phase 5: Final Documentation

---

## Future / Ideas (Not Yet Planned)

See `.claude/plans/performance-optimization.md` for detailed performance strategy.

- Router optimization (trie-based or RegExpRouter like Hono)
- Request parsing optimization (lazy parsing, buffer operations)
- Response generation optimization (buffer-based, streaming, caching)
- Connection management optimization (pooling, TCP_NODELAY)
- Middleware compilation at startup
- Memory/object pooling to reduce GC pressure
- Lazy-loaded module system (dynamic imports for unused features)

---

## Completed
- [2026-02-17] Phase 0: Type Naming Standardization - All 6 chunks committed
- [2026-02-17] Phase 1: beforeRouting Hook System - 5 chunks, +10 tests, 931 passing
- [2026-02-17] Phase 2: CORS Module Conversion - 7 chunks, 933 tests passing
- [2026-02-19] Bug Fix Phase 0: TCP Stream Reassembly - buffered TCP data handler, +5 tests, 938 passing
- [2026-02-19] Audit Fixes: Performance, DRY, security, test infra across YinzerFlow.ts/Cors.ts/YinzerFlow.spec.ts + dead code cleanup, 899 passing
- [2026-02-19] Publish Script: Created scripts/publish.ts, replaced publish.sh, added publish:release script
