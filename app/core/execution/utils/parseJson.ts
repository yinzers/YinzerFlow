import type { InternalJsonParserOptions } from '@typedefs/internal/InternalConfiguration.js';
import { log } from '@core/utils/log.ts';
import { _formatBytesForDisplay } from '@core/utils/bytes.ts';
import type { Logger } from '@typedefs/public/Logger.js';

/**
 * Dangerous prototype properties that can lead to prototype pollution
 */
const DANGEROUS_PROPERTIES = ['__proto__', 'constructor', 'prototype'];

/** Validation context threaded through recursive JSON structure checks */
interface JsonValidationCtx {
  config: InternalJsonParserOptions;
  logger: Logger;
}

/**
 * Parse JSON request body with comprehensive security protections
 *
 * Security Features:
 * - Request size validation
 * - Nesting depth limits to prevent stack overflow
 * - Prototype pollution protection
 * - Memory exhaustion protection (max keys, string length, array length)
 * - Proper error handling with security context
 */
export const parseApplicationJson = (body: string, config: InternalJsonParserOptions, logger?: Logger): unknown => {
  const _log = logger ?? log;
  // Handle empty strings, whitespace, and null characters
  if (!body || !body.trim() || body.trim() === '\0') {
    return undefined;
  }

  // SECURITY: Validate request body size to prevent DoS attacks
  const bodySize = Buffer.byteLength(body, 'utf8');
  if (bodySize > config.maxSize) {
    _log.warn('[SECURITY] JSON request body too large', {
      size: _formatBytesForDisplay(bodySize),
      limit: config.maxSize,
    });
    throw new Error(`Request body too large: ${bodySize} bytes exceeds limit of ${config.maxSize} bytes`);
  }

  let parsedData: unknown = null; // Initialize to fix linting

  try {
    // First pass: Parse JSON to get structure
    parsedData = JSON.parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON syntax: ${message}`);
  }

  // SECURITY: Validate parsed data structure for security vulnerabilities
  try {
    _validateJsonStructure(parsedData, { config, logger: _log }, 1); // Start at depth 1 (root level)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON security validation failed: ${message}`);
  }

  return parsedData;
};

/**
 * Validate primitive values (strings, numbers, etc.)
 */
const _validatePrimitive = (data: unknown, config: InternalJsonParserOptions): void => {
  if (typeof data === 'string' && data.length > config.maxStringLength) {
    throw new Error(`String too long: ${data.length} characters exceeds limit of ${config.maxStringLength}`);
  }
};

/**
 * Validate array structure and elements
 */
const _validateArray = (data: Array<unknown>, ctx: JsonValidationCtx, depth: number): void => {
  // SECURITY: Check array length to prevent memory exhaustion
  if (data.length > ctx.config.maxArrayLength) {
    throw new Error(`Array too large: ${data.length} elements exceeds limit of ${ctx.config.maxArrayLength}`);
  }

  // Recursively validate array elements
  for (const item of data) {
    _validateJsonStructure(item, ctx, depth + 1);
  }
};

/**
 * Validate object keys for security issues
 */
const _validateObjectKeys = (keys: Array<string>, ctx: JsonValidationCtx): void => {
  // SECURITY: Check number of keys to prevent memory exhaustion
  if (keys.length > ctx.config.maxKeys) {
    throw new Error(`Object has too many keys: ${keys.length} exceeds limit of ${ctx.config.maxKeys}`);
  }

  // SECURITY: Check for prototype pollution attempts
  if (!ctx.config.allowPrototypeProperties) {
    for (const key of keys) {
      if (DANGEROUS_PROPERTIES.includes(key)) {
        ctx.logger.warn('[SECURITY] Prototype pollution attempt detected', {
          property: key,
          dangerousProperties: DANGEROUS_PROPERTIES,
        });
        throw new Error(`Prototype pollution attempt detected: property '${key}' is not allowed`);
      }
    }
  }
};

/**
 * Validate object properties and values
 */
const _validateObjectProperties = (data: Record<string, unknown>, ctx: JsonValidationCtx, depth: number): void => {
  const keys = Object.keys(data);

  for (const key of keys) {
    // SECURITY: Check key length
    if (key.length > ctx.config.maxStringLength) {
      throw new Error(`Object key too long: '${key.substring(0, 50)}...' exceeds limit of ${ctx.config.maxStringLength}`);
    }

    const value = data[key];

    // SECURITY: Check string value length
    if (typeof value === 'string' && value.length > ctx.config.maxStringLength) {
      throw new Error(`String value too long: property '${key}' has ${value.length} characters, exceeds limit of ${ctx.config.maxStringLength}`);
    }

    // Recursively validate nested structures
    _validateJsonStructure(value, ctx, depth + 1);
  }
};

/**
 * Recursively validate JSON structure for security vulnerabilities
 *
 * @param data - Data to validate
 * @param ctx - Validation context (config + logger)
 * @param depth - Current nesting depth (starts at 1 for root level)
 */
const _validateJsonStructure = (data: unknown, ctx: JsonValidationCtx, depth: number): void => {
  // SECURITY: Check nesting depth to prevent stack overflow attacks
  if (depth > ctx.config.maxDepth) {
    ctx.logger.warn('[SECURITY] JSON nesting too deep - potential stack overflow attack', {
      currentDepth: depth,
      maxDepth: ctx.config.maxDepth,
    });
    throw new Error(`JSON nesting too deep: current depth ${depth} exceeds maximum depth of ${ctx.config.maxDepth}`);
  }

  // Handle null and primitives
  if (data === null || typeof data !== 'object') {
    _validatePrimitive(data, ctx.config);
    return;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    _validateArray(data, ctx, depth);
    return;
  }

  // Handle objects
  const keys = Object.keys(data);
  _validateObjectKeys(keys, ctx);
  _validateObjectProperties(data as Record<string, unknown>, ctx, depth);
};
