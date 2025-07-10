# Security Overview

YinzerFlow implements a comprehensive security-first approach with built-in protections against common web vulnerabilities. This overview covers the key security features and how they work together to protect your applications.

## Security Architecture

YinzerFlow's security is built on multiple layers of protection:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Route Security│  │  Error Handling │  │   Logging   │ │
│  │   - Validation  │  │   - Catching    │  │   - Audit   │ │
│  │   - Sanitization│  │   - Reporting   │  │   - Monitor │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Framework Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Body Parsing   │  │      CORS       │  │ IP Security │ │
│  │  - DoS Protection│  │  - Origin Valid │  │ - Spoofing  │ │
│  │  - Size Limits  │  │  - Headers      │  │ - Detection │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Network Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   HTTP Headers  │  │  Request Size   │  │  Timeouts   │ │
│  │   - Validation  │  │   - Limits      │  │  - Limits   │ │
│  │   - Sanitization│  │   - Protection  │  │  - Graceful │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Security Features

### 🛡️ Body Parsing Security
**Protection**: DoS attacks, prototype pollution, memory exhaustion
**Implementation**: Configurable size limits, depth validation, type checking
**Documentation**: [Body Parsing Security](./body-parsing.md)

```typescript
const secureApp = new YinzerFlow({
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB limit
      maxDepth: 10,    // Prevent stack overflow
      allowPrototypeProperties: false, // Block prototype pollution
      maxKeys: 1000    // Prevent memory exhaustion
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB per file
      blockedExtensions: ['.exe', '.bat', '.cmd'], // Block dangerous files
      maxFiles: 10
    }
  }
});
```

### 🛡️ CORS Security
**Protection**: Cross-origin attacks, unauthorized access
**Implementation**: Origin validation, header sanitization, preflight handling
**Documentation**: [CORS Security](./cors.md)

```typescript
const secureApp = new YinzerFlow({
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'], // Specific origins only
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});
```

### 🛡️ IP Security
**Protection**: IP spoofing, load balancer bypass
**Implementation**: Trusted proxy validation, chain length limits
**Documentation**: [IP Security](./ip-security.md)

```typescript
const secureApp = new YinzerFlow({
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '192.168.1.10'],
    allowPrivateIps: true,
    headerPreference: ['x-forwarded-for', 'x-real-ip'],
    maxChainLength: 10,
    detectSpoofing: true
  }
});
```

### 🛡️ Route Security
**Protection**: Path traversal, parameter injection, method confusion
**Implementation**: Parameter validation, path normalization, method validation
**Documentation**: [Route Security](../core/routes.md#security-considerations)

```typescript
// Automatic protection against:
// - Path traversal: /api/../etc/passwd
// - Parameter injection: /api/users/'; DROP TABLE users; --
// - Method confusion: Invalid HTTP methods
app.get('/api/users/:id', ({ request }) => {
  const userId = request.params.id; // Automatically validated
  return { userId };
});
```

### 🛡️ Error Handling Security
**Protection**: Information leakage, error-based attacks
**Implementation**: Safe error responses, no stack traces in production
**Documentation**: [Error Handling Security](../core/error-handling.md)

```typescript
// Global error handler prevents information leakage
app.onError(({ response }, error) => {
  response.setStatusCode(500);
  return { error: 'Internal server error' }; // No sensitive details
});
```

### 🛡️ Logging Security
**Protection**: Log injection, sensitive data exposure
**Implementation**: Structured logging, sensitive data filtering
**Documentation**: [Logging Security](./logging.md)

```typescript
const secureApp = new YinzerFlow({
  logger: {
    level: 'info',
    sensitiveFields: ['password', 'token', 'secret'],
    maskPatterns: [/credit_card_\d+/, /ssn_\d+/]
  }
});
```

## Security Configuration Patterns

For detailed configuration examples and patterns, see [Configuration Patterns](../configuration/configuration-patterns.md).

### Security-First Configuration Principles

1. **Principle of Least Privilege**
   - Configure only the features you need
   - Use specific origins instead of wildcards
   - Limit file upload types and sizes
   - Restrict HTTP methods to those you use

2. **Defense in Depth**
   - Combine multiple security layers
   - Validate at both framework and application levels
   - Use hooks for additional validation
   - Implement custom security checks

3. **Secure by Default**
   - YinzerFlow's defaults are secure
   - Explicitly configure only when needed
   - Test security configurations thoroughly
   - Monitor for security events

4. **Regular Security Updates**
   - Keep YinzerFlow updated
   - Monitor security advisories
   - Review and update configurations
   - Test security features regularly

## Security Best Practices

For detailed security configuration examples and best practices, see [Configuration Patterns](../configuration/configuration-patterns.md).

### Key Security Principles

1. **Principle of Least Privilege** - Configure only what you need
2. **Defense in Depth** - Multiple security layers
3. **Secure by Default** - YinzerFlow's defaults are secure
4. **Regular Security Updates** - Keep configurations current

## Security Monitoring

### Built-in Security Logging
YinzerFlow automatically logs security events:

```typescript
// Automatic logging of:
// - CORS violations
// - Body parsing errors
// - IP spoofing attempts
// - Route validation failures
// - Security configuration errors
```

### Custom Security Monitoring
Add custom security monitoring with hooks:

```typescript
app.beforeAll([
  ({ request, response }) => {
    // Monitor for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//,           // Path traversal
      /<script>/i,        // XSS attempts
      /union\s+select/i,  // SQL injection
      /javascript:/i      // Protocol injection
    ];
    
    const url = request.url;
    const body = JSON.stringify(request.body);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body)) {
        console.warn('🚨 Suspicious request detected:', {
          ip: request.ipAddress,
          url: request.url,
          pattern: pattern.source
        });
        response.setStatusCode(400);
        return { error: 'Invalid request' };
      }
    }
  }
]);
```

## Security Testing

### Automated Security Testing
Test your security configuration:

```typescript
// Test body parsing limits
const testBodyLimits = async () => {
  const response = await fetch('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'x'.repeat(300000) }) // Exceeds 256KB limit
  });
  
  console.assert(response.status === 413, 'Body size limit not enforced');
};

// Test CORS configuration
const testCORS = async () => {
  const response = await fetch('http://localhost:3000/api/test', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://malicious.com' }
  });
  
  console.assert(response.status === 403, 'CORS origin validation not working');
};
```

## Security Checklist

Before deploying to production, verify:

- [ ] Body parsing limits configured appropriately
- [ ] CORS origins restricted to trusted domains
- [ ] IP security configured for your infrastructure
- [ ] File upload restrictions in place
- [ ] Error handling prevents information leakage
- [ ] Logging configured to avoid sensitive data exposure
- [ ] Security headers enabled
- [ ] HTTPS configured (if applicable)
- [ ] Security monitoring in place
- [ ] Regular security updates scheduled

## Getting Help

For detailed security documentation:
- **[Body Parsing](./body-parsing.md)** - File upload and JSON parsing security
- **[CORS](./cors.md)** - Cross-origin request security
- **[IP Security](./ip-security.md)** - Client IP validation and protection
- **[Logging](./logging.md)** - Secure logging practices
- **[Error Handling](../core/error-handling.md)** - Secure error handling patterns

For security issues or questions:
- Check the security documentation above
- Review the security configuration examples
- Test your security setup thoroughly
- Consider security implications of all custom code 