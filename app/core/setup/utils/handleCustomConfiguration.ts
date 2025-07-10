import type { ServerConfiguration } from '@typedefs/public/Configuration.js';
import type { InternalServerConfiguration } from '@typedefs/internal/InternalConfiguration.js';
import { logLevels } from '@constants/log.ts';
import { httpStatusCode } from '@constants/http.ts';
import { log } from '@core/utils/log.ts';

/**
 * Default CORS configuration for when CORS is enabled
 */
const DEFAULT_CORS_ENABLED_CONFIG = {
  enabled: true,
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: '*',
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: httpStatusCode.noContent,
};

/**
 * Default body parser configuration with secure defaults
 */
const DEFAULT_BODY_PARSER_CONFIG = {
  json: {
    maxSize: 262144, // 256KB - reasonable for JSON APIs (Express uses 100KB)
    maxDepth: 10, // Prevent deeply nested objects that can cause stack overflow
    allowPrototypeProperties: false, // SECURITY: Block prototype pollution by default
    maxKeys: 1000, // Prevent memory exhaustion from objects with too many keys
    maxStringLength: 1048576, // 1MB per string - prevent memory exhaustion
    maxArrayLength: 10000, // Prevent memory exhaustion from large arrays
  },
  fileUploads: {
    maxFileSize: 10485760, // 10MB per file - reasonable for documents/images
    maxTotalSize: 52428800, // 50MB total - prevent bulk upload attacks
    maxFiles: 10, // Reasonable number of files per request
    allowedExtensions: [], // Empty array = all extensions allowed
    blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'], // Block dangerous executables
    maxFilenameLength: 255, // Standard filesystem limit
  },
  urlEncoded: {
    maxSize: 1048576, // 1MB for form data
    maxFields: 1000, // Prevent field spam attacks
    maxFieldNameLength: 100, // Reasonable field name length
    maxFieldLength: 1048576, // 1MB per field value
  },
};

/**
 * Default IP security configuration with secure defaults
 */
const DEFAULT_IP_SECURITY_CONFIG = {
  trustedProxies: ['127.0.0.1', '::1'], // Localhost only by default
  allowPrivateIps: true, // Allow private IPs for internal usage
  headerPreference: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'x-client-ip', 'true-client-ip'],
  maxChainLength: 10, // Reasonable proxy chain length
  detectSpoofing: true, // Enable security by default
};

/**
 * Default configuration object
 */
const DEFAULT_CONFIGURATION: InternalServerConfiguration = {
  port: 5000,
  host: '0.0.0.0',
  logLevel: logLevels.warn,
  networkLogs: false,
  cors: {
    enabled: false, // Disabled by default
  },
  bodyParser: DEFAULT_BODY_PARSER_CONFIG,
  ipSecurity: DEFAULT_IP_SECURITY_CONFIG,
  connectionOptions: {
    socketTimeout: 30000,
    gracefulShutdownTimeout: 30000,
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
  },
  autoGracefulShutdown: true, // Enabled by default
};

/**
 * Validate JSON parser configuration minimums
 */
const _validateJsonConfig = (config: InternalServerConfiguration['bodyParser']['json']): void => {
  if (config.maxSize < 1) {
    throw new Error('bodyParser.json.maxSize must be at least 1 byte');
  }

  if (config.maxDepth < 1) {
    throw new Error('bodyParser.json.maxDepth must be at least 1');
  }

  if (config.maxKeys < 1) {
    throw new Error('bodyParser.json.maxKeys must be at least 1');
  }

  if (config.maxStringLength < 1) {
    throw new Error('bodyParser.json.maxStringLength must be at least 1 byte');
  }

  if (config.maxArrayLength < 1) {
    throw new Error('bodyParser.json.maxArrayLength must be at least 1');
  }
};

/**
 * Validate file upload configuration minimums
 */
const _validateFileUploadConfig = (config: InternalServerConfiguration['bodyParser']['fileUploads']): void => {
  if (config.maxFileSize < 1) {
    throw new Error('bodyParser.fileUploads.maxFileSize must be at least 1 byte');
  }

  if (config.maxTotalSize < 1) {
    throw new Error('bodyParser.fileUploads.maxTotalSize must be at least 1 byte');
  }

  if (config.maxFiles < 1) {
    throw new Error('bodyParser.fileUploads.maxFiles must be at least 1');
  }

  if (config.maxFilenameLength < 1) {
    throw new Error('bodyParser.fileUploads.maxFilenameLength must be at least 1 character');
  }
};

/**
 * Validate URL-encoded configuration minimums
 */
const _validateUrlEncodedConfig = (config: InternalServerConfiguration['bodyParser']['urlEncoded']): void => {
  if (config.maxSize < 1) {
    throw new Error('bodyParser.urlEncoded.maxSize must be at least 1 byte');
  }

  if (config.maxFields < 1) {
    throw new Error('bodyParser.urlEncoded.maxFields must be at least 1');
  }

  if (config.maxFieldNameLength < 1) {
    throw new Error('bodyParser.urlEncoded.maxFieldNameLength must be at least 1 character');
  }

  if (config.maxFieldLength < 1) {
    throw new Error('bodyParser.urlEncoded.maxFieldLength must be at least 1 byte');
  }
};

/**
 * Validate IP security configuration minimums
 */
const _validateIpSecurityConfig = (config: InternalServerConfiguration['ipSecurity']): void => {
  if (!Array.isArray(config.trustedProxies)) {
    throw new Error('ipSecurity.trustedProxies must be an array');
  }

  if (!Array.isArray(config.headerPreference)) {
    throw new Error('ipSecurity.headerPreference must be an array');
  }

  if (config.headerPreference.length === 0) {
    throw new Error('ipSecurity.headerPreference must contain at least one header');
  }

  if (config.maxChainLength < 1) {
    throw new Error('ipSecurity.maxChainLength must be at least 1');
  }

  if (config.maxChainLength > 50) {
    throw new Error('ipSecurity.maxChainLength must not exceed 50 to prevent DoS attacks');
  }
};

/**
 * Issue security warnings for risky JSON configurations
 */
const _warnJsonConfig = (config: InternalServerConfiguration['bodyParser']['json']): void => {
  if (config.allowPrototypeProperties) {
    log.warn(
      '[SECURITY WARNING] bodyParser.json.allowPrototypeProperties is enabled. This allows prototype pollution attacks. ' +
        'Only enable this if you absolutely need it and have other protections in place.',
    );
  }

  // Warn about very large JSON sizes (but don't block them)
  if (config.maxSize > 10485760) {
    // 10MB
    log.warn(
      `[SECURITY WARNING] bodyParser.json.maxSize is set to ${config.maxSize} bytes (${Math.round(config.maxSize / 1024 / 1024)}MB). ` +
        'Large JSON payloads can cause memory exhaustion and DoS attacks. Consider if this size is necessary.',
    );
  }

  // Warn about very deep nesting (but don't block it)
  if (config.maxDepth > 50) {
    log.warn(
      `[SECURITY WARNING] bodyParser.json.maxDepth is set to ${config.maxDepth}. ` +
        'Very deep JSON nesting can cause stack overflow attacks. Consider if this depth is necessary.',
    );
  }
};

/**
 * Issue security warnings for risky file upload configurations
 */
const _warnFileUploadConfig = (config: InternalServerConfiguration['bodyParser']['fileUploads']): void => {
  // Warn about very large file uploads (but don't block them)
  if (config.maxFileSize > 104857600) {
    // 100MB
    log.warn(
      `[SECURITY WARNING] bodyParser.fileUploads.maxFileSize is set to ${config.maxFileSize} bytes (${Math.round(config.maxFileSize / 1024 / 1024)}MB). ` +
        'Large file uploads can consume significant server resources.',
    );
  }

  if (config.maxTotalSize > 1073741824) {
    // 1GB
    log.warn(
      `[SECURITY WARNING] bodyParser.fileUploads.maxTotalSize is set to ${config.maxTotalSize} bytes (${Math.round(config.maxTotalSize / 1024 / 1024 / 1024)}GB). ` +
        'Very large total upload sizes can cause memory and disk space exhaustion.',
    );
  }

  // Validate file extension security
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.vbs', '.jar', '.app'];
  const allowedDangerous = config.allowedExtensions.filter((ext) => dangerousExtensions.includes(ext.toLowerCase()));

  if (allowedDangerous.length > 0) {
    log.warn(
      `[SECURITY WARNING] bodyParser.fileUploads.allowedExtensions includes dangerous file types: ${allowedDangerous.join(', ')}. ` +
        'This could allow execution of malicious files. Only allow these if absolutely necessary.',
    );
  }

  // Warn if no blocked extensions and no allowed extensions (completely open)
  if (config.blockedExtensions.length === 0 && config.allowedExtensions.length === 0) {
    log.warn(
      '[SECURITY WARNING] File uploads have no extension restrictions (no blockedExtensions and no allowedExtensions). ' +
        'Consider adding blockedExtensions or allowedExtensions to improve security.',
    );
  }
};

/**
 * Issue security warnings for risky IP security configurations
 */
const _warnIpSecurityConfig = (config: InternalServerConfiguration['ipSecurity']): void => {
  // Warn about wildcard or overly permissive trusted proxies
  if (config.trustedProxies.length === 0) {
    log.warn('[SECURITY WARNING] ipSecurity.trustedProxies is empty. No proxy headers will be trusted, which may prevent proper client IP detection.');
  }

  // Warn about very long proxy chains
  if (config.maxChainLength > 20) {
    log.warn(
      `[SECURITY WARNING] ipSecurity.maxChainLength is set to ${config.maxChainLength}. ` +
        'Very long proxy chains can consume significant resources and may indicate amplification attacks.',
    );
  }

  // Warn if spoofing detection is disabled
  if (!config.detectSpoofing) {
    log.warn(
      '[SECURITY WARNING] ipSecurity.detectSpoofing is disabled. ' +
        'This reduces protection against IP spoofing attacks. Only disable if you have other protective measures.',
    );
  }
};

/**
 * Handle CORS configuration merging
 */
const _handleCorsConfig = (defaultConfig: InternalServerConfiguration, userConfig?: ServerConfiguration): void => {
  if (userConfig?.cors?.enabled) {
    // When CORS is enabled, merge with enabled defaults
    // We ensure enabled is literally true to satisfy the type constraint
    defaultConfig.cors = {
      ...DEFAULT_CORS_ENABLED_CONFIG,
      ...userConfig.cors,
      enabled: true, // Override to ensure literal true type
    };
  }
};

/**
 * Handle body parser configuration merging and validation
 */
const _handleBodyParserConfig = (defaultConfig: InternalServerConfiguration, userConfig?: ServerConfiguration): void => {
  if (userConfig?.bodyParser) {
    defaultConfig.bodyParser = {
      json: {
        ...DEFAULT_BODY_PARSER_CONFIG.json,
        ...userConfig.bodyParser.json,
      },
      fileUploads: {
        ...DEFAULT_BODY_PARSER_CONFIG.fileUploads,
        ...userConfig.bodyParser.fileUploads,
      },
      urlEncoded: {
        ...DEFAULT_BODY_PARSER_CONFIG.urlEncoded,
        ...userConfig.bodyParser.urlEncoded,
      },
    };

    // Validate configuration for security
    _validateBodyParserConfig(defaultConfig.bodyParser);
  }
};

/**
 * Handle IP security configuration merging and validation
 */
const _handleIpSecurityConfig = (defaultConfig: InternalServerConfiguration, userConfig?: ServerConfiguration): void => {
  if (userConfig?.ipSecurity) {
    defaultConfig.ipSecurity = {
      ...DEFAULT_IP_SECURITY_CONFIG,
      ...userConfig.ipSecurity,
    };

    // Validate configuration for security
    _validateIpSecurityConfig(defaultConfig.ipSecurity);
    _warnIpSecurityConfig(defaultConfig.ipSecurity);
  }
};

/**
 * Validate port number
 */
const _validatePort = (defaultConfig: InternalServerConfiguration, userConfig?: ServerConfiguration): void => {
  if (userConfig?.port !== undefined) {
    const normalizedPort = Number(userConfig.port);
    if (isNaN(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
      throw new Error('Invalid port number');
    }
    defaultConfig.port = normalizedPort;
  }
};

/**
 * Validate body parser configuration to prevent broken settings and warn about risky configurations
 */
const _validateBodyParserConfig = (config: InternalServerConfiguration['bodyParser']): void => {
  // Validate minimums for all parser types
  _validateJsonConfig(config.json);
  _validateFileUploadConfig(config.fileUploads);
  _validateUrlEncodedConfig(config.urlEncoded);

  // Issue security warnings for risky configurations (but don't block them)
  _warnJsonConfig(config.json);
  _warnFileUploadConfig(config.fileUploads);
};

/**
 * Handle custom configuration
 */
export const handleCustomConfiguration = (configuration?: ServerConfiguration): InternalServerConfiguration => {
  // Start with default configuration
  const result = { ...DEFAULT_CONFIGURATION };

  // Merge user configuration with proper handling of nested objects
  Object.assign(result, configuration);

  // Handle special configuration sections
  _handleCorsConfig(result, configuration);
  _handleBodyParserConfig(result, configuration);
  _handleIpSecurityConfig(result, configuration);
  _validatePort(result, configuration);

  return result;
};
