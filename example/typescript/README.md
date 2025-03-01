# YinzerFlow TypeScript Example

This example demonstrates how to use YinzerFlow in a TypeScript project with full type safety.

## File Structure

```
typescript/
├── index.ts                         # Main entry point
├── middleware/
│   └── authentication.middleware.ts # Authentication middleware
└── routes/
    └── authentication.routes.ts     # Authentication routes
```

## Features Demonstrated

1. **Type-Safe Server Setup**: Creating and configuring a YinzerFlow server with TypeScript
2. **Typed Error Handling**: Custom error handler with proper type annotations
3. **Middleware with Types**: Global authentication middleware with typed context
4. **Typed Route Groups**: Grouping related routes with proper type definitions
5. **Before Group Hooks**: Executing typed logic before processing routes in a group

## Running the Example

```bash
# Navigate to the project root
cd /path/to/yinzerflow

# Run the example
bun example/typescript/index.ts
```

## Testing the API

Once the server is running, you can test the API using curl:

```bash
# Check server status
curl http://localhost:5000/status

# Login (no authentication required)
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}' \
  http://localhost:5000/auth/login

# Access protected route (requires authentication)
curl -H "Authorization: Bearer your-token" \
  http://localhost:5000/auth/profile
```

## Code Walkthrough

### Type-Safe Server Setup

```typescript
import { HttpStatusCode, YinzerFlow } from 'yinzerflow';
import type { THttpStatusCode, TResponseBody } from 'yinzerflow';

export const app = new YinzerFlow({
  port: 5000,
  errorHandler: ({ response }, error): TResponseBody<unknown> => {
    console.error('Server error: \n', error);
    response.setStatus(<THttpStatusCode>HttpStatusCode.TOO_MANY_REQUESTS);
    return { success: false, message: 'Internal server error' };
  },
});
```

### Typed Middleware Configuration

```typescript
// Apply authentication middleware to all routes except specified ones
app.beforeAll(authenticationMiddleware, { 
  paths: 'allButExcluded', 
  excluded: ['/auth/login', '/auth/register', '/status'] 
});
```

### Typed Route Groups

```typescript
// Group authentication-related routes under /auth with typed response
app.group('/auth', authenticationRoutes, {
  beforeGroup: ({ response }): TResponseBody<{ success: boolean; message: string }> => {
    response.setStatus(<THttpStatusCode>HttpStatusCode.TOO_MANY_REQUESTS);
    return { success: false, message: 'Too many requests' };
  },
});
``` 