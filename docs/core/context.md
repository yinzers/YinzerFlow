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