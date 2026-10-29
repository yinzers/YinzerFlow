#!/bin/sh
# Fails when library code changed since the last release tag and CHANGELOG.md's
# "## [Unreleased]" section has no bullet entries. Run by green-check (quick tier) and by
# scripts/publish.ts preflight, so a change cannot land or release without a changelog line.
#
# "Library code" = files under app/ that are not tests. The test-file patterns below
# (__tests__/, *.spec.ts, *.test.ts) DEFINE what counts as library code: a test edit changes no
# shipped behavior, so it needs no changelog line. They are not a way to skip files from a check;
# every other path under app/ (including app/typedefs/*.d.ts) is checked. docs/ is not counted:
# a docs edit is not a reliable behavior-change signal and publish.ts already warns on stale docs.
#
# "Empty" Unreleased = between the "## [Unreleased]" heading and the next "## " heading there is
# no line matching: optional indentation, "-" or "*", whitespace, then a non-space character. A
# missing Unreleased section counts as empty. Subsection headings alone are not entries. Fenced
# code blocks (opened by a line starting with ``` or ~~~, closed by the same marker) are skipped:
# a "## " or "- " line inside one neither ends the section nor counts as an entry. This mirrors
# scripts/changelog.ts; scripts/__tests__/check-changelog.test.ts runs one table through both.
#
# Compared against the working tree: tracked edits (staged or not) via `git diff <tag>`, plus
# untracked non-ignored files. Passes when there is no v* tag or nothing changed since it.
set -eu

cd "$(dirname "$0")/.."

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "check-changelog: FAIL. git is missing or this is not a git checkout; the check cannot run." >&2
  echo "The app compose image has no git: run this on the host (checks.conf host-check) or in the bun service." >&2
  exit 2
fi

tag=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)
if [ -z "$tag" ]; then
  echo "check-changelog: no v* tag found, nothing to compare against. OK."
  exit 0
fi

changed=$(
  {
    git diff --name-only --no-renames "$tag" -- app/
    git ls-files --others --exclude-standard -- app/
  } | sort -u |
    grep -v -e '/__tests__/' -e '\.spec\.ts$' -e '\.test\.ts$' || true
)

if [ -z "$changed" ]; then
  echo "check-changelog: no library code changed since $tag. OK."
  exit 0
fi

if awk '
  match($0, /^[ \t]*(```|~~~)/) {
    marker = substr($0, RLENGTH, 1)
    if (fence == "") fence = marker
    else if (fence == marker) fence = ""
    next
  }
  fence != "" { next }
  /^## \[Unreleased\]/ { in_section = 1; next }
  /^## / { in_section = 0 }
  in_section && /^[ \t]*[-*][ \t]+[^ \t]/ { found = 1 }
  END { exit found ? 0 : 1 }
' CHANGELOG.md; then
  echo "check-changelog: library code changed since $tag and Unreleased has entries. OK."
  exit 0
fi

echo "check-changelog: FAIL. Library code changed since $tag but CHANGELOG.md has no bullet" >&2
echo "under '## [Unreleased]'. Add an entry (under Breaking Changes, Security, Features," >&2
echo "Bug Fixes or Internal) in the same commit as the change. Changed files:" >&2
echo "$changed" | sed 's/^/  /' >&2
exit 1
