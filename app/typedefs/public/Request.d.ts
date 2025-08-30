import type { InternalHttpHeaders, InternalHttpMethod } from '@typedefs/constants/http.js';
import type { InternalHandlerCallbackGenerics } from '@typedefs/internal/Generics.d.ts';

/**
 * Request object containing all incoming request data and metadata.
 *
 * The Request interface provides access to HTTP method, path, headers, body,
 * query parameters, route parameters, and client information. It's fully
 * typed through generics for type-safe access to request data.
 *
 * @template T - Extends InternalHandlerCallbackGenerics for custom typing
 *
 * @example
 * ```typescript
 * // Basic request usage
 * const handler: HandlerCallback = async (ctx) => {
 *   const { request } = ctx;
 *
 *   // Access HTTP method and path
 *   console.log(`${request.method} ${request.path}`);
 *
 *   // Access headers
 *   const authToken = request.headers.authorization;
 *   const contentType = request.headers['content-type'];
 *
 *   // Access client IP
 *   console.log(`Request from: ${request.ipAddress}`);
 *
 *   return { method: request.method, path: request.path };
 * };
 *
 * // Typed request with custom body and query
 * interface UserRequest extends InternalHandlerCallbackGenerics {
 *   body: { name: string; email: string; age: number };
 *   query: { page: string; limit: string };
 *   params: { id: string };
 * }
 *
 * const createUser: HandlerCallback<UserRequest> = async (ctx) => {
 *   const { body, query, params } = ctx.request;
 *
 *   // Fully typed access - no type assertions needed!
 *   const { name, email, age } = body;        // string, string, number
 *   const { page, limit } = query;            // string, string
 *   const { id } = params;                    // string
 *
 *   // Parse query parameters
 *   const pageNum = parseInt(page) || 1;
 *   const limitNum = parseInt(limit) || 10;
 *
 *   return {
 *     message: `Creating user ${name} with ID ${id}`,
 *     pagination: { page: pageNum, limit: limitNum }
 *   };
 * };
 * ```
 *
 * @see {@link Context} for the complete request context
 * @see {@link InternalHandlerCallbackGenerics} for custom typing options
 * @see {@link InternalHttpMethod} for available HTTP methods
 * @see {@link InternalHttpHeaders} for available HTTP headers
 */
export interface Request<T extends InternalHandlerCallbackGenerics = InternalHandlerCallbackGenerics> {
  /**
   * The HTTP protocol version (e.g., "HTTP/1.1").
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   if (ctx.request.protocol === 'HTTP/2.0') {
   *     // Use HTTP/2 specific features
   *     ctx.response.addHeaders({ 'X-HTTP-Version': '2.0' });
   *   }
   *
   *   return { protocol: ctx.request.protocol };
   * };
   * ```
   */
  protocol: string;

  /**
   * The HTTP method of the request (GET, POST, PUT, DELETE, etc.).
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { method } = ctx.request;
   *
   *   switch (method) {
   *     case 'GET':
   *       return { action: 'retrieve', data: await getData() };
   *     case 'POST':
   *       return { action: 'create', data: await createData(ctx.request.body) };
   *     case 'PUT':
   *       return { action: 'update', data: await updateData(ctx.request.body) };
   *     case 'DELETE':
   *       return { action: 'delete', data: await deleteData(ctx.request.params.id) };
   *     default:
   *       throw new Error(`Unsupported method: ${method}`);
   *   }
   * };
   * ```
   *
   * @see {@link InternalHttpMethod} for all available HTTP methods
   */
  method: InternalHttpMethod;

  /**
   * The request path/URL without query parameters.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { path } = ctx.request;
   *
   *   // Log the requested path
   *   console.log(`Request to: ${path}`);
   *
   *   // Route-specific logic based on path
   *   if (path.startsWith('/api/v1/')) {
   *     ctx.state.apiVersion = 'v1';
   *   } else if (path.startsWith('/api/v2/')) {
   *     ctx.state.apiVersion = 'v2';
   *   }
   *
   *   return { requestedPath: path, apiVersion: ctx.state.apiVersion };
   * };
   * ```
   */
  path: string;

  /**
   * HTTP headers sent with the request.
   *
   * Headers are case-insensitive and commonly include authorization,
   * content-type, user-agent, and custom headers.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { headers } = ctx.request;
   *
   *   // Authentication
   *   const authToken = headers.authorization;
   *   if (!authToken) {
   *     throw new Error('Authorization header required');
   *   }
   *
   *   // Content type validation
   *   const contentType = headers['content-type'];
   *   if (contentType !== 'application/json') {
   *     throw new Error('Content-Type must be application/json');
   *   }
   *
   *   // Custom headers
   *   const requestId = headers['x-request-id'];
   *   const userId = headers['x-user-id'];
   *
   *   return {
   *     hasAuth: !!authToken,
   *     contentType,
   *     requestId,
   *     userId
   *   };
   * };
   * ```
   *
   * @see {@link InternalHttpHeaders} for all available header names
   */
  headers: Partial<Record<InternalHttpHeaders, string>>;

  /**
   * The parsed request body, typed according to the generic parameter.
   *
   * The body is automatically parsed based on Content-Type header.
   * For JSON requests, this will be the parsed JavaScript object.
   *
   * @example
   * ```typescript
   * // Basic body access
   * const handler: HandlerCallback = async (ctx) => {
   *   const { body } = ctx.request;
   *
   *   // body is typed as 'unknown' by default
   *   if (typeof body === 'object' && body !== null) {
   *     const userData = body as { name: string; email: string };
   *     return { received: userData };
   *   }
   *
   *   return { error: 'Invalid body format' };
   * };
   *
   * // Typed body with generics
   * interface CreateUserRequest extends InternalHandlerCallbackGenerics {
   *   body: { name: string; email: string; age: number };
   * }
   *
   * const createUser: HandlerCallback<CreateUserRequest> = async (ctx) => {
   *   const { name, email, age } = ctx.request.body; // Fully typed!
   *
   *   // Validate age
   *   if (age < 18) {
   *     throw new Error('User must be 18 or older');
   *   }
   *
   *   const user = await createUserInDatabase({ name, email, age });
   *   return { success: true, user };
   * };
   * ```
   *
   * @see {@link InternalHandlerCallbackGenerics} for custom body typing
   */
  body: T['body'];

  /**
   * Query parameters from the URL, typed according to the generic parameter.
   *
   * Query parameters are the key-value pairs after the ? in the URL.
   * They're automatically parsed and made available here.
   *
   * @example
   * ```typescript
   * // Basic query parameter access
   * const handler: HandlerCallback = async (ctx) => {
   *   const { query } = ctx.request;
   *
   *   // query is typed as 'unknown' by default
   *   if (typeof query === 'object' && query !== null) {
   *     const { page, limit, search } = query as { page?: string; limit?: string; search?: string };
   *
   *     const pageNum = parseInt(page || '1');
   *     const limitNum = parseInt(limit || '10');
   *
   *     return { pagination: { page: pageNum, limit: limitNum }, search };
   *   }
   *
   *   return { pagination: { page: 1, limit: 10 } };
   * };
   *
   * // Typed query parameters with generics
   * interface UserListRequest extends InternalHandlerCallbackGenerics {
   *   query: { page: string; limit: string; search?: string; sort?: string };
   * }
   *
   * const listUsers: HandlerCallback<UserListRequest> = async (ctx) => {
   *   const { page, limit, search, sort } = ctx.request.query; // Fully typed!
   *
   *   const pageNum = parseInt(page);
   *   const limitNum = parseInt(limit);
   *
   *   const users = await getUsersFromDatabase({
   *     page: pageNum,
   *     limit: limitNum,
   *     search: search || '',
   *     sort: sort || 'name'
   *   });
   *
   *   return { users, pagination: { page: pageNum, limit: limitNum } };
   * };
   * ```
   *
   * @see {@link InternalHandlerCallbackGenerics} for custom query typing
   */
  query: T['query'];

  /**
   * Route parameters extracted from the URL path, typed according to the generic parameter.
   *
   * Route parameters are the dynamic parts of the URL path (e.g., /users/:id).
   * They're automatically extracted and made available here.
   *
   * @example
   * ```typescript
   * // Basic route parameter access
   * const handler: HandlerCallback = async (ctx) => {
   *   const { params } = ctx.request;
   *
   *   // params is typed as 'unknown' by default
   *   if (typeof params === 'object' && params !== null) {
   *     const { id, category } = params as { id?: string; category?: string };
   *
   *     if (!id) {
   *       throw new Error('User ID is required');
   *     }
   *
   *     return { userId: id, category: category || 'default' };
   *   }
   *
   *   return { error: 'No parameters found' };
   * };
   *
   * // Typed route parameters with generics
   * interface UserDetailRequest extends InternalHandlerCallbackGenerics {
   *   params: { id: string; tab?: string };
   * }
   *
   * const getUser: HandlerCallback<UserDetailRequest> = async (ctx) => {
   *   const { id, tab } = ctx.request.params; // Fully typed!
   *
   *   const user = await getUserById(id);
   *   if (!user) {
   *     throw new Error('User not found');
   *   }
   *
   *   // Return different data based on tab parameter
   *   switch (tab) {
   *     case 'profile':
   *       return { user: { id: user.id, name: user.name, email: user.email } };
   *     case 'settings':
   *       return { user: { id: user.id, preferences: user.preferences } };
   *     default:
   *       return { user };
   *   }
   * };
   * ```
   *
   * @see {@link InternalHandlerCallbackGenerics} for custom params typing
   */
  params: T['params'];

  /**
   * The IP address of the client making the request.
   *
   * **Important**: If you're behind a proxy, load balancer, or reverse proxy,
   * you may need to configure it to forward the real client IP address.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { ipAddress } = ctx.request;
   *
   *   // Log client IP for security and analytics
   *   console.log(`Request from IP: ${ipAddress}`);
   *
   *   // Rate limiting by IP
   *   const requestCount = await getRequestCount(ipAddress);
   *   if (requestCount > 100) {
   *     throw new Error('Rate limit exceeded');
   *   }
   *
   *   // Geolocation (if needed)
   *   const country = await getCountryFromIP(ipAddress);
   *   ctx.state.clientCountry = country;
   *
   *   return {
   *     message: 'Request processed',
   *     clientIP: ipAddress,
   *     country
   *   };
   * };
   * ```
   */
  ipAddress: string;

  /**
   * The raw, unparsed request body as a Buffer or string.
   *
   * This is useful when you need to parse the body manually or when
   * the automatic parsing doesn't meet your needs.
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { rawBody, headers } = ctx.request;
   *
   *   // Manual parsing for specific content types
   *   const contentType = headers['content-type'];
   *
   *   if (contentType === 'application/xml') {
   *     // Parse XML manually
   *     const xmlString = rawBody.toString('utf8');
   *     const xmlDoc = await parseXML(xmlString);
   *     return { parsed: xmlDoc };
   *   }
   *
   *   if (contentType === 'multipart/form-data') {
   *     // Handle file uploads manually
   *     const formData = await parseMultipartFormData(rawBody);
   *     return { files: formData.files, fields: formData.fields };
   *   }
   *
   *   // For other types, use the parsed body
   *   return { body: ctx.request.body, rawBodyLength: rawBody.length };
   * };
   * ```
   */
  rawBody: Buffer | string;
}
