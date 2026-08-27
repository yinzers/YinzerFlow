# Plan: Critical Bugs + Logging Revamp

Created: 2026-02-17
Updated: 2026-02-19
Status: approved (Phase 0 added after new bug report)

---

## Requirements (restated)

**Workstream 0 (HIGHEST PRIORITY)**: Fix TCP stream reassembly bug
- `socket.on('data')` treats each TCP chunk as a complete HTTP request
- Large POST bodies (>~1.4KB) get split across TCP segments and fail
- Reported as "Invalid JSON syntax: Unterminated string" on ~9KB payload
- Affects ALL large request bodies, not just JSON

**Workstream 1 (Priority 1)**: Fix 3 critical response header bugs + info disclosure
- `Date` and `Content-Length` headers never reach the client (ordering bug)
- `Content-Length` measures entire response string, not body-only (RFC violation)
- Error handler uses `.length` (char count) instead of byte count
- Error handler may leak stack traces / internal details

**Workstream 2 (Priority 2)**: Logging revamp for better DX
- Current logs are too verbose by default
- Network logs log EVERY connection event (connect, data, close, health probes)
- Every response gets a performance personality phrase — noisy
- `logPerformanceDetails` fires on warn level for EVERY request
- No `debug` level in the logger (only off/error/warn/info)
- User wants control over verbosity with sensible quiet defaults

---

## Risks & Blockers

| Risk | Impact | Mitigation |
|------|--------|------------|
| Response header fix changes wire format | All existing tests check `_stringBody` content | Update tests to verify headers are present |
| `\n` vs `\r\n` line endings in HTTP responses | Non-compliant; may cause issues with strict clients | Audit and fix to use `\r\n` per HTTP spec (out of scope but noted) |
| Logging changes break existing test expectations | Tests that spy on console output | Update log tests to match new behavior |
| Custom logger users may depend on current behavior | Unlikely but possible | Custom loggers bypass our formatting entirely, no impact |

**Note on `\r\n`**: The response currently uses `\n` for line separators in `_parseResponseIntoString()`. HTTP/1.1 spec requires `\r\n`. This is a pre-existing issue and out of scope for this plan, but flagged for awareness. The bug fixes below work regardless of line ending style.

---

## Phase 0: Fix TCP Stream Reassembly (REQUEST SIDE)

**Objective**: Buffer incoming TCP data until the complete HTTP request is received before processing.

**Root Cause**: `YinzerFlow.ts:282` — `socket.on('data', (data) => { this._processRequest({data, ...}) })` fires once per TCP chunk, not once per HTTP request. TCP is a stream protocol; a single HTTP request can arrive across multiple `data` events. Any POST/PUT/PATCH body larger than ~1.4KB (typical TCP MSS) can get split, causing the framework to parse an incomplete request.

**Evidence**: User reported `Invalid JSON syntax: JSON Parse error: Unterminated string` on a ~9KB POST payload. Stack trace shows the error originates from `parseRequestIntoObject` → `parseApplicationJson` — the body was truncated mid-string because only the first TCP chunk was processed.

**Files to modify**:
- `app/core/YinzerFlow.ts` — replace single-shot `data` handler with buffering logic
- `app/core/__tests__/YinzerFlow.spec.ts` — add large body tests

### Steps

1. **Replace `socket.on('data')` with buffering logic** (`YinzerFlow.ts:282`)
   - Accumulate data chunks into a buffer
   - After each chunk, check if we have the complete HTTP headers (look for `\r\n\r\n`)
   - Once headers are found, parse `Content-Length` from them
   - Continue buffering until we have `Content-Length` bytes of body after the header boundary
   - Only then call `_processRequest()` with the complete buffer

   Pseudocode:
   ```typescript
   let buffer = Buffer.alloc(0);
   let headersParsed = false;
   let expectedBodyLength = 0;
   let headerEndIndex = -1;

   socket.on('data', (chunk) => {
     buffer = Buffer.concat([buffer, chunk]);

     if (!headersParsed) {
       headerEndIndex = buffer.indexOf('\r\n\r\n');
       if (headerEndIndex === -1) return; // Still waiting for headers

       headersParsed = true;
       const headersStr = buffer.subarray(0, headerEndIndex).toString();
       const contentLengthMatch = headersStr.match(/content-length:\s*(\d+)/i);
       expectedBodyLength = contentLengthMatch ? parseInt(contentLengthMatch[1], 10) : 0;
     }

     const bodyStart = headerEndIndex + 4; // After \r\n\r\n
     const currentBodyLength = buffer.length - bodyStart;

     if (currentBodyLength >= expectedBodyLength) {
       // Complete request received
       this._processRequest({ data: buffer, socket, requestHandler, clientAddress });
     }
   });
   ```

2. **Handle edge cases**:
   - Requests with no body (GET, DELETE, HEAD) — `Content-Length: 0` or absent
   - Missing `Content-Length` header — process after headers are complete (no body expected)
   - Request timeout — don't hang forever if client sends partial data
   - Maximum buffer size — prevent DoS via never-ending request stream

3. **Add tests for large POST bodies** (`YinzerFlow.spec.ts`)
   - Test with body > 1.4KB (TCP segment boundary)
   - Test with body > 10KB (multiple segments)
   - Test with body > 64KB (many segments)
   - Test with empty body (GET request)
   - Test with exact Content-Length match

### Verification
- Run `bun test` — all existing tests pass
- New tests verify large POST bodies parse correctly
- Manual test with the exact payload that was failing (~9KB JSON)

---

## Phase 1: Fix Response Header Bugs

**Objective**: All HTTP responses include correct `Date` and `Content-Length` headers on the wire.

**Files to modify**:
- `app/core/execution/ResponseImpl.ts` — main fix
- `app/core/execution/RequestHandlerImpl.ts` — remove duplicate header logic from error paths
- `app/core/execution/__tests__/ResponseImpl.spec.ts` — add header verification tests

### Steps

1. **Fix `_parseResponseIntoString()` ordering** (`ResponseImpl.ts:29-59`)
   - Move `Date` and `Content-Length` header assignment BEFORE building `_stringBody`
   - Calculate `Content-Length` from the formatted `body` string only (not the entire response)
   - Order: set headers → build header lines → assemble `_stringBody`

   ```typescript
   // BEFORE (broken):
   this._stringBody = `${statusLine}\n${headersSection}\n${body}`;
   const contentLength = calculateContentSizeInBytes(this._stringBody); // wrong: measures everything
   this._setHeadersIfNotSet({ Date: ..., 'Content-Length': String(contentLength) }); // too late

   // AFTER (fixed):
   const body = formatBodyIntoString(this._body, { encoding });
   const contentLength = Buffer.byteLength(body, 'utf8'); // correct: body only
   this._setHeadersIfNotSet({ Date: dayjs().format(...), 'Content-Length': String(contentLength) });
   // NOW build headers (includes Date + Content-Length)
   const headerLines = Object.entries(this._headers).map(([key, value]) => `${key}: ${value}`);
   const setCookieLines = this._setCookies.map((value) => `Set-Cookie: ${value}`);
   const allHeaderLines = [...headerLines, ...setCookieLines];
   const headersSection = allHeaderLines.length > 0 ? `${allHeaderLines.join('\n')}\n` : '';
   this._stringBody = `${statusLine}\n${headersSection}\n${body}`;
   ```

2. **Remove duplicate header logic from error paths** (`RequestHandlerImpl.ts:118-121, 134-137`)
   - The error paths call `_parseResponseIntoString()` then try to add `Date`/`Content-Length` again
   - After the fix above, `_parseResponseIntoString()` handles this correctly for ALL paths
   - Remove the `_setHeadersIfNotSet` calls from `handleError()` entirely

3. **Add tests verifying headers reach the wire** (`ResponseImpl.spec.ts`)
   - Test that `_stringBody` contains `Date:` header
   - Test that `_stringBody` contains `Content-Length:` header
   - Test that `Content-Length` value matches body-only byte count
   - Test with multi-byte characters (emoji) to verify byte accuracy
   - Test with empty body (Content-Length: 0)

4. **Add integration test** (`YinzerFlow.spec.ts`)
   - Send a real request, parse the raw response, verify `Date` and `Content-Length` headers are present and correct

### Verification
- Run `bun test` — all existing tests pass
- New tests verify `Date` and `Content-Length` in `_stringBody`
- Integration test confirms headers reach the wire

---

## Phase 2: Fix Information Disclosure in Error Handling

**Objective**: Error responses don't leak internal details. Framework uses `log` utility everywhere.

**Files to modify**:
- `app/core/execution/RequestHandlerImpl.ts` — sanitize error responses
- `app/core/execution/HookRegistryImpl.ts` — already uses `log.error`, verify

### Steps

1. **Audit `console.log`/`console.error` usage in non-test code**
   - Ensure only `log` utility is used in framework code
   - `console.log`/`console.error` should only appear in the log utility itself

2. **Sanitize error responses** (`RequestHandlerImpl.ts:105-138`)
   - Default error handler should return generic message to client
   - Log full error details internally via `log.error`
   - Fallback error handler (when user's error handler throws) should be even more guarded

### Verification
- Grep for `console.log`/`console.error` in `app/core/` (excluding `__tests__/` and `log.ts`)
- Verify error responses don't contain stack traces or internal paths

---

## Phase 3: Logging Revamp

**Objective**: Sensible default verbosity. Users can control what gets logged. Network logs aren't overwhelming.

**Files to modify**:
- `app/core/utils/log.ts` — add `debug` level, adjust defaults
- `app/core/utils/networkLog.ts` — add verbosity tiers, reduce default noise
- `app/core/YinzerFlow.ts` — adjust network log calls to use appropriate levels
- `app/typedefs/public/Logger.ts` — add `debug` to Logger interface
- `app/typedefs/internal/InternalConfiguration.d.ts` — add `logLevel` to InternalServerOptions
- `app/constants/log.ts` — add debug level
- `app/typedefs/constants/log.ts` — update LogLevel type

### Steps

#### 3a: Add `debug` log level

1. **Update log level constants** (`app/constants/log.ts`)
   - Add `debug: 'debug'` to logLevels
   - Numeric levels: off=0, error=1, warn=2, info=3, debug=4

2. **Update Logger interface** (`app/typedefs/public/Logger.ts`)
   - Add optional `debug` method (already in docs but not enforced)

3. **Update `createLogger`** (`app/core/utils/log.ts`)
   - Add `debug()` method
   - Add `LOG_LEVELS.debug = 4`
   - `debug` uses a subtle style (gray, no yinzer phrase)

4. **Add `logLevel` to server config** (`InternalConfiguration.d.ts`)
   - Add `logLevel: LogLevel` to `InternalServerOptions`
   - Default: `'info'`
   - Pass through to `createLogger` in YinzerFlow constructor

#### 3b: Reduce network log verbosity

1. **Tiered network logging** — reclassify what logs at what level:

   | Event | Current Level | New Level | Rationale |
   |-------|--------------|-----------|-----------|
   | Server started | info | info | Important, keep |
   | Server shutdown | warn | info | Not a warning |
   | New visitor connected | info | **debug** | Too noisy for production |
   | Incoming request (size) | info | **debug** | Redundant with response log |
   | Response log (method, path, status, time) | info | info | The one log line per request |
   | Visitor headed out | info | **debug** | Too noisy |
   | Health probe (fast disconnect) | info | **debug** | Expected behavior |
   | Delayed data warning | warn | warn | Keep — actually suspicious |
   | Disconnect without data (slow) | warn | warn | Keep — suspicious |
   | Socket error | error | error | Keep |
   | Processing error | error | error | Keep |
   | Performance details | warn (EVERY request) | **debug** | Way too noisy at warn |

2. **Improve log message specificity** (from audit):
   - **Slow disconnect warning**: Distinguish health probes (<10ms) from actual suspicious disconnects (>1000ms). Current message "potential probe" is too vague — Kubernetes health probes, load balancers, etc. trigger this constantly.
   - **Delayed data threshold**: Extract magic `100` ms constant to named constant (`CONNECTION_DELAY_THRESHOLD_MS`). Add context to log message explaining what the threshold means and that >100ms may be normal on slow networks.

2. **Simplify default output**: With these changes, default `info` level shows:
   - Server start/stop
   - One line per request: `[status emoji] [ip] "METHOD /path HTTP/1.1" [status] [size] [time]ms`
   - Warnings only for genuinely suspicious activity
   - Errors only for actual errors

3. **Remove random yinzer phrases from network logs**
   - Keep personality in app logs (user-facing)
   - Network logs should be clean/parseable (like nginx access logs)
   - Or: make phrases opt-in via a `personality: boolean` config option

#### 3c: Add `logLevel` to framework config

1. **Wire up `logLevel` in YinzerFlow constructor**
   - Pass user's `logLevel` to both `log` and `networkLog` instances
   - Default: `'info'` (shows important stuff, hides debug noise)
   - Users can set `'debug'` to see everything, `'warn'` for quiet mode

2. **Update `handleCustomConfiguration.ts`**
   - Add `logLevel` to defaults
   - Validate it's a valid level

### Verification
- Run existing log tests — update expectations for reclassified levels
- Manual test: start server with default config, verify only essential logs appear
- Manual test: start server with `logLevel: 'debug'`, verify verbose logs appear
- Manual test: start server with `logLevel: 'warn'`, verify minimal output

---

## Phase 4: Tests & Cleanup

**Objective**: All changes tested, no regressions.

**Files to modify**:
- `app/core/utils/__tests__/log.spec.ts` — update for new debug level and level changes
- `app/core/utils/__tests__/networkLog.spec.ts` — if exists, update
- `app/core/execution/__tests__/ResponseImpl.spec.ts` — header tests from Phase 1
- `app/core/__tests__/YinzerFlow.spec.ts` — integration tests

### Steps

1. Update existing log tests for new `debug` level
2. Update any tests that assert on network log calls at changed levels
3. Verify all 933+ existing tests still pass
4. Add new tests from Phases 1-3

### Verification
- `bun test` — all tests pass
- No skipped or TODO tests left behind

---

## Implementation Order

```
Phase 0 (TCP buffering)  ──→  Phase 1 (Response headers)  ──→  Phase 2 (Info disclosure)  ──→  Phase 3 (Logging)  ──→  Phase 4 (Tests)
      ↑ HIGHEST priority              ↑ Critical fix              ↑ Quick security win           ↑ UX improvement        ↑ Cleanup
```

Phase 0 must go first — it blocks real-world usage with large payloads. Phases 1 and 2 are independent and could run in parallel. Phase 3 builds on Phase 2. Phase 4 covers all.

---

## Out of Scope (noted for later)

- `\r\n` line endings in HTTP responses (pre-existing, separate fix)
- Slow request threshold logging (`logSlowRequestsThreshold`)
- Response size threshold logging (`logResponseSizeOver`)
- Heap/memory usage logging
- Structured JSON log output option

These are future enhancements that build on the revamped logging system but aren't needed for the core verbosity fix.

---

## Audit Findings Deferred to This Plan (2026-02-19)

Items discovered during code audit that overlap with existing phases:

**Phase 3 (Logging)**:
- Fix `logPerformanceDetails` — all response times logged as WARN (even sub-50ms). Use tiered log levels: info for normal, warn for >500ms, error for >1000ms.
- Improve slow disconnect warning specificity — distinguish health probes from security probes by connection duration.
- Extract and document delayed data threshold (100ms magic number).

**Phase 4 (Tests & Cleanup)**:
- Delete dead `app/core/utils/cors.ts` (89 lines) + `app/core/utils/__tests__/cors.spec.ts` (637 lines). Old CORS utility completely replaced by `Cors` class module.

**Investigated during audit — no action needed now**:
- Bug #5: CORS `_handleActualRequest` doesn't block disallowed origins server-side. This is CORS-spec-correct (browser enforces). Design decision — may add optional server-side blocking later.
- Bug #7: Signal handler only captures first YinzerFlow instance. Known limitation, test confirms behavior. Multi-instance apps should call `.close()` explicitly.
