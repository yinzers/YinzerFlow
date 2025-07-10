import type { InternalUrlEncodedConfiguration } from '@typedefs/internal/InternalConfiguration.js';

/**
 * Validate form field counts and basic structure
 */
const _validateFormStructure = (pairs: Array<string>, config: InternalUrlEncodedConfiguration): void => {
  // SECURITY: Check field count to prevent memory exhaustion
  if (pairs.length > config.maxFields) {
    throw new Error(`Too many form fields: ${pairs.length} exceeds limit of ${config.maxFields}`);
  }
};

/**
 * Validate individual field name and value lengths
 */
const _validateFieldLengths = (key: string, value: string | undefined, config: InternalUrlEncodedConfiguration): void => {
  // SECURITY: Check field name length
  if (key.length > config.maxFieldNameLength) {
    throw new Error(`Form field name too long: ${key.length} characters exceeds limit of ${config.maxFieldNameLength}`);
  }

  // SECURITY: Check field value length
  if (value && value.length > config.maxFieldLength) {
    throw new Error(`Form field value too long: field '${key}' has ${value.length} characters, exceeds limit of ${config.maxFieldLength}`);
  }
};

/**
 * Validate decoded field lengths (they may expand during decoding)
 */
const _validateDecodedLengths = (decodedKey: string, decodedValue: string, config: InternalUrlEncodedConfiguration): void => {
  // SECURITY: Check decoded field name length (could expand during decoding)
  if (decodedKey.length > config.maxFieldNameLength) {
    throw new Error(`Decoded form field name too long: ${decodedKey.length} characters exceeds limit of ${config.maxFieldNameLength}`);
  }

  // SECURITY: Check decoded field value length
  if (decodedValue.length > config.maxFieldLength) {
    throw new Error(
      `Decoded form field value too long: field '${decodedKey}' has ${decodedValue.length} characters, exceeds limit of ${config.maxFieldLength}`,
    );
  }
};

/**
 * Process a single form field pair with security validation
 */
const _processFieldPair = (pair: string, params: Record<string, string>, config?: InternalUrlEncodedConfiguration): void => {
  const [key, value] = pair.split('=');
  if (!key) return;

  // Validate field lengths if config provided
  if (config) {
    _validateFieldLengths(key, value, config);
  }

  try {
    const decodedKey = decodeURIComponent(key);
    const decodedValue = value ? decodeURIComponent(value) : '';

    // Validate decoded lengths if config provided
    if (config) {
      _validateDecodedLengths(decodedKey, decodedValue, config);
    }

    params[decodedKey] = decodedValue;
  } catch (error) {
    // Handle malformed URL encoding - check if it's a validation error or decoding error
    if (error instanceof Error && error.message.includes('exceeds limit')) {
      throw error; // Re-throw validation errors
    }

    // Handle malformed URL encoding gracefully by using original values
    params[key] = value ?? '';
  }
};

/**
 * Parse URL-encoded form data with security protections
 *
 * Security Features:
 * - Field count limits to prevent memory exhaustion
 * - Field name length validation
 * - Field value length validation
 * - Malformed URL encoding handling
 *
 * @example
 * ```ts
 * const config = { maxFields: 1000, maxFieldNameLength: 100, maxFieldLength: 1048576 };
 * parseUrlEncodedForm('name=John&age=30', config);
 * // Returns { name: 'John', age: '30' }
 * ```
 */
export const parseUrlEncodedForm = (body: string, config?: InternalUrlEncodedConfiguration): Record<string, string> => {
  const params: Record<string, string> = {};
  const pairs = body.split('&');

  // Validate form structure if config provided
  if (config) {
    _validateFormStructure(pairs, config);
  }

  // Process each field pair
  for (const pair of pairs) {
    _processFieldPair(pair, params, config);
  }

  return params;
};
