import type { InternalHttpMethod } from '@typedefs/constants/http.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';

export interface InternalRouteRegistryImpl {
  readonly _exactRoutes: Map<InternalHttpMethod, Map<string, InternalRouteRegistry>>;
  readonly _parameterizedRoutes: Map<InternalHttpMethod, Array<InternalPreCompiledRoute>>;
  _register: (route: InternalRouteRegistry) => void;
  _findRoute: (method: InternalHttpMethod, path: string) => InternalRouteRegistry | undefined;
}

export interface InternalRouteRegistryOptions {
  beforeHooks: Array<HandlerCallback>;
  afterHooks: Array<HandlerCallback>;
}

export interface InternalRouteRegistry {
  prefix?: string;
  path: string;
  method: InternalHttpMethod;
  handler: HandlerCallback;
  options: InternalRouteRegistryOptions;
  params: Record<string, string>;
}

/**
 * Pre-compiled route with regex pattern for efficient runtime matching
 *
 * We compile route patterns into regexes at registration time (server startup)
 * rather than at request time for performance reasons:
 * - Registration: O(1) one-time cost per route
 * - Runtime: O(1) for exact routes, O(n) for parameterized routes with pre-compiled regex
 *
 * Example: "/users/:id/posts/:postId" becomes:
 * - pattern: /^\/users\/([^\/]+)\/posts\/([^\/]+)$/
 * - paramNames: ["id", "postId"]
 */
export interface InternalPreCompiledRoute extends InternalRouteRegistry {
  pattern: RegExp;
  paramNames: Array<string>;
  isParameterized: boolean;
}
