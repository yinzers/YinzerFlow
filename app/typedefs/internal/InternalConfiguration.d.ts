/* eslint-disable max-lines */
import type { CreateEnum } from '@typedefs/internal/Generics.js';
import type { logLevels } from '@constants/log.js';
import type { InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { Logger } from '@typedefs/public/Logger.js';

/**
 * Internal CORS Configuration Options
 * Provides fine-grained control over Cross-Origin Resource Sharing
 */
export type InternalCorsConfiguration = InternalCorsDisabledConfiguration | InternalCorsEnabledConfiguration;

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
 * Internal Connection Options
 */
export interface InternalConnectionOptions {
  /**
   * Default socket timeout in milliseconds (30 seconds)
   *
   * Standard timeout for most socket connections.
   * It is long enough for slow clients but short enough to prevent idle connections from staying open indefinitely.
   */
  socketTimeout: number;

  /**
   * Default graceful shutdown timeout in milliseconds (30 seconds)
   *
   * This is the maximum time to wait for a connection to complete before the server will close it.
   */
  gracefulShutdownTimeout: number;

  /**
   * Default keep-alive timeout in milliseconds (65 seconds)
   *
   * This is the maximum time a connection can be idle before the server will close it.
   * This is to allow for a connection to stay open for a period of time so subsequent requests can be handled without a new connection.
   * This is also to prevent a connection from staying open indefinitely.
   * This is also useful for load balancing and preventing a single server from being overwhelmed by a large number of connections.
   * AWS recommends a keep-alive timeout of 65 seconds because there idle timeout is 60 seconds.
   */
  keepAliveTimeout: number;

  /**
   * Default headers timeout in milliseconds (66 seconds)
   *
   * This is the maximum time to wait for a header from the client.
   * This is to allow for a connection to stay open for a period of time so subsequent requests can be handled without a new connection.
   * This is also to prevent a connection from staying open indefinitely.
   * This is also useful for load balancing and preventing a single server from being overwhelmed by a large number of connections.
   * It is recommended to set this value to be greater than the keep-alive timeout to prevent the server from closing the connection prematurely
   * before the keep-alive timeout has expired.
   */
  headersTimeout: number;
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
   * Application logging level for YinzerFlow server
   * - 'off': No application logging (silent mode)
   * - 'error': Only error messages
   * - 'warn': Warning and error messages
   * - 'info': All application logging with Pittsburgh personality
   * @default 'warn'
   */
  logLevel: CreateEnum<typeof logLevels>;

  /**
   * Custom logger implementation
   * If provided, this logger will be used instead of the built-in YinzerFlow logger
   * Must implement the Logger interface
   * @default undefined (uses built-in logger)
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
  cors: InternalCorsConfiguration;

  /**
   * Body parsing configuration with security limits
   */
  bodyParser: InternalBodyParserConfiguration;

  /**
   * IP address security and validation configuration
   */
  ipSecurity: InternalIpValidationConfig;

  /**
   * Server connection options
   */
  connectionOptions: InternalConnectionOptions;

  /**
   * Automatic graceful shutdown configuration
   * When enabled, YinzerFlow automatically sets up signal handlers for SIGTERM and SIGINT
   * @default true
   */
  autoGracefulShutdown: boolean;
}
