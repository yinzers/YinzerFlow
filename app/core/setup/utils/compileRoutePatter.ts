import type { InternalPreCompiledRoute, InternalRouteRegistry } from '@typedefs/internal/InternalRouteRegistryImpl.d.ts';

/**
 * Compile a route pattern into a regular expression
 *
 * @example
 * ```ts
 * compileRoutePattern({ path: '/users/:id/posts/:postId' });
 * // Returns { pattern: /^users\/([^/]+)\/posts\/([^/]+)$/, paramNames: ['id', 'postId'], isParameterized: true }
 * ```
 */
export const compileRoutePattern = (route: InternalRouteRegistry): InternalPreCompiledRoute => {
  const paramNames: Array<string> = [];

  // Convert route pattern to regex with capture groups
  // Example: /users/:id/posts/:postId → /users/([^/]+)/posts/([^/]+)
  const pattern = route.path
    .replace(/:\w+/g, (match) => {
      const paramName = match.slice(1); // Remove the ':' prefix
      paramNames.push(paramName);
      return '([^/]+)'; // Capture group: match any characters except '/'
    })
    .replace(/\//g, '\\/'); // Escape forward slashes for regex

  return {
    ...route,
    pattern: new RegExp(`^${pattern}$`), // ^ and $ ensure full string match
    paramNames,
    isParameterized: true,
  };
};
