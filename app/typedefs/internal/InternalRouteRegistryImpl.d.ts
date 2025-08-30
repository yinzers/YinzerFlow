import type { InternalHttpMethod } from '@typedefs/constants/http.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';

/**
 * Internal route registry implementation for managing route storage and lookup.
 *
 * This interface provides the core functionality for registering routes and
 * finding them efficiently at runtime. It maintains separate collections for
 * exact routes and parameterized routes for optimal performance.
 *
 * ## Route Types
 *
 * - **Exact Routes**: Direct string matches (e.g., "/api/users")
 * - **Parameterized Routes**: Dynamic routes with parameters (e.g., "/users/:id")
 *
 * ## Performance Characteristics
 *
 * - **Exact Routes**: O(1) lookup time using Map
 * - **Parameterized Routes**: O(n) lookup time with pre-compiled regex patterns
 *
 * @example
 * ```typescript
 * // This interface is used internally by YinzerFlow
 * // Users typically don't interact with it directly
 *
 * // However, if you're extending the framework:
 * class CustomRouteRegistry implements InternalRouteRegistryImpl {
 *   readonly _exactRoutes = new Map();
 *   readonly _parameterizedRoutes = new Map();
 *
 *   _register(route: InternalRouteRegistry) {
 *     // Custom registration logic
 *   }
 *
 *   _findRoute(method: InternalHttpMethod, path: string) {
 *     // Custom route finding logic
 *     return undefined;
 *   }
 * }
 * ```
 *
 * @see {@link InternalRouteRegistry} for individual route structure
 * @see {@link InternalPreCompiledRoute} for parameterized route details
 * @see {@link InternalHttpMethod} for available HTTP methods
 */
export interface InternalRouteRegistryImpl {
  /**
   * Map of exact route matches organized by HTTP method and path.
   *
   * Provides O(1) lookup for routes that have no dynamic parameters.
   *
   * @example
   * ```typescript
   * // Structure: Map<Method, Map<Path, Route>>
   * _exactRoutes = new Map([
   *   ['GET', new Map([
   *     ['/api/users', userListRoute],
   *     ['/api/posts', postListRoute]
   *   ])],
   *   ['POST', new Map([
   *     ['/api/users', createUserRoute]
   *   ])]
   * ]);
   * ```
   */
  readonly _exactRoutes: Map<InternalHttpMethod, Map<string, InternalRouteRegistry>>;

  /**
   * Array of parameterized routes with pre-compiled regex patterns.
   *
   * These routes contain dynamic parameters and require regex matching
   * at runtime. They're pre-compiled for performance.
   *
   * @example
   * ```typescript
   * // Structure: Array of pre-compiled routes
   * _parameterizedRoutes = [
   *   {
   *     pattern: /^\/users\/([^\/]+)$/,
   *     paramNames: ['id'],
   *     path: '/users/:id',
   *     method: 'GET'
   *   }
   * ];
   * ```
   */
  readonly _parameterizedRoutes: Map<InternalHttpMethod, Array<InternalPreCompiledRoute>>;

  /**
   * Registers a new route in the appropriate collection.
   *
   * Routes are automatically categorized as exact or parameterized
   * based on whether they contain dynamic parameters.
   *
   * @param route - The route to register
   *
   * @example
   * ```typescript
   * _register({
   *   path: '/api/users/:id',
   *   method: 'GET',
   *   handler: getUserHandler,
   *   options: { beforeHooks: [authMiddleware] },
   *   params: {}
   * });
   * ```
   */
  _register: (route: InternalRouteRegistry) => void;

  /**
   * Finds a matching route for the given HTTP method and path.
   *
   * Searches exact routes first (O(1)), then parameterized routes (O(n))
   * until a match is found.
   *
   * @param method - The HTTP method to search for
   * @param path - The request path to match
   * @returns The matching route or undefined if no match found
   *
   * @example
   * ```typescript
   * const route = _findRoute('GET', '/api/users/123');
   * if (route) {
   *   // Extract parameters from path
   *   const params = extractParams(route, '/api/users/123');
   *   // Execute route handler
   *   await route.handler(context);
   * }
   * ```
   */
  _findRoute: (method: InternalHttpMethod, path: string) => InternalRouteRegistry | undefined;
}

/**
 * Configuration options for route registration.
 *
 * Defines hooks that will be executed before and after the route handler.
 * Both hooks are optional and can be used independently.
 *
 * @example
 * ```typescript
 * // Route with authentication middleware
 * const authRoute: InternalRouteRegistryOptions = {
 *   beforeHooks: [
 *     async (ctx) => {
 *       const token = ctx.request.headers.authorization;
 *       if (!token) throw new Error('Unauthorized');
 *       ctx.state.user = await validateToken(token);
 *     }
 *   ]
 * };
 *
 * // Route with response logging
 * const loggingRoute: InternalRouteRegistryOptions = {
 *   afterHooks: [
 *     async (ctx, result) => {
 *       console.log(`Response: ${JSON.stringify(result)}`);
 *     }
 *   ]
 * };
 *
 * // Route with both hooks
 * const fullRoute: InternalRouteRegistryOptions = {
 *   beforeHooks: [authMiddleware],
 *   afterHooks: [loggingMiddleware, metricsMiddleware]
 * };
 * ```
 *
 * @see {@link HandlerCallback} for hook function signature
 */
export interface InternalRouteRegistryOptions {
  /**
   * Hooks to execute before the route handler.
   *
   * These hooks run in order and can modify the context or throw errors.
   * If any hook throws an error, the route handler is not executed.
   *
   * @example
   * ```typescript
   * beforeHooks: [
   *   async (ctx) => {
   *     // Authentication
   *     ctx.state.user = await authenticate(ctx.request.headers.authorization);
   *   },
   *   async (ctx) => {
   *     // Rate limiting
   *     await checkRateLimit(ctx.request.ipAddress);
   *   },
   *   async (ctx) => {
   *     // Request validation
   *     validateRequest(ctx.request.body);
   *   }
   * ]
   * ```
   */
  beforeHooks?: Array<HandlerCallback>;

  /**
   * Hooks to execute after the route handler.
   *
   * These hooks run in reverse order and can modify the response or context.
   * They always execute, even if the route handler throws an error.
   *
   * @example
   * ```typescript
   * afterHooks: [
   *   async (ctx, result) => {
   *     // Response logging
   *     console.log(`Response: ${JSON.stringify(result)}`);
   *   },
   *   async (ctx) => {
   *     // Add response headers
   *     ctx.response.addHeaders({
   *       'X-Processing-Time': `${Date.now() - ctx.state.startTime}ms`
   *     });
   *   }
   * ]
   * ```
   */
  afterHooks?: Array<HandlerCallback>;
}

/**
 * Individual route registration with all necessary metadata.
 *
 * Each route contains the path, method, handler, and configuration options.
 * Routes can be either exact matches or parameterized with dynamic segments.
 *
 * @example
 * ```typescript
 * const userRoute: InternalRouteRegistry = {
 *   path: '/api/users/:id',
 *   method: 'GET',
 *   handler: async (ctx) => {
 *     const { id } = ctx.request.params;
 *     const user = await getUserById(id);
 *     return user;
 *   },
 *   options: {
 *     beforeHooks: [authMiddleware],
 *     afterHooks: [loggingMiddleware]
 *   },
 *   params: { id: ':id' }
 * };
 * ```
 *
 * @see {@link InternalRouteRegistryOptions} for hook configuration
 * @see {@link HandlerCallback} for handler function signature
 * @see {@link InternalHttpMethod} for available HTTP methods
 */
export interface InternalRouteRegistry {
  /**
   * Optional path prefix for route groups.
   *
   * When routes are registered in groups, this contains the group prefix.
   * The full route path is constructed by combining prefix + path.
   *
   * @example
   * ```typescript
   * // For a route in group '/api/v1'
   * prefix: '/api/v1'
   * path: '/users'
   * // Full route: /api/v1/users
   * ```
   */
  prefix?: string;

  /**
   * The route path pattern.
   *
   * Can contain static segments and dynamic parameters (e.g., ':id').
   *
   * @example
   * ```typescript
   * path: '/users/:id/posts/:postId'
   * // Matches: /users/123/posts/456
   * // Extracts: { id: '123', postId: '456' }
   * ```
   */
  path: string;

  /**
   * HTTP method this route responds to.
   *
   * @example
   * ```typescript
   * method: 'POST' // Only responds to POST requests
   * ```
   */
  method: InternalHttpMethod;

  /**
   * The function that handles requests to this route.
   *
   * Receives the request context and returns the response data.
   *
   * @example
   * ```typescript
   * handler: async (ctx) => {
   *   const { id } = ctx.request.params;
   *   const user = await getUserById(id);
   *   return { user, timestamp: new Date() };
   * }
   * ```
   */
  handler: HandlerCallback;

  /**
   * Configuration options including hooks and middleware.
   *
   * @example
   * ```typescript
   * options: {
   *   beforeHooks: [authMiddleware, validationMiddleware],
   *   afterHooks: [loggingMiddleware]
   * }
   * ```
   */
  options: InternalRouteRegistryOptions;

  /**
   * Parameter placeholders extracted from the path.
   *
   * Maps parameter names to their placeholder values (e.g., ':id').
   *
   * @example
   * ```typescript
   * // For path '/users/:id/posts/:postId'
   * params: {
   *   id: ':id',
   *   postId: ':postId'
   * }
   * ```
   */
  params: Record<string, string>;
}

/**
 * Pre-compiled route with regex pattern for efficient runtime matching.
 *
 * We compile route patterns into regexes at registration time (server startup)
 * rather than at request time for performance reasons:
 * - Registration: O(1) one-time cost per route
 * - Runtime: O(1) for exact routes, O(n) for parameterized routes with pre-compiled regex
 *
 * @example
 * ```typescript
 * // Route: "/users/:id/posts/:postId"
 * const compiledRoute: InternalPreCompiledRoute = {
 *   pattern: /^\/users\/([^\/]+)\/posts\/([^\/]+)$/,
 *   paramNames: ["id", "postId"],
 *   isParameterized: true,
 *   path: "/users/:id/posts/:postId",
 *   method: "GET",
 *   handler: getUserPostsHandler,
 *   options: { beforeHooks: [authMiddleware] },
 *   params: { id: ":id", postId: ":postId" }
 * };
 *
 * // Runtime matching
 * const match = "/users/123/posts/456".match(compiledRoute.pattern);
 * if (match) {
 *   const params = {
 *     [compiledRoute.paramNames[0]]: match[1], // id: "123"
 *     [compiledRoute.paramNames[1]]: match[2]  // postId: "456"
 *   };
 * }
 * ```
 *
 * @see {@link InternalRouteRegistry} for base route structure
 */
export interface InternalPreCompiledRoute extends InternalRouteRegistry {
  /**
   * Pre-compiled regex pattern for matching this route.
   *
   * The regex is created once at registration time and reused
   * for all subsequent requests to this route.
   *
   * @example
   * ```typescript
   * // Path: "/users/:id"
   * pattern: /^\/users\/([^\/]+)$/
   *
   * // Path: "/posts/:category/:id"
   * pattern: /^\/posts\/([^\/]+)\/([^\/]+)$/
   * ```
   */
  pattern: RegExp;

  /**
   * Names of parameters in the order they appear in the path.
   *
   * Used to map regex capture groups to parameter names.
   *
   * @example
   * ```typescript
   * // Path: "/users/:id/posts/:postId"
   * paramNames: ["id", "postId"]
   *
   * // Regex: /^\/users\/([^\/]+)\/posts\/([^\/]+)$/
   * // match[1] = "123" -> params.id = "123"
   * // match[2] = "456" -> params.postId = "456"
   * ```
   */
  paramNames: Array<string>;

  /**
   * Flag indicating this route has dynamic parameters.
   *
   * Always true for InternalPreCompiledRoute since these are
   * specifically for parameterized routes.
   *
   * @example
   * ```typescript
   * isParameterized: true // Always true for this interface
   * ```
   */
  isParameterized: boolean;
}
