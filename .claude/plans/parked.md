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
  being bypassed, or the next change to `RequestImpl`'s or `WebSocketUpgradeRequest`'s path fields. Adding
  `WebSocketUpgradeRequest.state` in 0.10.0 was ruled not to fire this: it doesn't touch the path decision.

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

## unthrottled-early-rejects — malformed-path and malformed-handshake 400s skip the limiter

- **What**: requests rejected by `canonicalizeRequestPath` get a 400 before any stage runs, so the global limiter
  never counts them. WebSocket upgrades now run the limiter (0.10.0), but the same holds for an upgrade refused
  before the stages: a malformed handshake or a malformed path gets its 400 uncounted.
- **Why deferred**: review round 3 minor. Both rejections are cheap and happen before any user code runs; counting
  them means moving the limiter ahead of canonicalization and keying on a path it just rejected, which is a design
  choice.
- **Cost later**: low; one limiter call in `_rejectMalformedPath` and in the upgrade's two early 400s, plus tests.
- **Trigger**: a report of a flood of malformed paths or handshakes, or the next change to `_rejectMalformedPath`.

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

## http-parse-error-logging — a malformed HTTP request header gets no response

- **What**: `_processRequest` builds `ContextImpl` outside any handler, so when `parseRequestHeaders` throws (an
  invalid header name, too many or too long headers) the `.catch` in `_dispatchRequest` logs it at ERROR and destroys
  the socket with no response. The log line itself is safe since 0.10.0 (message through `_sanitizeLogField`, stack
  logged without its message line); what is left is the missing 400. The WebSocket upgrade path already answers 400
  (`_buildUpgradeContext`).
- **Why deferred**: answering 400 instead of dropping changes what every HTTP client sees for a malformed request,
  which wants its own changelog line and a decision on whether the 400 goes through the access log.
- **Cost later**: low; the same try/catch as `_buildUpgradeContext` around `new ContextImpl` in `_processRequest`,
  answering 400, plus one test.
- **Trigger**: the next change to `_processRequest` or `_handleRequestError`'s response behavior, or an operator report
  of clients getting dropped connections for bad headers.

## xff-port-strip-lenient — `_stripPort` accepts non-numeric ports in X-Forwarded-For hops

- **What**: `app/core/execution/utils/parseIpAddress.ts:63-70` accepts `[::1]junk` and `1.2.3.4:abc` as hops.
  Only hops a trusted proxy wrote are ever parsed, so a client can't exploit it.
- **Why deferred**: final security pass for 0.9.0 graded it a note; it only affects proxy-written junk.
- **Cost later**: trivial; require 1-5 digits after the colon so junk falls back to the socket address.
- **Trigger**: the next change to parseIpAddress.ts hop parsing.

## ws-heartbeat-route-interval-ignored — a route's heartbeatInterval only switches the heartbeat on or off

- **What**: `_ensureHeartbeatSweep` (app/core/YinzerFlow.ts) runs one `setInterval` at the global
  `websocket.heartbeat.interval` and returns early when the global heartbeat is disabled. A route's
  `heartbeatInterval` only sets `connection._heartbeatEnabled`, so `heartbeatInterval: 10` on a route still pings
  every 30 s, and with the global heartbeat off no route is pinged at all. The TSDoc now states this.
- **Why deferred**: found during the 0.10.0 idle-timeout investigation, which proved the defaults keep listen-only
  clients alive. Honouring per-route intervals means one sweep per distinct interval (or per-connection timers),
  which is a design choice about timer count, not a patch.
- **Cost later**: low; a Map of interval → sweep timer, started lazily, plus a test with two routes.
- **Trigger**: the next change to `_ensureHeartbeatSweep` or `WebSocketRouteOptions.heartbeatInterval`, or a user
  report of a route's heartbeat timing being ignored.

## unknown-method-read-as-get — a well-formed request with an unrouted method is handled as GET

- **What**: `parseHttpRequest` (app/core/execution/utils/parseHttpRequest.ts) maps any method that isn't in
  `httpMethod` to `GET`, so `PROPFIND /admin HTTP/1.1` runs the `GET /admin` route, and a WebSocket upgrade sent with
  method `FOO` is handshaken as if it were `GET`. RFC 9110 §9.1 says an unrecognized method gets 501.
- **Why deferred**: found while making the request line strict in 0.10.0; the strict grammar fix was about framing,
  and answering 501 for unknown methods changes what every non-standard client (WebDAV, custom verbs) gets, which
  wants its own changelog line.
- **Cost later**: low; return a flag for an unknown method and answer 501 next to `_rejectMalformedRequestLine`.
- **Trigger**: the next change to `parseHttpRequest`'s method handling or `httpMethod`, or a report of a custom
  method reaching a GET route.

## slow-headers-no-timeout — nothing bounds how long a client may take to send its request head or body

- **What**: `_handleConnection` (app/core/YinzerFlow.ts) buffers until `\r\n\r\n` with only a byte cap
  (`_maxBufferSize`, answered 413) and no timer, so a client that trickles bytes (a slowloris, including the leading
  empty lines RFC 9112 §2.2 now lets through) holds a socket open indefinitely. The same holds after the head: a
  request whose body never arrives (a `Content-Length` larger than what is sent) waits forever. Bytes are bounded,
  time is not. This predates 0.10.0.
- **Guard already in place** (0.11.0): a `Content-Length` larger than `_maxBufferSize` gets 413 at once from
  `_requestFraming`, so a client can't announce a body that could never fit and hold the socket waiting for it. A
  `Content-Length` within the cap whose bytes never come still waits.
- **Why deferred**: found while confirming the leading-CRLF strip is bounded, widened by the 0.11.0 security review; a
  header and body timeout needs chosen defaults (nginx `client_header_timeout` and `client_body_timeout` are 60 s,
  Node's `headersTimeout` 60 s and `requestTimeout` 300 s) and a 408 response path, which is a configuration decision,
  not a patch.
- **Cost later**: low; one per-connection timer reset as bytes arrive and cleared at dispatch, `headersTimeout` and
  `bodyTimeout` options, a 408, and a test for each phase.
- **Trigger**: a report of idle or half-sent connections piling up, or the next change to `_handleConnection` or the
  server's connection options.

## absolute-form-target-404 — `GET http://host/x HTTP/1.1` gets 404 instead of being served

- **What**: RFC 9112 §3.2.2 says a server MUST accept the absolute-form request-target (`http://host/path`).
  `canonicalizeRequestPath` (app/core/execution/utils/canonicalizeRequestPath.ts:45) treats the whole target as a path,
  so `http://host/x` collapses to `/http:/host/x`, no route matches, and the client gets 404. Not exploitable: hooks
  and the router both read that same canonical path, so no hook is skipped for a route that is then served.
- **Why deferred**: found in the 0.10.0 confirming security pass, which graded it a note. Clients send absolute form
  only to proxies, and nothing in front of YinzerFlow does that in current deployments; accepting it needs a decision
  on the authority part (ignore it, or check it against `Host`), which is more than a patch.
- **Cost later**: low. Strip `scheme://authority` before canonicalizing (keeping the path, or `/` when it is empty),
  or answer 400 for an absolute-form target, plus a table row in the canonicalization test and one integration test.
- **Constraint for whoever builds it** (0.11.0 security review): RFC 9112 §3.2.2 says the target's authority replaces
  `Host` when the target is absolute-form. Everything that reads `Host` (the WebSocket same-origin compare, the repeated-
  Host 400, user hooks) must then read the authority instead, or a request `GET http://evil.example/ws` with
  `Host: app.example` is routed for one host and origin-checked against another.
- **Trigger**: the first forward- or reverse-proxy deployment that sends absolute-form targets, or the first bug report
  of a 404 for a `http://...` request line.

## changelog-gate-no-tag-fail-open — `check-changelog.sh` passes when no `v*` tag is reachable

- **What**: `scripts/check-changelog.sh` finds its baseline with `git describe --tags --abbrev=0 --match 'v*'`
  and exits 0 ("nothing to compare against") when that finds nothing. In a checkout without tags (a shallow
  clone, or a fetch that skipped tags) the gate therefore passes for any `app/` change with no changelog entry.
  A failing `git describe` and a genuinely tagless repo look the same to the script.
- **Why deferred**: the only places it runs today are green-check on a full local checkout and the release
  script in the `bun` service, both of which have the tags; a hard failure on "no tag" would also break a
  brand-new repo before its first release. Telling "no tags exist" from "tags were not fetched" needs a signal
  the script does not have yet (for example `git rev-parse --is-shallow-repository`, or a required-tag setting).
- **Cost later**: low. Fail with exit 2 when `git rev-parse --is-shallow-repository` is true, or when the
  caller says tags are required, plus one table row in `scripts/__tests__/check-changelog.test.ts` using the
  fake git.
- **Trigger**: a CI lane that runs this check on a shallow clone (a default `actions/checkout` fetches depth 1
  and no tags), or any report of the check passing where an `app/` change had no entry.

## ws-accept-drops-hook-headers — headers a hook sets are silently dropped on an accepted upgrade

- **What**: a global `beforeAll`/`beforeRouting` hook that calls `ctx.response.addHeaders(...)` (a refreshed session
  `Set-Cookie`, a request id) and lets the upgrade through gets a bare 101: `_buildHandshakeResponse` writes only the
  handshake headers. Proved by the 0.11.0 item-4 probe. The docs say afterAll has no response to change on an accepted
  upgrade, but say nothing about headers set before it.
- **Why deferred**: copying hook headers onto a 101 is a design call (which headers are safe on a 101, and whether
  security defaults like `X-Content-Type-Options` belong there); nothing is corrupted, the headers are just absent.
- **Cost later**: low; merge a filtered set of `context._response._headers` into `_buildHandshakeResponse`, or
  document the drop, plus one test.
- **Trigger**: a user report of a cookie or header set in a hook missing on a WebSocket handshake, or the next change
  to `_buildHandshakeResponse`.

## ws-handler-promise-types — open/message/close are typed void though promises are handled

- **What**: `WebSocketHandlers.open`, `message` and `close` are typed `=> void` (app/typedefs/public/WebSocket.d.ts),
  but `_wrapWebSocketHandlers` already catches a returned promise's rejection. An `async open(ws)` therefore trips
  `@typescript-eslint/no-misused-promises` in user code, so the docs' late-subscribe example uses `.then().catch()`.
- **Why deferred**: found while documenting the 0.11.0 `subscribe` return value; widening public handler types is
  API surface that deserves its own changelog line.
- **Cost later**: trivial; `=> void | Promise<void>` on the three handlers, then simplify the websockets.md example.
- **Trigger**: the next change to `WebSocketHandlers`, or a user asking why `async open` fails lint.

## ws-close-then-destroy-1006 — clients see 1006 instead of the close code YinzerFlow sent

- **What**: limit and protocol closes call `close(code)` and then `_destroySocket()` at once, so the socket is gone
  before the client reads the close frame. The `ws` client reported `1006` for the 0.11.0 backpressure-overflow and
  oversize probes, where the server had written 1009.
- **Why deferred**: pre-existing on every close-and-destroy path; waiting for the close frame to flush (`socket.end`
  after the write) changes teardown timing for all of them and wants its own tests.
- **Cost later**: low; end instead of destroy after writing the close frame, with the existing 5 s force-destroy as the
  fallback, plus a test reading the close code with a real client.
- **Trigger**: a user report of 1006 where a 1008/1009 was expected, or the next change to `_destroySocket`.

## ws-route-options-unvalidated — app.ws() route overrides get no range checks

- **What**: `WebSocketRouteOptions` values (`idleTimeout`, `maxPayloadLength`, `heartbeatInterval`,
  `messageRateLimit`, `compressionThreshold`) are used as given; a negative `idleTimeout` or a `maxPayloadLength` of 0
  is never refused, unlike the same global options in `_validateWebSocketConfig`. The 0.11.0 warning for an idle
  timeout at or below the heartbeat interval covers only that one combination.
- **Why deferred**: the closed `ws-idle-below-heartbeat-unwarned` entry asked for a warning, which landed (aa1aa9a);
  validating every override means sharing the global validators with `app.ws()`, a separate change.
- **Cost later**: low; reuse the global range checks in `SetupImpl.ws` and throw there, plus a table test.
- **Trigger**: the next change to `WebSocketRouteOptions` or `SetupImpl.ws`, or a report of a nonsensical route
  override being accepted.

## status-413-phrase-drift — the oversize 413 is hard-coded with an older reason phrase

- **What**: `_rejectOversizedRequest` (app/core/YinzerFlow.ts) writes `413 Payload Too Large` as a literal, while
  `setStatusCode(413)` now sends the RFC 9110 phrase `Content Too Large` from `httpStatus`. Clients ignore reason
  phrases, so nothing breaks; it is two sources for one value.
- **Why deferred**: found while completing the status table in 0.11.0; changing the literal is a visible wire change
  with its own changelog line, outside that item.
- **Cost later**: trivial; use `mapStatusCodeToMessage(httpStatusCode.contentTooLarge)` in the literal.
- **Trigger**: the next change to `_rejectOversizedRequest` or to `_sendHttpError`.

## ws-origin-scheme-aware — same-origin ignores the Origin's scheme

- **What**: the 0.11.0 same-origin default compares the Origin's host and port with `Host` and never its scheme, so a page
  served over plain `http` on the same host and port passes for an `https` app. Documented in websockets.md with the
  advice to list the `https` origin.
- **Why deferred**: behind TLS termination the server can't know its own scheme; doing it right needs a setting the
  operator fills in (`websocket.publicScheme`, or trusting `X-Forwarded-Proto` from `ipSecurity.trustedProxies`), which
  is new API surface (security review of 0.11.0).
- **Cost later**: low; one option or trusted-header read and a scheme compare in `_isSameOrigin`, plus table rows.
- **Trigger**: a user asking for scheme-aware same-origin, or the next change to the WebSocket origin policy.

## unparsed-bytes-no-server-cap — no server-wide bound on bytes received but not yet parsed

- **What**: every WebSocket connection may hold up to `maxPayloadLength` of received, unparsed frame and fragment
  bytes, and nothing bounds the sum. With the defaults (`maxConnectionsPerIp` 50, `maxPayloadLength` 16 MB) one IP can
  hold about 800 MB, and many IPs scale it without limit. The per-frame and per-message caps (a6806d6, cb56dd2) bound
  each connection, not the server.
- **Why deferred**: found by the 0.11.0 security review; a server-wide budget needs a chosen default, a decision on
  what happens at the cap (refuse new upgrades with 503, or close the largest holder with 1009), and accounting across
  the receive buffer and fragment buffers, which is a design change, not a patch.
- **Cost later**: low to medium; a shared byte counter updated where `WebSocketReceiveBuffer` and the fragment list
  grow and shrink, a `websocket.maxBufferedBytes` option, its refusal path, and a test with two connections.
- **Trigger**: a memory report from a deployment (RSS growth under many slow WebSocket senders), or the next change to
  WebSocket connection limits (`maxConnectionsPerIp`, `maxPayloadLength` defaults or the per-IP accounting).

## chunked-request-bodies — Transfer-Encoding: chunked requests get 501

- **What**: since 0.11.0 `_requestFraming` (app/core/YinzerFlow.ts) answers any request carrying `Transfer-Encoding` with
  501 Not Implemented, and Content-Length plus Transfer-Encoding with 400. Before that a chunked body reached the
  handler raw, chunk-size lines included. Clients that stream a body without knowing its length (a Node
  `http.request` POST with no Content-Length, `fetch` with a stream body) can't send to YinzerFlow.
- **Why deferred**: the security review asked to stop mis-framing chunked bodies before release; a correct decoder
  (chunk sizes, extensions, trailers, the body-size cap applied while decoding, `Transfer-Encoding` values other than
  `chunked`) is a feature with its own tests, not a release-blocker patch.
- **Cost later**: medium; a streaming chunk decoder in the body phase of `_handleConnection` that enforces
  `_maxBufferSize` as it decodes, hands the handler the decoded body and drops `Transfer-Encoding`, plus a table test of
  valid, malformed and oversized chunk streams.
- **Trigger**: a user report of a streaming client, such as a Node `http.request` POST without a Content-Length,
  getting 501.

## ws-length-encoding-lenient — non-minimal lengths accepted; a top-bit 64-bit length closes 1009

- **What**: `_parseFrameHeader` (app/core/modules/websocket/WebSocketFrame.ts) accepts a payload length in a longer
  encoding than needed (a 16-bit length under 126, a 64-bit length under 65536), which RFC 6455 §5.2 requires to be
  minimal, and a 64-bit length with its most significant bit set (which §5.2 forbids) is read as a huge number and
  closed with 1009 by the size check instead of 1002.
- **Why deferred**: security review note for 0.11.0; neither shape gets a body buffered past `maxPayloadLength` since
  cb56dd2, so the only effect is accepting a non-conforming encoding and the close code a broken client sees.
- **Cost later**: trivial; two rules in `_headerViolation` (or a flag from `_parseFrameHeader`) returning 1002, plus
  three table rows next to the announced-length tests.
- **Trigger**: the next change to `_parseFrameHeader` or `_headerViolation`, or an Autobahn-style conformance run.

## ws-pong-bypasses-backpressure — pongs are written past the backpressure limit

- **What**: `_handleControlFrame` answers every ping with `this._socket.write(pongFrame)` directly, not through
  `_writeFrame`, so pongs are never counted against `backpressure.limit` or dropped under the `'drop'` strategy. A
  client that sends pings and never reads could grow the socket's write queue by up to 125 bytes plus header per ping.
  Nothing else bounds it: `messageRateLimit` counts only delivered messages, not control frames.
- **Why deferred**: security review note for 0.11.0, marked inconclusive: whether the kernel and Bun's socket buffering
  let the queue grow meaningfully before the peer's window closes hasn't been measured.
- **Cost later**: low; route pongs through `_writeFrame` (or skip a pong while backpressured, as RFC 6455 §5.5.3 lets
  an endpoint answer only the latest ping), plus a test with a backpressured mock socket.
- **Trigger**: a raw low-buffer client probe (pings at line rate, receive window near zero) showing write-queue growth,
  or a memory report from a deployment.

## request-head-single-cut — the request head is located and cut differently in different places

- **What**: one producer, three symptoms. The head is found by `_handleHeaderPhase` (`indexOf('\r\n\r\n')` after the
  leading empty lines), cut again by `parseHttpRequest` (first `\r\n` for the request line, then the next
  `\r\n\r\n` in the rest), and matched for upgrades by `_isWebSocketUpgrade`, a substring test over the raw head.
  - The two cuts disagree: a request with no header lines (`GET / HTTP/1.1\r\n\r\nbody`) leaves `rest` starting with
    `\r\n`, so `parseHttpRequest` finds the next `\r\n\r\n` inside the body and reads body bytes as headers.
  - The dispatched buffer is every byte received, not the head plus `Content-Length` bytes, so pipelined bytes after
    the body become part of it.
  - `_isWebSocketUpgrade` matches `upgrade: websocket` anywhere in the head, a header value included, instead of
    reading the parsed `Upgrade` and `Connection` headers.
- **Why deferred**: final 0.11.0 security pass, graded a note: the server closes every connection after one response
  (no keep-alive), so pipelined bytes are never a second request, and the head-parsing 400s in this release refuse the
  shapes that would steer either cut. One cut, computed once and passed to framing, the parser and upgrade detection
  (from the parsed headers), is a restructure of the connection state machine rather than a release fix.
- **Cost later**: medium; `_handleHeaderPhase` produces `{ requestLineEnd, headEnd, bodyEnd }` once, `RequestImpl`
  takes those offsets instead of re-cutting the string, the dispatched buffer is sliced at `bodyEnd`, and upgrade
  detection reads the parsed headers; plus table tests for a headerless request, pipelined bytes and a decoy
  `upgrade: websocket` value.
- **Trigger**: the next change to how the head is located (`_handleHeaderPhase` or `parseHttpRequest`), a deployment
  behind a front proxy that pipelines or reuses backend connections, or adding keep-alive.

## no-connection-close-header — responses close the socket without saying so

- **What**: every connection is closed after one response, but ordinary responses built by `ResponseImpl` don't send
  `Connection: close` (only the direct error writers `_sendHttpError` and the 413 path do). RFC 9112 §9.6 says a server
  that closes after a response should send it, so an HTTP/1.1 client or proxy that assumes persistence may try to
  reuse the connection and see a reset.
- **Why deferred**: final 0.11.0 security pass note; clients recover by reconnecting, and the right fix depends on
  whether keep-alive is added, which would change the header's meaning per request.
- **Cost later**: trivial; add `Connection: close` in `_parseResponseIntoString` (or where the socket is ended), plus
  one wire-level assertion.
- **Trigger**: adding keep-alive, a report of resets from a pooling client or proxy, or the next change to
  `_parseResponseIntoString`.

## close-reason-bom-stripped — a leading BOM in a close reason is dropped

- **What**: `_parseClosePayload` (app/core/modules/websocket/WebSocketFrame.ts) decodes the reason with
  `new TextDecoder('utf-8', { fatal: true })`, which strips a leading U+FEFF by default, so a reason that starts with
  a BOM reaches the `close` handler and the echoed frame without it.
- **Why deferred**: final 0.11.0 security pass note; only the reason text changes, the code and the validity check are
  correct, and no client depends on a leading BOM.
- **Cost later**: trivial; pass `ignoreBOM: true` to the decoder, plus one table row in the close-frame test.
- **Trigger**: the next change to `_parseClosePayload`, or a report of a close reason arriving altered.

