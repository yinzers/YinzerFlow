import type { CreateEnum } from '@typedefs/internal/Generics.ts';
import type { contentType, httpEncoding, httpHeaders, httpMethod, httpStatus, httpStatusCode } from '@constants/http.ts';

/**
 * HTTP status text constants for response messages.
 *
 * Maps status codes to their standard text representations as defined
 * in RFC 7231 and other HTTP specifications.
 *
 * @example
 * ```typescript
 * // Using status text in responses
 * ctx.response.setStatusCode(200);
 * return {
 *   status: InternalHttpStatus.ok,        // 'OK'
 *   message: 'Request processed successfully'
 * };
 *
 * // Error responses
 * ctx.response.setStatusCode(404);
 * return {
 *   error: InternalHttpStatus.notFound,   // 'Not Found'
 *   message: 'Resource not found'
 * };
 *
 * // Status text lookup
 * const getStatusText = (code: number): string => {
 *   switch (code) {
 *     case 200: return InternalHttpStatus.ok;
 *     case 201: return InternalHttpStatus.created;
 *     case 400: return InternalHttpStatus.badRequest;
 *     case 404: return InternalHttpStatus.notFound;
 *     case 500: return InternalHttpStatus.internalServerError;
 *     default: return 'Unknown Status';
 *   }
 * };
 * ```
 *
 * @see {@link InternalHttpStatusCode} for corresponding status codes
 * @see {@link httpStatus} for the underlying constant values
 */
export type InternalHttpStatus = CreateEnum<typeof httpStatus>;

/**
 * HTTP status code constants for response status.
 *
 * Standard HTTP status codes used in responses to indicate
 * the result of processing a request.
 *
 * ## Status Code Categories
 *
 * - **2xx Success**: Request was successful
 * - **3xx Redirection**: Further action needed
 * - **4xx Client Error**: Request was invalid
 * - **5xx Server Error**: Server failed to process request
 *
 * @example
 * ```typescript
 * // Setting response status codes
 * ctx.response.setStatusCode(InternalHttpStatusCode.ok);           // 200
 * ctx.response.setStatusCode(InternalHttpStatusCode.created);      // 201
 * ctx.response.setStatusCode(InternalHttpStatusCode.noContent);    // 204
 *
 * // Error handling
 * try {
 *   const result = await processRequest(ctx.request);
 *   ctx.response.setStatusCode(InternalHttpStatusCode.ok);
 *   return result;
 * } catch (error) {
 *   if (error.name === 'ValidationError') {
 *     ctx.response.setStatusCode(InternalHttpStatusCode.badRequest);        // 400
 *     return { error: 'Validation failed' };
 *   }
 *
 *   if (error.name === 'UnauthorizedError') {
 *     ctx.response.setStatusCode(InternalHttpStatusCode.unauthorized);      // 401
 *     return { error: 'Unauthorized' };
 *   }
 *
 *   ctx.response.setStatusCode(InternalHttpStatusCode.internalServerError); // 500
 *   return { error: 'Internal server error' };
 * }
 *
 * // Status code validation
 * const isValidStatusCode = (code: number): boolean => {
 *   return Object.values(InternalHttpStatusCode).includes(code as any);
 * };
 * ```
 *
 * @see {@link InternalHttpStatus} for corresponding status text
 * @see {@link httpStatusCode} for the underlying constant values
 */
export type InternalHttpStatusCode = CreateEnum<typeof httpStatusCode>;

/**
 * HTTP method constants for request methods.
 *
 * Standard HTTP methods used in requests to specify the desired
 * action to be performed on the identified resource.
 *
 * ## HTTP Methods
 *
 * - **GET**: Retrieve a resource
 * - **POST**: Create a new resource
 * - **PUT**: Replace an entire resource
 * - **PATCH**: Partially modify a resource
 * - **DELETE**: Remove a resource
 * - **HEAD**: Get resource metadata only
 * - **OPTIONS**: Get available methods
 *
 * @example
 * ```typescript
 * // Method-based routing
 * const handleRequest = async (ctx: Context) => {
 *   switch (ctx.request.method) {
 *     case InternalHttpMethod.get:
 *       return await getResource(ctx.request.params.id);
 *
 *     case InternalHttpMethod.post:
 *       return await createResource(ctx.request.body);
 *
 *     case InternalHttpMethod.put:
 *       return await updateResource(ctx.request.params.id, ctx.request.body);
 *
 *     case InternalHttpMethod.patch:
 *       return await patchResource(ctx.request.params.id, ctx.request.body);
 *
 *     case InternalHttpMethod.delete:
 *       return await deleteResource(ctx.request.params.id);
 *
 *     case InternalHttpMethod.options:
 *       return { methods: ['GET', 'POST', 'PUT', 'DELETE'] };
 *
 *     default:
 *       throw new Error(`Method ${ctx.request.method} not supported`);
 *   }
 * };
 *
 * // Method validation
 * const isReadMethod = (method: string): boolean => {
 *   return method === InternalHttpMethod.get || method === InternalHttpMethod.head;
 * };
 *
 * const isWriteMethod = (method: string): boolean => {
 *   return [InternalHttpMethod.post, InternalHttpMethod.put,
 *           InternalHttpMethod.patch, InternalHttpMethod.delete].includes(method as any);
 * };
 * ```
 *
 * @see {@link httpMethod} for the underlying constant values
 */
export type InternalHttpMethod = CreateEnum<typeof httpMethod>;

/**
 * HTTP content type constants for media types.
 *
 * MIME types used to specify the format of data being sent
 * in HTTP requests and responses.
 *
 * ## Common Content Types
 *
 * - **JSON**: application/json
 * - **HTML**: text/html
 * - **Form Data**: application/x-www-form-urlencoded
 * - **Multipart**: multipart/form-data
 * - **XML**: application/xml
 * - **Plain Text**: text/plain
 * - **CSV**: text/csv
 * - **YAML**: application/yaml, text/yaml
 *
 * @example
 * ```typescript
 * // Setting content type headers
 * ctx.response.addHeaders({
 *   'Content-Type': InternalContentType.json
 * });
 *
 * // Content type validation
 * const validateContentType = (contentType: string): boolean => {
 *   const allowedTypes = [
 *     InternalContentType.json,
 *     InternalContentType.form,
 *     InternalContentType.multipart
 *   ];
 *   return allowedTypes.includes(contentType as any);
 * };
 *
 * // File upload handling
 * const handleFileUpload = async (ctx: Context) => {
 *   const contentType = ctx.request.headers['content-type'];
 *
 *   if (contentType === InternalContentType.multipart) {
 *     // Handle multipart form data
 *     return await processMultipartUpload(ctx.request.rawBody);
 *   }
 *
 *   if (contentType === InternalContentType.json) {
 *     // Handle JSON data
 *     return await processJSONData(ctx.request.body);
 *   }
 *
 *   throw new Error(`Unsupported content type: ${contentType}`);
 * };
 *
 * // API response formatting
 * const formatResponse = (data: unknown, format: string) => {
 *   switch (format) {
 *     case 'json':
 *       ctx.response.addHeaders({ 'Content-Type': InternalContentType.json });
 *       return JSON.stringify(data);
 *
 *     case 'xml':
 *       ctx.response.addHeaders({ 'Content-Type': InternalContentType.xml });
 *       return convertToXML(data);
 *
 *     case 'csv':
 *       ctx.response.addHeaders({ 'Content-Type': InternalContentType.csv });
 *       return convertToCSV(data);
 *
 *     default:
 *       ctx.response.addHeaders({ 'Content-Type': InternalContentType.text });
 *       return String(data);
 *   }
 * };
 * ```
 *
 * @see {@link contentType} for the underlying constant values
 */
export type InternalContentType = CreateEnum<typeof contentType>;

/**
 * HTTP encoding constants for content encoding.
 *
 * Specifies how content is encoded or compressed in HTTP messages.
 *
 * ## Encoding Types
 *
 * - **base64**: Base64 encoding for binary data
 * - **binary**: Raw binary data
 * - **utf8**: UTF-8 text encoding
 *
 * @example
 * ```typescript
 * // Content encoding handling
 * const processContent = async (data: Buffer, encoding: string) => {
 *   switch (encoding) {
 *     case InternalHttpEncoding.base64:
 *       return Buffer.from(data.toString(), 'base64');
 *
 *     case InternalHttpEncoding.utf8:
 *       return data.toString('utf8');
 *
 *     case InternalHttpEncoding.binary:
 *       return data; // Already binary
 *
 *     default:
 *       throw new Error(`Unsupported encoding: ${encoding}`);
 *   }
 * };
 *
 * // Response encoding
 * const sendEncodedResponse = (data: string | Buffer, encoding: string) => {
 *   ctx.response.addHeaders({
 *     'Content-Encoding': encoding,
 *     'Content-Type': InternalContentType.text
 *   });
 *
 *   if (encoding === InternalHttpEncoding.base64) {
 *     return Buffer.from(data).toString('base64');
 *   }
 *
 *   return data;
 * };
 * ```
 *
 * @see {@link httpEncoding} for the underlying constant values
 */
export type InternalHttpEncoding = CreateEnum<typeof httpEncoding>;

/**
 * HTTP header constants for request and response headers.
 *
 * Comprehensive collection of HTTP header names organized by category,
 * including standard headers, security headers, and custom headers.
 *
 * ## Header Categories
 *
 * - **Authentication**: Authorization, WWW-Authenticate
 * - **Caching**: Cache-Control, ETag, Expires
 * - **Content**: Content-Type, Content-Length, Content-Encoding
 * - **CORS**: Access-Control-Allow-*, Access-Control-Request-*
 * - **Security**: Content-Security-Policy, X-Frame-Options
 * - **Custom**: X-Powered-By, X-Request-ID
 *
 * @example
 * ```typescript
 * // Setting security headers
 * ctx.response.addHeaders({
 *   [InternalHttpHeaders.contentSecurityPolicy]: "default-src 'self'",
 *   [InternalHttpHeaders.xFrameOptions]: 'DENY',
 *   [InternalHttpHeaders.xContentTypeOptions]: 'nosniff',
 *   [InternalHttpHeaders.strictTransportSecurity]: 'max-age=31536000'
 * });
 *
 * // CORS headers
 * ctx.response.addHeaders({
 *   [InternalHttpHeaders.accessControlAllowOrigin]: '*',
 *   [InternalHttpHeaders.accessControlAllowMethods]: 'GET, POST, PUT, DELETE',
 *   [InternalHttpHeaders.accessControlAllowHeaders]: 'Content-Type, Authorization'
 * });
 *
 * // Custom headers
 * ctx.response.addHeaders({
 *   [InternalHttpHeaders.xRequestId]: generateRequestId(),
 *   [InternalHttpHeaders.xProcessingTime]: `${processingTime}ms`
 * });
 *
 * // Header validation
 * const isSecurityHeader = (headerName: string): boolean => {
 *   const securityHeaders = [
 *     InternalHttpHeaders.contentSecurityPolicy,
 *     InternalHttpHeaders.xFrameOptions,
 *     InternalHttpHeaders.xContentTypeOptions,
 *     InternalHttpHeaders.strictTransportSecurity
 *   ];
 *   return securityHeaders.includes(headerName as any);
 * };
 *
 * // Request header processing
 * const processRequestHeaders = (headers: Record<string, string>) => {
 *   const authToken = headers[InternalHttpHeaders.authorization];
 *   const contentType = headers[InternalHttpHeaders.contentType];
 *   const userAgent = headers[InternalHttpHeaders.userAgent];
 *
 *   // Process headers...
 *   return { authToken, contentType, userAgent };
 * };
 * ```
 *
 * @see {@link httpHeaders} for the underlying constant values
 * @see {@link Request} for accessing headers in requests
 * @see {@link Response} for setting headers in responses
 */
export type InternalHttpHeaders = Lowercase<CreateEnum<typeof httpHeaders>> | string;
