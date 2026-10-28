import type { InternalIpRange } from '@typedefs/internal/InternalIpAddress.js';

/**
 * Shared IP address parsing for client-IP resolution (trusted proxies) and rate-limit keys.
 *
 * Every address is handled as 8 16-bit hextets: IPv6 as itself, IPv4 as its IPv4-mapped IPv6 form
 * (`::ffff:a.b.c.d`). An IPv4 CIDR `/n` is therefore the mapped prefix `/(96 + n)`, so one membership check
 * covers both families and an IPv4-mapped socket peer matches an IPv4 trusted-proxy entry.
 */

const _hextetCount = 8;
const _hextetBits = 16;
const _hextetSize = 0x10000;
const _ipv4MappedPrefixBits = 96;

/** Parse IPv6 text into 8 hextets, or null when it isn't IPv6. Accepts brackets, a zone id and a dotted-quad tail. */
export const parseIpv6 = (ipAddress: string): Array<number> | null => {
  let text = ipAddress.trim();
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
  const zoneIndex = text.indexOf('%');
  if (zoneIndex !== -1) text = text.slice(0, zoneIndex);
  if (!text.includes(':')) return null;

  const halves = text.split('::');
  if (halves.length > 2) return null;

  // A dotted-quad tail is only valid as the very last group of the whole address
  const hasCompression = halves.length === 2;
  const head = _parseGroups(halves[0] ?? '', !hasCompression);
  const tail = hasCompression ? _parseGroups(halves[1] ?? '', true) : [];
  if (!head || !tail) return null;

  if (halves.length === 1) return head.length === _hextetCount ? head : null;
  const missing = _hextetCount - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
};

/**
 * Parse colon-separated groups. When `allowIpv4Tail` is set, a final dotted-quad group becomes two hextets;
 * anywhere else a dotted quad is invalid. Null on any invalid group.
 */
const _parseGroups = (part: string, allowIpv4Tail: boolean): Array<number> | null => {
  if (part === '') return [];
  const groups = part.split(':');
  const hextets: Array<number> = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] ?? '';
    if (allowIpv4Tail && i === groups.length - 1 && group.includes('.')) {
      const ipv4 = parseDottedQuad(group);
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
export const parseDottedQuad = (text: string): [number, number] | null => {
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
export const mappedIpv4Text = (hextets: Array<number>): string | null => {
  for (let i = 0; i < 5; i++) if (hextets[i] !== 0) return null;
  if (hextets[5] !== 0xffff) return null;
  const high = hextets[6] ?? 0;
  const low = hextets[7] ?? 0;
  return `${Math.floor(high / 256)}.${high % 256}.${Math.floor(low / 256)}.${low % 256}`;
};

/** Zero every bit after the first `prefixLength` bits. */
export const maskHextets = (hextets: Array<number>, prefixLength: number): Array<number> =>
  hextets.map((hextet, index) => {
    const bitsBefore = index * _hextetBits;
    const keptBits = Math.min(_hextetBits, Math.max(0, prefixLength - bitsBefore));
    if (keptBits === _hextetBits) return hextet;
    const dropped = 2 ** (_hextetBits - keptBits);
    return hextet - (hextet % dropped);
  });

/** RFC 5952 text: lowercase, no leading zeros, the longest run of two or more zero hextets as `::`. */
export const formatIpv6 = (hextets: Array<number>): string => {
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

/** Parse IPv4 (dotted quad) or IPv6 text into 8 hextets (IPv4 as IPv4-mapped), or null when it is neither. */
export const parseIp = (text: string): Array<number> | null => {
  const trimmed = text.trim();
  if (trimmed.includes(':') || trimmed.startsWith('[')) return parseIpv6(trimmed);
  const ipv4 = parseDottedQuad(trimmed);
  return ipv4 ? [0, 0, 0, 0, 0, 0xffff, ...ipv4] : null;
};

/** Canonical text for an address: IPv4 (and IPv4-mapped IPv6) as a dotted quad, IPv6 in RFC 5952 form. */
export const canonicalIpText = (hextets: Array<number>): string => mappedIpv4Text(hextets) ?? formatIpv6(hextets);

/**
 * Parse an exact address or a CIDR range (`10.0.0.0/8`, `fd00::/8`, `203.0.113.7`) into a range, or null when
 * malformed: bad address, prefix not an integer, or outside 0-32 (IPv4) / 0-128 (IPv6).
 */
export const parseIpRange = (text: string): InternalIpRange | null => {
  const slashIndex = text.indexOf('/');
  const addressText = slashIndex === -1 ? text : text.slice(0, slashIndex);
  const hextets = parseIp(addressText);
  if (!hextets) return null;

  const isIpv4 = !addressText.includes(':');
  const maxPrefix = isIpv4 ? 32 : 128;
  let prefix = maxPrefix;
  if (slashIndex !== -1) {
    const prefixText = text.slice(slashIndex + 1);
    if (!/^\d{1,3}$/.test(prefixText)) return null;
    prefix = Number(prefixText);
    if (prefix > maxPrefix) return null;
  }

  const prefixLength = isIpv4 ? _ipv4MappedPrefixBits + prefix : prefix;
  return { hextets: maskHextets(hextets, prefixLength), prefixLength };
};

/** True when `hextets` falls inside `range` (its first `prefixLength` bits match). */
export const isIpInRange = (hextets: Array<number>, range: InternalIpRange): boolean => {
  const masked = maskHextets(hextets, range.prefixLength);
  for (let i = 0; i < _hextetCount; i++) if (masked[i] !== range.hextets[i]) return false;
  return true;
};
