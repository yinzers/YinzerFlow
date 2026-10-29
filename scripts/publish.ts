#!/usr/bin/env bun
/**
 * YinzerFlow Release Script
 *
 * Handles the full release pipeline: pre-flight checks (including quality gates and
 * bundle compilation), version bumping, changelog promotion, git tagging, and npm publish.
 *
 * The changelog is written as changes land, under "## [Unreleased]" in CHANGELOG.md. A release
 * promotes that section to the new version; no AI call is involved. scripts/check-changelog.sh
 * enforces that library changes come with an entry, and pre-flight refuses a release whose
 * Unreleased section is empty.
 *
 * Quality checks AND bundle compilation run BEFORE any mutations, so a TS/lint/test failure
 * never requires rollback.
 *
 * Usage: bun scripts/publish.ts [--ai-changelog] [--dry-run]
 *   --ai-changelog  Fallback for an empty Unreleased: draft the entry with Claude from the full
 *                   commit messages. Needs CLAUDE_API_KEY; without this flag the key is not read.
 *   --dry-run       Run pre-flight, pick a version and show the changelog, then stop before any
 *                   mutation (no bump, write, commit, tag, publish or push).
 */

import dts from 'bun-plugin-dts';
import { existsSync, mkdirSync } from 'node:fs';
import { addRelease, hasUnreleasedEntries, hasVersionHeading, promoteUnreleased } from './changelog.ts';

// ─── Arguments ──────────────────────────────────────────────────────────────────

const knownFlags = ['--ai-changelog', '--dry-run'];
const argv = process.argv.slice(2);
const unknownFlags = argv.filter((arg) => !knownFlags.includes(arg));
if (unknownFlags.length > 0) {
  console.error(`Unknown argument(s): ${unknownFlags.join(' ')}. Known: ${knownFlags.join(' ')}`);
  process.exit(1);
}
const aiChangelog = argv.includes('--ai-changelog');
const dryRun = argv.includes('--dry-run');

// Model for the --ai-changelog fallback. Sonnet, not Haiku: the draft has to stay faithful to
// full commit messages and migration details. Update when a newer Sonnet ships.
const AI_CHANGELOG_MODEL = 'claude-sonnet-5-5';

// Cap on docs diff text sent to the model, so a docs-heavy release does not blow the prompt.
const AI_DOCS_DIFF_LIMIT = 20_000;

// ─── ANSI Colors ────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

const log = {
  info: (msg: string) => console.log(`${c.blue}ℹ${c.reset} ${msg}`),
  success: (msg: string) => console.log(`${c.green}✓${c.reset} ${msg}`),
  warn: (msg: string) => console.log(`${c.yellow}⚠${c.reset} ${msg}`),
  error: (msg: string) => console.log(`${c.red}✗${c.reset} ${msg}`),
  step: (msg: string) => console.log(`\n${c.cyan}${c.bold}▸ ${msg}${c.reset}`),
  dim: (msg: string) => console.log(`${c.dim}  ${msg}${c.reset}`),
};

// ─── Shell Helpers ──────────────────────────────────────────────────────────────

const run = (cmd: string[], opts?: { cwd?: string }): { ok: boolean; stdout: string; stderr: string } => {
  // Bun.spawnSync throws when the executable isn't on PATH; report that as a failed run so
  // optional tools (gh) are skipped instead of aborting a release after it already published.
  let result: ReturnType<typeof Bun.spawnSync>;
  try {
    result = Bun.spawnSync(cmd, {
      cwd: opts?.cwd ?? process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    });
  } catch (err) {
    return { ok: false, stdout: '', stderr: err instanceof Error ? err.message : String(err) };
  }
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
};

const runInherit = (cmd: string[], opts?: { cwd?: string; env?: Record<string, string | undefined> }): boolean => {
  const result = Bun.spawnSync(cmd, {
    cwd: opts?.cwd ?? process.cwd(),
    env: opts?.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  return result.exitCode === 0;
};

// ─── Build Configuration ────────────────────────────────────────────────────────

const BUILD_CONFIG = {
  entrypoints: ['./app/index.ts'],
  outdir: './lib',
  target: 'node' as const,
  minify: true,
  sourcemap: 'external' as const,
  maxBundleSize: 150_000, // 150KB
  external: ['redis', 'ioredis', 'typescript'],
  distFiles: [
    { src: 'docs', dest: 'lib/docs', type: 'directory' as const },
    { src: 'CHANGELOG.md', dest: 'lib/CHANGELOG.md', type: 'file' as const },
    { src: 'LICENSE', dest: 'lib/LICENSE', type: 'file' as const },
    { src: 'README.md', dest: 'lib/README.md', type: 'file' as const },
    { src: 'package.json', dest: 'lib/package.json', type: 'file' as const },
  ],
} as const;

// ─── Interactive Prompt ─────────────────────────────────────────────────────────

const prompt = (question: string): Promise<string> => {
  process.stdout.write(`${c.yellow}?${c.reset} ${question} `);
  return new Promise((resolve) => {
    let data = '';
    const onData = (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        resolve(data.trim());
      }
    };
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
};

const confirm = async (question: string): Promise<boolean> => {
  const answer = await prompt(`${question} (y/n)`);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
};

// ─── Version Helpers ────────────────────────────────────────────────────────────

type BumpType = 'patch' | 'minor' | 'major';

const bumpVersion = (current: string, type: BumpType): string => {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
  }
};

// ─── Rollback State ─────────────────────────────────────────────────────────────

interface RollbackState {
  originalPackageJson: string | null;
  originalChangelog: string | null;
  changelogExisted: boolean;
  commitCreated: boolean;
  tagCreated: string | null;
  pushed: boolean;
}

const rollbackState: RollbackState = {
  originalPackageJson: null,
  originalChangelog: null,
  changelogExisted: false,
  commitCreated: false,
  tagCreated: null,
  pushed: false,
};

const rollback = async (): Promise<void> => {
  log.step('Rolling back mutations...');

  if (rollbackState.pushed) {
    log.error('Changes were already pushed. Manual rollback required:');
    if (rollbackState.tagCreated) {
      log.dim(`  git push --delete origin ${rollbackState.tagCreated}`);
      log.dim(`  git tag -d ${rollbackState.tagCreated}`);
    }
    log.dim('  git revert HEAD');
    log.dim('  git push');
    return;
  }

  if (rollbackState.tagCreated) {
    run(['git', 'tag', '-d', rollbackState.tagCreated]);
    log.dim(`Deleted tag ${rollbackState.tagCreated}`);
  }

  if (rollbackState.commitCreated) {
    run(['git', 'reset', '--soft', 'HEAD~1']);
    log.dim('Reset last commit');
  }

  // Unstage everything
  run(['git', 'reset', 'HEAD', '.']);

  if (rollbackState.originalPackageJson) {
    await Bun.write('package.json', rollbackState.originalPackageJson);
    log.dim('Restored package.json');
  }

  if (rollbackState.changelogExisted && rollbackState.originalChangelog) {
    await Bun.write('CHANGELOG.md', rollbackState.originalChangelog);
    log.dim('Restored CHANGELOG.md');
  } else if (!rollbackState.changelogExisted) {
    const { existsSync, unlinkSync } = await import('node:fs');
    if (existsSync('CHANGELOG.md')) {
      unlinkSync('CHANGELOG.md');
      log.dim('Removed CHANGELOG.md (did not exist before)');
    }
  }

  log.success('Rollback complete');
};

// ─── Pre-flight Checks ─────────────────────────────────────────────────────────

interface PreflightResult {
  currentVersion: string;
  lastTag: string;
  commitCount: number;
  packageName: string;
}

const preflight = async (): Promise<PreflightResult> => {
  log.step('Running pre-flight checks');
  let passed = 0;
  // The API key check only exists (and only counts) with --ai-changelog; the changelog check always does.
  const total = aiChangelog ? 12 : 11;

  // 1. Inside git repo
  const gitCheck = run(['git', 'rev-parse', '--is-inside-work-tree']);
  if (!gitCheck.ok) {
    log.error('Not inside a git repository');
    process.exit(1);
  }
  log.success(`[${++passed}/${total}] Inside git repo`);

  // 2. On main branch
  const branch = run(['git', 'rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch.stdout !== 'main') {
    log.error(`Must be on 'main' branch (currently on '${branch.stdout}')`);
    process.exit(1);
  }
  log.success(`[${++passed}/${total}] On main branch`);

  // 3. Clean working tree
  const status = run(['git', 'status', '--porcelain']);
  if (status.stdout !== '') {
    log.error('Working tree is not clean. Commit or stash changes first.');
    log.dim(status.stdout);
    process.exit(1);
  }
  log.success(`[${++passed}/${total}] Clean working tree`);

  // 4. Fetch origin + not behind remote
  const fetch = run(['git', 'fetch', 'origin', 'main']);
  if (!fetch.ok) {
    log.error('Failed to fetch from origin');
    process.exit(1);
  }
  const behind = run(['git', 'rev-list', '--count', 'HEAD..origin/main']);
  if (behind.stdout !== '0') {
    log.error(`Local branch is ${behind.stdout} commit(s) behind origin/main. Pull first.`);
    process.exit(1);
  }
  log.success(`[${++passed}/${total}] Up to date with origin/main`);

  // 5. No unpushed commits
  const ahead = run(['git', 'rev-list', '--count', 'origin/main..HEAD']);
  if (ahead.stdout !== '0') {
    log.error(`${ahead.stdout} unpushed commit(s). Push before publishing.`);
    process.exit(1);
  }
  log.success(`[${++passed}/${total}] No unpushed commits`);

  // 6. npm CLI available
  const npmCheck = run(['npm', '--version']);
  if (!npmCheck.ok) {
    log.error('npm CLI not found');
    process.exit(1);
  }
  log.success(`[${++passed}/${total}] npm v${npmCheck.stdout}`);

  // 7. npm authenticated (interactive login if needed)
  let whoami = run(['npm', 'whoami']);
  if (!whoami.ok) {
    log.warn('Not authenticated with npm. Launching npm login...');
    const loginOk = runInherit(['npm', 'login'], { env: { ...process.env, BROWSER: '' } });
    if (!loginOk) {
      log.error('npm login failed');
      process.exit(1);
    }
    whoami = run(['npm', 'whoami']);
    if (!whoami.ok) {
      log.error('Still not authenticated after login attempt');
      process.exit(1);
    }
  }
  log.success(`[${++passed}/${total}] npm authenticated as ${whoami.stdout}`);

  // 8. Quality checks (lint, tests, formatting, spelling, unused packages)
  log.dim('Running quality checks (this may take a moment)...');
  const qualityChecks = [
    { cmd: ['bun', 'run', 'find-unused-packages'], name: 'Unused packages' },
    { cmd: ['bun', 'run', 'lint'], name: 'Linter' },
    { cmd: ['bun', 'run', 'lint:format'], name: 'Code formatting' },
    { cmd: ['bun', 'run', 'lint:spelling'], name: 'Spelling' },
    { cmd: ['bun', 'run', 'test:production'], name: 'Tests' },
  ];
  for (const { cmd, name } of qualityChecks) {
    if (!runInherit(cmd)) {
      log.error(`Quality check failed: ${name}`);
      process.exit(1);
    }
  }
  log.success(`[${++passed}/${total}] Quality checks passed`);

  // 8b. Compile bundle (catches TS errors before AI credits are spent)
  log.dim('Compiling bundle (type-check + build)...');
  run(['rm', '-rf', 'lib']);
  mkdirSync('lib');
  await Bun.build({
    entrypoints: [...BUILD_CONFIG.entrypoints],
    outdir: BUILD_CONFIG.outdir,
    target: BUILD_CONFIG.target,
    minify: BUILD_CONFIG.minify,
    sourcemap: BUILD_CONFIG.sourcemap,
    external: [...BUILD_CONFIG.external],
    plugins: [
      dts({
        output: {
          noBanner: true,
          exportReferencedTypes: true,
        },
      }),
    ],
  });
  const preBundleSize = Bun.file('lib/index.js').size;
  if (preBundleSize > BUILD_CONFIG.maxBundleSize) {
    const sizeKB = Math.round(preBundleSize / 1024);
    const maxSizeKB = Math.round(BUILD_CONFIG.maxBundleSize / 1024);
    log.error(`Bundle size ${sizeKB}KB exceeds ${maxSizeKB}KB limit`);
    process.exit(1);
  }
  log.success(`[${++passed}/${total}] Bundle compiles (${Math.round(preBundleSize / 1024)}KB)`);

  // Read package.json
  const pkgJson = await Bun.file('package.json').text();
  const pkg = JSON.parse(pkgJson);
  const currentVersion = pkg.version as string;
  const packageName = pkg.name as string;

  // 9. Anthropic API key (only for --ai-changelog)
  if (aiChangelog) {
    if (process.env.CLAUDE_API_KEY) {
      log.success(`[${++passed}/${total}] Anthropic API key found (--ai-changelog)`);
    } else {
      log.error(`[${++passed}/${total}] --ai-changelog needs CLAUDE_API_KEY — set it in ~/.bashrc: export CLAUDE_API_KEY=sk-ant-...`);
      process.exit(1);
    }
  }

  // Get last PUBLISHED tag — walk back through git tags to find one actually on npm.
  // This handles aborted publishes where git tag exists but npm publish never ran.
  const allTagsResult = run(['git', 'tag', '--sort=-v:refname']);
  const allTags = allTagsResult.ok ? allTagsResult.stdout.split('\n').filter(Boolean) : [];
  let lastTag = '';
  for (const tag of allTags) {
    const version = tag.replace(/^v/, '');
    const npmCheck = run(['npm', 'view', `${packageName}@${version}`, 'version']);
    if (npmCheck.ok && npmCheck.stdout === version) {
      lastTag = tag;
      break;
    }
    log.dim(`Tag ${tag} not published to npm — skipping`);
  }

  let commitCount = 0;
  if (lastTag) {
    const countResult = run(['git', 'rev-list', '--count', `${lastTag}..HEAD`]);
    commitCount = parseInt(countResult.stdout, 10) || 0;
  } else {
    const countResult = run(['git', 'rev-list', '--count', 'HEAD']);
    commitCount = parseInt(countResult.stdout, 10) || 0;
  }

  // 9b. Changelog: Unreleased has entries to promote, or --ai-changelog will draft them
  const changelogFile = Bun.file('CHANGELOG.md');
  const changelogText = (await changelogFile.exists()) ? await changelogFile.text() : '';
  if (hasUnreleasedEntries(changelogText)) {
    log.success(`[${++passed}/${total}] Unreleased has entries to promote`);
    if (aiChangelog) log.warn('--ai-changelog ignored: Unreleased has entries, so they are promoted as written');
  } else if (aiChangelog) {
    log.warn(`[${++passed}/${total}] Unreleased is empty — the changelog will be drafted by AI from commit messages`);
  } else {
    // The same check green-check runs, so a commit that landed without the gate is caught here.
    const gate = run(['sh', 'scripts/check-changelog.sh']);
    log.error('CHANGELOG.md has no entries under "## [Unreleased]", so there is nothing to release.');
    if (!gate.ok) log.dim(gate.stderr);
    log.dim('Write the entries under Unreleased and commit them, or run with --ai-changelog to draft from commits.');
    process.exit(1);
  }

  // 10. Docs staleness check
  const docsRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const docsChanged = run(['git', 'diff', '--name-only', docsRange, '--', 'docs/']);
  if (docsChanged.stdout === '') {
    log.warn(`[${++passed}/${total}] No changes in docs/ since ${lastTag || 'beginning'}`);
    const skipDocs = await confirm('No documentation updates found. Continue anyway?');
    if (!skipDocs) {
      log.info('Aborted. Update docs/ and try again.');
      process.exit(0);
    }
  } else {
    log.success(`[${++passed}/${total}] Documentation updated`);
  }

  console.log('');
  log.success(`All checks passed! (${packageName}@${currentVersion}, ${commitCount} commits since ${lastTag || 'beginning'})`);

  return { currentVersion, lastTag, commitCount, packageName };
};

// ─── Version Selection ──────────────────────────────────────────────────────────

const selectVersion = async (currentVersion: string): Promise<{ type: BumpType; newVersion: string }> => {
  log.step('Select version bump');

  const patch = bumpVersion(currentVersion, 'patch');
  const minor = bumpVersion(currentVersion, 'minor');
  const major = bumpVersion(currentVersion, 'major');

  console.log(`\n  Current version: ${c.bold}${currentVersion}${c.reset}\n`);
  console.log(`  ${c.green}patch${c.reset} → ${c.bold}${patch}${c.reset}  ${c.dim}(bug fixes)${c.reset}`);
  console.log(`  ${c.yellow}minor${c.reset} → ${c.bold}${minor}${c.reset}  ${c.dim}(new features)${c.reset}`);
  console.log(`  ${c.red}major${c.reset} → ${c.bold}${major}${c.reset}  ${c.dim}(breaking changes)${c.reset}`);
  console.log('');

  while (true) {
    const answer = await prompt('Bump type (patch/minor/major):');
    const normalized = answer.toLowerCase().trim();
    if (normalized === 'patch' || normalized === 'minor' || normalized === 'major') {
      const newVersion = bumpVersion(currentVersion, normalized);
      return { type: normalized, newVersion };
    }
    log.warn('Please enter: patch, minor, or major');
  }
};

// ─── Changelog Generation ───────────────────────────────────────────────────────

type ChangelogSource = 'unreleased' | 'ai' | 'raw';

interface ChangelogPlan {
  /** Full release entry, `## [version] - date` header included. */
  entry: string;
  /** The entry without its header: GitHub release notes and the release commit body. */
  body: string;
  /** What CHANGELOG.md will contain after the release. */
  nextContent: string;
  source: ChangelogSource;
  noUserChanges: boolean;
}

const _today = (): string => new Date().toISOString().split('T')[0];

/** Full commit messages (subject AND body: the bodies carry the decision and the why). */
const getCommitsSinceTag = (lastTag: string): string => {
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const result = run(['git', 'log', range, '--format=### commit %h%n%B', '--no-merges']);
  return result.stdout;
};

const getRawCommitList = (lastTag: string): string => {
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  return run(['git', 'log', range, '--format=- %s (%h)', '--no-merges']).stdout;
};

/** Added lines of docs/ since the last tag: where the behavior-change notes for a release live. */
const getDocsAdditions = (lastTag: string): string => {
  if (!lastTag) return '';
  const diff = run(['git', 'diff', '--unified=0', `${lastTag}..HEAD`, '--', 'docs/']).stdout;
  const added = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .join('\n');
  return added.length > AI_DOCS_DIFF_LIMIT ? `${added.slice(0, AI_DOCS_DIFF_LIMIT)}\n[truncated]` : added;
};

const _rawPlan = (current: string, rawCommits: string, newVersion: string, noUserChanges: boolean): ChangelogPlan => {
  const entry = `## [${newVersion}] - ${_today()}\n\n${rawCommits}`;
  return { entry, body: rawCommits, nextContent: addRelease(current, entry), source: 'raw', noUserChanges };
};

const AI_SYSTEM_PROMPT = `You write the changelog entry for a release of YinzerFlow, a lightweight HTTP server framework for Node.js/Bun. The readers are developers who use the framework, deciding whether and how to upgrade.

Sources you get: the full commit messages since the last release (subject and body) and the lines added to docs/ in the same range. Commit bodies carry the decision and the reason; use them.

Hard rules:
- NEVER invent APIs, options, flags, functions, types, status codes or behavior. Use only names that appear in the commit messages or the added docs lines. If a detail is not in the sources, leave it out.
- Anything that changes behavior existing code relied on is a Breaking Change, even when the commit calls it a fix. Say what changed from what to what.
- Include all meaningful changes, user-facing and internal. Ignore version bumps, .claude/ changes, CI tweaks and trivial formatting.
- Group into these sections, in this order, only the ones with entries:
  ### Breaking Changes
  ### Security
  ### Features
  ### Bug Fixes
  ### Internal
- Breaking Changes: add a short fenced code snippet showing old to new only when the sources show both.
- Bug Fixes: say what was broken and how it behaves now, not just "fixed X".
- Each entry: "- **Short title** — description (commit_hash)", with the short hash from the sources.
- If there are absolutely NO meaningful changes, respond with exactly: NO_USER_CHANGES
- Do NOT include a version header; it is added for you.`;

/** The --ai-changelog fallback, used only when Unreleased is empty. */
const draftChangelogWithAi = async (current: string, lastTag: string, newVersion: string): Promise<ChangelogPlan> => {
  log.step('Drafting changelog with AI (--ai-changelog)');
  const rawCommits = getRawCommitList(lastTag);
  const commits = getCommitsSinceTag(lastTag);
  const docsAdditions = getDocsAdditions(lastTag);
  log.dim(`Calling ${AI_CHANGELOG_MODEL}...`);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CHANGELOG_MODEL,
        max_tokens: 4096,
        system: AI_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content:
              `Full commit messages since ${lastTag || 'the beginning'}:\n\n${commits}` +
              (docsAdditions ? `\n\nLines added to docs/ in the same range (behavior-change notes):\n\n${docsAdditions}` : ''),
          },
        ],
      }),
    });

    if (!response.ok) {
      log.warn(`Claude API returned ${response.status}: ${await response.text()}`);
      log.dim('Falling back to raw commit list');
      return _rawPlan(current, rawCommits, newVersion, false);
    }

    const data = (await response.json()) as { content: Array<{ text: string }> };
    const text = data.content[0]?.text?.trim() ?? '';

    if (text === 'NO_USER_CHANGES') {
      log.warn('AI determined no user-facing changes in these commits');
      return _rawPlan(current, rawCommits, newVersion, true);
    }

    const entry = `## [${newVersion}] - ${_today()}\n\n${text}`;
    log.success('AI changelog drafted. Review it below: names come from commits, but you are the check.');
    return { entry, body: text, nextContent: addRelease(current, entry), source: 'ai', noUserChanges: false };
  } catch (err) {
    log.warn(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`);
    log.dim('Falling back to raw commit list');
    return _rawPlan(current, rawCommits, newVersion, false);
  }
};

/** Pure: no AI, no writes. Promotes the Unreleased section for `newVersion`. */
const planPromotion = (current: string, newVersion: string): ChangelogPlan => {
  const { content, entry, body } = promoteUnreleased(current, newVersion, _today());
  return { entry, body, nextContent: content, source: 'unreleased', noUserChanges: false };
};

// ─── CHANGELOG.md Writer ────────────────────────────────────────────────────────

/** Writes the planned CHANGELOG.md. The original is recorded first so rollback can restore it. */
const writeChangelog = async (nextContent: string): Promise<void> => {
  const file = Bun.file('CHANGELOG.md');
  rollbackState.changelogExisted = await file.exists();
  rollbackState.originalChangelog = rollbackState.changelogExisted ? await file.text() : null;
  await Bun.write('CHANGELOG.md', nextContent);
  log.success('CHANGELOG.md updated');
};

// ─── Confirmation UI ────────────────────────────────────────────────────────────

const showConfirmation = (opts: {
  packageName: string;
  currentVersion: string;
  newVersion: string;
  commitCount: number;
  lastTag: string;
  changelog: string;
  source: ChangelogSource;
}): void => {
  const border = `${c.dim}─${c.reset}`;
  const line = border.repeat(50);

  console.log(`\n${line}`);
  console.log(`  ${c.bold}Package:${c.reset}  ${opts.packageName}`);
  console.log(`  ${c.bold}Version:${c.reset}  ${opts.currentVersion} → ${c.green}${c.bold}${opts.newVersion}${c.reset}`);
  console.log(`  ${c.bold}Tag:${c.reset}      v${opts.newVersion}`);
  console.log(`  ${c.bold}Commits:${c.reset}  ${opts.commitCount} since ${opts.lastTag || 'beginning'}`);
  const sourceLabel = {
    unreleased: `${c.green}promoted from Unreleased${c.reset}`,
    ai: `${c.yellow}AI draft (--ai-changelog)${c.reset}`,
    raw: `${c.yellow}raw commits${c.reset}`,
  }[opts.source];
  console.log(`  ${c.bold}Changelog:${c.reset} ${sourceLabel}`);
  console.log('');
  console.log('');

  // Indent changelog preview
  const previewLines = opts.changelog.split('\n').slice(0, 20);
  for (const line of previewLines) {
    console.log(`  ${c.dim}│${c.reset} ${line}`);
  }
  if (opts.changelog.split('\n').length > 20) {
    console.log(`  ${c.dim}│ ... (truncated)${c.reset}`);
  }

  console.log('');
  console.log(`  ${c.bold}Steps:${c.reset} bump → changelog → rebuild → commit → tag → publish → push`);
  console.log(line);
};

// ─── Mutation Steps ─────────────────────────────────────────────────────────────

const bumpPackageVersion = async (newVersion: string): Promise<void> => {
  const pkgText = await Bun.file('package.json').text();
  rollbackState.originalPackageJson = pkgText;

  const pkg = JSON.parse(pkgText);
  pkg.version = newVersion;
  await Bun.write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  log.success(`package.json bumped to ${newVersion}`);
};

const verifyLibVersion = async (newVersion: string): Promise<void> => {
  const libPkg = await Bun.file('lib/package.json').json();
  if (libPkg.version !== newVersion) {
    throw new Error(`lib/package.json has version ${libPkg.version}, expected ${newVersion}`);
  }
  log.success(`lib/package.json version verified: ${newVersion}`);
};

const gitCommitAndTag = (newVersion: string, changelogEntry: string, changelogBody: string): void => {
  const tag = `v${newVersion}`;
  const commitMsg = `🔖 release: v${newVersion}\n\nBump version to ${newVersion}; the changelog entry below was promoted from Unreleased.\n\n${changelogBody}`;

  // Stage only the two files we changed
  const addResult = run(['git', 'add', 'package.json', 'CHANGELOG.md']);
  if (!addResult.ok) {
    throw new Error(`git add failed: ${addResult.stderr}`);
  }

  // Commit
  const commitResult = run(['git', 'commit', '-m', commitMsg]);
  if (!commitResult.ok) {
    throw new Error(`git commit failed: ${commitResult.stderr}`);
  }
  rollbackState.commitCreated = true;
  log.success(`Committed: release v${newVersion}`);

  // Tag
  const tagMsg = `Release v${newVersion}\n\n${changelogEntry}`;
  const tagResult = run(['git', 'tag', '-a', tag, '-m', tagMsg]);
  if (!tagResult.ok) {
    throw new Error(`git tag failed: ${tagResult.stderr}`);
  }
  rollbackState.tagCreated = tag;
  log.success(`Tagged: ${tag}`);
};

const gitPush = (): void => {
  log.dim('Pushing commit and tags to origin...');
  const pushResult = run(['git', 'push', 'origin', 'main', '--follow-tags']);
  if (!pushResult.ok) {
    throw new Error(`git push failed: ${pushResult.stderr}`);
  }
  rollbackState.pushed = true;
  log.success('Pushed to origin/main');
};

const npmPublish = (): void => {
  log.dim('Publishing to npm from lib/...');
  const ok = runInherit(['npm', 'publish', '--access', 'public'], { cwd: `${process.cwd()}/lib` });
  if (!ok) {
    throw new Error('npm publish failed');
  }
  log.success('Published to npm');
};

const createGithubRelease = (newVersion: string, releaseNotes: string, packageName: string): void => {
  const ghCheck = run(['gh', '--version']);
  if (!ghCheck.ok) {
    log.dim('gh CLI not found — skipping GitHub release');
    return;
  }

  log.dim('Creating GitHub release...');
  const tag = `v${newVersion}`;
  const result = run([
    'gh', 'release', 'create', tag,
    '--title', `${packageName} ${tag}`,
    '--notes', releaseNotes,
  ]);

  if (result.ok) {
    log.success(`GitHub release created: ${tag}`);
  } else {
    log.warn(`GitHub release failed (non-fatal): ${result.stderr}`);
  }
};

// ─── Main ───────────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  console.log(`\n${c.bold}${c.cyan}  YinzerFlow Release${c.reset}\n`);

  // ── Pre-flight ──
  const { currentVersion, lastTag, commitCount, packageName } = await preflight();

  if (commitCount === 0) {
    log.warn('No commits since last tag. Nothing to release.');
    process.exit(0);
  }

  // ── Version selection ──
  const { type, newVersion } = await selectVersion(currentVersion);

  // ── Verify new version isn't already on npm ──
  const npmView = run(['npm', 'view', `${packageName}@${newVersion}`, 'version']);
  if (npmView.ok && npmView.stdout === newVersion) {
    log.error(`Version ${newVersion} is already published on npm`);
    process.exit(1);
  }
  log.success(`${newVersion} is available on npm`);

  // ── Changelog plan (promotion, or the --ai-changelog fallback; preflight guaranteed one of them) ──
  log.step('Preparing changelog');
  const currentChangelog = (await Bun.file('CHANGELOG.md').exists()) ? await Bun.file('CHANGELOG.md').text() : '';
  if (hasVersionHeading(currentChangelog, newVersion)) {
    log.error(`CHANGELOG.md already has a "## [${newVersion}]" heading. Pick another version or fix the file.`);
    process.exit(1);
  }
  const plan = hasUnreleasedEntries(currentChangelog)
    ? planPromotion(currentChangelog, newVersion)
    : await draftChangelogWithAi(currentChangelog, lastTag, newVersion);
  const { entry: changelog, body: releaseNotes, nextContent, source, noUserChanges } = plan;

  if (noUserChanges) {
    const proceed = await confirm('AI found no user-facing changes. Publish anyway?');
    if (!proceed) {
      log.info('Aborted.');
      process.exit(0);
    }
  }

  // ── Confirmation ──
  showConfirmation({
    packageName,
    currentVersion,
    newVersion,
    commitCount,
    lastTag,
    changelog,
    source,
  });

  if (dryRun) {
    log.info('Dry run: stopping before any change (no bump, CHANGELOG write, commit, tag, publish or push).');
    process.exit(0);
  }

  const confirmed = await confirm(`Publish ${packageName}@${newVersion}?`);
  if (!confirmed) {
    log.info('Aborted.');
    process.exit(0);
  }

  // ── Mutations (rollback from here on failure) ──
  // Catch ctrl+c during mutations to trigger rollback
  const sigintHandler = async () => {
    console.log('');
    log.error('Interrupted during release — rolling back...');
    await rollback();
    process.exit(1);
  };
  process.on('SIGINT', sigintHandler);

  try {
    log.step('Executing release');

    // 1. Bump version
    await bumpPackageVersion(newVersion);

    // 2. Write changelog
    await writeChangelog(nextContent);

    // 3. Rebuild bundle (source already verified in preflight — rebuild for clean lib/)
    log.dim('Rebuilding bundle...');
    run(['rm', '-rf', 'lib']);
    mkdirSync('lib');
    await Bun.build({
      entrypoints: [...BUILD_CONFIG.entrypoints],
      outdir: BUILD_CONFIG.outdir,
      target: BUILD_CONFIG.target,
      minify: BUILD_CONFIG.minify,
      sourcemap: BUILD_CONFIG.sourcemap,
      external: [...BUILD_CONFIG.external],
      plugins: [
        dts({
          output: {
            noBanner: true,
            exportReferencedTypes: true,
          },
        }),
      ],
    });
    log.success('Bundle compiled');

    log.dim('Copying distribution files...');
    for (const { src, dest, type } of BUILD_CONFIG.distFiles) {
      if (type === 'directory') {
        if (!existsSync(dest)) run(['mkdir', '-p', dest]);
        run(['sh', '-c', `cp -R ${src}/* ${dest}/ 2>/dev/null || true`]);
        run(['sh', '-c', `rm -rf ${dest}/node_modules ${dest}/bun.lock ${dest}/storage ${dest}/.gitignore 2>/dev/null || true`]);
      } else {
        const result = run(['cp', src, dest]);
        if (!result.ok) log.warn(`Could not copy ${src} to ${dest}`);
      }
    }
    log.success('Distribution files copied');

    // 4. Verify lib/package.json has correct version
    await verifyLibVersion(newVersion);

    // 5. Git commit + tag (local only — not pushed yet)
    gitCommitAndTag(newVersion, changelog, releaseNotes);

    // 6. npm publish FIRST — if this fails, we can still rollback local commit+tag
    npmPublish();

    // 7. Git push (only after npm succeeds — once pushed, rollback is manual)
    gitPush();

    // 8. GitHub release (optional)
    createGithubRelease(newVersion, releaseNotes, packageName);

    // ── Success — remove SIGINT handler ──
    process.removeListener('SIGINT', sigintHandler);
    console.log(`\n${c.green}${c.bold}  Release complete!${c.reset}\n`);
    console.log(`  ${c.bold}npm:${c.reset}    https://www.npmjs.com/package/${packageName}/v/${newVersion}`);
    console.log(`  ${c.bold}git:${c.reset}    v${newVersion}`);

    const ghCheck = run(['gh', '--version']);
    if (ghCheck.ok) {
      const repoResult = run(['gh', 'repo', 'view', '--json', 'url', '-q', '.url']);
      if (repoResult.ok) {
        console.log(`  ${c.bold}github:${c.reset} ${repoResult.stdout}/releases/tag/v${newVersion}`);
      }
    }

    console.log('');
  } catch (err) {
    log.error(`Release failed: ${err instanceof Error ? err.message : String(err)}`);
    await rollback();
    process.exit(1);
  }
};

await main();
