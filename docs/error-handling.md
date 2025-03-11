# Error Handling in YinzerFlow

YinzerFlow provides a flexible and robust error handling system that allows you to gracefully handle errors in your application. This document explains the core concepts, features, and best practices for error handling.

## Core Concepts

Error handling in YinzerFlow occurs at multiple levels:

1. **Route and Hook Level**: Explicit error handling in your route handlers and hooks
2. **Global Error Handler**: A centralized error handler for unhandled errors
3. **Framework Level**: Built-in error handling for framework-level errors

## Route and Hook Level Error Handling

The most direct way to handle errors is within your route handlers and hooks using try/catch blocks:

```typescript
app.get('/users/:id', async ({ request, response }) => {
  try {
    const user = await getUserById(request.params.id);
    if (!user) {
      response.setStatus(404);
      return { error: 'User not found' };
    }
    return user;
  } catch (error) {
    console.error('Failed to retrieve user:', error);
    response.setStatus(500);
    return { error: 'Failed to retrieve user' };
  }
});
```

This approach gives you fine-grained control over error handling for specific routes.

### Setting Status Codes

When an error occurs, you should set an appropriate HTTP status code using the `response.setStatus()` method:

```typescript
response.setStatus(400); // Bad Request
response.setStatus(401); // Unauthorized
response.setStatus(403); // Forbidden
response.setStatus(404); // Not Found
response.setStatus(500); // Internal Server Error
```

### Returning Error Responses

After setting the status code, return an object with an error message:

```typescript
return { error: 'Resource not found' };
```

You can include additional information in the error response:

```typescript
return {
  error: 'Validation failed',
  details: [
    { field: 'email', message: 'Invalid email format' },
    { field: 'password', message: 'Password too short' }
  ]
};
```

## Global Error Handler

YinzerFlow provides a global error handler that catches unhandled errors in your application. By default, it:

1. Logs the error to the console
2. Sets the response status to 500 (Internal Server Error)
3. Returns a JSON object with an error message

### Default Error Handler

The default error handler is implemented as follows:

```typescript
private readonly _defaultErrorHandler: TErrorFunction = ({ response }, error): unknown => {
  console.error('Unhandled error:', error);
  response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
  return { error: 'Internal Server Error' };
};
```

### Custom Error Handler

You can provide your own error handler when initializing YinzerFlow:

```typescript
const app = new YinzerFlow({
  port: 3000,
  errorHandler: ({ response }, error) => {
    console.error('Custom error handler:', error);
    response.setStatus(500);
    
    // In development, include the stack trace
    if (process.env.NODE_ENV === 'development') {
      return {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }
    
    // In production, return a generic message
    return {
      error: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };
  }
});
```

## Framework Level Error Handling

YinzerFlow handles framework-level errors automatically, such as:

- Invalid route paths
- Malformed request bodies
- Unsupported content types

These errors are handled internally and appropriate responses are sent to the client.

## Best Practices

### Use Specific Status Codes

Use the most specific HTTP status code for each error situation:

```typescript
// Authentication error
response.setStatus(401);
return { error: 'Authentication required' };

// Authorization error
response.setStatus(403);
return { error: 'Permission denied' };

// Resource not found
response.setStatus(404);
return { error: 'User not found' };

// Validation error
response.setStatus(400);
return { error: 'Invalid input' };

// Server error
response.setStatus(500);
return { error: 'Internal server error' };
```

### Provide Helpful Error Messages

Error messages should be clear and actionable:

```typescript
// Good
return { error: 'Email format is invalid' };

// Better
return {
  error: 'Validation failed',
  details: [
    { field: 'email', message: 'Email must be a valid email address' }
  ]
};

// Avoid
return { error: 'Error occurred' };
```

### Log Errors Appropriately

Log errors with sufficient context for debugging:

```typescript
try {
  // Operation that might fail
} catch (error) {
  console.error(`Failed to process order ${orderId}:`, error);
  response.setStatus(500);
  return { error: 'Failed to process order' };
}
```

### Handle Async Errors

Always use try/catch blocks with async operations:

```typescript
app.get('/data', async ({ response }) => {
  try {
    const data = await fetchDataFromDatabase();
    return data;
  } catch (error) {
    console.error('Database error:', error);
    response.setStatus(500);
    return { error: 'Failed to fetch data' };
  }
});
```

## Common Error Scenarios

### Authentication Errors

```typescript
app.beforeAll(({ request, response }) => {
  const token = request.headers.authorization?.split(' ')[1];
  if (!token) {
    response.setStatus(401);
    return { error: 'Authentication required' };
  }
  
  try {
    const user = verifyToken(token);
    request.state.user = user;
  } catch (error) {
    response.setStatus(401);
    return { error: 'Invalid token' };
  }
});
```

### Validation Errors

```typescript
app.post('/users', ({ request, response }) => {
  const { name, email, password } = request.body;
  const errors = [];
  
  if (!name) errors.push({ field: 'name', message: 'Name is required' });
  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  if (!password) errors.push({ field: 'password', message: 'Password is required' });
  
  if (errors.length > 0) {
    response.setStatus(400);
    return { error: 'Validation failed', details: errors };
  }
  
  // Process valid data...
  return { success: true };
});
```

### Not Found Errors

```typescript
app.get('/users/:id', ({ request, response }) => {
  const user = findUserById(request.params.id);
  
  if (!user) {
    response.setStatus(404);
    return { error: 'User not found' };
  }
  
  return user;
});
```

## Conclusion

Effective error handling is crucial for building robust and user-friendly applications. YinzerFlow provides a flexible error handling system that allows you to handle errors at multiple levels, from route-specific handling to global error management. By following the best practices outlined in this document, you can ensure that your application gracefully handles errors and provides helpful feedback to users. 