import type { CookieParserOptions } from '@typedefs/public/CookieParser.js';
import { log } from '@core/utils/log.ts';
import { _convertTimeToMs } from '@core/utils/time.ts';
import type { Logger } from '@typedefs/public/Logger.js';

export class CookieParserConfig {
  enabled: boolean;
  secret: string | undefined;
  signed: Array<string> | undefined;
  defaults: CookieParserOptions['defaults'] | undefined;

  constructor(config?: CookieParserOptions, logger?: Logger) {
    this._validateConfig(config, logger ?? log);
    this.enabled = config?.enabled ?? false;
    this.secret = config?.secret;
    this.signed = config?.signed;
    this.defaults = config?.defaults;
  }

  private _validateConfig(config: CookieParserOptions | undefined, logger: Logger): void {
    if (!config) return;
    _validateCookieConfig(config);
    _warnCookieConfig(config, logger);
  }

  get config(): Partial<CookieParserOptions> {
    const config: Partial<CookieParserOptions> = {
      enabled: this.enabled,
    };

    if (this.secret !== undefined) {
      config.secret = this.secret;
    }
    if (this.signed !== undefined) {
      config.signed = this.signed;
    }
    if (this.defaults !== undefined) {
      config.defaults = this.defaults;
    }

    return config;
  }
}

/**
 * Validate cookie parser configuration
 */
const _validateCookieConfig = (config: CookieParserOptions): void => {
  // Validate secret
  if (config.secret !== undefined) {
    if (typeof config.secret !== 'string') {
      throw new Error('cookieParser.secret must be a string');
    }

    if (config.secret.length < 32) {
      throw new Error('cookieParser.secret must be at least 32 characters for security. Use a strong, random secret stored in environment variables.');
    }
  }

  // Validate signed array
  if (config.signed !== undefined) {
    if (!Array.isArray(config.signed)) {
      throw new Error('cookieParser.signed must be an array of cookie names');
    }

    for (const cookieName of config.signed) {
      if (typeof cookieName !== 'string') {
        throw new Error('cookieParser.signed must be an array of strings (cookie names)');
      }

      if (cookieName.length === 0) {
        throw new Error('cookieParser.signed cannot contain empty cookie names');
      }
    }
  }

  // Validate defaults
  if (config.defaults) {
    _validateCookieOptions(config.defaults);
  }
};

/**
 * Validate cookie options
 */
const _validateCookieOptions = (options: CookieParserOptions['defaults']): void => {
  if (!options) return;

  _validateMaxAge(options);
  _validateSecure(options);
  _validateHttpOnly(options);
  _validateSameSite(options);
  _validateDomain(options);
  _validatePath(options);
  _validateExpires(options);
};

/**
 * Validate maxAge option
 */
const _validateMaxAge = (options: CookieParserOptions['defaults']): void => {
  if (!options || options.maxAge === undefined) return;

  // Validate time string format if it's a string
  if (typeof options.maxAge === 'string') {
    const timeRegex = /^(?<value>\d+)(?<unit>ms|s|m|h|d)$/;
    if (!timeRegex.test(options.maxAge)) {
      throw new Error(
        `cookieParser.defaults.maxAge must be a valid time string (e.g., '30s', '15m', '2h', '1d') or seconds as a number. Received: "${options.maxAge}"`,
      );
    }
    return;
  }

  // Validate number format
  if (typeof options.maxAge !== 'number' || isNaN(options.maxAge)) {
    throw new Error(
      `cookieParser.defaults.maxAge must be a valid time string (e.g., '30s', '15m', '2h', '1d') or seconds as a number. Received: "${options.maxAge}"`,
    );
  }

  if (options.maxAge < 0) {
    throw new Error('cookieParser.defaults.maxAge must be 0 or greater');
  }

  if (!Number.isInteger(options.maxAge)) {
    throw new Error('cookieParser.defaults.maxAge must be an integer (no decimals)');
  }
};

/**
 * Validate secure option
 */
const _validateSecure = (options: CookieParserOptions['defaults']): void => {
  if (!options || options.secure === undefined) return;
  if (typeof options.secure !== 'boolean') {
    throw new Error('cookieParser.defaults.secure must be a boolean');
  }
};

/**
 * Validate httpOnly option
 */
const _validateHttpOnly = (options: CookieParserOptions['defaults']): void => {
  if (!options || options.httpOnly === undefined) return;
  if (typeof options.httpOnly !== 'boolean') {
    throw new Error('cookieParser.defaults.httpOnly must be a boolean');
  }
};

/**
 * Validate sameSite option
 */
const _validateSameSite = (options: CookieParserOptions['defaults']): void => {
  if (!options || options.sameSite === undefined) return;
  if (!['strict', 'lax', 'none'].includes(options.sameSite)) {
    throw new Error('cookieParser.defaults.sameSite must be one of: "strict", "lax", "none"');
  }
};

/**
 * Validate domain option
 */
const _validateDomain = (options: CookieParserOptions['defaults']): void => {
  if (!options) return;
  if (options.domain === undefined) return;

  if (typeof options.domain !== 'string') {
    throw new Error('cookieParser.defaults.domain must be a string');
  }

  if (options.domain.length === 0) {
    throw new Error('cookieParser.defaults.domain cannot be empty');
  }
};

/**
 * Validate path option
 */
const _validatePath = (options: CookieParserOptions['defaults']): void => {
  if (!options || options.path === undefined) return;

  if (typeof options.path !== 'string') {
    throw new Error('cookieParser.defaults.path must be a string');
  }

  if (!options.path.startsWith('/')) {
    throw new Error('cookieParser.defaults.path must start with "/"');
  }
};

/**
 * Validate expires option
 */
const _validateExpires = (options: CookieParserOptions['defaults']): void => {
  if (!options || options.expires === undefined) return;
  if (!(options.expires instanceof Date)) {
    throw new Error('cookieParser.defaults.expires must be a Date object');
  }
};

/**
 * Issue security warnings for risky cookie configurations
 */
const _warnCookieConfig = (config: CookieParserOptions, logger: Logger): void => {
  // Warn if cookie parser is disabled
  if (config.enabled === false) {
    logger.warn('[SECURITY WARNING] Cookie parser is disabled. Cookies will not be parsed or validated. Only disable for special use cases.');
  }

  // Warn if no secret in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !config.secret) {
    logger.warn(
      '[SECURITY WARNING] No secret provided for cookie signing in production. ' +
        'Cookies will not be signed and cannot be validated for tampering. Consider using a secret.',
    );
  }

  // Warn if default secure is false in production
  if (isProduction && config.defaults?.secure === false) {
    logger.warn(
      '[SECURITY WARNING] cookieParser.defaults.secure is false in production. ' +
        'Cookies will be sent over HTTP, which is insecure. Always use secure cookies in production.',
    );
  }

  // Warn if default httpOnly is false in production
  if (isProduction && config.defaults?.httpOnly === false) {
    logger.warn(
      '[SECURITY WARNING] cookieParser.defaults.httpOnly is false in production. ' +
        'Cookies will be accessible to JavaScript, which increases XSS risk. ' +
        'Only disable httpOnly for cookies that need JavaScript access.',
    );
  }

  // Warn about SameSite=none without secure
  if (config.defaults?.sameSite === 'none' && config.defaults.secure !== true) {
    logger.warn('[SECURITY WARNING] SameSite=none requires secure=true. Browsers will reject cookies with SameSite=none without secure flag.');
  }
};
