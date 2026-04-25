# 📖 WebSockets

YinzerFlow includes production-level WebSocket support built on raw RFC 6455 — the same TCP-level approach as the HTTP server. No external dependencies.

- **Channel-based pub/sub** with encode-once broadcast (frame encoded once, raw bytes to all subscribers)
- **Per-socket typed data** — generics flow through all handlers
- **Backpressure handling** — `'buffer'` (safe default) or `'drop'` (for real-time data like trading quotes)
- **Heartbeat/keepalive** — server-initiated ping/pong detects dead connections automatically
- **Message rate limiting** — per-connection token bucket throttling
- **Compression** — permessage-deflate (RFC 7692) with broadcast-safe no-context-takeover
- **Hook integration** — `wsBeforeMessage` / `wsAfterMessage` for cross-cutting concerns
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

<span style="color: #f39c12">**⚡ Performance:**</span> For high-frequency data streams (trading quotes), the idle timeout resets on every received frame — frequent data prevents timeout.

### websocket.maxConnectionsPerIp — @default <span style="color: #2ecc71">`50`</span>

Maximum concurrent WebSocket connections from a single IP address.

### websocket.allowedOrigins — @default <span style="color: #2ecc71">`[]`</span> (allow all)

List of allowed origins for upgrade requests. Empty array allows all origins (including missing origin headers from non-browser clients).

```typescript
const app = new YinzerFlow({
  websocket: {
    allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
  },
});
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
| `upgrade(req)` | Before handshake | Auth, attach per-socket data, reject with `false` |
| `open(ws)` | After handshake | Subscribe to channels, send welcome message |
| `message(ws, data, isBinary)` | On each message | Business logic, pub/sub |
| `close(ws, code, reason)` | On disconnect | Cleanup (unsubscribe is automatic) |
| `error(ws, error)` | On socket error | Logging, alerting |
| `drain(ws)` | When backpressure clears | Resume sending |

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

### Encode-Once Broadcast

When publishing to a channel, the WebSocket frame is encoded **once** into raw bytes, then the same `Buffer` is written to every subscriber. This is O(messageSize + N×write) instead of O(N×messageSize) — critical for high-throughput scenarios like trading quote distribution.

## 🪝 Hooks

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

## 📡 The `ws` Object

Available in all handlers:

| Property/Method | Type | Description |
|----------------|------|-------------|
| `ws.send(data)` | `(string \| Buffer) => void` | Send a message |
| `ws.close(code?, reason?)` | `(number?, string?) => void` | Close connection |
| `ws.ping(data?)` | `(Buffer?) => void` | Send ping |
| `ws.subscribe(channel)` | `(string) => void` | Join channel |
| `ws.unsubscribe(channel)` | `(string) => void` | Leave channel |
| `ws.publish(channel, data)` | `(string, string \| Buffer) => number` | Broadcast (excludes self) |
| `ws.isSubscribed(channel)` | `(string) => boolean` | Check membership |
| `ws.data` | `T` (readonly) | Per-socket data from upgrade |
| `ws.readyState` | `number` (readonly) | Connection state |
| `ws.remoteAddress` | `string` (readonly) | Client IP |
| `ws.bufferedAmount` | `number` (readonly) | Queued bytes |

# ✨ Best Practices

- **Authenticate in `upgrade`** — reject unauthorized connections before the handshake completes, not after
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
- **YinzerFlow Solution**: `websocket.allowedOrigins` validates the Origin header during upgrade. Case-insensitive matching. Empty list = allow all (for server-to-server or development).

### 🛡️ Connection Limits
- **Problem**: Connection exhaustion from a single IP
- **YinzerFlow Solution**: `websocket.maxConnectionsPerIp` limits concurrent connections. Returns 429 when exceeded. Counter automatically decrements on disconnect.

### 🛡️ Payload Size Limits
- **Problem**: Memory exhaustion from oversized messages
- **YinzerFlow Solution**: `websocket.maxPayloadLength` checked on frame header before buffering. Exceeding triggers close with code 1009 (Too Large).

## 🔧 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 403 on upgrade | Origin not in `allowedOrigins` | Add origin or set `allowedOrigins: []` |
| 429 on upgrade | Too many connections from IP | Increase `maxConnectionsPerIp` |
| Connection drops silently | Idle timeout | Increase `idleTimeout` or send periodic pings |
| Connection closed with "Heartbeat timeout" | Client didn't respond to ping | Check client network; increase `heartbeat.interval` |
| Connection closed with 1008 | Message rate limit exceeded | Increase `maxMessages`/`window` or throttle client |
| Messages not received | Client backpressured with `'drop'` | Switch to `'buffer'` or increase client throughput |
| `ws.data` is `undefined` | No `upgrade` handler | Add `upgrade(req) { return { ... } }` |
| Compression not activating | Client didn't offer permessage-deflate | Check client supports it; verify `compression.enabled: true` |
| Small messages getting larger | Compression overhead on tiny payloads | Increase `compression.threshold` (default 128 bytes) |
