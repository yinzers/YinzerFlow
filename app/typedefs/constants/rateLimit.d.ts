import type { CreateEnum } from '@typedefs/internal/Generics.js';
import type { rateLimitAlgorithm, rateLimitStoreType } from '@constants/rateLimit.js';

/**
 * Internal type for rate limit algorithm enum
 * Generated from rateLimitAlgorithm constant
 */
export type RateLimitAlgorithm = CreateEnum<typeof rateLimitAlgorithm>;

/**
 * Internal type for rate limit store type enum
 * Generated from rateLimitStoreType constant
 */
export type RateLimitStoreType = CreateEnum<typeof rateLimitStoreType>;
