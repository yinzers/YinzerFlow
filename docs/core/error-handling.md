# Error Handling

YinzerFlow provides comprehensive error handling with automatic error catching and custom error handlers. The framework automatically catches all errors thrown in route handlers, hooks, and middleware, ensuring your application never crashes due to unhandled exceptions.

## Configuration

Error handling is automatically enabled and requires no configuration for basic usage:

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

### Configuration Options

YinzerFlow's error handling includes built-in security and logging features:

| Feature | Default | Description |
|---------|---------|-------------|
| **Automatic Error Catching** | Enabled | All errors in handlers are automatically caught |
| **Default Error Response** | 500 Internal Server Error | Structured error response with logging |
| **Error Logging** | Enabled | All errors logged with Pittsburgh personality |
| **CORS Headers** | Automatic | Error responses include proper CORS headers |
| **Fallback Protection** | Enabled | Safe fallback if custom handlers fail |

## Examples

### Basic Example

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// No try-catch needed - errors are automatically handled
app.get('/api/users/:id', async (ctx) => {
  const userId = ctx.request.params.id;
  
  // Database errors are automatically caught
  const user = await database.findUser(userId);
  
  if (!user) {
    // This error will be handled by your error handler
    throw new Error('User not found');
  }
  
  return user;
});

// Custom error handler
app.onError((ctx, error) => {
  ctx.response.setStatusCode(500);
  return {
    success: false,
    message: 'Something went wrong',
    timestamp: new Date().toISOString()
  };
});

await app.listen();
```

See [Error Handler Pattern](./examples.md#error-handler-pattern) for a complete error handler example.

### Advanced Example

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Custom error handler with different error types
app.onError((ctx, error) => {
  // Handle different error types
  if (error instanceof ValidationError) {
    ctx.response.setStatusCode(400);
    return {
      success: false,
      error: 'Validation failed',
      details: error.details,
      path: ctx.request.path
    };
  }
  
  if (error instanceof DatabaseError) {
    ctx.response.setStatusCode(503);
    return {
      success: false,
      error: 'Service temporarily unavailable',
      retryAfter: 30
    };
  }
  
  if (error instanceof AuthenticationError) {
    ctx.response.setStatusCode(401);
    return {
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    };
  }
  
  // Default error handling
  ctx.response.setStatusCode(500);
  return {
    success: false,
    error: 'Internal server error',
    requestId: ctx.request.headers['x-request-id'] || 'unknown'
  };
});

// Custom not found handler
app.onNotFound((ctx) => {
  ctx.response.setStatusCode(404);
  return {
    success: false,
    error: 'Route not found',
    path: ctx.request.path,
    method: ctx.request.method,
    availableMethods: ['GET', 'POST', 'PUT', 'DELETE']
  };
});

await app.listen();
```

## Common Use Cases

- **Database Error Handling**: Automatically catch and handle database connection errors, query failures, and constraint violations
- **Validation Error Processing**: Handle input validation errors with structured error responses and field-specific messages
- **Authentication Error Management**: Process authentication failures, expired tokens, and authorization errors with appropriate status codes
- **External API Error Handling**: Catch and handle errors from third-party services with retry logic and fallback responses
- **File Upload Error Processing**: Handle file size limits, type validation errors, and upload failures with user-friendly messages
- **Rate Limiting Error Responses**: Process rate limit violations with appropriate headers and retry information

## Error Handler Parameters

The error handler receives two parameters:

### Context Object (`ctx`)
The complete request context containing `request` and `response` objects. See [Context Object Documentation](./context.md) for detailed information about accessing context properties.

### Error Object (`error`)
The caught error can be any type - Error instances, strings, objects, or other values:

```typescript
app.onError((ctx, error) => {
  // Handle different error types
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack };
  } else if (typeof error === 'string') {
    return { error };
  } else if (typeof error === 'object' && error !== null) {
    return { error: JSON.stringify(error) };
  } else {
    return { error: 'Unknown error occurred' };
  }
});
```

## Error Handler Best Practices

### Structured Error Responses
```typescript
app.onError((ctx, error) => {
  const errorResponse = {
    success: false,
    message: error instanceof Error ? error.message : 'Internal server error',
    timestamp: new Date().toISOString(),
    path: ctx.request.path,
    method: ctx.request.method,
    requestId: ctx.request.headers['x-request-id'] || 'unknown'
  };
  
  ctx.response.setStatusCode(500);
  return errorResponse;
});
```

### Error Type Handling
```typescript
app.onError((ctx, error) => {
  // Handle specific error types
  if (error instanceof ValidationError) {
    ctx.response.setStatusCode(400);
    return {
      success: false,
      error: 'Validation failed',
      details: error.details,
      fields: error.fields
    };
  }
  
  if (error instanceof DatabaseError) {
    ctx.response.setStatusCode(503);
    return {
      success: false,
      error: 'Database connection failed',
      retryAfter: 60
    };
  }
  
  if (error instanceof RateLimitError) {
    ctx.response.setStatusCode(429);
    return {
      success: false,
      error: 'Too many requests',
      retryAfter: error.retryAfter
    };
  }
  
  // Default handling
  ctx.response.setStatusCode(500);
  return { success: false, error: 'Internal server error' };
});
```

### Error Logging and Monitoring
```typescript
app.onError((ctx, error) => {
  // Log detailed error information for debugging
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    path: ctx.request.path,
    method: ctx.request.method,
    userAgent: ctx.request.headers['user-agent'],
    ipAddress: ctx.request.ipAddress,
    timestamp: new Date().toISOString(),
    requestId: ctx.request.headers['x-request-id'] || 'unknown'
  };
  
  // Log to monitoring service (but don't expose to client)
  console.error('Application error:', errorInfo);
  
  // Return sanitized response to client
  ctx.response.setStatusCode(500);
  return {
    success: false,
    error: 'Internal server error',
    requestId: errorInfo.requestId
  };
});
```

## Error Handler Limitations

- **No Error Throwing**: Error handlers should not throw errors - use return statements instead
- **Response Object**: Return a response object that will be sent to the client
- **Status Code**: Set the status code on `ctx.response.setStatusCode()` before returning
- **CORS Headers**: CORS headers are automatically added to error responses
- **Async Support**: Error handlers can be async functions
- **Hook Integration**: Error handlers work with before/after hooks

## Security Considerations

YinzerFlow implements several security measures to prevent common error handling vulnerabilities:

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

These security measures ensure YinzerFlow's error handling implementation follows security best practices and prevents common attack vectors while maintaining application stability and user experience. 