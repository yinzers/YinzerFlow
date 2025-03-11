# Request Lifecycle Hooks

YinzerFlow provides a powerful hooks system (traditionally called middleware in other frameworks) that allows you to intercept and modify requests and responses at various points in the request lifecycle. This document explains the core components, features, and best practices for using the hooks system.

## Core Concepts

In YinzerFlow, hooks are functions that can be executed at different phases of the request lifecycle:

1. **Before All**: Executed before any route-specific hooks
2. **Before Group**: Executed for routes in a specific group
3. **Before Handler**: Executed before a specific route handler
4. **After Handler**: Executed after a specific route handler

Each hook can:
- Modify the request or response
- End the request early by returning a response
- Pass control to the next hook by returning nothing

## Core Components

The hooks system consists of one main component:

### HooksManager (MiddlewareManager)

The `MiddlewareManager` class (which we recommend thinking of as a "HooksManager") is responsible for registering and executing hooks at the appropriate points in the request lifecycle.

```typescript
import { MiddlewareManager } from 'yinzerflow';

const hooksManager = new MiddlewareManager();
```

#### Key Features

- **Path matching**: Hooks can be applied to specific paths or path patterns
- **Path exclusion**: Hooks can be excluded from specific paths
- **Event-based architecture**: Emits events when hooks are added or executed
- **Error handling**: Comprehensive error handling with proper logging and propagation

## Registering Hooks

### Global Hooks

Global hooks are executed for all requests:

```typescript
app.beforeAll((ctx) => {
  console.log(`Request received: ${ctx.request.method} ${ctx.request.path}`);
});
```

### Path-Specific Hooks

Hooks can be applied to specific paths:

```typescript
app.beforeAll(
  (ctx) => {
    // Verify API key
    const apiKey = ctx.request.headers['x-api-key'];
    if (!apiKey || !isValidApiKey(apiKey)) {
      ctx.response.setStatus(401);
      return { error: 'Invalid API key' };
    }
  },
  { paths: ['/api/users', '/api/products'] }
);
```

### Path Pattern Hooks

Hooks can be applied to path patterns using wildcards:

```typescript
app.beforeAll(
  (ctx) => {
    // Verify API key for all API routes
    const apiKey = ctx.request.headers['x-api-key'];
    if (!apiKey || !isValidApiKey(apiKey)) {
      ctx.response.setStatus(401);
      return { error: 'Invalid API key' };
    }
  },
  { paths: ['/api/*'] }
);
```

### Excluded Paths

Hooks can be excluded from specific paths:

```typescript
app.beforeAll(
  (ctx) => {
    // Log all requests except health checks
    console.log(`Request received: ${ctx.request.method} ${ctx.request.path}`);
  },
  { paths: 'allButExcluded', excluded: ['/health'] }
);
```

## Route-Specific Hooks

In addition to global hooks, you can also specify hooks for specific routes:

### Before Handler

```typescript
app.get(
  '/users/:id',
  handleGetUser,
  {
    beforeHandler: (ctx) => {
      // Validate user ID
      const userId = ctx.request.params.id;
      if (!isValidUserId(userId)) {
        ctx.response.setStatus(400);
        return { error: 'Invalid user ID' };
      }
    }
  }
);
```

### After Handler

```typescript
app.get(
  '/users/:id',
  handleGetUser,
  {
    afterHandler: (ctx) => {
      // Log successful user retrieval
      console.log(`User retrieved: ${ctx.request.params.id}`);
    }
  }
);
```

## Hook Execution Order

Hooks are executed in the following order:

1. Global "Before All" hooks (registered with `app.beforeAll()`)
2. Group "Before Group" hooks (specified when registering route groups)
3. Route-specific "Before Handler" hooks (specified when registering routes)
4. Route handler
5. Route-specific "After Handler" hooks (specified when registering routes)

If any hook returns a response, the request is short-circuited and that response is sent to the client.

## Response Handling and Error Management

YinzerFlow provides flexible ways to handle responses and errors in your hooks and route handlers.

### Setting Status Codes

You can set status codes directly using the response object in the context:

```typescript
app.beforeAll((ctx) => {
  // Check if user is authenticated
  if (!isAuthenticated(ctx)) {
    ctx.response.setStatus(401); // Sets status to 401 Unauthorized
    return { message: 'Authentication required' };
  }
});
```

### Returning Responses

Hooks and route handlers can return responses in several ways:

1. **Return an object**: The object will be automatically converted to JSON
   ```typescript
   return { success: true, data: { id: 1, name: 'John' } };
   ```

2. **Return a primitive**: The value will be converted to a string
   ```typescript
   return 'Hello World';
   ```

### Error Handling

For explicit error handling in hooks, use try/catch blocks:

```typescript
app.beforeAll(async (ctx) => {
  try {
    const result = await someAsyncOperation();
    ctx.state.result = result;
  } catch (error) {
    console.error('Operation failed:', error);
    ctx.response.setStatus(500);
    return { error: 'Operation failed', message: error.message };
  }
});
```

YinzerFlow has a built-in error handling system that catches unhandled errors. For more details on error handling, refer to the [Error Handling](./error-handling.md) documentation.

## Advanced Features

### Hook Events

The hooks system emits events when hooks are added or executed. You can listen for these events to perform additional actions:

```typescript
import { HookManagerEvent } from 'yinzerflow/constants/hooks';

app.hooks.on(HookManagerEvent.HOOK_EXECUTED, (info) => {
  console.log(`Hook executed: ${info.phase} for ${info.path}`);
});
```

### Hook Removal

You can remove all hooks using the `clear` method:

```typescript
app.hooks.clear();
```

## Best Practices

### Keep Hooks Focused

Each hook should have a single responsibility. For example, separate authentication, logging, and validation into different hooks.

```typescript
// Good
app.beforeAll(logRequest);
app.beforeAll(authenticate);
app.beforeAll(validateInput);

// Avoid
app.beforeAll((ctx) => {
  // Log request
  // Authenticate user
  // Validate input
});
```

### Use Path Patterns Wisely

Use path patterns to apply hooks to groups of routes:

```typescript
// Apply authentication to all admin routes
app.beforeAll(authenticate, { paths: ['/admin/*'] });

// Apply rate limiting to all API routes
app.beforeAll(rateLimiter, { paths: ['/api/*'] });
```

### Error Handling

Implement proper error handling in your hooks:

```typescript
app.beforeAll(async (ctx) => {
  try {
    // Perform some async operation
    await someAsyncOperation();
  } catch (error) {
    console.error('Hook error:', error);
    ctx.response.setStatus(500);
    return { error: 'An error occurred' };
  }
});
```

### Performance Considerations

- **Keep hooks lightweight**: Hooks are executed on every matching request, so keep them efficient
- **Use path matching**: Apply hooks only to the paths that need them
- **Cache expensive operations**: If a hook performs expensive operations, consider caching the results

## Common Use Cases

- **Authentication**
- **Logging**
- **Rate Limiting**

## Conclusion
# End of Selection

The hooks system in YinzerFlow provides a flexible and powerful way to modify requests and responses at various points in the request lifecycle. By using hooks effectively, you can implement cross-cutting concerns like authentication, logging, and rate limiting in a clean and maintainable way. 