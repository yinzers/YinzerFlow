# IP Address Security

YinzerFlow provides comprehensive IP address validation and security protection against IP spoofing attacks, supporting multiple header formats with trusted proxy validation.

## Configuration

Configure IP security settings in your YinzerFlow application:

```typescript
const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '::1', '192.168.1.10'],
    allowPrivateIps: true,
    headerPreference: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
    maxChainLength: 10,
    detectSpoofing: true
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|-----|---|---|---|
| `trustedProxies` | `string[]` | `['127.0.0.1', '::1']` | List of trusted proxy IP addresses |
| `allowPrivateIps` | `boolean` | `true` | Allow private IP addresses (RFC 1918, etc.) |
| `headerPreference` | `string[]` | `['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'x-client-ip', 'true-client-ip']` | Header preference order |
| `maxChainLength` | `number` | `10` | Maximum IP chain length |
| `detectSpoofing` | `boolean` | `true` | Enable spoofing pattern detection |

## Examples

### Basic Example

Access client IP address with automatic security validation:

```typescript
app.get('/api/user-info', ({ request }) => {
  const clientIp = request.ipAddress;
  
  return {
    message: `Hello from ${clientIp}`,
    userAgent: request.headers['user-agent']
  };
});
```

### Advanced Example

Configure IP security for your application:

```typescript
app.post('/api/secure-endpoint', ({ request }) => {
  // YinzerFlow automatically applies IP security configuration
  const clientIp = request.ipAddress; // Uses configured IP security rules
  
  if (!clientIp) {
    return {
      error: 'Unable to determine client IP address',
      message: 'Request may be from untrusted proxy or invalid source'
    };
  }
  
  return {
    clientIp,
    message: 'Secure endpoint accessed successfully'
  };
});
```

## Common Use Cases

- **Load Balancer Integration**: Configure trusted proxies to get real client IPs behind Nginx, HAProxy, or cloud load balancers
- **CDN Support**: Handle Cloudflare and other CDN headers like `CF-Connecting-IP` with proper validation
- **Reverse Proxy Security**: Validate proxy chains to prevent IP spoofing in complex network topologies
- **Complex Infrastructure**: Use wildcard (`'*'`) for Kubernetes ingress, unknown CDN configurations, or dynamic proxy setups
- **Rate Limiting**: Get accurate client IPs for rate limiting and abuse prevention systems
- **Geolocation Services**: Ensure IP addresses are valid before passing to geolocation APIs
- **Security Logging**: Log real client IPs for security monitoring and incident response

### Load Balancer Behind Nginx

```typescript
const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ['192.168.1.10'], // Your Nginx server
    headerPreference: ['x-forwarded-for'],
    detectSpoofing: true
  }
});
```

### Cloudflare CDN Integration

```typescript
const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: [
      // Cloudflare IP ranges
      '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22'
    ],
    headerPreference: ['cf-connecting-ip', 'x-forwarded-for'],
    allowPrivateIps: false // Only real client IPs
  }
});
```

### High-Security Environment

```typescript
const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ['10.0.1.100'], // Only specific proxy
    maxChainLength: 2, // Short chains only
    detectSpoofing: true,
    allowPrivateIps: false
  }
});
```

### Complex Infrastructure (Unknown Proxies)

```typescript
const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ['*'], // Trust any proxy - useful for Kubernetes, unknown CDNs
    detectSpoofing: true, // Still detect attack patterns
    maxChainLength: 10,
    allowPrivateIps: false
  }
});
```

## Error Handling

YinzerFlow handles IP parsing errors gracefully and applies security validation automatically:

**Common behaviors:**
- Invalid IP formats result in empty `request.ipAddress` 
- Untrusted proxy chains are rejected when strict validation is enabled
- Spoofing patterns are detected and suspicious headers are ignored automatically
- Private IPs are filtered when `allowPrivateIps: false` is configured

```typescript
app.get('/api/user-location', ({ request }) => {
  const clientIp = request.ipAddress;
  
  if (!clientIp) {
    // YinzerFlow couldn't determine a valid, trusted IP
    return { 
      error: 'Unable to determine client location',
      message: 'IP address validation failed' 
    };
  }
  
  // Safe to use clientIp - YinzerFlow has validated it
  return await getLocationForIp(clientIp);
});
```

## Security Considerations

YinzerFlow implements several security measures to prevent IP spoofing attacks and ensure accurate client identification:

### 🛡️ Trusted Proxy Validation
- **Problem**: Attackers can spoof `X-Forwarded-For` headers to hide their real IP address or impersonate other clients
- **YinzerFlow Solution**: Only accepts forwarded headers from explicitly configured trusted proxy IPs, preventing spoofing from untrusted sources

#### How Trusted Proxies Work

When using `X-Forwarded-For` headers, YinzerFlow validates proxy chains by checking if the **rightmost IP** (the proxy that sent the request) is in your trusted proxies list:

```
X-Forwarded-For: 203.0.113.1, 198.51.100.1, 127.0.0.1
                 ^client IP    ^proxy 1     ^proxy 2 (rightmost - must be trusted)
```

**Key Points:**
- **Only the rightmost IP needs to be trusted** - this is the proxy that directly sent the request to your server
- **Client IP is extracted** - YinzerFlow extracts the leftmost IP (203.0.113.1) as the real client
- **Chain validation** - If the rightmost IP isn't in your `trustedProxies` list, the entire header is rejected
- **Wildcard support** - Use `['*']` to trust any proxy (useful for Kubernetes/unknown infrastructure)

**Examples:**
```typescript
// ✅ Valid: 127.0.0.1 is trusted, extracts 203.0.113.1 as client
trustedProxies: ['127.0.0.1']
X-Forwarded-For: 203.0.113.1, 127.0.0.1

// ❌ Invalid: 192.168.1.1 is not trusted, header rejected
trustedProxies: ['127.0.0.1'] 
X-Forwarded-For: 203.0.113.1, 192.168.1.1

// ✅ Valid: Wildcard trusts any proxy
trustedProxies: ['*']
X-Forwarded-For: 203.0.113.1, any.proxy.ip
```

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

### 🛡️ Chain Length Limits
- **Problem**: Extremely long IP chains can cause DoS attacks through memory exhaustion or processing delays
- **YinzerFlow Solution**: Configurable maximum chain length prevents amplification attacks while allowing legitimate proxy chains

### 🛡️ Fallback Protection
- **Problem**: When strict validation fails, applications might fall back to unsafe IP extraction methods
- **YinzerFlow Solution**: Controlled fallback behavior that maintains security when trusted proxies are configured

### 🛡️ IPv6 Security
- **Problem**: IPv6 addresses have complex formats that can be exploited for parsing attacks or validation bypasses
- **YinzerFlow Solution**: Robust IPv6 validation including compression rules, zone identifiers, and IPv4-mapped addresses

These security measures ensure YinzerFlow's IP parsing implementation follows security best practices and prevents common attack vectors while maintaining compatibility with standard proxy configurations. 