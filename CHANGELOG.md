# Changelog

## [0.10.0] - 2026-10-29

### Breaking Changes

- **WebSocket upgrade rejection now requires explicit API** — hooks that answer an upgrade with a 2xx status now refuse it with 403 instead of accepting it. Use the new `rejectUpgrade()` method to explicitly reject upgrades with any 4xx/5xx status.
  ```javascript
  // Old: returning a 2xx from a hook would accept the upgrade
  // New: must explicitly reject
  ctx.rejectUpgrade(403, 'Forbidden');
  ```
  (ab541a0)

- **WebSocket send() return value changed** — `send()` now returns a status string ('sent' | 'buffered' | 'dropped') instead of a boolean, allowing callers to distinguish between successful sends, buffered messages, and dropped messages when the socket is destroyed. (37f81a2)

### Features

- **WebSocket hooks receive global state** — `upgrade()` now receives `req.state` populated from global `beforeAll` hooks, enabling consistent state sharing across HTTP and WebSocket connections. (d09761c)
- **Explicit WebSocket upgrade rejection** — new `rejectUpgrade(status, reason?)` method allows hooks to reject upgrades with any 4xx/5xx status code. (67eba50)
- **WebSocket message filtering in hooks** — `wsBeforeMessage` hooks can now drop a message by returning `false`, giving applications fine-grained control over incoming messages. (a7b1365)

### Bug Fixes

- **HTTP request parsing now RFC 9112 compliant** — empty lines before the request line are now ignored per RFC 9112 2.2 specification. (5139e54)
- **Strict HTTP request-line parsing** — request-line parser is now strict and never echoes the client's HTTP version back, preventing potential version confusion attacks. (364a693)
- **WebSocket per-IP slot leak on mid-upgrade disconnect** — fixed a resource leak where clients disconnecting during the upgrade handshake would not release their per-IP capacity slot. (4086954)
- **WebSocket capacity enforcement timing** — IP capacity now enforced before running app code, preventing unnecessary processing when a client is already at its connection cap. (1d96a0d)
- **WebSocket upgrade refusal consistency** — all upgrade refusals now go through the context response object, ensuring uniform error handling. (7b60c15)
- **WebSocket upgrade error responses** — upgrade errors now correctly return 500, and malformed upgrades return 400. (7832551)
- **Global HTTP hooks on upgrades** — `beforeAll` and `afterAll` hooks and rate limiter now run on WebSocket upgrades, not just HTTP requests. (8be8f5d)
- **Hooks on unmatched routes** — `beforeAll` and `afterAll` hooks now correctly execute even for unmatched routes. (99a3089)
- **HEAD request body stripping in hooks** — hook responses to HEAD requests now correctly strip the body. (04bc9a8)
- **WebSocket send() on destroyed socket** — calling `send()` on a destroyed socket now reports 'dropped' instead of failing silently. (d41b510)
- **WebSocket handler crash recovery** — a throwing message handler no longer wedges the connection; subsequent messages are processed normally. (584d26d)

### Security

- **Header parse error log sanitization** — client bytes in header-parse error logs are now sanitized to prevent log injection attacks across HTTP and WebSocket upgrades. (a911d0e)
- **Missing Origin header support** — added `allowMissingOrigin` option to explicitly control whether upgrades with a missing Origin header are allowed, improving security posture for Origin validation. (b5d2dad)

### Internal

- **Publish failure handling** — missing executables in publish operations are now treated as failed runs rather than crashes, improving reliability of the release process. (0589f92)

## [0.9.0] - 2026-10-28

Security release. Read the breaking changes before upgrading; the full upgrade notes are in `docs/modules/rate-limiting.md` under "Behavior change in 0.9.0".

### Breaking Changes

- **Rate limiting is on by default** — The global limiter now runs unless you set `rateLimit.enabled: false`, as the docs always said. Default: 1000 requests per 1-minute window per client IP, matching `@fastify/rate-limit`. It runs after routing and before `beforeAll`, so unmatched paths (404s) are throttled too, and a custom `keyGenerator` sees route params and state set in `beforeRouting`, but not state set in `beforeAll`. `enabled` must be a boolean.
- **Client IP headers are only trusted from trusted proxies** — Forwarded-IP headers are read only when the socket peer is in `ipSecurity.trustedProxies` (default `127.0.0.1`, `::1`); otherwise `request.ipAddress` is the socket address. Apps behind a proxy or load balancer that isn't on localhost must add its address or CIDR range, or every user resolves to the proxy's IP and shares one rate-limit bucket.
- **`headerPreference` defaults to `['x-forwarded-for']`** — It used to include five headers. List any other header your proxy always sets, for example `['cf-connecting-ip']` behind Cloudflare or `['x-real-ip']` for an nginx that sets only X-Real-IP. The first listed header present on a request is final.
- **Malformed paths get 400** — Paths with `.`/`..` segments, encoded slashes (`%2f`, `%5c`), backslashes, NUL, a raw `%`, or invalid percent-encoding are rejected before any hook runs.
- **Hook patterns are validated** — `routesToInclude`/`routesToExclude` entries with `:param` or a mid-path `*` throw at registration (they never matched anything). Use exact paths or a trailing `/*`.
- **Malformed `trustedProxies` entries throw at startup** — For example `'localhost'`, `'10.0.0.*'` or `''`.
- **`request.ipAddress` is canonical** — IPv4-mapped IPv6 becomes plain IPv4; IPv6 is lower-case and compressed.
- **Route patterns mixing a param and `*`** (such as `/files/:id/*`) no longer match the bare prefix.
- **Redis rate-limit keys moved** — Global counters live under `<prefix>global:` and hook counters under `<prefix>hook:<name>:`, so existing counters restart once.

```typescript
// Behind a load balancer on your private network
const app = new YinzerFlow({
  ipSecurity: { trustedProxies: ['10.0.0.0/8'] },
});

// Hook options: either list is optional, patterns are exact paths or a trailing /*
app.beforeAll([authHook], { routesToExclude: ['/health', '/public/*'] });
```

### Security

- **Hook bypass fixed** — Hooks and routing now match one canonical path, so `/admin?x=1`, `/admin/`, `//admin` and `/public/..%2fsecret` can no longer skip a hook while still reaching the handler. Route literals are regex-escaped, so `/v1/0/items/5` no longer reaches a `/v1.0/items/:id` route past a `/v1.0/*` hook.
- **Client IP spoofing fixed** — A client could pick its own IP, and its own rate-limit bucket, with a forged `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `X-Client-IP` or `True-Client-IP`. X-Forwarded-For is now walked right to left from the socket peer, stopping at the first untrusted hop; repeated X-Forwarded-For lines are joined per RFC 9110.
- **Rate-limit memory store is bounded** — Entries expire one window after the last write and are swept, with a `store.maxEntries` cap (default 100,000). Blocked clients are never evicted before unblocked ones.
- **IPv6 clients are keyed by /56 subnet** (configurable as `ipv6Subnet`), so one IPv6 host can't get a fresh bucket per address.

### Features

- **`trustedProxies` accepts CIDR ranges** for IPv4 and IPv6, alongside exact IPs and `'*'`.
- **`rateLimitHook({ name })`** — Names a hook's Redis namespace; recommended for multi-node Redis.
- **WebSocket**: permessage-deflate compression (RFC 7692), per-connection message rate limiting, and heartbeat dead-connection detection.

### Bug Fixes

- **Per-route rate limits now limit** — `rateLimitHook()` built a new limiter on every request, so route-level limits never counted. One hook now means one budget, shared across GET/HEAD and every route it's attached to.
- **Redis rate-limit entries expire correctly** — They expire one window after the last write, in milliseconds, matching the memory store.
- **`close()` no longer wipes Redis counters** shared with other nodes, and destroys every limiter the app owns; restarting with `listen()` keeps limiting.
- **Hook option types** — `routesToInclude` and `routesToExclude` are both optional (new public type `GlobalHookOptions`).
- **WebSocket upgrades** use the same header parser and client-IP resolution as HTTP.
- **Docs** — `beforeAll`/`afterAll` are documented as running on matched routes only, and examples now use options that exist (`window`, not `windowMs`).

### Internal

- TypeScript strict-mode errors resolved; formatting applied; Bun pinned to 1.2.17.
- Releases run from a compose `bun` service: `docker compose run --rm bun scripts/publish.ts`.

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
