# 📖 Error Handling

YinzerFlow provides comprehensive error handling with automatic error catching and custom error handlers. The framework automatically catches all errors thrown in route handlers, hooks, and middleware, ensuring your application never crashes due to unhandled exceptions.

For detailed configuration examples and patterns, see [Configuration Guide](../configuration/configuration.md).

# ⚙️ Usage

## 🎛️ Settings

### Automatic Error Catching — @default <span style="color: #2ecc71">`enabled`</span>

Error handling is automatically enabled and requires no configuration for basic usage.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Errors are automatically caught - no configuration needed
app.get('/api/users/:id', async ({ request }) => {
  const user = await database.findUser(request.params.id);
  if (!user) {
    throw new Error('User not found'); // Automatically handled
  }
  return user;
});
```

<aside>

Options: `automatic`

- Error handling is enabled automatically
- All errors in handlers, hooks, and middleware are caught
- Default error response: 500 Internal Server Error
- Automatic logging with Pittsburgh personality
</aside>

### Custom Error Handler — @default <span style="color: #2ecc71">`built-in`</span>

Register a custom error handler for all routes.

```typescript
app.onError((ctx, error) => {
  ctx.response.setStatusCode(500);
  return {
    success: false,
    message: 'Something went wrong',
    timestamp: new Date().toISOString()
  };
});
```

<aside>

Options: `HandlerCallback | built-in`

- `built-in`: Default error handler with logging
- Custom: User-defined error handler function
- Receives context and error parameters
- Must return response object
</aside>

### Custom Not Found Handler — @default <span style="color: #2ecc71">`built-in`</span>

Register a custom not-found handler for unmatched routes.

```typescript
app.onNotFound((ctx) => {
  ctx.response.setStatusCode(404);
  return {
    success: false,
    error: 'Route not found',
    path: ctx.request.path,
    method: ctx.request.method
  };
});
```

<aside>

Options: `HandlerCallback | built-in`

- `built-in`: Default 404 Not Found response
- Custom: User-defined not-found handler function
- Receives context parameter
- Must return response object
</aside>

# ✨ Best Practices

- **Use structured error responses** - Consistent error format across your API
- **Handle different error types** - Check error instances for specific handling
- **Log errors for debugging** - Use error handlers for logging and monitoring
- **Set appropriate status codes** - Use correct HTTP status codes for different errors
- **Sanitize error information** - Don't expose sensitive data to clients
- **Use async error handlers** - Error handlers can be async functions

# 💻 Examples

### Production API

**Use Case:** Production API with comprehensive error handling and monitoring

**Description:** Production-ready error handling with structured responses, error logging, monitoring integration, and comprehensive error type handling for maximum reliability and debugging capability.

```typescript
import { YinzerFlow } from 'yinzerflow';
import type { HandlerCallback } from 'yinzerflow';

// Custom error classes
class ValidationError extends Error {
  constructor(message: string, public details: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

class DatabaseError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class AuthenticationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

const app = new YinzerFlow({ port: 3000 });

// Production error handler with comprehensive error handling
app.onError(async (ctx, error) => {
  const requestId = ctx.state.requestId || 'unknown';
  const timestamp = new Date().toISOString();
  
  // Log detailed error information for monitoring
  const errorInfo = {
    requestId,
    timestamp,
    error: {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    },
    request: {
      method: ctx.request.method,
      path: ctx.request.path,
      ipAddress: ctx.request.ipAddress,
      userAgent: ctx.request.headers['user-agent']
    }
  };
  
  // Log to monitoring service (but don't expose to client)
  console.error('Application error:', errorInfo);
  
  // Handle different error types
  if (error instanceof ValidationError) {
    ctx.response.setStatusCode(400);
    return {
      success: false,
      error: 'Validation failed',
      details: error.details,
      requestId,
      timestamp
    };
  }
  
  if (error instanceof DatabaseError) {
    ctx.response.setStatusCode(503);
    return {
      success: false,
      error: 'Service temporarily unavailable',
      code: error.code,
      retryAfter: 60,
      requestId,
      timestamp
    };
  }
  
  if (error instanceof AuthenticationError) {
    ctx.response.setStatusCode(401);
    return {
      success: false,
      error: 'Authentication required',
      code: error.code,
      requestId,
      timestamp
    };
  }
  
  // Default error handling
  ctx.response.setStatusCode(500);
  return {
    success: false,
    error: 'Internal server error',
    requestId,
    timestamp,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : errorInfo.error.message
  };
});

// Custom not-found handler
app.onNotFound(async (ctx) => {
  const requestId = ctx.state.requestId || 'unknown';
  
  ctx.response.setStatusCode(404);
  return {
    success: false,
    error: 'Route not found',
    path: ctx.request.path,
    method: ctx.request.method,
    requestId,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      '/api/users',
      '/api/posts',
      '/health'
    ],
    documentation: 'https://api.example.com/docs'
  };
});

// Example route with error handling
app.get('/api/users/:id', async (ctx) => {
  const { id } = ctx.request.params;
  
  // Validate UUID format
  if (!isValidUUID(id)) {
    throw new ValidationError('Invalid user ID format', { field: 'id', value: id });
  }
  
  try {
    const user = await getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    return { success: true, user };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error; // Re-throw to be handled by error handler
    }
    
    // Wrap generic errors
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
});

// Authentication route with error handling
app.post('/api/auth/login', async (ctx) => {
  const { username, password } = ctx.request.body as { username: string; password: string };
  
  if (!username || !password) {
    throw new ValidationError('Username and password are required', { 
      fields: ['username', 'password'] 
    });
  }
  
  try {
    const user = await authenticateUser(username, password);
    if (!user) {
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }
    
    const token = generateToken(user);
    return { success: true, token, user: { id: user.id, username: user.username } };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error; // Re-throw to be handled by error handler
    }
    
    throw new DatabaseError('Authentication service unavailable', 'AUTH_SERVICE_DOWN');
  }
});

await app.listen();
```

### Dev API

**Use Case:** Development server with detailed error logging and debugging

**Description:** Development configuration with extensive error logging, detailed error information, and simplified error handling for easier debugging and development.

```typescript
import { YinzerFlow, log } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Development error handler with detailed logging
app.onError(async (ctx, error) => {
  const requestId = ctx.state.requestId || 'unknown';
  
  // Log comprehensive error information
  log.error('Error occurred in development', {
    requestId,
    error: {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    },
    request: {
      method: ctx.request.method,
      path: ctx.request.path,
      headers: ctx.request.headers,
      query: ctx.request.query,
      params: ctx.request.params,
      body: ctx.request.body,
      ipAddress: ctx.request.ipAddress
    },
    state: ctx.state
  });
  
  // Use table logging for structured data
  log.table({
    error: error instanceof Error ? error.message : String(error),
    requestId,
    method: ctx.request.method,
    path: ctx.request.path,
    timestamp: new Date().toISOString()
  }, 'Error Details');
  
  // Simple error response for development
  ctx.response.setStatusCode(500);
  return {
    success: false,
    error: 'Development error',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    requestId,
    timestamp: new Date().toISOString(),
    debug: {
      method: ctx.request.method,
      path: ctx.request.path,
      query: ctx.request.query,
      params: ctx.request.params
    }
  };
});

// Development not-found handler
app.onNotFound(async (ctx) => {
  log.warn('Route not found', {
    method: ctx.request.method,
    path: ctx.request.path,
    ipAddress: ctx.request.ipAddress
  });
  
  ctx.response.setStatusCode(404);
  return {
    success: false,
    error: 'Route not found',
    path: ctx.request.path,
    method: ctx.request.method,
    timestamp: new Date().toISOString(),
    debug: {
      availableRoutes: [
        'GET /api/users',
        'POST /api/users',
        'GET /api/users/:id',
        'PUT /api/users/:id',
        'DELETE /api/users/:id'
      ],
      query: ctx.request.query,
      headers: ctx.request.headers
    }
  };
});

// Test route that throws different types of errors
app.get('/test/error/:type', async (ctx) => {
  const { type } = ctx.request.params;
  
  switch (type) {
    case 'validation':
      throw new Error('Validation error: Invalid input');
    case 'database':
      throw new Error('Database error: Connection failed');
    case 'auth':
      throw new Error('Authentication error: Invalid token');
    case 'generic':
      throw new Error('Generic error occurred');
    default:
      return { message: 'No error thrown', type };
  }
});

// Route that demonstrates error handling
app.get('/api/users/:id', async (ctx) => {
  const { id } = ctx.request.params;
  
  log.info('Fetching user', { id, requestId: ctx.state.requestId });
  
  try {
    const user = await getUserById(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    log.info('User fetched successfully', { userId: user.id });
    return { success: true, user };
  } catch (error) {
    log.error('Failed to fetch user', { id, error: error.message });
    throw error; // Re-throw to be handled by error handler
  }
});

await app.listen();
```

## 🚀 Performance Notes

- **Automatic error catching**: No performance overhead for error handling
- **Early error detection**: Errors are caught immediately when thrown
- **Fallback protection**: Built-in fallback ensures application stability
- **CORS integration**: Error responses automatically include CORS headers

## 🔒 Security Notes

YinzerFlow implements several security measures for error handling:

### 🛡️ Error Information Sanitization
- **Problem**: Detailed error information can expose sensitive data like database credentials, file paths, or internal structure
- **YinzerFlow Solution**: Error handlers receive the raw error but should return sanitized responses to clients

### 🛡️ Stack Trace Protection
- **Problem**: Stack traces in production can reveal application structure and sensitive information
- **YinzerFlow Solution**: Error handlers can access stack traces for logging but should not return them to clients

### 🛡️ Error Logging Security
- **Problem**: Logged errors can contain sensitive information that could be exploited
- **YinzerFlow Solution**: Built-in logging with Pittsburgh personality, custom loggers can implement additional sanitization

### 🛡️ CORS Error Response Protection
- **Problem**: Error responses without CORS headers can cause client-side issues
- **YinzerFlow Solution**: CORS headers are automatically added to all error responses

### 🛡️ Fallback Error Protection
- **Problem**: If custom error handlers fail, applications can crash or expose sensitive information
- **YinzerFlow Solution**: Built-in fallback error handler ensures graceful degradation

### 🛡️ Error Handler Isolation
- **Problem**: Malicious error handlers could modify responses or bypass security controls
- **YinzerFlow Solution**: Error handlers are isolated and failures don't affect core functionality

## 🔧 Troubleshooting

### Error Handler Not Working
- **Problem**: Custom error handler not being called
- **Fix**: Check error handler registration and function signature

```typescript
// ❌ Wrong - error handler throws error
app.onError((ctx, error) => {
  throw new Error('Handler error'); // This will cause fallback
});

// ✅ Correct - error handler returns response
app.onError((ctx, error) => {
  ctx.response.setStatusCode(500);
  return { error: 'Something went wrong' };
});
```

### Error Handler Causing Crashes
- **Problem**: Error handler itself throws errors
- **Fix**: Use try-catch in error handlers or return safe responses

```typescript
// ❌ Wrong - error handler can throw
app.onError((ctx, error) => {
  const result = riskyOperation(); // Can throw
  return result;
});

// ✅ Correct - safe error handler
app.onError((ctx, error) => {
  try {
    const result = riskyOperation();
    return result;
  } catch (handlerError) {
    return { error: 'Error handler failed' };
  }
});
```

### Not Found Handler Not Working
- **Problem**: Custom not-found handler not being called
- **Fix**: Check handler registration and route matching

```typescript
// ❌ Wrong - handler throws error
app.onNotFound((ctx) => {
  throw new Error('Not found'); // This will cause fallback
});

// ✅ Correct - handler returns response
app.onNotFound((ctx) => {
  ctx.response.setStatusCode(404);
  return { error: 'Not found' };
});
```

### Error Information Exposed
- **Problem**: Sensitive information exposed in error responses
- **Fix**: Sanitize error information before returning to client

```typescript
// ❌ Wrong - exposing sensitive information
app.onError((ctx, error) => {
  return {
    error: error.message,
    stack: error.stack, // Exposes internal structure
    database: error.database // Exposes sensitive data
  };
});

// ✅ Correct - sanitized error response
app.onError((ctx, error) => {
  return {
    error: 'Internal server error',
    requestId: ctx.state.requestId,
    timestamp: new Date().toISOString()
  };
});
```