# 📖 Overview

YinzerFlow provides built-in rate limiting to protect your API from abuse and DoS attacks. Rate limiting is <span style="color: #2ecc71">**enabled by default**</span> with sensible limits (1000 requests per minute per IP, the same default as @fastify/rate-limit) using the **Sliding Window Counter** algorithm for accurate request tracking with minimal memory overhead.

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

<span style="color: #f39c12">**⚠️ Behavior change in 0.9.0:**</span> Before 0.9.0 the global limiter was only installed when you passed `rateLimit: { enabled: true }`, so an app with no `rateLimit` options had no rate limiting despite the documented default. From 0.9.0 an app that passes no `rateLimit` options gets the default limiter (1000 requests per minute per IP). If you relied on the old behavior, for example behind a gateway that already limits, set `rateLimit: { enabled: false }`.

<a id="upgrade-notes-0-9-0"></a>**Upgrade notes for 0.9.0** (other request-handling changes that can surface on upgrade):

- Paths that can't be reduced to one unambiguous path are rejected with **400** before any hook or handler runs: a raw `%` that isn't a valid escape (`/50%`, `/admin%zz`), `.` or `..` segments (raw or encoded as `%2e`), encoded slashes or backslashes (`%2f`, `%5c`), raw backslashes, NUL bytes (`%00`) and invalid UTF-8.
- A route that mixes a parameter and `*` (for example `/files/:id/*`) no longer matches the bare prefix (`/files/5`). Route text is now matched literally, so the `*` there is a literal character, not a wildcard.
- Hook patterns (`routesToInclude` / `routesToExclude`) that use a route parameter (`'/users/:id'`) or a mid-path `*` (`'/api/*/admin'`) now throw at startup. Use a trailing wildcard on the parent path (`'/users/*'`).
- **Client-IP headers are trusted only from trusted proxies.** `X-Forwarded-For`, `X-Real-IP` and the other client-IP headers are now read only when the socket peer is in `ipSecurity.trustedProxies` (exact IPs or CIDR ranges); before 0.9.0 any client could send them and get a fresh rate-limit bucket per request. Apps behind a reverse proxy, load balancer or ingress that isn't on localhost must add its address or network, for example `trustedProxies: ['127.0.0.1', '::1', '10.0.0.0/8']` for a Kubernetes or cloud load balancer. Otherwise every user resolves to the proxy's IP and shares one rate-limit bucket. See [IP Security](./ip-security.md).
- **`ipSecurity.headerPreference` now defaults to `['x-forwarded-for']`** (it was five headers: `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `x-client-ip`, `true-client-ip`). Any of those a proxy doesn't set is a header the client can write, so the old default let clients pick their IP behind many proxies. If you rely on another header, list it explicitly, for example `headerPreference: ['cf-connecting-ip']` behind Cloudflare or `['x-real-ip']` for an nginx that sets X-Real-IP. Only the first listed header present on a request is used.
- **Malformed `ipSecurity.trustedProxies` entries now throw at startup.** Each entry must be an IP address, a CIDR range or `'*'`. Values that used to be accepted and silently never matched, such as `'localhost'`, `'10.0.0.*'` or `''`, now fail with `ipSecurity.trustedProxies[i] is not a valid IP address or CIDR range`. Use `'127.0.0.1'` / `'::1'` or a CIDR like `'10.0.0.0/8'`.
- **`request.ipAddress` is now canonical text.** An IPv4-mapped address (`::ffff:203.0.113.7`) is reported as plain IPv4 (`203.0.113.7`), and IPv6 as lower-case, compressed RFC 5952 text (`2001:DB8:0:0::1` becomes `2001:db8::1`). Code that compares `request.ipAddress` against stored strings, or uses it as a database key, may need its stored values normalized the same way.
- The global limiter runs in its own stage, after `beforeRouting` hooks and route matching and before the not-found handler and `beforeAll`. A custom `keyGenerator` can read `ctx.request.params` and state set in `beforeRouting`, but **not state set in `beforeAll`**, which hasn't run yet. If your key reads something like `ctx.state.userId`, set it in a `beforeRouting` hook. Otherwise the key falls back to its default and every client shares one bucket.
- **Redis users: counters restart once on upgrade.** Keys now live in per-limiter namespaces: `<keyPrefix>global:<client>` for the global limiter and `<keyPrefix>hook:<name>:<client>` for each `rateLimitHook`. Before, every limiter wrote `<keyPrefix><client>`, so the global limit and every route limit on a shared client counted each other's requests. Give each `rateLimitHook` a `name` if several nodes share one Redis (see Per-Route Limits below).

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

### window — @default <span style="color: #2ecc71">`'1m'`</span> (1 minute)

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
- ✅ Default: `'1m'` (60000ms)

</aside>

### max — @default <span style="color: #2ecc71">`1000`</span>

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
- 🟢 Default: `1000` per `window` (per minute by default), sized so a whole office or carrier-grade NAT behind one IP is not throttled by normal browsing
- 💡 Lower it per route for sensitive endpoints (login, password reset) with `rateLimitHook`

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

- ✅ Default: the client IP (`ctx.request.ipAddress`), IPv6 masked to `ipv6Subnet`
- 🎯 Common patterns:
  - 🔑 User ID: `ctx.state.userId`
  - 🌐 API key: `ctx.request.headers['x-api-key']`
  - 🎨 Combination: `${tier}:${userId}`
- ⏱️ Runs after `beforeRouting` hooks and route matching: it can read `ctx.request.params` and state set in `beforeRouting`, not state set in `beforeAll`
- 🚨 `beforeRouting` hooks themselves are not rate limited: keep them cheap and don't answer from them (see the Security Note on Custom Key Generators)

</aside>

### ipv6Subnet — @default <span style="color: #2ecc71">`56`</span>

Prefix length the default key generator masks IPv6 client addresses to. One IPv6 customer usually holds a whole /64 or more, so keying on the full address would let one client rotate addresses and get a fresh bucket each time. With the default, every address in the same /56 shares one bucket, matching express-rate-limit v8. IPv4 addresses, and IPv4-mapped IPv6 such as `::ffff:203.0.113.7`, are keyed as the IPv4 address. Different spellings of one address (compressed or expanded, any letter case) always land on the same key.

```typescript
const app = new YinzerFlow({
  rateLimit: {
    ipv6Subnet: 64, // one bucket per /64; use false to key on the full address
  },
});
```

<aside>

Options: `number | false`

- 🟢 Default: `56`
- 🔢 `1`–`128`: mask IPv6 to that prefix (`64` for one bucket per typical end site)
- 🔴 `false`: key on the full IPv6 address
- 📝 Applies to the default key only; a custom `keyGenerator` decides its own key

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

### store — @default <span style="color: #2ecc71">`{ type: 'memory' }`</span>

Rate limiting store configuration for distributed systems.

<span style="color: #3498db">**💡 Tip:**</span> Use Redis store for production applications with multiple server instances to enable distributed rate limiting.

```typescript
import { YinzerFlow } from 'yinzerflow';
import { createClient } from 'redis';

// Redis client setup
const redis = createClient({
  url: 'redis://localhost:6379'
});
await redis.connect();

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    window: '15m',
    max: 100,
    store: {
      type: 'redis',
      client: redis,
      keyPrefix: 'app:rate_limit:',
      maxRetries: 3,
      retryDelay: '1s' // Can use time string or number (1000)
    }
  }
});
```

<aside>

Options: `StoreConfig`

- 🟢 **In-memory** (default): Fast, single-instance only
- 🔄 **Redis**: Distributed, works across multiple instances

**Memory Store Options:**
- `maxEntries`: Maximum clients tracked at once (default: `100000`, roughly 20 MB). Entries expire one window after a client's last request and are swept periodically. If more distinct clients than this arrive within one window, the least recently seen client's count is dropped and starts fresh; limiting is never skipped for new clients.

**Redis Store Options:**
- `client`: Redis client instance (required)
- `keyPrefix`: Key prefix for rate limit keys (default: `'rate_limit:'`)
- `maxRetries`: Connection retry attempts (default: `3`)
- `retryDelay`: Delay between retries in ms or time string (default: `1s`)

<span style="color: #3498db">**💡 Tip:**</span> Use friendly time formats like `'1s'`, `'2s'`, `'500ms'` for better readability.

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
    },
    store: {
      type: 'memory' // or 'redis' for distributed systems
      // For Redis: { type: 'redis', client: redis, retryDelay: '2s' }
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
- 🔄 **Redis for distributed**: Use Redis store for production with multiple server instances
- 🛡️ **Connection resilience**: Configure retry settings for Redis store reliability

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

### Distributed Rate Limiting with Redis

**Use Case:** Production API with multiple server instances

**Description:** Distributed rate limiting using Redis store to ensure consistent limits across all server instances, preventing clients from bypassing limits by hitting different servers.

<span style="color: #f39c12">**⚡ Performance:**</span> Redis store adds ~1-5ms latency but enables true distributed rate limiting.

```typescript
import { YinzerFlow } from 'yinzerflow';
import { createClient } from 'redis';

// Redis client setup
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});
await redis.connect();

const app = new YinzerFlow({
  port: parseInt(process.env.PORT || '3000'),
  rateLimit: {
    enabled: true,
    window: '15m',
    max: 100,
    standardHeaders: true,
    store: {
      type: 'redis',
      client: redis,
      keyPrefix: 'app:rate_limit:',
      maxRetries: 3,
      retryDelay: '1s' // Can use time string or number
    },
    keyGenerator: (ctx) => {
      // Rate limit by user ID for authenticated users
      return ctx.state.userId || ctx.request.ipAddress;
    }
  }
});

// Authentication middleware (beforeRouting runs before the rate limiter's keyGenerator)
app.beforeRouting([
  async (ctx) => {
    const token = ctx.request.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = await verifyJWT(token);
        ctx.state.userId = decoded.userId;
      } catch (error) {
        // Invalid token, will fall back to IP-based limiting
      }
    }
  }
]);

// Strict limits for sensitive endpoints
app.post('/api/auth/login',
  {
    beforeRoute: [rateLimitHook({
      window: '15m',
      max: 5,
      store: {
        type: 'redis',
        client: redis,
        keyPrefix: 'app:auth_limit:',
        retryDelay: '500ms' // Short retry delay for auth endpoints
      }
    })]
  },
  async ({ request }) => {
    return await authenticateUser(request.body);
  }
);

await app.listen();
```

<span style="color: #3498db">**💡 Tip:**</span> Use different key prefixes for different types of limits (`app:rate_limit:`, `app:auth_limit:`) to organize your Redis keys.

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

// Middleware to extract user ID from JWT (beforeRouting runs before the rate limiter's keyGenerator)
app.beforeRouting([
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

<span style="color: #e74c3c">**⚠️ Not rate limited:**</span> everything in a `beforeRouting` hook runs *before* the global limiter. A hook that answers early, for example returning a 401 for a bad token, is never counted, so a brute-force attempt that fails there is never throttled, and any database lookup it does (like `getUserTier` below) runs unthrottled for every request. Keep `beforeRouting` to cheap work that never answers on its own (decode a token, read a header). For brute-force-sensitive auth (login, password reset, OTP), put a `rateLimitHook` on that route: it runs before the handler and counts failed attempts too.

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

// Identify the user and their tier in beforeRouting, which runs before the rate limiter's keyGenerator
app.beforeRouting([
  async (ctx) => {
    const token = ctx.request.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = await verifyJWT(token);
      ctx.state.userId = decoded.userId;
      ctx.state.userTier = await getUserTier(decoded.userId);
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

YinzerFlow's rate limiter is designed for high performance with both in-memory and Redis stores:

### In-Memory Store Performance

- ⚡ **O(1) lookups**: Uses Map for constant-time access
- 🎯 **Minimal overhead**: Adds only ~0.1-0.5ms per request
- 💾 **Memory efficient**: Only 3 numbers per client (~24 bytes) vs 100+ timestamps (~800 bytes) for sliding window log
- 🔄 **No blocking**: Fully synchronous algorithm with no async operations needed for rate checks
- 🧹 **Automatic cleanup**: Windows naturally expire without explicit cleanup loops

<span style="color: #f39c12">**⚡ Performance:**</span> Memory comparison:

- **Sliding Window Counter** (YinzerFlow): ~24 bytes per client (3 numbers)
- **Sliding Window Log**: ~800 bytes per client (100+ timestamps)
- **Savings**: 33x less memory usage

### Redis Store Performance

- 🌐 **Distributed**: Works across multiple server instances
- ⚡ **Low latency**: Adds ~1-5ms per request (depending on Redis location)
- 💾 **Shared memory**: Rate limit data shared across all instances
- 🔄 **Automatic expiration**: Redis TTL handles cleanup automatically
- 🛡️ **Connection resilience**: Configurable retry logic for reliability

<span style="color: #f39c12">**⚡ Performance:**</span> Redis store comparison:

- **In-memory**: ~0.1-0.5ms latency, single-instance only
- **Redis local**: ~1-2ms latency, distributed
- **Redis remote**: ~5-10ms latency, distributed

**Algorithm complexity:**

- ⚡ All operations: O(1) constant time
- 💾 Memory per client: O(1) constant space
- ✅ No background cleanup needed

<span style="color: #2ecc71">**✅ Result:**</span> For most applications, rate limiting overhead is negligible (< 1%) compared to actual request processing. Use in-memory for single-instance deployments and Redis for distributed systems.

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
- **YinzerFlow Solution**: The in-memory store is bounded. Each client's entry expires one window after its last request and is removed lazily on read and by a periodic sweep (an unref'd timer, stopped on `close()`), and the store never holds more than `store.maxEntries` clients (default `100000`), evicting the least recently seen client at the cap. Address rotation (for example cycling through an IPv6 /64) can no longer grow memory without limit.

### 🛡️ Standard Headers

- **Problem**: Clients hitting rate limits repeatedly waste server resources.
- **YinzerFlow Solution**: Standard `RateLimit-*` headers inform clients about limits, helping well-behaved clients avoid violations.

### 🛡️ Per-Route Limits

- **Problem**: One-size-fits-all limits don't work for different endpoint types (public vs authenticated, read vs write).
- **YinzerFlow Solution**: Per-route rate limiting with `rateLimitHook()` allows strict limits for sensitive endpoints while keeping generous limits for general API usage.

**One budget per `rateLimitHook()` call.** A hook counts every request it sees against one limit, wherever it is used: a GET route and its automatic HEAD, several routes given the same hook, or a hook set on a group. To give routes separate limits, call `rateLimitHook()` once per route.

```typescript
const loginLimit = rateLimitHook({ name: 'login', max: 5, window: '15m', store: redisStore });

app.post('/api/auth/login', loginHandler, { beforeHooks: [loginLimit] });
app.post('/api/auth/login/otp', otpHandler, { beforeHooks: [loginLimit] }); // same 5-per-15-minutes budget
```

<span style="color: #f39c12">**⚠️ Multi-node Redis:**</span> each hook's Redis keys live under `<keyPrefix>hook:<name>:`. Without `name`, the namespace is the hook's creation order among unnamed hooks (`hook:#1`, `hook:#2`, ...). Adding a named hook doesn't renumber them, but the order matches across nodes and restarts only while every node creates its unnamed hooks in the same order. Give every hook a unique `name` when several nodes share one Redis.

<span style="color: #f39c12">**⚠️ Name clashes:**</span> two hooks with the same `name` share one Redis counter. That's a deliberate shared budget when their limits match. If they declare a different `max` or `window`, each enforces its own limit against the same counter, and YinzerFlow logs a warning once at startup. Give each distinct limit its own name.

### 🛡️ Custom Key Generators

- **Problem**: IP-based limiting doesn't work well for authenticated APIs where users might share IPs (corporate networks, VPNs).
- **YinzerFlow Solution**: Custom key generators enable rate limiting by user ID, API key, or any other identifier.
- **Caution**: the state a key generator reads is set in `beforeRouting`, which runs before the limiter and is never throttled itself. A `beforeRouting` hook that rejects a request (a 401 for a bad token) does so without counting it, so a credential-stuffing run that fails there is never limited, and expensive work in that hook (signature checks against a key server, database lookups) runs for every request at full rate. Do only cheap work in `beforeRouting`, never answer from it, and protect login, password reset and OTP routes with a route-level `rateLimitHook`, which counts failed attempts before the handler runs.

### 🛡️ Retry-After Header

- **Problem**: Clients don't know when they can retry, leading to repeated failed requests.
- **YinzerFlow Solution**: Automatic `Retry-After` header tells clients exactly when to retry, reducing unnecessary traffic.

### 🛡️ Integration with IP Security

- **Problem**: Rate limiters using untrusted IP headers can be bypassed by spoofing X-Forwarded-For.
- **YinzerFlow Solution**: Uses YinzerFlow's IP security system with trusted proxy validation, preventing IP spoofing attacks.

### 🛡️ Redis Store Security

- **Problem**: Distributed rate limiting requires secure data storage and transmission.
- **YinzerFlow Solution**: Redis store uses configurable key prefixes to prevent conflicts, automatic TTL for data expiration, and connection retry logic for reliability. Keys are automatically prefixed to avoid collisions with other applications.

### 🛡️ Connection Resilience

- **Problem**: Redis connection failures can disable rate limiting entirely.
- **YinzerFlow Solution**: Configurable retry logic with exponential backoff ensures rate limiting continues to work even during temporary Redis outages. Failed operations are logged but don't crash the application.

<span style="color: #2ecc71">**✅ Result:**</span> These security measures ensure YinzerFlow's rate limiting provides robust protection against DoS attacks and API abuse while maintaining excellent performance in both single-instance and distributed deployments.

## 🔧 Troubleshooting

### 429 responses after upgrading to 0.9.0

**Symptom:** An app that never configured `rateLimit` starts answering <span style="color: #e74c3c">429 Too Many Requests</span> after upgrading to 0.9.0, typically in load tests or behind a proxy that makes every client share one IP.

**Cause:** Rate limiting is now actually on by default (see the `enabled` setting). Earlier versions skipped the limiter unless `enabled: true` was passed.

<span style="color: #2ecc71">**✅ Fix:**</span> Raise the limit, key clients correctly behind a proxy (see [IP Security](./ip-security.md)), or disable it where an upstream layer already limits.

```typescript
const app = new YinzerFlow({
  port: 3000,
  rateLimit: { max: 5000, window: '1m' }, // or { enabled: false } behind an API gateway
});
```

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

// Middleware to extract user ID from authentication (beforeRouting runs before the rate limiter's keyGenerator)
app.beforeRouting([
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
// Client must pass both global (1000/1m by default) AND route-specific (5/15m) limits
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

**Cause:** Rate limit data is stored in memory per client, for up to one window after each client's last request.

<span style="color: #2ecc71">**✅ Expected:**</span> Memory grows with the number of distinct clients per window and stops at `store.maxEntries` (default `100000`, roughly 20 MB). If the log shows `[RATE LIMIT] In-memory store reached its cap`, you have more distinct clients per window than the cap.

<span style="color: #3498db">**💡 Tip:**</span> Raise the cap for a large single instance, or use the Redis store for distributed deployments.

```typescript
const app = new YinzerFlow({
  rateLimit: {
    store: { type: 'memory', maxEntries: 500_000 }, // roughly 100 MB at the cap
  },
});
```

### Redis connection errors

**Symptom:** Rate limiting stops working with Redis connection errors in logs.

**Cause:** Redis server is down or network issues.

<span style="color: #2ecc71">**✅ Fix:**</span> Configure retry settings and ensure Redis is running.

```typescript
const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    store: {
      type: 'redis',
      client: redis,
      maxRetries: 5, // Increase retry attempts
      retryDelay: '2s' // Increase delay between retries (can use time string)
    }
  }
});
```

<span style="color: #3498db">**💡 Tip:**</span> Monitor Redis health and consider using Redis Cluster for high availability.

### Different rate limits across server instances

**Symptom:** Rate limits are inconsistent across different server instances.

**Cause:** Using in-memory store instead of Redis store.

<span style="color: #2ecc71">**✅ Fix:**</span> Use Redis store for distributed rate limiting.

```typescript
const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    store: {
      type: 'redis', // Use Redis for distributed consistency
      client: redis,
      keyPrefix: 'app:rate_limit:'
    }
  }
});
```

