const _slash = 0x2f;
const _backslash = 0x5c;
const _percent = 0x25;
const _questionMark = 0x3f;
const _hash = 0x23;
const _nul = 0x00;

/**
 * Derive the single canonical path that both route lookup and hook matching use for a request.
 *
 * Routing and `routesToInclude` / `routesToExclude` matching both read the value this returns, so
 * the two can never disagree about which path a request is for.
 *
 * Canonical form:
 * - query string and fragment removed: `/admin?x=1` → `/admin`
 * - percent-decoded exactly once: `/users%20profile` → `/users profile`, `%252e` → `%2e` (a literal, not a dot)
 * - repeated slashes collapsed: `//admin` → `/admin`
 * - trailing slash removed (root stays `/`): `/admin/` → `/admin`
 * - leading slash added when missing: `admin` → `/admin`
 *
 * ## Security Considerations
 *
 * Paths that could address a different resource after some later layer decodes or resolves them are
 * rejected rather than resolved, so the attempt shows up in logs as a 400 instead of quietly
 * landing on another route. The request is rejected (`null`) when:
 * - a decoded segment is `.` or `..` (`/public/../secret`, `/public/%2e%2e/secret`)
 * - the path contains an encoded slash or backslash (`%2f`, `%5c`) — `/public/..%2F.env`
 * - the path contains a raw backslash or a NUL byte (raw or `%00`)
 * - the percent-encoding is invalid (`/admin%zz`, a trailing `%`, invalid UTF-8)
 *
 * ## Performance
 *
 * O(n) in the path length: one scan of the raw path, one `decodeURIComponent` only when a `%` is
 * present, one segment walk. No regex.
 *
 * @param rawTarget - The request-target exactly as it appeared on the request line
 * @returns The canonical path, or `null` when the request must be rejected with 400
 *
 * @example
 * ```ts
 * canonicalizeRequestPath('//admin/?x=1'); // '/admin'
 * canonicalizeRequestPath('/public/..%2F.env'); // null
 * ```
 */
export const canonicalizeRequestPath = (rawTarget: string): string | null => {
  const rawPath = rawTarget.slice(0, _findPathEnd(rawTarget));

  const decodedPath = _decodeOnce(rawPath);
  if (decodedPath === null) return null;

  return _collapseSegments(decodedPath);
};

/** Index of the first `?` or `#`, or the string length when neither is present. */
const _findPathEnd = (rawTarget: string): number => {
  for (let i = 0; i < rawTarget.length; i++) {
    const code = rawTarget.charCodeAt(i);
    if (code === _questionMark || code === _hash) return i;
  }
  return rawTarget.length;
};

/**
 * Reject forbidden raw characters and forbidden escapes, then percent-decode once.
 * Returns `null` when the path must be rejected.
 */
const _decodeOnce = (rawPath: string): string | null => {
  let hasEscape = false;

  for (let i = 0; i < rawPath.length; i++) {
    const code = rawPath.charCodeAt(i);
    if (code === _backslash || code === _nul) return null;
    if (code === _percent) {
      if (_isForbiddenEscape(rawPath, i)) return null;
      hasEscape = true;
    }
  }

  if (!hasEscape) return rawPath;

  try {
    return decodeURIComponent(rawPath);
  } catch {
    // Malformed escape (`%zz`, trailing `%`) or invalid UTF-8 byte sequence
    return null;
  }
};

/** True for `%2f`, `%5c` and `%00` (either hex case) starting at `index`. */
const _isForbiddenEscape = (rawPath: string, index: number): boolean => {
  const high = rawPath.charCodeAt(index + 1);
  const low = rawPath.charCodeAt(index + 2);
  if (high === 0x32) return low === 0x66 || low === 0x46; // %2f / %2F
  if (high === 0x35) return low === 0x63 || low === 0x43; // %5c / %5C
  if (high === 0x30) return low === 0x30; // %00
  return false;
};

/**
 * Collapse empty segments (repeated, leading-less and trailing slashes) and reject dot segments.
 * Returns `null` when a `.` or `..` segment is present.
 */
const _collapseSegments = (decodedPath: string): string | null => {
  let canonical = '';
  let segmentStart = 0;

  for (let i = 0; i <= decodedPath.length; i++) {
    if (i < decodedPath.length && decodedPath.charCodeAt(i) !== _slash) continue;

    if (i > segmentStart) {
      const segment = decodedPath.slice(segmentStart, i);
      if (segment === '.' || segment === '..') return null;
      canonical += `/${segment}`;
    }
    segmentStart = i + 1;
  }

  return canonical || '/';
};
