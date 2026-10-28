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

Maximum incoming message payload in bytes. Frames exceeding this limit trigger a close with code 1009.

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

<span style="color: #e74c3c">**⚠️ Warning:**</span> keep `idleTimeout` above `heartbeat.interval`. With the timeout at or below the interval, a listen-only client is closed for idleness before the next ping can keep it alive. Disabling the heartbeat has the same effect for clients that never send.

<span style="color: #f39c12">**⚡ Performance:**</span> For high-frequency data streams (trading quotes), the idle timeout resets on every received frame — frequent data prevents timeout.

### websocket.maxConnectionsPerIp — @default <span style="color: #2ecc71">`50`</span>

Maximum concurrent WebSocket connections from a single IP address.

### websocket.allowedOrigins — @default <span style="color: #2ecc71">`[]`</span> (allow all)

List of allowed origins for upgrade requests, matched case-insensitively and exactly. An empty array allows every origin. With a list set, an upgrade whose `Origin` isn't on it gets 403; one with no `Origin` header at all is governed by `allowMissingOrigin` below.

<span style="color: #e74c3c">**🚨 Required for cookie-authenticated WebSockets:**</span> if your upgrade is authenticated by a cookie (a session cookie read in a `beforeAll` hook or in `upgrade`), you must set `allowedOrigins`. Browsers send the user's cookies on a cross-site WebSocket upgrade and, unlike `fetch`, WebSockets are not covered by CORS, so with the default empty list any page the user visits can open a socket that is logged in as them (cross-site WebSocket hijacking). Token auth sent in a header or the first message isn't exposed this way, because another site can't read or attach the token.

```typescript
const app = new YinzerFlow({
  websocket: {
    allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
  },
});
```

### websocket.allowMissingOrigin — @default <span style="color: #2ecc71">`true`</span>

With an `allowedOrigins` list set, whether an upgrade that carries no `Origin` header is allowed. Browsers always send `Origin` on a WebSocket upgrade, so a missing one means a non-browser client (another server, a CLI, a native mobile app), and cross-site hijacking needs a browser. Set `false` to require an allowed `Origin` from every client. No effect while `allowedOrigins` is empty.

<span style="color: #f39c12">**⚠️ Behavior change in 0.10.0:**</span> before 0.10.0 a list rejected every upgrade without an `Origin` header with 403, which locked non-browser clients out. Set `allowMissingOrigin: false` to keep that behavior.

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

Server LZ77 window size (2^bits bytes). Range: 9-15.

| Window Bits | Window Size | Memory | Compression |
|:-----------:|:-----------:|:------:|:-----------:|
| 9 | 512 bytes | ~12 KB | ~50% |
| 11 | 2 KB | ~15 KB | ~70% |
| 13 | 8 KB | ~20 KB | ~74% |
| 15 | 32 KB | ~44 KB | ~77% |

<span style="color: #3498db">**💡 Tip:**</span> Window bits 11 (2KB) is the sweet spot — 70% compression at ~15KB memory. The jump from 11 to 15 is marginal (+7%) but costs 3× the memory.

### websocket.compression.clientMaxWindowBits — @default <span style="color: #2ecc71">`15`</span>

Client LZ77 window size. Only included in the negotiation response if the client offered the parameter.

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
ws.subscribe('channel-name');    // Join a channel
ws.unsubscribe('channel-name');  // Leave a channel
ws.isSubscribed('channel-name'); // Check membership
```

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
9. The per-IP connection cap (`maxConnectionsPerIp`, 429), checked after every `await` so concurrent upgrades can't overshoot it, then `101 Switching Protocols` and `open(ws)`. A client that disconnected while a hook or `upgrade(req)` was still running is dropped here and never takes a connection slot.

Steps 2 to 6 are the same stages, in the same order and through the same code, that an HTTP request to the same path runs, and `routesToInclude` / `routesToExclude` match against the same canonical path. Hooks receive an ordinary `ctx`, so `ctx.request.headers`, `ctx.request.ipAddress`, `ctx.request.cookies` (with the cookie parser) and `ctx.state` work unchanged. Route hooks don't run, since a WebSocket route has none, and `afterAll` hooks run only on the 404 of step 6: an accepted upgrade has no HTTP response for them to change.

Every refusal is an ordinary HTTP response with the default security headers, written to the access log. The refusals YinzerFlow makes after the hook stages (origin 403, `upgrade()` returning `false` or `rejectUpgrade(...)`, the per-IP cap's 429) also run `afterAll` hooks, like any response that isn't a hook short-circuit. A malformed handshake, request line or path gets its 400 before any hook runs.

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
- **YinzerFlow Solution**: `websocket.allowedOrigins` validates the Origin header during upgrade. Case-insensitive matching. Empty list = allow all (for server-to-server or development). A missing `Origin` (a non-browser client) passes unless `allowMissingOrigin` is `false`.
- <span style="color: #e74c3c">**🚨 Cookie auth:**</span> an app that authenticates upgrades with cookies must set `allowedOrigins`. WebSockets are not covered by CORS, and a browser sends cookies on a cross-site upgrade, so without a list any website can open a socket logged in as your user.

### 🛡️ Global Hooks and Rate Limiting on Upgrade
- **Problem**: Upgrades that bypass the app's auth hooks or rate limiter open a second, unguarded door into the app
- **YinzerFlow Solution**: Every upgrade runs the global `beforeRouting` hooks, the global rate limiter and the global `beforeAll` hooks before the route's `upgrade` handler, matched on the same canonical path as HTTP (since 0.10.0)

### 🛡️ Connection Limits
- **Problem**: Connection exhaustion from a single IP
- **YinzerFlow Solution**: `websocket.maxConnectionsPerIp` limits concurrent connections. Returns 429 when exceeded. Counter automatically decrements on disconnect.

### 🛡️ Payload Size Limits
- **Problem**: Memory exhaustion from oversized messages
- **YinzerFlow Solution**: `websocket.maxPayloadLength` checked on frame header before buffering. Exceeding triggers close with code 1009 (Too Large).

## 🔧 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 401 (or another status) on upgrade | A global `beforeRouting` / `beforeAll` hook refused it | Send the credentials the hook expects, or exclude the path with `routesToExclude` |
| 500 on upgrade | A global hook or the `upgrade` handler threw | Check the error your `onError` handler (or the default error log) received |
| 400 on upgrade with "Malformed request headers" | A header name or value the HTTP parser rejects | Fix the client's headers; the reason is logged at debug level |
| 403 on upgrade | Origin not in `allowedOrigins` (or no Origin with `allowMissingOrigin: false`), or `upgrade` returned `false` | Add origin or set `allowedOrigins: []`; return `rejectUpgrade(status)` for a different status |
| 429 on upgrade | Too many connections from IP, or the global rate limiter | Increase `maxConnectionsPerIp`, or `rateLimit.max` |
| Connection drops silently | Idle timeout with no traffic: heartbeat disabled, or `idleTimeout` at or below `heartbeat.interval` | Keep the heartbeat on with `heartbeat.interval` below `idleTimeout`, or raise `idleTimeout` |
| Connection closed with "Heartbeat timeout" | Client didn't respond to ping | Check client network; increase `heartbeat.interval` |
| Connection closed with 1008 | Message rate limit exceeded | Increase `maxMessages`/`window` or throttle client |
| Messages not received | Client backpressured with `'drop'` | Switch to `'buffer'` or increase client throughput |
| `ws.data` is `undefined` | No `upgrade` handler | Add `upgrade(req) { return { ... } }` |
| Compression not activating | Client didn't offer permessage-deflate | Check client supports it; verify `compression.enabled: true` |
| Small messages getting larger | Compression overhead on tiny payloads | Increase `compression.threshold` (default 128 bytes) |
