/**
 * CHANGELOG.md section handling for scripts/publish.ts. Pure string functions so the release
 * flow can be exercised without running a release.
 *
 * "Empty" Unreleased means the same thing here as in scripts/check-changelog.sh: no line in the
 * section matches `^\s*[-*]\s+\S`. Keep the two definitions in step.
 */

export const UNRELEASED_HEADING = '## [Unreleased]';

/** Subsections in the order the release entries use. */
export const SUBSECTIONS = ['Breaking Changes', 'Security', 'Features', 'Bug Fixes', 'Internal'] as const;

/** A fresh, empty Unreleased section, ending in a blank line. */
export const UNRELEASED_SKELETON = `${UNRELEASED_HEADING}\n\n${SUBSECTIONS.map((name) => `### ${name}\n\n`).join('')}`;

const BULLET = /^[ \t]*[-*][ \t]+\S/;

interface UnreleasedRange {
  /** Index of the heading line. */
  start: number;
  /** Index of the next `## ` line, or lines.length. */
  end: number;
}

const _findUnreleased = (lines: string[]): UnreleasedRange | null => {
  const start = lines.findIndex((line) => line.startsWith(UNRELEASED_HEADING));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return { start, end };
};

/** True when the Unreleased section exists and has at least one bullet line. */
export const hasUnreleasedEntries = (content: string): boolean => {
  const lines = content.split('\n');
  const range = _findUnreleased(lines);
  if (!range) return false;
  return lines.slice(range.start + 1, range.end).some((line) => BULLET.test(line));
};

/**
 * The Unreleased body for a release: its prose and every subsection that has content, with the
 * empty skeleton subsections dropped. Returns '' when there is nothing to release.
 */
export const unreleasedBody = (content: string): string => {
  const lines = content.split('\n');
  const range = _findUnreleased(lines);
  if (!range || !hasUnreleasedEntries(content)) return '';

  const groups: string[][] = [[]];
  for (const line of lines.slice(range.start + 1, range.end)) {
    if (line.startsWith('### ')) groups.push([line]);
    else groups[groups.length - 1].push(line);
  }

  const kept: string[] = [];
  for (const [index, group] of groups.entries()) {
    const hasContent = group.slice(index === 0 ? 0 : 1).some((line) => line.trim() !== '');
    if (hasContent) kept.push(group.join('\n').trim());
  }
  return kept.join('\n\n');
};

/**
 * Turns the Unreleased section into the release entry for `version`, and puts a fresh empty
 * Unreleased skeleton above it. Throws when Unreleased has no entries.
 */
export const promoteUnreleased = (
  content: string,
  version: string,
  date: string,
): { content: string; entry: string; body: string } => {
  const body = unreleasedBody(content);
  if (body === '') throw new Error('Unreleased has no entries to promote');

  const lines = content.split('\n');
  const range = _findUnreleased(lines)!;
  const entry = `## [${version}] - ${date}\n\n${body}`;
  const before = lines.slice(0, range.start).join('\n');
  const after = lines.slice(range.end).join('\n');
  const rebuilt = `${before}${before === '' ? '' : '\n'}${UNRELEASED_SKELETON}${entry}\n\n${after}`;
  return { content: rebuilt, entry, body };
};

/**
 * Adds a release entry (the AI-drafted fallback) under an empty Unreleased skeleton, creating the
 * skeleton when the file has none and the whole file when the changelog is empty.
 */
export const addRelease = (content: string, entry: string): string => {
  const header = '# Changelog\n\nAll notable changes to YinzerFlow will be documented in this file.\n\n';
  const lines = content.split('\n');
  const range = _findUnreleased(lines);

  if (range) {
    const before = lines.slice(0, range.end).join('\n');
    const after = lines.slice(range.end).join('\n');
    return `${before}\n${entry}\n\n${after}`;
  }
  // No Unreleased yet: the new section goes above the first release heading, below the intro.
  const firstRelease = lines.findIndex((line) => line.startsWith('## '));
  if (content.startsWith('# Changelog') && firstRelease !== -1) {
    const intro = lines.slice(0, firstRelease).join('\n');
    return `${intro}\n${UNRELEASED_SKELETON}${entry}\n\n${lines.slice(firstRelease).join('\n')}`;
  }
  return `${header}${UNRELEASED_SKELETON}${entry}\n\n${content}`;
};
