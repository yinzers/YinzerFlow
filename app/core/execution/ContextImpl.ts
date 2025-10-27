import { RequestImpl } from '@core/execution/RequestImpl.ts';
import { ResponseImpl } from '@core/execution/ResponseImpl.ts';
import type { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.js';
import type { InternalRequestImpl } from '@typedefs/internal/InternalRequestImpl.js';
import type { InternalResponseImpl } from '@typedefs/internal/InternalResponseImpl.js';
import type { CookieOptions } from '@typedefs/public/CookieParser.js';
import type { Request } from '@typedefs/public/Request.ts';
import type { Response } from '@typedefs/public/Response.ts';

/**
 * ContextImpl is the core class that handles the building of the context.
 * It is responsible for building the request and response objects, plus
 * managing user-defined state data.
 *
 * ## What is ContextImpl?
 *
 * ContextImpl is the concrete implementation of the Context interface. It's
 * automatically created for each incoming request and provides a unified
 * interface for accessing request data, controlling responses, and managing
 * request-scoped state.
 *
 * ## How ContextImpl Works
 *
 * 1. **Construction**: Creates RequestImpl and ResponseImpl instances
 * 2. **State Initialization**: Initializes empty state object for user data
 * 3. **Request Processing**: Handles raw request data and builds structured request
 * 4. **Response Control**: Provides methods to control HTTP response behavior
 * 5. **State Management**: Allows middleware and handlers to store custom data
 * 6. **Cleanup**: Automatically garbage collected when request completes
 *
 * @example
 * ```typescript
 * // ContextImpl is automatically created for each request
 * const context = new ContextImpl(rawRequest, setup, clientAddress);
 *
 * // Access request data
 * const userId = context.request.params.id;
 * const userData = context.request.body;
 *
 * // Store custom state
 * context.state.user = { id: userId, name: 'John' };
 * context.state.requestId = generateRequestId();
 *
 * // Control response
 * context.response.setStatusCode(200);
 * context.response.addHeaders({ 'X-User-ID': userId });
 *
 * // Return response data
 * return { success: true, user: context.state.user };
 * ```
 *
 * @see {@link Context} for the public interface
 * @see {@link RequestImpl} for request implementation details
 * @see {@link ResponseImpl} for response implementation details
 * @see {@link InternalContextImpl} for internal interface details
 */
export class ContextImpl implements InternalContextImpl {
  readonly _request: InternalRequestImpl;
  readonly _response: InternalResponseImpl;

  /**
   * The incoming request object containing all request data and metadata.
   *
   * Provides access to headers, body, query parameters, route parameters,
   * and client information like IP address.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   // Access route parameters
   *   const userId = ctx.request.params.id;
   *
   *   // Access request body
   *   const userData = ctx.request.body;
   *
   *   // Access headers
   *   const authToken = ctx.request.headers.authorization;
   *
   *   // Access client information
   *   const clientIp = ctx.request.ipAddress;
   *
   *   return { userId, userData, hasAuth: !!authToken };
   * };
   * ```
   *
   * @see {@link Request} for complete request interface documentation
   */
  request: Request;

  /**
   * The outgoing response object for controlling HTTP response behavior.
   *
   * Provides methods to set status codes, add headers, and control
   * response formatting and content.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { request, response } = ctx;
   *
   *   // Set successful status code
   *   response.setStatusCode(201);
   *
   *   // Add custom headers
   *   response.addHeaders({
   *     'Location': `/api/users/${request.params.id}`,
   *     'X-User-ID': request.params.id,
   *     'Cache-Control': 'max-age=3600'
   *   });
   *
   *   // Return response body (Content-Type automatically set)
   *   return { message: 'User created successfully' };
   * };
   * ```
   *
   * @see {@link Response} for complete response interface documentation
   */
  response: Response;

  /**
   * User-defined state data that persists throughout the request lifecycle.
   *
   * This property allows middleware and route handlers to store and share
   * custom data. The state is request-scoped and will be automatically garbage
   * collected when the request completes and the context goes out of scope.
   *
   * ## State Lifecycle
   *
   * 1. **Request Start**: State object is created as empty object
   * 2. **Global Hooks**: `beforeAll` hooks can populate state
   * 3. **Route Hooks**: `beforeHooks` can access and modify state
   * 4. **Route Handler**: Your handler can access and modify state
   * 5. **Route Hooks**: `afterHooks` can access state and modify response
   * 6. **Global Hooks**: `afterAll` hooks can access state and modify response
   * 7. **Request End**: Context goes out of scope and is automatically garbage collected
   *
   * @example
   * ```typescript
   * // Authentication middleware
   * const authMiddleware: HandlerCallback = async (ctx) => {
   *   const token = ctx.request.headers.authorization;
   *   const user = await validateToken(token);
   *
   *   // Store user data in state for route handlers
   *   ctx.state.user = user;
   *   ctx.state.permissions = await getUserPermissions(user.id);
   *   ctx.state.isAuthenticated = true;
   * };
   *
   * // Route that uses the authenticated state
   * app.get('/api/admin/users', authMiddleware, async (ctx) => {
   *   // Access the user data set by middleware
   *   const { user, permissions, isAuthenticated } = ctx.state;
   *
   *   if (!permissions.includes('admin')) {
   *     throw new Error('Insufficient permissions');
   *   }
   *
   *   // Add route-specific state
   *   ctx.state.routeAccessed = true;
   *   ctx.state.lastAccess = new Date();
   *
   *   return { message: 'Admin access granted', user };
   * });
   * ```
   *
   * @see {@link Context} for complete context interface documentation
   */
  state: Record<string, unknown> = {};

  /**
   * Creates a new ContextImpl instance for handling a single request.
   *
   * @param rawRequest - The raw request data (Buffer or string) from the client
   * @param setup - The SetupImpl instance that manages routes and hooks
   * @param clientAddress - Optional client IP address for security and logging
   *
   * @example
   * ```typescript
   * // ContextImpl is typically created internally by YinzerFlow
   * const context = new ContextImpl(
   *   Buffer.from('GET /api/users HTTP/1.1...'),
   *   setupInstance,
   *   '192.168.1.100'
   * );
   *
   * // Access the context properties
   * console.log(context.request.method);    // "GET"
   * console.log(context.request.url);       // "/api/users"
   * console.log(context.request.ipAddress); // "192.168.1.100"
   * ```
   *
   * @see {@link SetupImpl} for setup implementation details
   * @see {@link RequestImpl} for request building details
   * @see {@link ResponseImpl} for response building details
   */
  cookies: {
    set: (name: string, value: string, options?: CookieOptions) => void;
    sign: (name: string, value: string) => string;
    unsign: (name: string, signedValue: string) => string | false;
  } = {
    set: (_name: string, _value: string, _options?: unknown): void => {
      // Initialized by cookieParserHook if enabled
    },
    sign: (_name: string, _value: string): string => '',
    unsign: (_name: string, _signedValue: string): string | false => false,
  };

  constructor(rawRequest: Buffer | string, setup: SetupImpl, clientAddress?: string) {
    this._request = new RequestImpl(rawRequest, setup, clientAddress);
    this._response = new ResponseImpl(this._request);

    this.request = this._request;
    this.response = this._response;
  }
}
