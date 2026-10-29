import { describe, expect, it } from 'bun:test';
import { addRelease, hasUnreleasedEntries, promoteUnreleased, UNRELEASED_SKELETON } from '../changelog.ts';

const head = '# Changelog\n\nAll notable changes to YinzerFlow will be documented in this file.\n\n';
const old = '## [0.10.0] - 2026-10-29\n\n### Features\n\n- **Old thing** — shipped\n';

// Bug caught (High tier, parser that edits the release file): a promotion that drops entries,
// ships empty subsections, or leaves no fresh Unreleased would publish a wrong changelog.
describe('promoteUnreleased', () => {
  it('turns bullets into the release entry, drops empty subsections and leaves a fresh skeleton', () => {
    const filled = UNRELEASED_SKELETON.replace('### Features\n', '### Features\n\n- **New** — thing\n').replace(
      '### Internal\n',
      '### Internal\n\n- Refactor the thing\n',
    );
    const { content, entry, body } = promoteUnreleased(`${head}${filled}${old}`, '0.11.0', '2026-11-01');

    expect(body).toBe('### Features\n\n- **New** — thing\n\n### Internal\n\n- Refactor the thing');
    expect(entry).toBe(`## [0.11.0] - 2026-11-01\n\n${body}`);
    expect(content).toBe(`${head}${UNRELEASED_SKELETON}${entry}\n\n${old}`);
    expect(hasUnreleasedEntries(content)).toBe(false);
  });

  it('keeps a fenced block with "##", "###" and blank lines byte for byte', () => {
    const fence = '```';
    const block = `${fence}md\n## inside\n\n\n### also inside\n${fence}`;
    const filled = UNRELEASED_SKELETON.replace('### Features\n', `### Features\n\n${block}\n\n- **After the fence** — kept\n`);
    const { body, content } = promoteUnreleased(`${head}${filled}${old}`, '0.11.0', '2026-11-01');

    expect(body).toBe(`### Features\n\n${block}\n\n- **After the fence** — kept`);
    expect(content).toContain(`${UNRELEASED_SKELETON}## [0.11.0]`);
  });

  it('refuses an Unreleased section that has only subsection headings', () => {
    expect(() => promoteUnreleased(`${head}${UNRELEASED_SKELETON}${old}`, '0.11.0', '2026-11-01')).toThrow();
  });
});

describe('hasUnreleasedEntries', () => {
  it('ignores bullets in released sections and treats a missing section as empty', () => {
    expect(hasUnreleasedEntries(`${head}${UNRELEASED_SKELETON}${old}`)).toBe(false);
    expect(hasUnreleasedEntries(`${head}${old}`)).toBe(false);
  });
});

describe('addRelease', () => {
  it('places an AI-drafted entry under an empty Unreleased and creates one when missing', () => {
    const entry = '## [0.11.0] - 2026-11-01\n\n### Features\n\n- Drafted';
    expect(addRelease(`${head}${UNRELEASED_SKELETON}${old}`, entry)).toBe(`${head}${UNRELEASED_SKELETON}${entry}\n\n${old}`);
    expect(addRelease(`${head}${old}`, entry)).toBe(`${head}${UNRELEASED_SKELETON}${entry}\n\n${old}`);
  });
});
