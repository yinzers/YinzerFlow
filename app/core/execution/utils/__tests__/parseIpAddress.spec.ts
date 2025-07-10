import { describe, expect, it } from 'bun:test';
import { detectSpoofingPatterns, isPrivateIp, isTrustedProxy, isValidIpAddress, parseIpAddress, parseIpAddressSecure } from '../parseIpAddress.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalIpValidationConfig } from '@typedefs/internal/InternalConfiguration.js';

describe('parseIpAddress', () => {
  describe('Basic IP extraction', () => {
    it('should return single IP from x-forwarded-for header', () => {
      const setup = new SetupImpl();
      const headers = { 'x-forwarded-for': '203.0.113.1' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('203.0.113.1');
    });

    it('should extract client IP from trusted proxy chain', () => {
      const setup = new SetupImpl({
        ipSecurity: { trustedProxies: ['127.0.0.1'] },
      });
      const headers = { 'x-forwarded-for': '203.0.113.1, 127.0.0.1' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('203.0.113.1');
    });

    it('should fall back to other headers when x-forwarded-for is missing', () => {
      const setup = new SetupImpl();
      const headers = { 'x-real-ip': '203.0.113.1' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('203.0.113.1');
    });

    it('should return empty string when no IP headers are present', () => {
      const setup = new SetupImpl();
      const headers = { host: 'example.com' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('');
    });

    it('should return empty string for invalid IP formats', () => {
      const setup = new SetupImpl();
      const headers = { 'x-forwarded-for': 'not.an.ip' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('');
    });
  });

  describe('Trusted proxy validation', () => {
    it('should reject untrusted proxy chains', () => {
      const setup = new SetupImpl({
        ipSecurity: { trustedProxies: ['192.168.1.1'] },
      });
      const headers = { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' }; // Untrusted proxy

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('');
    });

    it('should work with wildcard trusted proxies', () => {
      const setup = new SetupImpl({
        ipSecurity: { trustedProxies: ['*'] },
      });
      const headers = { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('203.0.113.1');
    });
  });

  describe('IPv6 addresses', () => {
    it('should handle IPv6 addresses correctly', () => {
      const setup = new SetupImpl({
        ipSecurity: { trustedProxies: ['::1'] },
      });
      const headers = { 'x-forwarded-for': '2001:db8::1, ::1' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('2001:db8::1');
    });

    it('should handle single IPv6 address', () => {
      const setup = new SetupImpl();
      const headers = { 'x-real-ip': '2001:db8::1' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('2001:db8::1');
    });
  });

  describe('Security protections', () => {
    it('should reject chains that exceed maxChainLength', () => {
      const setup = new SetupImpl({
        ipSecurity: {
          trustedProxies: ['*'],
          maxChainLength: 3,
        },
      });
      const longChain = Array.from({ length: 5 }, (_, i) => `192.168.1.${i + 1}`).join(', ');
      const headers = { 'x-forwarded-for': longChain };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('');
    });

    it('should reject chains with duplicate IPs', () => {
      const setup = new SetupImpl({
        ipSecurity: { trustedProxies: ['*'] },
      });
      const headers = { 'x-forwarded-for': '203.0.113.1, 203.0.113.1' };

      const result = parseIpAddress(setup, headers);

      expect(result).toBe('');
    });
  });
});

describe('IP Validation Utilities', () => {
  describe('isValidIpAddress', () => {
    describe('IPv4 addresses', () => {
      it('should validate correct IPv4 addresses', () => {
        expect(isValidIpAddress('192.168.1.1')).toBe(true);
        expect(isValidIpAddress('10.0.0.0')).toBe(true);
        expect(isValidIpAddress('255.255.255.255')).toBe(true);
        expect(isValidIpAddress('127.0.0.1')).toBe(true);
        expect(isValidIpAddress('0.0.0.0')).toBe(true);
      });

      it('should reject invalid IPv4 addresses', () => {
        expect(isValidIpAddress('256.1.1.1')).toBe(false);
        expect(isValidIpAddress('192.168.1')).toBe(false);
        expect(isValidIpAddress('192.168.1.1.1')).toBe(false);
        expect(isValidIpAddress('192.168.-1.1')).toBe(false);
        expect(isValidIpAddress('192.168.1.256')).toBe(false);
      });
    });

    describe('IPv6 addresses', () => {
      it('should validate correct IPv6 addresses', () => {
        expect(isValidIpAddress('2001:db8::1')).toBe(true);
        expect(isValidIpAddress('::1')).toBe(true);
        expect(isValidIpAddress('fe80::1%eth0')).toBe(true);
        expect(isValidIpAddress('2001:db8:85a3::8a2e:370:7334')).toBe(true);
        expect(isValidIpAddress('::ffff:192.0.2.1')).toBe(true);
      });

      it('should reject invalid IPv6 addresses', () => {
        expect(isValidIpAddress('2001:db8::1::2')).toBe(false);
        expect(isValidIpAddress('2001:db8:85a3::8a2e:370g:7334')).toBe(false);
        expect(isValidIpAddress('gggg::')).toBe(false);
      });

      it('should handle bracketed IPv6 addresses', () => {
        expect(isValidIpAddress('[2001:db8::1]')).toBe(true);
        expect(isValidIpAddress('[::1]')).toBe(true);
      });
    });

    describe('Invalid inputs', () => {
      it('should reject non-string inputs', () => {
        expect(isValidIpAddress('')).toBe(false);
        expect(isValidIpAddress(null as any)).toBe(false);
        expect(isValidIpAddress(undefined as any)).toBe(false);
        expect(isValidIpAddress(123 as any)).toBe(false);
      });

      it('should reject malformed addresses', () => {
        expect(isValidIpAddress('not.an.ip')).toBe(false);
        expect(isValidIpAddress('just-text')).toBe(false);
        expect(isValidIpAddress('192.168.1.1.extra')).toBe(false);
      });
    });
  });

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

  describe('isTrustedProxy', () => {
    it('should identify trusted proxies', () => {
      const trustedProxies = ['127.0.0.1', '192.168.1.10', '::1'];

      expect(isTrustedProxy('127.0.0.1', trustedProxies)).toBe(true);
      expect(isTrustedProxy('192.168.1.10', trustedProxies)).toBe(true);
      expect(isTrustedProxy('::1', trustedProxies)).toBe(true);
    });

    it('should reject untrusted IPs', () => {
      const trustedProxies = ['127.0.0.1'];

      expect(isTrustedProxy('192.168.1.1', trustedProxies)).toBe(false);
      expect(isTrustedProxy('8.8.8.8', trustedProxies)).toBe(false);
    });

    it('should handle wildcard (*) to trust any proxy', () => {
      expect(isTrustedProxy('203.0.113.1', ['*'])).toBe(true);
      expect(isTrustedProxy('192.168.1.1', ['*'])).toBe(true);
      expect(isTrustedProxy('127.0.0.1', ['*'])).toBe(true);
      expect(isTrustedProxy('2001:db8::1', ['*'])).toBe(true);
    });

    it('should handle empty inputs', () => {
      expect(isTrustedProxy('', ['127.0.0.1'])).toBe(false);
      expect(isTrustedProxy('127.0.0.1', [])).toBe(false);
      expect(isTrustedProxy('', ['*'])).toBe(false);
    });
  });

  describe('detectSpoofingPatterns', () => {
    const mockConfig: InternalIpValidationConfig = {
      trustedProxies: ['127.0.0.1'],
      allowPrivateIps: true,
      headerPreference: ['x-forwarded-for'],
      maxChainLength: 5,
      detectSpoofing: true,
    };

    it('should detect chains that are too long', () => {
      const longChain = Array.from({ length: 10 }, (_, i) => `192.168.1.${i + 1}`);
      expect(detectSpoofingPatterns(longChain, mockConfig)).toBe(true);
    });

    it('should detect duplicate IPs in chain', () => {
      const duplicateChain = ['192.168.1.1', '203.0.113.1', '192.168.1.1'];
      expect(detectSpoofingPatterns(duplicateChain, mockConfig)).toBe(true);
    });

    it('should detect mixed valid/invalid IPs', () => {
      const mixedChain = ['192.168.1.1', 'not.an.ip', '203.0.113.1'];
      expect(detectSpoofingPatterns(mixedChain, mockConfig)).toBe(true);
    });

    it('should detect reverse proxy spoofing patterns (currently disabled)', () => {
      const suspiciousChain = ['8.8.8.8', '192.168.1.1']; // Public then private
      // Note: This pattern is actually normal for X-Forwarded-For, so detection is disabled
      expect(detectSpoofingPatterns(suspiciousChain, mockConfig)).toBe(false);
    });

    it('should allow legitimate chains', () => {
      const legitimateChain = ['203.0.113.1', '198.51.100.1'];
      expect(detectSpoofingPatterns(legitimateChain, mockConfig)).toBe(false);
    });

    it('should skip detection when disabled', () => {
      const configWithoutDetection = { ...mockConfig, detectSpoofing: false };
      const duplicateChain = ['192.168.1.1', '192.168.1.1'];
      expect(detectSpoofingPatterns(duplicateChain, configWithoutDetection)).toBe(false);
    });

    it('should skip single IP chains', () => {
      const singleIp = ['192.168.1.1'];
      expect(detectSpoofingPatterns(singleIp, mockConfig)).toBe(false);
    });
  });
});

describe('parseIpAddressSecure', () => {
  const setup = new SetupImpl();

  describe('Header preference order', () => {
    it('should prefer x-forwarded-for over other headers', () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1',
        'x-real-ip': '198.51.100.1',
        'cf-connecting-ip': '192.0.2.1',
      };

      const result = parseIpAddressSecure(setup, headers, {
        trustedProxies: ['127.0.0.1'],
        detectSpoofing: false,
      });

      expect(result.ip).toBe('203.0.113.1');
      expect(result.source).toBe('x-forwarded-for');
    });

    it('should fallback to next header if first is missing', () => {
      const headers = {
        'x-real-ip': '198.51.100.1',
        'cf-connecting-ip': '192.0.2.1',
      };

      const result = parseIpAddressSecure(setup, headers);

      expect(result.ip).toBe('198.51.100.1');
      expect(result.source).toBe('x-real-ip');
    });

    it('should handle Cloudflare headers', () => {
      const headers = {
        'cf-connecting-ip': '203.0.113.1',
      };

      const result = parseIpAddressSecure(setup, headers);

      expect(result.ip).toBe('203.0.113.1');
      expect(result.source).toBe('cf-connecting-ip');
    });
  });

  describe('Trusted proxy validation', () => {
    it('should require trusted proxy for x-forwarded-for chains', () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1, 192.168.1.1',
      };

      const result = parseIpAddressSecure(setup, headers, {
        trustedProxies: ['192.168.1.1'],
      });

      expect(result.ip).toBe('203.0.113.1');
      expect(result.trusted).toBe(true);
    });

    it('should reject untrusted forwarded headers', () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1, 192.168.1.1',
      };

      const result = parseIpAddressSecure(setup, headers, {
        trustedProxies: ['127.0.0.1'], // Different from actual proxy
      });

      expect(result.ip).toBe('');
      expect(result.isValid).toBe(false);
    });

    it('should accept any proxy with wildcard (*)', () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1, 198.51.100.10', // Any proxy IP
      };

      const result = parseIpAddressSecure(setup, headers, {
        trustedProxies: ['*'], // Trust any proxy
      });

      expect(result.ip).toBe('203.0.113.1');
      expect(result.isValid).toBe(true);
      expect(result.trusted).toBe(true);
      expect(result.source).toBe('x-forwarded-for');
    });
  });

  describe('Spoofing detection', () => {
    it('should skip suspicious IP chains', () => {
      const headers = {
        'x-forwarded-for': '192.168.1.1, 192.168.1.1', // Duplicate IPs
      };

      const result = parseIpAddressSecure(setup, headers, {
        detectSpoofing: true,
        trustedProxies: ['127.0.0.1'],
      });

      expect(result.ip).toBe('');
      expect(result.isValid).toBe(false);
    });

    it('should allow chains when spoofing detection is disabled', () => {
      const headers = {
        'x-forwarded-for': '192.168.1.1, 192.168.1.1', // Duplicate IPs
      };

      const result = parseIpAddressSecure(setup, headers, {
        detectSpoofing: false,
        trustedProxies: ['192.168.1.1'],
      });

      expect(result.ip).toBe('192.168.1.1');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Private IP handling', () => {
    it('should allow private IPs by default', () => {
      const headers = {
        'x-real-ip': '192.168.1.1',
      };

      const result = parseIpAddressSecure(setup, headers);

      expect(result.ip).toBe('192.168.1.1');
      expect(result.isPrivate).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should reject private IPs when disabled', () => {
      const headers = {
        'x-real-ip': '192.168.1.1',
      };

      const result = parseIpAddressSecure(setup, headers, {
        allowPrivateIps: false,
      });

      expect(result.ip).toBe('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid IP addresses gracefully', () => {
      const headers = {
        'x-forwarded-for': 'not.an.ip',
      };

      const result = parseIpAddressSecure(setup, headers);

      expect(result.ip).toBe('');
      expect(result.source).toBe('socket');
      expect(result.trusted).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('should reject untrusted proxy chains when no trusted proxies configured', () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1, 192.168.1.1',
      };

      const result = parseIpAddressSecure(setup, headers, {
        trustedProxies: [], // No trusted proxies configured
      });

      expect(result.ip).toBe('');
      expect(result.isValid).toBe(false);
      expect(result.source).toBe('socket');
      expect(result.trusted).toBe(false);
    });
  });

  describe('IPv6 support', () => {
    it('should handle IPv6 addresses correctly', () => {
      const headers = {
        'x-real-ip': '2001:db8::1',
      };

      const result = parseIpAddressSecure(setup, headers);

      expect(result.ip).toBe('2001:db8::1');
      expect(result.isValid).toBe(true);
      expect(result.isPrivate).toBe(false);
    });

    it('should detect private IPv6 addresses', () => {
      const headers = {
        'x-real-ip': '::1',
      };

      const result = parseIpAddressSecure(setup, headers);

      expect(result.ip).toBe('::1');
      expect(result.isValid).toBe(true);
      expect(result.isPrivate).toBe(true);
    });
  });

  describe('Configuration handling', () => {
    it('should use default configuration when none provided', () => {
      const headers = {
        'x-real-ip': '203.0.113.1',
      };

      const result = parseIpAddressSecure(setup, headers);

      expect(result.isValid).toBe(true);
      expect(result.trusted).toBe(true); // x-real-ip is trusted by default
    });

    it('should merge provided config with defaults', () => {
      const headers = {
        'custom-ip': '203.0.113.1',
      };

      const result = parseIpAddressSecure(setup, headers, {
        headerPreference: ['custom-ip'],
      });

      expect(result.ip).toBe('203.0.113.1');
      expect(result.source).toBe('custom-ip');
    });
  });
});
