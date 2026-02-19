# Module Refactor & Architecture Roadmap

**Created**: 2026-02-17
**Source**: Consolidated from root `TODO.md`

---

## Overview

Refactor YinzerFlow's centralized features into self-contained modules following the cookieParser/rateLimit pattern. Includes the beforeRouting hook system and CORS module conversion.

---

## Architecture Refactoring

### 1. beforeRouting Hook System (NEW FRAMEWORK FEATURE) - COMPLETE
- **Purpose**: Enable middleware to run BEFORE route matching (CORS, security headers, IP blocking)
- **Status**: Complete (Phase 1)

### 2. Configuration Localization
- **Goal**: Move away from centralized config in `handleCustomConfiguration.ts` to module-local configs
- **Modules to refactor**:
  - [ ] `ipSecurity` - Create `app/core/modules/ipSecurity/` with Config, hooks, and core logic
  - [ ] `bodyParser` (core parsing) - Create `app/core/modules/bodyParser/`
  - [ ] `logging` - Create `app/core/modules/logging/` (if we want to make it configurable per-app)
    - [ ] Heap/memory logging as submodule or utility
  - [x] `cors` - Complete (Phase 2)
- **Modules that should STAY centralized**:
  - Server config (port, host, gracefulShutdownTimeout) - app-level concerns

### 3. Module Structure Standardization
- **Pattern**: Each module follows:
  ```
  app/core/modules/{feature}/
  ├── {Feature}.ts           # Core implementation
  ├── {Feature}Config.ts     # Configuration & validation
  ├── {feature}Hooks.ts      # Hook functions
  └── __tests__/             # Module tests
  ```
- [ ] **ipSecurity Module** (uses beforeAll hooks)
  - Move from centralized config to module
  - Create `IpSecurityConfig.ts` with validation
  - Create `ipSecurityHooks.ts`
  - Register in YinzerFlow constructor if enabled
- [ ] **bodyParser Module** (uses beforeAll hooks)
  - Move parsing logic from setup/utils to dedicated module
  - Create `BodyParserConfig.ts` (json, urlEncoded, fileUploads)
  - **Include per-parser enable/disable feature**
  - Create `bodyParserHooks.ts`
  - Register in YinzerFlow constructor
- [ ] **logging Module** (optional)
  - Core logging options and enhancements (slow logging, response size, memory/network/cpu debug)
  - Modular debug helpers for security/performance investigation

### 4. Hook Definition Pattern Analysis - DECIDED
- **Decision**: Keep as-is
  - `onError`/`onNotFound`: Direct methods (lifecycle hooks)
  - Middleware (rateLimit, cookieParser, ipSecurity, bodyParser): Settings-based with callbacks in config
- **Reasoning**: Lifecycle hooks are methods, middleware config (including callbacks) is settings

### 5. CORS Module & beforeRouting Hooks - COMPLETE

**New Request Lifecycle**:
```
1. beforeRouting hooks (CORS, security headers, IP blocking)
   ↓ Can short-circuit before routing
2. Route matching
   ↓
3. beforeAll hooks (auth, rate limit, cookie parsing)
   ↓
4. beforeRoute/beforeGroup hooks
   ↓
5. Route handler
   ↓
6. afterRoute/afterGroup hooks
   ↓
7. afterAll hooks
```

**Future Extensions with beforeRouting**:
- Custom security headers (HSTS, CSP, X-Frame-Options)
- IP allowlist/blocklist (before routing)
- Request ID generation
- Global rate limiting (before route-specific limits)
- Logging/monitoring hooks
- API versioning (URL rewriting before routing)

---

## Implementation Progress Tracker

### Phase 0: Type Naming Standardization - COMPLETE

All configuration types standardized to "Options" suffix.
- Chunks 0.1-0.6: All committed.

---

### Phase 1: Add beforeRouting Hook System - COMPLETE

- Chunks 1.1-1.5: All complete. 931 tests passing (+10 new tests).

---

### Phase 2: Convert CORS to Module - COMPLETE

- Chunks 2.1-2.7: All complete. 933 tests passing. CORS now runs as beforeRouting hook.

---

### Phase 3: ipSecurity Module Refactor (PLANNED)

Convert ipSecurity to module pattern with beforeAll hooks.

- [ ] Chunk 3.1-3.7: TBD (similar structure to Phase 2)

**Status**: Not started.

---

### Phase 4: bodyParser Module Refactor (PLANNED)

Convert bodyParser to module with per-parser enable/disable.

- [ ] Chunk 4.1-4.6: TBD

**Status**: Not started.

---

### Phase 5: Final Documentation (PLANNED)

Update all documentation to reflect new patterns.

- [ ] Chunk 5.1-5.4: TBD

**Status**: Not started.

---

**Next Up**: Phase 3 - ipSecurity Module Refactor
