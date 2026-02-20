# 📖 Overview

YinzerFlow provides flexible and secure configuration options for fine-tuning your API's behavior, security, and performance. All configuration options are <span style="color: #2ecc71">**optional with secure defaults**</span>, allowing you to start quickly while maintaining the ability to customize as needed.

<span style="color: #3498db">**💡 Tip:**</span> YinzerFlow uses a <span style="color: #2ecc71">**security-first**</span> approach with sensible defaults. You only need to configure what you want to change.

**When to configure:**

- 🌐 Deploying to different environments (dev, staging, production)
- 🔒 Adjusting security settings for your use case
- ⚡ Optimizing performance for specific workloads
- 🎨 Customizing behavior (CORS, logging, rate limiting)
- 🔑 Handling proxy infrastructure (load balancers, CDNs)

**Expected outcomes:**

- ✅ Environment-specific configurations
- 🔒 Enhanced security with minimal overhead
- 📊 Better observability with logging
- 🎯 Optimal performance for your use case

<span style="color: #3498db">🔗 For specific features, see: [Rate Limiting](../modules/rate-limiting.md), [CORS](../modules/cors.md), [IP Security](../modules/ip-security.md), [Logging](../core/logging.md)</span>

# ⚙️ Usage

## 🎛️ Settings

### port — @default <span style="color: #2ecc71">`5000`</span>

Port number for the server to listen on.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 3000,
});
```

<aside>

Options: `number`

- 🚨 Minimum: `1`
- 🚨 Maximum: `65535`
- ✅ Recommended: `3000` for development, `443` for production HTTPS
- 🟢 Default: `5000`

</aside>

### host — @default <span style="color: #2ecc71">`'0.0.0.0'`</span>

Host address to bind the server to.

```typescript
const app = new YinzerFlow({
  port: 3000,
  host: "127.0.0.1", // Localhost only
});
```

<aside>

Options: `string`

- 🌐 `'0.0.0.0'`: All network interfaces (default, recommended)
- 🔒 `'127.0.0.1'`: Localhost only (testing)
- 🌐 `'::'`: All IPv6 interfaces

</aside>

### logging — @default <span style="color: #2ecc71">`{ level: 'warn', prefix: 'YINZER', personality: true, requests: false }`</span>

Logging configuration — controls app logger, access logs, and diagnostics. Three independent channels under one key.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 3000,
  logging: {
    level: "info",             // 'off' | 'error' | 'warn' | 'info' | 'debug'
    prefix: "MY-APP",         // Log line prefix: [MY-APP]
    personality: true,         // Pittsburgh personality phrases
    requests: true,            // nginx-style access logs
    logger: winstonLogger,     // Custom app logger (optional)
    accessLogger: pinoLogger,  // Custom access logger (optional)
    diagnostics: {             // Framework health monitoring
      slowRequests: "500ms",
      largeResponses: "1mb",
      memory: "30s",
      eventLoop: "100ms",
      rateLimits: true,
    },
  },
});
```

<aside>

Key settings:

- 🔊 `level`: Minimum app log level (`'warn'` default)
- 🏷️ `prefix`: Log line prefix (`'YINZER'` default)
- 🎭 `personality`: Pittsburgh phrases (`true` default)
- 📊 `requests`: Access logs on/off (`false` default)
- 🔧 `diagnostics`: Health monitoring thresholds (all `false` default)

<span style="color: #3498db">🔗 See [Logging Documentation](../core/logging.md) for all options, diagnostic presets, and `createLogger()` usage</span>

</aside>

### cors — @default <span style="color: #2ecc71">`{ enabled: false }`</span>

Cross-Origin Resource Sharing configuration for browser security.

<span style="color: #e74c3c">**⚠️ Warning:**</span> Only enable CORS if your API is accessed from browser clients on different origins.

```typescript
const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: true,
    origin: ["https://yourdomain.com"],
    credentials: true,
  },
});
```

<aside>

Options: `{ enabled: false } | CorsOptions`

- 🔴 `{ enabled: false }`: CORS disabled (default, most secure)
- 🟢 `{ enabled: true, ... }`: CORS enabled with origin configuration

<span style="color: #3498db">🔗 See [CORS Documentation](../modules/cors.md) for all options</span>

</aside>

### rateLimit — @default <span style="color: #2ecc71">`{ enabled: true, window: '15m', max: 100 }`</span>

Rate limiting configuration to protect against DoS attacks and API abuse.

<span style="color: #2ecc71">**✅ Recommended:**</span> Keep rate limiting enabled in production for security.

```typescript
const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    enabled: true,
    window: "15m",
    max: 100,
  },
});
```

<aside>

Options: `RateLimitOptions`

- 🟢 `enabled: true`: Rate limiting enabled (default, recommended)
- ⏱️ `window`: Time window (`'15m'` default)
- 🔢 `max`: Maximum requests per window (`100` default)

<span style="color: #3498db">🔗 See [Rate Limiting Documentation](../modules/rate-limiting.md) for all options</span>

</aside>

### bodyParser — @default <span style="color: #2ecc71">Secure defaults</span>

Body parsing configuration with built-in security protections.

```typescript
const app = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      maxDepth: 10,
      allowPrototypeProperties: false, // Security protection
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB
      maxFiles: 10,
    },
  },
});
```

<aside>

Options: `BodyParserOptions`

- 📄 `json`: JSON parsing limits (256KB max default)
- 📁 `fileUploads`: File upload limits (10MB max default)
- 📝 `urlEncoded`: Form data limits (1MB max default)

<span style="color: #3498db">🔗 See [Body Parsing Documentation](../modules/body-parsing.md) for all options</span>

</aside>

### ipSecurity — @default <span style="color: #2ecc71">Secure defaults</span>

IP address validation and spoofing protection.

```typescript
const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ["127.0.0.1", "192.168.1.10"],
    detectSpoofing: true,
  },
});
```

<aside>

Options: `IpSecurityConfiguration`

- 🔑 `trustedProxies`: Allowed proxy IPs (`['127.0.0.1', '::1']` default)
- 🛡️ `detectSpoofing`: Enable spoofing detection (`true` default)
- 🌐 `allowPrivateIps`: Allow private IP addresses (`true` default)

<span style="color: #3498db">🔗 See [IP Security Documentation](../modules/ip-security.md) for all options</span>

</aside>

### gracefulShutdownTimeout — @default <span style="color: #2ecc71">`'15m'`</span>

Graceful shutdown timeout for completing in-flight requests before server shutdown.

<span style="color: #3498db">**💡 Tip:**</span> When set to a value greater than 0, YinzerFlow automatically sets up signal handlers for SIGTERM and SIGINT. Set to `0` or `'0s'` if you need custom shutdown logic.

<span style="color: #f39c12">**⚡ Performance:**</span> If using container orchestration, your container termination grace period should be at least 1 second longer than this value.

```typescript
const app = new YinzerFlow({
  port: 3000,
  gracefulShutdownTimeout: "30s", // Wait 30 seconds for requests to complete
});
```

<aside>

Options: `TimeString | number`

- ⏱️ `TimeString`: Use time strings like `'15m'`, `'30s'`, `'1h'` (recommended)
- 🔢 `number`: Milliseconds as a number
- 🟢 Default: `'15m'` (15 minutes)
- 🔴 Disable: Set to `0` or `'0s'` for manual shutdown handling

</aside>

# ✨ Best Practices

- ✅ **Use environment variables**: Store configuration in environment variables for different environments
- 🔒 **Start secure**: Begin with strict limits and relax as needed
- 📊 **Enable logging**: Use `logging: { requests: true }` in development for debugging
- 🎯 **Validate configuration**: Test configuration before deploying to production
- 🔑 **Configure proxies**: Set `trustedProxies` for load balancers and CDNs
- ⚡ **Optimize for use case**: Adjust limits based on your specific workload
- 📝 **Document changes**: Comment configuration overrides for team clarity

# 💻 Examples

### Production API

**Use Case:** Secure production API with CORS and rate limiting

**Description:** Production-ready configuration with security best practices, rate limiting, CORS for specific origins, and optimized settings.

<span style="color: #f39c12">**⚡ Performance:**</span> This configuration balances security, performance, and reliability for production workloads.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 443,
  host: "0.0.0.0",
  cors: {
    enabled: true,
    origin: ["https://yourdomain.com", "https://app.yourdomain.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  rateLimit: {
    enabled: true,
    window: "15m",
    max: 100,
    standardHeaders: true,
  },
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      maxDepth: 10,
      allowPrototypeProperties: false,
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB
      maxFiles: 10,
      allowedExtensions: [".jpg", ".png", ".pdf"],
    },
  },
  ipSecurity: {
    trustedProxies: ["192.168.1.10"], // Your load balancer
    allowPrivateIps: false, // Only real client IPs
    detectSpoofing: true,
  },
  gracefulShutdownTimeout: "30s", // 30 second graceful shutdown
});

await app.listen();
```

### Dev API

**Use Case:** Development server with relaxed security and verbose logging

**Description:** Development configuration with permissive CORS, disabled rate limiting, larger limits, and verbose logging for easier debugging.

<span style="color: #e74c3c">**⚠️ Warning:**</span> Never use this configuration in production - it's insecure by design for development convenience.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 3000,
  logging: {
    level: "debug",
    requests: true, // Verbose request logging
  },
  cors: {
    enabled: true,
    origin: "*", // Allow all origins (DEV ONLY!)
    credentials: true,
  },
  rateLimit: {
    enabled: false, // Disable for development
  },
  bodyParser: {
    json: {
      maxSize: 10485760, // 10MB for testing
      maxDepth: 20,
    },
    fileUploads: {
      maxFileSize: 104857600, // 100MB
      maxFiles: 20,
      allowedExtensions: [], // Allow all extensions
    },
  },
  ipSecurity: {
    allowPrivateIps: true,
    detectSpoofing: false, // Disable for development
  },
});

await app.listen();
```

### High-Security API

**Use Case:** Maximum security for sensitive data APIs

**Description:** Strictest configuration with minimal limits, no file uploads, no CORS, and maximum security protections.

<span style="color: #2ecc71">**✅ Use when:**</span> Handling highly sensitive data (financial, healthcare, PII)

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 443,
  cors: {
    enabled: false, // No CORS for maximum security
  },
  rateLimit: {
    enabled: true,
    window: "5m",
    max: 20, // Very strict limits
  },
  bodyParser: {
    json: {
      maxSize: 32768, // 32KB only
      maxDepth: 3,
      maxKeys: 50,
      allowPrototypeProperties: false,
    },
    fileUploads: {
      maxFileSize: 0, // No file uploads
      maxFiles: 0,
    },
    urlEncoded: {
      maxSize: 8192, // 8KB forms only
      maxFields: 20,
    },
  },
  ipSecurity: {
    trustedProxies: [], // No proxies
    allowPrivateIps: false,
    detectSpoofing: true,
  },
});

await app.listen();
```

### File Upload Service

**Use Case:** Service optimized for large file uploads

**Description:** Configuration with large file upload limits, minimal JSON parsing, and appropriate security controls.

<span style="color: #f39c12">**⚡ Performance:**</span> Memory usage scales with concurrent uploads - monitor and adjust limits as needed.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 512000, // 500KB for metadata only
      maxDepth: 3,
    },
    fileUploads: {
      maxFileSize: 2147483648, // 2GB per file
      maxTotalSize: 10737418240, // 10GB total
      maxFiles: 50,
      allowedExtensions: [
        ".jpg", ".png", ".gif", ".mp4", ".webm",
        ".pdf", ".zip", ".tar", ".gz",
      ],
      maxFilenameLength: 200,
    },
  },
  gracefulShutdownTimeout: "5m", // 5 minutes for large uploads to complete
});

await app.listen();
```

### Microservice (Internal)

**Use Case:** Internal microservice behind API gateway

**Description:** Configuration for internal services with no CORS, allowing private IPs, and moderate limits.

<span style="color: #3498db">**💡 Tip:**</span> Internal services can be more permissive since they're not internet-facing.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: false, // No CORS for internal services
  },
  rateLimit: {
    enabled: false, // Gateway handles rate limiting
  },
  bodyParser: {
    json: {
      maxSize: 524288, // 512KB
      maxDepth: 10,
    },
    fileUploads: {
      maxFileSize: 0, // No file uploads
      maxFiles: 0,
    },
  },
  ipSecurity: {
    trustedProxies: ["127.0.0.1", "10.0.0.0/8"],
    allowPrivateIps: true,
    detectSpoofing: true,
  },
});

await app.listen();
```

### Load Balancer Setup

**Use Case:** API behind load balancer (ALB, nginx, etc.)

**Description:** Configuration for services behind load balancers with proper proxy trust settings.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: [
      "192.168.1.10", // Load balancer IP
      "192.168.1.11", // Backup load balancer
    ],
    headerPreference: ["x-forwarded-for", "x-real-ip"],
    maxChainLength: 5,
    detectSpoofing: true,
  },
});

await app.listen();
```

### CDN Configuration (Cloudflare)

**Use Case:** API behind Cloudflare CDN

**Description:** Configuration for services behind Cloudflare with proper IP extraction from cf-connecting-ip header.

```typescript
import { YinzerFlow } from "yinzerflow";

const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: true,
    origin: ["https://yourdomain.com"],
    credentials: true,
  },
  ipSecurity: {
    trustedProxies: [
      // Cloudflare IP ranges (example - use full list)
      "173.245.48.0/20",
      "103.21.244.0/22",
      "103.22.200.0/22",
    ],
    headerPreference: ["cf-connecting-ip", "x-forwarded-for"],
    allowPrivateIps: false, // Only real client IPs
  },
});

await app.listen();
```

### Environment-Based Configuration

**Use Case:** Single codebase for multiple environments

**Description:** Use environment variables to configure different environments from the same codebase.

<span style="color: #2ecc71">**✅ Recommended:**</span> This pattern makes deployment easier and reduces configuration errors.

```typescript
import { YinzerFlow } from "yinzerflow";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

const app = new YinzerFlow({
  port: parseInt(process.env.PORT || "3000"),
  host: process.env.HOST || "0.0.0.0",
  
  logging: {
    level: isDevelopment ? "debug" : "warn",
    requests: isDevelopment, // Only in development
  },
  
  cors: {
    enabled: true,
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  },
  
  rateLimit: {
    enabled: isProduction, // Only in production
    window: "15m",
    max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  },
  
  bodyParser: {
    json: {
      maxSize: parseInt(process.env.MAX_JSON_SIZE || "262144"),
      allowPrototypeProperties: false,
    },
  },
  
  ipSecurity: {
    trustedProxies: process.env.TRUSTED_PROXIES?.split(",") || ["127.0.0.1"],
    allowPrivateIps: !isProduction,
    detectSpoofing: isProduction,
  },
});

await app.listen();
```

## 🚀 Performance Notes

### Memory Considerations

- 💾 **JSON parsing**: `maxSize` directly impacts memory usage per request
- 📁 **File uploads**: Memory scales with `maxFileSize` × `maxFiles` × concurrent requests
- 🔄 **Rate limiting**: Uses ~24 bytes per tracked client (minimal overhead)
- ⏱️ **Graceful shutdown**: `gracefulShutdownTimeout` should account for longest request duration

<span style="color: #f39c12">**⚡ Performance:**</span> Limits comparison:

- **Conservative** (high-security): 32KB JSON, no files, 20 requests/5min
- **Moderate** (standard API): 256KB JSON, 10MB files, 100 requests/15min
- **Permissive** (file service): 500KB JSON, 2GB files, 1000 requests/hour

### Graceful Shutdown Tuning

- ⏱️ **Standard APIs**: `'30s'` to `'1m'` is usually sufficient
- ⏱️ **Long-running requests**: `'5m'` to `'15m'` for file processing or complex queries
- ⏱️ **Container orchestration**: Set container termination grace period to `gracefulShutdownTimeout + 1s`

<span style="color: #2ecc71">**✅ Rule of thumb:**</span> Set `gracefulShutdownTimeout` to 2× your longest expected request duration.

## 🔒 Security Notes

### 🛡️ Secure Defaults

- **Problem**: Many frameworks default to permissive settings that can be exploited.
- **YinzerFlow Solution**: All defaults are security-first - rate limiting enabled, CORS disabled, strict parsing limits, and prototype pollution protection.

### 🛡️ Configuration Validation

- **Problem**: Invalid configuration can crash servers or create security holes.
- **YinzerFlow Solution**: All configuration is validated at startup with descriptive error messages.

### 🛡️ Environment Separation

- **Problem**: Using production config in development or vice versa causes issues.
- **YinzerFlow Solution**: Use environment variables and conditional logic to separate configs.

<span style="color: #2ecc71">**✅ Result:**</span> YinzerFlow's configuration system provides security by default while maintaining flexibility for different use cases.

## 🔧 Troubleshooting

### Configuration not applying

**Symptom:** Changes to configuration don't seem to take effect.

**Cause:** Configuration is only read once at server creation.

<span style="color: #2ecc71">**✅ Fix:**</span> Restart the server after configuration changes.

```typescript
// ❌ This won't work
const app = new YinzerFlow({ port: 3000 });
app.config.port = 4000; // Configuration is immutable

// ✅ This works
const app = new YinzerFlow({ port: 4000 });
```

### CORS errors in browser

**Symptom:** Browser blocks requests with CORS policy errors like:
- `"Access-Control-Allow-Origin" header missing`
- `"CORS policy: No 'Access-Control-Allow-Origin' header is present"`
- `"Method [METHOD] is not allowed by Access-Control-Allow-Methods"`

**Common causes:**

1. 🌐 **Origin mismatch**: Origin doesn't match exactly (check protocol, domain, port)
2. 🔤 **Typos**: Spelling errors in origin URL
3. 📝 **Trailing slashes**: `https://yourdomain.com/` vs `https://yourdomain.com`
4. ⚙️ **HTTP method not allowed**: Using PUT/DELETE but only GET/POST configured
5. 🔑 **Credentials mismatch**: `credentials: true` required when using cookies/auth
6. 🔒 **Wildcard with credentials**: Can't use `origin: '*'` with `credentials: true`

<span style="color: #2ecc71">**✅ Fix checklist:**</span>

1. **Check origin matches exactly** (including `https://` and port):
   ```typescript
   cors: {
     enabled: true,
     origin: ["https://yourdomain.com:3000"], // Exact match with protocol and port
     credentials: true,
   }
   ```

2. **Verify HTTP method is allowed**:
   ```typescript
   cors: {
     enabled: true,
     origin: ["https://yourdomain.com"],
     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Include all methods you use
   }
   ```

3. **Check for typos** in origin URL:
   ```typescript
   // ❌ Common typos
   origin: ["https://yourdomain.com "], // Trailing space
   origin: ["http://yourdomain.com"],  // HTTP instead of HTTPS
   origin: ["https://yourdomian.com"], // Misspelled domain
   
   // ✅ Correct
   origin: ["https://yourdomain.com"]
   ```

4. **Ensure credentials setting matches**:
   ```typescript
   // If frontend uses: fetch(url, { credentials: 'include' })
   cors: {
     enabled: true,
     origin: ["https://yourdomain.com"], // Must be specific, not '*'
     credentials: true, // Must be true
   }
   ```

<span style="color: #3498db">**💡 Tip:**</span> Check browser console Network tab → Select failed request → Look at Response Headers to see what CORS headers were sent.

### File uploads rejected

**Symptom:** File uploads fail with 413 Payload Too Large.

**Cause:** File exceeds `maxFileSize` or `maxTotalSize` limits.

<span style="color: #2ecc71">**✅ Fix:**</span> Increase file upload limits.

```typescript
bodyParser: {
  fileUploads: {
    maxFileSize: 52428800, // 50MB per file
    maxTotalSize: 104857600, // 100MB total
    maxFiles: 20,
  },
}
```

### Wrong client IP address

**Symptom:** `request.ipAddress` shows proxy IP instead of client IP.

**Cause:** Proxy not configured in `trustedProxies`.

<span style="color: #2ecc71">**✅ Fix:**</span> Add your proxy/load balancer IP to trusted proxies.

<span style="color: #3498db">🔗 See [IP Security Documentation](../modules/ip-security.md) for details</span>

```typescript
ipSecurity: {
  trustedProxies: ["192.168.1.10"], // Your load balancer IP
  headerPreference: ["x-forwarded-for", "x-real-ip"],
}
```

### Rate limit headers missing

**Symptom:** Responses don't include `RateLimit-*` headers.

**Cause:** `standardHeaders` is disabled.

<span style="color: #2ecc71">**✅ Fix:**</span> Enable standard rate limit headers.

```typescript
rateLimit: {
  enabled: true,
  standardHeaders: true, // Enable headers
}
```

### Server shuts down immediately

**Symptom:** Server starts but shuts down right away on SIGTERM/SIGINT.

**Cause:** `gracefulShutdownTimeout` is enabled (default) and a signal is being sent, or you have duplicate signal handlers.

<span style="color: #2ecc71">**✅ Fix:**</span> Disable graceful shutdown if using custom signal handlers.

```typescript
const app = new YinzerFlow({
  port: 3000,
  gracefulShutdownTimeout: 0, // Disable automatic signal handling
});

// Your custom signal handling
process.on("SIGTERM", async () => {
  await customCleanup();
  await app.close();
  process.exit(0);
});
```

<span style="color: #3498db">**💡 Tip:**</span> Check if your process manager (PM2, Docker, etc.) is sending signals. The default behavior will catch them and gracefully shut down.

