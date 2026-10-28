const _hextetCount = 8;
const _hextetBits = 16;
const _hextetSize = 0x10000;

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
  const hextets = _parseIpv6(ipAddress);
  if (!hextets) return ipAddress;

  const mappedIpv4 = _mappedIpv4(hextets);
  if (mappedIpv4) return mappedIpv4;

  if (ipv6Subnet === false) return _formatIpv6(hextets);
  return `${_formatIpv6(_maskHextets(hextets, ipv6Subnet))}/${ipv6Subnet}`;
};

/** Parse IPv6 text into 8 hextets, or null when it isn't IPv6. Accepts brackets, a zone id and a dotted-quad tail. */
const _parseIpv6 = (ipAddress: string): Array<number> | null => {
  let text = ipAddress.trim();
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
  const zoneIndex = text.indexOf('%');
  if (zoneIndex !== -1) text = text.slice(0, zoneIndex);
  if (!text.includes(':')) return null;

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const head = _parseGroups(halves[0] ?? '');
  const tail = halves.length === 2 ? _parseGroups(halves[1] ?? '') : [];
  if (!head || !tail) return null;

  if (halves.length === 1) return head.length === _hextetCount ? head : null;
  const missing = _hextetCount - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
};

/** Parse colon-separated groups; a final dotted-quad group becomes two hextets. Null on any invalid group. */
const _parseGroups = (part: string): Array<number> | null => {
  if (part === '') return [];
  const groups = part.split(':');
  const hextets: Array<number> = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] ?? '';
    if (i === groups.length - 1 && group.includes('.')) {
      const ipv4 = _parseDottedQuad(group);
      if (!ipv4) return null;
      hextets.push(...ipv4);
    } else if (/^[0-9a-f]{1,4}$/i.test(group)) {
      hextets.push(parseInt(group, 16));
    } else {
      return null;
    }
  }
  return hextets;
};

/** `1.2.3.4` -> [0x0102, 0x0304], or null when not a valid dotted quad. */
const _parseDottedQuad = (text: string): [number, number] | null => {
  const octets = text.split('.');
  if (octets.length !== 4) return null;
  const values: Array<number> = [];
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null;
    const value = Number(octet);
    if (value > 255) return null;
    values.push(value);
  }
  const [a = 0, b = 0, c = 0, d = 0] = values;
  const highByte = a * 256;
  const lowByte = c * 256;
  return [highByte + b, lowByte + d];
};

/** `::ffff:a.b.c.d` (IPv4-mapped) -> `a.b.c.d`, otherwise null. */
const _mappedIpv4 = (hextets: Array<number>): string | null => {
  for (let i = 0; i < 5; i++) if (hextets[i] !== 0) return null;
  if (hextets[5] !== 0xffff) return null;
  const high = hextets[6] ?? 0;
  const low = hextets[7] ?? 0;
  return `${Math.floor(high / 256)}.${high % 256}.${Math.floor(low / 256)}.${low % 256}`;
};

/** Zero every bit after the first `prefixLength` bits. */
const _maskHextets = (hextets: Array<number>, prefixLength: number): Array<number> =>
  hextets.map((hextet, index) => {
    const bitsBefore = index * _hextetBits;
    const keptBits = Math.min(_hextetBits, Math.max(0, prefixLength - bitsBefore));
    if (keptBits === _hextetBits) return hextet;
    const dropped = 2 ** (_hextetBits - keptBits);
    return hextet - (hextet % dropped);
  });

/** RFC 5952 text: lowercase, no leading zeros, the longest run of two or more zero hextets as `::`. */
const _formatIpv6 = (hextets: Array<number>): string => {
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let i = 0; i <= hextets.length; i++) {
    if (i < hextets.length && hextets[i] === 0) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      if (i - runStart > bestLength) {
        bestStart = runStart;
        bestLength = i - runStart;
      }
      runStart = -1;
    }
  }

  const groups = hextets.map((hextet) => (hextet % _hextetSize).toString(16));
  if (bestLength < 2) return groups.join(':');
  return `${groups.slice(0, bestStart).join(':')}::${groups.slice(bestStart + bestLength).join(':')}`;
};
