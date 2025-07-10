# CORS (Cross-Origin Resource Sharing)

YinzerFlow provides built-in CORS support to handle cross-origin requests securely and efficiently.

## Configuration

Configure CORS in your YinzerFlow setup:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  cors: {
    enabled: true,
    origin: 'https://myapp.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
    preflightContinue: false,
  }
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable/disable CORS |
| `origin` | `string \| string[] \| RegExp \| function \| '*'` | `'*'` | Allowed origins |
| `credentials` | `boolean` | `false` | Allow credentials (cookies, auth headers) |
| `methods` | `string[]` | `['GET', 'POST', 'PUT', 'DELETE']` | Allowed HTTP methods |
| `allowedHeaders` | `string \| string[]` | `['Content-Type', 'Authorization']` | Allowed request headers |
| `exposedHeaders` | `string[]` | `[]` | Headers exposed to client |
| `maxAge` | `number` | `86400` | Preflight cache duration (seconds) |
| `optionsSuccessStatus` | `number` | `204` | Status code for successful OPTIONS |
| `preflightContinue` | `boolean` | `false` | Pass control to next handler after preflight |

## Common Use Cases

- **Secure Web Applications**: Configure CORS for authenticated browser apps with specific domains and credentials
- **Public APIs**: Enable broad access for public data APIs while maintaining security controls
- **Development Environments**: Set up flexible CORS for local development with multiple frontend ports
- **Microservices**: Configure cross-service communication with controlled origin validation
- **Mobile App Backends**: Handle native mobile app requests with appropriate CORS settings
- **Third-Party Integrations**: Allow controlled access from partner domains with validation functions

## Origin Configuration Examples

### Wildcard (Public APIs)
```typescript
cors: {
  enabled: true,
}
```

### Single Domain
```typescript
cors: {
  enabled: true,
  origin: 'https://myapp.com',
  credentials: true,
}
```

### Multiple Domains
```typescript
cors: {
  enabled: true,
  origin: [
    'https://myapp.com',
    'https://admin.myapp.com',
    'https://mobile.myapp.com'
  ],
  credentials: true,
}
```

### RegExp Pattern
```typescript
cors: {
  enabled: true,
  origin: /^https:\/\/.*\.myapp\.com$/,
  credentials: true,
}
```

### Dynamic Function
```typescript
cors: {
  enabled: true,
  origin: (origin, request): boolean => {
    // Custom validation logic
    const allowedDomains = ['myapp.com', 'partner.com'];
    if (!origin) return false; // Reject: no origin header
    
    try {
      const url = new URL(origin);
      return allowedDomains.includes(url.hostname); // true = allow, false = reject
    } catch {
      return false; // Reject: malformed URL
    }
  },
  credentials: true,
}
```

**Function Return Values:**
- `true` - Allow the origin (request proceeds with CORS headers)
- `false` - Reject the origin (403 Forbidden response)

## Request Flow

### Simple Requests
For simple requests (GET, POST with basic content types), CORS headers are added directly:

```
Client Request:
Origin: https://myapp.com

Server Response:
Access-Control-Allow-Origin: https://myapp.com
Access-Control-Allow-Credentials: true
```

### Preflight Requests
For complex requests, browsers send an OPTIONS preflight:

```
Client Preflight:
OPTIONS /api/data HTTP/1.1
Origin: https://myapp.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, Authorization

Server Preflight Response:
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://myapp.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

## Error Handling

YinzerFlow automatically handles CORS errors

## Security Considerations

YinzerFlow implements several security measures to prevent common CORS vulnerabilities:

### 🛡️ Origin Validation Enforcement
- **Problem**: Many frameworks validate origins but don't enforce the validation result
- **YinzerFlow Solution**: Origin validation results are actually used - unauthorized requests get 403 Forbidden

### 🛡️ No Origin Echo-back for Wildcards
- **Problem**: Some implementations echo back the request origin when using wildcards, defeating CORS protection
- **YinzerFlow Solution**: Wildcard origins always return literal `'*'`, never echo back request origins

### 🛡️ Spec Compliance Enforcement
- **Problem**: CORS spec forbids `origin: '*'` with `credentials: true`, but many frameworks allow this dangerous combination
- **YinzerFlow Solution**: This combination throws a security error at startup, preventing deployment of vulnerable configurations

### 🛡️ Proper Preflight Rejection
- **Problem**: Some frameworks set CORS headers even for rejected requests, or let request handlers override CORS rejections
- **YinzerFlow Solution**: Unauthorized preflight requests get 403 with no CORS headers, and the rejection cannot be overridden

### 🛡️ Case-Insensitive Origin Matching
- **Problem**: Inconsistent case handling can lead to bypass attempts
- **YinzerFlow Solution**: All origin validation is case-insensitive but preserves original case in responses

### 🛡️ Malformed Origin Protection
- **Problem**: Malformed origins (like `javascript:`, `data:`, or invalid URLs) can cause security issues
- **YinzerFlow Solution**: All malformed origins are safely rejected with 403 status

### 🛡️ Function Validation Safety
- **Problem**: Custom origin validation functions might throw errors or behave unpredictably
- **YinzerFlow Solution**: Function results are safely coerced to boolean, preventing exceptions from bypassing security

### 🛡️ No Information Leakage
- **Problem**: Error responses might leak information about internal origins or configurations
- **YinzerFlow Solution**: Rejection responses only include the rejected origin, no internal configuration details

These security measures ensure YinzerFlow's CORS implementation follows security best practices and prevents common attack vectors while maintaining spec compliance. If you come up with any other security implementation's that hadn't been addressed, Please open a PR and follow our contribution guides.