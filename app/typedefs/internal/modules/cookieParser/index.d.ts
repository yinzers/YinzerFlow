/**
 * Internal types for cookie parser module
 *
 * These types are used internally by the framework and are not exposed to users.
 */

/**
 * Cookie attributes configuration
 */
export interface InternalCookieOptions {
  /**
   * Expiration date/time for the cookie
   */
  expires?: Date;

  /**
   * Max age in seconds
   */
  maxAge?: number;

  /**
   * Domain for the cookie
   */
  domain?: string;

  /**
   * Path for the cookie
   */
  path?: string;

  /**
   * Secure flag (HTTPS only)
   */
  secure?: boolean;

  /**
   * HTTP-only flag (no JavaScript access)
   */
  httpOnly?: boolean;

  /**
   * SameSite attribute
   */
  sameSite?: 'lax' | 'none' | 'strict';
}

/**
 * Result of signing a cookie value
 */
export interface InternalSignedCookie {
  /**
   * The signed value
   */
  signed: string;

  /**
   * The original value before signing
   */
  original: string;
}
