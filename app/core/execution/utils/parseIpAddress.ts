import type { InternalHttpHeaders } from '@typedefs/constants/http.js';
import type { InternalIpAddressResult, InternalTrustedProxyMatcher } from '@typedefs/internal/InternalIpAddress.js';
import { canonicalIpText, isIpInRange, parseIp, parseIpRange } from '@core/utils/ipAddress.ts';
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
 * Checks if an IP address is in a private range
 */
export const isPrivateIp = (ip: string): boolean => {
  if (!ip) return false;
  const cleanIp = ip.replace(/^\[|\]$/g, '');
  return PRIVATE_IP_RANGES.some((range) => range.test(cleanIp));
};

/**
 * Compile `ipSecurity.trustedProxies` into a matcher: exact IPs and CIDR ranges (IPv4 and IPv6, such as
 * `10.0.0.0/8` or `fd00::/8`), or `'*'` to trust every peer. Run at config time only: validation calls it so a
 * malformed entry throws at startup, and SetupImpl keeps the result as `_trustedProxyMatcher`, a parsed copy, so
 * requests never parse the list and later changes to the configured array have no effect.
 *
 * @throws Error naming the malformed entry
 */
export const compileTrustedProxies = (trustedProxies: Array<string>): InternalTrustedProxyMatcher => {
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

  return matcher;
};

/** True when the address (as hextets) is a trusted proxy. */
const _isTrustedHop = (hextets: Array<number>, matcher: InternalTrustedProxyMatcher): boolean =>
  matcher.trustsAll || matcher.ranges.some((range) => isIpInRange(hextets, range));

/**
 * Strip a port from one forwarded hop: `1.2.3.4:80` -> `1.2.3.4`, `[2001:db8::1]:80` -> `2001:db8::1`. A bare
 * IPv6 address (several colons, no brackets) has no port and is returned unchanged.
 */
const _stripPort = (hop: string): string => {
  if (hop.startsWith('[')) {
    const close = hop.indexOf(']');
    return close === -1 ? hop : hop.slice(1, close);
  }
  const colon = hop.indexOf(':');
  return colon !== -1 && colon === hop.lastIndexOf(':') ? hop.slice(0, colon) : hop;
};

/**
 * Client from an X-Forwarded-For chain sent by a trusted peer.
 *
 * The peer is the rightmost hop. Walk the entries right to left, parsing each one only when the walk reaches it:
 * a trusted proxy is skipped, and the first untrusted hop is the client. Everything left of it was written by
 * the client and is never examined, so junk, duplicates or extra hops there can't make the header unusable
 * (which is what let a client fall through to a header it wrote). If every hop is trusted, the leftmost is the
 * client. Null when a hop the walk reaches is malformed, or when the walk would pass more than
 * `maxChainLength` hops, a bound that only matters with very wide trust such as `'*'`.
 */
const _clientFromForwardedChain = (headerValue: string, matcher: InternalTrustedProxyMatcher, maxChainLength: number): string | null => {
  const entries = headerValue.split(',');
  let leftmost: string | null = null;
  let walked = 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const text = (entries[i] ?? '').trim();
    if (text === '') continue;
    walked += 1;
    if (walked > maxChainLength) return null;

    const hop = parseIp(_stripPort(text));
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
  const hextets = parseIp(_stripPort(entries[entries.length - 1] ?? ''));
  return hextets ? canonicalIpText(hextets) : null;
};

let _hasWarnedUnparseablePeer = false;

/**
 * Warn once per process when a socket peer address doesn't parse (a Unix socket, `'unknown'`, an unexpected runtime
 * format). Such a peer is never trusted, so forwarded headers are ignored and every such client shares one key.
 */
const _warnUnparseablePeer = (setup: InternalSetupImpl, peerAddress: string): void => {
  if (_hasWarnedUnparseablePeer) return;
  _hasWarnedUnparseablePeer = true;
  setup._log.warn(
    `[IP SECURITY] Could not parse the socket peer address ${JSON.stringify(peerAddress)}. Forwarded client-IP headers ` +
      'are ignored for such connections and they all share one rate-limit key. Check how YinzerFlow is being reached.',
  );
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
 * its attacker-writable left end. Only the first configured header present is used; if it is unusable the
 * socket address is returned rather than any later header. `'*'` trusts every peer and every hop, which is spoofable by design.
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
  const matcher = setup._trustedProxyMatcher;
  const peer = parseIp(peerAddress);
  if (!peer && peerAddress !== '') _warnUnparseablePeer(setup, peerAddress);
  const socketResult = _socketResult(peerAddress, peer);
  if (!peer || !_isTrustedHop(peer, matcher)) return socketResult;

  // The first configured header that is present is final. If it can't be used (malformed reached hop, a private
  // client with allowPrivateIps off), the answer is the socket address, never the next header: a client can
  // always add a header the proxy doesn't set, so falling through would let it choose its own IP.
  const headerName = config.headerPreference.find((name) => Boolean(headers[name]));
  const headerValue = headerName ? headers[headerName] : undefined;
  if (!headerName || !headerValue) return socketResult;

  const clientIp =
    headerName === 'x-forwarded-for' ? _clientFromForwardedChain(headerValue, matcher, config.maxChainLength) : _clientFromSingleValue(headerValue);
  if (!clientIp) return socketResult;

  const isPrivate = isPrivateIp(clientIp);
  if (isPrivate && !config.allowPrivateIps) return socketResult;

  return { ip: clientIp, isValid: true, isPrivate, source: headerName, trusted: true };
};

/**
 * Resolve the client IP address string for a request (see `parseIpAddressSecure`)
 */
export const parseIpAddress = (setup: InternalSetupImpl, headers: Partial<Record<InternalHttpHeaders, string>>, peerAddress: string): string =>
  parseIpAddressSecure(setup, headers, peerAddress).ip;
