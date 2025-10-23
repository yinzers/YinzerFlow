# 📖 Overview

YinzerFlow provides built-in rate limiting to protect your API from abuse and DoS attacks. Rate limiting is <span style="color: #2ecc71">**enabled by default**</span> with sensible limits (100 requests per 15 minutes per IP) using the **Sliding Window Counter** algorithm for accurate request tracking with minimal memory overhead.

<span style="color: #3498db">**💡 Tip:**</span> Rate limiting is your first line of defense against DoS attacks and API abuse.

**When to use:**

- 🌐 Public APIs that need DoS protection
- 🔑 Authentication endpoints to prevent brute force attacks
- ⚡ Resource-intensive endpoints that need request throttling
- 🎯 APIs with tiered access (free vs premium users)

**Expected outcomes:**

- ✅ Automatic protection against request flooding
- 📊 Standard rate limit headers inform clients about limits
- 🎨 Customizable limits per route or globally
- 💾 Memory-efficient tracking with only ~24 bytes per client

<span style="color: #3498db">🔗 For configuration options, see the [Configuration Reference](#configuration-reference).</span>

# ⚙️ Usage

## 🎛️ Settings

### enabled — @default <span style="color: #2ecc71">`true`</span>

Enable or disable rate limiting globally or per-route.

<span style="color: #e74c3c">**⚠️ Warning:**</span> Disabling rate limiting removes DoS protection from your API.

```typescript
import { YinzerFlow } from 'yinzerflow';

// Disable globally
const app = new YinzerFlow({
  port: 3000,
  rateLimit: { enabled: false }
});
```

<aside>

Options: `boolean`

- 🟢 `true`: Rate limiting enabled (default, recommended)
- 🔴 `false`: Rate limiting disabled

</aside>

### window — @default <span style="color: #2ecc71">`'15m'`</span> (15 minutes)

Time window for rate limiting. Accepts friendly format ('30s', '15m', '2h', '1d') or milliseconds.

<span style="color: #3498db">**💡 Tip:**</span> Use friendly formats like `'1m'`, `'15m'`, `'1h'` for better readability.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    window: '1m', // 1 minute
    max: 60
  }
});
```

<aside>

Options: `TimeString | number`

- ⏱️ Friendly format: `'30s'`, `'15m'`, `'2h'`, `'1d'`
- ⏱️ Milliseconds: `60000` (1 minute)
- ✅ Default: `'15m'` (900000ms)

</aside>

### max — @default <span style="color: #2ecc71">`100`</span>

Maximum number of requests allowed per window.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    window: '15m',
    max: 100 // 100 requests per 15 minutes
  }
});
```

<aside>

Options: `number`

- 🚨 Minimum: `1`
- ✅ Recommended: `100` for general APIs
- 🟢 Default: `100`

</aside>

### algorithm — @default <span style="color: #2ecc71">`'sliding-window-counter'`</span>

Rate limiting algorithm to use.

```typescript
import { YinzerFlow, rateLimitAlgorithm } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    algorithm: rateLimitAlgorithm.slidingWindowCounter
  }
});
```

<aside>

Options: `'sliding-window-counter'`

- 🟢 `slidingWindowCounter`: Memory efficient, Redis-ready, 99%+ accurate (default and recommended)
- 🔮 Future algorithms: `tokenBucket`, `slidingWindowLog`

</aside>

### standardHeaders — @default <span style="color: #2ecc71">`true`</span>

Include standard `RateLimit-*` headers in responses to inform clients about limits.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    standardHeaders: true // Add RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset headers
  }
});
```

<aside>

Options: `boolean`

- 🟢 `true`: Include headers (default, recommended)
- 🔴 `false`: No rate limit headers

Headers added:
- 📊 `RateLimit-Limit`: Maximum requests per window
- 📊 `RateLimit-Remaining`: Requests remaining in current window
- ⏱️ `RateLimit-Reset`: Unix timestamp when window resets
- 🔄 `Retry-After`: Seconds until client can retry (when limit exceeded)

</aside>

### keyGenerator — @default <span style="color: #2ecc71">IP address</span>

Custom function to generate unique client identifier for rate limiting.

<span style="color: #3498db">**💡 Tip:**</span> For authenticated APIs, rate limit by user ID instead of IP address.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    keyGenerator: (ctx) => {
      // Rate limit by user ID instead of IP
      return ctx.state.userId || ctx.request.ipAddress;
    }
  }
});
```

<aside>

Options: `(context: Context) => string`

- ✅ Default: `(ctx) => ctx.request.ipAddress`
- 🎯 Common patterns:
  - 🔑 User ID: `ctx.state.userId`
  - 🌐 API key: `ctx.request.headers['x-api-key']`
  - 🎨 Combination: `${tier}:${userId}`

</aside>

### handler — @default <span style="color: #2ecc71">Pittsburgh-themed message</span>

Custom handler function called when rate limit is exceeded.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    handler: (ctx) => {
      ctx.response.setStatusCode(429);
      return {
        success: false,
        message: 'Too many requests. Please try again later.'
      };
    }
  }
});
```

<aside>

Options: `(context: Context) => unknown`

- 🟢 Default: Returns `{ success: false, message: "Yinz are sending too many requests. Slow down, jagoff!" }`
- 🚨 Automatically sets status code 429
- 🎨 Can return any JSON-serializable object

</aside>

### skipSuccessfulRequests — @default <span style="color: #2ecc71">`false`</span>

Don't count successful requests (status < 400) toward rate limit.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    skipSuccessfulRequests: true // Only count errors
  }
});
```

<aside>

Options: `boolean`

- 🟢 `false`: Count all requests (default, recommended)
- 🔴 `true`: Only count failed requests (status >= 400)

</aside>

### skipFailedRequests — @default <span style="color: #2ecc71">`false`</span>

Don't count failed requests (status >= 400) toward rate limit.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    skipFailedRequests: true // Only count successful requests
  }
});
```

<aside>

Options: `boolean`

- 🟢 `false`: Count all requests (default, recommended)
- 🔴 `true`: Only count successful requests (status < 400)

</aside>

## 📚 Configuration Reference

Full configuration example with all options:

```typescript
import { YinzerFlow, rateLimitAlgorithm } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    enabled: true,
    algorithm: rateLimitAlgorithm.slidingWindowCounter,
    window: '15m',
    max: 100,
    standardHeaders: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (ctx) => ctx.request.ipAddress,
    handler: (ctx) => {
      ctx.response.setStatusCode(429);
      return {
        success: false,
        message: 'Yinz are sending too many requests. Slow down, jagoff!'
      };
    }
  }
});
```

# ✨ Best Practices

- ✅ **Enable by default**: Keep rate limiting enabled in production for security
- 🔑 **Per-route limits**: Use stricter limits for sensitive endpoints (auth, password reset)
- 📊 **Standard headers**: Keep `standardHeaders: true` to help well-behaved clients
- 🎯 **Custom key generator**: Rate limit by user ID for authenticated APIs
- 📝 **Monitor violations**: Log rate limit exceeded events for security analysis
- 💬 **Graceful degradation**: Provide helpful error messages when limits are hit

# 💻 Examples

### Production API

**Use Case:** Secure public API with authentication endpoints

**Description:** Production-ready configuration with global rate limiting and strict per-route limits for sensitive endpoints.

<span style="color: #f39c12">**⚡ Performance:**</span> This configuration balances security and user experience.

```typescript
import { YinzerFlow, rateLimitHook, log } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    enabled: true,
    window: '15m',
    max: 100, // General API limit
    standardHeaders: true
  }
});

// Very strict for login to prevent brute force
app.post('/api/auth/login',
  {
    beforeRoute: [rateLimitHook({
      window: '15m',
      max: 5, // Only 5 attempts per 15 minutes
      handler: (ctx) => {
        log.warn(`Rate limit exceeded for IP: ${ctx.request.ipAddress}`);
        ctx.response.setStatusCode(429);
        return {
          success: false,
          message: 'Too many login attempts. Please try again later.'
        };
      }
    })]
  },
  async ({ request }) => {
    const { email, password } = request.body;
    return await authenticateUser(email, password);
  }
);

// Strict for password reset
app.post('/api/auth/reset-password',
  {
    beforeRoute: [rateLimitHook({
      window: '1h',
      max: 3 // Only 3 reset attempts per hour
    })]
  },
  async ({ request }) => {
    const { email } = request.body;
    return await sendPasswordResetEmail(email);
  }
);

// Lower limit for expensive search endpoint
app.post('/api/search',
  {
    beforeRoute: [rateLimitHook({
      window: '1m',
      max: 10 // 10 searches per minute
    })]
  },
  async ({ request }) => {
    return await performExpensiveSearch(request.body);
  }
);

await app.listen();
```

### Custom Key Generator (User-Based)

**Use Case:** Rate limit authenticated users by user ID

**Description:** Production API that rate limits by user ID instead of IP address for better accuracy with authenticated users.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    window: '1h',
    max: 1000, // 1000 requests per hour per user
    keyGenerator: (ctx) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      return ctx.state.userId || ctx.request.ipAddress;
    }
  }
});

// Middleware to extract user ID from JWT
app.beforeAll([
  async (ctx) => {
    const token = ctx.request.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = await verifyJWT(token);
      ctx.state.userId = decoded.userId;
    }
  }
]);

app.get('/api/user/profile', async ({ state }) => {
  return await getUserProfile(state.userId);
});

await app.listen();
```

### Tiered Access (Free vs Premium)

**Use Case:** Different rate limits for free and premium users

**Description:** API with tiered access where premium users get higher limits than free users.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    window: '1m',
    max: 10, // Base limit for free users
    keyGenerator: (ctx) => {
      const tier = ctx.state.userTier || 'free';
      const userId = ctx.state.userId || ctx.request.ipAddress;
      return `${tier}:${userId}`;
    }
  }
});

// Middleware to determine user tier
app.beforeAll([
  async (ctx) => {
    if (ctx.state.userId) {
      ctx.state.userTier = await getUserTier(ctx.state.userId);
    }
  }
]);

// Premium endpoints can have higher per-route limits
app.get('/api/premium/analytics',
  {
    beforeRoute: [rateLimitHook({
      window: '1m',
      max: 100 // Higher limit for premium endpoint
    })]
  },
  async ({ state }) => {
    return await getPremiumAnalytics(state.userId);
  }
);

await app.listen();
```

## 🚀 Performance Notes

YinzerFlow's rate limiter is designed for high performance:

- ⚡ **O(1) lookups**: Uses Map for constant-time access
- 🎯 **Minimal overhead**: Adds only ~0.1-0.5ms per request
- 💾 **Memory efficient**: Only 3 numbers per client (~24 bytes) vs 100+ timestamps (~800 bytes) for sliding window log
- 🔄 **No blocking**: Fully synchronous algorithm with no async operations needed for rate checks
- 🧹 **Automatic cleanup**: Windows naturally expire without explicit cleanup loops

<span style="color: #f39c12">**⚡ Performance:**</span> Memory comparison:

- **Sliding Window Counter** (YinzerFlow): ~24 bytes per client (3 numbers)
- **Sliding Window Log**: ~800 bytes per client (100+ timestamps)
- **Savings**: 33x less memory usage

**Algorithm complexity:**

- ⚡ All operations: O(1) constant time
- 💾 Memory per client: O(1) constant space
- ✅ No background cleanup needed

<span style="color: #2ecc71">**✅ Result:**</span> For most applications, rate limiting overhead is negligible (< 1%) compared to actual request processing.

## 🔒 Security Notes

YinzerFlow implements several security measures to prevent abuse while maintaining excellent performance:

### 🛡️ Sliding Window Counter Algorithm

- **Problem**: Fixed window algorithms allow burst traffic at window boundaries (100 requests at 11:59, 100 more at 12:00). Traditional sliding window log algorithms store every timestamp, consuming excessive memory.
- **YinzerFlow Solution**: Uses **Sliding Window Counter** algorithm which provides 99%+ accuracy while using 33x less memory. Stores only 3 numbers per client (current count, previous count, window start) instead of 100+ timestamps.

### 🛡️ Per-IP Protection

- **Problem**: Without per-client tracking, a single abusive client can consume all available resources.
- **YinzerFlow Solution**: Default key generator uses IP address from YinzerFlow's IP security system, ensuring accurate client identification even behind proxies and load balancers. <span style="color: #3498db">🔗 For proxy configuration, see [IP Security](./ip-security.md)</span>.

### 🛡️ Memory Efficiency

- **Problem**: Storing rate limit data for every client can cause memory exhaustion in high-traffic scenarios.
- **YinzerFlow Solution**: Sliding window counter uses only ~24 bytes per client, and windows automatically expire without explicit cleanup loops.

### 🛡️ Standard Headers

- **Problem**: Clients hitting rate limits repeatedly waste server resources.
- **YinzerFlow Solution**: Standard `RateLimit-*` headers inform clients about limits, helping well-behaved clients avoid violations.

### 🛡️ Per-Route Limits

- **Problem**: One-size-fits-all limits don't work for different endpoint types (public vs authenticated, read vs write).
- **YinzerFlow Solution**: Per-route rate limiting with `rateLimitHook()` allows strict limits for sensitive endpoints while keeping generous limits for general API usage.

### 🛡️ Custom Key Generators

- **Problem**: IP-based limiting doesn't work well for authenticated APIs where users might share IPs (corporate networks, VPNs).
- **YinzerFlow Solution**: Custom key generators enable rate limiting by user ID, API key, or any other identifier.

### 🛡️ Retry-After Header

- **Problem**: Clients don't know when they can retry, leading to repeated failed requests.
- **YinzerFlow Solution**: Automatic `Retry-After` header tells clients exactly when to retry, reducing unnecessary traffic.

### 🛡️ Integration with IP Security

- **Problem**: Rate limiters using untrusted IP headers can be bypassed by spoofing X-Forwarded-For.
- **YinzerFlow Solution**: Uses YinzerFlow's IP security system with trusted proxy validation, preventing IP spoofing attacks.

<span style="color: #2ecc71">**✅ Result:**</span> These security measures ensure YinzerFlow's rate limiting provides robust protection against DoS attacks and API abuse while maintaining excellent performance.

## 🔧 Troubleshooting

### Rate limit exceeded immediately on first request

**Symptom:** First request to endpoint returns <span style="color: #e74c3c">429 status code</span>.

**Cause:** Clock skew or incorrect window configuration.

<span style="color: #2ecc71">**✅ Fix:**</span>
```typescript
// Ensure window is set correctly
const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    window: '15m', // Use friendly format
    max: 100
  }
});
```

### Rate limit headers not appearing

**Symptom:** Responses don't include `RateLimit-*` headers.

**Cause:** `standardHeaders` is set to <span style="color: #e74c3c">`false`</span>.

<span style="color: #2ecc71">**✅ Fix:**</span>
```typescript
const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    standardHeaders: true // Enable headers
  }
});
```

### Custom handler not being called

**Symptom:** Custom rate limit handler is ignored.

**Cause:** Handler must set status code and return response.

<span style="color: #2ecc71">**✅ Fix:**</span>
```typescript
const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    handler: (ctx) => {
      ctx.response.setStatusCode(429); // Must set status code
      return {
        success: false,
        message: 'Too many requests'
      };
    }
  }
});
```

### Different users sharing same rate limit

**Symptom:** Authenticated users with different IDs are being rate limited together.

**Cause:** Default key generator uses IP address, not user ID. This commonly happens when users are:

- 🌐 Behind the same corporate VPN
- 🏢 On the same corporate network/proxy
- 🌐 Using shared office internet
- 🔄 Behind CGNAT (Carrier-Grade NAT) in some ISPs

<span style="color: #2ecc71">**✅ Fix:**</span> Use a custom key generator to rate limit by user ID instead of IP address.

<span style="color: #3498db">**💡 Tip:**</span> For authenticated APIs, always rate limit by user ID instead of IP address.
```typescript
const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    keyGenerator: (ctx) => {
      // Rate limit by user ID for authenticated users, fall back to IP
      return ctx.state.userId || ctx.request.ipAddress;
    }
  }
});

// Middleware to extract user ID from authentication
app.beforeAll([
  async (ctx) => {
    const token = ctx.request.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = await verifyJWT(token);
      ctx.state.userId = decoded.userId;
    }
  }
]);
```

### Per-route rate limit not working

**Symptom:** Per-route `rateLimitHook` doesn't seem to apply.

**Cause:** Per-route limits are ADDITIVE to global limits. Both must pass.

<span style="color: #f39c12">**⚡ Important:**</span> Client must pass BOTH global AND route-specific limits.

<span style="color: #2ecc71">**✅ Fix:**</span>
```typescript
import { YinzerFlow, rateLimitHook } from 'yinzerflow';

// Per-route limit is ADDITIVE to global limit
// Client must pass both global (100/15m) AND route-specific (5/15m) limits
app.post('/api/auth/login',
  {
    beforeRoute: [rateLimitHook({
      window: '15m',
      max: 5
    })]
  },
  async () => ({ success: true })
);
```

### High memory usage in production

**Symptom:** Memory usage grows over time with many clients.

**Cause:** Rate limit data is stored in memory per client.

<span style="color: #2ecc71">**✅ Expected:**</span> This is normal behavior. Sliding window counter uses only ~24 bytes per client.

<span style="color: #3498db">**💡 Tip:**</span> For distributed systems with millions of clients, use Redis-based storage for distributed rate limiting.

```typescript
// Current memory usage is minimal:
// 💾 1 million clients = ~24 MB of memory
// ✅ This is acceptable for most applications
```

## 🔴 Redis Store for Distributed Rate Limiting

For production applications with multiple server instances, YinzerFlow supports Redis-based rate limiting storage for distributed rate limiting across your entire infrastructure.

### 🚀 Quick Start with Redis

```typescript
import { YinzerFlow } from 'yinzerflow';
import { RateLimiter } from 'yinzerflow';
import { createClient } from 'redis';

// Create Redis client
const redis = createClient({
  url: 'redis://localhost:6379'
});
await redis.connect();

// Create rate limiter with Redis store
const limiter = new RateLimiter({
  algorithm: 'sliding-window-counter',
  window: '15m',
  max: 100,
  keyGenerator: (ctx) => ctx.request.ipAddress,
  handler: (ctx) => ({
    success: false,
    message: 'Rate limit exceeded'
  })
}, {
  type: 'redis',
  redis: {
    client: redis,
    keyPrefix: 'myapp:rate_limit:',
    defaultTtl: 3600
  }
});

// Use with YinzerFlow
const app = new YinzerFlow({
  port: 3000,
  rateLimit: { enabled: false } // Handle manually
});

app.beforeAll(async (ctx) => {
  const result = limiter.check(ctx);
  if (!result.allowed) {
    ctx.response.setStatusCode(429);
    return limiter.config.handler(ctx);
  }
});
```

### 🐉 DragonflyDB Alternative

<span style="color: #3498db">**💡 Tip:**</span> Consider using [DragonflyDB](https://www.dragonflydb.io/) as a Redis alternative. DragonflyDB is a modern, high-performance in-memory database that's Redis-compatible but offers better performance through parallel request processing and lower memory usage.

```typescript
// Works with the same Redis clients
const redis = createClient({
  url: 'redis://localhost:6379' // DragonflyDB uses same protocol
});
```

### 📋 Features

- **🔄 Distributed**: Works across multiple server instances
- **⚡ High Performance**: Redis/DragonflyDB-optimized for speed
- **🛡️ Automatic Expiration**: Keys expire automatically to prevent memory leaks
- **🔧 Algorithm Agnostic**: Works with any rate limiting algorithm
- **📊 JSON Serialization**: Handles complex data structures
- **🚨 Error Handling**: Graceful fallback on connection errors

### ⚙️ Configuration

```typescript
interface RedisStoreConfig {
  client: RedisClient;           // Redis client instance (required)
  keyPrefix?: string;           // Key prefix (default: 'rate_limit:')
  defaultTtl?: number;          // Default TTL in seconds (default: 3600)
  debug?: boolean;              // Enable debug logging (default: false)
}
```

### 🔧 Usage Examples

#### User-Based Rate Limiting

```typescript
const userLimiter = new RateLimiter({
  algorithm: 'sliding-window-counter',
  window: '1h',
  max: 10000,
  keyGenerator: (ctx) => {
    // Extract user ID from JWT, session, etc.
    const userId = ctx.request.headers['x-user-id'] || 'anonymous';
    return `user:${userId}`;
  },
  handler: (ctx) => ({
    success: false,
    message: 'User rate limit exceeded'
  })
}, {
  type: 'redis',
  redis: {
    client: redis,
    keyPrefix: 'myapp:user_limit:',
    defaultTtl: 7200 // 2 hours
  }
});
```

### 🛡️ Security Considerations

- **Key Prefixing**: Use unique prefixes (`myapp:rate_limit:`) to avoid conflicts
- **TTL Configuration**: Set TTL longer than your rate limit windows (1-hour TTL for 15-minute windows)

### 📊 Performance

- **Memory**: ~50-100 bytes per IP including Redis overhead
- **Latency**: ~0.1-0.5ms local, ~1-10ms remote
- **Throughput**: 100k+ operations/second with single Redis/DragonflyDB
