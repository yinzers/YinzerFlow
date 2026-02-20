# 📖 Logging

YinzerFlow's logging system has three independent channels:

- **App logger** — Framework startup, shutdown, errors, warnings, and your `app.log` calls. Gated by `logging.level`.
- **Access log** — One nginx-style line per request/response. Gated by `logging.requests` (on/off).
- **Diagnostics** — Framework health monitoring (slow requests, large payloads, memory, event loop, rate limits). Fires independently of `logging.level` — even with `level: 'off'`, diagnostics still fire when thresholds are exceeded.

All three channels are configured under the `logging` key:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  logging: {
    level: 'info',
    prefix: 'MY-APP',
    personality: true,
    requests: true,
    diagnostics: {
      slowRequests: '500ms',
      largeResponses: '1mb',
    },
  },
});
```

<span style="color: #3498db">🔗 For the brief configuration overview, see [Configuration Guide](../configuration/configuration.md)</span>

# ⚙️ Usage

## 🎛️ App Logger Settings

### level — @default <span style="color: #2ecc71">`'warn'`</span>

Minimum log level for the app logger. Controls which messages are output.

```typescript
const app = new YinzerFlow({
  logging: {
    level: 'info', // 'off' | 'error' | 'warn' | 'info' | 'debug'
  },
});
```

<aside>

Options: `'off' | 'error' | 'warn' | 'info' | 'debug'`

- `'off'`: No app logging at all (diagnostics still fire independently)
- `'error'`: Only errors
- `'warn'`: Warnings and errors (default — shows security warnings and config issues)
- `'info'`: Informational messages, warnings, and errors
- `'debug'`: Everything including verbose connection details

</aside>

### prefix — @default <span style="color: #2ecc71">`'YINZER'`</span>

Log line prefix shown in brackets. Useful for identifying different server instances.

```typescript
const app = new YinzerFlow({
  logging: {
    prefix: 'API-V2',
  },
});

// Output: [API-V2] ✅ [2026-02-20 14:30:00.123] [INFO] Server started...
```

<aside>

Options: `string`

- Default: `'YINZER'`
- Appears as `[PREFIX]` at the start of every log line
- Tip: Use different prefixes when running multiple YinzerFlow instances

</aside>

### personality — @default <span style="color: #2ecc71">`true`</span>

Enable Pittsburgh personality phrases in log output. Adds a random Yinzer phrase to the end of log lines.

```typescript
// With personality: true (default)
// [YINZER] ✅ [2026-02-20 14:30:00.123] [INFO] Server started - n'at!

// With personality: false
// [YINZER] ✅ [2026-02-20 14:30:00.123] [INFO] Server started

const app = new YinzerFlow({
  logging: {
    personality: false, // Clean output, no Yinzer flair
  },
});
```

<aside>

Options: `boolean`

- 🟢 `true`: Pittsburgh personality phrases appended to log lines (default)
- 🔴 `false`: Clean, professional log output

</aside>

### logger — @default <span style="color: #2ecc71">`undefined`</span>

Custom logger for application logs. When provided, framework-internal logs (startup, shutdown, errors, warnings) route to this logger instead of the built-in formatter.

Your logger receives **raw args** — no ANSI formatting, no timestamps. Your logger handles its own formatting.

```typescript
import { YinzerFlow } from 'yinzerflow';
import winston from 'winston';

const winstonLogger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
});

const app = new YinzerFlow({
  logging: {
    logger: winstonLogger, // Framework logs → Winston
  },
});
```

<aside>

Options: `Logger | undefined`

- ✅ `undefined`: Uses built-in formatter with ANSI colors and timestamps (default)
- 🎨 `Logger`: Any object with `info`, `warn`, `error` methods. `debug` is optional.

<span style="color: #3498db">**💡 Tip:**</span> In your own route handlers, import your logger directly (e.g., `import logger from './my-logger'`) rather than using the framework's `log`. This gives you your logger's full API (child loggers, serializers, structured metadata) and avoids double log-level filtering.

</aside>

### accessLogger — @default <span style="color: #2ecc71">`undefined`</span>

Custom logger for access logs (the per-request nginx-style lines). Separate from `logger` so you can route access logs to a different destination.

```typescript
import { YinzerFlow } from 'yinzerflow';
import pino from 'pino';

const accessLog = pino({ name: 'access' });
const appLog = pino({ name: 'app' });

const app = new YinzerFlow({
  logging: {
    requests: true,
    logger: appLog,         // Framework errors/warnings → app log
    accessLogger: accessLog, // Per-request lines → access log
  },
});
```

<aside>

Options: `Logger | undefined`

- ✅ `undefined`: Access logs use built-in formatter (default)
- 🎨 `Logger`: Custom destination for access log lines

</aside>

## 🎛️ Access Log Settings

### requests — @default <span style="color: #e74c3c">`false`</span>

Enable nginx-style access logs — one line per request/response with status, method, path, bytes, and timing.

```typescript
const app = new YinzerFlow({
  logging: {
    requests: true,
  },
});

// Output:
// [ACCESS] ✅ ... ✅ 127.0.0.1 "GET /api/users HTTP/1.1" 200 1234bytes "-" "curl/8.0" 12ms
```

<aside>

Options: `boolean`

- 🔴 `false`: No access logging (default)
- 🟢 `true`: One line per request/response

<span style="color: #f39c12">**⚡ Performance:**</span> Access logs add minimal overhead per request (sanitization + string formatting). In high-traffic production, consider routing to a separate file or log aggregator via `accessLogger`.

</aside>

## 🎛️ Diagnostics Settings

Diagnostics monitor framework health **independently of the app log level**. Even with `level: 'off'`, diagnostics fire when thresholds are exceeded. All thresholds default to `false` (disabled) — set a value to enable.

Diagnostics are organized into three categories:

- **Per-request**: `slowRequests`, `largeResponses`, `largeRequests` — checked after each response
- **Interval**: `memory`, `eventLoop` — run on timers in the background
- **Event**: `rateLimits` — fires when the rate limiter blocks a request

### slowRequests — @default <span style="color: #e74c3c">`false`</span>

Log a warning when a request takes longer than this threshold.

```typescript
const app = new YinzerFlow({
  logging: {
    diagnostics: {
      slowRequests: '500ms', // or 500 (milliseconds)
    },
  },
});

// Output: 🐌 Slow request: GET /api/heavy-query took 1234ms (threshold: 500ms)
```

<aside>

Options: `TimeString | number | false`

- `false`: Disabled (default)
- `TimeString`: e.g. `'100ms'`, `'1s'`, `'30s'`
- `number`: Milliseconds

</aside>

### largeResponses — @default <span style="color: #e74c3c">`false`</span>

Log a warning when a response body exceeds this size.

```typescript
const app = new YinzerFlow({
  logging: {
    diagnostics: {
      largeResponses: '1mb', // or 1048576 (bytes)
    },
  },
});

// Output: 📦 Large response: GET /api/export 2097152 bytes (threshold: 1048576 bytes)
```

<aside>

Options: `ByteString | number | false`

- `false`: Disabled (default)
- `ByteString`: e.g. `'256kb'`, `'1mb'`, `'10mb'`
- `number`: Bytes

</aside>

### largeRequests — @default <span style="color: #e74c3c">`false`</span>

Log a warning when a request body exceeds this size.

```typescript
const app = new YinzerFlow({
  logging: {
    diagnostics: {
      largeRequests: '256kb',
    },
  },
});

// Output: 📦 Large request: POST /api/upload 524288 bytes (threshold: 262144 bytes)
```

<aside>

Options: `ByteString | number | false`

- `false`: Disabled (default)
- `ByteString`: e.g. `'256kb'`, `'1mb'`, `'10mb'`
- `number`: Bytes

</aside>

### memory — @default <span style="color: #e74c3c">`false`</span>

Log periodic memory/heap usage at this interval. Useful for tracking memory leaks or high memory usage over time.

```typescript
const app = new YinzerFlow({
  logging: {
    diagnostics: {
      memory: '30s', // Log memory every 30 seconds
    },
  },
});

// Output: 💾 Heap: 45.2MB / 67.8MB | RSS: 89.1MB | External: 1.2MB
```

<aside>

Options: `TimeString | number | false`

- `false`: Disabled (default)
- `TimeString`: e.g. `'10s'`, `'30s'`, `'1m'`, `'5m'`
- `number`: Milliseconds

<span style="color: #3498db">**💡 Tip:**</span> The timer is `unref()`'d — it won't prevent the process from exiting.

</aside>

### eventLoop — @default <span style="color: #e74c3c">`false`</span>

Log a warning when event loop lag exceeds this threshold. Detects blocking operations by measuring `setTimeout` drift — if the callback fires significantly later than scheduled, something is blocking.

```typescript
const app = new YinzerFlow({
  logging: {
    diagnostics: {
      eventLoop: '100ms',
    },
  },
});

// Output: ⏱️ Event loop lag: 250ms (threshold: 100ms)
```

<aside>

Options: `TimeString | number | false`

- `false`: Disabled (default)
- `TimeString`: e.g. `'50ms'`, `'100ms'`, `'500ms'`
- `number`: Milliseconds

</aside>

### rateLimits — @default <span style="color: #e74c3c">`false`</span>

Log a warning when the rate limiter blocks a request. Useful for detecting abuse patterns.

```typescript
const app = new YinzerFlow({
  logging: {
    diagnostics: {
      rateLimits: true,
    },
  },
});

// Output: 🚫 Rate limit hit: 192.168.1.50 on /api/login
```

<aside>

Options: `boolean`

- `false`: Disabled (default)
- `true`: Log every rate limit hit

</aside>

## 🎯 Diagnostic Presets

Suggested diagnostic configurations for common server types. Copy the one that fits your use case and adjust thresholds as needed.

### Production REST API

Tight thresholds for a typical JSON API. Catches slow queries, oversized payloads, and abuse early.

```typescript
const app = new YinzerFlow({
  logging: {
    level: 'warn',
    requests: true,
    diagnostics: {
      slowRequests: '500ms',
      largeResponses: '1mb',
      largeRequests: '256kb',
      memory: '30s',
      eventLoop: '100ms',
      rateLimits: true,
    },
  },
});
```

### File Server / Media API

Relaxed response sizes (large files are expected), but still monitors request timing and memory. Event loop threshold is higher because file I/O can cause brief delays.

```typescript
const app = new YinzerFlow({
  logging: {
    level: 'warn',
    requests: true,
    diagnostics: {
      slowRequests: '5s',
      largeResponses: '100mb',  // Large file downloads expected
      largeRequests: '50mb',    // Large file uploads expected
      memory: '15s',            // Monitor more frequently (file buffers use memory)
      eventLoop: '500ms',       // File I/O causes brief event loop delays
      rateLimits: true,
    },
  },
});
```

### Data Query / Analytics Server

Relaxed timing thresholds (complex queries take time), but monitors memory closely since large result sets can spike heap usage.

```typescript
const app = new YinzerFlow({
  logging: {
    level: 'warn',
    requests: true,
    diagnostics: {
      slowRequests: '10s',       // Complex queries are expected to be slow
      largeResponses: '10mb',    // Large result sets expected
      largeRequests: '1mb',
      memory: '10s',             // Watch memory closely — large result sets spike heap
      eventLoop: '1s',           // Query processing blocks the loop briefly
      rateLimits: true,
    },
  },
});
```

### Development / Debugging

Aggressive thresholds to catch everything during development.

```typescript
const app = new YinzerFlow({
  logging: {
    level: 'debug',
    requests: true,
    diagnostics: {
      slowRequests: '100ms',     // Catch anything slow
      largeResponses: '100kb',   // Catch oversized responses early
      largeRequests: '50kb',
      memory: '5s',              // Frequent memory snapshots
      eventLoop: '50ms',         // Catch any blocking
      rateLimits: true,
    },
  },
});
```

## 🔧 `createLogger()` — Standalone Loggers

`createLogger()` creates independent logger instances for use in your own code. These are separate from the framework's internal logger.

```typescript
import { createLogger } from 'yinzerflow';

const dbLogger = createLogger({
  level: 'error',
  prefix: 'DATABASE',
  personality: false,
});

const authLogger = createLogger({
  level: 'warn',
  prefix: 'AUTH',
});

dbLogger.error('Connection failed');
// Output: [DATABASE] ❌ [2026-02-20 14:30:00.123] [ERROR] Connection failed

authLogger.warn('Token expiring soon');
// Output: [AUTH] ⚠️ [2026-02-20 14:30:00.456] [WARN] Token expiring soon - just sayin'
```

### Branded Logger Auto-Inheritance

When you pass a `createLogger()` instance as `logging.logger`, YinzerFlow auto-inherits its `level`, `prefix`, and `personality` settings. Explicit config overrides the inherited values.

```typescript
import { YinzerFlow, createLogger } from 'yinzerflow';

const myLogger = createLogger({
  level: 'debug',
  prefix: 'MY-APP',
  personality: false,
});

// YinzerFlow inherits debug level, MY-APP prefix, personality off
const app = new YinzerFlow({
  logging: {
    logger: myLogger,
  },
});

// Explicit config still wins — level is 'info' even though myLogger is 'debug'
const app2 = new YinzerFlow({
  logging: {
    logger: myLogger,
    level: 'info', // Overrides the inherited 'debug'
  },
});
```

### Custom Logger Output Sink

Route log output through an external logger (Winston, Pino, etc.). The external logger receives raw args — no ANSI formatting.

```typescript
import { createLogger } from 'yinzerflow';
import winston from 'winston';

const winstonInstance = winston.createLogger({
  transports: [new winston.transports.Console()],
});

const logger = createLogger({
  prefix: 'API',
  logger: winstonInstance, // Output routes through Winston
});

logger.info('Server ready'); // Winston receives: 'Server ready'
```

### Per-Instance Isolation

Each YinzerFlow instance has its own logger. Two instances with different configs don't interfere with each other.

```typescript
const api = new YinzerFlow({
  port: 3000,
  logging: { prefix: 'API', level: 'warn' },
});

const admin = new YinzerFlow({
  port: 3001,
  logging: { prefix: 'ADMIN', level: 'debug' },
});

// api logs: [API] ⚠️ ...
// admin logs: [ADMIN] 🔍 ...
// No cross-contamination
```

# ✨ Best Practices

- **Use `'warn'` in production** — The default. You see security warnings and errors without info noise.
- **Use `'info'` or `'debug'` during development** — See startup details, connection info, route registration.
- **Enable `requests` for observability** — Access logs are cheap and invaluable for debugging production issues.
- **Route access logs separately** — Use `accessLogger` to send request lines to a different file/service than app errors.
- **Start with diagnostic presets** — Copy a preset above, then tune thresholds based on real traffic data.
- **Don't log sensitive data** — Be careful with passwords, tokens, API keys in custom log calls.
- **Use component-specific loggers** — `createLogger({ prefix: 'DATABASE' })` makes log output filterable.
- **Disable personality in production** — Set `personality: false` for clean, parseable logs in log aggregators.

# 💻 Examples

### Production API

**Use Case:** Deployed API with structured logging, diagnostics, and external log aggregation

**Description:** Production-ready logging with Winston integration for app logs, separate access log file, and diagnostic monitoring for performance issues.

```typescript
import { YinzerFlow, createLogger } from 'yinzerflow';
import winston from 'winston';

// Production Winston setup
const winstonLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Separate transport for access logs
const accessTransport = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ message }) => message),
  ),
  transports: [
    new winston.transports.File({ filename: 'access.log' }),
  ],
});

const app = new YinzerFlow({
  port: 3000,
  logging: {
    level: 'warn',
    prefix: 'API',
    personality: false,          // Clean output for log aggregators
    requests: true,
    logger: winstonLogger,       // App logs → Winston
    accessLogger: accessTransport, // Access logs → separate file
    diagnostics: {
      slowRequests: '500ms',
      largeResponses: '1mb',
      largeRequests: '256kb',
      memory: '30s',
      eventLoop: '100ms',
      rateLimits: true,
    },
  },
});

// In route handlers, import YOUR logger directly:
app.get('/api/users', async ({ response }) => {
  winstonLogger.info('Fetching users', { service: 'user-api' });
  return response.success({ users: [] });
});

await app.listen();
```

### Dev API

**Use Case:** Local development with verbose logging and aggressive diagnostics

**Description:** Development configuration with all logging enabled, debug level, and tight diagnostic thresholds to catch issues early.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  logging: {
    level: 'debug',              // See everything
    prefix: 'DEV',
    personality: true,           // Keep the Yinzer flair
    requests: true,              // See every request/response
    diagnostics: {
      slowRequests: '100ms',     // Catch anything slow
      largeResponses: '100kb',
      largeRequests: '50kb',
      memory: '5s',
      eventLoop: '50ms',
      rateLimits: true,
    },
  },
});

app.get('/api/test', () => ({ message: 'Hello from dev' }));

await app.listen();
```

## 🚀 Performance Notes

- **Early returns**: Log level checks are numeric comparisons — near-zero cost when a level is disabled
- **Diagnostics are independent**: They use their own logger instance, so `level: 'off'` doesn't affect them
- **Access log overhead**: One string interpolation + sanitization per request. Minimal, but consider `accessLogger` for high-traffic routing to avoid console bottleneck
- **Memory/event loop timers**: Both use `unref()` — they won't prevent process exit
- **Per-instance isolation**: Each YinzerFlow instance has its own logger — no shared mutable state

## 🔒 Security Notes

### 🛡️ Log Field Sanitization
- **Problem**: Log injection attacks can forge log entries or inject control characters
- **YinzerFlow Solution**: All access log fields (method, path, headers) are sanitized — control characters, null bytes, and Unicode bidirectional overrides are stripped. Fields are truncated to 256 characters.

### 🛡️ Diagnostic Independence
- **Problem**: Turning off logging to reduce noise can hide performance and security issues
- **YinzerFlow Solution**: Diagnostics fire independently of `logging.level`. Even with `level: 'off'`, slow requests, large payloads, memory spikes, and rate limit hits are still reported.

### 🛡️ Rate Limit Diagnostics
- **Problem**: Rate limit hits can indicate brute-force attacks, but rate limiting alone doesn't alert you
- **YinzerFlow Solution**: Enable `diagnostics.rateLimits` to log every blocked request with IP and path — useful for detecting abuse patterns.

### 🛡️ Logger Isolation
- **Problem**: Shared mutable logger state can cause cross-instance contamination
- **YinzerFlow Solution**: Each YinzerFlow instance creates its own logger. No module-level singletons, no shared state — two instances with different configs never interfere.

## 🔧 Troubleshooting

### No logs appearing at all

**Symptom:** No output from YinzerFlow.

**Cause:** Default log level is `'warn'` — `info` and `debug` messages are suppressed.

<span style="color: #2ecc71">**✅ Fix:**</span> Set `level: 'info'` or `level: 'debug'` to see more output.

```typescript
const app = new YinzerFlow({
  logging: { level: 'info' },
});
```

### Access logs not appearing

**Symptom:** No per-request log lines.

**Cause:** `requests` defaults to `false`.

<span style="color: #2ecc71">**✅ Fix:**</span> Enable access logs.

```typescript
const app = new YinzerFlow({
  logging: { requests: true },
});
```

### Diagnostics not firing

**Symptom:** No diagnostic warnings even with slow requests.

**Cause:** All diagnostic thresholds default to `false` (disabled).

<span style="color: #2ecc71">**✅ Fix:**</span> Set thresholds for the diagnostics you want.

```typescript
const app = new YinzerFlow({
  logging: {
    diagnostics: {
      slowRequests: '500ms', // Now fires for requests > 500ms
    },
  },
});
```

### Custom logger not receiving logs

**Symptom:** Passed a logger to `logging.logger` but it gets no output.

**Cause:** Log level filtering happens before delegation. If the framework level is `'warn'`, `info` messages never reach your logger.

<span style="color: #2ecc71">**✅ Fix:**</span> Match the framework log level to what you want your logger to receive.

```typescript
const app = new YinzerFlow({
  logging: {
    level: 'info',          // Framework passes info+ to your logger
    logger: winstonLogger,  // Winston can then do its own filtering
  },
});
```

### ANSI codes in external logger output

**Symptom:** Log lines contain `\x1b[36m` or similar escape codes in your log aggregator.

**Cause:** This happens when the built-in formatter is active instead of your custom logger.

<span style="color: #2ecc71">**✅ Fix:**</span> Verify your logger is passed correctly. External loggers (Winston, Pino) receive raw args without ANSI formatting automatically.

```typescript
// ❌ Wrong — logger not under logging key
const app = new YinzerFlow({
  logger: winstonLogger, // This is NOT the right location
});

// ✅ Correct — logger under logging key
const app = new YinzerFlow({
  logging: {
    logger: winstonLogger,
  },
});
```

### Old config keys not working

**Symptom:** `networkLogs`, `networkLogger`, `logLevel`, or top-level `logger` don't do anything.

**Cause:** These were replaced in the logging revamp. All logging config is now under the `logging` key.

<span style="color: #2ecc71">**✅ Fix:**</span> Migrate to the new config shape:

```typescript
// ❌ Old (no longer works)
const app = new YinzerFlow({
  logLevel: 'info',
  logger: myLogger,
  networkLogs: true,
  networkLogger: myAccessLogger,
});

// ✅ New
const app = new YinzerFlow({
  logging: {
    level: 'info',
    logger: myLogger,
    requests: true,
    accessLogger: myAccessLogger,
  },
});
```
