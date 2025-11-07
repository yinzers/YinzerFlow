import type { InternalCookieOptions } from '@typedefs/internal/modules/cookieParser/index.js';

/**
 * Public cookie options that users can configure
 */
export type CookieOptions = InternalCookieOptions;

/**
 * Cookie helper methods for setting and managing cookies
 *
 * Available on the context object when cookie parser middleware is enabled.
 * Provides convenient methods for setting cookies, signing values, and
 * validating signed cookies.
 *
 * @example
 * ```typescript
 * import type { Cookies } from 'yinzerflow';
 *
 * // Use in a helper function
 * export const setRefreshTokenCookie = (cookies: Cookies, refreshToken: string): void => {
 *   const signedRefreshToken = cookies.sign('refreshToken', refreshToken);
 *   cookies.set('refreshToken', signedRefreshToken, {
 *     path: '/session',
 *     maxAge: '7d',
 *     httpOnly: true,
 *     secure: true
 *   });
 * };
 *
 * // Use in a route handler
 * const handler: HandlerCallback = async (ctx) => {
 *   ctx.cookies.set('theme', 'dark', { maxAge: '30d' });
 *   return { message: 'Cookie set' };
 * };
 * ```
 */
export interface Cookies {
  /**
   * Set a cookie in the response
   *
   * @param name - Cookie name
   * @param value - Cookie value
   * @param options - Optional cookie attributes
   *
   * @example
   * ```typescript
   * ctx.cookies.set('sessionId', 'abc123', {
   *   httpOnly: true,
   *   secure: true,
   *   maxAge: '1h'
   * });
   * ```
   */
  set: (name: string, value: string, options?: CookieOptions) => void;

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
   * const signedValue = ctx.cookies.sign('sessionId', 'abc123');
   * ctx.cookies.set('sessionId', signedValue);
   * ```
   */
  sign: (name: string, value: string) => string;

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
   * const signedValue = ctx.request.signedCookies.get('sessionId');
   * if (signedValue) {
   *   const original = ctx.cookies.unsign('sessionId', signedValue);
   *   if (original === false) {
   *     throw new Error('Cookie was tampered with');
   *   }
   * }
   * ```
   */
  unsign: (name: string, signedValue: string) => string | false;
}

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
