import type { InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { Logger } from '@typedefs/public/Logger.js';
import type { CookieParserOptions } from '@typedefs/public/CookieParser.js';
import type { RateLimitOptions } from '@typedefs/public/RateLimit.js';
import type { TimeString } from '@typedefs/public/Time.js';

/**
 * Internal CORS Configuration Options
 * Provides fine-grained control over Cross-Origin Resource Sharing
 */
export type InternalCorsOptions = InternalCorsDisabledConfiguration | InternalCorsEnabledConfiguration;

/**
 * Internal CORS Disabled Configuration
 */
export interface InternalCorsDisabledConfiguration {
  /**
   * Disable CORS handling
   */
  enabled: false;
}

/**
 * Internal CORS Enabled Configuration
 * When CORS is enabled, origin is required
 */
export interface InternalCorsEnabledConfiguration {
  /**
   * Enable CORS handling
   */
  enabled: true;

  /**
   * Allowed origins for CORS requests (REQUIRED when enabled)
   * - string: Single origin (e.g., 'https://example.com')
   * - string[]: Multiple specific origins
   * - '*': Allow all origins (not recommended for production with credentials)
   * - function: Dynamic origin validation
   */
  origin: Array<string> | RegExp | string | ((origin: string | undefined, request: any) => boolean);

  /**
   * HTTP methods allowed for CORS requests
   * @default ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
   */
  methods: Array<string>;

  /**
   * Headers allowed in CORS requests   *
   * @default ['*']
   *
   * These are the headers that will be allowed in each request.
   * These headers typically include things like 'Content-Type', 'Authorization', 'X-Requested-With', etc.
   * Other common headers would include headers needed for third party services like stripe or AWS via webhooks.
   */
  allowedHeaders: Array<string> | string | '*';

  /**
   * Headers exposed to the client in CORS responses
   * @default []
   *
   * These are headers that in simple terms give the client "Permission" to access the headers in the response.
   * For more context, the response can send as many headers as it wants, but the client can only access the headers that are exposed
   * in this array.
   */
  exposedHeaders: Array<string>;

  /**
   * Allow credentials (cookies, authorization headers) in CORS requests
   * Note: When true, origin cannot be '*'
   * @default false
   */
  credentials: boolean;

  /**
   * Maximum age (in seconds) for preflight cache
   * Tells browser how long to cache preflight response (client-side only)
   * @default 86400 (24 hours)
   */
  maxAge: number;

  /**
   * Continue to route handler after preflight
   * - false: Handle preflight completely in CORS system (recommended)
   * - true: Pass preflight to route handlers (requires manual OPTIONS routes)
   * @default false
   */
  preflightContinue: boolean;

  /**
   * Status code for successful OPTIONS requests
   * @default 204
   */
  optionsSuccessStatus: InternalHttpStatusCode;
}

/**
 * Internal Body Parser Security Configuration
 * Protects against DoS attacks, prototype pollution, and memory exhaustion
 */
export interface InternalBodyParserConfiguration {
  /**
   * JSON parsing security configuration
   */
  json: InternalJsonParserConfiguration;

  /**
   * File upload security configuration
   */
  fileUploads: InternalFileUploadConfiguration;

  /**
   * URL-encoded form data configuration
   */
  urlEncoded: InternalUrlEncodedConfiguration;
}

/**
 * Internal JSON Parser Security Configuration
 * Protects against JSON-specific attacks like prototype pollution and DoS
 */
export interface InternalJsonParserConfiguration {
  /**
   * Maximum JSON request body size in bytes
   * @default 262144 (256KB) - reasonable for API payloads
   * @min 1024 (1KB)
   */
  maxSize: number;

  /**
   * Maximum JSON nesting depth to prevent stack overflow attacks
   * @default 10
   * @min 1
   */
  maxDepth: number;

  /**
   * Allow prototype properties (__proto__, constructor, prototype) in JSON
   * SECURITY WARNING: Setting this to true enables prototype pollution attacks
   * @default false
   */
  allowPrototypeProperties: boolean;

  /**
   * Maximum number of keys in JSON objects to prevent memory exhaustion
   * @default 1000
   * @min 10
   */
  maxKeys: number;

  /**
   * Maximum length of JSON string values to prevent memory exhaustion
   * @default 1048576 (1MB)
   * @min 100
   */
  maxStringLength: number;

  /**
   * Maximum number of array elements to prevent memory exhaustion
   * @default 10000
   * @min 10
   */
  maxArrayLength: number;
}

/**
 * Internal File Upload Security Configuration
 */
export interface InternalFileUploadConfiguration {
  /**
   * Maximum size per file in bytes
   * @default 10485760 (10MB) - reasonable for documents/images
   * @min 1024 (1KB)
   */
  maxFileSize: number;

  /**
   * Maximum total size of all files in a single request
   * @default 52428800 (50MB)
   * @min 1024 (1KB)
   */
  maxTotalSize: number;

  /**
   * Maximum number of files per request
   * @default 10
   * @min 1
   */
  maxFiles: number;

  /**
   * Allowed file extensions (empty array allows all)
   * @default [] (all extensions allowed)
   * @example ['.jpg', '.png', '.pdf', '.txt']
   */
  allowedExtensions: Array<string>;

  /**
   * Blocked file extensions for security
   * @default ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com']
   */
  blockedExtensions: Array<string>;

  /**
   * Maximum filename length to prevent path issues
   * @default 255
   * @min 10
   */
  maxFilenameLength: number;
}

/**
 * Internal URL-encoded Configuration
 */
export interface InternalUrlEncodedConfiguration {
  /**
   * Maximum URL-encoded form data size in bytes
   * @default 1048576 (1MB)
   * @min 1024 (1KB)
   */
  maxSize: number;

  /**
   * Maximum number of form fields
   * @default 1000
   * @min 10
   */
  maxFields: number;

  /**
   * Maximum field name length
   * @default 100
   * @min 5
   */
  maxFieldNameLength: number;

  /**
   * Maximum field value length
   * @default 1048576 (1MB)
   * @min 100
   */
  maxFieldLength: number;
}

/**
 * Internal IP Security Configuration
 */
export interface InternalIpValidationConfig {
  /**
   * List of trusted proxy IP addresses that are allowed to set forwarded headers
   * Only these IPs can provide X-Forwarded-For and similar headers
   * Use '*' to trust any proxy (less secure but useful for complex/unknown infrastructure)
   * @default ['127.0.0.1', '::1']
   * @example ['127.0.0.1', '::1', '192.168.1.10'] // Specific proxies
   * @example ['*'] // Trust any proxy (enables spoofing detection without proxy validation)
   */
  trustedProxies: Array<string>;

  /**
   * Allow private IP addresses (RFC 1918, RFC 4193, RFC 3927) as client IPs
   * Set to false for public-facing APIs that should only receive public IPs
   * @default true
   */
  allowPrivateIps: boolean;

  /**
   * Header preference order for IP extraction
   * YinzerFlow will check headers in this order and use the first valid one
   * @default ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'x-client-ip', 'true-client-ip']
   */
  headerPreference: Array<string>;

  /**
   * Maximum allowed length of IP chain in forwarded headers
   * Prevents DoS attacks through extremely long proxy chains
   * @default 10
   * @min 1
   * @max 50
   */
  maxChainLength: number;

  /**
   * Enable spoofing pattern detection
   * Detects suspicious patterns like duplicate IPs, mixed valid/invalid IPs
   * @default true
   */
  detectSpoofing: boolean;
}

/**
 * Complete internal server configuration shape - single source of truth
 * This defines ALL possible configuration options with their required types
 * Used as the foundation for both internal (complete) and public (partial) configurations
 */
export interface InternalServerConfiguration {
  /**
   * Port number for the server to listen on
   * @default 5000
   */
  port: number;

  /**
   * Host address to bind the server to
   * @default '0.0.0.0'
   */
  host: string;

  /**
   * Custom logger instance
   *
   * Use createLogger() to create logger instances with custom configuration
   * @default undefined (uses built-in logger with default settings)
   *
   * @example
   * ```typescript
   * const logger = createLogger({ prefix: 'APP', logLevel: 'info' });
   * new YinzerFlow({ logger });
   * ```
   */
  logger?: Logger;

  /**
   * Network request/response logging (nginx-style logs)
   * Completely separate from application logs - simple on/off toggle
   * @default false
   */
  networkLogs: boolean;

  /**
   * Custom logger for network logs (optional)
   * If provided, network logs will be routed to this logger instead of built-in formatting
   * Can be the same as the application logger or a different one
   * Useful for unified monitoring (e.g., Winston with Datadog transport for both app and network logs)
   * @default undefined (uses built-in network logging)
   */
  networkLogger?: Logger;

  /**
   * Cross-Origin Resource Sharing configuration
   */
  cors: InternalCorsOptions;

  /**
   * Body parsing configuration with security limits
   */
  bodyParser: InternalBodyParserConfiguration;

  /**
   * IP address security and validation configuration
   */
  ipSecurity: InternalIpValidationConfig;

  /**
   * Rate limiting configuration
   * Protects against DoS attacks and API abuse by limiting requests per IP
   * @default enabled with 100 requests per 15 minutes
   */
  rateLimit?: RateLimitOptions;

  /**
   * Cookie parser configuration
   * Parses incoming cookies and provides cookie management with HMAC signing
   * @default disabled
   */
  cookieParser?: CookieParserOptions;

  /**
   * Graceful shutdown timeout configuration
   * When set to a value greater than 0, YinzerFlow automatically sets up signal handlers for SIGTERM and SIGINT
   * and waits for all requests to complete before shutting down.
   * If the value is 0 (disabled), you must manually handle graceful shutdown by calling `app.close()` and `process.exit(0)`.
   * Note: If using container orchestrations, your container configuration should be at least 1 second more
   * than the graceful shutdown timeout to ensure all requests are completed, otherwise the container will be
   * killed before all requests are completed.
   * @default true
   */
  gracefulShutdownTimeout: TimeString | number;
}
