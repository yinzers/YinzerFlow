import { httpStatusCode } from '@constants/http.ts';
import { rateLimitAlgorithm } from '@constants/rateLimit.ts';
import { _convertTimeToMs } from '@core/utils/time.ts';
import { log } from '@core/utils/log.ts';
import type { RateLimitAlgorithm } from '@typedefs/constants/rateLimit.js';
import type { Context, HandlerCallback } from '@typedefs/public/Context.js';
import type { RateLimitOptions, StoreConfig } from '@typedefs/public/RateLimit.js';
import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.js';

export class RateLimitConfig implements RateLimitOptions {
  algorithm: RateLimitAlgorithm;
  store: StoreConfig;
  window: number; // milliseconds
  max: number;
  standardHeaders: boolean;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: (ctx: Context<any>) => string;
  handler: <T extends HandlerCallbackGenerics>(ctx: Context<T>) => HandlerCallback<T>;

  constructor(config?: RateLimitOptions) {
    this._validateConfig(config);

    this.algorithm = config?.algorithm ?? rateLimitAlgorithm.slidingWindowCounter;
    this.store = config?.store ?? { type: 'memory' };
    this.window = _convertTimeToMs(config?.window ?? '15m');
    this.max = config?.max ?? 100;
    this.standardHeaders = config?.standardHeaders ?? true;
    this.skipSuccessfulRequests = config?.skipSuccessfulRequests ?? false;
    this.skipFailedRequests = config?.skipFailedRequests ?? false;
    this.keyGenerator = config?.keyGenerator ?? defaultKeyGenerator;
    this.handler = config?.handler ?? defaultHandler;
  }

  private _validateConfig(config?: RateLimitOptions): void {
    if (!config) return;
    _validateRateLimitConfig(config);
    _warnRateLimitConfig(config);
  }

  get config(): RateLimitOptions {
    return {
      algorithm: this.algorithm,
      window: this.window,
      max: this.max,
      standardHeaders: this.standardHeaders,
      skipSuccessfulRequests: this.skipSuccessfulRequests,
      skipFailedRequests: this.skipFailedRequests,
      keyGenerator: this.keyGenerator,
      handler: this.handler,
    };
  }
}

/**
 * Validate rate limit configuration minimums
 */
const _validateRateLimitConfig = (config: RateLimitOptions): void => {
  if (config.max !== undefined) {
    if (typeof config.max !== 'number' || isNaN(config.max)) {
      throw new Error('rateLimit.max must be a number');
    }

    if (config.max < 1) {
      throw new Error('rateLimit.max must be at least 1 request per window');
    }

    if (!Number.isInteger(config.max)) {
      throw new Error('rateLimit.max must be an integer (no decimals)');
    }
  }

  if (config.window !== undefined) {
    // Validate time string format if it's a string
    if (typeof config.window === 'string') {
      // Use named capture groups for clarity and lint compliance
      const timeRegex = /^(?<value>\d+)(?<unit>s|m|h|d)$/;
      if (!timeRegex.test(config.window)) {
        throw new Error(
          `rateLimit.window must be a valid time string (e.g., '30s', '15m', '2h', '1d') or milliseconds as a number. Received: "${config.window}"`,
        );
      }

      // Convert and validate the milliseconds value
      const ms = _convertTimeToMs(config.window);
      if (ms < 1000) {
        throw new Error(
          `rateLimit.window must be at least 1000ms (1 second). Received: ${config.window} (${ms}ms). ` +
            'Very short time windows can cause performance issues and inaccurate rate limiting.',
        );
      }
    } else if (typeof config.window === 'number') {
      if (isNaN(config.window)) {
        throw new Error('rateLimit.window must be a valid number when using milliseconds');
      }

      if (config.window < 1000) {
        throw new Error(
          `rateLimit.window must be at least 1000ms (1 second). Received: ${config.window}ms. ` +
            'Very short time windows can cause performance issues and inaccurate rate limiting.',
        );
      }

      if (!Number.isInteger(config.window)) {
        throw new Error('rateLimit.window must be an integer when using milliseconds (no decimals)');
      }
    } else {
      throw new Error('rateLimit.window must be a time string (e.g., "15m") or milliseconds as a number');
    }
  }
};

/**
 * Issue security warnings for risky rate limit configurations
 */
const _warnRateLimitConfig = (config: RateLimitOptions): void => {
  // Warn if rate limiting is disabled
  if (config.enabled === false) {
    log.warn(
      '[SECURITY WARNING] Rate limiting is disabled. ' +
        'This removes DoS protection from your API. Only disable for development or if you have external rate limiting (e.g., API gateway, CDN).',
    );
  }

  // Warn about very permissive rate limits
  if (config.max !== undefined && config.max > 10000) {
    log.warn(
      `[SECURITY WARNING] rateLimit.max is set to ${config.max} requests. ` +
        'Very high rate limits may not provide adequate DoS protection. Consider if this limit is necessary for your use case.',
    );
  }

  // Warn about very long time windows
  if (config.window !== undefined) {
    const windowMs = typeof config.window === 'string' ? _convertTimeToMs(config.window) : config.window;
    const oneHourMs = 3600000;

    if (windowMs > oneHourMs) {
      const hours = Math.round(windowMs / oneHourMs);
      log.warn(
        `[SECURITY WARNING] rateLimit.window is set to ${typeof config.window === 'string' ? config.window : `${windowMs}ms`} (${hours}h). ` +
          'Very long time windows may allow burst attacks before limits are enforced. Consider shorter windows for better protection.',
      );
    }
  }

  // Warn about very short time windows (performance concern)
  if (config.window !== undefined) {
    const windowMs = typeof config.window === 'string' ? _convertTimeToMs(config.window) : config.window;

    if (windowMs < 10000 && config.max !== undefined && config.max > 100) {
      // Less than 10 seconds with high request count
      log.warn(
        `[PERFORMANCE WARNING] rateLimit.window is set to ${typeof config.window === 'string' ? config.window : `${windowMs}ms`} with max ${config.max} requests. ` +
          'Very short time windows with high request counts can cause performance overhead. Consider increasing the window or decreasing max.',
      );
    }
  }
};

const defaultHandler = (ctx: Context<any>): { success: false; message: string } => {
  ctx.response.setStatusCode(httpStatusCode.tooManyRequests);
  return {
    success: false,
    message: 'Yinz are sending too many requests. Slow down, jagoff!',
  };
};

const defaultKeyGenerator = (ctx: Context<any>): string => ctx.request.ipAddress;
