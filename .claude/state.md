# Session State: yinzerflow

**Last Updated**: 2026-04-25

---

## Current Context (REPLACE each update)

**Goal**: WebSocket Milestone 2 COMPLETE + TS strict mode cleanup done. Awaiting user direction.
**Immediate Task**: None — all WS work done, clean build.

**Milestone 2 Summary** (7 commits on main):
- Phase 1 (`3d7d949`): Heartbeat/keepalive — two-state sweep, liveness tracking (12 tests)
- Phase 2 (`4882be8`+`09a7149`): Message rate limiting — token bucket, 1008 close (12 tests)
- Phase 3 (`ac29be0`): Compression — permessage-deflate, RSV1, broadcast-safe no-context-takeover (35 tests)
- Phase 4 (`d05c235`): Docs update + verification sweep
- TS fix (`dad4a74`): All WS TypeScript strict mode errors resolved, handleCustomConfiguration deep merge fix

**Build Status**: 
- Lint: 0 errors
- Tests: 1110 pass, 0 fail
- TS: 0 WS-related errors (37 pre-existing in non-WS files)

---

## Environment & Commands (CRITICAL - often lost after compaction)

**Package Manager**: bun

**Common Commands**:
```bash
bun test                    # Test
bun run lint                # Lint
npx tsc --noEmit            # Full TS type check
bun run build:watch         # Build watch
bun run publish:release     # Publish release
```

---

## Active Decisions

- [2026-04-24] **WebSocket: raw RFC 6455**: Full raw TCP, no dependencies
- [2026-04-25] **Heartbeat default enabled (30s)**: Industry standard
- [2026-04-25] **Rate limit close with 1008**: RFC 6455 Policy Violation
- [2026-04-25] **Compression: no-context-takeover only**: Preserves encode-once broadcast
- [2026-04-25] **Compression: deflateRawSync + Z_SYNC_FLUSH**: Stateless, zlib-ng SIMD in Bun
- [2026-04-25] **inflateRawSync needs finishFlush: Z_SYNC_FLUSH**: Required for sync-flushed data

---

## Remember for This Project

- WebSocket Milestone 1 COMPLETE (v0.8.0, 129 WS tests)
- WebSocket Milestone 2 COMPLETE (59 new WS tests, 1110 total)
- handleCustomConfiguration.ts must deep-merge ALL nested WS config objects (backpressure, heartbeat, messageRateLimit, compression)
- `exactOptionalPropertyTypes` causes contravariant generic issues with `WebSocketConnection<T>` — use `as WebSocketConnection` or `WebSocketConnection<unknown>` in tests
- YinzerFlow.ts has `max-lines` eslint-disable
- Code-indexer path is `/code/development/npm/yinzerflow`
- Default logging level is `'warn'`
- `_isAlive`, `_heartbeatEnabled`, `_compressionEnabled` are non-private on WebSocketConnection
- inflateRawSync requires `finishFlush: constants.Z_SYNC_FLUSH` for sync-flushed data
- 37 pre-existing TS errors in non-WS files (body parser specs, setup specs, context specs) — not from WS work
