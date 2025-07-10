import type { InternalHttpHeaders } from '@typedefs/constants/http.js';
import type { InternalIpAddressResult } from '@typedefs/internal/InternalIpAddress.js';
import type { InternalIpValidationConfig } from '@typedefs/internal/InternalConfiguration.js';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.ts';

// Private IP ranges (RFC 1918, RFC 4193, RFC 3927)
const PRIVATE_IP_RANGES = [
  // IPv4 private ranges
  /^(?<classA>10)\./,
  /^(?<classB>172)\.(?<classBRange>1[6-9]|2[0-9]|3[0-1])\./,
  /^(?<classC>192)\.(?<classCRange>168)\./,
  /^(?<linkLocal>169)\.(?<linkLocalRange>254)\./, // link-local
  /^(?<loopback>127)\./, // loopback
  // IPv6 private ranges
  /^(?<ipv6Loopback>::1)$/, // loopback
  /^(?<ipv6LinkLocal>fe80):/i, // link-local
  /^(?<ipv6UniqueLocalFC>fc00):/i, // unique local
  /^(?<ipv6UniqueLocalFD>fd00):/i, // unique local
];

/**
 * Validates if an IP address is properly formatted
 */
export const isValidIpAddress = (ip: string): boolean => {
  if (!ip || typeof ip !== 'string') return false;

  // Remove brackets from IPv6 addresses
  const cleanIp = ip.replace(/^\[|\]$/g, '');

  // IPv4 validation with named capture groups
  const ipv4Regex = /^(?<octet>(?<highByte>25[0-5]|(?<midByte>2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
  if (ipv4Regex.test(cleanIp)) {
    const parts = cleanIp.split('.');
    return (
      parts.length === 4 &&
      parts.every((part) => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      })
    );
  }

  // IPv6 validation with named capture groups (simplified but robust)
  // First check for invalid patterns (multiple :: compression)
  if (cleanIp.includes('::') && (cleanIp.match(/::/g) ?? []).length > 1) {
    return false; // Multiple :: compression is invalid
  }

  const ipv6Regex =
    /^(?<ipv6Address>(?<fullAddress>(?<hexQuad>[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4})|(?<compressedAddress>(?<leadingPart>[0-9a-fA-F]{1,4}:){1,7}:)|(?<mixedCompression>(?<frontPart>[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})|(?<doubleColonOnly>::)|(?<linkLocal>fe80:(?<linkSuffix>:[0-9a-fA-F]{0,4}){0,4}(?<zoneId>%[0-9a-zA-Z]+)?)|(?<ipv4MappedFull>::ffff:(?<mappedIpv4>(?<mappedOctet>[0-9]{1,3}\.){3}[0-9]{1,3}))|(?<generalPattern>(?<segmentGroup>[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}))$/;

  return ipv6Regex.test(cleanIp);
};

/**
 * Checks if an IP address is in a private range
 */
export const isPrivateIp = (ip: string): boolean => {
  if (!ip) return false;
  const cleanIp = ip.replace(/^\[|\]$/g, '');
  return PRIVATE_IP_RANGES.some((range) => range.test(cleanIp));
};

/**
 * Checks if an IP is in the trusted proxy list
 * Supports '*' wildcard to trust any proxy
 */
export const isTrustedProxy = (ip: string, trustedProxies: Array<string>): boolean => {
  if (!ip || !trustedProxies.length) return false;

  // Support '*' wildcard to trust any proxy
  if (trustedProxies.includes('*')) return true;

  return trustedProxies.includes(ip);
};

/**
 * Detects potential IP spoofing patterns
 */
export const detectSpoofingPatterns = (chain: Array<string>, config: InternalIpValidationConfig): boolean => {
  if (!config.detectSpoofing || chain.length <= 1) return false;

  // Pattern 1: Too many hops (potential amplification attack)
  if (chain.length > config.maxChainLength) return true;

  // Pattern 2: Duplicate IPs in chain (suspicious)
  const uniqueIps = new Set(chain);
  if (uniqueIps.size !== chain.length) return true;

  // Pattern 3: Mix of invalid and valid IPs (obfuscation attempt)
  const validCount = chain.filter(isValidIpAddress).length;
  if (validCount > 0 && validCount < chain.length) return true;

  // Pattern 4: Reverse proxy spoofing detection disabled
  // Note: The pattern "public_ip, private_ip" is normal for legitimate X-Forwarded-For headers
  // More sophisticated detection would require knowledge of expected network topology

  return false;
};

/**
 * Validates X-Forwarded-For proxy chain
 */
const _validateXForwardedForChain = (ipChain: Array<string>, config: InternalIpValidationConfig): boolean => {
  if (ipChain.length <= 1) return true;

  const lastIp = ipChain[ipChain.length - 1];
  return Boolean(lastIp && isTrustedProxy(lastIp, config.trustedProxies));
};

/**
 * Extracts client IP from IP chain based on header type
 */
const _extractClientIp = (ipChain: Array<string>, headerName: string): string | undefined => {
  if (headerName === 'x-forwarded-for') {
    return ipChain[0]; // Client IP is first in X-Forwarded-For
  }
  return ipChain[ipChain.length - 1]; // For other headers, take the last value
};

/**
 * Creates a valid IP result object
 */
const _createValidIpResult = (options: {
  clientIp: string;
  headerName: string;
  ipChain: Array<string>;
  config: InternalIpValidationConfig;
}): InternalIpAddressResult => {
  const { clientIp, headerName, ipChain, config } = options;
  const isPrivate = isPrivateIp(clientIp);
  const trusted = headerName === 'x-forwarded-for' ? isTrustedProxy(ipChain[ipChain.length - 1] ?? '', config.trustedProxies) : true;

  return {
    ip: clientIp,
    isValid: true,
    isPrivate,
    source: headerName,
    trusted,
  };
};

/**
 * Creates an invalid IP result object
 */
const _createInvalidIpResult = (): InternalIpAddressResult => ({
  ip: '',
  isValid: false,
  isPrivate: false,
  source: 'socket',
  trusted: false,
});

/**
 * Extracts and validates IP addresses from headers with security checks
 */
const _extractIpFromHeaders = (headers: Partial<Record<InternalHttpHeaders, string>>, config: InternalIpValidationConfig): InternalIpAddressResult => {
  // Try each header in preference order
  for (const headerName of config.headerPreference) {
    const headerValue = headers[headerName];
    if (!headerValue) continue;

    // Handle comma-separated IP chains
    const ipChain = headerValue
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (ipChain.length === 0) continue;

    // Detect spoofing patterns
    if (detectSpoofingPatterns(ipChain, config)) continue;

    // For X-Forwarded-For, validate the proxy chain
    if (headerName === 'x-forwarded-for' && !_validateXForwardedForChain(ipChain, config)) {
      continue;
    }

    // Extract the client IP
    const clientIp = _extractClientIp(ipChain, headerName);
    if (!clientIp || !isValidIpAddress(clientIp)) continue;

    // Check if private IPs are allowed
    const isPrivate = isPrivateIp(clientIp);
    if (isPrivate && !config.allowPrivateIps) continue;

    return _createValidIpResult({ clientIp, headerName, ipChain, config });
  }

  return _createInvalidIpResult();
};

/**
 * Advanced IP parsing with comprehensive security validation
 * Uses server-level IP security configuration with optional overrides
 */
export const parseIpAddressSecure = (
  setup: InternalSetupImpl,
  headers: Partial<Record<InternalHttpHeaders, string>>,
  configOverride: Partial<InternalIpValidationConfig> = {},
): InternalIpAddressResult => {
  const serverConfig = setup._configuration.ipSecurity;
  const finalConfig = { ...serverConfig, ...configOverride };

  // Try to extract IP from headers first
  const headerResult = _extractIpFromHeaders(headers, finalConfig);
  if (headerResult.isValid) {
    return headerResult;
  }

  // No valid IP found from headers
  return {
    ip: '',
    isValid: false,
    isPrivate: false,
    source: 'socket',
    trusted: false,
  };
};

/**
 * Simple IP parsing function that returns just the IP address string
 * Provides backward compatibility for existing code
 */
export const parseIpAddress = (setup: InternalSetupImpl, headers: Partial<Record<InternalHttpHeaders, string>>): string => {
  const result = parseIpAddressSecure(setup, headers);
  return result.ip;
};
