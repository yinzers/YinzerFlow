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
