# TODO

## Security

- [ ] **Verify IP Security Middleware**
  - Test that `ipSecurity` middleware properly blocks/warns for unauthorized IPs
  - Test inside Docker container environment
  - Issue: Tested on another app and it didn't stop or warn as expected
  - Verify configuration is correct
  - Ensure middleware is properly registered in the request pipeline
  - Test with various IP scenarios (blocked, allowed, localhost, etc.)

## Code Quality & Consistency

- [ ] **Standardize Type Naming Conventions**
  - **Issue**: Inconsistent naming - some use "Configuration" (e.g., `InternalBodyParserConfiguration`), others use "Options" (e.g., `RateLimitOptions`)
  - **Decision**: Use "Options" suffix consistently for user-facing config types
  - **Action Items**:
    - Audit all configuration-related types
    - Rename types to use consistent "Options" suffix:
      - Internal types: `Internal{Feature}Options`
      - Public types: `{Feature}Options`
    - Examples:
      - `InternalBodyParserConfiguration` → `InternalBodyParserOptions`
      - `CorsOptions` → `CorsOptions`
      - `ServerConfiguration` → `ServerOptions`
    - Update all imports and references
    - Update documentation to reflect new naming
  - **Note**: This should be done as a separate refactor, possibly before or after module work

## Feature Enhancements

- [ ] **Body Parser: Add Per-Parser Type Enable/Disable**
  - **Issue**: Currently bodyParser is all-or-nothing - can't disable JSON parsing while keeping URL-encoded, etc.
  - **Goal**: Allow granular control over which parsers are active
  - **Implementation**: Add `enabled` flag to each parser type in BodyParserOptions
  - **Example**:
    ```typescript
    const app = new YinzerFlow({
      bodyParser: {
        json: {
          enabled: true,      // Enable JSON parsing
          maxSize: 262144,
          maxDepth: 10
        },
        urlEncoded: {
          enabled: false,     // Disable URL-encoded parsing
          maxSize: 1048576
        },
        fileUploads: {
          enabled: true,      // Enable file uploads
          maxFileSize: 10485760
        }
      }
    });
    ```
  - **When**: Implement this as part of bodyParser module refactor (Phase 4)
  - **Benefits**:
    - Opt-out of unused parsers for performance
    - Clearer security posture (disable what you don't need)
    - Consistent with other module patterns (CORS, rateLimit have `enabled`)
    - Better tree-shaking potential

## Architecture Refactoring

### 1. Add beforeRouting Hook System (NEW FRAMEWORK FEATURE)
- [ ] **Implement beforeRouting Hooks for Pre-Routing Middleware**
  - **Purpose**: Enable middleware to run BEFORE route matching (CORS, security headers, IP blocking)
  - **Blocks**: CORS module refactor (Section 5)
  - **Details**: See Section 5 "CORS Module & beforeRouting Hooks" for full implementation plan
  - **Priority**: HIGH - Required for CORS module consistency

### 2. Configuration Localization
- [ ] **Refactor Configuration to be Module-Local**
  - **Goal**: Move away from centralized config in `handleCustomConfiguration.ts` to module-local configs (like cookieParser/rateLimit pattern)
  - **Modules to refactor**:
    - [ ] `ipSecurity` - Create `app/core/modules/ipSecurity/` with Config, hooks, and core logic
    - [ ] `bodyParser` (core parsing) - Create `app/core/modules/bodyParser/`
    - [ ] `logging` - Create `app/core/modules/logging/` (if we want to make it configurable per-app)
    - [ ] `cors` - See Section 5 (requires beforeRouting hooks first)
  - **Modules that should STAY centralized**:
    - Server config (port, host, gracefulShutdownTimeout) - These are app-level concerns

  **Opinion**: This is the right direction. Module-local config provides:
  - Better code organization and discoverability
  - Easier to tree-shake unused modules
  - Clearer separation of concerns
  - Each module is self-contained with its own validation
  - Follows the pattern already established by cookieParser/rateLimit

### 3. Module Structure Standardization
- [ ] **Convert Centralized Features to Modular Pattern**
  - Create consistent module structure for each feature following cookieParser/rateLimit pattern:
    ```
    app/core/modules/{feature}/
    ├── {Feature}.ts           # Core implementation
    ├── {Feature}Config.ts     # Configuration & validation
    ├── {feature}Hooks.ts      # Hook functions
    └── __tests__/            # Module tests
    ```
  - [ ] **ipSecurity Module** (uses beforeAll hooks)
    - Move from centralized config to module
    - Create `IpSecurityConfig.ts` with validation
    - Create `ipSecurityHooks.ts`
    - Register in YinzerFlow constructor if enabled
  - [ ] **bodyParser Module** (uses beforeAll hooks)
    - Move parsing logic from setup/utils to dedicated module
    - Create `BodyParserConfig.ts` (json, urlEncoded, fileUploads)
    - **Include per-parser enable/disable feature** (see "Feature Enhancements" section)
    - Create `bodyParserHooks.ts`
    - Register in YinzerFlow constructor (check each parser type's enabled flag)
  - [ ] **logging Module** (optional)
    - Consider if we want app-specific logging config as a module
    - Might not be necessary since logging is more of a framework concern
  - [ ] **cors Module** (uses beforeRouting hooks)
    - **Handled in Section 5 below** - Requires beforeRouting hook system first
    - Special case: needs pre-routing execution (before route matching)

  **Opinion**: Strong YES on this. Benefits:
  - Consistent patterns across the codebase
  - Each module is independently testable
  - Clear entry points for configuration
  - Easier for contributors to understand and extend
  - Better tree-shaking in production builds

### 4. Hook Definition Pattern Analysis
- [x] **Decide on Hook Registration Pattern: Direct Methods vs Settings** ✅ DECIDED

  **Current Situation**:
  - `onError` / `onNotFound`: Registered via direct methods (`app.onError(handler)`, `app.onNotFound(handler)`)
  - `rateLimit` / `cookieParser`: Registered via settings in constructor config

  **Analysis**:

  #### Compile/Bundle Size
  - **Verdict**: Negligible difference
  - Both approaches result in similar bundle sizes
  - Tree-shaking can't eliminate much since both need hook registry logic
  - The function code exists regardless of registration method

  #### CPU Efficiency
  - **Verdict**: Virtually identical
  - Both register handlers that execute at runtime
  - No meaningful performance difference in registration
  - Execution cost is the same (just function calls)

  #### Developer Experience
  - **Method-based (onError/onNotFound)**:
    - ✅ More discoverable in IDE autocomplete
    - ✅ Clear intent: `app.onError(handler)` is self-documenting
    - ✅ Easier to find in docs and examples
    - ✅ Better for one-time setup handlers
    - ✅ Clearer stack traces during debugging
  - **Settings-based (rateLimit/cookieParser)**:
    - ✅ All config in one place (constructor)
    - ✅ More declarative approach
    - ✅ Better for conditional middleware with complex config
    - ✅ Easier to share config across apps (export config object)
    - ⚠️ Requires checking docs to know what settings exist

  **Recommendation**: KEEP AS-IS
  - **Keep onError/onNotFound as direct methods** - They're lifecycle hooks, not middleware
  - **Use settings-based for middleware** (rateLimit, cookieParser, ipSecurity, bodyParser)
  - **Keep callbacks in middleware settings** (e.g., `rateLimit.handler`, `rateLimit.keyGenerator`)

  **Reasoning**:
  - `onError`/`onNotFound` are conceptually different - they're error boundaries, not request pipeline middleware
  - Direct methods (`app.onError()`) make error handling obvious and discoverable
  - Middleware like rate limiting benefits from centralized config because it often needs conditional enabling and complex settings
  - **Middleware callbacks** (like `rateLimit.handler`, `keyGenerator`) are feature customization, not lifecycle hooks:
    - They're specific to that middleware feature
    - They need per-instance variability (global vs per-route)
    - Keeping them in settings maintains config cohesion
    - Default behaviors are sensible; advanced users can override
  - This separation keeps the API intuitive: lifecycle hooks are methods, middleware config (including callbacks) is settings

  **Final Pattern**:
  ```typescript
  // Lifecycle hooks - Direct methods (keep as-is)
  app.onError(handler);
  app.onNotFound(handler);

  // Middleware - Settings-based with callbacks in config (keep as-is)
  const app = new YinzerFlow({
    rateLimit: {
      max: 100,
      window: '15m',
      handler: (ctx) => ({ error: 'Rate limited' }),      // ✅ Keep in settings
      keyGenerator: (ctx) => ctx.request.ipAddress        // ✅ Keep in settings
    },
    cookieParser: { enabled: true, secret: 'xxx' },
    ipSecurity: { trustedProxies: [...] },
    bodyParser: { json: { maxSize: 1024 } }
  });
  ```

### 5. CORS Module & beforeRouting Hooks
- [ ] **Refactor CORS to Module + Add beforeRouting Hook System**

  **Decision**: Implement Option C - Add `beforeRouting` hooks for pre-routing middleware

  **Dependencies**: This section implements Section 1 (beforeRouting hooks) AND converts CORS to module pattern

  **Current Architecture Problem**:
  - CORS is special-cased: called directly in `RequestHandlerImpl` before route matching
  - Inconsistent with other middleware (cookieParser, rateLimit use hook system)
  - No way for users to add custom pre-routing logic
  - Framework is less flexible than Express/Fastify/Elysia

  **Three Options Analyzed**:

  #### Option A: Keep CORS Special (Current)
  - Security: ⭐⭐⭐⭐⭐ - Can't be bypassed or misconfigured
  - Performance: ⭐⭐⭐⭐⭐ - Direct call, zero overhead (~0 μs)
  - DX: ⭐⭐ - Inconsistent pattern, not extensible

  #### Option B: Move CORS to beforeAll (Change Execution Order)
  - Security: ⭐⭐⭐ - Easy to accidentally reorder hooks, break CORS
  - Performance: ⭐⭐⭐⭐ - Hook system overhead (~1-3 μs per request)
  - DX: ⭐⭐⭐⭐ - Consistent API, but confusing name

  #### Option C: Add beforeRouting Hook Type (CHOSEN) ✅
  - Security: ⭐⭐⭐⭐⭐ - Explicit separation, hard to misuse
  - Performance: ⭐⭐⭐⭐ - Hook overhead, but optimizable (~0.1 μs with empty check)
  - DX: ⭐⭐⭐⭐⭐ - Explicit, matches industry patterns (Fastify, Hono)

  **Why Option C**:
  Given priorities (Security > Performance > DX):
  1. Maintains top-tier security (explicit API, hard to misconfigure)
  2. Performance impact negligible with optimization (empty array check)
  3. Best developer experience (clear, extensible, industry-standard)
  4. Matches Fastify (`onRequest`), Hono, Elysia patterns
  5. Future-proof: users can add custom pre-routing logic

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

  **Implementation Plan**:

  #### Phase 1: Add beforeRouting Hook System
  - [ ] Update `HookRegistryImpl`:
    - Add `_beforeRouting: Array<{ handler: HandlerCallback, options?: InternalGlobalHookOptions }>` property
    - Add `_addBeforeRoutingHooks(handlers, options)` method
    - Export `_beforeRouting` getter
  - [ ] Update `SetupImpl`:
    - Add `beforeRouting(handlers: Array<HandlerCallback<any>>, options?: InternalGlobalHookOptions): void` method
  - [ ] Update `RequestHandlerImpl.handle()`:
    - Add `_handleBeforeRoutingHooks()` method
    - Call it FIRST, before route matching
    - Optimize: check array length before iteration
    ```typescript
    // Optimized beforeRouting execution
    if (this.setup._hooks._beforeRouting.length > 0) {
      for (const hook of this.setup._hooks._beforeRouting) {
        if (!this._shouldRunHook(hook.options, context.request.path)) continue;
        const result = await hook.handler(context);
        if (result !== undefined) {
          context._response._setBody(result);
          return void 0;
        }
      }
    }
    ```
  - [ ] Update TypeScript types:
    - Add `beforeRouting` to `Setup` interface
    - Add `_beforeRouting` to internal interfaces

  #### Phase 2: Convert CORS to Module
  - [ ] Create CORS module structure:
    ```
    app/core/modules/cors/
    ├── Cors.ts              # Core CORS logic (move from utils/cors.ts)
    ├── CorsConfig.ts        # Configuration, validation, defaults
    ├── corsHooks.ts         # Export corsHook() function
    └── __tests__/          # Module tests
    ```
  - [ ] `CorsConfig.ts`:
    - Move CORS defaults from `handleCustomConfiguration.ts`
    - Add validation (origin validation, credentials + wildcard check, etc.)
    - Add security warnings (like other modules)
  - [ ] `Cors.ts`:
    - Move core logic from `app/core/utils/cors.ts`
    - Keep the same behavior (handle OPTIONS, validate origin, set headers)
  - [ ] `corsHooks.ts`:
    - Export `corsHook(config?: CorsOptions): HandlerCallback`
    - Returns hook function that calls `Cors.handle(context)`
  - [ ] Update `YinzerFlow.ts` constructor:
    - If `configuration?.cors?.enabled`, create CorsConfig and register hook:
    ```typescript
    if (configuration?.cors?.enabled) {
      const corsConfig = new CorsConfig(configuration.cors);
      const corsHookFunc = corsHook(corsConfig.config);
      this.beforeRouting([corsHookFunc]);
    }
    ```
  - [ ] Remove old CORS code:
    - Delete `app/core/utils/cors.ts`
    - Remove CORS handling from `RequestHandlerImpl._handleCors()`
    - Remove CORS config from `handleCustomConfiguration.ts`

  #### Phase 3: Update Tests
  - [ ] Add `beforeRouting` hook tests:
    - Test execution order (before route matching)
    - Test short-circuiting
    - Test multiple beforeRouting hooks
    - Test with options (skip/only routes)
  - [ ] Update CORS tests:
    - Move tests from `app/core/utils/__tests__/cors.spec.ts`
    - Update to test CORS module directly
    - Test CORS as beforeRouting hook
  - [ ] Update integration tests:
    - Test full request lifecycle with beforeRouting
    - Test CORS + other beforeRouting hooks interaction
  - [ ] Update RequestHandler tests:
    - Remove direct CORS testing (now handled by module)
    - Add beforeRouting hook execution tests

  #### Phase 4: Update Documentation & Examples
  - [ ] **Core Concept Docs**:
    - Update `docs/core/core-concepts.md` - Add beforeRouting to hook lifecycle
    - Update `docs/core/error-handling.md` - Clarify hook execution order
  - [ ] **Hook Documentation**:
    - Create/update `docs/core/hooks.md`:
      - Document all hook types: beforeRouting, beforeAll, beforeRoute, afterRoute, afterAll
      - Show execution order diagram
      - Explain when to use each hook type
      - Show examples of beforeRouting use cases (CORS, IP blocking, security headers)
  - [ ] **CORS Documentation**:
    - Update `docs/modules/cors.md`:
      - Show CORS is now a module (no longer special-cased)
      - Update examples to show new pattern
      - Note that CORS runs as beforeRouting hook
      - Show manual registration example: `app.beforeRouting([corsHook(config)])`
  - [ ] **Configuration Documentation**:
    - Update `docs/configuration/configuration.md`:
      - CORS config still works the same in constructor
      - Note internal implementation changed (now uses beforeRouting)
  - [ ] **Migration Guide** (if needed):
    - Create `docs/migrations/v2-hooks.md`:
      - Note: CORS API unchanged for users (breaking change only for internal APIs)
      - Show beforeRouting hook system for custom pre-routing logic
  - [ ] **README.md**:
    - Update examples to reflect new hook types
    - Add beforeRouting to feature list
  - [ ] **Example Files**:
    - Search for CORS examples in docs/examples and update
    - Update any route/hook examples

  #### Phase 5: Export Public APIs
  - [ ] Export from main index:
    - `export { corsHook } from '@core/modules/cors/corsHooks.ts'`
    - Types for CorsOptions, CorsConfig
  - [ ] Update public type definitions:
    - Add `beforeRouting` to Setup interface exports
    - Ensure CorsOptions is exported

  **Performance Optimization**:
  - Empty array check: `if (hooks.length > 0)` before iteration
  - Overhead: ~0.1 μs when no hooks, ~1-3 μs per hook
  - At 1M requests/sec with no hooks: ~100ms overhead (acceptable)

  **Breaking Changes**:
  - **Internal only**: `RequestHandlerImpl._handleCors()` removed
  - **User-facing**: No breaking changes - CORS config API unchanged

  **Future Extensions with beforeRouting**:
  - Custom security headers (HSTS, CSP, X-Frame-Options)
  - IP allowlist/blocklist (before routing)
  - Request ID generation
  - Global rate limiting (before route-specific limits)
  - Logging/monitoring hooks
  - API versioning (URL rewriting before routing)
