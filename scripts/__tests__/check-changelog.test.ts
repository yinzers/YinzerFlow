import { afterEach, describe, expect, it } from 'bun:test';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasUnreleasedEntries } from '../changelog.ts';

// The app container has no git, so the script runs against a fake `git` on PATH that answers the
// four calls it makes. That also lets a test make `git diff` fail.
const SCRIPT = join(import.meta.dir, '..', 'check-changelog.sh');
const FENCE = '```';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const runScript = (changelog: string, opts: { diff?: string; diffFails?: boolean } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'check-changelog-'));
  dirs.push(root);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bin'));
  copyFileSync(SCRIPT, join(root, 'scripts', 'check-changelog.sh'));
  writeFileSync(join(root, 'CHANGELOG.md'), changelog);
  const fakeGit = `#!/bin/sh
case "$1" in
  rev-parse) exit 0 ;;
  describe) echo v1.0.0 ;;
  diff) ${opts.diffFails ? 'echo "fatal: bad revision" >&2; exit 128' : `printf '%s\\n' ${JSON.stringify(opts.diff ?? 'app/index.ts')}`} ;;
  ls-files) exit 0 ;;
  *) exit 1 ;;
esac
`;
  writeFileSync(join(root, 'bin', 'git'), fakeGit);
  chmodSync(join(root, 'bin', 'git'), 0o755);
  const result = Bun.spawnSync(['sh', join(root, 'scripts', 'check-changelog.sh')], {
    env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
  });
  return { code: result.exitCode, stderr: result.stderr.toString(), stdout: result.stdout.toString() };
};

const unreleased = (body: string) => `# Changelog\n\n## [Unreleased]\n\n${body}\n## [1.0.0] - 2026-01-01\n\n- old\n`;

// One table for both parsers: the TypeScript one publish.ts uses and the awk in the shell check
// must agree on what "Unreleased has an entry" means.
// Bug caught (High tier, parser of the release gate): a fenced "## " or "### " ended the section
// early or split it, and a bullet after a fence went uncounted, so the gate passed or failed wrongly.
const rows: Array<{ name: string; body: string; hasEntries: boolean }> = [
  { name: 'plain bullet', body: '### Features\n\n- a thing\n\n', hasEntries: true },
  { name: 'headings only', body: '### Features\n\n### Internal\n\n', hasEntries: false },
  {
    name: 'fence containing a "## " line, bullet after it',
    body: `### Features\n\n${FENCE}md\n## [9.9.9] not a release\n${FENCE}\n\n- real entry\n\n`,
    hasEntries: true,
  },
  {
    name: 'fence containing a "### " line, bullet after it',
    body: `### Features\n\n${FENCE}md\n### not a subsection\n${FENCE}\n\n- real entry\n\n`,
    hasEntries: true,
  },
  {
    name: 'bullet only after a fence (fence holds a bullet-looking line, nothing real before)',
    body: `### Internal\n\n${FENCE}\n- inside the fence\n${FENCE}\n\n- after the fence\n\n`,
    hasEntries: true,
  },
  {
    name: 'bullet only inside a fence is not an entry',
    body: `### Internal\n\n${FENCE}\n- inside the fence\n${FENCE}\n\n`,
    hasEntries: false,
  },
  {
    name: 'tilde fence is a fence too',
    body: '### Internal\n\n~~~\n- inside\n## not a heading\n~~~\n\n',
    hasEntries: false,
  },
  {
    name: 'a backtick fence is not closed by a tilde line',
    body: `### Internal\n\n${FENCE}\n~~~\n- inside\n${FENCE}\n\n`,
    hasEntries: false,
  },
];

describe('Unreleased entry detection: TypeScript parser and check-changelog.sh agree', () => {
  for (const row of rows) {
    it(row.name, () => {
      const content = unreleased(row.body);
      expect(hasUnreleasedEntries(content)).toBe(row.hasEntries);
      // The script only reaches the changelog when library code changed, which the fake git says it did.
      expect(runScript(content).code).toBe(row.hasEntries ? 0 : 1);
    });
  }
});
