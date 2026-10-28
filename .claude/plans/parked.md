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
  - Bucket cardinality grows with fingerprint variety, so the in-memory store needs a bound and
    the Redis store a TTL check before this ships.
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
