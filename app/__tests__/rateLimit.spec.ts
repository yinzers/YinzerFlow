/* eslint-disable no-new */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { YinzerFlow } from '@core/YinzerFlow.ts';
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
    it('should return 429 status', async () => {
      // Send 3 requests to hit limit
      const requests = Array.from({ length: 3 }, async () => getRequest({ testPort }));
      await Promise.all(requests);

      // 4th request should be rate limited
      const response = await getRequest({ testPort });
      expect(response.status).toBe(429);
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

describe('Rate Limit Configuration Validation', () => {
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
  // Mock Redis client for testing
  const mockRedisClient = {
    ping: async () => Promise.resolve('PONG'),
    get: async () => Promise.resolve(null),
    set: async () => Promise.resolve('OK'),
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

    it('should include rate limit headers with Redis store', async () => {
      const response = await getRequest({ testPort });

      expect(response.headers.get('RateLimit-Limit')).toBe('2');
      expect(response.headers.get('RateLimit-Remaining')).toBe('1');
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
