# Changelog

## [Unreleased]

### Breaking Changes

- **`setStatusCode()` refuses 1xx, and 204, 205 and 304 never carry a body** — `setStatusCode(100)`, `101`, `103` or any 1xx sent an interim status as the final response, with a body, which desyncs clients and proxies; a `101` on a request carrying `Upgrade` let traffic tunnel past a proxy. It now throws (the request is answered 500 by `onError`); the WebSocket 101 comes only from `app.ws()`. A 204, 205 or 304 used to send the handler's return value and a `Content-Length`, which a client reads as the start of the next response; they now go out with no body, 204 and 304 with no `Content-Length` and 205 with `Content-Length: 0`. Code that relied on a body with 204 or on a 1xx response must change.
- **WebSockets are same-origin by default** — `websocket.allowedOrigins` used to default to `[]`, and an empty list allowed every origin, so any website could open a socket (logged in as the visitor, with cookie auth) unless you set a list. Now an unset `allowedOrigins` allows only upgrades whose `Origin` matches the request's `Host` (case-insensitive, default ports 80/443 normalized); `['*']` is the only way to allow every origin; `[]` refuses every browser origin; a list of origins matches exactly as before. Same-origin compares host and port only, not the scheme (which `Host` doesn't carry); an app serving both http and https should list its https origin. Behind a proxy that rewrites `Host`, list your public origin. `allowMissingOrigin` now applies under every setting, including `[]`. An `Origin` header that is present but empty is refused with 403 under every setting, `['*']` included; it used to count as missing. Entries are validated at startup: anything that isn't `scheme://host[:port]` (a path, trailing slash, wildcard, bare host, `'null'`, an explicit default port) or `'*'` mixed with other entries throws. See `docs/core/websockets.md`.

```typescript
new YinzerFlow({ websocket: { allowedOrigins: ['https://app.example.com'] } }); // a browser app on another origin
new YinzerFlow({ websocket: { allowedOrigins: ['*'] } }); // the old allow-all default, now explicit
```

### Security

- **Malformed header lines are a 400** — `Host : evil.com` (whitespace before the colon) was read as `Host`, a line starting with whitespace (an obs-fold continuation) was read as a new header, and a bare CR or LF inside the request head split one line into two. A proxy in front that read those bytes differently could be bypassed: an upgrade with `Host : evil.com` and `Origin: http://evil.com` passed the same-origin check. RFC 9112 §5.1 and §2.2 make each a 400, now answered before any hook runs, for HTTP requests and WebSocket upgrades.
- **Every WebSocket frame header is validated before its body is read** — control frames skipped the early size check, so a ping (or a frame with a reserved opcode) announcing 2 GB kept the connection open while the body buffered, and a reserved data opcode (0x3-0x7) was delivered to the `message` handler as a message. Now one check runs on every header as it arrives: a reserved opcode, a control frame that isn't final or announces more than 125 bytes, an unmasked frame and a misplaced continuation close with 1002, and an oversized message with 1009, all before any of the body is buffered.
- **A repeated `Host` header is a 400, and so is a repeated `Origin` on a WebSocket upgrade** — both were last-wins, so a proxy in front could route or check one value while YinzerFlow (and the WebSocket origin check) read another. RFC 9112 §3.2 makes more than one `Host` a 400 on every request; both are now answered 400 before any hook runs.
- **Oversized WebSocket frames are refused from their header** — the server waited for a whole frame before comparing its length with `websocket.maxPayloadLength`, so a client could announce a 2 GB frame and stream the body slowly, holding the connection open while hundreds of megabytes buffered. The announced length (and, for a fragment, the message total so far plus that length) is now checked as soon as the length bytes arrive, and the connection closes with 1009 before any of the body is buffered. Received data is no longer re-copied on every TCP chunk.
- **`websocket.maxPayloadLength` now bounds whole messages** — it was checked only per frame on the wire, so a client could send a message of any size split into fragments, or a compressed frame that inflated far past the limit (with compression enabled, a 64 KB frame reached the `message` handler as 64 MB, enough to exhaust memory). Fragments are now counted against the limit as they arrive and decompression stops at the limit; either closes the connection with 1009, like an oversized frame.

### Features

- **Warning for an idle timeout at or below the heartbeat interval** — `new YinzerFlow()` now warns when `websocket.idleTimeout` is at or below `websocket.heartbeat.interval`, and `app.ws()` warns when a route's `idleTimeout` is, unless that route sets `heartbeatInterval: 0`. A client that only listens would be closed for idleness before the next ping could keep it alive. The route warning goes to the app's logger.

### Bug Fixes

- **Out-of-order WebSocket fragments close with 1002** — a continuation frame with no fragmented message in progress was delivered as a message of its own, and a new text or binary frame arriving before a fragmented message's final fragment silently restarted it. Both are protocol errors under RFC 6455 and now close the connection with 1002; pings and other control frames between fragments still work.
- **A WebSocket frame with RSV2 or RSV3 set is closed with 1002** — the frame parser's error escaped the socket's data handler, so the client got no close frame (and under Node it was an uncaught exception). The connection now closes with 1002 (protocol error).
- **Every valid status code works** — `response.setStatusCode()` and `rejectUpgrade()` threw for any code outside a 16-entry table, so `setStatusCode(503)` or `rejectUpgrade(418)` answered 500. `httpStatus` and `httpStatusCode` now list the whole IANA registry plus 418 (new keys such as `serviceUnavailable`, `notImplemented`, `unprocessableContent`, `imATeapot`; every existing key is unchanged). Any other integer from 200 to 599 is sent with its class's reason phrase (`299 Success`); a code outside that range or a non-integer throws, with a clearer message. The `setStatusCode` parameter type now accepts any `number` while still autocompleting the listed codes.

- **`ws.subscribe()` on a closed connection leaked it** — subscribing after the client had gone (an `async` `open` handler resuming after an `await`, or a `close` handler) put the dead connection back in the channel for good, so `app.subscriberCount()` kept counting it and it was never freed. `subscribe` now does nothing on a closing or closed connection and returns `false`; it returns `true` otherwise (it used to return nothing).

- **permessage-deflate window sizes are honoured** — a client that asked for a smaller `server_max_window_bits` got that value in the handshake but frames compressed with `websocket.compression.serverMaxWindowBits`, which it couldn't inflate (Node's `ws` failed with "invalid distance too far back"); `send` and `publish` now compress with the window each connection agreed to. With `compression.clientMaxWindowBits` below 15, a client that hadn't offered `client_max_window_bits` (so may use 15) was closed with 1007; the server now always inflates with a 15-bit window.

### Internal

## [0.10.0] - 2026-10-29

Security release for WebSockets and global hooks. Read the breaking changes before upgrading; the behavior-change notes are in `docs/core/websockets.md` and `docs/core/core-concepts.md`.

### Breaking Changes

- **Global hooks run on WebSocket upgrades** — `beforeRouting` and `beforeAll` now run on every upgrade, with the same `routesToInclude`/`routesToExclude` matching as HTTP. Before, a ws route connected even when the same app's auth hook answered REST with 401. A hook that returns a value or sets a non-2xx status refuses the upgrade with that HTTP response; a hook answering 2xx on an upgrade is turned into a 403.
- **Global hooks run on unmatched routes** — `beforeAll` now runs before the 404 and `afterAll` runs on 404s, as in Express and Fastify, so an auth hook answers 401 on made-up paths instead of revealing which routes exist. Route params are empty on a miss; hooks must not assume a matched route.
- **The global rate limiter counts WebSocket upgrades** against the same budget and key as HTTP.
- **Unmatched upgrades are answered by `onNotFound`** — An SPA-fallback `onNotFound` that returns 200 HTML now answers them too; check for the `Upgrade` header there.
- **Upgrade refusals share one response path** — Origin 403, the per-IP cap 429 (now `429 Too Many Requests`), `false` and `rejectUpgrade()` refusals run `afterAll` and carry the default headers. Origin and per-IP cap checks run after the global hooks; an IP already at its cap is refused before any hook runs.
- **`allowedOrigins` allows a missing Origin by default** — Browsers always send Origin on WebSocket handshakes, so a missing one is a non-browser client. Set `websocket.allowMissingOrigin: false` to refuse it.
- **WebSocket handler errors** — A throw in `open`, `message`, `close` or `drain` goes to the route's `error` handler (or is logged once), and the connection stays open. Throws during an upgrade go to the app's `onError` and answer 500.
- **`publish()` counts only subscribers that took the message** (sent or buffered).
- **Strict request lines** — Requests must be `METHOD SP target SP HTTP/1.0|1.1` with single spaces; anything else, including empty or non-HTTP requests, gets 400. The response status line is always `HTTP/1.1`.
- **HEAD** — A hook's response to a HEAD request has no body, and HEAD to an unmatched path gets its 404 with no body.

```typescript
import { YinzerFlow, rejectUpgrade } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// One auth hook now guards REST, 404s and WebSocket upgrades alike
app.beforeAll([
  async (ctx) => {
    const user = await sessions.find(ctx.request.headers.authorization);
    if (!user) {
      ctx.response.setStatusCode(401);
      return { error: 'Unauthorized' };
    }
    ctx.state.userId = user.id;
  },
]);

app.ws<{ userId: string }>('/feed', {
  upgrade(req) {
    if (!req.state.userId) return rejectUpgrade(401, { error: 'Sign in again' });
    return { userId: String(req.state.userId) }; // becomes ws.data
  },
  message(ws, data) {
    const status = ws.send(`echo for ${ws.data.userId}: ${data}`); // 'sent' | 'buffered' | 'dropped'
  },
});
```

### Features

- **`rejectUpgrade(status, body?)`** — Return it from `upgrade()` to refuse with any 4xx/5xx status, such as a 401. Returning `false` still means 403.
- **`req.state` on the upgrade request** — The same `ctx.state` the global hooks wrote, so `upgrade()` can carry it into `ws.data`.
- **`send()` returns a status** — `'sent' | 'buffered' | 'dropped'` (exported as `wsSendStatus`), where it used to return nothing, so dropped messages are detectable.
- **`wsBeforeMessage` can drop a message** by returning `false`; call `ws.close(code, reason)` first to also close. A throw is still an error.
- **`websocket.allowMissingOrigin`** option (default `true`).

### Bug Fixes

- **Throwing message handler wedged the connection** — The failing frame was redelivered on every read, so later messages never arrived. Frames are now consumed before the handler runs.
- **A throw inside `upgrade()` dropped the socket** with no response; it now answers 500, and a malformed upgrade answers 400.
- **Per-IP slot leak** — A client that disconnected while an async hook or `upgrade()` was running still got a 101 and kept its connection slot until restart.
- **Response header injection** — The status line echoed the client's protocol token, so a bare LF in the request line could inject a header into the response.
- **Hooks and the WebSocket router parsed the request line differently** (`GET\t/ws`); there is now one parser.
- **`send()` on a destroyed socket** reports `'dropped'` instead of `'buffered'`.
- **Empty lines before the request line are ignored** (RFC 9112 §2.2) instead of answering 400.
- **Header-parse error logs** sanitize client bytes, at debug level for upgrades.

### Notes

- The idle timeout does not drop listen-only clients: the heartbeat is on by default and a client's pong resets the idle timer.
- An async `wsBeforeMessage` hook can reorder messages; this is now documented.

### Internal

- The release script treats a missing executable as a failed run instead of crashing after a successful publish.

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
