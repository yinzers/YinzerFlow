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

## 📝 Changelog

The changelog is written as changes land, not at release time.

- **Write your entry under `## [Unreleased]` in `CHANGELOG.md`, in the same commit as the change.** Put it in the matching subsection (Breaking Changes, Security, Features, Bug Fixes, Internal). Name the real API, say what changed from what to what, and file anything existing code relied on under Breaking Changes, even when it is a bug fix.
- **A machine enforces it.** `scripts/check-changelog.sh` (a `host-check` in `.claude/checks.conf`, quick tier) fails when non-test files under `app/` changed since the last `v*` tag, committed or not, and Unreleased has no bullet. Tests (`__tests__/`, `*.spec.ts`, `*.test.ts`) define what is not library code; they are not skipped from a check. Subsection headings alone do not count as an entry.
- **The release promotes it.** `scripts/publish.ts` renames Unreleased to the new version and date, adds a fresh empty Unreleased, and uses that text for the confirmation, the release commit and the GitHub release. No AI is involved. It refuses to run when Unreleased is empty.

## 🚀 Releasing

Run from the repo root on a clean, pushed `main`. Nothing needs installing on the host except Docker:

```
docker compose run --rm bun scripts/publish.ts
```

The `bun` compose service (`docker/release.Dockerfile`) has bun, Node/npm, git and ssh. It asks for the bump type and a final confirmation, then bumps, builds, tags, publishes to npm and pushes `main` with tags over your SSH key. Add `--dry-run` to stop after the confirmation screen with nothing changed.

- **`--ai-changelog` is the fallback**, for commits that landed without an entry: `docker compose run --rm bun scripts/publish.ts --ai-changelog`. With an empty Unreleased it drafts the entry with Claude (Sonnet) from the full commit messages and the docs lines added since the last tag, and is told to use only names found there. Read the draft on the confirmation screen; with entries already in Unreleased the flag is ignored.

- **npm login (once)**: if `npm whoami` fails the script runs `npm login` itself and prints a URL; open it in a browser on the host. The token lands in the named volume `yinzerflow-release-npm-config`, so later runs skip it. Log out with `docker volume rm yinzerflow-release-npm-config`.
- **`CLAUDE_API_KEY`**: needed only with `--ai-changelog`; a normal release never reads it. Export it in the shell you run the command from (`~/.bashrc`); compose passes it through.
- **Host files**: `~/.ssh` and `~/.gitconfig` are mounted read-only and must exist (compose errors rather than creating them). `~/.gitconfig` supplies the commit identity.
- **Dependencies**: if `node_modules` is missing the container runs `bun install --frozen-lockfile` first.

## 📚 Full Documentation

For complete details on any topic, refer to:
- `.claude/rules/rules.md` - Complete project ruleset
- `.claude/rules/tests.md` - Testing standards and patterns
- `.claude/rules/docs.md` - Documentation standards and templates
