/**
 * Represents the result of parsing an IP address with security validation.
 *
 * This interface provides comprehensive information about an IP address,
 * including validation status, privacy classification, source, and trust level.
 * It's used internally by YinzerFlow for security analysis and client identification.
 *
 * ## Security Features
 *
 * - **Validation**: Ensures the IP address is properly formatted
 * - **Privacy Detection**: Identifies private/internal IP ranges
 * - **Source Tracking**: Tracks which header or connection provided the IP
 * - **Trust Verification**: Indicates if the IP came from a trusted proxy
 *
 * @example
 * ```typescript
 * // This interface is used internally by YinzerFlow
 * // Users typically don't interact with it directly
 *
 * // However, if you're extending the framework:
 * class CustomIpAnalyzer {
 *   analyzeIpAddress(result: InternalIpAddressResult) {
 *     // Security analysis
 *     if (!result.isValid) {
 *       console.warn('Invalid IP address detected:', result.ip);
 *       return { risk: 'high', reason: 'invalid_ip' };
 *     }
 *
 *     if (result.isPrivate && result.source !== 'socket') {
 *       console.warn('Private IP from proxy:', result.ip, result.source);
 *       return { risk: 'medium', reason: 'private_ip_from_proxy' };
 *     }
 *
 *     if (!result.trusted && result.source !== 'socket') {
 *       console.warn('Untrusted proxy source:', result.source);
 *       return { risk: 'medium', reason: 'untrusted_proxy' };
 *     }
 *
 *     return { risk: 'low', ip: result.ip, source: result.source };
 *   }
 *
 *   // Rate limiting by IP
 *   async checkRateLimit(result: InternalIpAddressResult) {
 *     if (result.isValid) {
 *       const key = `rate_limit:${result.ip}`;
 *       const current = await redis.incr(key);
 *
 *       if (current === 1) {
 *         await redis.expire(key, 3600); // 1 hour
 *       }
 *
 *       return current <= 100; // 100 requests per hour
 *     }
 *
 *     return false; // Block invalid IPs
 *   }
 * }
 * ```
 *
 * @see {@link Request} for accessing IP address in route handlers
 * @see {@link ServerOptions} for proxy configuration options
 */
export interface InternalIpAddressResult {
  /**
   * The extracted IP address.
   *
   * The actual IP address string, either IPv4 or IPv6 format.
   *
   * @example
   * ```typescript
   * ip: '192.168.1.100'        // IPv4 private
   * ip: '10.0.0.1'            // IPv4 private
   * ip: '172.16.0.1'          // IPv4 private
   * ip: '203.0.113.1'         // IPv4 public
   * ip: '2001:db8::1'         // IPv6
   * ip: '::1'                  // IPv6 localhost
   * ```
   */
  ip: string;

  /**
   * Whether the IP address was successfully validated.
   *
   * Indicates if the IP address string is properly formatted
   * and represents a valid IP address.
   *
   * @example
   * ```typescript
   * isValid: true   // Valid IP like '192.168.1.100'
   * isValid: false // Invalid like 'not.an.ip.address'
   *
   * // Usage in security checks
   * if (!result.isValid) {
   *   throw new Error('Invalid IP address format');
   * }
   * ```
   */
  isValid: boolean;

  /**
   * Whether the IP address is in a private range.
   *
   * Private IP ranges include:
   * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
   * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
   * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
   * - 127.0.0.0/8 (127.0.0.0 - 127.255.255.255) - localhost
   *
   * @example
   * ```typescript
   * isPrivate: true   // 192.168.1.100, 10.0.0.1, 127.0.0.1
   * isPrivate: false  // 203.0.113.1, 8.8.8.8
   *
   * // Usage in security analysis
   * if (result.isPrivate && result.source !== 'socket') {
   *   // Private IP from proxy - potential security issue
   *   console.warn('Private IP from proxy detected');
   * }
   * ```
   */
  isPrivate: boolean;

  /**
   * Source of the IP address (header name or 'socket' for direct connection).
   *
   * Indicates which HTTP header or connection method provided the IP address.
   * This is crucial for security analysis and proxy validation.
   *
   * @example
   * ```typescript
   * source: 'socket'           // Direct connection (most trusted)
   * source: 'x-forwarded-for'  // Standard proxy header
   * source: 'x-real-ip'        // Nginx proxy header
   * source: 'cf-connecting-ip' // Cloudflare header
   * source: 'true-client-ip'   // Akamai header
   * source: 'x-client-ip'      // Custom proxy header
   *
   * // Usage in source validation
   * const trustedSources = ['socket', 'x-real-ip', 'cf-connecting-ip'];
   * const isTrustedSource = trustedSources.includes(result.source);
   * ```
   */
  source: string | 'cf-connecting-ip' | 'socket' | 'true-client-ip' | 'x-client-ip' | 'x-forwarded-for' | 'x-real-ip';

  /**
   * Whether the IP address came from a trusted proxy.
   *
   * Indicates if the proxy that provided the IP address is considered
   * trustworthy based on configuration and security analysis.
   *
   * @example
   * ```typescript
   * trusted: true   // From trusted proxy or direct connection
   * trusted: false  // From untrusted or unknown proxy
   *
   * // Usage in security decisions
   * if (!result.trusted && result.source !== 'socket') {
   *   // Log suspicious activity
   *   console.warn('Untrusted proxy detected:', {
   *     ip: result.ip,
   *     source: result.source,
   *     timestamp: new Date().toISOString()
   *   });
   *
   *   // Consider additional validation
   *   return this.performAdditionalValidation(result.ip);
   * }
   * ```
   */
  trusted: boolean;
}
