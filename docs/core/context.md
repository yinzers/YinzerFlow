# Context Object

The Context object is the central interface for all YinzerFlow route handlers and hooks. It provides access to the request data, response controls, and maintains the complete request lifecycle state.

## Configuration

Context objects are automatically created and provided to all handlers - no configuration required:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Context is automatically provided to all handlers
app.get('/api/data', (ctx) => {
  // Access request data
  const { path, method, headers } = ctx.request;
  
  // Control response
  ctx.response.setStatusCode(200);
  
  return { message: 'Success' };
});
```

## Examples

### Basic Example

See [Basic Handler Pattern](./examples.md#basic-handler-pattern) for a complete example showing how to use the context object.

For detailed information about request properties and methods, see [Request Object Documentation](./request.md).
For detailed information about response methods and capabilities, see [Response Object Documentation](./response.md).

## Common Use Cases

- **Request Data Access**: Extract headers, body, query parameters, and route parameters for processing
- **Response Control**: Set status codes, add headers, and control response formatting
- **Authentication**: Access authorization headers and client IP for security validation
- **Content Negotiation**: Handle Accept headers and Content-Type for proper response formatting
- **Error Handling**: Provide context to error handlers for detailed error responses
- **Logging and Monitoring**: Access request metadata for logging and analytics

## Context Structure

The Context object contains two main properties:

### Request Object (`ctx.request`)
Contains all incoming request data including headers, body, query parameters, route parameters, and metadata. See [Request Object Documentation](./request.md) for detailed information about request properties and methods.

### Response Object (`ctx.response`)
Provides methods to control the HTTP response including status codes, headers, and response formatting. See [Response Object Documentation](./response.md) for detailed information about response methods and capabilities.

## Context State

The Context object provides a powerful state system that allows you to store and share custom data throughout the request lifecycle. This is perfect for authentication, middleware data, request-scoped variables, and custom context information.

### What is Context State?

Context state is a request-scoped object (`ctx.state`) that persists data throughout the entire request lifecycle. Unlike global variables, state is isolated to each individual request and automatically garbage collected when the request completes.

### Basic Usage

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

### Advanced Usage with Type Safety

For full type safety, you can extend the context with custom state types:

```typescript
// Define your custom state interface
interface AuthContext extends InternalHandlerCallbackGenerics {
  state: {
    user: User;
    permissions: string[];
    requestId: string;
    session: Session;
  };
}

// Use it in your route handler
const authHandler: HandlerCallback<AuthContext> = async (ctx) => {
  // Fully type-safe access to state
  console.log(ctx.state.user.name);           // Type: string
  console.log(ctx.state.permissions[0]);      // Type: string
  console.log(ctx.state.session.expiresAt);   // Type: Date
  
  // No type assertions needed!
  const user = ctx.state.user;                // Type: User
  const permissions = ctx.state.permissions;  // Type: string[]
  
  return { message: 'Authenticated', user };
};
```

### State Lifecycle

State data follows the request lifecycle:

1. **Request Start**: State object is created as empty object
2. **Global Hooks**: `beforeAll` hooks can populate state
3. **Route Hooks**: `beforeHooks` can access and modify state
4. **Route Handler**: Your handler can access and modify state
5. **Route Hooks**: `afterHooks` can access state and modify response
6. **Global Hooks**: `afterAll` hooks can access state and modify response
7. **Request End**: State is automatically garbage collected

### State Inheritance in Route Groups

State can be shared across route groups and inherited by nested routes:

```typescript
app.group('/api/v1', (api) => {
  // Group-level middleware sets state
  api.beforeAll([async (ctx) => {
    ctx.state.apiVersion = 'v1';
    ctx.state.environment = process.env.NODE_ENV;
  }]);
  
  api.group('/admin', (admin) => {
    // Admin-specific middleware
    admin.beforeAll([async (ctx) => {
      ctx.state.requiresAuth = true;
      ctx.state.adminOnly = true;
    }]);
    
    // Routes inherit all state from parent groups
    admin.get('/users', async (ctx) => {
      console.log(ctx.state.apiVersion);    // "v1"
      console.log(ctx.state.environment);   // "production"
      console.log(ctx.state.requiresAuth);  // true
      console.log(ctx.state.adminOnly);     // true
      
      return { users: ['Admin1', 'Admin2'] };
    });
  });
});
```

### Common Use Cases

- **Authentication**: Store user information and permissions
- **Request Tracking**: Generate and store request IDs for logging
- **Middleware Data**: Pass data between middleware and route handlers
- **Session Management**: Store session information and user preferences
- **Rate Limiting**: Track request counts and limits per user/IP
- **Custom Headers**: Store computed headers for later use
- **Validation Results**: Cache validation results to avoid re-validation
- **Database Connections**: Store database connection pools or transactions

### Best Practices

- **Keep state minimal**: Only store data that's actually needed
- **Use descriptive keys**: `ctx.state.user` is better than `ctx.state.u`
- **Validate state access**: Check if properties exist before using them
- **Type your state**: Use TypeScript interfaces for complex state structures
- **Don't store sensitive data**: State is not encrypted or secured
- **Clean up resources**: Release any resources (like DB connections) when done

### Security Considerations

YinzerFlow implements several security measures for context state:

#### 🛡️ Request Isolation
- **Problem**: State data could leak between requests
- **YinzerFlow Solution**: Each request gets its own isolated state object

#### 🛡️ Type Safety
- **Problem**: Unchecked state access can lead to runtime errors
- **YinzerFlow Solution**: TypeScript generics provide compile-time type checking

#### 🛡️ Memory Management
- **Problem**: State data could accumulate and cause memory leaks
- **YinzerFlow Solution**: State is automatically garbage collected after each request

These security measures ensure YinzerFlow's context state implementation follows security best practices and prevents common attack vectors while maintaining spec compliance.

## TypeScript Support

YinzerFlow provides full TypeScript support for context objects with generic type parameters.

See [TypeScript Pattern](./examples.md#typescript-pattern) for a complete example showing how to use TypeScript with the context object.

## Error Handling Integration

Context objects are automatically passed to error handlers.

See [Error Handler Pattern](./examples.md#error-handler-pattern) for a complete example.

## Hook Integration

Context objects are passed to all hooks (before/after hooks).

See [Hook Pattern](./examples.md#hook-pattern) for a complete example.

## Security Considerations

YinzerFlow implements several security measures for context handling:

### 🛡️ Input Validation
- **Problem**: Malicious request data can cause injection attacks or bypass security controls
- **YinzerFlow Solution**: All request properties are automatically validated and sanitized

### 🛡️ Type Safety
- **Problem**: Untyped request data can lead to runtime errors and security vulnerabilities
- **YinzerFlow Solution**: Full TypeScript support with generic type parameters ensures type safety

### 🛡️ Context Isolation
- **Problem**: Context objects could be modified maliciously to bypass security controls
- **YinzerFlow Solution**: Context objects are isolated and modifications are controlled

### 🛡️ Header Security
- **Problem**: Malicious headers can cause parsing errors or security bypasses
- **YinzerFlow Solution**: Header validation and sanitization prevent header-based attacks

These security measures ensure YinzerFlow's context implementation follows security best practices and prevents common attack vectors while maintaining type safety and developer experience. 