import type { InternalHttpHeaders, InternalHttpStatusCode } from '@typedefs/constants/http.js';

/**
 * Public facing response object for controlling HTTP responses.
 *
 * The Response interface provides methods to control the HTTP response
 * that will be sent to the client, including status codes and headers.
 *
 * @example
 * ```typescript
 * // Basic response control
 * const handler: HandlerCallback = async (ctx) => {
 *   const { response } = ctx;
 *
 *   // Set success status code
 *   response.setStatusCode(200);
 *
 *   // Add response headers
 *   response.addHeaders({
 *     'Content-Type': 'application/json',
 *     'Cache-Control': 'max-age=3600'
 *   });
 *
 *   return { message: 'Success' };
 * };
 *
 * // Advanced response with custom headers
 * const handler: HandlerCallback = async (ctx) => {
 *   const { response, request } = ctx;
 *
 *   // Set appropriate status based on operation
 *   if (request.method === 'POST') {
 *     response.setStatusCode(201); // Created
 *   } else if (request.method === 'PUT') {
 *     response.setStatusCode(200); // OK
 *   }
 *
 *   // Add security headers
 *   response.addHeaders({
 *     'X-Content-Type-Options': 'nosniff',
 *     'X-Frame-Options': 'DENY',
 *     'X-XSS-Protection': '1; mode=block'
 *   });
 *
 *   return { success: true };
 * };
 * ```
 *
 * @see {@link InternalHttpStatusCode} for available status codes
 * @see {@link InternalHttpHeaders} for available header names
 */
export interface Response {
  /**
   * Sets the HTTP status code for the response.
   *
   * Common status codes:
   * - **2xx Success**: 200 (OK), 201 (Created), 204 (No Content)
   * - **3xx Redirection**: 301 (Moved), 302 (Found), 304 (Not Modified)
   * - **4xx Client Error**: 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)
   * - **5xx Server Error**: 500 (Internal Server Error), 502 (Bad Gateway)
   *
   * @param statusCode - The HTTP status code to set
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { response, request } = ctx;
   *
   *   try {
   *     if (request.method === 'POST') {
   *       // Resource created successfully
   *       response.setStatusCode(201);
   *       return { message: 'Resource created' };
   *     }
   *
   *     if (request.method === 'DELETE') {
   *       // Resource deleted successfully
   *       response.setStatusCode(204);
   *       return; // No content for DELETE
   *     }
   *
   *     // Default success response
   *     response.setStatusCode(200);
   *     return { message: 'Operation successful' };
   *
   *   } catch (error) {
   *     if (error.name === 'ValidationError') {
   *       response.setStatusCode(400);
   *       return { error: 'Validation failed', details: error.message };
   *     }
   *
   *     if (error.name === 'UnauthorizedError') {
   *       response.setStatusCode(401);
   *       return { error: 'Unauthorized' };
   *     }
   *
   *     // Default error response
   *     response.setStatusCode(500);
   *     return { error: 'Internal server error' };
   *   }
   * };
   * ```
   *
   * @see {@link InternalHttpStatusCode} for all available status codes
   */
  setStatusCode: (statusCode: InternalHttpStatusCode) => void;

  /**
   * Adds or updates HTTP response headers.
   *
   * Headers are key-value pairs that provide metadata about the response.
   * Common headers include Content-Type, Cache-Control, and custom headers.
   *
   * @param headers - Object containing header names and values
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { response, request } = ctx;
   *
   *   // Set basic response headers
   *   response.addHeaders({
   *     'Content-Type': 'application/json',
   *     'Cache-Control': 'max-age=3600, public'
   *   });
   *
   *   // Add security headers
   *   response.addHeaders({
   *     'X-Content-Type-Options': 'nosniff',
   *     'X-Frame-Options': 'DENY',
   *     'X-XSS-Protection': '1; mode=block',
   *     'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
   *   });
   *
   *   // Add custom headers
   *   response.addHeaders({
   *     'X-API-Version': 'v1.0.0',
   *     'X-Request-ID': generateRequestId(),
   *     'X-Processing-Time': `${Date.now() - ctx.state.startTime}ms`
   *   });
   *
   *   // CORS headers for cross-origin requests
   *   response.addHeaders({
   *     'Access-Control-Allow-Origin': '*',
   *     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
   *     'Access-Control-Allow-Headers': 'Content-Type, Authorization'
   *   });
   *
   *   return { message: 'Headers set successfully' };
   * };
   * ```
   *
   * @see {@link InternalHttpHeaders} for all available header names
   */
  addHeaders: (headers: Partial<Record<InternalHttpHeaders, string>>) => void;

  /**
   * Removes specific HTTP response headers by name.
   *
   * This is useful when you want to remove headers that might have been
   * set by default or by previous middleware.
   *
   * @param headerNames - Array of header names to remove
   *
   * @example
   * ```typescript
   * const handler: HandlerCallback = async (ctx) => {
   *   const { response } = ctx;
   *
   *   // Remove default headers that might interfere
   *   response.removeHeaders([
   *     'X-Powered-By',
   *     'Server',
   *     'Date'
   *   ]);
   *
   *   // Add custom headers
   *   response.addHeaders({
   *     'X-Custom-Header': 'Custom Value',
   *     'Cache-Control': 'no-cache, no-store, must-revalidate'
   *   });
   *
   *   return { message: 'Custom response configured' };
   * };
   *
   * // Conditional header removal
   * const conditionalHandler: HandlerCallback = async (ctx) => {
   *   const { response, request } = ctx;
   *
   *   // Remove cache headers for sensitive operations
   *   if (request.method === 'POST' || request.method === 'PUT') {
   *     response.removeHeaders(['Cache-Control', 'ETag', 'Last-Modified']);
   *
   *     // Add no-cache headers
   *     response.addHeaders({
   *       'Cache-Control': 'no-cache, no-store, must-revalidate',
   *       'Pragma': 'no-cache',
   *       'Expires': '0'
   *     });
   *   }
   *
   *   return { message: 'Response configured based on method' };
   * };
   * ```
   *
   * @see {@link InternalHttpHeaders} for all available header names
   */
  removeHeaders: (headerNames: Array<InternalHttpHeaders>) => void;
}
