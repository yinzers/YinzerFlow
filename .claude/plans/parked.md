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
