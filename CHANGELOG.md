# Changelog

## [0.9.0] - 2026-10-28

### Breaking Changes

- **Global rate limiter enabled by default** — The global rate limiter now runs by default with a 1000 requests per 1-minute window. If you were relying on it being disabled, explicitly set `rateLimit.enabled: false`. (a85a9eb)
- **Canonical path matching for hooks and routes** — Hooks and routes now match against a single canonical path. Traversal paths (e.g., `/../`) are rejected with 400. Hook patterns with `:param` or mid-path `*` are rejected at registration. (eb35f22, f5ff4dc)

```javascript
// Old: hooks could match non-canonical paths
app.beforeRouting('/**/admin', (req) => {});

// New: only canonical paths and proper glob patterns work
app.beforeRouting('/admin', (req) => {});
app.beforeRouting('/api/*', (req) => {}); // mid-path * not allowed; use trailing *
```

- **headerPreference defaults to X-Forwarded-For only** — Client IP resolution now defaults to trusting only the `X-Forwarded-For` header from proxies. Other headers like `Client-IP` are only trusted from proxies in `trustedProxies`. A warning is logged if more headers are configured to be trusted. (29f6644)

### Features

- **WebSocket permessage-deflate compression (RFC 7692)** — WebSocket connections now support optional compression via the permessage-deflate extension. (ac29be0)
- **WebSocket per-connection message rate limiting** — Rate limit individual WebSocket connections to prevent message flooding. (4882be8)
- **WebSocket heartbeat/keepalive detection** — Automatic dead connection detection via heartbeat frames to clean up stale WebSocket connections. (3d7d949)

### Bug Fixes

- **IP address parsing rejects leading zeros in IPv4 octets** — IPv4 octets with leading zeros (e.g., `192.168.001.1`) are now rejected to match Node's `net.isIP()` behavior, preventing octal interpretation attacks. (3ae2c75)
- **WebSocket upgrade headers use shared request parser** — WebSocket upgrade headers are now parsed with the same header parser as regular requests, ensuring consistent behavior. (e45c069)
- **X-Forwarded-For repeated headers joined correctly** — Multiple `X-Forwarded-For` header lines are now joined with `,` instead of keeping only the last one. (d286962)
- **Client IP resolved from socket peer with proxy validation** — Client IP is now resolved from the socket peer address by default, with `Client-IP` headers only trusted from addresses in `trustedProxies`. (35bef96)
- **X-Forwarded-For walk terminates at first untrusted hop** — Only hops in the `X-Forwarded-For` chain that come from trusted proxies are walked; the first untrusted hop ends the walk. (a15c32f)
- **trustedProxies validation compiles at construction** — `trustedProxies` patterns are now compiled and validated when the app is created, not on each request, fixing cache invalidation issues. (4e8f2ef)
- **Socket peer address parsing warns once on error** — Unparseable socket peer addresses now trigger a one-time warning instead of silent failure. (8aa813d)
- **Rate limiter per app instance** — Each app instance now gets its own rate limiter, so closing one app doesn't break another's rate limiting. (15a7823)
- **Rate limit counter only advanced by unnamed hooks** — Only unnamed hooks advance the creation counter; named hook clashes now trigger a warning instead of silently overwriting. (c624eca)
- **Global rate limiter runs after routing** — The global rate limiter now runs in its own stage after routing so `keyGenerator` has full route context. (f328126)
- **Global rate limiter built once per hook** — Each rate limit hook's limiter is built once at registration, not recreated per request. (4b5e15e)
- **Rate limit memory store bounded with expiry and sweep** — In-memory rate limit store now expires entries one window after the last write and periodically sweeps expired entries, with a configurable entry cap. (ba3a3dc)
- **rateLimit.enabled rejects non-boolean values** — The `enabled` option now strictly validates its type instead of guessing. (2fe36bf)
- **Rate limit Redis entries expire correctly** — Redis rate limit entries now expire one window after the last write, measured in milliseconds. (a904d50)
- **Route-level limiters use isolated Redis namespaces** — Each route-level rate limiter gets its own Redis key namespace based on its route registration, preventing cross-route interference. (caa052d)
- **Rate limiter destroy is restart-safe** — Calling `destroy()` on a rate limiter can now be safely called multiple times without errors. (ae5cc67)
- **Blocked clients not evicted before unblocked ones** — When the in-memory rate limit store hits capacity, blocked clients are never evicted before unblocked ones. (7fb113b)
- **IPv6 clients keyed by /56 subnet** — IPv6 clients are now keyed by their canonicalized /56 subnet, and IPv4-mapped IPv6 addresses are treated as IPv4. (6d7c648)
- **Global rate limiter runs before routing** — The global rate limiter now runs before routing so unmatched paths are throttled along with matched ones. (676d69e)
- **One budget and namespace per rateLimitHook instance** — Rate limit budget and Redis namespace are now per hook instance, not per route registration. (43eb2c0)
- **Redis counters not wiped on close** — Closing an app no longer wipes shared Redis rate limit counters, allowing other apps to continue counting. (a909be5)
- **Route literal text regex-escaped in router** — Route text is now properly regex-escaped so the router matches only the literal path, not a regex pattern. (cd79e68)
- **Hook routesToInclude/routesToExclude are optional** — Type definitions now correctly mark `routesToInclude` and `routesToExclude` as optional in hook options. (b12f2ba)

### Security

- **Default client IP strategy favors socket peer over headers** — Client IP now defaults to the socket peer, trusting proxy headers only from configured `trustedProxies`. Warnings are logged when configuration trusts additional headers. (29f6644, 35bef96, a15c32f)
- **Hook patterns validated against traversal attacks** — Patterns with `:param` or mid-path `*` are rejected at registration; paths with traversal sequences are rejected with 400. (f5ff4dc, eb35f22)
- **Rate limit hook patterns validated** — Hook patterns are now validated to prevent security issues from malformed patterns. (f5ff4dc)

### Internal

- **TypeScript strict mode errors resolved** — All 37 pre-existing TypeScript strict mode errors have been fixed. (cfb008f, dad4a74, 09a7149)
- **Default rate limit increased to 1000 requests/minute** — The default rate limit window now allows 1000 requests per minute instead of the previous default. (7bcb7d1)
- **Prettier and eslint formatting applied** — Code formatting brought into compliance across eight files. (980d756, 3054dd5)
- **Bun pinned to 1.2.17 in CI** — Build checks now declare sealed check lanes and pin Bun version for reproducibility. (75771d2)
- **Planning documents consolidated and cleaned** — Completed planning documents removed; future planning consolidated. (86fb880, 3d5fc84)

## [0.8.0] - 2026-04-24

### Features

- **WebSocket RFC 6455 frame protocol implementation** — Added complete frame protocol support with constants and type definitions for RFC 6455 compliance (4237a80)
- **WebSocket handshake validation and connection class** — Implemented handshake validation logic and connection management class for WebSocket clients (6b4ca03)
- **WebSocket framework integration with hooks and configuration** — Integrated WebSocket support into YinzerFlow with lifecycle hooks and configurable options (d344156)
- **WebSocket channel pub/sub with encode-once broadcast** — Added publish/subscribe messaging system for WebSocket channels with efficient broadcast encoding (97de59a)
- **WebSocket security controls and integration tests** — Implemented security controls and comprehensive integration test suite (3e6a2f5)
- **WebSocket exports, documentation and verification** — Added public API exports, documentation, and verification sweep across the WebSocket implementation (3bbfb6a)

### Bug Fixes

- **Fix strict TypeScript build errors with exactOptionalPropertyTypes** — Resolved strict TypeScript compilation errors related to optional property types in WebSocket implementation (0e43ea7)
- **Security hardening and naming convention improvements** — Applied security hardening measures, refactored test helpers to follow DRY principles, and improved naming conventions for consistency (bbe71b8)

### Internal

- **Format WebSocket exports for readability** — Improved code formatting and organization of WebSocket exports (ebfe6d3)
- **Improve YinzerFlow code formatting** — Enhanced overall code formatting and consistency across the framework (1bcd868)
- **Format WebSocket code consistently** — Applied consistent code formatting standards to WebSocket implementation (3e76ffc)

## [0.7.0] - 2026-02-20

### Bug Fixes

- **Clarify log level threshold behavior** — Fixed logging logic to properly enforce log level thresholds, ensuring messages below the configured level are correctly filtered (f2ff105)

### Internal

- **Move bundle check to preflight in publish workflow** — Reorganized publish process to validate bundles earlier in the pipeline (4b42643)
- **Improve type safety across core flow** — Enhanced type annotations and removed unsafe `typeof` checks in favor of explicit interfaces (36eb059, 1f29acf, 266a1bd)
- **Restructure logging into three independent channels** — Refactored logging system to separate concerns with per-instance loggers instead of a global singleton, improving isolation and testability (bb7d752, dc9738d, 534c8e7, 86e1207, 5b769d3, 8c10c1f)
- **Inject logger dependencies throughout middleware** — Threaded logger instances through cookie parser, rate limiter, and hook registry instead of relying on global state (874f6a4, e8277b3)
- **Consolidate logging configuration** — Unified logging config handling and clarified log level documentation in InternalConfiguration (15b9158, e9888db)
- **Improve utility functions** — Enhanced time utilities validation logic, added byte size conversion helpers, and removed unused utility functions (2e2a0bf, 004df51, 5e70bd2)
- **Verify npm credentials before git operations** — Updated publish script to check npm access before attempting git pushes (65dbead)
- **Remove dayjs dependency** — Eliminated unnecessary dayjs library from project dependencies (36c57ba)

## [0.6.14] - 2026-02-20

### Bug Fixes

- **Use correct API key environment variable** — Fixed publish script to reference the proper API key environment variable for changelog generation (c4f420c)

### Internal

- **Enhance preflight checks in publish script** — Refactored preflight validation logic to improve robustness of the publish process (09ad711)
- **Require API key for changelog generation** — Updated publish configuration to enforce API key presence when generating changelogs (04bfd70)

## [0.6.13] - 2026-02-20

- ``` 🔧 chore: update progress to Phase 2 (7a55239)
- ♻️ refactor(hook-registry): fix typo in error log (057a458)
- ♻️ refactor(request-response-handling): optimize headers (a133d7c)

All notable changes to YinzerFlow will be documented in this file.

## [0.6.12] - 2026-02-20

- ♻️ refactor(YinzerFlow): improve code formatting (c05d3dd)
- ♻️ refactor(YinzerFlow): extract TCP reassembly helpers (ff98cd1)
- 🔧 chore(build): remove custom build script (112efc4)
- 🔧 chore: update state doc, remove build cmd (877c81b)
- ♻️ refactor(publish): inline build steps (ff0f22e)
- ♻️ refactor(YinzerFlow): improve code consistency (296d8fd)
- 🔧 chore(build): include changelog in dist (e90c812)
- ♻️ refactor(publish): move npm check post-version (7ddd8ff)
- 🐛 fix(publish): allow env override in npm login (8466287)
- ♻️ refactor(publish): allow interactive npm login (03e66fa)
- 🔧 chore: add release automation script (87609fc)
- ♻️ refactor(build-scripts): consolidate scripts (918a87c)
- 🔧 chore: consolidate docs into .claude/ plans (0a4478c)
- ♻️ refactor(YinzerFlow): handle TCP stream reassembly (3a8abf3)
- ♻️ refactor(cors): optimize validation and improve (8ead380)
- ✨ feat(cors): add comprehensive CORS middleware with security-first implementation (c830e60)
- 📚 docs(docs): mark type standardization and hook system phases complete (4e1776e)
- ✨ feat(cors): export corsHook for external application integration (15882fc)
- ♻️ refactor(setup): move CORS configuration merging to CorsConfig class (46f33a6)
- ✨ feat(core): add beforeRouting hooks for pre-routing middleware (b7a02e3)
- ♻️ refactor(execution): replace direct CORS handling with hook-based approach (ac2fcd2)
- ✨ feat(hooks): add beforeRouting hook phase for pre-routing middleware (4fed224)
- ai(docs): add comprehensive documentation standards for YinzerFlow (4bfca9c)
- ♻️ refactor(parseIpAddress): rename type to InternalIpSecurityOptions (08bf84c)
- 🔧 chore(cursor): rename ServerConfiguration to ServerOptions in docs (7a3dd9b)
- 📚 docs(docs): add IP security CDN support and implementation roadmap (4fa23bc)
- ♻️ refactor(execution): rename configuration types to use Options suffix (311ea46)
- refactor(types): rename CORS Configuration to Options (f2769a2)
- refactor(types): rename ServerConfiguration to ServerOptions (b91644f)
- 📚 docs(docs): expand feature planning with granular body parser controls (89db5df)
- 🔧 chore(package): bump version to 0.6.11 (e0e1e7f)
- 🐛 fix(exports): expose Cookies type for external consumption (d1bc605)
- ♻️ refactor(core): use proper type imports for internal CORS and cookies (9c15345)
- ♻️ refactor(typedefs): extract inline cookies interface to dedicated type (4a77d63)
- 🔧 chore(cors): make CORS enabled configuration partially optional (d970b7d)
- ai: bump version to 0.6.9 and fix documentation typo (efdf5e4)
- ✨ feat(cors): rename CorsConfiguration to CorsOptions for consistency (cb639ae)
- asdf (d83100f)
- ✨ feat(Configuration): add BodyParserOptions type for middleware configuration (d3a063e)
- 🔧 chore(verification): remove Google site verification file (1eaf71b)
- 🔧 chore: add Google site verification file (9d98e03)
- 📚 docs(docs): update cookie-parser maxAge examples to support TimeString (d68c557)
- ✨ feat(cookieParser): add TimeString support for maxAge option (530b610)
- 🧪 test: add comprehensive cookie parser test suite (46e7a85)
- ✨ feat(cookies): add cookie parsing and signing support (c97b92c)
- 🔧 chore: bump version to 0.5.6 and update Redis deps (08e7896)
- 🐛 fix(ratelimiter): update Redis client type import (06b7b12)
- 🐛 fix: exclude peer dependencies from bundle (3340419)
- 🐛 fix: correct sliding window reset and Redis TTL handling (2d8c227)
- 🔧 chore(packagejson): bump version from 0.5.1 to 0.5.2 (a895adb)
- 🐛 fix(ratelimiter): preserve TTL when updating existing keys to fix race condition (f1fc1cd)
- ♻️ refactor(rate limit): improve type safety with generic handlers (91e8d20)
- 🔧 chore: add millisecond support to Redis retry delay (ef08787)
- 📚 docs(ratelimiting): add Redis store configuration and examples (49980a1)
- ✨ feat(ratelimiter): add Redis store support for distributed rate limiting (0117dca)
- 📚 docs(docs/ratelimiter): expand documentation template with comprehensive standards (1635207)
- 🐛 fix(request): change query parameter type from string to unknown (ed316d1)
- ✨ feat(logs): add table method for structured data display (285e8ec)
- 🔧 chore(format): remove trailing blank line from index.ts (26e2c86)
- ✨ feat(constants): export color, HTTP, and log constants (92fdb62)
- ♻️ refactor(request handler): fix hooks not returning when defined and improve readability (44ded8d)
- ♻️ refactor(route groups): use public RouteGroup type instead of internal (d83e000)
- ``` ♻️ refactor: clean up logging tests and remove whitespace (1e9c648)
- ♻️ refactor(core): consolidate network logging into single utility (37bd039)
- 🔧 chore(validation): add runtime validation for hook handler arrays (8b587b7)
- 📚 docs: add comprehensive JSDoc for YinzerFlow class (1339b18)
- 📚 docs: add explanation of state data storage capability in ContextImpl (488eb4a)
- ♻️ refactor(route setup): extract common route utilities and fix default handling (e73a422)
- ✨ feat(groups): implement nested route groups with inheritance (2f73280)
- ♻️ refactor(types): extract RouteGroup type from group method signature (919f3d5)
- 📚 docs: reorganize advanced configuration and add draft patterns guide (4bff461)
- 🐛 fix: standardize error handling and logging (6020c24)
- ♻️ refactor(request handling): move route matching to handler phase (164c446)
- 🐛 fix(types): add generic type parameter to HandlerCallback (fec562a)
- 📚 docs: add comprehensive README with quick start guide (32d90e1)
- 🐛 fix(package): correct homepage URL format in package.json (90ff24e)
- 🔧 chore: update package.json homepage to docs link (e1790fd)
- v2 first commit (288eaf4)
