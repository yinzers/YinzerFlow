import type { InternalPreCompiledRoute, InternalRouteRegistry } from '@typedefs/internal/InternalRouteRegistryImpl.d.ts';

/**
 * Compile a route path into an anchored regex plus its parameter names.
 *
 * Literal text between `:params` is regex-escaped, so a route matches only the path it spells:
 * `/v1.0/users/:id` matches `/v1.0/users/5`, never `/v1/0/users/5` or `/v1X0/users/5`. Hook
 * `routesToInclude` / `routesToExclude` compare paths literally, so an unescaped `.` here would let
 * the router accept a path a hook pattern never recognizes (an auth hook skipped while the handler runs).
 *
 * Shared by HTTP and WebSocket routing. Runs at registration, never per request.
 *
 * @example
 * ```ts
 * compilePathPattern('/files/:name.json');
 * // { pattern: /^\/files\/([^\/]+)\.json$/, paramNames: ['name'] }
 * ```
 */
export const compilePathPattern = (path: string): Pick<InternalPreCompiledRoute, 'paramNames' | 'pattern'> => {
  const paramNames: Array<string> = [];
  let source = '';
  let literalStart = 0;

  for (const match of path.matchAll(/:\w+/g)) {
    source += `${_escapeRegexLiteral(path.slice(literalStart, match.index))}([^\\/]+)`;
    paramNames.push(match[0].slice(1)); // Remove the ':' prefix
    literalStart = match.index + match[0].length;
  }
  source += _escapeRegexLiteral(path.slice(literalStart));

  return { pattern: new RegExp(`^${source}$`), paramNames };
};

/**
 * Compile a route pattern into a regular expression
 *
 * @example
 * ```ts
 * compileRoutePattern({ path: '/users/:id/posts/:postId' });
 * // Returns { pattern: /^\/users\/([^/]+)\/posts\/([^/]+)$/, paramNames: ['id', 'postId'], isParameterized: true }
 * ```
 */
export const compileRoutePattern = (route: InternalRouteRegistry): InternalPreCompiledRoute => ({
  ...route,
  ...compilePathPattern(route.path),
  isParameterized: true,
});

const _escapeRegexLiteral = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
