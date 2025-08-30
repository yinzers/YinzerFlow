import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.ts';
import type { HandlerCallback } from '@typedefs/public/Context.ts';
import type { InternalGroupApp } from '@core/setup/GroupApp.js';
import type { HttpMethodHandlers, RouteGroupMethod } from '@core/setup/utils/routeUtils.js';

/**
 * Route group instance that provides HTTP method handlers and nested group support.
 *
 * @see {@link InternalGroupApp} for internal implementation details
 */
export type RouteGroup = InternalGroupApp;

/**
 * Main setup interface for configuring YinzerFlow routes, hooks, and middleware.
 *
 * The Setup interface provides methods for:
 * - **Route Registration**: HTTP method handlers (GET, POST, PUT, etc.)
 * - **Route Grouping**: Organized route prefixes with shared hooks
 * - **Global Hooks**: beforeAll/afterAll hooks that run for all routes
 * - **Error Handling**: Custom error and not-found handlers
 *
 * @example
 * ```typescript
 * import { YinzerFlow } from 'yinzerflow';
 *
 * const app = new YinzerFlow({ port: 3000 });
 *
 * // Register routes
 * app.get('/api/users', async (ctx) => {
 *   return { users: ['John', 'Jane'] };
 * });
 *
 * app.post('/api/users', async (ctx) => {
 *   const userData = ctx.request.body;
 *   return { message: 'User created', data: userData };
 * });
 *
 * // Set up global hooks
 * app.beforeAll([
 *   async (ctx) => {
 *     ctx.state.requestId = generateRequestId();
 *     ctx.state.timestamp = Date.now();
 *   }
 * ]);
 *
 * app.afterAll([
 *   async (ctx, result) => {
 *     ctx.response.addHeaders({
 *       'X-Request-ID': ctx.state.requestId,
 *       'X-Processing-Time': `${Date.now() - ctx.state.timestamp}ms`
 *     });
 *   }
 * ]);
 *
 * // Create route groups
 * app.group('/api/v1', (api) => {
 *   api.group('/admin', (admin) => {
 *     admin.get('/users', async (ctx) => {
 *       return { adminUsers: ['Admin1', 'Admin2'] };
 *     });
 *   });
 * });
 *
 * // Custom error handlers
 * app.onError(async (ctx, error) => {
 *   ctx.response.setStatusCode(500);
 *   return { error: 'Internal server error', message: error.message };
 * });
 *
 * app.onNotFound(async (ctx) => {
 *   ctx.response.setStatusCode(404);
 *   return { error: 'Not found', path: ctx.request.url };
 * });
 * ```
 *
 * @see {@link HttpMethodHandlers} for HTTP method registration methods
 * @see {@link RouteGroupMethod} for route group creation method
 * @see {@link InternalGlobalHookOptions} for global hook configuration options
 * @see {@link HandlerCallback} for route handler function signature
 */
export interface Setup extends HttpMethodHandlers {
  /**
   * Creates a route group with a shared prefix and optional shared hooks.
   *
   * Route groups allow you to organize related routes under a common path
   * prefix and apply shared hooks to all routes within the group.
   *
   * @param prefix - The URL prefix for all routes in this group (e.g., '/api/v1')
   * @param callback - Function that receives the group instance for registering routes
   * @param options - Optional shared hooks and configuration for the group
   *
   * @example
   * ```typescript
   * // Basic route group
   * app.group('/api', (api) => {
   *   api.get('/users', () => ({ users: [] }));
   *   api.post('/users', () => ({ created: true }));
   * });
   *
   * // Route group with shared hooks
   * app.group('/api/v1', (api) => {
   *   api.get('/users', () => ({ users: [] }));
   *   api.post('/users', () => ({ created: true }));
   * }, {
   *   beforeHooks: [
   *     async (ctx) => {
   *       ctx.state.apiVersion = 'v1';
   *       ctx.state.requiresAuth = true;
   *     }
   *   ]
   * });
   *
   * // Nested route groups
   * app.group('/api/v1', (api) => {
   *   api.group('/admin', (admin) => {
   *     admin.get('/users', () => ({ adminUsers: [] }));
   *     admin.get('/stats', () => ({ stats: {} }));
   *   });
   * });
   * ```
   *
   * @see {@link RouteGroupMethod} for method signature details
   * @see {@link InternalGroupApp} for group instance interface
   */
  group: RouteGroupMethod;

  /**
   * Registers global hooks that run before all route handlers.
   *
   * These hooks execute for every request before any route-specific hooks
   * or the route handler itself. They're perfect for setting up global
   * state, authentication, logging, or request preprocessing.
   *
   * @param handlers - Array of hook functions to execute
   * @param options - Optional configuration for hook execution scope
   *
   * @example
   * ```typescript
   * // Global authentication hook
   * app.beforeAll([
   *   async (ctx) => {
   *     const token = ctx.request.headers.authorization;
   *     if (token) {
   *       const user = await validateToken(token);
   *       ctx.state.user = user;
   *       ctx.state.isAuthenticated = true;
   *     }
   *   }
   * ]);
   *
   * // Global logging hook
   * app.beforeAll([
   *   async (ctx) => {
   *     ctx.state.requestId = generateRequestId();
   *     ctx.state.startTime = Date.now();
   *
   *     console.log(`Request ${ctx.state.requestId} to ${ctx.request.url}`);
   *   }
   * ], {
   *   routesToExclude: ['/health', '/metrics'] // Skip logging for health checks
   * });
   * ```
   *
   * @see {@link InternalGlobalHookOptions} for hook configuration options
   * @see {@link HandlerCallback} for hook function signature
   */
  beforeAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;

  /**
   * Registers global hooks that run after all route handlers.
   *
   * These hooks execute for every request after the route handler completes
   * and after any route-specific after hooks. They're perfect for response
   * modification, logging, cleanup, or adding response headers.
   *
   * @param handlers - Array of hook functions to execute
   * @param options - Optional configuration for hook execution scope
   *
   * @example
   * ```typescript
   * // Global response modification hook
   * app.afterAll([
   *   async (ctx, result) => {
   *     // Add response headers based on state
   *     if (ctx.state.requestId) {
   *       ctx.response.addHeaders({
   *         'X-Request-ID': ctx.state.requestId,
   *         'X-Processing-Time': `${Date.now() - ctx.state.startTime}ms`
   *       });
   *     }
   *
   *     // Log response
   *     console.log(`Request ${ctx.state.requestId} completed with status ${ctx.response.statusCode}`);
   *   }
   * ]);
   *
   * // Global CORS hook
   * app.afterAll([
   *   async (ctx) => {
   *     ctx.response.addHeaders({
   *       'Access-Control-Allow-Origin': '*',
   *       'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
   *       'Access-Control-Allow-Headers': 'Content-Type, Authorization'
   *     });
   *   }
   * ]);
   * ```
   *
   * @see {@link InternalGlobalHookOptions} for hook configuration options
   * @see {@link HandlerCallback} for hook function signature
   */
  afterAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;

  /**
   * Registers a custom error handler for all routes.
   *
   * This handler is called when any route throws an error or returns
   * a rejected promise. It receives the context and the error object,
   * allowing you to customize error responses and logging.
   *
   * @param handler - Function to handle errors
   *
   * @example
   * ```typescript
   * // Custom error handler
   * app.onError(async (ctx, error) => {
   *   // Log the error
   *   console.error(`Error in ${ctx.request.method} ${ctx.request.url}:`, error);
   *
   *   // Set appropriate status code
   *   if (error.name === 'ValidationError') {
   *     ctx.response.setStatusCode(400);
   *     return { error: 'Validation failed', details: error.message };
   *   }
   *
   *   if (error.name === 'UnauthorizedError') {
   *     ctx.response.setStatusCode(401);
   *     return { error: 'Unauthorized', message: error.message };
   *   }
   *
   *   // Default error response
   *   ctx.response.setStatusCode(500);
   *   return {
   *     error: 'Internal server error',
   *     message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
   *   };
   * });
   * ```
   *
   * @see {@link HandlerCallback} for error handler function signature
   */
  onError: (handler: HandlerCallback) => void;

  /**
   * Registers a custom not-found handler for unmatched routes.
   *
   * This handler is called when a request doesn't match any registered
   * route. It receives the context and allows you to customize the
   * 404 response.
   *
   * @param handler - Function to handle not-found requests
   *
   * @example
   * ```typescript
   * // Custom not-found handler
   * app.onNotFound(async (ctx) => {
   *   ctx.response.setStatusCode(404);
   *
   *   // Return helpful error message
   *   return {
   *     error: 'Not found',
   *     message: `The requested resource '${ctx.request.url}' was not found`,
   *     availableEndpoints: [
   *       '/api/users',
   *       '/api/posts',
   *       '/health'
   *     ],
   *     documentation: 'https://api.example.com/docs'
   *   };
   * });
   * ```
   *
   * @see {@link HandlerCallback} for not-found handler function signature
   */
  onNotFound: (handler: HandlerCallback) => void;
}
