import type { InternalHttpHeaders } from '@typedefs/constants/http.js';
import type { InternalIpAddressResult, InternalTrustedProxyMatcher } from '@typedefs/internal/InternalIpAddress.js';
import { canonicalIpText, isIpInRange, parseIp, parseIpRange } from '@core/utils/ipAddress.ts';
import type { InternalIpSecurityOptions } from '@typedefs/internal/InternalConfiguration.js';
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

const _trustedProxyCache = new WeakMap<Array<string>, InternalTrustedProxyMatcher>();

/**
 * Compile `ipSecurity.trustedProxies` into a matcher: exact IPs and CIDR ranges (IPv4 and IPv6, such as
 * `10.0.0.0/8` or `fd00::/8`), or `'*'` to trust every peer. Run at config time, where a malformed entry throws,
 * and cached per array, so requests never re-parse it.
 *
 * @throws Error naming the malformed entry
 */
export const compileTrustedProxies = (trustedProxies: Array<string>): InternalTrustedProxyMatcher => {
  const cached = _trustedProxyCache.get(trustedProxies);
  if (cached) return cached;

  const matcher: InternalTrustedProxyMatcher = { trustsAll: false, ranges: [] };
  for (const [index, entry] of trustedProxies.entries()) {
    if (entry === '*') {
      matcher.trustsAll = true;
      continue;
    }
    const range = typeof entry === 'string' ? parseIpRange(entry.trim()) : null;
    if (!range) {
      throw new Error(
        `ipSecurity.trustedProxies[${index}] is not a valid IP address or CIDR range: ${JSON.stringify(entry)}. ` +
          "Use an address ('10.0.0.5', '::1'), a CIDR range ('10.0.0.0/8', 'fd00::/8'), or '*'.",
      );
    }
    matcher.ranges.push(range);
  }

  _trustedProxyCache.set(trustedProxies, matcher);
  return matcher;
};

/** True when the address (as hextets) is a trusted proxy. */
const _isTrustedHop = (hextets: Array<number>, matcher: InternalTrustedProxyMatcher): boolean =>
  matcher.trustsAll || matcher.ranges.some((range) => isIpInRange(hextets, range));

/**
 * Checks if an IP address text is a trusted proxy (exact IP, CIDR range, or `'*'`)
 */
export const isTrustedProxy = (ip: string, trustedProxies: Array<string>): boolean => {
  const hextets = parseIp(ip);
  return hextets !== null && _isTrustedHop(hextets, compileTrustedProxies(trustedProxies));
};

/**
 * Detects potential IP spoofing patterns
 */
export const detectSpoofingPatterns = (chain: Array<string>, config: InternalIpSecurityOptions): boolean => {
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
 * Client from an X-Forwarded-For chain sent by a trusted peer. The peer is the rightmost hop; walk the chain
 * right to left skipping trusted proxies, and the first untrusted hop is the client. If every hop is trusted,
 * the leftmost entry is. A malformed hop or a suspicious chain makes the header unusable (null): nothing left
 * of it can be trusted.
 */
const _clientFromForwardedChain = (headerValue: string, matcher: InternalTrustedProxyMatcher, config: InternalIpSecurityOptions): string | null => {
  const chain = headerValue
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (chain.length === 0 || detectSpoofingPatterns(chain, config)) return null;

  let leftmost: string | null = null;
  for (let i = chain.length - 1; i >= 0; i--) {
    const hop = parseIp(chain[i] ?? '');
    if (!hop) return null;
    if (!_isTrustedHop(hop, matcher)) return canonicalIpText(hop);
    leftmost = canonicalIpText(hop);
  }
  return leftmost;
};

/** Client from a single-value header (X-Real-IP and the rest), set by a trusted peer: its last entry. */
const _clientFromSingleValue = (headerValue: string): string | null => {
  const entries = headerValue
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  const hextets = parseIp(entries[entries.length - 1] ?? '');
  return hextets ? canonicalIpText(hextets) : null;
};

/** The socket peer as the result: canonical text when it parses, the raw text otherwise. */
const _socketResult = (peerAddress: string, peer: Array<number> | null): InternalIpAddressResult => {
  const ip = peer ? canonicalIpText(peer) : peerAddress;
  return { ip, isValid: peer !== null, isPrivate: isPrivateIp(ip), source: 'socket', trusted: false };
};

/**
 * Resolve the client IP for a request, with the standard trusted-proxy model (as in express `trust proxy` and
 * Fastify `trustProxy`).
 *
 * ## Security Considerations
 *
 * Client-IP headers are written by whoever sends the request, so they are read only when the socket peer is
 * in `ipSecurity.trustedProxies`. From any other peer the result is the socket address whatever headers
 * arrive: a client can't pick its own rate-limit bucket or appear as someone else. X-Forwarded-For from a
 * trusted peer is walked right to left past trusted proxies (see `_clientFromForwardedChain`), never read from
 * its attacker-writable left end. `'*'` trusts every peer and every hop, which is spoofable by design.
 *
 * @param setup - Server setup (its `ipSecurity` configuration)
 * @param headers - Parsed request headers
 * @param peerAddress - The socket's remote address
 */
export const parseIpAddressSecure = (
  setup: InternalSetupImpl,
  headers: Partial<Record<InternalHttpHeaders, string>>,
  peerAddress: string,
): InternalIpAddressResult => {
  const config = setup._configuration.ipSecurity;
  const matcher = compileTrustedProxies(config.trustedProxies);
  const peer = parseIp(peerAddress);
  const socketResult = _socketResult(peerAddress, peer);
  if (!peer || !_isTrustedHop(peer, matcher)) return socketResult;

  for (const headerName of config.headerPreference) {
    const headerValue = headers[headerName];
    if (!headerValue) continue;

    const clientIp = headerName === 'x-forwarded-for' ? _clientFromForwardedChain(headerValue, matcher, config) : _clientFromSingleValue(headerValue);
    if (!clientIp) continue;

    const isPrivate = isPrivateIp(clientIp);
    if (isPrivate && !config.allowPrivateIps) continue;

    return { ip: clientIp, isValid: true, isPrivate, source: headerName, trusted: true };
  }

  return socketResult;
};

/**
 * Resolve the client IP address string for a request (see `parseIpAddressSecure`)
 */
export const parseIpAddress = (setup: InternalSetupImpl, headers: Partial<Record<InternalHttpHeaders, string>>, peerAddress: string): string =>
  parseIpAddressSecure(setup, headers, peerAddress).ip;
