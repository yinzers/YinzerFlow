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
