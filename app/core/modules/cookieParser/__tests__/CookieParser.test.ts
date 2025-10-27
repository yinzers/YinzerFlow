import { beforeEach, describe, expect, it } from 'bun:test';
import { CookieParser } from '../CookieParser.ts';

describe('CookieParser', () => {
  let parser: CookieParser;

  beforeEach(() => {
    parser = new CookieParser();
  });

  describe('parse', () => {
    it('should parse a single cookie', () => {
      const cookies = parser.parse('theme=dark');
      expect(cookies.get('theme')).toBe('dark');
      expect(cookies.size).toBe(1);
    });

    it('should parse multiple cookies', () => {
      const cookies = parser.parse('theme=dark; lang=en; userId=123');
      expect(cookies.get('theme')).toBe('dark');
      expect(cookies.get('lang')).toBe('en');
      expect(cookies.get('userId')).toBe('123');
      expect(cookies.size).toBe(3);
    });

    it('should decode URL-encoded values', () => {
      const cookies = parser.parse('name=John%20Doe; email=test%40example.com');
      expect(cookies.get('name')).toBe('John Doe');
      expect(cookies.get('email')).toBe('test@example.com');
    });

    it('should handle empty cookie header', () => {
      const cookies = parser.parse('');
      expect(cookies.size).toBe(0);
    });

    it('should handle malformed cookies gracefully', () => {
      const cookies = parser.parse('invalid; theme= here we are; noEqualSign');
      expect(cookies.get('theme')).toBe('here we are');
      expect(cookies.size).toBe(1);
    });

    it('should trim whitespace', () => {
      const cookies = parser.parse(' theme = dark ; lang = en ');
      expect(cookies.get('theme')).toBe('dark');
      expect(cookies.get('lang')).toBe('en');
    });
  });

  describe('set', () => {
    it('should create a basic cookie string', () => {
      const cookieStr = parser.set('theme', 'dark');
      expect(cookieStr).toBe('theme=dark');
    });

    it('should URL encode cookie name and value', () => {
      const cookieStr = parser.set('my theme', 'dark mode');
      expect(cookieStr).toBe('my%20theme=dark%20mode');
    });

    it('should include maxAge attribute', () => {
      const cookieStr = parser.set('sessionId', 'abc123', { maxAge: 3600 });
      expect(cookieStr).toContain('Max-Age=3600');
    });

    it('should include expires attribute', () => {
      const expires = new Date('2025-12-31T23:59:59Z');
      const cookieStr = parser.set('sessionId', 'abc123', { expires });
      expect(cookieStr).toContain('Expires=');
      expect(cookieStr).toContain(expires.toUTCString());
    });

    it('should include domain attribute', () => {
      const cookieStr = parser.set('theme', 'dark', { domain: 'example.com' });
      expect(cookieStr).toContain('Domain=example.com');
    });

    it('should include path attribute', () => {
      const cookieStr = parser.set('theme', 'dark', { path: '/api' });
      expect(cookieStr).toContain('Path=/api');
    });

    it('should include secure flag', () => {
      const cookieStr = parser.set('sessionId', 'abc123', { secure: true });
      expect(cookieStr).toContain('Secure');
    });

    it('should include httpOnly flag', () => {
      const cookieStr = parser.set('sessionId', 'abc123', { httpOnly: true });
      expect(cookieStr).toContain('HttpOnly');
    });

    it('should include sameSite attribute', () => {
      const cookieStr = parser.set('sessionId', 'abc123', { sameSite: 'strict' });
      expect(cookieStr).toContain('SameSite=Strict');
    });

    it('should include all attributes', () => {
      const cookieStr = parser.set('sessionId', 'abc123', {
        maxAge: 3600,
        domain: 'example.com',
        path: '/api',
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
      });

      expect(cookieStr).toContain('Max-Age=3600');
      expect(cookieStr).toContain('Domain=example.com');
      expect(cookieStr).toContain('Path=/api');
      expect(cookieStr).toContain('Secure');
      expect(cookieStr).toContain('HttpOnly');
      expect(cookieStr).toContain('SameSite=Strict');
    });
  });

  describe('sign', () => {
    it('should sign a cookie value', () => {
      const parserWithSecret = new CookieParser({ secret: 'test-secret-key-at-least-32-chars-long' });
      const signed = parserWithSecret.sign('sessionId', 'abc123');

      expect(signed).toContain('abc123.');
      expect(signed.split('.').length).toBe(2);
    });

    it('should throw error if no secret configured', () => {
      expect(() => parser.sign('sessionId', 'abc123')).toThrow('Cannot sign cookie: no secret configured');
    });
  });

  describe('unsign', () => {
    it('should unsign and validate a signed cookie', () => {
      const parserWithSecret = new CookieParser({ secret: 'test-secret-key-at-least-32-chars-long' });
      const signed = parserWithSecret.sign('sessionId', 'abc123');
      const unsigned = parserWithSecret.unsign('sessionId', signed);

      expect(unsigned).toBe('abc123');
    });

    it('should return false for tampered cookies', () => {
      const parserWithSecret = new CookieParser({ secret: 'test-secret-key-at-least-32-chars-long' });
      const signed = parserWithSecret.sign('sessionId', 'abc123');
      const tampered = signed.replace('abc123', 'tampered');

      expect(parserWithSecret.unsign('sessionId', tampered)).toBe(false);
    });

    it('should return false for invalid signature format', () => {
      const parserWithSecret = new CookieParser({ secret: 'test-secret-key-at-least-32-chars-long' });
      expect(parserWithSecret.unsign('sessionId', 'no-signature')).toBe(false);
    });

    it('should throw error if no secret configured', () => {
      expect(() => parser.unsign('sessionId', 'signed.value')).toThrow('Cannot unsign cookie: no secret configured');
    });
  });

  describe('shouldSign', () => {
    it('should return true for all cookies when signed array is undefined', () => {
      const parserWithSecret = new CookieParser({ secret: 'test-secret-key-at-least-32-chars-long' });
      expect(parserWithSecret.shouldSign('sessionId')).toBe(true);
      expect(parserWithSecret.shouldSign('theme')).toBe(true);
    });

    it('should return true only for cookies in signed array', () => {
      const parserWithSecret = new CookieParser({
        secret: 'test-secret-key-at-least-32-chars-long',
        signed: ['sessionId', 'userId'],
      });

      expect(parserWithSecret.shouldSign('sessionId')).toBe(true);
      expect(parserWithSecret.shouldSign('userId')).toBe(true);
      expect(parserWithSecret.shouldSign('theme')).toBe(false);
    });

    it('should return false when no secret configured', () => {
      expect(parser.shouldSign('sessionId')).toBe(false);
    });
  });

  describe('default options', () => {
    it('should apply default options to set cookies', () => {
      const parserWithDefaults = new CookieParser({
        defaults: {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        },
      });

      const cookieStr = parserWithDefaults.set('sessionId', 'abc123');
      expect(cookieStr).toContain('Secure');
      expect(cookieStr).toContain('HttpOnly');
      expect(cookieStr).toContain('SameSite=Strict');
    });

    it('should override defaults with per-cookie options', () => {
      const parserWithDefaults = new CookieParser({
        defaults: {
          secure: true,
          httpOnly: true,
        },
      });

      const cookieStr = parserWithDefaults.set('theme', 'dark', {
        secure: false,
        httpOnly: false,
      });

      expect(cookieStr).not.toContain('Secure');
      expect(cookieStr).not.toContain('HttpOnly');
    });
  });
});
