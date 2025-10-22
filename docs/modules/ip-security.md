# 📖 IP Security

YinzerFlow provides comprehensive IP address validation and security protection against IP spoofing attacks, supporting multiple header formats with trusted proxy validation.

For detailed configuration examples and patterns, see [Configuration Guide](../configuration/configuration.md).

# ⚙️ Usage

## 🎛️ Settings

### trustedProxies — @default <span style="color: #2ecc71">`['127.0.0.1', '::1']`</span>

List of trusted proxy IP addresses that can send forwarded headers.

```typescript
const app = new YinzerFlow({
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '::1', '192.168.1.10'] // Trusted proxy IPs
  }
});
```

<aside>

Options: `string[]`

- `['127.0.0.1', '::1']`: Localhost only (default)
- `['192.168.1.10']`: Specific load balancer IP
- `['*']`: Trust any proxy (useful for Kubernetes/unknown infrastructure)
- `['173.245.48.0/20', '103.21.244.0/22']`: Cloudflare IP ranges
</aside>

### allowPrivateIps — @default <span style="color: #2ecc71">`true`</span>

Allow private IP addresses (RFC 1918, RFC 4193, RFC 3927).

```typescript
const app = new YinzerFlow({
  ipSecurity: {
    allowPrivateIps: true  // Allow private IPs (default)
  }
});
```

<aside>

Options: `boolean`

- `true`: Allow private IPs (default, good for internal networks)
- `false`: Only allow public IPs (more secure for public APIs)
</aside>

### headerPreference — @default <span style="color: #2ecc71">`['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'x-client-ip', 'true-client-ip']`</span>

Header preference order for IP extraction.

```typescript
const app = new YinzerFlow({
  ipSecurity: {
    headerPreference: [
      'x-forwarded-for',     // Standard proxy header
      'x-real-ip',          // Nginx header
      'cf-connecting-ip',   // Cloudflare header
      'x-client-ip',       // Alternative header
      'true-client-ip'    // Another alternative
    ]
  }
});
```

<aside>

Options: `string[]`

- `['x-forwarded-for']`: Only X-Forwarded-For (most common)
- `['cf-connecting-ip', 'x-forwarded-for']`: Cloudflare priority
- `['x-real-ip']`: Only X-Real-IP (Nginx)
- `['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']`: Comprehensive (default)
</aside>

### maxChainLength — @default <span style="color: #2ecc71">`10`</span>

Maximum IP chain length to prevent amplification attacks.

```typescript
const app = new YinzerFlow({
  ipSecurity: {
    maxChainLength: 10  // Reasonable chain limit
  }
});
```

<aside>

Options: `number`

- `2`: Short chains only (high security)
- `10`: Standard limit (default)
- `20`: Longer chains (complex infrastructure)
</aside>

### detectSpoofing — @default <span style="color: #2ecc71">`true`</span>

Enable spoofing pattern detection.

```typescript
const app = new YinzerFlow({
  ipSecurity: {
    detectSpoofing: true  // Enable spoofing detection
  }
});
```

<aside>

Options: `boolean`

- `true`: Detect spoofing patterns (default, recommended)
- `false`: Disable detection (development only)
</aside>

# ✨ Best Practices

- **Configure trusted proxies** for your load balancer/CDN infrastructure
- **Use specific IPs** instead of wildcards when possible
- **Enable spoofing detection** in production environments
- **Set appropriate chain length limits** based on your network topology
- **Test IP extraction** with your specific infrastructure
- **Monitor IP validation logs** for suspicious patterns

# 💻 Examples

### Production API

**Use Case:** High-security API behind Nginx load balancer

**Description:** Production-ready IP security configuration with specific trusted proxies, strict validation, and spoofing detection for maximum security.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ['192.168.1.10'],     // Your Nginx server
    allowPrivateIps: false,               // Only real client IPs
    headerPreference: ['x-forwarded-for'], // Nginx uses X-Forwarded-For
    detectSpoofing: true,
    maxChainLength: 2                     // Short chains only
  }
});

app.get('/api/user-info', ({ request }) => {
  const clientIp = request.ipAddress; // Validated and secure
  
  return {
    message: `Hello from ${clientIp}`,
    userAgent: request.headers['user-agent']
  };
});

await app.listen();
```

### Dev API

**Use Case:** Development server with relaxed IP validation

**Description:** Development configuration with localhost trusted proxies and relaxed settings for easier debugging and testing.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '::1'], // Localhost only
    allowPrivateIps: true,                 // Allow private IPs in dev
    headerPreference: [                    // Comprehensive header support
      'x-forwarded-for', 
      'x-real-ip', 
      'cf-connecting-ip'
    ],
    detectSpoofing: false,                 // Disable for development
    maxChainLength: 10                     // Standard limit
  }
});

app.get('/api/test', ({ request }) => {
  const clientIp = request.ipAddress;
  return { message: 'Development mode', clientIp };
});

await app.listen();
```

## 🚀 Performance Notes

- **IP validation**: O(1) constant time for trusted proxy validation
- **Header processing**: Minimal overhead for standard headers
- **Spoofing detection**: Lightweight pattern matching
- **Memory usage**: Negligible impact on request processing

## 🔒 Security Notes

YinzerFlow implements several security measures to prevent IP spoofing attacks:

### 🛡️ Trusted Proxy Validation
- **Problem**: Attackers can spoof `X-Forwarded-For` headers to hide their real IP address or impersonate other clients
- **YinzerFlow Solution**: Only accepts forwarded headers from explicitly configured trusted proxy IPs, preventing spoofing from untrusted sources

### 🛡️ Multiple Header Support
- **Problem**: Different proxies and CDNs use different headers (X-Real-IP, CF-Connecting-IP, etc.), making it hard to get consistent client IPs
- **YinzerFlow Solution**: Configurable header preference order with validation for each header type based on its expected format and source

### 🛡️ IP Format Validation
- **Problem**: Malformed IP addresses can cause application errors or bypass security controls
- **YinzerFlow Solution**: Comprehensive IPv4 and IPv6 validation with named capture groups for precise format checking

### 🛡️ Spoofing Pattern Detection
- **Problem**: Sophisticated attacks use patterns like duplicate IPs, overly long chains, or mixed valid/invalid IPs to confuse parsing
- **YinzerFlow Solution**: Advanced pattern detection identifies suspicious IP chains and automatically rejects them

### 🛡️ Private IP Filtering
- **Problem**: Internal network IPs might leak information about network topology or be used in certain attacks
- **YinzerFlow Solution**: Configurable private IP filtering with RFC 1918, RFC 4193, and RFC 3927 range detection

## 🔧 Troubleshooting

### IP Address Always Empty
- **Problem**: `request.ipAddress` is always empty
- **Fix**: Configure trusted proxies for your infrastructure

```typescript
// ❌ Wrong - no trusted proxies
ipSecurity: { trustedProxies: [] }

// ✅ Correct - configure trusted proxies
ipSecurity: { trustedProxies: ['127.0.0.1', '192.168.1.10'] }
```

### Wrong Client IP Behind Load Balancer
- **Problem**: Load balancer IP not in trusted proxies
- **Fix**: Add load balancer IP to trusted proxies

```typescript
// ❌ Wrong - load balancer IP not trusted
ipSecurity: { trustedProxies: ['127.0.0.1'] }
// Load balancer at 192.168.1.10 sends: X-Forwarded-For: 203.0.113.1, 192.168.1.10

// ✅ Correct - add load balancer IP
ipSecurity: { trustedProxies: ['127.0.0.1', '192.168.1.10'] }
```

### Private IPs Blocked When Needed
- **Problem**: `allowPrivateIps: false` blocks internal network IPs
- **Fix**: Enable private IPs for internal networks

```typescript
// ❌ Wrong - blocks private IPs
ipSecurity: { allowPrivateIps: false }

// ✅ Correct - allow private IPs for internal networks
ipSecurity: { allowPrivateIps: true }
```

### Cloudflare IP Not Working
- **Problem**: Cloudflare IP ranges not in trusted proxies
- **Fix**: Add Cloudflare IP ranges or use wildcard

```typescript
// ❌ Wrong - Cloudflare IPs not trusted
ipSecurity: { trustedProxies: ['127.0.0.1'] }

// ✅ Correct - add Cloudflare IPs or use wildcard
ipSecurity: { 
  trustedProxies: ['*'], // Trust any proxy
  headerPreference: ['cf-connecting-ip', 'x-forwarded-for']
}
```