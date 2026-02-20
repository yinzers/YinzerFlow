import type { ServerOptions } from '@typedefs/public/Configuration.js';
import type { InternalLoggingOptions, InternalServerOptions } from '@typedefs/internal/InternalConfiguration.js';
import { log, loggerBrand } from '@core/utils/log.ts';
import { logLevels } from '@constants/log.ts';
import { _convertTimeToMs } from '@core/utils/time.ts';
import { _convertBytesToBytes, _formatBytesForDisplay } from '@core/utils/bytes.ts';

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
 * Default diagnostics configuration — all disabled (zero noise)
 */
const DEFAULT_DIAGNOSTICS_CONFIG = {
  slowRequests: false as const,
  largeResponses: false as const,
  largeRequests: false as const,
  memory: false as const,
  eventLoop: false as const,
  rateLimits: false,
};

/**
 * Default logging configuration
 */
const DEFAULT_LOGGING_CONFIG: InternalLoggingOptions = {
  level: 'warn',
  prefix: 'YINZER',
  personality: true,
  requests: false,
  diagnostics: DEFAULT_DIAGNOSTICS_CONFIG,
};

/**
 * Default configuration object
 */
const DEFAULT_CONFIGURATION: InternalServerOptions = {
  port: 5000,
  host: '0.0.0.0',
  gracefulShutdownTimeout: '15m', // Enabled by default
  cors: {
    enabled: false, // Disabled by default
  },
  logging: DEFAULT_LOGGING_CONFIG,
  bodyParser: DEFAULT_BODY_PARSER_CONFIG,
  ipSecurity: DEFAULT_IP_SECURITY_CONFIG,
};

/**
 * Validate JSON parser configuration minimums
 */
const _validateJsonConfig = (config: InternalServerOptions['bodyParser']['json']): void => {
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
const _validateFileUploadConfig = (config: InternalServerOptions['bodyParser']['fileUploads']): void => {
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
const _validateUrlEncodedConfig = (config: InternalServerOptions['bodyParser']['urlEncoded']): void => {
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
const _validateIpSecurityConfig = (config: InternalServerOptions['ipSecurity']): void => {
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
const _warnJsonConfig = (config: InternalServerOptions['bodyParser']['json']): void => {
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
      `[SECURITY WARNING] bodyParser.json.maxSize is set to ${config.maxSize} bytes (${_formatBytesForDisplay(config.maxSize)}). ` +
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
const _warnFileUploadConfig = (config: InternalServerOptions['bodyParser']['fileUploads']): void => {
  // Warn about very large file uploads (but don't block them)
  if (config.maxFileSize > 104857600) {
    // 100MB
    log.warn(
      `[SECURITY WARNING] bodyParser.fileUploads.maxFileSize is set to ${config.maxFileSize} bytes (${_formatBytesForDisplay(config.maxFileSize)}). ` +
        'Large file uploads can consume significant server resources.',
    );
  }

  if (config.maxTotalSize > 1073741824) {
    // 1GB
    log.warn(
      `[SECURITY WARNING] bodyParser.fileUploads.maxTotalSize is set to ${config.maxTotalSize} bytes (${_formatBytesForDisplay(config.maxTotalSize)}). ` +
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
const _warnIpSecurityConfig = (config: InternalServerOptions['ipSecurity']): void => {
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
 * Handle body parser configuration merging and validation
 */
const _handleBodyParserConfig = (defaultConfig: InternalServerOptions, userConfig?: ServerOptions): void => {
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
const _handleIpSecurityConfig = (defaultConfig: InternalServerOptions, userConfig?: ServerOptions): void => {
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
const _validatePort = (defaultConfig: InternalServerOptions, userConfig?: ServerOptions): void => {
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
const _validateBodyParserConfig = (config: InternalServerOptions['bodyParser']): void => {
  // Validate minimums for all parser types
  _validateJsonConfig(config.json);
  _validateFileUploadConfig(config.fileUploads);
  _validateUrlEncodedConfig(config.urlEncoded);

  // Issue security warnings for risky configurations (but don't block them)
  _warnJsonConfig(config.json);
  _warnFileUploadConfig(config.fileUploads);
};

/**
 * Valid log level values for validation
 */
const VALID_LOG_LEVELS = new Set(Object.values(logLevels));

/**
 * Keys that have dedicated deep-merge handlers in handleCustomConfiguration.
 * These are skipped during the shallow merge pass to avoid clobbering the
 * deep-merged result with a raw user-provided value.
 */
const DEEP_MERGE_KEYS = new Set(['logging', 'bodyParser', 'ipSecurity']);

/**
 * Validate a single diagnostic threshold field (TimeString or ByteString).
 * Wraps the converter call, re-throws with a descriptive field-specific message.
 */
const _validateThresholdField = (opts: { field: string; value: number | string; converter: (v: never) => number; examples: string }): void => {
  try {
    opts.converter(opts.value as never);
  } catch {
    throw new Error(`logging.diagnostics.${opts.field} must be a valid threshold value (e.g. ${opts.examples}). Got: "${String(opts.value)}"`);
  }
};

/**
 * Validate logging configuration values
 */
const _validateLoggingConfig = (config: InternalLoggingOptions): void => {
  if (!VALID_LOG_LEVELS.has(config.level)) {
    throw new Error(`logging.level must be one of: ${[...VALID_LOG_LEVELS].join(', ')}. Got: "${config.level}"`);
  }

  const diag = config.diagnostics;

  // Validate TimeString/number thresholds
  if (diag.slowRequests !== false) {
    _validateThresholdField({ field: 'slowRequests', value: diag.slowRequests, converter: _convertTimeToMs, examples: "'100ms', '1s', '30s'" });
  }
  if (diag.memory !== false) {
    _validateThresholdField({ field: 'memory', value: diag.memory, converter: _convertTimeToMs, examples: "'100ms', '1s', '30s'" });
  }
  if (diag.eventLoop !== false) {
    _validateThresholdField({ field: 'eventLoop', value: diag.eventLoop, converter: _convertTimeToMs, examples: "'100ms', '1s', '30s'" });
  }

  // Validate ByteString/number thresholds
  if (diag.largeResponses !== false) {
    _validateThresholdField({ field: 'largeResponses', value: diag.largeResponses, converter: _convertBytesToBytes, examples: "'1mb', '256kb', '10mb'" });
  }
  if (diag.largeRequests !== false) {
    _validateThresholdField({ field: 'largeRequests', value: diag.largeRequests, converter: _convertBytesToBytes, examples: "'1mb', '256kb', '10mb'" });
  }
};

/**
 * Handle logging configuration merging and validation
 */
const _handleLoggingConfig = (defaultConfig: InternalServerOptions, userConfig?: ServerOptions): void => {
  if (userConfig?.logging) {
    // If the user passed a branded logger (created with createLogger()), inherit its settings.
    // Merge cascade: DEFAULT_LOGGING_CONFIG → branded logger settings → explicit user config
    let brandedDefaults: Partial<InternalLoggingOptions> = {};
    const customLogger = userConfig.logging.logger as Record<string | symbol, unknown> | undefined;
    if (customLogger && loggerBrand in customLogger) {
      const branded = customLogger[loggerBrand] as { level: string; prefix: string; personality: boolean };
      brandedDefaults = {
        level: branded.level as InternalLoggingOptions['level'],
        prefix: branded.prefix,
        personality: branded.personality,
      };
    }

    defaultConfig.logging = {
      ...DEFAULT_LOGGING_CONFIG,
      ...brandedDefaults,
      ...userConfig.logging,
      diagnostics: {
        ...DEFAULT_DIAGNOSTICS_CONFIG,
        ...userConfig.logging.diagnostics,
      },
    };

    _validateLoggingConfig(defaultConfig.logging);
  }
};

/**
 * Handle custom configuration
 */
export const handleCustomConfiguration = (configuration?: ServerOptions): InternalServerOptions => {
  // Start with default configuration
  const result = { ...DEFAULT_CONFIGURATION };

  // Shallow merge — filter out explicit undefined values so they don't overwrite defaults.
  // Without this, `new YinzerFlow({ logging: undefined })` would clobber the default logging config.
  if (configuration) {
    for (const key of Object.keys(configuration)) {
      if (!DEEP_MERGE_KEYS.has(key) && (configuration as Record<string, unknown>)[key] !== undefined) {
        (result as Record<string, unknown>)[key] = (configuration as Record<string, unknown>)[key];
      }
    }
  }

  // Handle special configuration sections (deep merge + validation)
  _handleLoggingConfig(result, configuration);
  _handleBodyParserConfig(result, configuration);
  _handleIpSecurityConfig(result, configuration);
  _validatePort(result, configuration);

  return result;
};
