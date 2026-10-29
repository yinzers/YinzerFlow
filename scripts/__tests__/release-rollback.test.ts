import { describe, expect, it } from 'bun:test';
import { abortRelease, newRollbackState, publishThenPush } from '../release-rollback.ts';

const fakeIo = () => {
  const calls = { run: [] as string[][], writes: [] as string[], removed: [] as string[], lines: [] as string[] };
  const say = (msg: string) => calls.lines.push(msg);
  return {
    calls,
    io: {
      run: (cmd: string[]) => void calls.run.push(cmd),
      writeFile: async (path: string) => void calls.writes.push(path),
      exists: () => true,
      remove: (path: string) => void calls.removed.push(path),
      log: { step: say, error: say, dim: say, success: say },
    },
  };
};

// A state as it looks once the release commit and tag exist and package.json and CHANGELOG.md were rewritten.
const committedState = () => ({
  ...newRollbackState(),
  originalPackageJson: '{"version":"0.10.0"}',
  originalChangelog: '# Changelog\n',
  changelogExisted: true,
  commitCreated: true,
  tagCreated: 'v0.11.0',
});

// Bug caught (High tier, release integrity): npm publish succeeded, git push threw, and rollback deleted
// the tag, reset the commit and restored package.json, leaving npm with a version git had forgotten.
describe('abortRelease after npm publish', () => {
  it('leaves git and files alone, prints the push command and exits non-zero when the push fails', async () => {
    const state = committedState();
    const { io, calls } = fakeIo();
    const exits: number[] = [];

    try {
      publishThenPush(state, {
        npmPublish: () => {},
        gitPush: () => {
          throw new Error('git push failed: non-fast-forward');
        },
      });
    } catch {
      await abortRelease(state, io, (code) => void exits.push(code));
    }

    expect(state.published).toBe(true);
    expect(calls.run).toEqual([]);
    expect(calls.writes).toEqual([]);
    expect(calls.removed).toEqual([]);
    expect(calls.lines.join('\n')).toContain('git push origin main --follow-tags');
    expect(exits).toEqual([1]);
  });

  it('does not set published when npm publish itself fails, so that rollback still restores', async () => {
    const state = committedState();
    const { io, calls } = fakeIo();

    try {
      publishThenPush(state, {
        npmPublish: () => {
          throw new Error('npm publish failed');
        },
        gitPush: () => {
          throw new Error('must not be reached');
        },
      });
    } catch {
      await abortRelease(state, io, () => {});
    }

    expect(state.published).toBe(false);
    expect(calls.run).toContainEqual(['git', 'tag', '-d', 'v0.11.0']);
    expect(calls.run).toContainEqual(['git', 'reset', '--soft', 'HEAD~1']);
    expect(calls.writes).toContain('package.json');
    expect(calls.writes).toContain('CHANGELOG.md');
  });

  it('a Ctrl-C after publish takes the same path: no local changes', async () => {
    const state = { ...committedState(), published: true };
    const { io, calls } = fakeIo();
    const exits: number[] = [];

    await abortRelease(state, io, (code) => void exits.push(code));

    expect(calls.run).toEqual([]);
    expect(calls.writes).toEqual([]);
    expect(exits).toEqual([1]);
  });
});
