# YinzerFlow Project Rules

This is a **framework project** - every change affects developers using YinzerFlow.

## 📋 Quick Reference

- **Main Rules**: See `.claude/rules/rules.md` for complete project structure, type system, and coding conventions
- **Testing**: See `.claude/rules/tests.md` for testing standards (Bun test runner, integration-first approach)
- **Documentation**: See `.claude/rules/docs.md` for documentation standards and templates

## 🎯 Core Principles

1. **Framework First**: Every decision considers the developer experience of framework users
2. **Type Safety**: All types in `typedefs/`, never in core implementation files
3. **Security**: Built-in security with sensible defaults (rate limiting, input validation, etc.)
4. **Performance**: Lightweight and fast - optimize hot paths
5. **Developer Experience**: Clear APIs, helpful errors, Pittsburgh personality

## 🚨 Critical Rules

### Type System
- **NEVER** define types in `app/core/` files - ALL types go in `app/typedefs/`
- Use utility types from `Generics.d.ts` before creating new ones
- Public types: no prefix | Internal types: "Internal" prefix

### Code Organization
- **Implementation**: `app/core/` (classes, functions, logic)
- **Types**: `app/typedefs/` (public, internal, constants)
- **Constants**: `app/constants/` (all use `as const`, all exported)
- **Exports**: `app/index.ts` (runtime values only, NO types)

### Coding Style
- **Hybrid imperative-modular**: Main functions orchestrate, helpers are focused
- **Private helpers**: Use underscore prefix (`_helperFunction`)
- **Use for...of**: NEVER use forEach (causes stack trace issues)
- **No console.log**: Use `log` utility from `@core/utils/log.ts`

### Testing
- **Bun test runner**: Never use Jest or other frameworks
- **Integration-first**: Test real usage patterns, not implementation details
- **Real implementations**: Only mock external dependencies (DB, APIs, etc.)

### Documentation
- **TSDoc for public APIs**: Include examples, security notes, performance notes
- **Use 🛡️ emoji**: For security features with Problem/Solution format
- **Progressive examples**: Dev → Production configurations

## 📁 Project Structure

```
app/
├── core/           # Implementation (NO TYPES HERE)
│   ├── execution/  # Request/response handling
│   ├── setup/      # Setup and routing
│   ├── modules/    # Complex features (rateLimit, etc.)
│   ├── utils/      # Simple utilities (log, cors, time)
│   └── YinzerFlow.ts
├── typedefs/       # ALL TYPE DEFINITIONS
│   ├── public/     # Exported types (for users)
│   ├── internal/   # Internal types (prefixed "Internal")
│   └── constants/  # Constant types
├── constants/      # Constant values (all exported)
└── index.ts        # Runtime exports (NO TYPES)
```

## 🔍 Before Making Changes

1. **Read the detailed rules** in `.claude/rules/` for the specific area you're working on
2. **Investigate first**: Examine existing patterns before making changes
3. **Challenge assumptions**: Question and verify rather than assume
4. **Clean up**: Remove unused code when changing direction

## 🛡️ Security First

As a framework, we must protect users from common vulnerabilities:
- Input validation with strict limits
- Rate limiting (enabled by default)
- CORS protection (disabled by default, secure when enabled)
- Header validation and size limits
- Prototype pollution protection

## 📚 Full Documentation

For complete details on any topic, refer to:
- `.claude/rules/rules.md` - Complete project ruleset
- `.claude/rules/tests.md` - Testing standards and patterns
- `.claude/rules/docs.md` - Documentation standards and templates
