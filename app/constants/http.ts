/**
 * HTTP Constants
 *
 * This file contains all HTTP-related constants used throughout the application.
 * Centralizing these constants makes them easier to maintain and ensures consistency.
 */

/**
 * HTTP Status Text
 * Maps status codes to their standard text representations
 */
// Use const assertions for better tree-shaking
export const httpStatus = {
  ok: 'OK',
  created: 'Created',
  accepted: 'Accepted',
  noContent: 'No Content',
  movedPermanently: 'Moved Permanently',
  found: 'Found',
  notModified: 'Not Modified',
  badRequest: 'Bad Request',
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  notFound: 'Not Found',
  methodNotAllowed: 'Method Not Allowed',
  conflict: 'Conflict',
  unsupportedMediaType: 'Unsupported Media Type',
  tooManyRequests: 'Too Many Requests',
  internalServerError: 'Internal Server Error',
} as const;

/**
 * HTTP Status Codes
 * Standard HTTP status codes used in responses
 */
export const httpStatusCode = {
  ok: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  movedPermanently: 301,
  found: 302,
  notModified: 304,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  conflict: 409,
  unsupportedMediaType: 415,
  tooManyRequests: 429,
  internalServerError: 500,
} as const;

/**
 * HTTP Methods
 * Standard HTTP methods used in requests
 */
export const httpMethod = {
  delete: 'DELETE',
  get: 'GET',
  head: 'HEAD',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  options: 'OPTIONS',
} as const;

/**
 * Common Content Types
 * Frequently used content types for HTTP communication
 */
export const contentType = {
  json: 'application/json',
  html: 'text/html',
  form: 'application/x-www-form-urlencoded',
  multipart: 'multipart/form-data',
  xml: 'application/xml',
  text: 'text/plain',
  csv: 'text/csv',
  yamlApplication: 'application/yaml',
  yamlText: 'text/yaml',
  urlEncodedJson: 'application/x-www-form-urlencoded+json',
} as const;

/**
 * HTTP header names organized by category
 * Use with CreateEnum to get type-safe header names with intellisense
 */
export const httpHeaders = {
  // Authentication & Authorization
  authorization: 'Authorization', // Bearer tokens, Basic auth, etc.
  proxyAuthorization: 'Proxy-Authorization', // Auth through proxy
  wwwAuthenticate: 'WWW-Authenticate', // Server auth challenge

  // Caching & Validation
  cacheControl: 'Cache-Control', // Cache directives
  etag: 'ETag', // Resource version identifier
  expires: 'Expires', // Cache expiration date
  lastModified: 'Last-Modified', // Resource modification date
  ifMatch: 'If-Match', // Conditional request based on ETag
  ifNoneMatch: 'If-None-Match', // Conditional request based on ETag
  ifModifiedSince: 'If-Modified-Since', // Conditional request based on date
  ifUnmodifiedSince: 'If-Unmodified-Since', // Conditional request based on date
  ifRange: 'If-Range', // Conditional range request
  age: 'Age', // Time in proxy cache
  vary: 'Vary', // Response varies based on headers

  // Content Information
  contentType: 'Content-Type', // Media type of content
  contentLength: 'Content-Length', // Size in bytes
  contentEncoding: 'Content-Encoding', // Compression method
  contentLanguage: 'Content-Language', // Natural language
  contentDisposition: 'Content-Disposition', // Inline vs attachment
  contentLocation: 'Content-Location', // Alternate location
  contentRange: 'Content-Range', // Partial content range

  // CORS (Cross-Origin Resource Sharing)
  accessControlAllowCredentials: 'Access-Control-Allow-Credentials', // Allow credentials in CORS
  accessControlAllowHeaders: 'Access-Control-Allow-Headers', // Allowed request headers
  accessControlAllowMethods: 'Access-Control-Allow-Methods', // Allowed HTTP methods
  accessControlAllowOrigin: 'Access-Control-Allow-Origin', // Allowed origins
  accessControlExposeHeaders: 'Access-Control-Expose-Headers', // Exposed response headers
  accessControlMaxAge: 'Access-Control-Max-Age', // Preflight cache duration
  accessControlRequestHeaders: 'Access-Control-Request-Headers', // Preflight request headers
  accessControlRequestMethod: 'Access-Control-Request-Method', // Preflight request method

  // Request Information
  accept: 'Accept', // Acceptable media types
  acceptEncoding: 'Accept-Encoding', // Acceptable encodings
  acceptLanguage: 'Accept-Language', // Acceptable languages
  acceptRanges: 'Accept-Ranges', // Server supports ranges
  host: 'Host', // Target host and port
  userAgent: 'User-Agent', // Client software info
  referer: 'Referer', // Previous page URL
  origin: 'Origin', // Request origin
  from: 'From', // User email address
  expect: 'Expect', // Server requirements

  // Response Information
  location: 'Location', // Redirect URL
  server: 'Server', // Server software info
  date: 'Date', // Message timestamp
  allow: 'Allow', // Supported HTTP methods
  retryAfter: 'Retry-After', // Retry delay

  // Range Requests
  range: 'Range', // Requested byte range

  // Security Headers
  contentSecurityPolicy: 'Content-Security-Policy', // CSP directives
  contentSecurityPolicyReportOnly: 'Content-Security-Policy-Report-Only', // CSP report mode
  strictTransportSecurity: 'Strict-Transport-Security', // HTTPS enforcement
  xContentTypeOptions: 'X-Content-Type-Options', // Prevent MIME sniffing
  xFrameOptions: 'X-Frame-Options', // Clickjacking protection
  xXSSProtection: 'X-XSS-Protection', // XSS filter control
  referrerPolicy: 'Referrer-Policy', // Referrer info policy
  permissionsPolicy: 'Permissions-Policy', // Feature permissions
  crossOriginEmbedderPolicy: 'Cross-Origin-Embedder-Policy', // Embedding control
  crossOriginOpenerPolicy: 'Cross-Origin-Opener-Policy', // Window opening control
  crossOriginResourcePolicy: 'Cross-Origin-Resource-Policy', // Resource sharing control

  // Cookies
  cookie: 'Cookie', // Client cookies
  setCookie: 'Set-Cookie', // Server cookie instructions

  // Connection Management
  connection: 'Connection', // Connection control
  keepAlive: 'Keep-Alive', // Keep-alive parameters
  upgrade: 'Upgrade', // Protocol upgrade
  upgradeInsecureRequests: 'Upgrade-Insecure-Requests', // HTTPS upgrade

  // Transfer & Encoding
  transferEncoding: 'Transfer-Encoding', // Transfer encoding method
  te: 'TE', // Acceptable transfer encodings
  trailer: 'Trailer', // Trailer field names

  // Proxy & Forwarding
  forwarded: 'Forwarded', // Proxy information
  xForwardedFor: 'X-Forwarded-For', // Proxy information
  via: 'Via', // Proxy chain info
  maxForwards: 'Max-Forwards', // Hop limit

  // Alternative Services
  altSvc: 'Alt-Svc', // Alternative services
  altUsed: 'Alt-Used', // Used alternative service

  // Timing & Performance
  timingAllowOrigin: 'Timing-Allow-Origin', // Timing API access
  serverTiming: 'Server-Timing', // Server performance metrics

  // Refresh & Links
  refresh: 'Refresh', // Auto-refresh directive
  link: 'Link', // Related resources

  // Custom & Extension Headers
  xPoweredBy: 'X-Powered-By', // Server technology
  xPermittedCrossDomainPolicies: 'X-Permitted-Cross-Domain-Policies', // Flash policy
  reportTo: 'Report-To', // Error reporting endpoint
  serviceWorkerAllowed: 'Service-Worker-Allowed', // Service worker scope
  sourceMap: 'SourceMap', // Source map location
  priority: 'Priority', // Request priority
  secGPC: 'Sec-GPC', // Global Privacy Control

  // Data & Clearing
  clearSiteData: 'Clear-Site-Data', // Clear browser data
  noVarySearch: 'No-Vary-Search', // Search param cache control
} as const;

export const httpEncoding = {
  base64: 'base64',
  binary: 'binary',
  utf8: 'utf8',
} as const;
