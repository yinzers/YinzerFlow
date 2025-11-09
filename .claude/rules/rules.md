# YinzerFlow Framework - Project Ruleset

<!-- Project-wide rules for YinzerFlow development -->

## **Project Overview**

YinzerFlow is a lightweight, modular HTTP server framework for Node.js and Bun built with TypeScript. This is a **framework project**, not an API or application. The code here is meant to be used by other developers to build their own applications.

### **Key Principles**

- **Framework First**: Every decision should consider the developer experience of framework users
- **Type Safety**: Comprehensive TypeScript types for all public APIs
- **Security**: Built-in security features with sensible defaults
- **Performance**: Lightweight and fast with minimal overhead
- **Developer Experience**: Clear APIs, helpful error messages, and Pittsburgh personality

## **Critical Thinking & Investigation**

- **Challenge assumptions**: Always question and investigate rather than assume
- **Research thoroughly**: Look up information, find multiple sources, and cross-reference
- **Evidence-based decisions**: Base conclusions on actual code patterns and documentation
- **Ask "why"**: Understand the reasoning behind patterns, not just follow them blindly
- **Verify patterns**: Check existing codebase to confirm established conventions
- **No blind acceptance**: Challenge even the user's suggestions if they contradict evidence

## **Problem-Solving Approach**

- **Investigate first**: Always examine the codebase before making changes
- **Find patterns**: Look for existing implementations to understand the established approach
- **Cross-reference**: Compare multiple examples to identify consistent patterns
- **Document findings**: Explain the evidence that led to conclusions
- **Propose alternatives**: When patterns conflict, present options with reasoning
- **Clean up unused code**: ALWAYS remove code that becomes unused when changing direction or approach

## **Project Structure**

```
yinzerflow/
├── app/                        # Main source code
│   ├── core/                   # Framework core implementation (DO NOT put types here)
│   │   ├── execution/          # Request/response handling implementation
│   │   ├── setup/              # Setup and routing implementation
│   │   ├── modules/            # Complex, self-contained features (plugins)
│   │   │   └── rateLimit/      # Rate limiting module
│   │   │       ├── RateLimiter.ts
│   │   │       ├── hooks.ts
│   │   │       ├── strategies/
│   │   │       └── __tests__/
│   │   ├── utils/              # Simple, focused utilities (logging, string helpers, etc.)
│   │   └── YinzerFlow.ts       # Main framework class
│   ├── typedefs/               # ALL type definitions go here
│   │   ├── public/             # Types for framework users (exported in index.d.ts)
│   │   ├── internal/           # Internal implementation types (NOT exported)
│   │   └── constants/          # Type definitions for constants
│   ├── constants/              # Actual constant values (all exported in index.ts)
│   └── index.ts                # Main exports file
├── docs/                       # Documentation
├── example/                    # Example implementations
├── real-world-tests/           # Real-world testing scenarios
└── lib/                        # Build output (generated, don't edit)
```

### **Directory Responsibilities**

#### **`app/core/`** - Framework Core Implementation
- **Purpose**: Contains the implementation of the framework
- **Contains**: Classes, functions, and logic that make YinzerFlow work
- **Rule**: NO type definitions should be in core files - only implementation code
- **Pattern**: Import types from `@typedefs/`, implement functionality here
- **Subdirectories**:
  - **`execution/`** - Request/response handling implementation
  - **`setup/`** - Setup and routing implementation
  - **`modules/`** - Complex, self-contained features (see below)
  - **`utils/`** - Simple, focused utility functions
- **Examples**:
  - `YinzerFlow.ts` - Main framework class
  - `execution/RequestImpl.ts` - Request implementation
  - `utils/log.ts` - Logging utilities
  - `modules/rateLimit/` - Rate limiting module

#### **`app/core/modules/`** - Complex Features (Modules)
- **Purpose**: Self-contained features with multiple files and complex patterns
- **When to use**: Feature has multiple related files, uses design patterns, or has extensibility planned
- **Structure**: Each module has its own directory with implementation, tests, and strategies
- **Pattern**: Organize by feature (e.g., `rateLimit/`, `cache/`, `session/`)
- **Examples**:
  - `modules/rateLimit/RateLimiter.ts` - Main rate limiter class
  - `modules/rateLimit/hooks.ts` - Rate limiting hooks
  - `modules/rateLimit/strategies/` - Different rate limiting algorithms
  - `modules/rateLimit/__tests__/` - Module tests

#### **`app/core/utils/`** - Simple Utilities
- **Purpose**: Single-file, focused helper functions
- **When to use**: Pure functions, simple classes, no complex patterns
- **Pattern**: One file per utility, no subdirectories
- **Examples**:
  - `utils/log.ts` - Logging utilities
  - `utils/cors.ts` - CORS handling
  - `utils/time.ts` - Time conversion helpers
  - `utils/string.ts` - String manipulation helpers

#### **`app/typedefs/`** - All Type Definitions
- **Purpose**: Single source of truth for all types
- **Rule**: ALL types must be defined here, NEVER in core files
- **Subdirectories**:
  - **`public/`** - Types exported for framework users
    - Examples: `Configuration.d.ts`, `Request.d.ts`, `Response.d.ts`, `Context.d.ts`
    - Pattern: User-facing interfaces and types
    - Exported: YES (via index.ts)
  - **`internal/`** - Internal implementation types (not for users)
    - Examples: `InternalRequestImpl.d.ts`, `InternalConfiguration.d.ts`
    - Pattern: Prefixed with "Internal", used by framework code only
    - Exported: NO (only used internally)
    - **`modules/`** - Internal types for complex modules
      - Pattern: Mirror `core/modules/` structure
      - Example: `modules/rateLimit/index.d.ts` - All rate limit types in one file
      - When to use: When a module has multiple related type definitions (>3 types)
      - Benefit: Keeps module types organized and prevents type file sprawl
  - **`constants/`** - Type definitions for constants
    - Examples: `http.d.ts`, `log.d.ts`, `colors.d.ts`
    - Pattern: Types derived from constant values using `CreateEnum<typeof constant>`
    - Exported: NO (constants themselves are exported, not types)

#### **`app/constants/`** - Constant Values
- **Purpose**: All constant values
- **Rule**: ALL constants MUST be exported in `index.ts`
- **Pattern**: Use `as const` instead of enums
- **Export**: Users can access these constants as they're usually type-related
- **Examples**:
  - `http.ts` - HTTP status codes, methods, headers, content types
  - `log.ts` - Log levels
  - `colors.ts` - ANSI color codes

#### **`app/index.ts`** - Main Exports
- **Purpose**: Single entry point for all public JavaScript/runtime exports
- **Rule**: Only export what framework users need at runtime

### **Index File Export Standards**

#### **What to Export**
1. **Main framework class** - The YinzerFlow class
2. **Public helper functions** - Utilities users need (log, createLogger, rateLimit, etc.)
3. **All constants** - Users can access for type-related operations

#### **What NOT to Export**
- **NO types** - Build process (`build.ts`) handles all type definitions via `index.d.ts`
- **NO internal implementations** - Only public-facing functions
- **NO development utilities** - Testing helpers, internal tools, etc.

#### **Organization Pattern**

```typescript
// ============================================
// Main Framework Export
// ============================================
export { YinzerFlow } from '@core/YinzerFlow.ts';

// ============================================
// Public Helper Functions
// ============================================
// Logging utilities
export { log, createLogger } from '@core/utils/log.ts';

// Rate limiting hooks
export { rateLimit, skipRateLimit } from '@core/utils/rateLimitHooks.ts';

// ============================================
// Constants
// ============================================
// ANSI color codes for terminal output
export { colors } from '@constants/colors.ts';

// HTTP status codes and messages
export { httpStatus, httpStatusCode } from '@constants/http.ts';

// Logging levels
export { logLevels } from '@constants/log.ts';
```

#### **Why No Types?**
- The build process generates `lib/index.d.ts` from all `typedefs/public/` files
- This separation keeps runtime exports clean and focused
- TypeScript users get full type support automatically via declaration files
- Prevents confusion between runtime values and type definitions

## **Type System Rules**

### **Type Location Requirements**

1. **NEVER define types in core files** - All types go in `typedefs/`
2. **Import types in implementation files** - Use `import type` from `@typedefs/`
3. **Public vs Internal Types**:
   - **Public** (`typedefs/public/`): For framework users
   - **Internal** (`typedefs/internal/`): Prefixed with "Internal", for framework code only
4. **Constant Types** (`typedefs/constants/`): Generated from constant values

### **Utility Types - Use Existing Helpers**

**Critical**: Always analyze and leverage utility types from `@typedefs/internal/Generics.d.ts` before creating new types.

#### **Available Utility Types**

1. **`CreateEnum<T>`** - Creates union type from object values
   ```typescript
   // Use for constant types
   export type InternalHttpMethod = CreateEnum<typeof httpMethod>;
   ```

2. **`DeepPartial<T>`** - Makes all properties optional recursively
   ```typescript
   // Use for user-facing configuration types
   export type ServerOptions = DeepPartial<InternalServerOptions>;
   ```

3. **`InternalHandlerCallbackGenerics`** - Base interface for typed handlers
   ```typescript
   // Extend for type-safe request/response handling
   interface UserCreateRequest extends InternalHandlerCallbackGenerics {
     body: { name: string; email: string };
     response: { id: string; name: string };
   }
   ```

#### **When Creating Types**

- **First**: Check if a utility type exists that solves your need
- **Analyze**: Understand what the utility type does and how it transforms types
- **Leverage**: Use utility types to their full extent rather than manually typing
- **Don't duplicate**: Never recreate functionality that exists in `Generics.d.ts`
- **Extend carefully**: If extending utility types, maintain their purpose and patterns

### **Type Naming Conventions**

#### **Public Types** (in `typedefs/public/`)
- **No prefix**: Clean names for user-facing types
- **Examples**:
  - `ServerOptions` - User-facing config
  - `Request` - Request interface
  - `Response` - Response interface
  - `Context` - Context interface
  - `HandlerCallback` - Route handler type
  - `Logger` - Logger interface

#### **Internal Types** (in `typedefs/internal/`)
- **Prefix with "Internal"**: Distinguishes from public types
- **Examples**:
  - `InternalServerOptions` - Complete internal config
  - `InternalRequestImpl` - Request implementation interface
  - `InternalResponseImpl` - Response implementation interface
  - `InternalContextImpl` - Context implementation interface
  - `InternalHttpStatus` - HTTP status enum type
  - `InternalHttpStatusCode` - HTTP status code enum type

#### **Constant Types** (in `typedefs/constants/`)
- **Pattern**: Type derived from constant using `CreateEnum<typeof constant>`
- **Internal naming**: Use "Internal" prefix for these types too
- **Examples**:
  ```typescript
  // constants/http.ts
  export const httpStatus = { ok: 'OK', notFound: 'Not Found' } as const;

  // typedefs/constants/http.d.ts
  export type InternalHttpStatus = CreateEnum<typeof httpStatus>;
  ```

### **Type Usage Patterns**

#### **Implementation Files Pattern**:
```typescript
// In core/execution/RequestImpl.ts
import type { Request } from '@typedefs/public/Request.d.ts';
import type { InternalRequestImpl } from '@typedefs/internal/InternalRequestImpl.d.ts';
import type { InternalHttpMethod } from '@typedefs/constants/http.d.ts';

export class RequestImpl implements InternalRequestImpl {
  // Implementation using imported types
}
```

#### **Public API Pattern**:
```typescript
// In typedefs/public/Configuration.d.ts
import type { DeepPartial } from '@typedefs/internal/Generics.d.ts';
import type { InternalServerOptions } from '@typedefs/internal/InternalConfiguration.d.ts';

// User-facing type is DeepPartial of internal type
export type ServerOptions = DeepPartial<InternalServerOptions>;
```

#### **Constants Pattern**:
```typescript
// In constants/http.ts
export const httpStatusCode = {
  ok: 200,
  notFound: 404,
  internalServerError: 500,
} as const;

// In typedefs/constants/http.d.ts
import type { CreateEnum } from '@typedefs/internal/Generics.ts';
import type { httpStatusCode } from '@constants/http.ts';

export type InternalHttpStatusCode = CreateEnum<typeof httpStatusCode>;
```

## **Constants and Exports**

### **Constants Organization**

- **All constants in `app/constants/`**
- **Use `as const`** instead of enums for better type inference and tree-shaking
- **Pattern**: kebab-case for multi-word keys in objects
- **Export all constants** in `index.ts` - users can access them

### **Constant Naming**

- **camelCase**: Constant object names (e.g., `httpStatus`, `logLevels`, `colors`)
- **camelCase**: Object keys (e.g., `ok`, `notFound`, `internalServerError`)
- **Descriptive names**: Clear purpose without abbreviations

### **Example**:

```typescript
// constants/http.ts
export const httpStatusCode = {
  ok: 200,
  created: 201,
  badRequest: 400,
  notFound: 404,
  internalServerError: 500,
} as const;

export const httpMethod = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
} as const;
```

## **Coding Style Rules**

### **Hybrid Imperative-Modular Pattern**

- **Main functions orchestrate**: Call helper functions in clear, linear sequence
- **Helper functions focused**: Each does one thing exceptionally well
- **Avoid nested calls**: Prefer sequential execution over composition
- **Use for...of loops**: Never use forEach (causes stack trace issues)

### **Function Naming**

- **Public functions**: No prefix (e.g., `parseBody`, `validateRequest`)
- **Private helpers**: Underscore prefix (e.g., `_getData`, `_processData`)
- **Clear, descriptive names**: Function names should explain their purpose
- **No abbreviations**: Use full words for clarity

### **Example Structure**:

```typescript
// Public orchestration function
const parseRequestBody = async (rawBody: string, contentType: string) => {
  // Step 1: Validate content type
  const validType = _validateContentType(contentType);
  if (!validType) throw new Error('Invalid content type');

  // Step 2: Parse body
  const parsed = _parseBody(rawBody, contentType);

  // Step 3: Validate parsed data
  const validated = _validateParsedData(parsed);

  return validated;
};

// Private helper functions
const _validateContentType = (contentType: string): boolean => {
  // Focused validation logic
};

const _parseBody = (raw: string, type: string): unknown => {
  // Focused parsing logic
};

const _validateParsedData = (data: unknown): unknown => {
  // Focused validation logic
};
```

## **Naming Conventions**

### **File Naming**

- **Implementation files**: PascalCase for classes (e.g., `RequestImpl.ts`, `YinzerFlow.ts`)
- **Utility files**: camelCase for utility modules (e.g., `log.ts`, `cors.ts`, `string.ts`)
- **Type definition files**: PascalCase with `.d.ts` extension (e.g., `Request.d.ts`, `Configuration.d.ts`)
- **Constant files**: camelCase (e.g., `http.ts`, `log.ts`, `colors.ts`)
- **Test files**: Same as source with `__tests__/` folder (e.g., `__tests__/RequestImpl.test.ts`)

### **Variable and Function Naming**

- **camelCase**: Variables, functions, and methods
- **PascalCase**: Classes, interfaces, and types
- **NEVER use SCREAMING_SNAKE_CASE** (use camelCase constants with `as const`)
- **Boolean prefixes**: `is`, `has`, `can`, `should`

## **Documentation Standards**

### **TSDoc Comments**

- **All public APIs** must have comprehensive TSDoc comments
- **Include examples** for all public functions and classes
- **Security notes** when relevant
- **Performance notes** when relevant

### **Comment Structure**:

```typescript
/**
 * Brief description of what this does.
 *
 * Longer description with more context, explaining the purpose,
 * behavior, and any important details.
 *
 * ## Security Considerations
 *
 * Explain any security implications or protections.
 *
 * @template T - Generic parameter description
 * @param paramName - Parameter description with examples
 * @returns Description of return value
 * @throws Description of when/what errors are thrown
 *
 * @example
 * ```typescript
 * // Example usage
 * const result = functionName(params);
 * ```
 *
 * @see {@link RelatedType} for related information
 */
```

### **Documentation Files**

- **Follow documentation standards** from `.claude/rules/docs.md`
- **Include security sections** for any security-related features
- **Progressive examples**: Basic → Advanced → Real-world
- **Use 🛡️ emoji** for security features

## **Testing Conventions**

- **Follow testing standards** from `.claude/rules/tests.md`
- **Test files**: `__tests__/{SourceFile}.test.ts` next to source files
- **Real implementations**: Use real code, not mocks (except external dependencies like DB/Redis/APIs)
- **Type-safe**: When mocking external dependencies, ensure type safety

## **Security Guidelines**

### **Framework Security Responsibilities**

As a framework, YinzerFlow must provide secure defaults and protect users from common vulnerabilities:

- **Input validation**: Validate all user inputs with strict limits
- **Output encoding**: Prevent injection attacks
- **Rate limiting**: Built-in DoS protection (enabled by default)
- **CORS protection**: Secure cross-origin handling (disabled by default)
- **Header validation**: Automatic sanitization and size limits
- **Body parsing limits**: Protection against payload attacks
- **IP security**: Advanced IP validation and spoofing detection
- **Prototype pollution protection**: Secure JSON parsing

### **Security Documentation**

- **Always document security features** in public APIs
- **Use 🛡️ emoji** in documentation for security features
- **Explain the threat** and how YinzerFlow protects against it
- **Provide secure examples** showing best practices

## **Performance Guidelines**

### **Performance Principles**

- **Minimize allocations**: Reuse objects when possible
- **Avoid unnecessary parsing**: Parse only what's needed
- **Lazy evaluation**: Defer expensive operations until needed
- **Optimize hot paths**: Request/response handling must be fast
- **Benchmark changes**: Performance-critical code should be benchmarked

### **Performance Documentation**

- Document performance implications of configuration options
- Use Big O notation when discussing algorithmic complexity

## **Error Handling**

### **Error Messages**

- **Descriptive**: Clearly explain what went wrong
- **Actionable**: Tell users how to fix the problem
- **Pittsburgh personality**: Add wit when appropriate, but don't obscure the message
- **Include context**: Provide relevant details for debugging

### **Error Pattern**:

```typescript
// Good error message
throw new Error(
  `Invalid port configuration: ${port}. ` +
  `Port must be between 1 and 65535. ` +
  `Yinz might wanna check your config, n'at.`
);

// Bad error message
throw new Error('Invalid port');
```

## **Logging Conventions**

- **Use `log` utility** from `@core/utils/log.ts`
- **No console.log**: Never use console.log anywhere in framework code
- **Log levels**: error, warn, info, debug
- **Network logs**: Separate from application logs (nginx-style)

## **Remember**

- **This is a framework**: Every change affects developers using YinzerFlow
- **Types are separate**: Never put types in core files - use typedefs/
- **Use utility types**: Always check Generics.d.ts before creating new types
- **No types in index.ts**: Only export runtime values - build.ts handles type definitions
- **Export constants**: All constants should be exported in organized sections
- **Security first**: Provide secure defaults and protect users
- **Developer experience**: Clear APIs, helpful errors, great documentation
- **Performance matters**: Keep the framework lightweight and fast
- **Test thoroughly**: Framework bugs affect all users
- **Document everything**: Public APIs need comprehensive docs
