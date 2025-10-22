# 📖 Core Concepts

YinzerFlow's core concepts provide the foundation for building HTTP APIs. This guide covers the Context object, Request handling, Response control, Routing system, and Hooks - the essential building blocks for any YinzerFlow application.

For detailed configuration examples and patterns, see [Configuration Guide](../configuration/configuration.md).

# ⚙️ Usage

## 🔧 Context Object

The Context object is the central interface for all YinzerFlow route handlers and hooks. It provides access to request data, response controls, and maintains request-scoped state throughout the request lifecycle.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Context is automatically provided to all handlers
app.get('/api/data', (ctx) => {
  // Access request data
  const { path, method, headers } = ctx.request;
  
  // Control response
  ctx.response.setStatusCode(200);
  
  // Store custom state
  ctx.state.user = { id: 1, name: 'John' };
  
  return { message: 'Success' };
});
```

### State Management

Request-scoped state data that persists throughout the request lifecycle.

```typescript
app.get('/api/users', async (ctx) => {
  // Store custom data in state
  ctx.state.user = { id: 1, name: 'John' };
  ctx.state.requestId = generateRequestId();
  ctx.state.timestamp = Date.now();
  
  // Access the data later
  console.log(ctx.state.user.name);        // "John"
  console.log(ctx.state.requestId);        // "req-123"
  console.log(ctx.state.timestamp);        // 1703123456789
  
  return { users: ['John', 'Jane'] };
});
```

## 🔧 Request Object

YinzerFlow provides a comprehensive request object containing parsed headers, body, query parameters, route parameters, and metadata with built-in security protections.

```typescript
app.get('/api/users/:id', ({ request }) => {
  // Access route parameters
  const userId = request.params.id;
  
  // Access query parameters
  const includeProfile = request.query.include_profile;
  
  // Access headers
  const contentType = request.headers['content-type'];
  const authorization = request.headers['authorization'];
  
  // Access request body
  const userData = request.body;
  
  // Access raw body for manual parsing when needed
  const rawBody = request.rawBody;

  const clientIp = request.ipAddress;
  
  return {
    message: 'Request processed successfully',
    userId,
    includeProfile,
    contentType,
    hasAuth: !!authorization,
    receivedData: userData
  };
});
```

### Type Safety

Request data is type-safe through TypeScript generics.

```typescript
// Custom types for specific endpoints
interface UserCreateRequest extends HandlerCallbackGenerics {
  body: { name: string; email: string; age: number };
  query: { page: string; limit: string };
  params: { id: string };
}

const createUser: HandlerCallback<UserCreateRequest> = async (ctx) => {
  // Fully typed!
  const { name, email, age } = ctx.request.body; // Type: { name: string; email: string; age: number }
  const { page, limit } = ctx.request.query;     // Type: { page: string; limit: string }
  const { id } = ctx.request.params;             // Type: { id: string }
  
  return { success: true, user: { name, email, age, id } };
};
```

## 🔧 Response Object

YinzerFlow provides a powerful response object for controlling HTTP responses with automatic content type detection, header validation, and built-in security protections.

```typescript
app.get('/api/users/:id', ({ response }) => {
  // Set successful status code
  response.setStatusCode(200);
  
  // Add custom headers
  response.addHeaders({
    'X-User-ID': userId,
    'Cache-Control': 'max-age=3600',
    'X-API-Version': '1.0'
  });
  
  // Return JSON response body (Content-Type automatically set)
  return {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com',
    timestamp: new Date().toISOString()
  };
});
```

### Security Headers

Automatic security headers are added to every response by default.

```typescript
// Security headers are automatically added
app.get('/api/data', ({ response }) => {
  // Additional security headers can be added
  response.addHeaders({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  return { message: 'Secure response' };
});
```

## 🔧 Routing System

YinzerFlow provides a powerful and flexible routing system with support for HTTP methods, route parameters, query parameters, hooks, and route grouping.

```typescript
// Basic route registration
app.get('/api/users', (ctx) => {
  return { message: 'Users endpoint' };
});

// Route parameters
app.get('/users/:id', ({ request }) => {
  const userId = request.params.id;
  return { userId };
});

// Multiple parameters
app.get('/users/:id/posts/:postId', ({ request }) => {
  const { id, postId } = request.params;
  return { userId: id, postId };
});

// Route groups with hooks
app.group('/api/v1', (api) => {
  api.get('/users', () => ({ users: [] }));
  api.post('/users', () => ({ created: true }));
}, {
  beforeHooks: [
    async (ctx) => {
      ctx.state.apiVersion = 'v1';
    }
  ],
  afterHooks: [
    async (ctx) => {
      ctx.response.addHeaders({
        'X-API-Version': 'v1.0.0'
      });
    }
  ]
});
```

### Available HTTP Methods

```typescript
app.get('/users', handler);     // GET requests
app.post('/users', handler);    // POST requests
app.put('/users/:id', handler); // PUT requests
app.patch('/users/:id', handler); // PATCH requests
app.delete('/users/:id', handler); // DELETE requests
app.head('/users', handler);    // HEAD requests
app.options('/users', handler); // OPTIONS requests
```

## 🔧 Hooks System

YinzerFlow provides a comprehensive hooks system for middleware, authentication, logging, and cross-cutting concerns. Hooks execute in a specific order and can be applied globally or to specific routes.

### Global Hooks

Global hooks run for every request and are perfect for authentication, logging, and response modification.

```typescript
// Global authentication hook
app.beforeAll([
  async (ctx) => {
    const token = ctx.request.headers.authorization;
    if (token) {
      const user = await validateToken(token);
      ctx.state.user = user;
      ctx.state.isAuthenticated = true;
    }
  }
]);

// Global logging hook
app.beforeAll([
  async (ctx) => {
    ctx.state.requestId = generateRequestId();
    ctx.state.startTime = Date.now();
    
    console.log(`Request ${ctx.state.requestId} to ${ctx.request.path}`);
  }
], {
  routesToExclude: ['/health', '/metrics'] // Skip logging for health checks
});

// Global response modification hook
app.afterAll([
  async (ctx) => {
    // Add response headers based on state
    if (ctx.state.requestId) {
      ctx.response.addHeaders({
        'X-Request-ID': ctx.state.requestId,
        'X-Processing-Time': `${Date.now() - ctx.state.startTime}ms`
      });
    }
    
    // Log response
    console.log(`Request ${ctx.state.requestId} completed with status ${ctx.response.statusCode}`);
  }
]);
```

### Route-Specific Hooks

Route-specific hooks run only for specific routes and can be applied to individual routes or route groups.

```typescript
// Individual route with hooks
app.get('/api/users/:id', 
  // beforeHooks
  [
    async (ctx) => {
      ctx.state.requiresAuth = true;
      console.log(`Accessing user ${ctx.request.params.id}`);
    }
  ],
  // route handler
  async (ctx) => {
    const user = await getUserById(ctx.request.params.id);
    return { user };
  },
  // afterHooks
  {
    afterHooks: [
      async (ctx) => {
        console.log(`User ${ctx.request.params.id} accessed successfully`);
      }
    ]
  }
);

// Route group with shared hooks
app.group('/api/v1', (api) => {
  api.get('/users', () => ({ users: [] }));
  api.post('/users', () => ({ created: true }));
}, {
  beforeHooks: [
    async (ctx) => {
      ctx.state.apiVersion = 'v1';
      ctx.state.requiresAuth = true;
    }
  ],
  afterHooks: [
    async (ctx) => {
      ctx.response.addHeaders({
        'X-API-Version': 'v1.0.0'
      });
    }
  ]
});
```

### Hook Execution Order

Hooks execute in a specific order for predictable behavior:

1. **Global beforeAll hooks** (in registration order)
2. **Group beforeHooks** (parent groups first, then child groups)
3. **Route-specific beforeHooks** (in registration order)
4. **Route handler**
5. **Route-specific afterHooks** (in registration order)
6. **Group afterHooks** (child groups first, then parent groups)
7. **Global afterAll hooks** (in registration order)

```typescript
// Example showing execution order
app.beforeAll([() => console.log('1. Global beforeAll')]);
app.beforeAll([() => console.log('2. Global beforeAll 2')]);

app.group('/api', (api) => {
  api.get('/test', 
    [() => console.log('4. Route beforeHook')],
    () => {
      console.log('5. Route handler');
      return { message: 'success' };
    },
    {
      afterHooks: [() => console.log('6. Route afterHook')]
    }
  );
}, {
  beforeHooks: [() => console.log('3. Group beforeHook')],
  afterHooks: [() => console.log('7. Group afterHook')]
});

app.afterAll([() => console.log('8. Global afterAll')]);
app.afterAll([() => console.log('9. Global afterAll 2')]);

// Output order: 1, 2, 3, 4, 5, 6, 7, 8, 9
```

### Hook Options

Hooks support configuration options for selective execution:

```typescript
// Hook options for selective execution
interface HookOptions {
  routesToInclude?: string[];  // Only run for specific routes
  routesToExclude?: string[];  // Skip for specific routes
}

// Example: Authentication hook that skips public routes
app.beforeAll([
  async (ctx) => {
    const token = ctx.request.headers.authorization;
    if (!token) {
      ctx.response.setStatusCode(401);
      return { error: 'Authentication required' };
    }
    
    const user = await validateToken(token);
    ctx.state.user = user;
  }
], {
  routesToExclude: ['/health', '/metrics', '/public/*']
});
```

# ✨ Best Practices

- **Use TypeScript generics** for type-safe request/response data access
- **Validate request data** before processing
- **Set appropriate status codes** for different operations (200, 201, 404, 500)
- **Use meaningful headers** for caching, security, and API versioning
- **Organize routes with groups** - Group related endpoints together
- **Use hooks for shared logic** - Authentication, logging, validation
- **Keep state minimal** - only store data that's actually needed
- **Handle errors gracefully** - Use try-catch and proper error responses

# 💻 Examples

### Production API

**Use Case:** Secure API with comprehensive request/response handling and organized routing

**Description:** Production-ready implementation with TypeScript generics, authentication, validation, error handling, and organized route structure for maximum security and maintainability.

```typescript
import { YinzerFlow } from 'yinzerflow';
import type { HandlerCallback } from 'yinzerflow';

// Define custom context types
interface AuthContext extends HandlerCallbackGenerics {
  body: { username: string; password: string };
  response: { token: string; user: User };
  state: {
    user: User;
    permissions: string[];
    requestId: string;
    session: Session;
  };
}

const app = new YinzerFlow({ port: 3000 });

// Global authentication middleware
const authMiddleware: HandlerCallback = async (ctx) => {
  const token = ctx.request.headers.authorization;
  if (!token) {
    ctx.response.setStatusCode(401);
    return { error: 'Authentication required' };
  }
  
  const user = await validateToken(token);
  ctx.state.user = user;
  ctx.state.isAuthenticated = true;
};

// Global logging middleware
const loggingMiddleware: HandlerCallback = async (ctx) => {
  ctx.state.requestId = generateRequestId();
  ctx.state.startTime = Date.now();
  
  console.log(`[${ctx.state.requestId}] ${ctx.request.method} ${ctx.request.path}`);
};

// Global hooks
app.beforeAll([loggingMiddleware]);
app.afterAll([
  async (ctx) => {
    const processingTime = Date.now() - ctx.state.startTime;
    ctx.response.addHeaders({
      'X-Request-ID': ctx.state.requestId,
      'X-Processing-Time': `${processingTime}ms`
    });
  }
]);

// Custom error handler
app.onError(async (ctx, error) => {
  console.error(`[${ctx.state.requestId}] Error:`, error);
  
  ctx.response.setStatusCode(500);
  return {
    error: 'Internal server error',
    requestId: ctx.state.requestId,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  };
});

// API v1 routes
app.group('/api/v1', (api) => {
  // Public routes
  api.get('/health', async (ctx) => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });
  
  // User routes
  api.group('/users', (users) => {
    // Get all users
    users.get('/', async (ctx) => {
      const users = await getAllUsers();
      return { users, count: users.length };
    });
    
    // Get user by ID
    users.get('/:userId', async (ctx) => {
      const { userId } = ctx.request.params;
      
      // Validate UUID format
      if (!isValidUUID(userId)) {
        ctx.response.setStatusCode(400);
        return { error: 'Invalid user ID format' };
      }
      
      const user = await getUserById(userId);
      if (!user) {
        ctx.response.setStatusCode(404);
        return { error: 'User not found' };
      }
      
      return { user };
    });
    
    // Create user
    users.post('/', async (ctx) => {
      const userData = ctx.request.body as { name: string; email: string };
      
      // Validate required fields
      if (!userData.name || !userData.email) {
        ctx.response.setStatusCode(400);
        return { error: 'Name and email are required' };
      }
      
      const user = await createUser(userData);
      
      ctx.response.setStatusCode(201);
      ctx.response.addHeaders({
        'Location': `/api/v1/users/${user.id}`,
        'X-User-ID': user.id,
        'X-API-Version': 'v1.0.0',
        'Cache-Control': 'no-cache'
      });
      
      return { user };
    });
    
    // Update user
    users.put('/:userId', authMiddleware, async (ctx) => {
      const { userId } = ctx.request.params;
      const updateData = ctx.request.body as { name?: string; email?: string };
      
      const user = await updateUser(userId, updateData);
      if (!user) {
        ctx.response.setStatusCode(404);
        return { error: 'User not found' };
      }
      
      return { user };
    });
    
    // Delete user
    users.delete('/:userId', authMiddleware, async (ctx) => {
      const { userId } = ctx.request.params;
      
      const deleted = await deleteUser(userId);
      if (!deleted) {
        ctx.response.setStatusCode(404);
        return { error: 'User not found' };
      }
      
      ctx.response.setStatusCode(204);
      return; // No content for successful deletion
    });
  });
});

await app.listen();
```

### Dev API

**Use Case:** Development server with extensive debugging and testing capabilities

**Description:** Development configuration with comprehensive logging, debug routes, and simplified error handling for easier development and testing.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Development logging middleware
const devLoggingMiddleware: HandlerCallback = async (ctx) => {
  ctx.state.requestId = generateRequestId();
  ctx.state.timestamp = Date.now();
  
  console.log('=== Request Debug Info ===');
  console.log(`Request ID: ${ctx.state.requestId}`);
  console.log(`Method: ${ctx.request.method}`);
  console.log(`Path: ${ctx.request.path}`);
  console.log(`Headers:`, ctx.request.headers);
  console.log(`Query:`, ctx.request.query);
  console.log(`Params:`, ctx.request.params);
  console.log(`Body:`, ctx.request.body);
};

// Global development hooks
app.beforeAll([devLoggingMiddleware]);
app.afterAll([
  async (ctx) => {
    const processingTime = Date.now() - ctx.state.timestamp;
    
    ctx.response.addHeaders({
      'X-Debug-Mode': 'true',
      'X-Request-ID': ctx.state.requestId,
      'X-Processing-Time': `${processingTime}ms`,
      'X-Server-Version': 'YinzerFlow Dev'
    });
    
    console.log(`[${ctx.state.requestId}] Response sent in ${processingTime}ms`);
  }
]);

// Debug routes
app.get('/debug', async (ctx) => {
  return {
    message: 'Debug information',
    request: {
      method: ctx.request.method,
      path: ctx.request.path,
      headers: ctx.request.headers,
      query: ctx.request.query,
      params: ctx.request.params,
      body: ctx.request.body,
      ipAddress: ctx.request.ipAddress
    },
    state: ctx.state,
    timestamp: new Date().toISOString()
  };
});

// Echo route for testing
app.post('/echo', async (ctx) => {
  return {
    message: 'Echo response',
    received: {
      method: ctx.request.method,
      path: ctx.request.path,
      headers: ctx.request.headers,
      body: ctx.request.body,
      query: ctx.request.query,
      params: ctx.request.params
    },
    timestamp: new Date().toISOString()
  };
});

// Test different HTTP methods
app.get('/test/:type', async (ctx) => {
  const { type } = ctx.request.params;
  
  switch (type) {
    case 'json':
      return { message: 'JSON response', type: 'object' };
    case 'text':
      return 'Plain text response';
    case 'error':
      throw new Error('Test error');
    default:
      return { message: 'Default response', availableTypes: ['json', 'text', 'error'] };
  }
});

// Test route parameters
app.get('/test/params/:id/:name', async (ctx) => {
  const { id, name } = ctx.request.params;
  return { id, name, message: 'Parameters received' };
});

// Test query parameters
app.get('/test/query', async (ctx) => {
  const { q, limit, page } = ctx.request.query;
  return {
    query: q,
    limit: parseInt(limit || '10'),
    page: parseInt(page || '1'),
    message: 'Query parameters received'
  };
});

// Test route groups
app.group('/test', (test) => {
  test.get('/group', async (ctx) => {
    return { message: 'Group route accessed' };
  });
  
  test.group('/nested', (nested) => {
    nested.get('/route', async (ctx) => {
      return { message: 'Nested group route accessed' };
    });
  });
});

await app.listen();
```

## 🚀 Performance Notes

- **Automatic parsing**: Request data is parsed once and cached
- **Type safety**: TypeScript generics provide compile-time type checking with zero runtime overhead
- **Memory efficiency**: State and request/response objects are automatically garbage collected after each request completes
- **O(1) route lookup**: Exact routes use hash map for constant time lookup
- **Pre-compiled regex**: Parameterized routes use pre-compiled regex for fast matching
- **Hook optimization**: Hooks are executed efficiently with minimal overhead
- **Request isolation**: Each request gets its own isolated context that's cleaned up automatically

## 🔒 Security Notes

YinzerFlow implements several security measures for core concepts:

### 🛡️ Request Isolation
- **Problem**: State data could leak between requests, allowing one user to access another user's data
- **YinzerFlow Solution**: Each request gets its own isolated state object that's automatically cleaned up

### 🛡️ RFC 7230 Header Compliance
- **Problem**: Invalid header names can bypass security filters and cause parsing inconsistencies
- **YinzerFlow Solution**: Strict validation against RFC 7230 specification - only valid header characters are allowed

### 🛡️ CRLF Injection Prevention
- **Problem**: Injecting carriage return (`\r`) or line feed (`\n`) characters in header values can allow attackers to inject additional headers or even HTTP response splitting attacks
- **YinzerFlow Solution**: Comprehensive validation in `validateResponseHeaderValue()` detects and blocks:
  - CRLF characters (`\r`, `\n`) in header values
  - Suspicious injection patterns like `value\r\nSet-Cookie:`
  - Double CRLF patterns (`\r\n\r\n`) that could inject HTTP responses
  - HTTP response line injection attempts
  - All validation happens before headers are set, preventing injection attacks

### 🛡️ Route Parameter Validation
- **Problem**: Malicious route parameters can cause injection attacks or bypass security controls
- **YinzerFlow Solution**: Automatic parameter validation and sanitization prevents injection attacks

### 🛡️ Path Traversal Protection
- **Problem**: Directory traversal attacks through URL paths can access unauthorized files
- **YinzerFlow Solution**: Comprehensive path normalization and validation prevents traversal attempts

### 🛡️ Body Parsing Protection
- **Problem**: Malformed request bodies can cause parsing errors, memory exhaustion, or security vulnerabilities
- **YinzerFlow Solution**: Comprehensive body parsing security with size limits, validation, and protection against common attacks

### 🛡️ Automatic Security Headers
- **Problem**: Missing security headers leave applications vulnerable to clickjacking, MIME sniffing, and XSS attacks
- **YinzerFlow Solution**: Automatically adds essential security headers to every response unless explicitly overridden by the application

### 🛡️ Hook Execution Security
- **Problem**: Malicious hooks can cause security vulnerabilities or bypass controls
- **YinzerFlow Solution**: Isolated hook execution with graceful error handling and validation

## 🔧 Troubleshooting

### State Not Persisting Between Middleware
- **Problem**: State data set in middleware not available in route handler
- **Fix**: Ensure middleware runs before route handler

```typescript
// ❌ Wrong - middleware runs after route handler
app.get('/api/users', getUserHandler, authMiddleware);

// ✅ Correct - middleware runs before route handler
app.get('/api/users', authMiddleware, getUserHandler);
```

### Request Body Not Parsed
- **Problem**: `request.body` is undefined or not parsed correctly
- **Fix**: Check Content-Type header and body parser configuration

```typescript
// ❌ Wrong - missing Content-Type header
fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'John' })
});

// ✅ Correct - include Content-Type header
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
});
```

### Response Headers Not Set
- **Problem**: Headers not appearing in response
- **Fix**: Check header names and values for validity

```typescript
// ❌ Wrong - invalid header name
response.addHeaders({ 'Invalid@Header': 'value' });

// ✅ Correct - valid header name
response.addHeaders({ 'X-Custom-Header': 'value' });
```

### Route Not Found
- **Problem**: Route not matching requests
- **Fix**: Check route path and parameter names

```typescript
// ❌ Wrong - route not found
app.get('/users/:id', handler);
// Request: GET /users/123/extra

// ✅ Correct - match the exact path
app.get('/users/:id', handler);
// Request: GET /users/123
```

### TypeScript Errors with Request Data
- **Problem**: TypeScript errors when accessing request properties
- **Fix**: Use proper generic typing

```typescript
// ❌ Wrong - no type safety
const handler: HandlerCallback = async (ctx) => {
  const user = ctx.request.body; // Type: unknown
};

// ✅ Correct - type-safe request access
interface UserRequest extends HandlerCallbackGenerics {
  body: { name: string; email: string };
}

const handler: HandlerCallback<UserRequest> = async (ctx) => {
  const { name, email } = ctx.request.body; // Type: { name: string; email: string }
};
```
