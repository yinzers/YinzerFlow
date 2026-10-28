# 📖 IP Security

YinzerFlow provides comprehensive IP address validation and security protection against IP spoofing attacks, supporting multiple header formats with trusted proxy validation.

For detailed configuration examples and patterns, see [Configuration Guide](../configuration/configuration.md).

# ⚙️ Usage

## 🎛️ Settings

### trustedProxies — @default <span style="color: #2ecc71">`['127.0.0.1', '::1']`</span>

The proxies whose forwarded headers YinzerFlow believes, as exact IPs or CIDR ranges (IPv4 and IPv6).

Client-IP headers (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `X-Client-IP`, `True-Client-IP`) are read **only when the socket peer, the machine actually connected to YinzerFlow, is in this list**. From any other peer, `request.ipAddress` is the socket address whatever headers arrive, so a client can't choose its own IP or rate-limit bucket. For `X-Forwarded-For` from a trusted peer, the chain is walked from the right past every trusted proxy, and the first untrusted hop is the client. If every hop is trusted, the leftmost entry is the client.

<span style="color: #e74c3c">**⚠️ Behind a proxy or load balancer that isn't on localhost, you must add it here.**</span> Otherwise its forwarded headers are ignored, every user resolves to the proxy's IP, and they all share one rate-limit bucket.

```typescript
// Kubernetes / cloud load balancer: trust the cluster's pod and node ranges by CIDR
const app = new YinzerFlow({
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '::1', '10.0.0.0/8', 'fd00::/8'],
  },
});
```

<aside>

Options: `string[]`, entries are exact IPs or CIDR ranges

- `['127.0.0.1', '::1']`: Localhost only (default; a reverse proxy on the same host)
- `['10.0.0.0/8']`: A private network range (Kubernetes pod network, cloud VPC, internal load balancer)
- `['192.168.1.10']`: One specific load balancer
- `['173.245.48.0/20', '2400:cb00::/32', ...]`: Your CDN's published ranges (for example Cloudflare's)
- 🔴 `['*']`: Trust every peer and every hop. **Spoofable**: any client can then set its own IP with `X-Forwarded-For`. It's an escape hatch for when the network in front of YinzerFlow already strips or overwrites these headers, never a default.
- IPv4-mapped peers (`::ffff:10.1.2.3`) match IPv4 entries. Entries are parsed once at startup, and a malformed entry (`'10.0.0.0/33'`, `'not-an-ip'`) throws then.
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

Header preference order for IP extraction. Headers are only consulted when the socket peer is in `trustedProxies`; from any other peer none of them are read. `X-Forwarded-For` is walked right to left past trusted proxies; the others are single-value headers, whose last entry is used as given by the trusted proxy.

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
- **Problem**: Anyone can send `X-Forwarded-For`, `X-Real-IP` or `True-Client-IP`. If those headers are believed, a client picks its own IP: it dodges rate limits with a fresh value per request, or poses as another client.
- **YinzerFlow Solution**: The socket peer decides. Headers are read only when the peer is a configured trusted proxy (exact IP or CIDR). `X-Forwarded-For` is then walked from the right, skipping trusted proxies, so entries a client prepended or appended are never taken as its address. This is the same model as express `trust proxy` and Fastify `trustProxy`.

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

### Every Request Has the Proxy's IP
- **Problem**: `request.ipAddress` is your load balancer's or ingress's address for every user, and all users share one rate-limit bucket
- **Cause**: The proxy connecting to YinzerFlow isn't in `trustedProxies`, so its `X-Forwarded-For` is ignored
- **Fix**: Add the proxy's address, or its network as a CIDR

```typescript
// ❌ Wrong - the ingress at 10.42.0.17 connects, but only localhost is trusted
ipSecurity: { trustedProxies: ['127.0.0.1'] }

// ✅ Correct - trust the network the ingress or load balancer connects from
ipSecurity: { trustedProxies: ['127.0.0.1', '10.0.0.0/8'] }
```

### Wrong Client IP Through Several Proxies
- **Problem**: A CDN in front of your load balancer, and `request.ipAddress` is a CDN edge address
- **Cause**: Only the load balancer is trusted, so the walk stops at the CDN's hop in `X-Forwarded-For`
- **Fix**: Trust every proxy in the path (the CDN's published ranges plus your load balancer's network)

```typescript
// CDN -> load balancer (10.0.0.0/8) -> YinzerFlow; X-Forwarded-For: <client>, <cdn edge>
ipSecurity: { trustedProxies: ['10.0.0.0/8', '173.245.48.0/20', '2400:cb00::/32'] }
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