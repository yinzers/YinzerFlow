# Plan: Phase 3 — Logging Revamp

## Context

The current logging system has two channels (`log` app logger and `networkLog`) with no `debug` level, no personality toggle, binary on/off network logs, hardcoded performance thresholds that fire for every request, and no diagnostic monitoring (heap, slow requests, large responses). The config uses flat boolean fields (`networkLogs`, `logger`, `networkLogger`) that aren't intuitive.

The goal: restructure into three clean channels (app logger, access logs, diagnostics), add `debug` level, personality toggle, and framework diagnostics that are independent of the app log level. Developers can track slow requests, memory issues, large responses, and rate limit abuse without drowning in noise.

---

## Architecture: Three Channels

| Channel | Purpose | Gated by | Output |
|---------|---------|----------|--------|
| **App logger** | Developer's own logs + framework errors/warnings | `logging.level` | error/warn/info/debug |
| **Access log** | nginx-style request/response lines | `logging.requests` on/off | Per-request line |
| **Diagnostics** | Framework health monitoring | Individual thresholds | Fires only when thresholds exceeded |

Diagnostics are **independent of app log level** — even with `level: 'off'`, diagnostics still fire when thresholds are exceeded. They use their own `createLogger` instance with `logLevel: 'info'` always.

---

## New Config Shape

```typescript
// Old (flat, boolean soup)
{ networkLogs: true, logger: myLogger, networkLogger: myNetLogger }

// New (structured, intuitive)
{
  logging: {
    level: 'info',              // off | error | warn | info | debug
    personality: true,          // Pittsburgh phrases (default: true)
    requests: false,            // Access logs on/off (default: false)
    logger: myLogger,           // Custom app logger (optional)
    accessLogger: myNetLogger,  // Custom access log logger (optional)
    diagnostics: {
      slowRequests: false,      // TimeString threshold e.g. '500ms', or false
      largeResponses: false,    // ByteString threshold e.g. '1mb', or false
      largeRequests: false,     // ByteString threshold e.g. '1mb', or false
      memory: false,            // TimeString interval e.g. '30s', or false
      eventLoop: false,         // TimeString threshold e.g. '100ms', or false
      rateLimits: false,        // boolean
    }
  }
}
```

All diagnostics default to `false` — zero noise out of the box. Breaking change (0.x semver, fine).

---

## Phase 3a: Foundation

**Goal**: Config restructure, debug level, personality toggle, ByteString utility. No behavioral changes to existing log output yet.

### Files to Create

| File | Purpose |
|------|---------|
| `app/typedefs/public/Bytes.d.ts` | `ByteString` type: `` `${number}${'b' | 'kb' | 'mb' | 'gb'}` `` |
| `app/core/utils/bytes.ts` | `_convertBytesToBytes(size: ByteString \| number): number` converter |

### Files to Modify

**`app/constants/log.ts`**
- Add `debug: 'debug'` to `logLevels`

**`app/core/utils/log.ts`**
- Add `debug: 4` to internal `LOG_LEVELS`
- Add `personality` boolean to `createLogger` state (default: `true`)
- Add `debug()` method using `console.debug` with gray `[DEBUG]` prefix
- Conditionally append phrases in `_logWithStyle` only when `personality === true`
- Replace `dayjs` import with native `Date` formatter (cleanup — `dayjs` is unnecessary here)

**`app/typedefs/public/Logger.ts`**
- Add `personality?: boolean` to `LoggerConfig`
- Make `debug` a proper optional method on `Logger` interface (currently just mentioned in docs)

**`app/typedefs/internal/InternalConfiguration.d.ts`**
- Remove `logger?: Logger`, `networkLogs: boolean`, `networkLogger?: Logger` from `InternalServerOptions`
- Add `logging: InternalLoggingOptions` field
- Define `InternalLoggingOptions` and `InternalDiagnosticsOptions` interfaces

**`app/core/setup/utils/handleCustomConfiguration.ts`**
- Add `DEFAULT_LOGGING_CONFIG` with all defaults
- Replace `networkLogs: false` in `DEFAULT_CONFIGURATION` with `logging: DEFAULT_LOGGING_CONFIG`
- Add `_handleLoggingConfig()` deep merge function (mirrors `_handleBodyParserConfig` pattern)
- Add `_validateLoggingConfig()` — validate level, ByteString/TimeString values

**`app/core/YinzerFlow.ts` (constructor only)**
- Replace `Object.assign(log, ...)` with `createLogger({ logLevel, personality, logger })` call that mutates the singleton properly
- Replace `networkLog.enable(...)` with new `logging.requests` config
- Both still mutate module-level singletons (threading instance loggers through all internals is out of scope)

**`app/index.ts`**
- No type exports needed (`logLevels` auto-includes `debug`)

### Cleanup in 3a
- Remove `dayjs` dependency from `log.ts` — use `new Date().toISOString().replace('T', ' ').slice(0, -1)` or similar

---

## Phase 3b: Access Log Overhaul + Reclassify

**Goal**: Rename networkLog, reclassify all log calls, eliminate overlap, clean up noise.

### Files to Create

| File | Purpose |
|------|---------|
| `app/core/utils/accessLog.ts` | Replaces `networkLog.ts`. Same pattern but cleaner. No `logPerformanceDetails`. |

### Files to Delete

| File | Reason |
|------|--------|
| `app/core/utils/networkLog.ts` | Replaced by `accessLog.ts` |

### Reclassification of ALL Log Calls in `YinzerFlow.ts`

| Current (line) | Current Channel | New Channel | Rationale |
|---|---|---|---|
| "Incoming request {ip} {bytes}bytes" (261) | networkLog.info | **DELETE** | Redundant — access log line covers it |
| nginx-style access line (279) | networkLog.info | accessLog.info | Access log — stays |
| "server error at {host}:{port}" (226) | networkLog.error | **app log.error** | Server lifecycle |
| "server is up and running" (235) | networkLog.info | **app log.info** | Server lifecycle |
| "New visitor from {ip}" (405) | networkLog.info | **app log.debug** | Connection detail → debug |
| "Delayed data from {ip}" (420) | networkLog.warn | **app log.debug** | Connection detail → debug |
| "Visitor headed out" (473) | networkLog.info | **app log.debug** | Connection detail → debug |
| "health probe" (478) | networkLog.info | **app log.debug** | Connection detail → debug |
| "potential probe" (480) | networkLog.warn | **app log.debug** | Connection detail → debug |
| "Request exceeded buffer" (342) | networkLog.warn | **app log.warn** | Security event |
| "socket connection error" (466) | networkLog.error | **app log.error** | Real error |
| "request processing error" (290) | networkLog.error | **app log.error** | Real error |
| "shutting down" (519) | networkLog.warn | **app log.info** | Server lifecycle |
| "Received signal" (548) | log.info | app log.info | Already app logger |
| "Server shut down" (552) | log.info | app log.info | Already app logger |
| "Error during shutdown" (556) | log.error | app log.error | Already app logger |
| `logPerformanceDetails(...)` (282) | networkLog.warn | **DELETE** | Moves to diagnostics (3c) |

**Other files** — these already use `log.warn`/`log.error` correctly and stay unchanged:
- `parseJson.ts` — security warnings (warn)
- `parseMultipart.ts` — security warnings (warn)
- `handleCustomConfiguration.ts` — security config warnings (warn)
- `RateLimitConfig.ts` / `CookieParserConfig.ts` — config warnings (warn)
- `HookRegistryImpl.ts` — default error handler (error), empty array warning (warn)
- `RequestHandlerImpl.ts` — error handler threw (error)
- `redis.ts` — connection/operation errors (error/warn/info)

### Access Log Format (kept from current)
```
{statusEmoji} {ip} "{METHOD} {path} {proto}" {statusCode} {bytes} "{referer}" "{ua}" {duration}ms
```

---

## Phase 3c: Diagnostics Module

**Goal**: Framework health monitoring — slow requests, large bodies, memory, event loop, rate limits.

### New Module Structure
```
app/core/modules/diagnostics/
  DiagnosticsMonitor.ts    — Main class (lifecycle: start/destroy)
  bytesConverter.ts        — _convertBytesToBytes (or reuse from utils/bytes.ts)
```
```
app/typedefs/internal/modules/diagnostics/
  index.d.ts               — Internal types
```

### DiagnosticsMonitor Design

```typescript
class DiagnosticsMonitor {
  _config: InternalDiagnosticsOptions;  // resolved thresholds (numbers, not strings)
  _memoryTimer?: ReturnType<typeof setInterval>;
  _eventLoopTimer?: ReturnType<typeof setInterval>;
  _log: ReturnType<typeof createLogger>;  // own logger, always at 'info', bypasses app level

  constructor(config: InternalDiagnosticsOptions) — resolve TimeString/ByteString to numbers

  // Per-request (called after response is sent)
  checkRequest(duration: number, reqBytes: number, resBytes: number, method: string, path: string): void

  // Called when rate limiter fires
  onRateLimitHit(ip: string, path: string): void

  // Start interval monitors
  start(): void

  // Cleanup on server close
  destroy(): void
}
```

**Diagnostic output format**:
```
[DIAGNOSTIC] {emoji} [{timestamp}] [DIAG] {message} — {personality phrase}
```
Distinct `DIAGNOSTIC` prefix so devs can grep/filter. Uses Pittsburgh performance phrases from the old `PERFORMANCE_THRESHOLDS` (moved here from networkLog.ts).

### Integration Points in `YinzerFlow.ts`

- **Constructor**: `this._diagnostics = new DiagnosticsMonitor(config.logging.diagnostics); this._diagnostics.start();`
- **After response sent** (~line 279, after access log): `this._diagnostics?.checkRequest(processingTime, requestBytes, responseBytes, method, path)`
- **Rate limit hook**: Pass `onRateLimitHit` callback through `_createGlobalRateLimitHook`
- **`close()`**: `this._diagnostics?.destroy()`

### Memory Monitor
- `process.memoryUsage()` at configured interval
- Logs: `Heap: {heapUsed}MB / {heapTotal}MB | RSS: {rss}MB | External: {external}MB`
- Timer uses `.unref()` so it doesn't prevent process exit

### Event Loop Monitor
- `setTimeout(fn, interval)` drift detection — if callback fires >threshold ms late, the event loop is lagging
- Logs: `Event loop lag: {lag}ms (threshold: {threshold}ms)`
- Timer uses `.unref()`

### Slow Request / Large Body Detection
- Per-request check after response is written
- Only fires when threshold exceeded — no output for normal requests
- Slow: `Slow request: {METHOD} {path} took {duration}ms (threshold: {threshold}ms)`
- Large response: `Large response: {METHOD} {path} {size} bytes (threshold: {threshold} bytes)`
- Large request: `Large request: {METHOD} {path} {size} bytes (threshold: {threshold} bytes)`

---

## Phase 3d: Tests

**Goal**: Full coverage, verify no overlap, update existing tests.

### Update Existing Tests

**`app/core/utils/__tests__/log.spec.ts`**
- Add `debug` level tests (fires console.debug, gated correctly)
- Add `personality: false` tests (no phrases appended)
- Remove `networkLog` / `logPerformanceDetails` tests (moved)
- Update level ordering tests (5 levels now)

**`app/core/setup/utils/__tests__/handleCustomConfiguration.spec.ts`**
- Replace all `networkLogs` assertions with `logging` shape
- Add validation tests: invalid level, invalid ByteString, invalid TimeString

**`app/core/__tests__/YinzerFlow.spec.ts`**
- Replace `networkLogs: true` → `logging: { requests: true }`
- Verify connection lifecycle logs don't appear at `info` level
- Verify "Incoming request" redundant log is gone

### New Tests

**`app/core/utils/__tests__/accessLog.spec.ts`**
- Enable/disable behavior
- Custom logger passthrough
- `getStatusEmoji` function

**`app/core/modules/diagnostics/__tests__/DiagnosticsMonitor.spec.ts`**
- Slow request fires when threshold exceeded
- Slow request silent when below threshold
- Slow request fires even when app log level is `off`
- Large response detection
- Large request detection
- Memory monitor starts/stops cleanly
- Event loop monitor starts/stops
- `destroy()` clears all intervals
- Rate limit hit logging

**`app/core/utils/__tests__/bytes.spec.ts`**
- `'1kb'` → 1024, `'256kb'` → 262144, `'1mb'` → 1048576, `'1gb'` → 1073741824
- Raw number passthrough
- Invalid format throws

---

## Dependency Graph

```
3a (Foundation) — config, types, debug level, personality, ByteString
  ↓
3b (Access Log) — rename networkLog, reclassify all calls, remove redundancy
  ↓
3c (Diagnostics) — DiagnosticsMonitor, wire into request lifecycle
  ↓
3d (Tests) — update existing, add new, verify everything
```

Each phase depends on the previous. Tests can be added incrementally per phase but 3d is the final verification pass.

---

## Critical Files

| File | Phases | Changes |
|------|--------|---------|
| `app/constants/log.ts` | 3a | Add `debug` level |
| `app/core/utils/log.ts` | 3a | Debug method, personality toggle, remove dayjs |
| `app/typedefs/public/Logger.ts` | 3a | `personality` on LoggerConfig, `debug` on Logger |
| `app/typedefs/public/Bytes.d.ts` | 3a | New: ByteString type |
| `app/core/utils/bytes.ts` | 3a | New: _convertBytesToBytes |
| `app/typedefs/internal/InternalConfiguration.d.ts` | 3a | Replace networkLogs with logging block |
| `app/core/setup/utils/handleCustomConfiguration.ts` | 3a | Logging defaults + validation |
| `app/core/YinzerFlow.ts` | 3a,3b,3c | Constructor wiring, reclassify 16 log calls, diagnostics integration |
| `app/core/utils/networkLog.ts` | 3b | Delete (replaced by accessLog.ts) |
| `app/core/utils/accessLog.ts` | 3b | New: replaces networkLog.ts |
| `app/core/modules/diagnostics/DiagnosticsMonitor.ts` | 3c | New: diagnostics module |

---

## Verification

After each phase:
1. `bun test` — all 904+ tests pass
2. `bun run lint` — no lint errors
3. Manual spot-check with a test server

After all phases:
4. Verify no duplicate/overlapping log output
5. Test diagnostic thresholds fire correctly
6. Test personality toggle works
7. Test debug level gates properly
