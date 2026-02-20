#!/usr/bin/env bun
/**
 * YinzerFlow Release Script
 *
 * Handles the full release pipeline: pre-flight checks (including quality gates),
 * version bumping, AI changelog generation, bundle compilation, git tagging, and npm publish.
 *
 * Quality checks (lint, tests, spelling, etc.) run BEFORE any mutations, so a failure
 * never requires rollback. Only bundle compilation, git, and npm steps can trigger rollback.
 *
 * Usage: bun scripts/publish.ts
 */

import dts from 'bun-plugin-dts';
import { existsSync, mkdirSync } from 'node:fs';

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
  const result = Bun.spawnSync(cmd, {
    cwd: opts?.cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
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
  maxBundleSize: 100_000, // 100KB
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
  hasApiKey: boolean;
  packageName: string;
}

const preflight = async (): Promise<PreflightResult> => {
  log.step('Running pre-flight checks');
  let passed = 0;
  const total = 9;
  let hasApiKey = false;

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

  // Read package.json
  const pkgJson = await Bun.file('package.json').text();
  const pkg = JSON.parse(pkgJson);
  const currentVersion = pkg.version as string;
  const packageName = pkg.name as string;

  // 9. Anthropic API key (required for AI changelog)
  if (process.env.CLAUDE_API_KEY) {
    hasApiKey = true;
    log.success(`[${++passed}/${total}] Anthropic API key found`);
  } else {
    log.error(`[${++passed}/${total}] Missing CLAUDE_API_KEY — set it in ~/.bashrc: export CLAUDE_API_KEY=sk-ant-...`);
    process.exit(1);
  }

  // Get last tag and commit count
  const lastTagResult = run(['git', 'describe', '--tags', '--abbrev=0']);
  const lastTag = lastTagResult.ok ? lastTagResult.stdout : '';

  let commitCount = 0;
  if (lastTag) {
    const countResult = run(['git', 'rev-list', '--count', `${lastTag}..HEAD`]);
    commitCount = parseInt(countResult.stdout, 10) || 0;
  } else {
    const countResult = run(['git', 'rev-list', '--count', 'HEAD']);
    commitCount = parseInt(countResult.stdout, 10) || 0;
  }

  console.log('');
  log.success(`All checks passed! (${packageName}@${currentVersion}, ${commitCount} commits since ${lastTag || 'beginning'})`);

  return { currentVersion, lastTag, commitCount, hasApiKey, packageName };
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

// ─── AI Changelog Generation ────────────────────────────────────────────────────

const getCommitsSinceTag = (lastTag: string): string => {
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const result = run(['git', 'log', range, '--format=- %s (%h)', '--no-merges']);
  return result.stdout;
};

const generateChangelog = async (
  commits: string,
  newVersion: string,
  hasApiKey: boolean,
): Promise<{ changelog: string; aiGenerated: boolean; noUserChanges: boolean }> => {
  log.step('Generating changelog');

  if (!hasApiKey) {
    log.dim('No API key — using raw commit list');
    return { changelog: formatRawChangelog(commits, newVersion), aiGenerated: false, noUserChanges: false };
  }

  log.dim('Calling Claude API for intelligent changelog...');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: `You generate concise changelogs for an npm framework package called YinzerFlow (a lightweight HTTP server framework for Node.js/Bun).

Rules:
- Only include USER-FACING changes that matter to framework consumers
- IGNORE: CI/CD, .claude/ files, docs-only changes, internal refactors that don't change public API, chore commits, version bumps
- Group into sections (only include sections that have entries):
  ### Breaking Changes
  ### Features
  ### Bug Fixes
  ### Performance
  ### Security
- Each entry: "- Description (commit_hash)" — rewrite commit messages to be clear and user-facing
- Keep the short hash in parentheses at the end of each line
- If there are NO user-facing changes at all, respond with exactly: NO_USER_CHANGES
- Do NOT include section headers for empty sections
- Do NOT include a version header — I'll add that myself`,
        messages: [
          {
            role: 'user',
            content: `Generate a changelog from these commits:\n\n${commits}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      log.warn(`Claude API returned ${response.status}: ${errText}`);
      log.dim('Falling back to raw commit list');
      return { changelog: formatRawChangelog(commits, newVersion), aiGenerated: false, noUserChanges: false };
    }

    const data = (await response.json()) as { content: Array<{ text: string }> };
    const text = data.content[0]?.text?.trim() ?? '';

    if (text === 'NO_USER_CHANGES') {
      log.warn('AI determined no user-facing changes in these commits');
      return { changelog: formatRawChangelog(commits, newVersion), aiGenerated: true, noUserChanges: true };
    }

    const today = new Date().toISOString().split('T')[0];
    const formatted = `## [${newVersion}] - ${today}\n\n${text}`;
    log.success('AI changelog generated');
    return { changelog: formatted, aiGenerated: true, noUserChanges: false };
  } catch (err) {
    log.warn(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`);
    log.dim('Falling back to raw commit list');
    return { changelog: formatRawChangelog(commits, newVersion), aiGenerated: false, noUserChanges: false };
  }
};

const formatRawChangelog = (commits: string, newVersion: string): string => {
  const today = new Date().toISOString().split('T')[0];
  return `## [${newVersion}] - ${today}\n\n${commits}`;
};

// ─── CHANGELOG.md Writer ────────────────────────────────────────────────────────

const writeChangelog = async (entry: string): Promise<void> => {
  const header = '# Changelog\n\nAll notable changes to YinzerFlow will be documented in this file.\n\n';
  const changelogPath = 'CHANGELOG.md';
  const file = Bun.file(changelogPath);

  if (await file.exists()) {
    const existing = await file.text();
    rollbackState.originalChangelog = existing;
    rollbackState.changelogExisted = true;

    // Prepend after the header (or after first blank line if header exists)
    const headerEnd = existing.indexOf('\n\n');
    if (headerEnd !== -1 && existing.startsWith('# Changelog')) {
      const afterHeader = existing.slice(headerEnd + 2);
      await Bun.write(changelogPath, `${existing.slice(0, headerEnd + 2)}${entry}\n\n${afterHeader}`);
    } else {
      await Bun.write(changelogPath, `${header}${entry}\n\n${existing}`);
    }
  } else {
    rollbackState.changelogExisted = false;
    await Bun.write(changelogPath, `${header}${entry}\n`);
  }

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
  aiGenerated: boolean;
}): void => {
  const border = `${c.dim}─${c.reset}`;
  const line = border.repeat(50);

  console.log(`\n${line}`);
  console.log(`  ${c.bold}Package:${c.reset}  ${opts.packageName}`);
  console.log(`  ${c.bold}Version:${c.reset}  ${opts.currentVersion} → ${c.green}${c.bold}${opts.newVersion}${c.reset}`);
  console.log(`  ${c.bold}Tag:${c.reset}      v${opts.newVersion}`);
  console.log(`  ${c.bold}Commits:${c.reset}  ${opts.commitCount} since ${opts.lastTag || 'beginning'}`);
  console.log(`  ${c.bold}AI:${c.reset}       ${opts.aiGenerated ? `${c.green}yes${c.reset}` : `${c.yellow}raw commits${c.reset}`}`);
  console.log('');
  console.log(`  ${c.bold}Changelog:${c.reset}`);

  // Indent changelog preview
  const previewLines = opts.changelog.split('\n').slice(0, 20);
  for (const line of previewLines) {
    console.log(`  ${c.dim}│${c.reset} ${line}`);
  }
  if (opts.changelog.split('\n').length > 20) {
    console.log(`  ${c.dim}│ ... (truncated)${c.reset}`);
  }

  console.log('');
  console.log(`  ${c.bold}Steps:${c.reset} bump → changelog → compile → commit → tag → push → publish`);
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

const gitCommitAndTag = (newVersion: string, changelogEntry: string): void => {
  const tag = `v${newVersion}`;
  const commitMsg = `🔖 release: v${newVersion}\n\nBump version to ${newVersion} and update changelog.`;

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

const createGithubRelease = (newVersion: string, changelogEntry: string, packageName: string): void => {
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
    '--notes', changelogEntry,
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
  const { currentVersion, lastTag, commitCount, hasApiKey, packageName } = await preflight();

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

  // ── Changelog generation ──
  const commits = getCommitsSinceTag(lastTag);
  const { changelog, aiGenerated, noUserChanges } = await generateChangelog(commits, newVersion, hasApiKey);

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
    aiGenerated,
  });

  const confirmed = await confirm(`Publish ${packageName}@${newVersion}?`);
  if (!confirmed) {
    log.info('Aborted.');
    process.exit(0);
  }

  // ── Mutations (rollback from here on failure) ──
  try {
    log.step('Executing release');

    // 1. Bump version
    await bumpPackageVersion(newVersion);

    // 2. Write changelog
    await writeChangelog(changelog);

    // 3. Build bundle (clean → compile → validate size → copy dist files)
    log.dim('Cleaning output directory...');
    run(['rm', '-rf', 'lib']);
    mkdirSync('lib');

    log.dim('Compiling bundle...');
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

    const bundleSize = Bun.file('lib/index.js').size;
    const sizeKB = Math.round(bundleSize / 1024);
    const maxSizeKB = Math.round(BUILD_CONFIG.maxBundleSize / 1024);
    if (bundleSize > BUILD_CONFIG.maxBundleSize) {
      throw new Error(`Bundle size ${sizeKB}KB exceeds ${maxSizeKB}KB limit`);
    }
    log.success(`Bundle compiled (${sizeKB}KB / ${maxSizeKB}KB limit)`);

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

    // 5. Git commit + tag
    gitCommitAndTag(newVersion, changelog);

    // 6. Git push
    gitPush();

    // 7. npm publish
    npmPublish();

    // 8. GitHub release (optional)
    createGithubRelease(newVersion, changelog, packageName);

    // ── Success ──
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
