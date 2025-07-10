import { log } from '@core/utils/log.ts';

/**
 * Normalize the path to ensure consistent format
 *
 * Handles common HTTP path variations for consistent route matching:
 * - Always starts with '/'
 * - No double slashes
 * - Consistent trailing slash handling
 * - Strips query parameters (for route matching)
 * - URL decodes encoded characters
 * - Resolves dot segments for security
 *
 * Examples:
 * - "users" → "/users"
 * - "//users" → "/users"
 * - "/users/" → "/users" (consistent - no trailing slash)
 * - "/users?page=1" → "/users"
 * - "/users%20profile" → "/users profile"
 * - "/users/../admin" → "/admin" (dot segment resolved)
 * - "/api/./users" → "/api/users" (current dir resolved)
 *
 * @example
 * ```ts
 * normalizePath('users');
 * // Returns "/users"
 * ```
 */
export const normalizePath = (path: string): string => {
  // Step 1: Strip query parameters and fragments for route matching
  // "/users?page=1#section" → "/users"
  let [normalizedPath] = path.split('?');
  if (!normalizedPath) return '';

  [normalizedPath] = normalizedPath.split('#');
  if (!normalizedPath) return '';

  // Step 2: URL decode encoded characters
  // "/users%20profile" → "/users profile"
  try {
    normalizedPath = decodeURIComponent(normalizedPath);
  } catch (_) {
    // If decoding fails (malformed URL), use original
    // This prevents crashes from malicious URLs
    log.warn('Failed to decode URL path', { path: normalizedPath });
  }

  // Step 3: Add leading slash if not present
  // "users" → "/users"
  normalizedPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

  // Step 4: Remove double slashes
  // "//users" → "/users"
  normalizedPath = normalizedPath.replace(/\/\/+/g, '/');

  // Step 5: Resolve dot segments for security and consistency
  // SECURITY CRITICAL: Prevents directory traversal attacks
  // "/users/../admin" → "/admin"
  // "/api/./users" → "/api/users"
  // "/users/../../etc/passwd" → "/etc/passwd" (contained within app context)
  normalizedPath = resolveDotSegments(normalizedPath);

  // Step 6: Remove trailing slash for consistency (except root path)
  // "/users/" → "/users", but "/" stays "/"
  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  return normalizedPath;
};

/**
 * Resolve dot segments according to RFC 3986 Section 5.2.4
 *
 * SECURITY PURPOSE: Prevents directory traversal attacks by resolving relative paths
 *
 * Dot segments are dangerous because they allow attackers to:
 * - Bypass access controls: "/users/../admin" → "/admin"
 * - Access system files: "/api/../../etc/passwd" → "/etc/passwd"
 * - Traverse outside intended directories
 *
 * ALGORITHM:
 * - "." (current directory) → remove completely
 * - ".." (parent directory) → remove this segment AND the previous segment
 * - Regular segments → keep as-is
 *
 * Examples:
 * - "/users/./profile" → "/users/profile"
 * - "/users/../admin" → "/admin"
 * - "/a/b/c/../../d" → "/a/d"
 * - "/../secret" → "/secret" (can't go above root)
 *
 * @param path - Path with potential dot segments
 * @returns Path with dot segments resolved
 */
const resolveDotSegments = (path: string): string => {
  // Split path into segments, preserving empty strings from leading slash
  const segments = path.split('/');
  const resolved: Array<string> = [];

  for (const segment of segments) {
    if (segment === '.' || segment === '') {
      // Current directory "." - skip completely
      // Empty segments from double slashes - also skip
      if (segment === '' && resolved.length === 0) {
        // Keep the first empty segment to maintain leading slash
        resolved.push(segment);
      }
      continue;
    }

    if (segment === '..') {
      // Parent directory ".." - go up one level
      if (resolved.length > 1) {
        // Remove last segment (go to parent)
        // But don't remove the leading empty string (which represents root "/")
        resolved.pop();
      }
      // If we're already at root, ignore ".." (can't go above root)
    } else {
      // Regular segment - keep it
      resolved.push(segment);
    }
  }

  // Rejoin segments
  const result = resolved.join('/');

  // Ensure we always have at least "/" for root
  return result || '/';
};

/**
 * Normalize route structure for conflict detection
 * Converts /users/:id and /users/:userId to the same structure: /users/:param
 */
export const normalizeRouteStructure = (path: string): string => path.replace(/:\w+/g, ':param');
