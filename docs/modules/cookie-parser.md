# 📖 Overview

YinzerFlow provides a built-in cookie parser that handles parsing incoming cookies, setting outgoing cookies, and optionally signing/validating cookies using HMAC-SHA256. The cookie parser is <span style="color: #95a5a6">**disabled by default**</span> and must be explicitly enabled in the YinzerFlow constructor when needed.

<span style="color: #3498db">**💡 Tip:**</span> The cookie parser makes it easy to work with session management and user preferences.

**When to use:**

- 🍪 Session management (store session IDs)
- 👤 User authentication tokens (JWT refresh tokens)
- 🎨 User preferences (theme, language)
- 📊 Analytics and tracking

**Expected outcomes:**

- ✅ Automatic parsing of incoming `Cookie` headers into Maps
- ✅ Helper methods for setting cookies with attributes
- 🛡️ HMAC signature validation to detect tampering
- 📝 Type-safe cookie access on request and context objects

# ⚙️ Usage

## 🎛️ Settings

### enabled — @default <span style="color: #95a5a6">`false`</span>

Enable or disable the cookie parser. Must be explicitly enabled to use cookie parsing.

```typescript
import { YinzerFlow } from 'yinzerflow';

// Enable cookie parser
const app = new YinzerFlow({
  port: 3000,
  cookieParser: {
    enabled: true,
    secret: process.env.COOKIE_SECRET
  }
});

// Disabled by default (no configuration needed)
const app = new YinzerFlow({ port: 3000 });
```

### secret — @default <span style="color: #95a5a6">`undefined`</span>

Secret key for signing cookies using HMAC-SHA256. When provided, cookies can be signed to detect tampering.

<span style="color: #e74c3c">**⚠️ Warning:**</span> In production, always use a strong secret (at least 32 characters) stored in environment variables.

#### What Makes a Strong Secret?

A strong secret should be:
- **Random**: Generated using cryptographically secure random methods
- **Long**: Minimum 32 characters (256 bits of entropy)
- **Unique**: Different for each application/environment
- **Secret**: Never committed to version control

```typescript
const app = new YinzerFlow({
  port: 3000,
  cookieParser: {
    secret: process.env.COOKIE_SECRET
  }
});
```

#### How to Generate a Strong Secret

**Option 1: Using Node.js crypto (recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: 4a8f2c9d1e6b5a3c7f8e2d9b1a4c6e8f2d7b9a3c5e8f1d6b4a2

# Use the output in your .env file:
# COOKIE_SECRET=4a8f2c9d1e6b5a3c7f8e2d9b1a4c6e8f2d7b9a3c5e8f1d6b4a2
```

**Option 2: Using OpenSSL**
```bash
openssl rand -hex 32
```

**Option 3: Online generators**
- Use trusted services like 1Password Secret Key Generator (for reference, not production)
- Generate locally and store securely

#### ❌ What NOT to Use

```typescript
// ❌ Weak - predictable
secret: 'my-secret-key'

// ❌ Weak - too short
secret: '12345678'

// ❌ Weak - based on company name
secret: 'acmecorp2024'

// ✅ Strong - random and long
secret: '4a8f2c9d1e6b5a3c7f8e2d9b1a4c6e8f2d7b9a3c5e8f1d6b4a2'
```

### signed — @default <span style="color: #95a5a6">`undefined`</span> (sign all)

Array of cookie names to sign. If undefined or empty, all cookies are signed when a secret is provided.

<span style="color: #3498db">**💡 Tip:**</span> Only sign cookies that need integrity protection (session IDs, user tokens).

```typescript
// Sign all cookies (default)
const app = new YinzerFlow({
  port: 3000,
  cookieParser: {
    secret: process.env.COOKIE_SECRET
  }
});

// Sign specific cookies only
const app = new YinzerFlow({
  port: 3000,
  cookieParser: {
    secret: process.env.COOKIE_SECRET,
    signed: ['sessionId', 'userId']
  }
});
```

### defaults — @default <span style="color: #95a5a6">`undefined`</span>

Default cookie options applied to all cookies set via `ctx.cookies.set()`. Can be overridden per-cookie.

```typescript
const app = new YinzerFlow({
  port: 3000,
  cookieParser: {
    secret: process.env.COOKIE_SECRET,
    defaults: {
      httpOnly: true,    // Prevent JavaScript access
      secure: true,      // HTTPS only
      sameSite: 'strict', // CSRF protection
      maxAge: 3600       // 1 hour
    }
  }
});
```

<aside>

Cookie Options:

- **httpOnly**: Prevent JavaScript access (recommended for auth cookies)
- **secure**: Only send over HTTPS (required in production)
- **sameSite**: CSRF protection - 'strict' (best), 'lax', or 'none' (requires secure)
- **maxAge**: Cookie lifetime in seconds
- **expires**: Expiration date (alternative to maxAge)
- **domain**: Cookie domain
- **path**: Cookie path (must start with '/')

</aside>

# 🔧 Basic Usage

## Parsing Cookies

```typescript
app.get('/api/user', async (ctx) => {
  // Access unsigned cookies
  const theme = ctx.request.cookies.get('theme');
  
  // Access signed cookies (validated)
  const sessionId = ctx.request.signedCookies.get('sessionId');
  
  return { theme, sessionId };
});
```

## Setting Cookies

```typescript
app.post('/api/login', async (ctx) => {
  const user = await validateUser(ctx.request.body);
  
  // Set session cookie
  ctx.cookies.set('sessionId', user.sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600
  });
  
  return { success: true };
});
```

## Signed Cookies

```typescript
// Sign and set a cookie
const signedValue = ctx.cookies.sign('sessionId', 'abc123');
ctx.cookies.set('sessionId', signedValue, {
  httpOnly: true,
  secure: true
});

// Validate signed cookies
const sessionId = ctx.request.signedCookies.get('sessionId');
if (!sessionId) {
  throw new Error('Session cookie missing or tampered');
}
```

# 💻 Examples

## JWT Refresh Token Flow

**Use Case:** Secure authentication with JWT access tokens and refresh tokens

**Description:** Production-ready JWT authentication where short-lived access tokens are used for API calls, and long-lived refresh tokens are stored in httpOnly cookies.

```typescript
import { YinzerFlow } from 'yinzerflow';
import jwt from 'jsonwebtoken';

const app = new YinzerFlow({
  port: 3000,
  cookieParser: {
    enabled: true,
    secret: process.env.COOKIE_SECRET,
    defaults: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    }
  }
});

// Constants for token lifetime
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days (in seconds)

// Login endpoint
app.post('/api/auth/login', async (ctx) => {
  const { username, password } = ctx.request.body;

  // Authenticate user
  const user = await validateUser(username, password);
  if (!user) {
    ctx.response.setStatusCode(401);
    return { error: 'Invalid credentials' };
  }

  // Generate short-lived access token
  const accessToken = jwt.sign(
    { userId: user.id, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: `${ACCESS_TOKEN_EXPIRY}s` }
  );

  // Generate long-lived refresh token
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY}s` }
  );

  // Store refresh token in cookie with matching maxAge
  ctx.cookies.set('refreshToken', refreshToken, {
    maxAge: REFRESH_TOKEN_EXPIRY // Same as JWT expiration!
  });

  // Return access token in response body
  return { accessToken };
});

// Token refresh endpoint
app.post('/api/auth/refresh', async (ctx) => {
  const refreshToken = ctx.request.signedCookies.get('refreshToken');

  if (!refreshToken) {
    ctx.response.setStatusCode(401);
    return { error: 'Refresh token missing' };
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    
    // Generate new access token
    const accessToken = jwt.sign(
      { userId: decoded.userId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: `${ACCESS_TOKEN_EXPIRY}s` }
    );

    return { accessToken };
  } catch (error) {
    ctx.response.setStatusCode(401);
    return { error: 'Invalid refresh token' };
  }
});

// Protected endpoint using access token
app.get('/api/user/profile', async (ctx) => {
  const authHeader = ctx.request.headers.authorization;
  const accessToken = authHeader?.replace('Bearer ', '');

  if (!accessToken) {
    ctx.response.setStatusCode(401);
    return { error: 'Access token required' };
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    const user = await getUserById(decoded.userId);
    return { user };
  } catch (error) {
    ctx.response.setStatusCode(401);
    return { error: 'Invalid access token' };
  }
});

await app.listen();
```

## Session Management

**Use Case:** Secure session management with signed cookies

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  cookieParser: {
    enabled: true,
    secret: process.env.COOKIE_SECRET,
    defaults: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600 // 1 hour
    },
    signed: ['sessionId', 'userId']
  }
});

app.post('/api/auth/login', async (ctx) => {
  const user = await authenticate(ctx.request.body);
  
  const sessionId = generateSessionId();
  await saveSession(sessionId, user.id);

  const signedSessionId = ctx.cookies.sign('sessionId', sessionId);
  ctx.cookies.set('sessionId', signedSessionId);

  return { success: true };
});

app.get('/api/protected', async (ctx) => {
  const sessionId = ctx.request.signedCookies.get('sessionId');
  if (!sessionId) {
    ctx.response.setStatusCode(401);
    return { error: 'Not authenticated' };
  }

  const userId = await getUserIdFromSession(sessionId);
  const user = await getUserById(userId);

  return { user };
});

await app.listen();
```

## Development Setup

**Use Case:** Development server with relaxed cookie settings

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  networkLogs: true,
  cookieParser: {
    enabled: true,
    defaults: {
      httpOnly: false,    // Allow JavaScript access
      secure: false,      // Allow HTTP
      sameSite: 'lax'
    }
  }
});

app.get('/api/test', async (ctx) => {
  ctx.cookies.set('theme', 'dark');
  return { theme: ctx.request.cookies.get('theme') };
});

await app.listen();
```

# ✨ Best Practices

- 🛡️ **Always use `secret`**: Sign authentication cookies to detect tampering
- 🔒 **Use `httpOnly: true`**: Prevent JavaScript access to sensitive cookies
- 🔐 **Use `secure: true`**: Only send cookies over HTTPS in production
- 🎯 **Use `sameSite: 'strict'`**: Best CSRF protection
- ⏱️ **Match `maxAge` to JWT expiration**: For refresh tokens, set cookie `maxAge` to match JWT `expiresIn`
- 🔑 **Store secrets in environment variables**: Never commit secrets
- 📊 **Use signed cookies for sensitive data**: Session IDs, user tokens
- 💡 **Use unsigned cookies for preferences**: Theme, language

## 🚀 Performance Notes

- ⚡ **Parsing overhead**: Minimal - cookies are parsed once per request
- 💾 **Memory usage**: Maps are garbage collected after request
- 🔐 **HMAC performance**: Fast - HMAC-SHA256 is efficient (~1ms per cookie)
- 📊 **Signature size**: ~43 characters per signed cookie (base64url)

## 🔒 Security Notes

YinzerFlow implements several security measures to protect against common cookie vulnerabilities:

### 🛡️ HMAC Signature Validation
- **Problem**: Cookies can be tampered with by clients
- **YinzerFlow Solution**: HMAC-SHA256 signatures detect tampering

### 🛡️ XSS Protection
- **Problem**: JavaScript can access cookies via `document.cookie`
- **YinzerFlow Solution**: `httpOnly: true` prevents JavaScript access

### 🛡️ Man-in-the-Middle Attacks
- **Problem**: Cookies sent over HTTP can be intercepted
- **YinzerFlow Solution**: `secure: true` ensures HTTPS-only transmission

### 🛡️ CSRF Protection
- **Problem**: Cross-site requests can include cookies
- **YinzerFlow Solution**: `sameSite: 'strict'` blocks cross-site cookie sends

## 🔧 Troubleshooting

### Cookies are not being set
**Symptom**: Cookies don't appear in browser

**Solution:**
- Enable cookie parser in configuration (`enabled: true`)
- Check `secure: true` only for HTTPS connections
- Verify domain/path match

### Signed cookies return `false` when unsigned
**Symptom**: `ctx.request.signedCookies` is empty or returns false

**Solution:**
- Verify secret is correct
- Ensure cookie was properly signed using `ctx.cookies.sign()`
- Check if cookie was tampered with

### Cookies accessible to JavaScript when they shouldn't be
**Symptom**: JavaScript can read sensitive cookies

**Solution:** Set `httpOnly: true` in defaults or per-cookie
