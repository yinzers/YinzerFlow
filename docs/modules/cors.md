# 📖 CORS Security

YinzerFlow provides built-in CORS support to handle cross-origin requests securely and efficiently. CORS is **disabled by default** for security - enable it only when you need cross-origin access.

For detailed configuration examples and patterns, see [Configuration Guide](../configuration/configuration.md).

# ⚙️ Usage

## 🎛️ Settings

### enabled — @default <span style="color: #e74c3c">`false`</span>

Enable/disable CORS protection.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true  // ⚠️ Explicitly enable when needed
  }
});
```

<aside>

Options: `boolean`

- `false`: CORS disabled (default, most secure)
- `true`: CORS enabled with validation
</aside>

### origin — @default <span style="color: #f39c12">`'*'`</span>

Allowed origins for cross-origin requests.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    origin: 'https://myapp.com'  // Single domain
  }
});
```

<aside>

Options: `string | string[] | RegExp | function | '*'`

- `'*'`: Allow all origins (⚠️ cannot use with credentials)
- `'https://myapp.com'`: Single specific domain
- `['https://myapp.com', 'https://admin.myapp.com']`: Multiple domains
- `/^https:\/\/.*\.myapp\.com$/`: RegExp pattern for subdomains
- `(origin, request) => boolean`: Custom validation function
</aside>

### methods — @default <span style="color: #2ecc71">`['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']`</span>

Allowed HTTP methods for cross-origin requests.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});
```

<aside>

Options: `string[]`

- `['GET', 'POST']`: Minimal methods
- `['GET', 'POST', 'PUT', 'DELETE']`: Standard REST methods
- `['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']`: Extended methods
</aside>

### allowedHeaders — @default <span style="color: #2ecc71">`['*']`</span>

Allowed request headers for cross-origin requests.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
  }
});
```

<aside>

Options: `string | string[]`

- `'Content-Type'`: Single header
- `['Content-Type', 'Authorization']`: Multiple headers
- `'*'`: Allow all headers (less secure)
</aside>

### exposedHeaders — @default <span style="color: #2ecc71">`[]`</span>

Headers exposed to the client in CORS responses.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  }
});
```

<aside>

Options: `string[]`

- `[]`: No exposed headers (default)
- `['X-Total-Count']`: Custom pagination headers
- `['X-Total-Count', 'X-Page-Count', 'X-Rate-Limit']`: Multiple custom headers
</aside>

### credentials — @default <span style="color: #e74c3c">`false`</span>

Allow credentials (cookies, authorization headers) in cross-origin requests.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    origin: ['https://myapp.com'],
    credentials: true  // ✅ Safe with specific origins
  }
});
```

<aside>

Options: `boolean`

- `false`: No credentials allowed (default)
- `true`: Allow credentials (requires specific origins, not '*')
</aside>

### maxAge — @default <span style="color: #2ecc71">`86400`</span> (24 hours)

Maximum age (in seconds) for preflight cache.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    maxAge: 86400  // 24 hours preflight cache
  }
});
```

<aside>

Options: `number` (in seconds)

- `0`: No preflight caching
- `3600`: 1 hour cache
- `86400`: 24 hours cache (default)
- `604800`: 7 days cache
</aside>

### preflightContinue — @default <span style="color: #2ecc71">`false`</span>

Continue to route handler after preflight.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    preflightContinue: false  // ✅ Recommended: handle preflight completely
  }
});
```

<aside>

Options: `boolean`

- `false`: Handle preflight completely in CORS system (recommended)
- `true`: Pass preflight to route handlers (requires manual OPTIONS routes)
</aside>

### optionsSuccessStatus — @default <span style="color: #2ecc71">`204`</span>

Status code for successful OPTIONS requests.

```typescript
const app = new YinzerFlow({
  cors: {
    enabled: true,
    optionsSuccessStatus: 204  // No Content
  }
});
```

<aside>

Options: `number`

- `200`: OK (some older clients expect this)
- `204`: No Content (default, recommended)
- `204`: Most common and recommended
</aside>

# ✨ Best Practices

- **Use specific origins** instead of wildcards when possible
- **Enable credentials only when needed** and with specific origins
- **Restrict methods** to only those your API actually uses
- **Limit allowed headers** to prevent unnecessary exposure
- **Set appropriate maxAge** for preflight caching
- **Test CORS configuration** thoroughly before deployment
- **Monitor CORS errors** in production logs

# 💻 Examples

### Production API

**Use Case:** Secure web application with authenticated cross-origin requests

**Description:** Production-ready CORS configuration with specific origins, credentials support, and restricted methods/headers for maximum security.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://myapp.com', 'https://admin.myapp.com'], // Specific domains
    credentials: true,                   // Allow cookies/auth headers
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Standard REST methods
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], // Essential headers
    exposedHeaders: ['X-Total-Count'],  // Headers exposed to client
    maxAge: 86400,                      // Preflight cache duration (24h)
    optionsSuccessStatus: 204,          // Status code for successful OPTIONS
    preflightContinue: false           // Stop after preflight (recommended)
  }
});

app.get('/api/users', ({ request }) => {
  // CORS validation happens automatically
  return { users: [] };
});

await app.listen();
```

### Dev API

**Use Case:** Development server with permissive CORS for local development

**Description:** Development configuration with multiple localhost origins and relaxed settings for easier debugging and testing.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: true,
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000'
    ],                                  // Multiple localhost origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // All methods for dev
    allowedHeaders: ['*'],              // Allow all headers in dev
    exposedHeaders: [],                 // No exposed headers in dev
    maxAge: 0,                         // No preflight caching in dev
    optionsSuccessStatus: 204,
    preflightContinue: false
  }
});

app.get('/api/test', ({ request }) => {
  return { message: 'Development mode' };
});

await app.listen();
```

## 🚀 Performance Notes

- **Preflight caching**: `maxAge` setting reduces OPTIONS requests
- **Origin validation**: O(1) constant time for string/array origins
- **Header processing**: Minimal overhead for standard headers
- **Memory usage**: Negligible impact on request processing

## 🔒 Security Notes

YinzerFlow implements several security measures to prevent common CORS vulnerabilities:

### 🛡️ Origin Validation Enforcement
- **Problem**: Many frameworks validate origins but don't enforce the validation result
- **YinzerFlow Solution**: Origin validation results are actually used - unauthorized requests get 403 Forbidden

### 🛡️ Spec Compliance Enforcement
- **Problem**: CORS spec forbids `origin: '*'` with `credentials: true`, but many frameworks allow this dangerous combination
- **YinzerFlow Solution**: This combination throws a security error at startup, preventing deployment of vulnerable configurations

### 🛡️ No Origin Echo-back for Wildcards
- **Problem**: Some implementations echo back the request origin when using wildcards, defeating CORS protection
- **YinzerFlow Solution**: Wildcard origins always return literal `'*'`, never echo back request origins

### 🛡️ Proper Preflight Rejection
- **Problem**: Some frameworks set CORS headers even for rejected requests, or let request handlers override CORS rejections
- **YinzerFlow Solution**: Unauthorized preflight requests get 403 with no CORS headers, and the rejection cannot be overridden

### 🛡️ Case-Insensitive Origin Matching
- **Problem**: Inconsistent case handling can lead to bypass attempts
- **YinzerFlow Solution**: All origin validation is case-insensitive but preserves original case in responses

## 🔧 Troubleshooting

### CORS Error: "Origin not allowed"
- **Problem**: Request origin not in allowed list
- **Fix**: Add origin to configuration or check for typos

```typescript
// ❌ Wrong
cors: { origin: 'https://myapp.com' }  // Missing 's' in https

// ✅ Correct  
cors: { origin: 'https://myapp.com' }  // Exact match required
```

### CORS Error: "credentials: true with origin: '*'"
- **Problem**: Wildcard origin with credentials violates CORS spec
- **Fix**: Use specific origins or disable credentials

```typescript
// ❌ Wrong
cors: { origin: '*', credentials: true }

// ✅ Correct
cors: { origin: ['https://myapp.com'], credentials: true }
// or
cors: { origin: '*', credentials: false }
```

### Preflight Request Fails
- **Problem**: Method or header not allowed
- **Fix**: Add method/header to configuration

```typescript
// ❌ Request uses PATCH but not allowed
cors: { methods: ['GET', 'POST'] }

// ✅ Add PATCH to allowed methods
cors: { methods: ['GET', 'POST', 'PATCH'] }
```

### Credentials Not Sent
- **Problem**: Server doesn't allow credentials or client doesn't send them
- **Fix**: Enable credentials on both sides

```typescript
// Server side
cors: { credentials: true }

// Client side
fetch(url, { credentials: 'include' })
```