import { describe, expect, it } from 'bun:test';
import { rateLimitIpKey } from '@core/modules/rateLimit/ipKey.ts';

// Bug: the default key was the raw IP text, so one IPv6 client rotating addresses in its /64 (or respelling
// one address) got a fresh bucket each time. Tier: High (parser of untrusted input feeding a security control).
describe('rateLimitIpKey', () => {
  const cases: Array<[description: string, input: string, ipv6Subnet: number | false, expected: string]> = [
    ['compressed form', '2001:db8::1', 56, '2001:db8::/56'],
    ['expanded form of the same address', '2001:0db8:0000:0000:0000:0000:0000:0001', 56, '2001:db8::/56'],
    ['mixed case', '2001:DB8:AbCd:12Ff::1', 56, '2001:db8:abcd:1200::/56'],
    ['another address in the same /56', '2001:db8:abcd:1200:dead:beef:0:2', 56, '2001:db8:abcd:1200::/56'],
    ['an address in a different /56', '2001:db8:abcd:1300::1', 56, '2001:db8:abcd:1300::/56'],
    ['IPv4-mapped IPv6 (dotted)', '::ffff:203.0.113.7', 56, '203.0.113.7'],
    ['IPv4-mapped IPv6 (hex)', '::FFFF:CB00:7107', 56, '203.0.113.7'],
    ['plain IPv4', '203.0.113.7', 56, '203.0.113.7'],
    ['zone id and brackets', '[fe80::1%eth0]', 56, 'fe80::/56'],
    ['/64 mask boundary', '2001:db8:1:2:3:4:5:6', 64, '2001:db8:1:2::/64'],
    ['/128 keeps the whole address', '2001:db8::1', 128, '2001:db8::1/128'],
    ['masking disabled', '2001:0DB8::0001', false, '2001:db8::1'],
    ['invalid text passes through', '2001:db8:::1', 56, '2001:db8:::1'],
    ['too many groups passes through', '1:2:3:4:5:6:7:8:9', 56, '1:2:3:4:5:6:7:8:9'],
    ['dotted quad not in final position passes through', '1.2.3.4::', 56, '1.2.3.4::'],
  ];

  it.each(cases)('%s: %s -> %p', (_description, input, ipv6Subnet, expected) => {
    expect(rateLimitIpKey(input, ipv6Subnet)).toBe(expected);
  });
});
