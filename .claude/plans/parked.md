# Parked

Work deliberately deferred, with what it costs later and the event that brings it back. Grep this
before touching the area an entry names.

## rate-limit-fingerprint — built-in client fingerprint key for the rate limiter

- **What**: a first-party fingerprint option for `rateLimit`, selectable by users alongside the
  default IP key, so they get finer client buckets without writing their own `keyGenerator`.
  Lightweight (no heavy deps, cheap per request) but resistant to the obvious dodge.
- **Shape it has to hold**:
  - Plugs in through the existing seam: `keyGenerator` in
    `app/core/modules/rateLimit/RateLimitConfig.ts` (default is `ctx.request.ipAddress`). Strategy
    and both stores stay untouched.
  - The fingerprint narrows the IP bucket, never replaces it (key = IP + fingerprint hash).
    Every header-based trait is client-chosen; a fingerprint-only key lets a bot rotate its
    `User-Agent` and get a fresh bucket per request, which is weaker than the IP key today.
  - Strong signals (TLS JA3/JA4, HTTP/2 settings frames) are the part that actually holds up.
    Whether Bun exposes the TLS ClientHello at all is unknown and needs a spike before design;
    behind a TLS-terminating proxy or CDN the framework never sees it and has to trust a header
    the proxy sets, through the same trusted-proxy path as `parseIpAddress.ts`.
  - Bucket cardinality grows with fingerprint variety. The in-memory store bound has landed
    (expiry, sweep and `store.maxEntries` cap, 2d3026e) and the Redis store already sets a per-key
    TTL of one window; the fingerprint feature itself is still waiting on its trigger.
- **Why deferred**: requested as a "someday" feature; current IP-key limiter is correct for what
  it claims, and the TLS-signal question is an unknown that needs a spike first.
- **Cost later**: low. The `keyGenerator` seam means the feature is additive; nothing built today
  has to be rewritten for it.
- **Trigger**: the next plan that touches `app/core/modules/rateLimit/`, or a user report of a
  client evading the IP limit (rotating IPs or many clients behind one NAT getting throttled
  together).

## request-target-dos-limits — no request-line length cap; multi-param segments backtrack

- **What**: `parseHttpRequest.ts` splits the whole buffered request with no cap on the request-line
  length (only the overall body-derived buffer cap applies), and a route with two params in one
  segment (`/:a-:b` → `([^\/]+)-([^\/]+)`) backtracks quadratically on a long segment.
  `canonicalizeRequestPath` itself is linear and is not the issue.
- **Why deferred**: found by the security review of the 0.9.0 hook-path fix (19a1275), outside its
  scope; a cap needs a chosen limit (nginx uses 8 KB for the request line) and a 414 response path,
  and the backtracking needs either a registration-time refusal of multi-param segments or a
  non-backtracking matcher. Both are design choices, not a patch.
- **Cost later**: low. Both changes are local (request-line parse, route compile) and nothing built
  since depends on unbounded request lines.
- **Trigger**: the next change to `parseHttpRequest.ts` or `compileRoutePatter.ts`, or a report of
  slow or stalled requests with long URLs.

## canonical-path-public-field — handlers and WebSocket upgrades only see the raw path

- **What**: routing and hook matching use the canonical path, but `ctx.request.path` is the raw
  request-target (query included, undecoded). A user hook that does its own
  `ctx.request.path.startsWith('/admin')` check is bypassed by `GET //admin` or `GET /%61dmin`, which
  the router still serves from `/admin`. The WebSocket `upgrade` handler has the same gap from the same
  cause: `WebSocketUpgradeRequest.path` (and the connection's path) is the raw path, so `//ws/admin`
  upgrades with `params.room === 'admin'` but `req.path === '//ws/admin'`. A read-only canonical field
  (or the matched route pattern) on both would give handlers the value routing used.
- **Why deferred**: 0.9.0 deliberately kept `request.path` raw and added no public field (docs never
  promised canonical; the access log and an existing test rely on the raw value), and the WebSocket
  upgrade follows the same decision. A new public field is API surface that wants a name and a decision
  from Patrick. The trap is documented on `Request.path` and `WebSocketUpgradeRequest.path` TSDoc and in
  docs/core/core-concepts.md.
- **Cost later**: low; additive field, nothing to rewrite.
- **Trigger**: a user report of a path check in a handler, custom hook or WebSocket `upgrade` handler
  being bypassed, or the next change to `RequestImpl`'s or `WebSocketUpgradeRequest`'s public fields.

## canonical-400-cors-headers — the malformed-path 400 carries no CORS headers

- **What**: `RequestHandlerImpl` answers a path that fails `canonicalizeRequestPath` with 400 before
  the `beforeRouting` stage, where the CORS hook runs. A cross-origin browser client gets a 400
  without `Access-Control-Allow-Origin`, so script sees an opaque network error instead of the
  400 body; an `OPTIONS` preflight to such a path fails the same way.
- **Why deferred**: review-round minor; the rejected requests are malformed (traversal, encoded
  slashes, bad encoding), which legitimate browser apps don't send, and the status still reaches
  the access log. Adding CORS headers means running the CORS decision on a path that has no
  canonical form, which wants its own small design (origin-only CORS on the reject path).
- **Cost later**: low; one call to the CORS header logic in `_rejectMalformedPath`, plus a test.
- **Trigger**: a user report of an opaque CORS error on a 400, or the next change to
  `_rejectMalformedPath` or the CORS hook.

## path-normalizer-drift — registration and request paths use two normalizers

- **What**: routes, WebSocket routes and hook patterns are normalized by `normalizePath`
  (`app/core/setup/utils/normalizeStringPatterns.ts`), which resolves `.`/`..` and keeps text it
  cannot decode; request paths go through `canonicalizeRequestPath`, which rejects both. They agree
  on every pattern a developer would write today (leading slash, no repeated or trailing slash,
  decoded once), but they are two implementations of one contract, so a change to one that isn't
  mirrored in the other reopens the router-vs-hook disagreement fixed in 19a1275. A route registered
  as `/a/../b` silently becomes `/b`, and a pattern with an invalid `%` silently never matches.
- **Why deferred**: review-round minor; no current divergence produces a wrong decision on a
  request, and unifying means changing registration semantics (reject `..` and bad `%` in
  developer patterns at startup), which is a breaking change for any app that has one.
- **Cost later**: low to medium; one shared normalizer with a "registration" mode that throws, plus
  re-running the route and hook tests.
- **Trigger**: the next change to either `normalizePath` or `canonicalizeRequestPath`.

## rate-limit-skip-options-unimplemented — skipSuccessfulRequests / skipFailedRequests do nothing

- **What**: `RateLimitConfig` accepts and stores `skipSuccessfulRequests` and `skipFailedRequests`
  (docs/modules/rate-limiting.md documents both), but nothing in the strategy or the hooks reads
  them: every request counts. Honouring them means counting after the response status is known
  (an afterAll-stage decrement or a deferred increment), which the before-stage limiter can't do.
- **Why deferred**: found during the 0.9.0 review round, outside its items; it needs a design for a
  post-response hook that also covers 404s now that the limiter runs in beforeRouting (cc0917e).
- **Cost later**: medium. A deferred-count path touches the strategy, both stores and the hook stage.
- **Trigger**: the next change to `SlidingWindowCounterStrategy` or the rate-limit hooks, or a user
  report that either option has no effect. Until then the docs overstate the feature.

## rate-limit-doc-api-drift — per-route examples use APIs that don't exist

- **What**: rate-limiting.md (6 places), rateLimithooks.ts TSDoc (5) and RateLimit.d.ts (1) attach
  per-route limits with `{ beforeRoute: [...] }` as the second argument and call `skipRateLimit()`.
  Route options are the third argument with `beforeHooks`, and `skipRateLimit` is not exported or
  implemented, so "per-route only, skip global" has no working recipe.
- **Why deferred**: found during the 0.9.0 review round; `skipRateLimit` needs a decision on whether
  to build it (a per-route opt-out of the global limiter) or delete the recipe.
- **Cost later**: low; doc edits plus, if built, a small hook and a test.
- **Trigger**: the next edit to rate-limiting.md or rateLimithooks.ts, or a user copying the example.

## cors-preflight-not-throttled — OPTIONS preflights bypass the global limiter

- **What**: with CORS enabled, the CORS hook answers preflight `OPTIONS` requests in `beforeRouting`,
  before the global limiter's stage (6c51ad2), so preflights are never counted or limited.
- **Why deferred**: review round 3 minor. A preflight is cheap (no handler runs), and throttling it
  changes browser behavior: a throttled preflight fails the real request with an opaque CORS error.
  Whether to count preflights, and against which bucket, is a product call.
- **Cost later**: low; run the limiter inside the CORS preflight branch, or count preflights in a
  separate cheap bucket, plus a test.
- **Trigger**: a report of preflight floods, or the next change to the CORS hook or the limiter stage.

## unthrottled-early-rejects — malformed-path 400s and WebSocket upgrades skip the limiter

- **What**: requests rejected by `canonicalizeRequestPath` get a 400 before any stage runs, and
  WebSocket upgrades are handled in `_handleWebSocketUpgradeAsync`, which never reaches
  RequestHandlerImpl, so neither is counted by the global limiter. The WebSocket path has its own
  per-IP connection cap and per-connection message limit, not a request-rate limit.
- **Why deferred**: review round 3 minor. Both rejections are cheap and happen before any user code
  runs; counting them means moving the limiter ahead of canonicalization (and keying on a path it
  just rejected) or wiring it into the upgrade path, which is a design choice.
- **Cost later**: low to medium; one limiter call in each early path, plus tests.
- **Trigger**: a report of a flood of malformed paths or upgrade attempts, or the next change to
  `_rejectMalformedPath` or the WebSocket upgrade handshake.

## sliding-window-is-fixed — the "sliding window counter" resets like a fixed window

- **What**: `SlidingWindowCounterStrategy` hard-resets on a new window and sets
  `previousWindowCount = 0`, so the weighted previous-window term is always zero. It behaves as a
  fixed window: a client can send `max` requests at the end of one window and `max` more at the start
  of the next, a 2x burst across the edge. The docs describe a true sliding window.
- **Why deferred**: review round 3, outside its items. Carrying the count over changes limiting
  decisions for every user (stricter at window edges), so it wants its own change with its own tests
  and a changelog line, not a ride-along.
- **Cost later**: low; carry `currentWindowCount` into `previousWindowCount` when exactly one window
  has passed, reset only after two, plus an edge-burst test. Redis entries need a two-window TTL then.
- **Trigger**: the next change to `SlidingWindowCounterStrategy`, or a report of edge bursts.

## clock-step-back-stale-entries — a backwards clock step leaves entries unexpirable for a while

- **What**: the strategy and the in-memory store use `Date.now()`. If the wall clock steps backwards
  (NTP correction, VM resume), `now - windowStart` goes negative, so a client's window doesn't reset
  until the clock catches up, and the store's expiry order no longer matches its insertion order, so
  the early-exit sweep stops at an entry that is "in the future" and leaves older ones behind until
  the clock passes them. Memory stays bounded by the cap.
- **Why deferred**: review round 3 minor. Rare, self-healing once the clock catches up, and the cap
  still bounds memory. The fix is a monotonic clock (`performance.now()` plus a start offset), which
  touches every timestamp the strategy and both stores share.
- **Cost later**: low; one clock source injected into strategy and store, plus a test with a stepped
  clock.
- **Trigger**: a report of a client stuck at 429 after a clock change, or the next change to how the
  limiter reads time.

## memory-store-cap-warning-logger — the cap warning goes to the module logger

- **What**: `createInMemoryStore` logs its one-time "reached its cap" warning with the module-level
  `log` from `@core/utils/log.ts`, not the app's per-instance logger. An app with a custom logger or
  log sink doesn't see it there.
- **Why deferred**: review round 3 minor. The store is created from `RateLimitConfig`, which doesn't
  carry the app logger today; threading it through config, the store factory and both stores is
  plumbing, not a fix to the bound itself.
- **Cost later**: low; pass the logger via the store options.
- **Trigger**: the next change to the store factory or RateLimitConfig's constructor signature, or a
  user asking where the warning went.

## access-log-hides-peer-under-star — with trustedProxies '*' the access log shows only the client-chosen IP

- **What**: since dbb006d the access log prints the resolved `request.ipAddress`. With
  `ipSecurity.trustedProxies: ['*']` every peer is trusted, so that address is whatever the leftmost
  `X-Forwarded-For` entry says, chosen by the client, and the socket peer that actually connected is never
  logged. An operator investigating abuse has no real address to block.
- **Why deferred**: review round 5 minor. `'*'` is documented as the spoofable escape hatch, and the right shape
  (log both the resolved client and the socket peer, or only add the peer when they differ) changes the
  nginx-style line format that log parsers depend on, which is a decision about the format, not a patch.
- **Cost later**: low; carry the socket peer on the request internally and append it to the log line.
- **Trigger**: the next change to the access-log line format, or an operator report of being unable to trace
  a client behind `'*'`.

## header-parser-leniency — header names with whitespace before the colon and bare CR/LF line breaks are accepted

- **What**: `app/core/execution/utils/parseRequestHeaders.ts:62-70` reads `X-Forwarded-For : v` as
  X-Forwarded-For and treats a bare CR or LF as a line break. Behind a front proxy that passes those bytes
  through, a client can smuggle its own X-Forwarded-For line after the proxy's and choose its resolved IP.
  RFC 9112 §5.1 says both get a 400. The WebSocket upgrade now uses the same parser, so it shares the gap.
- **Why deferred**: final security pass for 0.9.0 graded it a note: nginx and HAProxy reject both shapes before
  they reach YinzerFlow, and the leniency predates this release. Tightening the parser is a framing change that
  needs its own review against real clients.
- **Cost later**: low; reject the two shapes with 400 and add one table test.
- **Trigger**: the next change to parseRequestHeaders, or a deployment without a conforming front proxy.

## ws-upgrade-parse-error-logging — a malformed upgrade header logs an ERROR with a stack and raw client bytes

- **What**: `app/core/YinzerFlow.ts:668` throws on a malformed header name during a WebSocket upgrade;
  `_handleRequestError` logs it at ERROR with a full stack, quoting the client's raw header name (any length,
  ANSI escapes included). The socket is destroyed correctly; the cost is log noise and log injection of escapes.
- **Why deferred**: final security pass for 0.9.0 graded it a note; no client gains anything but log lines.
- **Cost later**: low; answer with a 400 through `_sendHttpError` and log the name at debug, JSON-quoted and
  truncated.
- **Trigger**: the next change to the upgrade path's error handling, or an operator report of noisy upgrade logs.

## xff-port-strip-lenient — `_stripPort` accepts non-numeric ports in X-Forwarded-For hops

- **What**: `app/core/execution/utils/parseIpAddress.ts:63-70` accepts `[::1]junk` and `1.2.3.4:abc` as hops.
  Only hops a trusted proxy wrote are ever parsed, so a client can't exploit it.
- **Why deferred**: final security pass for 0.9.0 graded it a note; it only affects proxy-written junk.
- **Cost later**: trivial; require 1-5 digits after the colon so junk falls back to the socket address.
- **Trigger**: the next change to parseIpAddress.ts hop parsing.
