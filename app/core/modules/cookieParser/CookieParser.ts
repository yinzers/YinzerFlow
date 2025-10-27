import { createHmac } from 'node:crypto';
import { CookieParserConfig } from './CookieParserConfig.ts';
import type { CookieOptions, CookieParserOptions } from '@typedefs/public/CookieParser.js';
import { _convertTimeToMs } from '@core/utils/time.ts';

/**
 * Cookie parser implementation with HMAC-SHA256 signing support
 *
 * This class handles parsing incoming cookies, setting outgoing cookies, and
 * signing/validating cookies for tamper detection.
 *
 * @example
 * ```typescript
 * // Create a cookie parser with signing
 * const parser = new CookieParser({
 *   secret: process.env.COOKIE_SECRET,
 *   defaults: {
 *     httpOnly: true,
 *     secure: true,
 *     sameSite: 'strict'
 *   }
 * });
 *
 * // Parse incoming cookies
 * const cookieHeader = 'sessionId=abc123; userId=42';
 * const cookies = parser.parse(cookieHeader);
 *
 * // Set a cookie
 * const setCookieHeader = parser.set('sessionId', 'abc123', {
 *   httpOnly: true,
 *   secure: true,
 *   maxAge: '1h' // or 3600 for 1 hour in seconds
 * });
 *
 * // Sign a cookie
 * const signed = parser.sign('sessionId', 'abc123');
 * // returns: "abc123.hmacsignature"
 *
 * // Unsign and validate
 * const original = parser.unsign(signed);
 * // returns: "abc123" if valid, false if tampered
 * ```
 */
export class CookieParser {
  private readonly _config: CookieParserConfig;

  constructor(config?: CookieParserOptions) {
    this._config = new CookieParserConfig(config);
  }

  /**
   * Parse a Cookie header into a Map of cookie name-value pairs
   *
   * Handles URL decoding and malformed cookies gracefully.
   *
   * @param cookieHeader - The raw Cookie header value
   * @returns Map of cookie name to value
   *
   * @example
   * ```typescript
   * const cookieHeader = 'sessionId=abc123; userId=42; theme=dark';
   * const cookies = parser.parse(cookieHeader);
   *
   * cookies.get('sessionId'); // "abc123"
   * cookies.get('userId'); // "42"
   * cookies.get('theme'); // "dark"
   * ```
   */
  parse(cookieHeader: string): Map<string, string> {
    const cookies = new Map<string, string>();

    // Return empty map if no cookies
    if (!cookieHeader || typeof cookieHeader !== 'string') {
      return cookies;
    }

    // Split by semicolon and parse each cookie
    const cookiePairs = cookieHeader.split(';');
    for (const pair of cookiePairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;

      // Split on first = sign
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;

      const name = trimmed.slice(0, equalIndex).trim();
      const value = trimmed.slice(equalIndex + 1).trim();

      if (name && value) {
        try {
          cookies.set(name, decodeURIComponent(value));
        } catch (_error) {
          // Skip cookies with invalid URL encoding
          continue;
        }
      }
    }

    return cookies;
  }

  /**
   * Build a Set-Cookie header string
   *
   * Applies default cookie options from configuration and handles URL encoding.
   *
   * @param name - Cookie name (will be URL encoded)
   * @param value - Cookie value (will be URL encoded)
   * @param options - Optional cookie attributes
   * @returns Formatted Set-Cookie header string
   *
   * @example
   * ```typescript
   * const header = parser.set('sessionId', 'abc123', {
   *   httpOnly: true,
   *   secure: true,
   *   maxAge: '1h', // or 3600 for 1 hour in seconds
   *   sameSite: 'strict'
   * });
   *
   * // Returns: "sessionId=abc123; HttpOnly; Secure; Max-Age=3600; SameSite=Strict"
   * ```
   */
  set(name: string, value: string, options?: CookieOptions): string {
    // URL encode name and value
    const encodedName = encodeURIComponent(name);
    const encodedValue = encodeURIComponent(value);

    // Combine defaults with provided options
    const cookieOptions = this._mergeOptions(options);

    // Build cookie parts
    const parts = [`${encodedName}=${encodedValue}`];

    // Add expires
    if (cookieOptions.expires) {
      parts.push(`Expires=${cookieOptions.expires.toUTCString()}`);
    }

    // Add maxAge
    if (cookieOptions.maxAge !== undefined) {
      parts.push(`Max-Age=${cookieOptions.maxAge}`);
    }

    // Add domain
    if (cookieOptions.domain) {
      parts.push(`Domain=${cookieOptions.domain}`);
    }

    // Add path
    if (cookieOptions.path) {
      parts.push(`Path=${cookieOptions.path}`);
    }

    // Add secure flag
    if (cookieOptions.secure) {
      parts.push('Secure');
    }

    // Add httpOnly flag
    if (cookieOptions.httpOnly) {
      parts.push('HttpOnly');
    }

    // Add sameSite
    if (cookieOptions.sameSite) {
      parts.push(`SameSite=${cookieOptions.sameSite.charAt(0).toUpperCase() + cookieOptions.sameSite.slice(1)}`);
    }

    return parts.join('; ');
  }

  /**
   * Sign a cookie value using HMAC-SHA256
   *
   * Creates a signature that can be validated to detect tampering.
   * The signed value format is: `value.signature`
   *
   * @param name - Cookie name (used in signature calculation)
   * @param value - Cookie value to sign
   * @returns Signed cookie value
   *
   * @example
   * ```typescript
   * const signed = parser.sign('sessionId', 'abc123');
   * // Returns: "abc123.xyz789..." (value with appended signature)
   * ```
   */
  sign(name: string, value: string): string {
    if (!this._config.secret) {
      throw new Error('Cannot sign cookie: no secret configured');
    }

    // Create HMAC signature using name=value
    const signature = createHmac('sha256', this._config.secret).update(`${name}=${value}`).digest('base64url').replace(/=/g, ''); // Remove padding

    // Return value.signature format
    return `${value}.${signature}`;
  }

  /**
   * Validate and unsign a signed cookie value
   *
   * Verifies the HMAC signature and returns the original value if valid.
   *
   * @param name - Cookie name (used in signature validation)
   * @param signedValue - The signed cookie value
   * @returns Original value if signature is valid, false if tampered
   *
   * @example
   * ```typescript
   * const signed = "abc123.xyz789...";
   * const original = parser.unsign('sessionId', signed);
   *
   * if (original === false) {
   *   // Cookie was tampered with
   *   console.error('Tampered cookie detected');
   * } else {
   *   // Cookie is valid
   *   console.log('Original value:', original);
   * }
   * ```
   */
  unsign(name: string, signedValue: string): string | false {
    if (!this._config.secret) {
      throw new Error('Cannot unsign cookie: no secret configured');
    }

    // Split value and signature
    const lastDotIndex = signedValue.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return false; // No signature found
    }

    const value = signedValue.slice(0, lastDotIndex);
    const receivedSignature = signedValue.slice(lastDotIndex + 1);

    // Create expected signature
    const expectedSignature = createHmac('sha256', this._config.secret).update(`${name}=${value}`).digest('base64url').replace(/=/g, ''); // Remove padding

    // Compare signatures
    return expectedSignature === receivedSignature ? value : false;
  }

  /**
   * Merge default options with provided options
   */
  private _mergeOptions(options?: CookieOptions): CookieOptions {
    const merged = {
      ...this._config.defaults,
      ...options,
    };

    // Convert TimeString to seconds for maxAge
    if (merged.maxAge !== undefined && typeof merged.maxAge === 'string') {
      merged.maxAge = _convertTimeToMs(merged.maxAge) / 1000;
    }

    return merged;
  }

  /**
   * Get the cookie parser configuration
   */
  get config(): CookieParserConfig {
    return this._config;
  }

  /**
   * Check if a cookie should be signed based on configuration
   */
  shouldSign(name: string): boolean {
    if (!this._config.secret) {
      return false;
    }

    // If signed array is undefined, sign all cookies
    if (this._config.signed === undefined || this._config.signed.length === 0) {
      return true;
    }

    // Otherwise, only sign if name is in signed array
    return this._config.signed.includes(name);
  }
}
