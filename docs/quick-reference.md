# Quick Reference

This quick reference contains the most common patterns and examples for YinzerFlow. For detailed documentation, see the full documentation sections.

## Installation & Setup

```bash
# Install
npm install yinzerflow

# Basic setup
import { YinzerFlow } from 'yinzerflow';
const app = new YinzerFlow({ port: 3000 });
await app.listen();
```

## Basic Routes

```typescript
// GET route
app.get('/api/users', (ctx) => {
  return { users: ['John', 'Jane'] };
});

// POST route with body
app.post('/api/users', (ctx) => {
  const userData = ctx.request.body;
  return { message: 'User created', data: userData };
});

// Route with parameters
app.get('/api/users/:id', (ctx) => {
  const userId = ctx.request.params.id;
  return { userId, name: 'John Doe' };
});

// Route with query parameters
app.get('/api/search', (ctx) => {
  const { q, limit } = ctx.request.query;
  return { search: q, limit: parseInt(limit || '10') };
});
```

## HTTP Methods

```typescript
app.get('/api/users', handler);      // GET
app.post('/api/users', handler);     // POST  
app.put('/api/users/:id', handler);  // PUT
app.patch('/api/users/:id', handler); // PATCH
app.delete('/api/users/:id', handler); // DELETE
app.options('/api/users', handler);  // OPTIONS
app.head('/api/users', handler);     // HEAD (or auto-registered with GET)
```

## Route Groups

```typescript
app.group('/api/v1', (group) => {
  group.get('/users', handler);
  group.post('/users', handler);
  group.get('/users/:id', handler);
}, {
  beforeHooks: [authHook]
});
```

## Hooks

```typescript
// Route-specific hooks
app.post('/api/users', handler, {
  beforeHooks: [authHook, logHook],
  afterHooks: [responseHook]
});

// Global hooks
app.beforeAll([globalAuthHook]);
app.afterAll([globalLogHook]);
app.onError(errorHandler);
app.onNotFound(notFoundHandler);
```

## Request Data

```typescript
app.post('/api/users', ({ request }) => {
  // Body data
  const userData = request.body;
  
  // URL parameters
  const userId = request.params.id;
  
  // Query parameters
  const { page, limit } = request.query;
  
  // Headers
  const token = request.headers['authorization'];
  
  // Client IP
  const clientIp = request.ipAddress;
  
  // Request info
  const { method, path, url } = request;
});
```

## Response Control

```typescript
app.post('/api/users', ({ response }) => {
  // Set status code
  response.setStatusCode(201);
  
  // Add headers
  response.addHeaders({
    'X-User-ID': '123',
    'Content-Type': 'application/json'
  });
  
  // Return data
  return { message: 'User created' };
});
```

## Error Handling

```typescript
// Global error handler
app.onError(({ response }, error) => {
  response.setStatusCode(500);
  return { error: 'Internal server error' };
});

// Route error handling
app.get('/api/users/:id', ({ request }) => {
  const userId = request.params.id;
  if (!userId) {
    throw new Error('User ID required');
  }
  return { userId };
});
```

## Common Configurations

### Basic API
```typescript
const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com']
  }
});
```

### Production API
```typescript
const app = new YinzerFlow({
  port: 443,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'],
    credentials: true
  },
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      allowPrototypeProperties: false
    }
  },
  ipSecurity: {
    trustedProxies: ['127.0.0.1'],
    detectSpoofing: true
  }
});
```

### File Upload Service
```typescript
const app = new YinzerFlow({
  port: 3000,
  bodyParser: {
    fileUploads: {
      maxFileSize: 10485760, // 10MB
      maxFiles: 10,
      allowedExtensions: ['.jpg', '.png', '.pdf']
    }
  }
});
```

## TypeScript Support

```typescript
interface UserBody {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
}

const createUser: HandlerCallback<{
  body: UserBody;
  response: UserResponse;
}> = ({ request }) => {
  const userData = request.body; // Typed as UserBody
  return {
    id: 'user-123',
    name: userData.name,
    email: userData.email
  }; // Typed as UserResponse
};

app.post('/api/users', createUser);
```

## Common Patterns

### Authentication Hook
```typescript
const authHook = ({ request, response }) => {
  const token = request.headers['authorization'];
  if (!token) {
    response.setStatusCode(401);
    return { error: 'Unauthorized' };
  }
};
```

### Logging Hook
```typescript
const logHook = ({ request }) => {
  console.log(`${request.method} ${request.path} - ${request.ipAddress}`);
};
```

### Rate Limiting Hook
```typescript
const rateLimitHook = ({ request, response }) => {
  const clientIp = request.ipAddress;
  const requests = getRequestCount(clientIp);
  
  if (requests > 100) {
    response.setStatusCode(429);
    return { error: 'Too many requests' };
  }
};
```

### Validation Hook
```typescript
const validateUserData = ({ request, response }) => {
  const userData = request.body;
  
  if (!userData.name || !userData.email) {
    response.setStatusCode(400);
    return { error: 'Name and email required' };
  }
};
```

## File Organization

### routes/users.ts
```typescript
import type { YinzerFlow } from 'yinzerflow';

export const registerUserRoutes = (app: YinzerFlow) => {
  app.get('/api/users', getAllUsers);
  app.post('/api/users', createUser);
  app.get('/api/users/:id', getUserById);
  app.put('/api/users/:id', updateUser);
  app.delete('/api/users/:id', deleteUser);
};
```

### Main app
```typescript
import { YinzerFlow } from 'yinzerflow';
import { registerUserRoutes } from './routes/users';

const app = new YinzerFlow({ port: 3000 });
registerUserRoutes(app);
await app.listen();
```

## Security Checklist

- [ ] CORS configured with specific origins
- [ ] Body parsing limits set appropriately
- [ ] File upload restrictions in place
- [ ] IP security configured for infrastructure
- [ ] Error handling prevents information leakage
- [ ] Authentication hooks implemented
- [ ] Rate limiting configured
- [ ] HTTPS enabled (production)
- [ ] Security headers configured
- [ ] Logging configured to avoid sensitive data

## Common Issues

### CORS Errors
```typescript
cors: {
  enabled: true,
  origin: ['https://yourdomain.com'], // Specific origin
  credentials: true // If using cookies
}
```

### File Upload Issues
```typescript
bodyParser: {
  fileUploads: {
    maxFileSize: 10485760, // 10MB
    allowedExtensions: ['.jpg', '.png', '.pdf']
  }
}
```

### IP Address Issues
```typescript
ipSecurity: {
  trustedProxies: ['127.0.0.1', '192.168.1.10'],
  headerPreference: ['x-forwarded-for', 'x-real-ip']
}
```

## Documentation Sections

- **[Getting Started](./start-here.md)** - Installation and basic setup
- **[Routes](./core/routes.md)** - Complete routing system
- **[Context Object](./core/context.md)** - Request/response interface
- **[Request Object](./core/request.md)** - Request data access
- **[Response Object](./core/response.md)** - Response control
- **[Error Handling](./core/error-handling.md)** - Error management
- **[Examples](./core/examples.md)** - Common patterns and examples
- **[Security Overview](./security/security-overview.md)** - Security features
- **[Configuration Patterns](./configuration/configuration-patterns.md)** - Configuration examples
- **[Advanced Configuration](./configuration/advanced-configuration-options.md)** - Complete configuration reference 