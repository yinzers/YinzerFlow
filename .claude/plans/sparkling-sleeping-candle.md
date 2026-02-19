# Plan: YinzerFlow Publish Script

## Context

YinzerFlow has a bare-bones `publish.sh` that just runs `npm publish` via Docker. No version bumping, no changelog, no git tagging, no validation. The user has a reference publish script in their WoW project (`~/development/wow/InventoryManagement/publish.sh`) with AI changelog generation, strict semver, git validation, and rollback — we're building the TypeScript equivalent for npm publishing.

**Current state**: Version 0.6.11, last git tag v0.1.6 (massive gap), no CHANGELOG.md, npm auth currently broken (both local and Docker).

---

## Create: `scripts/publish.ts`

Single-file TypeScript script, ~500-600 lines, zero external dependencies. Run via `bun scripts/publish.ts`.

### Flow

```
Pre-flight checks (13 validations)
        ↓
Version selection (patch/minor/major prompt)
        ↓
AI changelog generation (Claude API → fallback to raw commits)
        ↓
Confirmation summary (show everything, ask yes/no)
        ↓ mutations start here, rollback from here on failure
Bump version in package.json
        ↓
Write CHANGELOG.md (prepend new entry)
        ↓
Run `bun run build` (quality checks + compile + bundle validation)
        ↓
Verify lib/package.json has correct version
        ↓
Git commit (package.json + CHANGELOG.md only)
        ↓
Git tag (annotated, vX.Y.Z)
        ↓
Git push (commit + tags)
        ↓
npm publish (from lib/, --access public)
        ↓
GitHub release (optional, if `gh` available)
        ↓
Success summary with links
```

### Pre-flight Checks (all must pass before any mutations)

| # | Check | Failure action |
|---|-------|---------------|
| 1 | Inside git repo | Abort |
| 2 | On `main` branch | Abort |
| 3 | Clean working tree (no uncommitted/staged changes) | Abort |
| 4 | Fetch origin + not behind remote | Abort |
| 5 | No unpushed commits | Abort |
| 6 | `npm` CLI available | Abort |
| 7 | `npm whoami` succeeds (authenticated) | Abort with setup instructions |
| 8 | Current version not already on npm | Abort |
| 9 | `ANTHROPIC_API_KEY` set | Warn (non-fatal, falls back to raw commits) |

### Version Selection

Display current version + three valid bumps:
```
Current version: 0.6.11

  patch → 0.6.12  (bug fixes)
  minor → 0.7.0   (new features)
  major → 1.0.0   (breaking changes)
```

User types `patch`, `minor`, or `major`. No arbitrary version input.

### AI Changelog Generation

- Get commits since last tag: `git log v0.1.6..HEAD --format="- %s (%h)" --no-merges`
- Call Claude API (claude-haiku-4-5-20251001) via `fetch()` with system prompt that:
  - Filters for **user-facing framework changes only**
  - Ignores CI/CD, docs-only, internal refactors, .claude/ files, chore commits
  - Groups into: Breaking Changes / Features / Bug Fixes / Performance / Security
  - Returns `NO_USER_CHANGES` sentinel if nothing user-facing
- Fallback: If no API key or API fails, format raw commit list as changelog
- If sentinel returned: Extra confirmation required to proceed

### CHANGELOG.md Format

```markdown
# Changelog

All notable changes to YinzerFlow will be documented in this file.

## [0.6.12] - 2026-02-19

### Features
- Add comprehensive CORS middleware (c830e60)

### Bug Fixes
- Fix TCP stream reassembly for large POST bodies (abc1234)

## [0.6.11] - 2026-02-19
...
```

Create if doesn't exist, prepend new entry if it does.

### Git Commit

Commit exactly: `package.json` + `CHANGELOG.md`
```
🔧 chore(release): v0.6.12

Bump version to 0.6.12 and update changelog.
```

Tag: `git tag -a v0.6.12 -m "Release v0.6.12\n\n<changelog entry>"`

### npm Publish

```typescript
Bun.spawnSync({
  cmd: ['npm', 'publish', '--access', 'public'],
  cwd: `${process.cwd()}/lib`,
  stdio: ['inherit', 'inherit', 'inherit'],
});
```

### Rollback Strategy

Track mutations in a state object. On failure:
- **Before git push**: Restore package.json, restore/delete CHANGELOG.md, reset commit, delete tag
- **After git push**: Cannot auto-rollback — print manual fix commands for the user

### Confirmation Summary (shown before execution)

```
┌─────────────────────────────────────────┐
│  Package:  yinzerflow                   │
│  Version:  0.6.11 → 0.6.12             │
│  Tag:      v0.6.12                      │
│  Commits:  66 since v0.1.6              │
│                                         │
│  Changelog:                             │
│  ### Features                           │
│  - Add CORS middleware... (c830e60)     │
│  ...                                    │
│                                         │
│  Steps: bump → changelog → build →     │
│         commit → tag → push → publish   │
└─────────────────────────────────────────┘
```

---

## Modify: `package.json`

Add script entry:
```json
"publish:release": "bun scripts/publish.ts"
```

## Modify: `.npmignore`

Add `scripts/` to exclusions (don't publish the publish script to npm).

## Delete: `publish.sh`

Replaced by `scripts/publish.ts`.

---

## Implementation Details

- **Zero external deps**: `fetch()` for Claude API, `Bun.spawn`/`Bun.spawnSync` for shell, `Bun.file`/`Bun.write` for I/O
- **Arrow functions only** per project style
- **ANSI colors**: Semantic (green=success, red=error, yellow=warn, blue=info)
- **Interactive prompts**: Read from `process.stdin` via readline-style approach
- **First-run handling**: Large tag gap (v0.1.6 → v0.6.12) means 66 commits — AI will filter down to user-facing changes

---

## Verification

1. Run `bun scripts/publish.ts` — should pass all pre-flight checks (except npm auth which needs setup)
2. Test with `--dry-run` mindset: verify version suggestion display, changelog generation, confirmation summary
3. After npm auth is configured, do a real publish to verify end-to-end
