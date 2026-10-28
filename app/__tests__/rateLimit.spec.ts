/* eslint-disable no-new */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { YinzerFlow } from '@core/YinzerFlow.ts';
import { rateLimitHook } from '@core/modules/rateLimit/rateLimithooks.ts';
import { createTestApp } from 'app/__tests__/test-utils/create-server.spec.ts';
import { getRequest, postRequest } from 'app/__tests__/test-utils/dummy-requests.spec.ts';

describe('Rate Limiting Feature', () => {
  let app: YinzerFlow;
  let testPort: number;
  const testWindowMs = 1000; // 1 second for fast tests

  beforeEach(async () => {
    const testSetup = createTestApp({
      rateLimit: {
        enabled: true,
        max: 3,
        window: testWindowMs,
        standardHeaders: true,
      },
    });
    ({ app, testPort } = testSetup);

    // Use the default /test route that createTestApp already sets up
    await app.listen();
  });

  afterEach(async () => {
    if (app.status().isListening) {
      await app.close();
    }
  });

  describe('when requests are within limit', () => {
    it('should allow requests and return 200', async () => {
      const response = await getRequest({ testPort });

      // First, just verify the response status
      expect(response.status).toBe(200);

      // If status is 200, then the request was allowed
      // We don't need to parse the response body for this test
    });

    it('should include rate limit headers', async () => {
      const response = await getRequest({ testPort });

      expect(response.headers.get('RateLimit-Limit')).toBe('3');
      expect(response.headers.get('RateLimit-Remaining')).toBe('2');
      expect(response.headers.get('RateLimit-Reset')).toBeDefined();
    });

    it('should decrement remaining count with each request', async () => {
      // First request
      const response1 = await getRequest({ testPort });
      expect(response1.headers.get('RateLimit-Remaining')).toBe('2');

      // Second request
      const response2 = await getRequest({ testPort });
      expect(response2.headers.get('RateLimit-Remaining')).toBe('1');

      // Third request
      const response3 = await getRequest({ testPort });
      expect(response3.headers.get('RateLimit-Remaining')).toBe('0');
    });

    it('should work with different HTTP methods', async () => {
      const getResponse = await getRequest({ testPort });
      const postResponse = await postRequest({ testPort });

      expect(getResponse.status).toBe(200);
      expect(postResponse.status).toBe(200);

      // Both should count toward the same limit
      // After GET request: 3-1=2 remaining
      expect(getResponse.headers.get('RateLimit-Remaining')).toBe('2');
      // After POST request: 3-2=1 remaining
      expect(postResponse.headers.get('RateLimit-Remaining')).toBe('1');
    });
  });

  describe('when rate limit is exceeded', () => {
    // Bug (row 2): the global limiter ran in beforeAll, after route lookup, so unmatched paths 404'd unthrottled and route scanning was never limited. Tier: Medium (feature).
    it.each([['/test'], ['/no-such-route']])('should return 429 with rate-limit headers past the limit on %s', async (path) => {
      // Send 3 requests to hit limit
      const requests = Array.from({ length: 3 }, async () => fetch(`http://127.0.0.1:${testPort}${path}`));
      await Promise.all(requests);

      // 4th request should be rate limited
      const response = await fetch(`http://127.0.0.1:${testPort}${path}`);
      expect(response.status).toBe(429);
      expect(response.headers.get('RateLimit-Limit')).toBe('3');
      expect(response.headers.get('RateLimit-Remaining')).toBe('0');
    });

    it('should return error message with Pittsburgh personality', async () => {
      // Hit rate limit
      const requests = Array.from({ length: 3 }, async () => getRequest({ testPort }));
      await Promise.all(requests);

      const response = await getRequest({ testPort });
      const data = (await response.json()) as { success: boolean; message: string };

      expect(data.success).toBe(false);
      expect(data.message).toContain('too many requests');
      expect(data.message).toContain('jagoff'); // Pittsburgh personality
    });

    it('should include retry-after header', async () => {
      // Hit rate limit
      const requests = Array.from({ length: 3 }, async () => getRequest({ testPort }));
      await Promise.all(requests);

      const response = await getRequest({ testPort });
      expect(response.headers.get('Retry-After')).toBeDefined();

      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(testWindowMs / 1000);
    });

    it('should maintain rate limit headers even when blocked', async () => {
      // Hit rate limit
      const requests = Array.from({ length: 3 }, async () => getRequest({ testPort }));
      await Promise.all(requests);

      const response = await getRequest({ testPort });

      expect(response.headers.get('RateLimit-Limit')).toBe('3');
      expect(response.headers.get('RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('RateLimit-Reset')).toBeDefined();
    });
  });

  describe('when window expires', () => {
    it('should reset rate limit counter', async () => {
      // Hit rate limit
      const requests = Array.from({ length: 3 }, async () => getRequest({ testPort }));
      await Promise.all(requests);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, testWindowMs + 100));

      // Should work again
      const response = await getRequest({ testPort });
      expect(response.status).toBe(200);
      expect(response.headers.get('RateLimit-Remaining')).toBe('2');
    });

    it('should reset remaining count to max after window expires', async () => {
      // Hit rate limit
      const requests = Array.from({ length: 3 }, async () => getRequest({ testPort }));
      await Promise.all(requests);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, testWindowMs + 100));

      // First request after reset should show max remaining
      const response = await getRequest({ testPort });
      expect(response.headers.get('RateLimit-Remaining')).toBe('2'); // max - 1
    });
  });

  describe('when rate limiting is disabled', () => {
    let disabledApp: YinzerFlow;
    let disabledPort: number;

    beforeEach(async () => {
      const testSetup = createTestApp({
        rateLimit: {
          enabled: false,
        },
      });
      ({ app: disabledApp, testPort: disabledPort } = testSetup);

      // Use the default /test route that createTestApp already sets up
      await disabledApp.listen();
    });

    afterEach(async () => {
      if (disabledApp.status().isListening) {
        await disabledApp.close();
      }
    });

    it('should allow unlimited requests', async () => {
      // Send many requests - should all succeed
      const requests = Array.from({ length: 10 }, async () => getRequest({ testPort: disabledPort }));
      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should not include rate limit headers', async () => {
      const response = await getRequest({ testPort: disabledPort });

      expect(response.headers.get('RateLimit-Limit')).toBeNull();
      expect(response.headers.get('RateLimit-Remaining')).toBeNull();
      expect(response.headers.get('RateLimit-Reset')).toBeNull();
    });
  });

  describe('with custom configuration', () => {
    let customApp: YinzerFlow;
    let customPort: number;

    beforeEach(async () => {
      const testSetup = createTestApp({
        rateLimit: {
          enabled: true,
          max: 2,
          window: 1000, // 1 second (minimum allowed)
          standardHeaders: false, // Disable headers
        },
      });
      ({ app: customApp, testPort: customPort } = testSetup);

      // Use the default /test route that createTestApp already sets up
      await customApp.listen();
    });

    afterEach(async () => {
      if (customApp.status().isListening) {
        await customApp.close();
      }
    });

    it('should respect custom max limit', async () => {
      // Send 2 requests to hit custom limit
      const requests = Array.from({ length: 2 }, async () => getRequest({ testPort: customPort }));
      await Promise.all(requests);

      // 3rd request should be rate limited
      const response = await getRequest({ testPort: customPort });
      expect(response.status).toBe(429);
    });

    it('should respect custom window duration', async () => {
      // Hit rate limit
      const requests = Array.from({ length: 2 }, async () => getRequest({ testPort: customPort }));
      await Promise.all(requests);

      // Wait for custom window to expire (1000ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should work again
      const response = await getRequest({ testPort: customPort });
      expect(response.status).toBe(200);
    });

    it('should not include headers when standardHeaders is false', async () => {
      const response = await getRequest({ testPort: customPort });

      expect(response.headers.get('RateLimit-Limit')).toBeNull();
      expect(response.headers.get('RateLimit-Remaining')).toBeNull();
      expect(response.headers.get('RateLimit-Reset')).toBeNull();
    });
  });
});

// Bug: with the limiter run before routing, keyGenerator saw empty params and no beforeRouting state, so every client shared one bucket and the whole app got 429. Tier: Medium (feature).
describe('Global keyGenerator context', () => {
  type KeyCase = [
    description: string,
    configure: (app: YinzerFlow) => void,
    urlFor: (client: string) => string,
    headersFor: (client: string) => Record<string, string>,
  ];
  const keyCases: Array<KeyCase> = [
    ['a route param', (app) => app.get('/tenants/:tenant/data', () => ({ ok: true })), (client) => `/tenants/${client}/data`, () => ({})],
    [
      'state set by a user beforeRouting hook',
      (app) => {
        app.beforeRouting([
          (ctx) => {
            ctx.state.userId = ctx.request.headers['x-user-id' as keyof typeof ctx.request.headers];
          },
        ]);
        app.get('/profile', () => ({ ok: true }));
      },
      () => '/profile',
      (client) => ({ 'x-user-id': client }),
    ],
  ];

  let keyApp: YinzerFlow | undefined;

  afterEach(async () => {
    if (keyApp?.status().isListening) await keyApp.close();
  });

  it.each(keyCases)('should give each client its own bucket when keyGenerator reads %s', async (_description, configure, urlFor, headersFor) => {
    let testPort: number;
    ({ app: keyApp, testPort } = createTestApp({
      rateLimit: {
        max: 2,
        window: '1m',
        keyGenerator: (ctx) => String(ctx.request.params.tenant ?? ctx.state.userId ?? 'shared'),
      },
    }));
    configure(keyApp);
    await keyApp.listen();

    const send = async (client: string): Promise<number> =>
      (await fetch(`http://127.0.0.1:${testPort}${urlFor(client)}`, { headers: headersFor(client) })).status;

    expect([await send('alice'), await send('alice')]).toEqual([200, 200]);
    expect(await send('bob')).toBe(200);
    expect(await send('alice')).toBe(429);
  });
});

// Bug: rateLimitHook built a new limiter (empty store) on every request, so per-route limits never applied and each request leaked a sweep timer. Tier: Medium (feature).
describe('Per-route rateLimitHook', () => {
  let routeApp: YinzerFlow;
  let routePort: number;

  beforeEach(async () => {
    ({ app: routeApp, testPort: routePort } = createTestApp({ rateLimit: { enabled: false } }));
    routeApp.post('/login', () => ({ ok: true }), { beforeHooks: [rateLimitHook({ max: 2, window: '1m' })], afterHooks: [] });
    await routeApp.listen();
  });

  afterEach(async () => {
    if (routeApp.status().isListening) {
      await routeApp.close();
    }
  });

  it('should answer 429 once the route-specific max is used up', async () => {
    const statuses: Array<number> = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await fetch(`http://127.0.0.1:${routePort}/login`, { method: 'POST' })).status);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});

// Bug (live): from an untrusted peer, a blocked client got a fresh bucket on every request by sending a random
// X-Forwarded-For, a random X-Real-IP, or "X-Forwarded-For: <random>, 127.0.0.1". Tier: High (rate-limit bypass).
describe('Client-IP headers from an untrusted peer', () => {
  let spoofApp: YinzerFlow | undefined;

  afterEach(async () => {
    if (spoofApp?.status().isListening) await spoofApp.close();
  });

  it('should keep a blocked client blocked while it rotates spoofed client-IP headers', async () => {
    let testPort: number;
    // Only 10.0.0.0/8 is trusted, so the test's localhost peer is an untrusted client
    ({ app: spoofApp, testPort } = createTestApp({ ipSecurity: { trustedProxies: ['10.0.0.0/8'] }, rateLimit: { max: 2, window: '1m' } }));
    await spoofApp.listen();

    const spoofHeaders: Array<Record<string, string>> = [
      { 'x-forwarded-for': '198.51.100.1' },
      { 'x-forwarded-for': '198.51.100.2' },
      { 'x-real-ip': '198.51.100.3' },
      { 'x-forwarded-for': '198.51.100.4, 127.0.0.1' },
      { 'true-client-ip': '198.51.100.5' },
    ];
    const statuses: Array<number> = [];
    for (const headers of spoofHeaders) statuses.push((await fetch(`http://127.0.0.1:${testPort}/test`, { headers })).status);

    expect(statuses).toEqual([200, 200, 429, 429, 429]);
  });
});

// Bug: binding a limiter per route registration split one hook's budget: GET and its automatic HEAD, or two routes
// sharing one hook, each got their own count, so the handler ran past the limit. Tier: Medium (feature).
describe('One budget per rateLimitHook', () => {
  type BudgetCase = [description: string, register: (app: YinzerFlow) => void, requests: Array<[method: string, path: string]>];
  const budgetCases: Array<BudgetCase> = [
    [
      'GET then HEAD on one route',
      (app) => app.get('/x', () => ({ ok: true }), { beforeHooks: [rateLimitHook({ max: 2, window: '1m' })], afterHooks: [] }),
      [
        ['GET', '/x'],
        ['HEAD', '/x'],
        ['GET', '/x'],
      ],
    ],
    [
      'one hook on two routes',
      (app) => {
        const shared = rateLimitHook({ max: 2, window: '1m' });
        app.post('/a', () => ({ ok: true }), { beforeHooks: [shared], afterHooks: [] });
        app.get('/b', () => ({ ok: true }), { beforeHooks: [shared], afterHooks: [] });
      },
      [
        ['POST', '/a'],
        ['GET', '/b'],
        ['POST', '/a'],
      ],
    ],
  ];

  let budgetApp: YinzerFlow | undefined;

  afterEach(async () => {
    if (budgetApp?.status().isListening) await budgetApp.close();
  });

  it.each(budgetCases)('should share one budget for %s', async (_description, register, requests) => {
    let testPort: number;
    ({ app: budgetApp, testPort } = createTestApp({ rateLimit: { enabled: false } }));
    register(budgetApp);
    await budgetApp.listen();

    const statuses: Array<number> = [];
    for (const [method, path] of requests) statuses.push((await fetch(`http://127.0.0.1:${testPort}${path}`, { method })).status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  // Bug: one rateLimitHook used by two apps in one process held one limiter, so appA.close() destroyed the store appB was still counting in and reset appB's budget. Tier: Medium.
  it('should give each app its own budget, and closing one app must not reset the other', async () => {
    const shared = rateLimitHook({ max: 2, window: '1m' });
    const first = createTestApp({ rateLimit: { enabled: false } });
    const second = createTestApp({ rateLimit: { enabled: false } });
    first.app.get('/shared', () => ({ ok: true }), { beforeHooks: [shared], afterHooks: [] });
    second.app.get('/shared', () => ({ ok: true }), { beforeHooks: [shared], afterHooks: [] });
    await first.app.listen();
    await second.app.listen();
    const send = async (port: number): Promise<number> => (await fetch(`http://127.0.0.1:${port}/shared`)).status;

    try {
      expect([await send(first.testPort), await send(first.testPort)]).toEqual([200, 200]);
      expect(await send(second.testPort)).toBe(200); // separate budget from the first app
      await first.app.close();
      expect([await send(second.testPort), await send(second.testPort)]).toEqual([200, 429]);
    } finally {
      if (first.app.status().isListening) await first.app.close();
      if (second.app.status().isListening) await second.app.close();
    }
  });
});

// Bug: the limiter was only installed when `rateLimit.enabled: true` was passed explicitly, so the documented default left apps unprotected. Tier: Medium (feature default).
describe('Rate Limiting with no rateLimit option (documented default)', () => {
  let defaultApp: YinzerFlow;
  let defaultPort: number;

  beforeEach(async () => {
    ({ app: defaultApp, testPort: defaultPort } = createTestApp());
    await defaultApp.listen();
  });

  afterEach(async () => {
    if (defaultApp.status().isListening) {
      await defaultApp.close();
    }
  });

  it('should answer 429 after the default 1000 requests per window', async () => {
    const defaultMax = 1000;
    // Sequential on purpose: the default store's get-then-set is not atomic, and parallel requests would race it
    for (let i = 0; i < defaultMax; i++) {
      const response = await getRequest({ testPort: defaultPort });
      expect(response.status).toBe(200);
    }

    const limited = await getRequest({ testPort: defaultPort });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('RateLimit-Limit')).toBe(String(defaultMax));
  });
});

describe('Rate Limit Configuration Validation', () => {
  // Bug: `enabled ?? true` accepted '' / 0 / 'false' silently, so a config meant to disable (or enable) the limiter did something else. Tier: Medium (config validation).
  it.each([[''], [0], ['false']])('should throw error for non-boolean enabled value %p', (enabled) => {
    expect(() => {
      new YinzerFlow({
        rateLimit: { enabled: enabled as unknown as boolean },
      });
    }).toThrow('rateLimit.enabled must be a boolean');
  });

  it('should throw error for invalid max value', () => {
    expect(() => {
      new YinzerFlow({
        rateLimit: {
          max: 0, // Invalid: must be at least 1
        },
      });
    }).toThrow('rateLimit.max must be at least 1 request per window');
  });

  it('should throw error for non-integer max value', () => {
    expect(() => {
      new YinzerFlow({
        rateLimit: {
          max: 1.5, // Invalid: must be integer
        },
      });
    }).toThrow('rateLimit.max must be an integer');
  });

  it('should throw error for invalid time window format', () => {
    expect(() => {
      new YinzerFlow({
        rateLimit: {
          // @ts-expect-error - Invalid time string
          window: 'invalid', // Invalid: not a valid time string
        },
      });
    }).toThrow('rateLimit.window must be a valid time string');
  });

  it('should throw error for too short time window', () => {
    expect(() => {
      new YinzerFlow({
        rateLimit: {
          window: 500, // Invalid: too short
        },
      });
    }).toThrow('rateLimit.window must be at least 1000ms');
  });

  it('should throw error for non-integer milliseconds', () => {
    expect(() => {
      new YinzerFlow({
        rateLimit: {
          window: 1500.5, // Invalid: must be integer
        },
      });
    }).toThrow('rateLimit.window must be an integer when using milliseconds');
  });

  it('should accept valid time string formats', () => {
    expect(() => {
      new YinzerFlow({
        rateLimit: {
          window: '30s', // Valid
        },
      });
    }).not.toThrow();

    expect(() => {
      new YinzerFlow({
        rateLimit: {
          window: '15m', // Valid
        },
      });
    }).not.toThrow();

    expect(() => {
      new YinzerFlow({
        rateLimit: {
          window: '2h', // Valid
        },
      });
    }).not.toThrow();

    expect(() => {
      new YinzerFlow({
        rateLimit: {
          window: '1d', // Valid
        },
      });
    }).not.toThrow();
  });

  it('should accept valid millisecond values', () => {
    expect(() => {
      new YinzerFlow({
        rateLimit: {
          window: 30000, // Valid: 30 seconds
        },
      });
    }).not.toThrow();
  });
});

describe('Rate Limiting with Redis Store', () => {
  // Mock Redis client for testing (the network boundary); records SET arguments
  const redisSetCalls: Array<Array<unknown>> = [];
  const mockRedisClient = {
    ping: async () => Promise.resolve('PONG'),
    get: async () => Promise.resolve(null),
    set: async (...args: Array<unknown>) => {
      redisSetCalls.push(args);
      return Promise.resolve('OK');
    },
    setEx: async () => Promise.resolve('OK'),
    exists: async () => Promise.resolve(0),
    del: async () => Promise.resolve(1),
    keys: async () => Promise.resolve([]),
    expire: async () => Promise.resolve(1),
    on: () => {},
    off: () => {},
    disconnect: async () => Promise.resolve(),
  };

  describe('Redis store configuration', () => {
    it('should work with Redis store configuration', () => {
      expect(() => {
        new YinzerFlow({
          rateLimit: {
            enabled: true,
            max: 5,
            window: '1m',
            store: {
              type: 'redis',
              client: mockRedisClient as any,
              keyPrefix: 'test:rate_limit:',
            },
          },
        });
      }).not.toThrow();
    });

    it('should accept Redis store with custom retry configuration', () => {
      expect(() => {
        new YinzerFlow({
          rateLimit: {
            enabled: true,
            max: 5,
            window: '1m',
            store: {
              type: 'redis',
              client: mockRedisClient as any,
              keyPrefix: 'test:rate_limit:',
              maxRetries: 5,
              retryDelay: 2000,
            },
          },
        });
      }).not.toThrow();
    });

    it('should fall back to in-memory store when Redis store is not configured', () => {
      expect(() => {
        new YinzerFlow({
          rateLimit: {
            enabled: true,
            max: 5,
            window: '1m',
            // No store config - should default to in-memory
          },
        });
      }).not.toThrow();
    });
  });

  describe('Redis connection handling', () => {
    let app: YinzerFlow;
    let testPort: number;

    beforeEach(async () => {
      const testSetup = createTestApp({
        rateLimit: {
          enabled: true,
          max: 2,
          window: 1000, // 1 second for fast tests
          store: {
            type: 'redis',
            client: mockRedisClient as any,
            keyPrefix: 'test:rate_limit:',
            maxRetries: 1, // Quick failure for testing
            retryDelay: 100,
          },
        },
      });
      ({ app, testPort } = testSetup);

      await app.listen();
    });

    afterEach(async () => {
      if (app.status().isListening) {
        await app.close();
      }
    });

    it('should handle Redis connection gracefully', async () => {
      // This test verifies that the app starts and handles requests
      // even when Redis is mocked (simulating connection issues)
      const response = await getRequest({ testPort });

      // Should still work - Redis store should handle connection issues gracefully
      expect(response.status).toBe(200);
    });

    // Bug: the TTL was set once (whole seconds) and then kept, so entries expired one window after the FIRST write, unlike the memory store. Tier: Medium.
    it('should include rate limit headers with Redis store and refresh a one-window ms TTL on every write', async () => {
      redisSetCalls.length = 0;
      const response = await getRequest({ testPort });
      await getRequest({ testPort });

      expect(response.headers.get('RateLimit-Limit')).toBe('2');
      expect(response.headers.get('RateLimit-Remaining')).toBe('1');
      expect(redisSetCalls.length).toBe(2);
      for (const call of redisSetCalls) expect(call[2]).toEqual({ PX: 1000 });
    });
  });

  describe('Separate rateLimitHooks on a shared client', () => {
    // Bug: rateLimitHooks sharing the global Redis client and prefix wrote the same keys as the global limiter and each other, and close() wiped every node's counters with KEYS. Tier: Medium.
    it('should keep each hook and the global limiter in their own namespace, and keep working after close and listen', async () => {
      const setKeys: Array<string> = [];
      const destroyedPatterns: Array<string> = [];
      const recordingClient = {
        ...mockRedisClient,
        set: async (key: string) => {
          setKeys.push(key);
          return Promise.resolve('OK');
        },
        keys: async (pattern: string) => {
          destroyedPatterns.push(pattern);
          return Promise.resolve([]);
        },
      };
      const store = { type: 'redis' as const, client: recordingClient as any, keyPrefix: 'test:rate_limit:', maxRetries: 1 };
      const { app: sharedApp, testPort: sharedPort } = createTestApp({ rateLimit: { max: 50, window: '1m', store } });
      sharedApp.post('/login', () => ({ ok: true }), { beforeHooks: [rateLimitHook({ name: 'login', max: 5, window: '1m', store })], afterHooks: [] });
      sharedApp.get('/search', () => ({ ok: true }), { beforeHooks: [rateLimitHook({ max: 5, window: '1m', store })], afterHooks: [] });
      await sharedApp.listen();

      await fetch(`http://127.0.0.1:${sharedPort}/login`, { method: 'POST' });
      await fetch(`http://127.0.0.1:${sharedPort}/search`);
      const namespaces = [...new Set(setKeys.map((key) => key.slice(0, key.lastIndexOf(':') + 1)))].sort();
      expect(namespaces).toHaveLength(3);
      expect(namespaces[0]).toBe('test:rate_limit:global:');
      expect(namespaces[1]).toMatch(/^test:rate_limit:hook:#\d+:$/);
      expect(namespaces[2]).toBe('test:rate_limit:hook:login:');

      await sharedApp.close();
      // close() must not touch shared counters: no KEYS scan, no deletes (they expire on their own)
      expect(destroyedPatterns).toEqual([]);

      const keysBeforeRestart = setKeys.length;
      await sharedApp.listen();
      const afterRestart = await fetch(`http://127.0.0.1:${sharedPort}/login`, { method: 'POST' });
      await sharedApp.close();
      expect(afterRestart.headers.get('RateLimit-Limit')).toBe('5');
      expect(setKeys.slice(keysBeforeRestart).some((key) => key.startsWith('test:rate_limit:global:'))).toBe(true);
    });
  });

  describe('Store configuration validation', () => {
    it('should work with valid Redis store configuration', () => {
      expect(() => {
        new YinzerFlow({
          rateLimit: {
            enabled: true,
            max: 5,
            window: '1m',
            store: {
              type: 'redis',
              client: mockRedisClient as any,
              keyPrefix: 'test:rate_limit:',
            },
          },
        });
      }).not.toThrow();
    });

    it('should work with minimal Redis store configuration', () => {
      expect(() => {
        new YinzerFlow({
          rateLimit: {
            enabled: true,
            max: 5,
            window: '1m',
            store: {
              type: 'redis',
              client: mockRedisClient as any,
            },
          },
        });
      }).not.toThrow();
    });
  });

  describe('Distributed rate limiting simulation', () => {
    // This test simulates how Redis store enables distributed rate limiting
    // by using a shared store that persists data across "app instances"
    const sharedStore = new Map<string, any>();
    let app1: YinzerFlow;
    let app2: YinzerFlow;
    let port1: number;
    let port2: number;

    beforeEach(async () => {
      // Reset shared store for each test
      sharedStore.clear();

      // Create a mock Redis client that uses shared storage
      const sharedRedisClient = {
        ping: async () => Promise.resolve('PONG'),
        get: async (key: string) => Promise.resolve(sharedStore.get(key) ?? null),
        set: async (key: string, value: string) => {
          sharedStore.set(key, value);
          return Promise.resolve('OK');
        },
        setEx: async (key: string, ttl: number, value: string) => {
          sharedStore.set(key, value);
          // Simulate TTL by setting a timeout to delete the key
          setTimeout(() => sharedStore.delete(key), ttl * 1000);
          return Promise.resolve('OK');
        },
        exists: async (key: string) => Promise.resolve(sharedStore.has(key) ? 1 : 0),
        del: async (key: string) => {
          const existed = sharedStore.has(key);
          sharedStore.delete(key);
          return Promise.resolve(existed ? 1 : 0);
        },
        keys: async (pattern: string) => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return Promise.resolve(Array.from(sharedStore.keys()).filter((key) => regex.test(key)));
        },
        expire: async () => Promise.resolve(1),
        on: () => {},
        off: () => {},
        disconnect: async () => Promise.resolve(),
      };

      // Create two app instances with the same Redis store
      const testSetup1 = createTestApp({
        rateLimit: {
          enabled: true,
          max: 2, // Very low limit for testing
          window: 2000, // 2 seconds
          store: {
            type: 'redis',
            client: sharedRedisClient as any,
            keyPrefix: 'distributed:rate_limit:',
          },
        },
      });
      ({ app: app1, testPort: port1 } = testSetup1);

      const testSetup2 = createTestApp({
        rateLimit: {
          enabled: true,
          max: 2, // Same limit as app1
          window: 2000, // Same window as app1
          store: {
            type: 'redis',
            client: sharedRedisClient as any,
            keyPrefix: 'distributed:rate_limit:', // Same prefix
          },
        },
      });
      ({ app: app2, testPort: port2 } = testSetup2);

      await app1.listen();
      await app2.listen();
    });

    afterEach(async () => {
      if (app1.status().isListening) await app1.close();
      if (app2.status().isListening) await app2.close();
    });

    it('should share rate limit state between app instances', async () => {
      // Use app1 to hit the rate limit
      const requests1 = Array.from({ length: 2 }, async () => getRequest({ testPort: port1 }));
      await Promise.all(requests1);

      // Now app1 should be rate limited
      const response1 = await getRequest({ testPort: port1 });
      expect(response1.status).toBe(429);

      // App2 should also be rate limited because they share the same Redis store
      const response2 = await getRequest({ testPort: port2 });
      expect(response2.status).toBe(429);

      // Both should show the same remaining count (0)
      expect(response1.headers.get('RateLimit-Remaining')).toBe('0');
      expect(response2.headers.get('RateLimit-Remaining')).toBe('0');
    });

    it('should demonstrate distributed rate limiting with shared state', async () => {
      // This test demonstrates the key benefit of Redis store: shared rate limiting
      // across multiple app instances, which is crucial for production deployments

      // App1 makes 1 request
      const response1a = await getRequest({ testPort: port1 });
      expect(response1a.status).toBe(200);
      expect(response1a.headers.get('RateLimit-Remaining')).toBe('1');

      // App2 makes 1 request - should see the shared state from App1
      const response2a = await getRequest({ testPort: port2 });
      expect(response2a.status).toBe(200);
      expect(response2a.headers.get('RateLimit-Remaining')).toBe('0'); // 2 total requests = limit reached

      // App1 makes another request - should be rate limited due to shared state
      const response1b = await getRequest({ testPort: port1 });
      expect(response1b.status).toBe(429);

      // App2 makes another request - should also be rate limited
      const response2b = await getRequest({ testPort: port2 });
      expect(response2b.status).toBe(429);

      // Both should show the same remaining count (0)
      expect(response1b.headers.get('RateLimit-Remaining')).toBe('0');
      expect(response2b.headers.get('RateLimit-Remaining')).toBe('0');
    });
  });
});
