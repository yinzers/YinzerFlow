import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { YinzerFlow } from '../core/YinzerFlow.ts';

describe('Cookie Parser', () => {
  let app: YinzerFlow;
  let testPort: number;

  beforeEach(() => {
    testPort = 9999 + Math.floor(Math.random() * 1000);
  });

  afterEach(async () => {
    // App may not be initialized in all test groups
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (app && app.status().isListening) {
      await app.close();
    }
  });

  describe('when cookie parser is disabled', () => {
    beforeEach(async () => {
      app = new YinzerFlow({
        port: testPort,
        cookieParser: { enabled: false },
      });

      app.get('/test', (ctx) => {
        return { cookies: ctx.request.cookies.size, signedCookies: ctx.request.signedCookies.size };
      });

      await app.listen();
    });

    it('should not parse cookies', async () => {
      const response = await fetch(`http://localhost:${testPort}/test`, {
        headers: {
          Cookie: 'theme=dark; sessionId=abc123',
        },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { cookies: number; signedCookies: number };
      expect(data.cookies).toBe(0);
      expect(data.signedCookies).toBe(0);
    });
  });

  describe('when cookie parser is enabled', () => {
    beforeEach(async () => {
      app = new YinzerFlow({
        port: testPort,
        cookieParser: { enabled: true },
      });

      app.get('/test', (ctx) => {
        return {
          cookies: Object.fromEntries(ctx.request.cookies),
          signedCookies: Object.fromEntries(ctx.request.signedCookies),
        };
      });

      await app.listen();
    });

    it('should parse unsigned cookies', async () => {
      const response = await fetch(`http://localhost:${testPort}/test`, {
        headers: {
          Cookie: 'theme=dark; lang=en; userId=123',
        },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { cookies: Record<string, string>; signedCookies: Record<string, string> };
      expect(data.cookies.theme).toBe('dark');
      expect(data.cookies.lang).toBe('en');
      expect(data.cookies.userId).toBe('123');
    });

    it('should handle URL-encoded cookie values', async () => {
      const response = await fetch(`http://localhost:${testPort}/test`, {
        headers: {
          Cookie: 'name=John%20Doe; email=test%40example.com',
        },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { cookies: Record<string, string>; signedCookies: Record<string, string> };
      expect(data.cookies.name).toBe('John Doe');
      expect(data.cookies.email).toBe('test@example.com');
    });

    it('should handle cookies with whitespace', async () => {
      const response = await fetch(`http://localhost:${testPort}/test`, {
        headers: {
          Cookie: ' theme = dark ; lang = en ',
        },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { cookies: Record<string, string>; signedCookies: Record<string, string> };
      expect(data.cookies.theme).toBe('dark');
      expect(data.cookies.lang).toBe('en');
    });
  });

  describe('when setting cookies', () => {
    beforeEach(async () => {
      app = new YinzerFlow({
        port: testPort,
        cookieParser: { enabled: true },
      });

      app.post('/set-cookie', (ctx) => {
        ctx.cookies.set('sessionId', 'abc123', {
          httpOnly: true,
          secure: false, // Allow HTTP for testing
          sameSite: 'strict',
          maxAge: 3600,
        });
        return { success: true };
      });

      app.get('/check-cookie', (ctx) => {
        const sessionId = ctx.request.cookies.get('sessionId');
        return { sessionId };
      });

      await app.listen();
    });

    it('should set a cookie in the response', async () => {
      const response = await fetch(`http://localhost:${testPort}/set-cookie`, {
        method: 'POST',
      });

      expect(response.ok).toBe(true);
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('sessionId=abc123');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Strict');
      expect(setCookieHeader).toContain('Max-Age=3600');
    });

    // Note: Cookie persistence between requests is handled by the browser/client,
    // not by the cookie parser itself. This functionality cannot be easily tested
    // without a real browser or more complex HTTP client setup.
  });

  describe('signed cookies', () => {
    beforeEach(async () => {
      app = new YinzerFlow({
        port: testPort,
        cookieParser: {
          enabled: true,
          secret: 'this-is-a-very-long-secret-key-for-testing-purposes-only',
          signed: ['sessionId'], // Configure sessionId to be signed
        },
      });

      app.post('/sign-cookie', (ctx) => {
        // Simply set the cookie - it will be auto-signed since 'sessionId' is in the 'signed' array
        ctx.cookies.set('sessionId', 'abc123', {
          httpOnly: true,
        });
        return { success: true };
      });

      app.get('/verify-cookie', (ctx) => {
        const sessionId = ctx.request.signedCookies.get('sessionId');
        return { sessionId, hasCookie: Boolean(sessionId) };
      });

      await app.listen();
    });

    it('should sign and validate cookies', async () => {
      // Set a signed cookie
      const setResponse = await fetch(`http://localhost:${testPort}/sign-cookie`, {
        method: 'POST',
      });

      expect(setResponse.ok).toBe(true);

      // Get the Set-Cookie header to extract the signed cookie value
      const setCookieHeader = setResponse.headers.get('set-cookie');
      expect(setCookieHeader).toContain('sessionId=');

      // Extract the signed value from the Set-Cookie header
      const signedValue = setCookieHeader?.match(/sessionId=(?<value>[^;]+)/)?.groups?.value;
      expect(signedValue).toBeDefined();

      // Manually send the cookie back to verify it's properly validated
      if (signedValue) {
        const verifyResponse = await fetch(`http://localhost:${testPort}/verify-cookie`, {
          headers: {
            Cookie: `sessionId=${signedValue}`,
          },
        });
        expect(verifyResponse.ok).toBe(true);
        const data = (await verifyResponse.json()) as { sessionId?: string; hasCookie: boolean };
        expect(data.sessionId).toBe('abc123');
        expect(data.hasCookie).toBe(true);
      }
    });

    it('should reject tampered cookies', async () => {
      // Set a signed cookie
      await fetch(`http://localhost:${testPort}/sign-cookie`, {
        method: 'POST',
      });

      // Try to use a tampered cookie
      const response = await fetch(`http://localhost:${testPort}/verify-cookie`, {
        headers: {
          Cookie: 'sessionId=tampered.xxx',
        },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { sessionId?: string; hasCookie: boolean };
      expect(data.sessionId).toBeUndefined();
      expect(data.hasCookie).toBe(false);
    });
  });

  describe('default cookie options', () => {
    beforeEach(async () => {
      app = new YinzerFlow({
        port: testPort,
        cookieParser: {
          enabled: true,
          defaults: {
            httpOnly: true,
            secure: false, // Allow HTTP for testing
            sameSite: 'lax',
            maxAge: 1800,
          },
        },
      });

      app.post('/set-default-cookie', (ctx) => {
        ctx.cookies.set('sessionId', 'abc123');
        return { success: true };
      });

      await app.listen();
    });

    it('should apply default options to cookies', async () => {
      const response = await fetch(`http://localhost:${testPort}/set-default-cookie`, {
        method: 'POST',
      });

      expect(response.ok).toBe(true);
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('sessionId=abc123');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Lax');
      expect(setCookieHeader).toContain('Max-Age=1800');
    });
  });

  describe('per-cookie signing configuration', () => {
    beforeEach(async () => {
      app = new YinzerFlow({
        port: testPort,
        cookieParser: {
          enabled: true,
          secret: 'this-is-a-very-long-secret-key-for-testing-purposes-only',
          signed: ['sessionId'], // Only sign sessionId
        },
      });

      app.post('/set-cookies', (ctx) => {
        ctx.cookies.set('sessionId', 'abc123');
        ctx.cookies.set('theme', 'dark');
        return { success: true };
      });

      app.get('/check-cookies', (ctx) => {
        // sessionId is unsigned (appears in signedCookies after being set)
        // theme is not signed (appears in cookies)
        const sessionId = ctx.request.signedCookies.get('sessionId');
        const theme = ctx.request.cookies.get('theme');
        return {
          sessionId: sessionId ?? 'not in signedCookies',
          theme: theme ?? 'not in cookies',
        };
      });

      await app.listen();
    });

    it('should only sign specified cookies', async () => {
      // Set each cookie individually to test signing configuration

      // Set signed cookie (sessionId)
      const sessionResponse = await fetch(`http://localhost:${testPort}/set-cookies`, {
        method: 'POST',
      });
      expect(sessionResponse.ok).toBe(true);

      const sessionCookieHeader = sessionResponse.headers.get('set-cookie');
      expect(sessionCookieHeader).toBeDefined();

      // Verify sessionId is signed (contains dot and signature)
      const sessionIdMatch = sessionCookieHeader?.match(/sessionId=(?<value>[^;]+)/);
      expect(sessionIdMatch?.groups?.value).toBeDefined();
      const sessionIdValue = sessionIdMatch?.groups?.value ?? '';
      expect(sessionIdValue).toContain('.');
      expect(sessionIdValue).not.toBe('abc123'); // Should be signed

      // Verify theme is not signed (no dot, just the value)
      const themeMatch = sessionCookieHeader?.match(/theme=(?<value>[^;]+)/);
      expect(themeMatch?.groups?.value).toBeDefined();
      expect(themeMatch?.groups?.value).toBe('dark'); // Should not be signed
    });
  });

  describe('cookie expiration', () => {
    beforeEach(async () => {
      app = new YinzerFlow({
        port: testPort,
        cookieParser: {
          enabled: true,
          defaults: {
            secure: false,
          },
        },
      });

      app.post('/set-expiring-cookie', (ctx) => {
        ctx.cookies.set('sessionId', 'abc123', {
          maxAge: 2, // 2 seconds
        });
        return { success: true };
      });

      app.get('/check-cookie', (ctx) => {
        const sessionId = ctx.request.cookies.get('sessionId');
        return { sessionId: sessionId ?? 'expired' };
      });

      await app.listen();
    });

    it('should set Max-Age attribute', async () => {
      const response = await fetch(`http://localhost:${testPort}/set-expiring-cookie`, {
        method: 'POST',
      });

      expect(response.ok).toBe(true);
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('Max-Age=2');
    });

    // Note: Cookie expiration testing requires browser/client behavior.
    // The cookie parser correctly sets the Max-Age attribute, but actual
    // expiration is handled by the browser, not the server.
  });
});
