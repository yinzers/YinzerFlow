import { formatIpv6, mappedIpv4Text, maskHextets, parseIpv6 } from '@core/utils/ipAddress.ts';

/**
 * Rate-limit key for a client IP address.
 *
 * IPv4 addresses are returned unchanged. IPv6 addresses are parsed, masked to their `/ipv6Subnet`
 * prefix and printed in RFC 5952 form plus the prefix length, so every textual spelling of addresses in
 * one subnet (compressed or expanded, any letter case, a zone id, brackets) lands on one key:
 * `2001:DB8:abcd:12ff::1` and `2001:0db8:abcd:1200:0:0:0:2` both give `2001:db8:abcd:1200::/56`.
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`, `::ffff:102:304`) is keyed as the IPv4 address.
 *
 * ## Security Considerations
 *
 * One IPv6 customer usually holds at least a /64 (often a /56 or /48), so keying on the full address
 * lets a single client rotate through 2^64 addresses and get a fresh bucket for each. Masking to the
 * subnet closes that. Text that isn't a valid IPv6 address is returned unchanged.
 *
 * @param ipAddress - Client IP as text (from `ctx.request.ipAddress`)
 * @param ipv6Subnet - Prefix length to mask IPv6 to (1-128), or `false` to key on the full address
 *
 * @example
 * ```ts
 * rateLimitIpKey('2001:db8::1', 56); // '2001:db8::/56'
 * rateLimitIpKey('::ffff:203.0.113.7', 56); // '203.0.113.7'
 * ```
 */
export const rateLimitIpKey = (ipAddress: string, ipv6Subnet: number | false): string => {
  const hextets = parseIpv6(ipAddress);
  if (!hextets) return ipAddress;

  const mappedIpv4 = mappedIpv4Text(hextets);
  if (mappedIpv4) return mappedIpv4;

  if (ipv6Subnet === false) return formatIpv6(hextets);
  return `${formatIpv6(maskHextets(hextets, ipv6Subnet))}/${ipv6Subnet}`;
};
