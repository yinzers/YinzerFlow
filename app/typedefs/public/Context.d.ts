import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.d.ts';
import type { Request } from '@typedefs/public/Request.js';
import type { Response } from '@typedefs/public/Response.js';

/**
 * Request context that provides access to request, response, and user-defined state
 *
 * The context is the central object passed to all route handlers and middleware.
 * It contains the request and response objects, plus any custom state data
 * defined by the user through generics.
 *
 * @template T - Extends HandlerCallbackGenerics to provide custom typing
 *
 * @example
 * ```typescript
 * // Basic usage with default context
 * const handler: HandlerCallback = async (ctx) => {
 *   // Access request data
 *   const userId = ctx.request.params.id;
 *   const userData = ctx.request.body;
 *
 *   // Store custom data in state
 *   ctx.state.user = { id: userId, name: 'John' };
 *   ctx.state.requestId = generateRequestId();
 *
 *   // Control response
 *   ctx.response.setStatusCode(200);
 *   ctx.response.addHeaders({ 'X-User-ID': userId });
 *
 *   // Return response body
 *   return { success: true, user: ctx.state.user };
 * };
 *
 * // Advanced usage with custom state typing
 * interface AuthContext extends HandlerCallbackGenerics {
 *   state: {
 *     user: User;
 *     permissions: string[];
 *     session: Session;
 *   };
 * }
 *
 * const authHandler: HandlerCallback<AuthContext> = async (ctx) => {
 *   // Fully type-safe access to state
 *   const { user, permissions, session } = ctx.state;
 *
 *   // No type assertions needed!
 *   if (permissions.includes('admin')) {
 *     ctx.response.setStatusCode(200);
 *     return { message: 'Admin access granted', user };
 *   }
 *
 *   ctx.response.setStatusCode(403);
 *   return { error: 'Insufficient permissions' };
 * };
 * ```
 */
export interface Context<T extends HandlerCallbackGenerics = HandlerCallbackGenerics> {
  /**
   * The incoming request object containing all request data and metadata
   *
   * Provides access to headers, body, query parameters, route parameters, and metadata.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const userId = ctx.request.params.id;
   *   const userData = ctx.request.body;
   *   const authToken = ctx.request.headers.authorization;
   *   const clientIp = ctx.request.ipAddress;
   *
   *   return { userId, userData, hasAuth: !!authToken };
   * };
   * ```
   *
   * @see {@link Request} for complete request interface documentation
   */
  request: Request<T>;

  /**
   * The outgoing response object for controlling HTTP response behavior
   *
   * Provides methods to set status codes, add headers, and control response formatting.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { request, response } = ctx;
   *
   *   response.setStatusCode(201);
   *   response.addHeaders({
   *     'Location': `/api/users/${request.params.id}`,
   *     'X-User-ID': request.params.id
   *   });
   *
   *   return { message: 'User created successfully' };
   * };
   * ```
   *
   * @see {@link Response} for complete response interface documentation
   */
  response: Response;

  /**
   * User-defined state data that persists throughout the request lifecycle
   *
   * State is request-scoped data that can be accessed by route handlers and middleware.
   * Each request gets its own isolated state object that's automatically cleaned up.
   *
   * ## State Lifecycle
   *
   * 1. **Request Start**: State object is created as empty object
   * 2. **Global Hooks**: `beforeAll` hooks can populate state
   * 3. **Route Hooks**: `beforeHooks` can access and modify state
   * 4. **Route Handler**: Your handler can access and modify state
   * 5. **Route Hooks**: `afterHooks` can access state and modify response
   * 6. **Global Hooks**: `afterAll` hooks can access state and modify response
   * 7. **Request End**: State is automatically garbage collected
   *
   * @example
   * ```typescript
   * // Store data in state
   * ctx.state.user = { id: 1, name: 'John' };
   * ctx.state.requestId = generateRequestId();
   *
   * // Access the data
   * const user = ctx.state.user;
   * const requestId = ctx.state.requestId;
   * ```
   */
  state: T['state'] extends Record<string, unknown> ? T['state'] : Record<string, unknown>;

  /**
   * Cookie helper methods for setting and managing cookies
   *
   * Available when cookie parser middleware is used. Provides convenient methods
   * for setting cookies, signing values, and validating signed cookies.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   // Set a cookie
   *   ctx.cookies.set('theme', 'dark', {
   *     httpOnly: true,
   *     secure: true,
   *     maxAge: 86400 // 24 hours
   *   });
   *
   *   // Set a signed cookie
   *   const signedValue = ctx.cookies.sign('sessionId', 'abc123');
   *   ctx.cookies.set('sessionId', signedValue);
   *
   *   // Validate a signed cookie
   *   const signedValue = ctx.request.signedCookies.get('sessionId');
   *   if (signedValue) {
   *     const original = ctx.cookies.unsign('sessionId', signedValue);
   *     if (original === false) {
   *       throw new Error('Cookie was tampered with');
   *     }
   *   }
   *
   *   return { message: 'Cookie set successfully' };
   * };
   * ```
   */
  cookies: {
    /**
     * Set a cookie in the response
     *
     * @param name - Cookie name
     * @param value - Cookie value
     * @param options - Optional cookie attributes
     */
    set: (name: string, value: string, options?: CookieOptions) => void;

    /**
     * Sign a cookie value using HMAC
     *
     * @param name - Cookie name
     * @param value - Cookie value to sign
     * @returns Signed cookie value
     */
    sign: (name: string, value: string) => string;

    /**
     * Validate and unsign a cookie value
     *
     * @param name - Cookie name
     * @param signedValue - Signed cookie value
     * @returns Original value if valid, false if tampered
     */
    unsign: (name: string, signedValue: string) => string | false;
  };
}

/**
 * Represents a route handler function that processes requests and returns responses.
 *
 * This type defines the signature for all route handlers, middleware, and hooks
 * in YinzerFlow. The function receives a context object and can optionally
 * receive an error parameter for error handlers.
 *
 * ## Handler Types
 *
 * - **Route Handlers**: Process requests and return response data
 * - **Middleware**: Modify context or perform side effects
 * - **Hooks**: beforeHooks, afterHooks, beforeAll, afterAll
 * - **Error Handlers**: Handle errors with error parameter
 *
 * ## Return Values
 *
 * Handlers can return:
 * - **Response Data**: Objects, strings, numbers, etc. (automatically JSON serialized)
 * - **Promise**: Async operations that resolve to response data
 * - **Void**: No response body (useful for middleware)
 * - **Error**: Thrown errors are caught by error handlers
 *
 * @template T - Extends HandlerCallbackGenerics for custom typing
 * @param ctx - The request context containing request, response, and state objects
 * @param error - Optional error object (only provided to error handlers)
 * @returns Response data, promise, or void
 *
 * @example
 * ```typescript
 * // Basic route handler
 * const userHandler: HandlerCallback = async (ctx) => {
 *   const userId = ctx.request.params.id;
 *   const user = await getUserById(userId);
 *
 *   return { user, timestamp: new Date().toISOString() };
 * };
 *
 * // Typed route handler with custom state
 * interface UserContext extends HandlerCallbackGenerics {
 *   body: { name: string; email: string };
 *   response: { id: string; name: string; email: string };
 *   state: { user: User; permissions: string[] };
 * }
 *
 * const createUser: HandlerCallback<UserContext> = async (ctx) => {
 *   const { name, email } = ctx.request.body; // Fully typed!
 *   const { user, permissions } = ctx.state;  // Fully typed!
 *
 *   if (!permissions.includes('create')) {
 *     throw new Error('Insufficient permissions');
 *   }
 *
 *   const newUser = await createUserInDatabase({ name, email });
 *
 *   return { id: newUser.id, name: newUser.name, email: newUser.email };
 * };
 *
 * // Middleware that doesn't return data
 * const authMiddleware: HandlerCallback = async (ctx) => {
 *   const token = ctx.request.headers.authorization;
 *   const user = await validateToken(token);
 *
 *   ctx.state.user = user;
 *   ctx.state.isAuthenticated = true;
 *
 *   // No return value needed for middleware
 * };
 *
 * // Error handler
 * const errorHandler: HandlerCallback = async (ctx, error) => {
 *   console.error('Error occurred:', error);
 *
 *   ctx.response.setStatusCode(500);
 *   return {
 *     error: 'Internal server error',
 *     message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
 *   };
 * };
 * ```
 *
 * @see {@link Context} for context interface details
 * @see {@link HandlerCallbackGenerics} for custom typing options
 */
export type HandlerCallback<T extends HandlerCallbackGenerics = HandlerCallbackGenerics> = (
  ctx: Context<T>,
  error?: unknown,
) => Promise<T['response'] | void> | T['response'] | void;
