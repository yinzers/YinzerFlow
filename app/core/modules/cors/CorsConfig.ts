import { httpStatusCode } from '@constants/http.ts';
import type { InternalCorsEnabledOptions, InternalCorsOptions } from '@typedefs/internal/InternalConfiguration.js';

/**
 * CORS Configuration defaults and validation
 *
 * Provides sensible defaults and validates CORS configuration for security.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CorsConfig {
  /**
   * Get default CORS configuration (disabled by default)
   */
  static getDefaults(): InternalCorsOptions {
    return {
      enabled: false,
    };
  }

  /**
   * Get default enabled CORS configuration
   * Used when user enables CORS but doesn't provide full config
   */
  static getEnabledDefaults(): InternalCorsEnabledOptions {
    return {
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
  }

  /**
   * Merge user configuration with defaults
   */
  static merge(userConfig?: Partial<InternalCorsEnabledOptions>): InternalCorsOptions {
    if (!userConfig || !userConfig.enabled) {
      return CorsConfig.getDefaults();
    }

    const defaults = CorsConfig.getEnabledDefaults();

    return {
      enabled: true,
      origin: userConfig.origin ?? defaults.origin,
      methods: userConfig.methods ?? defaults.methods,
      allowedHeaders: userConfig.allowedHeaders ?? defaults.allowedHeaders,
      exposedHeaders: userConfig.exposedHeaders ?? defaults.exposedHeaders,
      credentials: userConfig.credentials ?? defaults.credentials,
      maxAge: userConfig.maxAge ?? defaults.maxAge,
      preflightContinue: userConfig.preflightContinue ?? defaults.preflightContinue,
      optionsSuccessStatus: userConfig.optionsSuccessStatus ?? defaults.optionsSuccessStatus,
    };
  }

  /**
   * Validate CORS configuration for security issues
   * Throws if configuration is invalid or insecure
   */
  static validate(config: InternalCorsOptions): void {
    if (!config.enabled) return;

    // SECURITY: Validate wildcard + credentials combination
    if (config.origin === '*' && config.credentials) {
      throw new Error(
        'CORS Security Error: origin: "*" with credentials: true is forbidden by CORS spec and creates security vulnerabilities. Use specific origins instead.',
      );
    }

    // Validate origin is provided when enabled
    if (!config.origin) {
      throw new Error('CORS Configuration Error: origin is required when CORS is enabled.');
    }

    // Validate methods array
    if (!Array.isArray(config.methods) || config.methods.length === 0) {
      throw new Error('CORS Configuration Error: methods must be a non-empty array.');
    }

    // Validate exposedHeaders array
    if (!Array.isArray(config.exposedHeaders)) {
      throw new Error('CORS Configuration Error: exposedHeaders must be an array.');
    }

    // Validate maxAge is positive
    if (typeof config.maxAge !== 'number' || config.maxAge < 0) {
      throw new Error('CORS Configuration Error: maxAge must be a non-negative number.');
    }
  }
}
