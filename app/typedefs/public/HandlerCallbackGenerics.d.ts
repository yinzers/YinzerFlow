/**
 * Generic types for handler callbacks that define the structure of request data
 *
 * This interface allows you to customize the types of body, response, query,
 * params, and state data that your handlers can work with. Extend this interface
 * to create type-safe contexts for your specific use cases.
 *
 * @example
 * ```typescript
 * // Basic usage with default types
 * const handler: HandlerCallback = async (ctx) => {
 *   // ctx.request.body is unknown
 *   // ctx.state is Record<string, unknown>
 *   return { message: 'Hello' };
 * };
 *
 * // Custom types for specific endpoints
 * interface UserCreateContext extends HandlerCallbackGenerics {
 *   body: { name: string; email: string; age: number };
 *   response: { id: string; name: string; email: string };
 *   state: { requestId: string; userAgent: string };
 * }
 *
 * const createUser: HandlerCallback<UserCreateContext> = async (ctx) => {
 *   // Fully typed!
 *   const { name, email, age } = ctx.request.body; // Type: { name: string; email: string; age: number }
 *   const { requestId, userAgent } = ctx.state;    // Type: { requestId: string; userAgent: string }
 *
 *   const user = await createUserInDatabase({ name, email, age });
 *
 *   return { id: user.id, name: user.name, email: user.email }; // Must match response type
 * };
 * ```
 */
export interface HandlerCallbackGenerics {
  /**
   * The expected type of the request body
   *
   * Defaults to `unknown` for safety. Override with your specific body schema
   * to get full type safety and IntelliSense.
   *
   * @example
   * ```typescript
   * interface LoginContext extends HandlerCallbackGenerics {
   *   body: { username: string; password: string };
   * }
   *
   * const login: HandlerCallback<LoginContext> = async (ctx) => {
   *   const { username, password } = ctx.request.body; // Fully typed!
   *   // ... authentication logic
   * };
   * ```
   */
  body?: unknown;

  /**
   * The expected type of the response data
   *
   * Defaults to `unknown`. Override to ensure your handler returns the correct
   * data structure and get compile-time validation.
   *
   * @example
   * ```typescript
   * interface UserListContext extends HandlerCallbackGenerics {
   *   response: { users: Array<{ id: string; name: string }>; total: number };
   * }
   *
   * const listUsers: HandlerCallback<UserListContext> = async (ctx) => {
   *   const users = await getUsersFromDatabase();
   *
   *   // TypeScript will ensure this matches the response type
   *   return {
   *     users: users.map(u => ({ id: u.id, name: u.name })),
   *     total: users.length
   *   };
   * };
   * ```
   */
  response?: unknown;

  /**
   * The expected type of query parameters
   *
   * Defaults to `Record<string, string>`. Override for more specific query
   * parameter validation and typing.
   *
   * @example
   * ```typescript
   * interface SearchContext extends HandlerCallbackGenerics {
   *   query: { q: string; limit?: string; page?: string };
   * }
   *
   * const search: HandlerCallback<SearchContext> = async (ctx) => {
   *   const { q, limit = '10', page = '1' } = ctx.request.query;
   *   const limitNum = parseInt(limit);
   *   const pageNum = parseInt(page);
   *
   *   // ... search logic
   * };
   * ```
   */
  query?: Record<string, unknown>;

  /**
   * The expected type of route parameters
   *
   * Defaults to `Record<string, string>`. Override for more specific route
   * parameter validation and typing.
   *
   * @example
   * ```typescript
   * interface UserDetailContext extends HandlerCallbackGenerics {
   *   params: { id: string; tab?: string };
   * }
   *
   * const getUser: HandlerCallback<UserDetailContext> = async (ctx) => {
   *   const { id, tab = 'profile' } = ctx.request.params;
   *
   *   // ... user retrieval logic
   * };
   * ```
   */
  params?: Record<string, string>;

  /**
   * User-defined state data that persists throughout the request lifecycle
   *
   * This allows you to store custom data like:
   * - Authenticated user information
   * - Request-scoped variables
   * - Middleware data
   * - Custom context information
   *
   * @example
   * ```typescript
   * interface AuthContext extends HandlerCallbackGenerics {
   *   state: {
   *     user: User;
   *     permissions: string[];
   *     requestId: string;
   *   };
   * }
   *
   * const handler: HandlerCallback<AuthContext> = async (ctx) => {
   *   // Fully typed state access
   *   const { user, permissions, requestId } = ctx.state;
   *
   *   if (permissions.includes('admin')) {
   *     return { message: 'Admin access granted', user };
   *   }
   *
   *   return { error: 'Insufficient permissions' };
   * };
   * ```
   */
  state?: Record<string, unknown>;
}
