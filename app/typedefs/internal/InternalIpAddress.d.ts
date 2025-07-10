/**
 * Represents the result of parsing an IP address with security validation
 */
export interface InternalIpAddressResult {
  /**
   * The extracted IP address
   */
  ip: string;

  /**
   * Whether the IP was successfully validated
   */
  isValid: boolean;

  /**
   * Whether the IP is in a private range
   */
  isPrivate: boolean;

  /**
   * Source of the IP address (header name or 'socket' for direct connection)
   */
  source: string | 'cf-connecting-ip' | 'socket' | 'true-client-ip' | 'x-client-ip' | 'x-forwarded-for' | 'x-real-ip';

  /**
   * Whether the IP came from a trusted proxy
   */
  trusted: boolean;
}
