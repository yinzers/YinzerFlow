# Common Examples

This file contains shared examples that are referenced throughout the YinzerFlow documentation to avoid duplication.

## Basic Handler Pattern

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

app.post('/api/users/:id', (ctx) => {
  // Access request properties
  const userId = ctx.request.params.id;
  const userData = ctx.request.body;
  const includeProfile = ctx.request.query.include_profile;
  const authHeader = ctx.request.headers['authorization'];
  const clientIp = ctx.request.ipAddress;
  
  // Control response
  ctx.response.setStatusCode(201);
  ctx.response.addHeaders({
    'Location': `/api/users/${userId}`,
    'X-User-ID': userId
  });
  
  return {
    id: userId,
    data: userData,
    includeProfile: !!includeProfile,
    clientIp
  };
});
```

## Request Access Pattern

```typescript
app.get('/api/users/:id', (ctx) => {
  const { request } = ctx;
  
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

  const clientIp = request.ipAddress
  
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

## Response Control Pattern

```typescript
app.get('/api/users/:id', (ctx) => {
  const { request, response } = ctx;
  const userId = request.params.id;
  
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

## Error Handler Pattern

```typescript
app.onError((ctx, error) => {
  // Access request context in error handler
  const { path, method, headers } = ctx.request;
  
  // Control error response
  ctx.response.setStatusCode(500);
  
  return {
    success: false,
    error: 'Internal server error',
    path,
    method,
    timestamp: new Date().toISOString()
  };
});
```

## Hook Pattern

```typescript
// Before hook
app.beforeAll([(ctx) => {
  // Access request context
  const authHeader = ctx.request.headers['authorization'];
  
  // Validate authentication
  if (!authHeader) {
    throw new Error('Authentication required');
  }
}]);

// After hook
app.afterAll([(ctx) => {
  // Access response context
  ctx.response.addHeaders({
    'X-Response-Time': Date.now().toString()
  });
}]);
```

## TypeScript Pattern

```typescript
import type { HandlerCallback } from 'yinzerflow';

// Define custom types for your API
interface UserBody {
  name: string;
  email: string;
  age: number;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface UserQuery {
  include_profile?: string;
  limit?: string;
}

interface UserParams {
  id: string;
}

// Typed handler with custom body, response, query, and params
const createUserHandler: HandlerCallback<{
  body: UserBody;
  response: UserResponse;
  query: UserQuery;
  params: UserParams;
}> = (ctx) => {
  // ctx.request.body is typed as UserBody
  const userData = ctx.request.body;
  
  // ctx.request.query is typed as UserQuery
  const includeProfile = ctx.request.query.include_profile;
  
  // ctx.request.params is typed as UserParams
  const userId = ctx.request.params.id;
  
  // Return type is typed as UserResponse
  return {
    id: 'user-123',
    name: userData.name,
    email: userData.email,
    createdAt: new Date().toISOString()
  };
};

app.post('/api/users/:id', createUserHandler);
``` 