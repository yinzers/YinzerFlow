# Changelog

## [0.7.0] - 2026-02-20

### Bug Fixes

- **Clarify log level threshold behavior** — Fixed logging logic to properly enforce log level thresholds, ensuring messages below the configured level are correctly filtered (f2ff105)

### Internal

- **Move bundle check to preflight in publish workflow** — Reorganized publish process to validate bundles earlier in the pipeline (4b42643)
- **Improve type safety across core flow** — Enhanced type annotations and removed unsafe `typeof` checks in favor of explicit interfaces (36eb059, 1f29acf, 266a1bd)
- **Restructure logging into three independent channels** — Refactored logging system to separate concerns with per-instance loggers instead of a global singleton, improving isolation and testability (bb7d752, dc9738d, 534c8e7, 86e1207, 5b769d3, 8c10c1f)
- **Inject logger dependencies throughout middleware** — Threaded logger instances through cookie parser, rate limiter, and hook registry instead of relying on global state (874f6a4, e8277b3)
- **Consolidate logging configuration** — Unified logging config handling and clarified log level documentation in InternalConfiguration (15b9158, e9888db)
- **Improve utility functions** — Enhanced time utilities validation logic, added byte size conversion helpers, and removed unused utility functions (2e2a0bf, 004df51, 5e70bd2)
- **Verify npm credentials before git operations** — Updated publish script to check npm access before attempting git pushes (65dbead)
- **Remove dayjs dependency** — Eliminated unnecessary dayjs library from project dependencies (36c57ba)

## [0.6.14] - 2026-02-20

### Bug Fixes

- **Use correct API key environment variable** — Fixed publish script to reference the proper API key environment variable for changelog generation (c4f420c)

### Internal

- **Enhance preflight checks in publish script** — Refactored preflight validation logic to improve robustness of the publish process (09ad711)
- **Require API key for changelog generation** — Updated publish configuration to enforce API key presence when generating changelogs (04bfd70)

## [0.6.13] - 2026-02-20

- ``` 🔧 chore: update progress to Phase 2 (7a55239)
- ♻️ refactor(hook-registry): fix typo in error log (057a458)
- ♻️ refactor(request-response-handling): optimize headers (a133d7c)

All notable changes to YinzerFlow will be documented in this file.

## [0.6.12] - 2026-02-20

- ♻️ refactor(YinzerFlow): improve code formatting (c05d3dd)
- ♻️ refactor(YinzerFlow): extract TCP reassembly helpers (ff98cd1)
- 🔧 chore(build): remove custom build script (112efc4)
- 🔧 chore: update state doc, remove build cmd (877c81b)
- ♻️ refactor(publish): inline build steps (ff0f22e)
- ♻️ refactor(YinzerFlow): improve code consistency (296d8fd)
- 🔧 chore(build): include changelog in dist (e90c812)
- ♻️ refactor(publish): move npm check post-version (7ddd8ff)
- 🐛 fix(publish): allow env override in npm login (8466287)
- ♻️ refactor(publish): allow interactive npm login (03e66fa)
- 🔧 chore: add release automation script (87609fc)
- ♻️ refactor(build-scripts): consolidate scripts (918a87c)
- 🔧 chore: consolidate docs into .claude/ plans (0a4478c)
- ♻️ refactor(YinzerFlow): handle TCP stream reassembly (3a8abf3)
- ♻️ refactor(cors): optimize validation and improve (8ead380)
- ✨ feat(cors): add comprehensive CORS middleware with security-first implementation (c830e60)
- 📚 docs(docs): mark type standardization and hook system phases complete (4e1776e)
- ✨ feat(cors): export corsHook for external application integration (15882fc)
- ♻️ refactor(setup): move CORS configuration merging to CorsConfig class (46f33a6)
- ✨ feat(core): add beforeRouting hooks for pre-routing middleware (b7a02e3)
- ♻️ refactor(execution): replace direct CORS handling with hook-based approach (ac2fcd2)
- ✨ feat(hooks): add beforeRouting hook phase for pre-routing middleware (4fed224)
- ai(docs): add comprehensive documentation standards for YinzerFlow (4bfca9c)
- ♻️ refactor(parseIpAddress): rename type to InternalIpSecurityOptions (08bf84c)
- 🔧 chore(cursor): rename ServerConfiguration to ServerOptions in docs (7a3dd9b)
- 📚 docs(docs): add IP security CDN support and implementation roadmap (4fa23bc)
- ♻️ refactor(execution): rename configuration types to use Options suffix (311ea46)
- refactor(types): rename CORS Configuration to Options (f2769a2)
- refactor(types): rename ServerConfiguration to ServerOptions (b91644f)
- 📚 docs(docs): expand feature planning with granular body parser controls (89db5df)
- 🔧 chore(package): bump version to 0.6.11 (e0e1e7f)
- 🐛 fix(exports): expose Cookies type for external consumption (d1bc605)
- ♻️ refactor(core): use proper type imports for internal CORS and cookies (9c15345)
- ♻️ refactor(typedefs): extract inline cookies interface to dedicated type (4a77d63)
- 🔧 chore(cors): make CORS enabled configuration partially optional (d970b7d)
- ai: bump version to 0.6.9 and fix documentation typo (efdf5e4)
- ✨ feat(cors): rename CorsConfiguration to CorsOptions for consistency (cb639ae)
- asdf (d83100f)
- ✨ feat(Configuration): add BodyParserOptions type for middleware configuration (d3a063e)
- 🔧 chore(verification): remove Google site verification file (1eaf71b)
- 🔧 chore: add Google site verification file (9d98e03)
- 📚 docs(docs): update cookie-parser maxAge examples to support TimeString (d68c557)
- ✨ feat(cookieParser): add TimeString support for maxAge option (530b610)
- 🧪 test: add comprehensive cookie parser test suite (46e7a85)
- ✨ feat(cookies): add cookie parsing and signing support (c97b92c)
- 🔧 chore: bump version to 0.5.6 and update Redis deps (08e7896)
- 🐛 fix(ratelimiter): update Redis client type import (06b7b12)
- 🐛 fix: exclude peer dependencies from bundle (3340419)
- 🐛 fix: correct sliding window reset and Redis TTL handling (2d8c227)
- 🔧 chore(packagejson): bump version from 0.5.1 to 0.5.2 (a895adb)
- 🐛 fix(ratelimiter): preserve TTL when updating existing keys to fix race condition (f1fc1cd)
- ♻️ refactor(rate limit): improve type safety with generic handlers (91e8d20)
- 🔧 chore: add millisecond support to Redis retry delay (ef08787)
- 📚 docs(ratelimiting): add Redis store configuration and examples (49980a1)
- ✨ feat(ratelimiter): add Redis store support for distributed rate limiting (0117dca)
- 📚 docs(docs/ratelimiter): expand documentation template with comprehensive standards (1635207)
- 🐛 fix(request): change query parameter type from string to unknown (ed316d1)
- ✨ feat(logs): add table method for structured data display (285e8ec)
- 🔧 chore(format): remove trailing blank line from index.ts (26e2c86)
- ✨ feat(constants): export color, HTTP, and log constants (92fdb62)
- ♻️ refactor(request handler): fix hooks not returning when defined and improve readability (44ded8d)
- ♻️ refactor(route groups): use public RouteGroup type instead of internal (d83e000)
- ``` ♻️ refactor: clean up logging tests and remove whitespace (1e9c648)
- ♻️ refactor(core): consolidate network logging into single utility (37bd039)
- 🔧 chore(validation): add runtime validation for hook handler arrays (8b587b7)
- 📚 docs: add comprehensive JSDoc for YinzerFlow class (1339b18)
- 📚 docs: add explanation of state data storage capability in ContextImpl (488eb4a)
- ♻️ refactor(route setup): extract common route utilities and fix default handling (e73a422)
- ✨ feat(groups): implement nested route groups with inheritance (2f73280)
- ♻️ refactor(types): extract RouteGroup type from group method signature (919f3d5)
- 📚 docs: reorganize advanced configuration and add draft patterns guide (4bff461)
- 🐛 fix: standardize error handling and logging (6020c24)
- ♻️ refactor(request handling): move route matching to handler phase (164c446)
- 🐛 fix(types): add generic type parameter to HandlerCallback (fec562a)
- 📚 docs: add comprehensive README with quick start guide (32d90e1)
- 🐛 fix(package): correct homepage URL format in package.json (90ff24e)
- 🔧 chore: update package.json homepage to docs link (e1790fd)
- v2 first commit (288eaf4)
