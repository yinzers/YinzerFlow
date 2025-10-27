import type { InternalCookieOptions } from '@typedefs/internal/modules/cookieParser/index.js';

/**
 * Public cookie options that users can configure
 */
export type CookieOptions = InternalCookieOptions;

/**
 * Cookie parser configuration options
 *
 * @example
 * ```typescript
 * // Basic cookie parser with secret
 * const config: CookieParserOptions = {
 *   secret: process.env.COOKIE_SECRET,
 *   enabled: true
 * };
 *
 * // Per-cookie signing
 * const config: CookieParserOptions = {
 *   secret: process.env.COOKIE_SECRET,
 *   signed: ['sessionId', 'userId']
 * };
 *
 * // With default cookie options
 * const config: CookieParserOptions = {
 *   secret: process.env.COOKIE_SECRET,
 *   defaults: {
 *     httpOnly: true,
 *     secure: true,
 *     sameSite: 'strict',
 *     maxAge: '1h' // or 3600 for 1 hour in seconds
 *   }
 * };
 * ```
 */
export interface CookieParserOptions {
  /**
   * Enable or disable cookie parser
   * @default true
   */
  enabled?: boolean;

  /**
   * Secret key for signing cookies
   *
   * If provided, cookies will be signed using HMAC-SHA256.
   * Signed cookies are validated on each request to detect tampering.
   *
   * @default undefined (no signing)
   *
   * @example
   * ```typescript
   * secret: process.env.COOKIE_SECRET
   * ```
   */
  secret?: string;

  /**
   * Cookie names to sign
   *
   * If undefined or empty, all cookies are signed when a secret is provided.
   * If provided, only the specified cookies are signed.
   *
   * @default undefined (sign all cookies if secret is provided)
   *
   * @example
   * ```typescript
   * signed: ['sessionId', 'userId', 'authToken']
   * ```
   */
  signed?: Array<string>;

  /**
   * Default cookie options applied to all cookies
   *
   * These options can be overridden per-cookie when setting individual cookies.
   *
   * @default undefined
   *
   * @example
   * ```typescript
   * defaults: {
   *   httpOnly: true,
   *   secure: true,
   *   sameSite: 'strict',
   *   maxAge: '1h' // or 3600 for 1 hour in seconds
   * }
   * ```
   */
  defaults?: CookieOptions;
}
