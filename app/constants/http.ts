/**
 * HTTP Constants
 *
 * This file contains all HTTP-related constants used throughout the application.
 * Centralizing these constants makes them easier to maintain and ensures consistency.
 */

/**
 * HTTP Status Text
 * Reason phrases for every status code in the IANA HTTP Status Code Registry (RFC 9110 and its extensions), plus 418,
 * which RFC 9110 reserves but clients widely recognize. 306 is unused and left out. A code that isn't listed still works:
 * it is sent with its class's phrase (see mapStatusCodeToMessage).
 */
// Use const assertions for better tree-shaking
export const httpStatus = {
  continue: 'Continue',
  switchingProtocols: 'Switching Protocols',
  processing: 'Processing',
  earlyHints: 'Early Hints',
  ok: 'OK',
  created: 'Created',
  accepted: 'Accepted',
  nonAuthoritativeInformation: 'Non-Authoritative Information',
  noContent: 'No Content',
  resetContent: 'Reset Content',
  partialContent: 'Partial Content',
  multiStatus: 'Multi-Status',
  alreadyReported: 'Already Reported',
  imUsed: 'IM Used',
  multipleChoices: 'Multiple Choices',
  movedPermanently: 'Moved Permanently',
  found: 'Found',
  seeOther: 'See Other',
  notModified: 'Not Modified',
  useProxy: 'Use Proxy',
  temporaryRedirect: 'Temporary Redirect',
  permanentRedirect: 'Permanent Redirect',
  badRequest: 'Bad Request',
  unauthorized: 'Unauthorized',
  paymentRequired: 'Payment Required',
  forbidden: 'Forbidden',
  notFound: 'Not Found',
  methodNotAllowed: 'Method Not Allowed',
  notAcceptable: 'Not Acceptable',
  proxyAuthenticationRequired: 'Proxy Authentication Required',
  requestTimeout: 'Request Timeout',
  conflict: 'Conflict',
  gone: 'Gone',
  lengthRequired: 'Length Required',
  preconditionFailed: 'Precondition Failed',
  contentTooLarge: 'Content Too Large',
  uriTooLong: 'URI Too Long',
  unsupportedMediaType: 'Unsupported Media Type',
  rangeNotSatisfiable: 'Range Not Satisfiable',
  expectationFailed: 'Expectation Failed',
  imATeapot: "I'm a teapot",
  misdirectedRequest: 'Misdirected Request',
  unprocessableContent: 'Unprocessable Content',
  locked: 'Locked',
  failedDependency: 'Failed Dependency',
  tooEarly: 'Too Early',
  upgradeRequired: 'Upgrade Required',
  preconditionRequired: 'Precondition Required',
  tooManyRequests: 'Too Many Requests',
  requestHeaderFieldsTooLarge: 'Request Header Fields Too Large',
  unavailableForLegalReasons: 'Unavailable For Legal Reasons',
  internalServerError: 'Internal Server Error',
  notImplemented: 'Not Implemented',
  badGateway: 'Bad Gateway',
  serviceUnavailable: 'Service Unavailable',
  gatewayTimeout: 'Gateway Timeout',
  httpVersionNotSupported: 'HTTP Version Not Supported',
  variantAlsoNegotiates: 'Variant Also Negotiates',
  insufficientStorage: 'Insufficient Storage',
  loopDetected: 'Loop Detected',
  notExtended: 'Not Extended',
  networkAuthenticationRequired: 'Network Authentication Required',
} as const;

/**
 * HTTP Status Codes
 * Every code in the IANA HTTP Status Code Registry, plus 418, keyed like httpStatus
 */
export const httpStatusCode = {
  continue: 100,
  switchingProtocols: 101,
  processing: 102,
  earlyHints: 103,
  ok: 200,
  created: 201,
  accepted: 202,
  nonAuthoritativeInformation: 203,
  noContent: 204,
  resetContent: 205,
  partialContent: 206,
  multiStatus: 207,
  alreadyReported: 208,
  imUsed: 226,
  multipleChoices: 300,
  movedPermanently: 301,
  found: 302,
  seeOther: 303,
  notModified: 304,
  useProxy: 305,
  temporaryRedirect: 307,
  permanentRedirect: 308,
  badRequest: 400,
  unauthorized: 401,
  paymentRequired: 402,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  notAcceptable: 406,
  proxyAuthenticationRequired: 407,
  requestTimeout: 408,
  conflict: 409,
  gone: 410,
  lengthRequired: 411,
  preconditionFailed: 412,
  contentTooLarge: 413,
  uriTooLong: 414,
  unsupportedMediaType: 415,
  rangeNotSatisfiable: 416,
  expectationFailed: 417,
  imATeapot: 418,
  misdirectedRequest: 421,
  unprocessableContent: 422,
  locked: 423,
  failedDependency: 424,
  tooEarly: 425,
  upgradeRequired: 426,
  preconditionRequired: 428,
  tooManyRequests: 429,
  requestHeaderFieldsTooLarge: 431,
  unavailableForLegalReasons: 451,
  internalServerError: 500,
  notImplemented: 501,
  badGateway: 502,
  serviceUnavailable: 503,
  gatewayTimeout: 504,
  httpVersionNotSupported: 505,
  variantAlsoNegotiates: 506,
  insufficientStorage: 507,
  loopDetected: 508,
  notExtended: 510,
  networkAuthenticationRequired: 511,
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
