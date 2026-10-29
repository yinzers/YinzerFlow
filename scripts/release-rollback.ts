/**
 * Rollback for scripts/publish.ts, with its side effects injected so the failure paths can be
 * tested without a repository, npm or a real process exit.
 *
 * The rule that matters: once `npm publish` has succeeded the release is public, so rollback must
 * never undo local git or files. npm would keep a version that git has forgotten. From then on a
 * failure prints the manual steps and exits non-zero.
 */

export interface RollbackState {
  originalPackageJson: string | null;
  originalChangelog: string | null;
  changelogExisted: boolean;
  commitCreated: boolean;
  tagCreated: string | null;
  /** Set right after `npm publish` succeeds. */
  published: boolean;
  pushed: boolean;
}

export interface RollbackIo {
  run: (cmd: string[]) => unknown;
  writeFile: (path: string, text: string) => Promise<unknown>;
  exists: (path: string) => boolean;
  remove: (path: string) => void;
  log: { step: (msg: string) => void; error: (msg: string) => void; dim: (msg: string) => void; success: (msg: string) => void };
}

export const newRollbackState = (): RollbackState => ({
  originalPackageJson: null,
  originalChangelog: null,
  changelogExisted: false,
  commitCreated: false,
  tagCreated: null,
  published: false,
  pushed: false,
});

/** npm publish, then mark the release public before anything else can fail, then push. */
export const publishThenPush = (state: RollbackState, steps: { npmPublish: () => void; gitPush: () => void }): void => {
  steps.npmPublish();
  state.published = true;
  steps.gitPush();
};

const _printManualSteps = (state: RollbackState, io: RollbackIo): void => {
  const { log } = io;
  const tag = state.tagCreated;
  if (state.pushed) {
    log.error('Changes were already pushed. Manual rollback required:');
    if (tag) {
      log.dim(`  git push --delete origin ${tag}`);
      log.dim(`  git tag -d ${tag}`);
    }
    log.dim('  git revert HEAD');
    log.dim('  git push');
    return;
  }
  log.error(`${tag ?? 'The release'} is already published to npm, so nothing local was rolled back.`);
  log.error('Finish it by hand: the release commit and tag are still local.');
  log.dim('  git push origin main --follow-tags');
  log.dim('  (then create the GitHub release if you want one)');
};

/** Undoes local mutations. After a publish it only prints what to do by hand. */
export const rollback = async (state: RollbackState, io: RollbackIo): Promise<void> => {
  const { log } = io;
  log.step('Rolling back mutations...');

  if (state.published || state.pushed) {
    _printManualSteps(state, io);
    return;
  }

  if (state.tagCreated) {
    io.run(['git', 'tag', '-d', state.tagCreated]);
    log.dim(`Deleted tag ${state.tagCreated}`);
  }

  if (state.commitCreated) {
    io.run(['git', 'reset', '--soft', 'HEAD~1']);
    log.dim('Reset last commit');
  }

  // Unstage everything
  io.run(['git', 'reset', 'HEAD', '.']);

  if (state.originalPackageJson) {
    await io.writeFile('package.json', state.originalPackageJson);
    log.dim('Restored package.json');
  }

  if (state.changelogExisted && state.originalChangelog) {
    await io.writeFile('CHANGELOG.md', state.originalChangelog);
    log.dim('Restored CHANGELOG.md');
  } else if (!state.changelogExisted && io.exists('CHANGELOG.md')) {
    io.remove('CHANGELOG.md');
    log.dim('Removed CHANGELOG.md (did not exist before)');
  }

  log.success('Rollback complete');
};

/** Rolls back what is safe to roll back, then exits non-zero. Both the failure handler and Ctrl-C use it. */
export const abortRelease = async (state: RollbackState, io: RollbackIo, exit: (code: number) => void): Promise<void> => {
  await rollback(state, io);
  exit(1);
};
