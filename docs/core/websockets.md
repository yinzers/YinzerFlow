# 📖 WebSockets

YinzerFlow includes production-level WebSocket support built on raw RFC 6455 — the same TCP-level approach as the HTTP server. No external dependencies.

- **Channel-based pub/sub** with encode-once broadcast (frame encoded once, raw bytes to all subscribers)
- **Per-socket typed data** — generics flow through all handlers
- **Backpressure handling** — `'buffer'` (safe default) or `'drop'` (for real-time data like trading quotes)
- **Heartbeat/keepalive** — server-initiated ping/pong detects dead connections automatically
- **Message rate limiting** — per-connection token bucket throttling
- **Compression** — permessage-deflate (RFC 7692) with broadcast-safe no-context-takeover
- **Hook integration** — global `beforeRouting` / `beforeAll` hooks and the global rate limiter run on upgrades; `wsBeforeMessage` / `wsAfterMessage` run per message
- **Security** — origin validation, per-IP connection limits
- **Zero overhead** when no `app.ws()` routes registered

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

app.ws('/chat', {
  open(ws) {
    ws.subscribe('general');
  },
  message(ws, data) {
    ws.publish('general', data as string);
  },
});

await app.listen();
```

# ⚙️ Usage

## 🎛️ Settings

### websocket.maxPayloadLength — @default <span style="color: #2ecc71">`16777216`</span> (16MB)

Maximum incoming message payload in bytes, as your `message` handler would receive it. The limit holds for a single frame, for the running total of a fragmented message, and for what a compressed message inflates to; past it the connection is closed with code 1009 and the handler isn't called.

<span style="color: #f39c12">**⚠️ Behavior change in 0.11.0:**</span> before 0.11.0 only each frame was checked, so a message split into fragments, or a small compressed frame that inflated past the limit, reached the handler at any size.

```typescript
const app = new YinzerFlow({
  websocket: {
    maxPayloadLength: 1_048_576, // 1MB
  },
});
```

### websocket.idleTimeout — @default <span style="color: #2ecc71">`120`</span> (seconds)

Seconds of inactivity before closing the connection. Set to `0` to disable.

Any frame the client sends resets the timer, and that includes the pong a client answers each heartbeat ping with. Every browser answers pings automatically, so a listen-only client (a dashboard, a ticker) that never sends a message stays connected with the defaults: the server pings every 30 seconds, well inside the 120-second idle timeout.

<span style="color: #e74c3c">**⚠️ Warning:**</span> keep `idleTimeout` above `heartbeat.interval`. With the timeout at or below the interval, a listen-only client is closed for idleness before the next ping can keep it alive, and YinzerFlow logs a warning at startup (or when `app.ws()` registers a route whose `idleTimeout` is at or below the interval). Disabling the heartbeat has the same effect for clients that never send.

<span style="color: #f39c12">**⚡ Performance:**</span> For high-frequency data streams (trading quotes), the idle timeout resets on every received frame — frequent data prevents timeout.

### websocket.maxConnectionsPerIp — @default <span style="color: #2ecc71">`50`</span>

Maximum concurrent WebSocket connections from a single IP address.

### websocket.allowedOrigins — @default <span style="color: #2ecc71">unset</span> (same-origin only)

Which browser origins may open a WebSocket. An upgrade whose `Origin` isn't allowed gets 403; one with no `Origin` header at all is governed by `allowMissingOrigin` below, in every form.

<span style="color: #f39c12">**⚠️ Behavior change in 0.11.0:**</span> before 0.11.0 the default was `[]` and an empty list allowed every origin, so any website could open a socket to your server unless you set a list. Now leaving the option unset allows only the same origin, `['*']` is the only way to allow every origin, and `[]` allows no browser origin at all. An app that served browsers from another origin with the old default must now list that origin (or set `['*']`). A list of origins behaves as before.

The three forms:

```typescript
// Unset (default): same-origin only. A page at https://app.example.com may connect to wss://app.example.com
const sameOrigin = new YinzerFlow({ port: 3000 });

// A list: exactly these origins, matched case-insensitively
const listed = new YinzerFlow({
  websocket: {
    allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
  },
});

// ['*']: every origin. '*' must be the only entry
const open = new YinzerFlow({ websocket: { allowedOrigins: ['*'] } });
```

- **Same-origin** compares the `Origin` header's host and port with the request's `Host` header, ignoring case. A missing port counts as the default for the `Origin`'s scheme (80 for `http`/`ws`, 443 for `https`/`wss`), so `Host: app.example.com:443` matches `Origin: https://app.example.com`, while `Host: app.example.com:3000` doesn't match `Origin: http://app.example.com:4000`. Only `http`, `https`, `ws` and `wss` origins can be same-origin; an app shell origin such as `capacitor://localhost` has to be listed.
- **Same-origin compares host and port, not the scheme.** The `Host` header carries no scheme, and behind TLS termination YinzerFlow can't tell whether the client connected over `https`, so `Origin: http://app.example.com` and `Origin: https://app.example.com` both match `Host: app.example.com` when their ports line up. If your app serves both `http` and `https` on the same host, list the `https` origin explicitly (`allowedOrigins: ['https://app.example.com']`) so a page loaded over plain `http`, which a network attacker can inject into, can't open the socket.
- **Behind a proxy that rewrites `Host`** (for example one that forwards to `localhost:3000`), the browser's `Origin` no longer matches the `Host` YinzerFlow sees, so same-origin refuses every browser. List your public origin explicitly: `allowedOrigins: ['https://app.example.com']`.
- **`[]` blocks every browser origin.** That is intentional: use it for an endpoint only non-browser clients (servers, CLIs, native apps) should reach. With `allowMissingOrigin: false` as well, nothing can connect.
- **`['*']`** logs a security warning at startup. Use it only when the upgrade isn't authenticated by cookies.
- **Entries are checked at startup.** Each must be an origin as a browser sends it: scheme, host and optional port, like `'https://app.example.com'` or `'http://localhost:3000'`. A path, a trailing slash, a wildcard such as `'https://*.example.com'`, a bare host, `'null'`, an explicit default port (`'https://app.example.com:443'`, which browsers never send) or `'*'` next to other entries throws.

<span style="color: #e74c3c">**🚨 Cookie-authenticated WebSockets:**</span> if your upgrade is authenticated by a cookie (a session cookie read in a `beforeAll` hook or in `upgrade`), don't widen this past the origins you trust. Browsers send the user's cookies on a cross-site WebSocket upgrade and, unlike `fetch`, WebSockets are not covered by CORS, so with `['*']` any page the user visits can open a socket that is logged in as them (cross-site WebSocket hijacking). Token auth sent in a header or the first message isn't exposed this way, because another site can't read or attach the token.

### websocket.allowMissingOrigin — @default <span style="color: #2ecc71">`true`</span>

Whether an upgrade that carries no `Origin` header is allowed, whatever `allowedOrigins` is set to (unset, `['*']`, `[]` or a list). Browsers always send `Origin` on a WebSocket upgrade, so a missing one means a non-browser client (another server, a CLI, a native mobile app), and cross-site hijacking needs a browser. Set `false` to require an allowed `Origin` from every client.

<span style="color: #f39c12">**⚠️ Behavior change in 0.10.0:**</span> before 0.10.0 a list rejected every upgrade without an `Origin` header with 403, which locked non-browser clients out. Set `allowMissingOrigin: false` to keep that behavior.

<span style="color: #f39c12">**⚠️ Behavior change in 0.11.0:**</span> before 0.11.0 this had no effect while `allowedOrigins` was empty (which then meant allow-all). It now applies under every setting.

```typescript
// Browser app plus server-to-server clients (default)
const app = new YinzerFlow({ websocket: { allowedOrigins: ['https://app.example.com'] } });

// Browser-only endpoint: every client must present an allowed Origin
const strict = new YinzerFlow({ websocket: { allowedOrigins: ['https://app.example.com'], allowMissingOrigin: false } });
```

### websocket.backpressure.strategy — @default <span style="color: #2ecc71">`'buffer'`</span>

How to handle outgoing data when the client can't keep up:

<aside>

Options: `'buffer' | 'drop'`

- `'buffer'`: Queue messages up to `limit` bytes, then close the connection. Safe default — no data loss unless the client is overwhelmed.
- `'drop'`: Silently discard messages. Ideal for real-time data streams (trading quotes, live telemetry) where stale data is worse than gaps.
</aside>

```typescript
// Trading data — drop stale quotes rather than buffering
const app = new YinzerFlow({
  websocket: {
    backpressure: {
      strategy: 'drop',
    },
  },
});
```

### websocket.backpressure.limit — @default <span style="color: #2ecc71">`1048576`</span> (1MB)

Maximum bytes to queue before closing the connection (only applies to `'buffer'` strategy).

### websocket.heartbeat.enabled — @default <span style="color: #2ecc71">`true`</span>

Enable server-initiated ping/pong heartbeat. Detects half-open TCP connections (where the client's network died without a clean close) that idle timeout alone cannot catch.

Uses an efficient two-state sweep — one `setInterval` for all connections, regardless of count.

<span style="color: #e74c3c">**⚠️ Warning:**</span> Disabling heartbeat means dead connections accumulate silently, consuming memory and receiving broadcast data that goes nowhere.

### websocket.heartbeat.interval — @default <span style="color: #2ecc71">`30`</span> (seconds)

Seconds between ping sweeps. Also the dead-connection detection window — a connection that doesn't respond within one interval is closed.

```typescript
const app = new YinzerFlow({
  websocket: {
    heartbeat: {
      enabled: true,
      interval: 15, // faster detection, more pings on the wire
    },
  },
});
```

### websocket.messageRateLimit.enabled — @default <span style="color: #2ecc71">`false`</span>

Enable per-connection incoming message rate limiting. Uses a token bucket algorithm — O(1) per message, handles bursts naturally. When exceeded, the connection is closed with RFC 6455 code 1008 (Policy Violation).

Only complete messages count (after fragment reassembly). Control frames (ping, pong, close) are never rate-limited.

### websocket.messageRateLimit.maxMessages — @default <span style="color: #2ecc71">`100`</span>

Maximum messages allowed per window. Must be an integer >= 1.

### websocket.messageRateLimit.window — @default <span style="color: #2ecc71">`10`</span> (seconds)

Window duration in seconds. Must be an integer >= 1.

```typescript
const app = new YinzerFlow({
  websocket: {
    messageRateLimit: {
      enabled: true,
      maxMessages: 50,
      window: 5, // 50 messages per 5 seconds
    },
  },
});
```

### websocket.compression.enabled — @default <span style="color: #2ecc71">`false`</span>

Enable permessage-deflate compression (RFC 7692). Negotiated per-connection during the handshake — clients that don't offer the extension connect normally without compression.

Uses **no-context-takeover** mode to preserve the encode-once broadcast pattern. Compressed frames are connection-independent, so the same compressed `Buffer` is sent to all compressed subscribers.

### websocket.compression.level — @default <span style="color: #2ecc71">`1`</span>

zlib compression level (1-9). Lower = faster, higher = better ratio. Level 1 is recommended for real-time data where latency matters more than bandwidth.

### websocket.compression.threshold — @default <span style="color: #2ecc71">`128`</span> (bytes)

Skip compression for payloads smaller than this. Compression overhead can make tiny messages larger.

### websocket.compression.serverMaxWindowBits — @default <span style="color: #2ecc71">`11`</span>

Largest LZ77 window the server compresses with (2^bits bytes). Range: 9-15. A client that asks for a smaller window (`server_max_window_bits` in its offer) gets frames compressed with its value, broadcasts included: `publish` compresses once per distinct window its subscribers agreed to.

| Window Bits | Window Size | Memory | Compression |
|:-----------:|:-----------:|:------:|:-----------:|
| 9 | 512 bytes | ~12 KB | ~50% |
| 11 | 2 KB | ~15 KB | ~70% |
| 13 | 8 KB | ~20 KB | ~74% |
| 15 | 32 KB | ~44 KB | ~77% |

<span style="color: #3498db">**💡 Tip:**</span> Window bits 11 (2KB) is the sweet spot — 70% compression at ~15KB memory. The jump from 11 to 15 is marginal (+7%) but costs 3× the memory.

### websocket.compression.clientMaxWindowBits — @default <span style="color: #2ecc71">`15`</span>

The client LZ77 window size the server asks for. It is only sent when the client offered `client_max_window_bits` (RFC 7692 forbids it otherwise), so a client that didn't may still compress with 15 bits. The server inflates every message with a 15-bit window, which decodes any smaller one, so this setting never causes a decompression failure.

<span style="color: #f39c12">**⚠️ Behavior change in 0.11.0:**</span> before 0.11.0 the server compressed with the configured `serverMaxWindowBits` even after agreeing to a smaller window, which clients such as Node's `ws` couldn't inflate, and inflated with `clientMaxWindowBits`, which closed the connection with 1007 when that was below 15 and the client hadn't been limited.

```typescript
// Production: compression enabled for JSON-heavy trading data
const app = new YinzerFlow({
  websocket: {
    compression: {
      enabled: true,
      level: 1,
      threshold: 128,
      serverMaxWindowBits: 11,
    },
  },
});
```

## 🔧 Route Registration

### app.ws(path, handlers, options?)

Register a WebSocket route. Supports parameterized paths (`:param`) just like HTTP routes.

```typescript
// Simple echo server
app.ws('/echo', {
  message(ws, data) {
    ws.send(data);
  },
});

// Parameterized path
app.ws('/chat/:room', {
  upgrade(req) {
    return { room: req.params.room };
  },
  open(ws) {
    ws.subscribe(`room:${ws.data.room}`);
  },
  message(ws, data) {
    ws.publish(`room:${ws.data.room}`, data as string);
  },
});
```

### Handler Lifecycle

| Handler | When | Use for |
|---------|------|---------|
| `upgrade(req)` | Before handshake | Auth, attach per-socket data, reject with `false` (403) or `rejectUpgrade(status, body?)` |
| `open(ws)` | After handshake | Subscribe to channels, send welcome message |
| `message(ws, data, isBinary)` | On each message | Business logic, pub/sub |
| `close(ws, code, reason)` | On disconnect | Cleanup (unsubscribe is automatic) |
| `error(ws, error)` | On a socket error, or when another handler throws | Logging, alerting |
| `drain(ws)` | When backpressure clears | Resume sending |

### Refusing an Upgrade

Return `false` from `upgrade(req)` to refuse with 403. To refuse with another status, return `rejectUpgrade(statusCode, body?)`: the client gets a plain HTTP response with that 4xx or 5xx status and body (serialized like a route handler's return value; `{ "error": "WebSocket upgrade rejected" }` when omitted) and no handshake. A 401 tells a browser client to sign in again, where a 403 says it never will be allowed.

```typescript
import { rejectUpgrade } from 'yinzerflow';

app.ws<{ userId: string }>('/feed', {
  async upgrade(req) {
    const session = await sessions.find(req.headers.authorization);
    if (!session) return rejectUpgrade(401, { error: 'Sign in again' });
    if (!session.canStream) return false; // 403
    return { userId: session.userId };
  },
});
```

<span style="color: #3498db">**💡 Tip:**</span> `rejectUpgrade` throws for a status outside 400 to 599; that throw is answered with 500 like any other error in `upgrade`.

### Handler Errors

<span style="color: #f39c12">**⚠️ Behavior change in 0.10.0:**</span> the route's `error` handler now also receives errors thrown by `open`, `message`, `close` and `drain`, not only socket errors, and the connection stays open afterwards. Before 0.10.0 such a throw went unhandled (and a throwing `message` handler could stop the connection from delivering later messages). An `error` handler written to clean up after a dead socket should check whether the connection is still open (`ws.readyState`) before treating every call as fatal.

A handler that throws (or returns a rejected promise) never takes the connection down. The message that caused it is consumed, later messages keep arriving, and the error goes to the route's `error(ws, error)` handler, the way `onError` owns HTTP errors. A route without an `error` handler gets the error logged once at error level. The same applies to `open`, `close` and `drain`, with or without `wsBeforeMessage` hooks registered.

```typescript
app.ws('/jobs', {
  message(ws, data) {
    const job = JSON.parse(String(data)); // a bad payload throws here
    ws.send(`queued ${job.id}`);
  },
  error(ws, error) {
    // Called for socket errors and for errors thrown by the handlers above; the connection stays open
    ws.send(JSON.stringify({ error: error.message }));
  },
});
```

<span style="color: #3498db">**💡 Tip:**</span> Call `ws.close(code, reason)` from `error` when a failure should end the connection.

Before the handshake there is no `ws` yet, so a throw from a global hook or from `upgrade(req)` goes to the app's `onError` handler instead, exactly like an HTTP error. The client gets that response as a plain HTTP response (500 by default, and 500 if `onError` leaves the status at 200), and the socket is closed. An upgrade request whose headers fail parsing (an invalid header name, too many or too long headers) gets a 400 and one debug-level log line with the reason sanitized (control characters and newlines stripped) and cut to 200 characters.

### Per-Socket Typed Data

The `upgrade` handler's return value becomes `ws.data` — fully typed via generics:

```typescript
app.ws<{ userId: string; role: string }>('/api/ws', {
  upgrade(req) {
    const token = req.headers.authorization;
    const user = validateToken(token);
    if (!user) return false; // 403 rejection
    return { userId: user.id, role: user.role };
  },
  message(ws) {
    console.log(ws.data.userId); // ✅ typed as string
    console.log(ws.data.role);   // ✅ typed as string
  },
});
```

## 🔔 Pub/Sub

### Channel Subscriptions

```typescript
ws.subscribe('channel-name');    // Join a channel; true, or false if the connection is closing or closed
ws.unsubscribe('channel-name');  // Leave a channel
ws.isSubscribed('channel-name'); // Check membership
```

Channels are left automatically when the connection closes. A `subscribe` on a connection that is closing or already closed does nothing and returns `false`, so an `open` handler that subscribes after waiting on something can't keep a client that left in the meantime in the channel:

```typescript
app.ws<{ room: string }>('/ws/rooms/:room', {
  upgrade: (req) => ({ room: req.params.room ?? 'lobby' }),
  open(ws) {
    // The client may disconnect while the room loads
    rooms
      .load(ws.data.room)
      .then((room) => {
        if (!ws.subscribe(`room:${room.id}`)) return; // it did; nothing to set up
        ws.send(JSON.stringify({ joined: room.id }));
      })
      .catch(() => ws.close(1011, 'Room failed to load'));
  },
});
```

<span style="color: #f39c12">**⚠️ Behavior change in 0.11.0:**</span> before 0.11.0 `subscribe` returned nothing and added the connection whatever its state, so a subscribe after the client left kept it in the channel (and in `app.subscriberCount()`) for the life of the process.

### Broadcasting

```typescript
// From inside a WS handler — excludes the sender
ws.publish('quotes', JSON.stringify({ symbol: 'AAPL', price: 178.50 }));

// From outside WS context (HTTP routes, timers, background jobs)
app.publish('quotes', JSON.stringify({ symbol: 'AAPL', price: 178.50 }));

// Check subscriber count
const count = app.subscriberCount('quotes');
```

<span style="color: #3498db">**💡 Tip:**</span> `ws.publish()` excludes the sender automatically. `app.publish()` sends to all subscribers (no sender context).

Both return how many subscribers took the frame, sent or buffered. A subscriber whose backpressure dropped it (the `'drop'` strategy, or a `'buffer'` overflow that closes it) isn't counted, so the number is the delivery count, not the subscriber count; use `app.subscriberCount()` for that. Before 0.10.0 every subscriber was counted.

### Encode-Once Broadcast

When publishing to a channel, the WebSocket frame is encoded **once** into raw bytes, then the same `Buffer` is written to every subscriber. This is O(messageSize + N×write) instead of O(N×messageSize) — critical for high-throughput scenarios like trading quote distribution.

## 🪝 Hooks

### Global HTTP Hooks on Upgrade

<span style="color: #f39c12">**⚠️ Behavior change in 0.10.0:**</span> upgrade requests now run the app's global HTTP hooks. Before 0.10.0 they skipped every one of them, so a `beforeAll` auth hook protected the REST routes while a WebSocket route without its own `upgrade` check accepted anyone. Apps whose global hooks assumed they only ever see HTTP requests should check those hooks against upgrades.

An upgrade request runs these steps, in this order, before the connection opens:

1. Handshake validation and path canonicalization (400 on a malformed handshake or path)
2. Global `beforeRouting` hooks (CORS runs here when enabled)
3. WebSocket route matching: `ctx.request.params` is filled from the `app.ws()` pattern
4. The built-in global rate limiter (429 when exceeded), so upgrade floods are throttled like any other request
5. Global `beforeAll` hooks
6. The not-found handler, then `afterAll` hooks on its response, when no WebSocket route matched
7. Origin check (`allowedOrigins`, 403)
8. The route's `upgrade(req)` handler
9. The per-IP connection cap (`maxConnectionsPerIp`, 429), checked after every `await` so concurrent upgrades can't overshoot it (an IP already at its cap is also refused before step 2, so a flood from a full IP never reaches hooks or `upgrade(req)`), then `101 Switching Protocols` and `open(ws)`. A client that disconnected while a hook or `upgrade(req)` was still running is dropped here and never takes a connection slot.

<span style="color: #f39c12">**⚠️ Behavior change in 0.10.0:**</span> the origin check and the per-IP connection cap now run after the global hooks (and the cap after `upgrade(req)`), so hooks see, and the rate limiter counts, upgrades that are then refused for their origin or for a cap that filled while they waited. An IP that is already at its cap is still refused before any hook runs. Before 0.10.0 both ran before anything else.

Steps 2 to 6 are the same stages, in the same order and through the same code, that an HTTP request to the same path runs, and `routesToInclude` / `routesToExclude` match against the same canonical path. Hooks receive an ordinary `ctx`, so `ctx.request.headers`, `ctx.request.ipAddress`, `ctx.request.cookies` (with the cookie parser) and `ctx.state` work unchanged. Route hooks don't run, since a WebSocket route has none, and `afterAll` hooks run only on the 404 of step 6: an accepted upgrade has no HTTP response for them to change.

Every refusal is an ordinary HTTP response with the default security headers, written to the access log. The refusals YinzerFlow makes after the hook stages (origin 403, `upgrade()` returning `false` or `rejectUpgrade(...)`, the per-IP cap's 429) also run `afterAll` hooks, like any response that isn't a hook short-circuit. A malformed handshake, request line or path gets its 400 before any hook runs, and so does an upgrade carrying more than one `Host` or more than one `Origin` header (since 0.11.0), since the origin check must not read a different value than a proxy in front did.

<span style="color: #f39c12">**⚠️ Behavior change in 0.10.0:**</span> a hook that answers an upgrade with a 2xx status (for example by returning `null`, `false` or `0` without setting a status) refuses it with **403**, since a refused upgrade can't succeed. Set the status you want (401, 429, and so on) before returning.

A hook refuses the upgrade the way it answers an HTTP request early: by returning a value. On an upgrade, setting a status other than 200 without returning anything refuses it too, because there is no route handler left to carry that status. Either way the client gets a real HTTP response with that status and body, and the socket is closed.

```typescript
// One auth hook protects REST and WebSocket routes alike
app.beforeAll([
  async (ctx) => {
    const user = await validateToken(ctx.request.headers.authorization);
    if (!user) {
      ctx.response.setStatusCode(401);
      return { error: 'Unauthorized' }; // REST gets a 401; so does an upgrade, before any 101
    }
    ctx.state.user = user;
  },
], { routesToExclude: ['/health', '/ws/public/*'] });

app.ws('/ws/feed', { message(ws, data) { ws.send(data); } }); // protected by the hook above
app.ws('/ws/public/ticker', { open(ws) { ws.subscribe('ticker'); } }); // excluded
```

The route's `upgrade(req)` handler receives that same `ctx.state` object as `req.state`, so a value an auth hook stored (a user id, a tenant) doesn't have to be worked out twice. State lives for the upgrade request only; return what the connection needs from `upgrade()` to keep it on `ws.data`:

```typescript
app.beforeAll([
  async (ctx) => {
    const user = await validateToken(ctx.request.headers.authorization);
    if (!user) {
      ctx.response.setStatusCode(401);
      return { error: 'Unauthorized' };
    }
    ctx.state.userId = user.id;
  },
]);

app.ws<{ userId: string }>('/ws/feed', {
  upgrade(req) {
    return { userId: String(req.state.userId) }; // carried from the hook into ws.data
  },
  message(ws) {
    ws.send(`hello ${ws.data.userId}`);
  },
});
```

### WS Message Hooks

Global hooks that run before/after every WebSocket message handler:

```typescript
app.wsBeforeMessage([
  async (ws, data, isBinary) => {
    console.log(`[WS] ${ws.remoteAddress}: ${String(data)}`);
  },
]);

app.wsAfterMessage([
  async (ws, data, isBinary) => {
    // Metrics, logging, etc.
  },
]);
```

### Dropping a Message

<span style="color: #f39c12">**⚠️ Ordering:**</span> messages reach the hooks in the order they arrive, but a hook (or a `message` handler) that returns a promise doesn't hold back the next message. With an `async` `wsBeforeMessage` hook, message 2 can reach the handler before message 1 if message 1's hook takes longer, for example on a database lookup. If order matters, keep the hooks synchronous, or queue the work per connection yourself. This was true before 0.10.0 too.

A `wsBeforeMessage` hook drops a message by returning `false`, the same way an HTTP hook short-circuits by returning a value. Later before hooks, the route's `message` handler and the `wsAfterMessage` hooks don't run, and nothing is logged. To end the connection as well, call `ws.close(code, reason)` and then return `false`. A hook that throws is still treated as an error and goes to the route's `error` handler.

```typescript
import { wsCloseCode } from 'yinzerflow';

app.wsBeforeMessage([
  (ws, data) => {
    if (String(data).length > 4096) {
      ws.close(wsCloseCode.policyViolation, 'Message too long');
      return false;
    }
    if (String(data) === 'ping') return false; // app-level keepalive, nothing to handle
  },
]);
```

## 📡 The `ws` Object

Available in all handlers:

| Property/Method | Type | Description |
|----------------|------|-------------|
| `ws.send(data)` | `(string \| Buffer) => 'sent' \| 'buffered' \| 'dropped'` | Send a message; returns what happened to it |
| `ws.close(code?, reason?)` | `(number?, string?) => void` | Close connection |
| `ws.ping(data?)` | `(Buffer?) => void` | Send ping |
| `ws.subscribe(channel)` | `(string) => void` | Join channel |
| `ws.unsubscribe(channel)` | `(string) => void` | Leave channel |
| `ws.publish(channel, data)` | `(string, string \| Buffer) => number` | Broadcast (excludes self); returns subscribers that took the frame |
| `ws.isSubscribed(channel)` | `(string) => boolean` | Check membership |
| `ws.data` | `T` (readonly) | Per-socket data from upgrade |
| `ws.readyState` | `number` (readonly) | Connection state |
| `ws.remoteAddress` | `string` (readonly) | Client IP |
| `ws.bufferedAmount` | `number` (readonly) | Queued bytes |

### Send Results

`ws.send()` returns a `WebSocketSendStatus`, so a sender can react to a slow client instead of guessing:

<aside>

Returns: `'sent' | 'buffered' | 'dropped'` (also exported as the `wsSendStatus` constant)

- `'sent'`: the socket took the frame without queuing. It was handed to the operating system, which is not proof the client has read it.
- `'buffered'`: the socket's write buffer is full, so the frame is queued and goes out as it drains (`'buffer'` strategy). `ws.bufferedAmount` says how much is waiting; the `drain` handler fires when it empties.
- `'dropped'`: the frame was discarded: the connection isn't open, the `'drop'` strategy skipped it, or it would overflow `backpressure.limit` (which also closes the connection).
</aside>

```typescript
import { wsSendStatus } from 'yinzerflow';

app.ws('/quotes', {
  message(ws, data) {
    if (ws.send(quoteFor(String(data))) === wsSendStatus.dropped) metrics.increment('quotes.dropped');
  },
});
```

<span style="color: #3498db">**💡 Tip:**</span> YinzerFlow speaks WebSocket over its own TCP sockets, not Bun's `ServerWebSocket`, so the result is a named status rather than Bun's byte count (`-1` / `0` / bytes).

# ✨ Best Practices

- **Authenticate before the handshake** — a global `beforeAll` auth hook now covers upgrades too; use the route's `upgrade` handler for per-route checks and per-socket data
- **Use channels for grouping** — `ws.subscribe('user:123')` rather than manual connection tracking
- **Set `strategy: 'drop'` for real-time data** — stale trading quotes are worse than gaps
- **Keep message handlers fast** — expensive work should be dispatched to background jobs
- **Clean up in `close`** — though channel unsubscription is automatic

# 💻 Examples

### Production API — Real-Time Trading Data

**Use Case:** Push market quotes to subscribed clients with minimal latency

**Description:** HTTP endpoints ingest quote data and publish to WebSocket subscribers. Backpressure uses `'drop'` strategy — stale quotes are discarded if a client can't keep up.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  websocket: {
    maxPayloadLength: 65_536,
    idleTimeout: 300,
    allowedOrigins: ['https://trading.example.com'],
    backpressure: { strategy: 'drop' },
  },
});

// WebSocket: clients subscribe to symbol channels
app.ws<{ symbols: Array<string> }>('/quotes', {
  upgrade(req) {
    const token = req.headers.authorization;
    const user = validateToken(token);
    if (!user) return false;
    const symbols = req.query.symbols?.split(',') ?? [];
    return { symbols };
  },
  open(ws) {
    for (const symbol of ws.data.symbols) {
      ws.subscribe(`quote:${symbol}`);
    }
    ws.send(JSON.stringify({ type: 'subscribed', symbols: ws.data.symbols }));
  },
  message(ws, data) {
    const msg = JSON.parse(data as string);
    if (msg.type === 'subscribe') {
      ws.subscribe(`quote:${msg.symbol}`);
    }
  },
});

// HTTP: ingest quotes and broadcast to subscribers
app.post('/api/quotes', (ctx) => {
  const { symbol, price, volume } = ctx.request.body;
  const count = app.publish(
    `quote:${symbol}`,
    JSON.stringify({ type: 'quote', symbol, price, volume, ts: Date.now() }),
  );
  return { broadcast: count };
});

await app.listen();
```

### Dev API — Echo Server

**Use Case:** Development and testing

**Description:** Simple echo server with logging for debugging WebSocket connections.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  logging: { level: 'debug' },
});

app.ws('/echo', {
  open(ws) {
    ws.send('Connected to echo server');
  },
  message(ws, data, isBinary) {
    ws.send(data);
  },
  close(ws, code, reason) {
    console.log(`Disconnected: ${code} ${reason}`);
  },
});

await app.listen();
```

## 🚀 Performance Notes

- **Encode-once broadcast**: Publishing to N subscribers encodes the frame once. 1000 subscribers = 1 encode + 1000 writes, not 1000 encodes. When compression is enabled, at most 2 frames are encoded (one compressed, one uncompressed) for mixed subscriber sets.
- **In-place XOR unmasking**: Client frames are unmasked by mutating the buffer directly — zero allocation.
- **`Buffer.allocUnsafe`** for outgoing frames — skips zero-fill since the entire buffer is written before use.
- **Heartbeat sweep**: One `setInterval` for all connections. O(N) per tick to iterate, O(1) timers total regardless of connection count. Timer is `.unref()`'d so it won't prevent graceful shutdown.
- **Token bucket rate limiting**: O(1) per message — no arrays, no sliding windows. Zero overhead when disabled (no `Date.now()` calls).
- **Compression**: `deflateRawSync`/`inflateRawSync` with zlib-ng SIMD acceleration in Bun. No-context-takeover means no persistent zlib state per connection — stateless compress/decompress on each message.
- **Zero overhead** when no `app.ws()` routes: no upgrade detection, no Sets allocated, no security instances created.
- **Idle timeout** resets on every received frame — high-frequency data streams won't trigger timeout.

## 🔒 Security Notes

### 🛡️ Origin Validation
- **Problem**: Unauthorized origins connecting to WebSocket endpoints
- **YinzerFlow Solution**: upgrades are same-origin only by default: the `Origin` header must match the request's `Host` (since 0.11.0). `websocket.allowedOrigins` widens that to a list of origins (case-insensitive exact match) or to every origin with `['*']`, and `[]` refuses every browser origin. A missing `Origin` (a non-browser client) passes unless `allowMissingOrigin` is `false`.
- <span style="color: #e74c3c">**🚨 Cookie auth:**</span> an app that authenticates upgrades with cookies must not use `['*']`. WebSockets are not covered by CORS, and a browser sends cookies on a cross-site upgrade, so with `['*']` any website can open a socket logged in as your user. Behind a proxy that rewrites `Host`, list your public origin instead of relaxing the check.

### 🛡️ Global Hooks and Rate Limiting on Upgrade
- **Problem**: Upgrades that bypass the app's auth hooks or rate limiter open a second, unguarded door into the app
- **YinzerFlow Solution**: Every upgrade runs the global `beforeRouting` hooks, the global rate limiter and the global `beforeAll` hooks before the route's `upgrade` handler, matched on the same canonical path as HTTP (since 0.10.0)

### 🛡️ Connection Limits
- **Problem**: Connection exhaustion from a single IP
- **YinzerFlow Solution**: `websocket.maxConnectionsPerIp` limits concurrent connections. Returns 429 when exceeded. Counter automatically decrements on disconnect.

### 🛡️ Payload Size Limits
- **Problem**: Memory exhaustion from oversized messages
- **YinzerFlow Solution**: `websocket.maxPayloadLength` is checked on each frame header before buffering, on the running total of a fragmented message, and as the cap on decompression, so neither fragmentation nor a decompression bomb gets a message past it. Exceeding triggers close with code 1009 (Too Large).

## 🔧 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 401 (or another status) on upgrade | A global `beforeRouting` / `beforeAll` hook refused it | Send the credentials the hook expects, or exclude the path with `routesToExclude` |
| 500 on upgrade | A global hook or the `upgrade` handler threw | Check the error your `onError` handler (or the default error log) received |
| 400 on upgrade with "Malformed request headers" | A header name or value the HTTP parser rejects | Fix the client's headers; the reason is logged at debug level |
| 403 on upgrade | Origin not allowed: cross-origin under the same-origin default, not in the `allowedOrigins` list, `allowedOrigins: []`, or no Origin with `allowMissingOrigin: false`; or `upgrade` returned `false` | List the page's origin in `allowedOrigins` (also needed behind a proxy that rewrites `Host`); return `rejectUpgrade(status)` for a different status |
| Startup error naming `websocket.allowedOrigins` | An entry isn't an origin (path, trailing slash, wildcard, bare host, default port) or `'*'` is mixed with other entries | Write each entry as `scheme://host[:port]`, or use `['*']` alone |
| 429 on upgrade | Too many connections from IP, or the global rate limiter | Increase `maxConnectionsPerIp`, or `rateLimit.max` |
| Connection drops silently | Idle timeout with no traffic: heartbeat disabled, or `idleTimeout` at or below `heartbeat.interval` | Keep the heartbeat on with `heartbeat.interval` below `idleTimeout`, or raise `idleTimeout` |
| Connection closed with "Heartbeat timeout" | Client didn't respond to ping | Check client network; increase `heartbeat.interval` |
| Connection closed with 1008 | Message rate limit exceeded | Increase `maxMessages`/`window` or throttle client |
| Messages not received | Client backpressured with `'drop'` | Switch to `'buffer'` or increase client throughput |
| Upgrade answered 200 with HTML | An SPA-fallback `onNotFound` answers unmatched upgrades | Return 404 from `onNotFound` when `ctx.request.headers.upgrade` is `websocket` |
| 400 on upgrade or request, "request line must be..." | Tabs, repeated spaces or a version other than HTTP/1.0 or 1.1 in the request line | Send `METHOD /path HTTP/1.1` with single spaces |
| `ws.data` is `undefined` | No `upgrade` handler | Add `upgrade(req) { return { ... } }` |
| Compression not activating | Client didn't offer permessage-deflate | Check client supports it; verify `compression.enabled: true` |
| Small messages getting larger | Compression overhead on tiny payloads | Increase `compression.threshold` (default 128 bytes) |
