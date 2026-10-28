import { describe, expect, it } from 'bun:test';
import { isPrivateIp, isTrustedProxy, parseIpAddressSecure } from '../parseIpAddress.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { ServerOptions } from '@typedefs/public/Configuration.js';

// Bug: client-IP headers were trusted without consulting the socket peer: a single-entry X-Forwarded-For was
// accepted unchecked, a chain was trusted when its attacker-written last entry was a proxy, and X-Real-IP and
// friends had no check at all, so any client could pick its own IP (and rate-limit bucket). Tier: High (authz-adjacent
// identity of untrusted input).
describe('parseIpAddressSecure (client IP from the socket peer and trusted proxies)', () => {
  const untrustedPeer = '192.168.80.2';
  const cases: Array<[description: string, ipSecurity: ServerOptions['ipSecurity'], headers: Record<string, string>, peer: string, expected: string]> = [
    ['untrusted peer, single-entry X-Forwarded-For', undefined, { 'x-forwarded-for': '203.0.113.9' }, untrustedPeer, untrustedPeer],
    ['untrusted peer, X-Real-IP', undefined, { 'x-real-ip': '203.0.113.9' }, untrustedPeer, untrustedPeer],
    ['untrusted peer, CF-Connecting-IP', undefined, { 'cf-connecting-ip': '203.0.113.9' }, untrustedPeer, untrustedPeer],
    ['untrusted peer, X-Client-IP', undefined, { 'x-client-ip': '203.0.113.9' }, untrustedPeer, untrustedPeer],
    ['untrusted peer, True-Client-IP', undefined, { 'true-client-ip': '203.0.113.9' }, untrustedPeer, untrustedPeer],
    ['untrusted peer, spoofed "<random>, 127.0.0.1" chain', undefined, { 'x-forwarded-for': '203.0.113.9, 127.0.0.1' }, untrustedPeer, untrustedPeer],
    ['untrusted peer, no headers', undefined, {}, untrustedPeer, untrustedPeer],
    ['trusted peer, single-entry X-Forwarded-For', undefined, { 'x-forwarded-for': '203.0.113.9' }, '127.0.0.1', '203.0.113.9'],
    ['trusted peer, X-Real-IP opted in', { headerPreference: ['x-real-ip'] }, { 'x-real-ip': '203.0.113.9' }, '127.0.0.1', '203.0.113.9'],
    // Bug: the default listed five headers, so a proxy that only sets one passed the others through from the client
    ['trusted peer, default list ignores a passed-through X-Real-IP', undefined, { 'x-real-ip': '6.6.6.6' }, '127.0.0.1', '127.0.0.1'],
    [
      'trusted peer, multi-hop chain: first untrusted hop from the right',
      { trustedProxies: ['127.0.0.1', '10.0.0.0/8'] },
      { 'x-forwarded-for': '198.51.100.7, 203.0.113.9, 10.1.2.3' },
      '127.0.0.1',
      '203.0.113.9',
    ],
    [
      'trusted peer, every hop trusted: leftmost entry',
      { trustedProxies: ['127.0.0.1', '10.0.0.0/8'] },
      { 'x-forwarded-for': '10.0.0.5, 10.0.0.6' },
      '127.0.0.1',
      '10.0.0.5',
    ],
    ['trusted peer, malformed hop the walk reaches: socket address used', undefined, { 'x-forwarded-for': '203.0.113.9, nope' }, '127.0.0.1', '127.0.0.1'],
    ['IPv4-mapped peer matches an IPv4 trusted proxy', undefined, { 'x-forwarded-for': '203.0.113.9' }, '::ffff:127.0.0.1', '203.0.113.9'],
    ['IPv4-mapped untrusted peer is reported as IPv4', undefined, { 'x-forwarded-for': '203.0.113.9' }, `::ffff:${untrustedPeer}`, untrustedPeer],
    ['IPv6 peer in a trusted fd00::/8 range', { trustedProxies: ['fd00::/8'] }, { 'x-forwarded-for': '2001:DB8::1' }, 'fd12:3456::1', '2001:db8::1'],
    [
      "'*' trusts every peer and hop (leftmost entry, spoofable)",
      { trustedProxies: ['*'] },
      { 'x-forwarded-for': '203.0.113.9, 198.51.100.1' },
      untrustedPeer,
      '203.0.113.9',
    ],
  ];

  it.each(cases)('%s', (_description, ipSecurity, headers, peer, expected) => {
    const setup = new SetupImpl(ipSecurity ? { ipSecurity } : undefined);
    expect(parseIpAddressSecure(setup, headers, peer).ip).toBe(expected);
  });
});

// Bug: a chain check ran over the whole X-Forwarded-For, including the left end the client writes, and an
// unusable result fell through to the next header, so a client could make the trusted proxy's XFF "invalid" and
// be resolved from an X-Real-IP it wrote itself. Tier: High (client-chosen identity).
describe('X-Forwarded-For fallthrough probes from a trusted peer', () => {
  const realClient = '198.51.100.7';
  const ipSecurity = { headerPreference: ['x-forwarded-for', 'x-real-ip'] };
  const elevenHops = [...Array.from({ length: 10 }, (_unused, index) => `192.0.2.${index + 1}`), realClient].join(', ');
  const probes: Array<[description: string, forwardedFor: string, extra: ServerOptions['ipSecurity'], expected: string]> = [
    ['junk at the left end', `junk, ${realClient}`, {}, realClient],
    ['a duplicate entry', `${realClient}, ${realClient}`, {}, realClient],
    ['11 hops, over maxChainLength', elevenHops, {}, realClient],
    ['an IPv4 hop with a port', `1.2.3.4:80, ${realClient}`, {}, realClient],
    ['a bracketed IPv6 hop with a port', `[2001:db8::1]:80, ${realClient}`, {}, realClient],
    ['a port on the reached hop', `${realClient}:4321`, {}, realClient],
    ['a private real client with allowPrivateIps off: socket, not the next header', '192.168.5.5', { allowPrivateIps: false }, '127.0.0.1'],
    ['left-hand junk past the first untrusted hop is ignored', 'foo, 203.0.113.9', {}, '203.0.113.9'],
  ];

  it.each(probes)('%s', (_description, forwardedFor, extra, expected) => {
    const setup = new SetupImpl({ ipSecurity: { ...ipSecurity, ...extra } });
    const headers = { 'x-forwarded-for': forwardedFor, 'x-real-ip': '6.6.6.6' };
    expect(parseIpAddressSecure(setup, headers, '127.0.0.1').ip).toBe(expected);
  });
});

// Bug: trustedProxies only matched exact strings, so a proxy fleet behind a CIDR could not be trusted and an
// IPv4-mapped or respelled peer didn't match its own entry. Tier: High (range boundaries decide trust).
describe('isTrustedProxy CIDR membership', () => {
  const cases: Array<[range: string, address: string, expected: boolean]> = [
    ['10.0.0.0/8', '10.0.0.0', true],
    ['10.0.0.0/8', '10.255.255.255', true],
    ['10.0.0.0/8', '11.0.0.0', false],
    ['10.0.0.0/8', '9.255.255.255', false],
    ['192.168.1.0/31', '192.168.1.1', true],
    ['192.168.1.0/31', '192.168.1.2', false],
    ['203.0.113.7/32', '203.0.113.7', true],
    ['203.0.113.7/32', '203.0.113.8', false],
    ['0.0.0.0/0', '198.51.100.1', true],
    ['0.0.0.0/0', '2001:db8::1', false],
    ['10.0.0.0/8', '::ffff:10.1.2.3', true],
    ['fd00::/8', 'fd00::', true],
    ['fd00::/8', 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', true],
    ['fd00::/8', 'fe00::', false],
    ['fd00::/8', 'fc00::', false],
    ['2001:db8::/32', '2001:db8:ffff::1', true],
    ['2001:db8::/32', '2001:db9::', false],
    ['::1', '0:0:0:0:0:0:0:1', true],
  ];

  it.each(cases)('%s contains %s: %p', (range, address, expected) => {
    expect(isTrustedProxy(address, [range])).toBe(expected);
  });
});

// Bug: a malformed trustedProxies entry was silently never matched instead of failing at startup. Tier: High (config validation of a trust boundary).
describe('trustedProxies validation', () => {
  it.each([['10.0.0.0/33'], ['10.0.0.0/-1'], ['10.0.0/8'], ['fd00::/129'], ['not-an-ip'], [''], ['1.2.3.4/']])('throws at config for %p', (entry) => {
    expect(() => new SetupImpl({ ipSecurity: { trustedProxies: [entry] } })).toThrow('ipSecurity.trustedProxies[0] is not a valid IP address or CIDR range');
  });
});

describe('IP Validation Utilities', () => {
  describe('isPrivateIp', () => {
    describe('IPv4 private ranges', () => {
      it('should identify RFC 1918 private addresses', () => {
        expect(isPrivateIp('10.0.0.1')).toBe(true);
        expect(isPrivateIp('172.16.0.1')).toBe(true);
        expect(isPrivateIp('172.31.255.255')).toBe(true);
        expect(isPrivateIp('192.168.1.1')).toBe(true);
      });

      it('should identify loopback addresses', () => {
        expect(isPrivateIp('127.0.0.1')).toBe(true);
        expect(isPrivateIp('127.255.255.255')).toBe(true);
      });

      it('should identify link-local addresses', () => {
        expect(isPrivateIp('169.254.1.1')).toBe(true);
      });

      it('should reject public IPv4 addresses', () => {
        expect(isPrivateIp('8.8.8.8')).toBe(false);
        expect(isPrivateIp('203.0.113.1')).toBe(false);
        expect(isPrivateIp('1.1.1.1')).toBe(false);
      });
    });

    describe('IPv6 private ranges', () => {
      it('should identify loopback address', () => {
        expect(isPrivateIp('::1')).toBe(true);
      });

      it('should identify link-local addresses', () => {
        expect(isPrivateIp('fe80::1')).toBe(true);
        expect(isPrivateIp('FE80::1')).toBe(true); // Case insensitive
      });

      it('should identify unique local addresses', () => {
        expect(isPrivateIp('fc00::1')).toBe(true);
        expect(isPrivateIp('fd00::1')).toBe(true);
      });

      it('should reject public IPv6 addresses', () => {
        expect(isPrivateIp('2001:db8::1')).toBe(false);
        expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
      });

      it('should handle bracketed IPv6 addresses', () => {
        expect(isPrivateIp('[::1]')).toBe(true);
        expect(isPrivateIp('[fe80::1]')).toBe(true);
      });
    });

    it('should handle empty/invalid inputs', () => {
      expect(isPrivateIp('')).toBe(false);
      expect(isPrivateIp('not.an.ip')).toBe(false);
    });
  });
});
