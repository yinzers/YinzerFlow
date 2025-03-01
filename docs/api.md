# YinzerFlow API Documentation

This document provides a comprehensive reference for the YinzerFlow API, including all core classes, methods, constants, and types.

## Core Classes

### YinzerFlow

The main server class that orchestrates all components. This is the primary class you'll interact with when building applications with YinzerFlow.

#### Constructor Options

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  // Required options
  port: 5000,                      // Port to listen on
  
  // Optional options
  host: '0.0.0.0',                 // Host to bind to (default: '0.0.0.0')
  errorHandler: ({ response }, error) => {
    // Custom error handling logic
    console.error('Error:', error);
    response.setStatus(500);
    return { success: false, message: 'An error occurred' };
  },
  logger: (message) => {           // Custom logger function
    console.log(`[YinzerFlow] ${message}`);
  }
});
```

#### Methods

| Method | Description | Example |
|--------|-------------|---------|
| `listen()` | Starts the server and listens for incoming connections | `await app.listen();` |
| `close()` | Stops the server and closes all connections | `await app.close();` |
| `get(path, handler, options?)` | Adds a GET route | `app.get('/users', ctx => ({ users: [] }));` |
| `post(path, handler, options?)` | Adds a POST route | `app.post('/users', ctx => ({ success: true }));` |
| `put(path, handler, options?)` | Adds a PUT route | `app.put('/users/:id', ctx => ({ success: true }));` |
| `patch(path, handler, options?)` | Adds a PATCH route | `app.patch('/users/:id', ctx => ({ success: true }));` |
| `delete(path, handler, options?)` | Adds a DELETE route | `app.delete('/users/:id', ctx => ({ success: true }));` |
| `options(path, handler, options?)` | Adds an OPTIONS route | `app.options('/users', ctx => ({}));` |
| `head(path, handler, options?)` | Adds a HEAD route | `app.head('/users', ctx => ({}));` |
| `group(prefix, routes, options?)` | Groups routes under a common prefix | `app.group('/api', [...routes], { beforeGroup: middleware });` |
| `beforeAll(middleware, options?)` | Adds middleware to run before all routes | `app.beforeAll(authMiddleware, { excluded: ['/login'] });` |
| `beforeGroup(middleware, options?)` | Adds middleware to run before a group of routes | `app.beforeGroup(loggerMiddleware, { paths: ['/api'] });` |
| `beforeHandler(middleware, options?)` | Adds middleware to run before a specific handler | `app.beforeHandler(validationMiddleware);` |
| `getStatus()` | Returns the current server status | `console.log(app.getStatus());` |

#### Route Handler Options

When adding routes, you can provide options to customize behavior:

```typescript
app.get('/users/:id', 
  (ctx) => {
    // Handler logic
    return { user: { id: ctx.request.params.id } };
  },
  {
    // Options
    beforeHandler: (ctx) => {
      // Middleware that runs before this specific handler
      console.log(`Accessing user ${ctx.request.params.id}`);
    },
    afterHandler: (ctx) => {
      // Logic that runs after the handler (but before response is sent)
      console.log('User request completed');
    }
  }
);
```

#### Group Options

When creating route groups, you can provide options:

```typescript
app.group('/api', 
  [
    // Array of routes
    app.get('/users', ctx => ({ users: [] })),
    app.post('/users', ctx => ({ success: true }))
  ],
  {
    // Options
    beforeGroup: (ctx) => {
      // Middleware that runs before any route in this group
      console.log('API route accessed');
    }
  }
);
```

### RouteRegistry

Manages route registration and storage. This class is responsible for storing all routes and their handlers.

```typescript
import { RouteRegistry } from 'yinzerflow';

const registry = new RouteRegistry();

// Add a route
registry.addRoute({
  method: 'GET',
  path: '/users',
  handler: (context) => ({ users: [] })
});

// Get all routes
const routes = registry.getRoutes();

// Check if a route exists
const exists = registry.hasRoute('GET', '/users');
```

### RouteFinder

Finds the appropriate route for a given request. This class is responsible for matching incoming requests to registered routes.

```typescript
import { RouteFinder, RouteRegistry } from 'yinzerflow';

const registry = new RouteRegistry();
registry.addRoute({
  method: 'GET',
  path: '/users/:id',
  handler: (context) => ({ user: { id: context.request.params.id } })
});

const finder = new RouteFinder(registry);

// Find a route for a request
const route = finder.findRouteFromRequest(request);

// Extract parameters from a path
const params = finder.extractParamsFromPath('/users/123', '/users/:id');
// Result: { id: '123' }
```

### MiddlewareManager

Manages middleware registration and execution. This class is responsible for storing and organizing middleware functions.

```typescript
import { MiddlewareManager } from 'yinzerflow';

const manager = new MiddlewareManager();

// Add global middleware
manager.addMiddleware(
  ({ request, response }, next) => {
    console.log(`Request to ${request.path}`);
    return next();
  },
  { paths: 'all' }
);

// Add middleware for specific paths
manager.addMiddleware(
  ({ request, response }, next) => {
    console.log('Accessing protected route');
    return next();
  },
  { paths: ['/admin', '/settings'] }
);

// Add middleware for all paths except excluded ones
manager.addMiddleware(
  ({ request, response }, next) => {
    console.log('Auth check');
    return next();
  },
  { 
    paths: 'allButExcluded', 
    excluded: ['/login', '/register'] 
  }
);

// Get middleware for a specific path
const middleware = manager.getMiddlewareForPath('/admin');
```

### MiddlewareExecutor

Executes middleware in the correct order. This class is responsible for running middleware functions in sequence.

```typescript
import { MiddlewareExecutor } from 'yinzerflow';

const executor = new MiddlewareExecutor();

// Execute middleware chain
const result = await executor.execute(
  context,
  middlewareFunctions,
  finalHandler
);
```

### HttpRequest

Represents an HTTP request. This class parses and provides access to all request data.

```typescript
import { HttpRequest } from 'yinzerflow';

// Create from raw HTTP request string
const request = new HttpRequest(rawRequestString);

// Access request properties
console.log(request.method);        // GET, POST, etc.
console.log(request.path);          // /users, /products, etc.
console.log(request.headers);       // { 'content-type': 'application/json', ... }
console.log(request.body);          // Request body (parsed based on content-type)
console.log(request.query);         // Query parameters as object
console.log(request.params);        // URL parameters (populated by RouteFinder)
console.log(request.cookies);       // Cookies as object
console.log(request.ip);            // Client IP address
console.log(request.protocol);      // HTTP or HTTPS
console.log(request.contentLength); // Content length in bytes
console.log(request.contentType);   // Content type
```

### HttpResponse

Represents an HTTP response. This class helps build and format HTTP responses.

```typescript
import { HttpResponse, HttpStatusCode, ContentType } from 'yinzerflow';

// Create a response for a request
const response = new HttpResponse(request);

// Set response properties
response.setStatus(HttpStatusCode.OK);
response.setBody({ success: true, data: [] });
response.setContentType(ContentType.JSON);
response.addHeaders([
  { 'X-Custom-Header': 'value' },
  { 'Cache-Control': 'no-cache' }
]);
response.setCookie('session', 'abc123', {
  httpOnly: true,
  maxAge: 3600,
  path: '/'
});

// Remove headers
response.removeHeaders(['X-Temp-Header']);

// Format the final HTTP response
const formattedResponse = response.formatHttpResponse();
```

## Constants

### HttpMethod

HTTP method constants for use in route definitions and request handling.

```typescript
import { HttpMethod } from 'yinzerflow';

// Available methods
console.log(HttpMethod.GET);     // GET
console.log(HttpMethod.POST);    // POST
console.log(HttpMethod.PUT);     // PUT
console.log(HttpMethod.PATCH);   // PATCH
console.log(HttpMethod.DELETE);  // DELETE
console.log(HttpMethod.HEAD);    // HEAD
console.log(HttpMethod.OPTIONS); // OPTIONS

// Usage example
app.get('/users', handler);  // Same as using HttpMethod.GET
```

### HttpStatusCode

HTTP status code constants for setting response status.

```typescript
import { HttpStatusCode } from 'yinzerflow';

// Common status codes
console.log(HttpStatusCode.OK);                  // 200
console.log(HttpStatusCode.CREATED);             // 201
console.log(HttpStatusCode.NO_CONTENT);          // 204
console.log(HttpStatusCode.MOVED_PERMANENTLY);   // 301
console.log(HttpStatusCode.FOUND);               // 302
console.log(HttpStatusCode.BAD_REQUEST);         // 400
console.log(HttpStatusCode.UNAUTHORIZED);        // 401
console.log(HttpStatusCode.FORBIDDEN);           // 403
console.log(HttpStatusCode.NOT_FOUND);           // 404
console.log(HttpStatusCode.METHOD_NOT_ALLOWED);  // 405
console.log(HttpStatusCode.CONFLICT);            // 409
console.log(HttpStatusCode.GONE);                // 410
console.log(HttpStatusCode.UNPROCESSABLE_ENTITY);// 422
console.log(HttpStatusCode.TOO_MANY_REQUESTS);   // 429
console.log(HttpStatusCode.INTERNAL_SERVER_ERROR);// 500
console.log(HttpStatusCode.NOT_IMPLEMENTED);     // 501
console.log(HttpStatusCode.BAD_GATEWAY);         // 502
console.log(HttpStatusCode.SERVICE_UNAVAILABLE); // 503

// Usage example
response.setStatus(HttpStatusCode.CREATED);
```

### HttpStatus

HTTP status text constants corresponding to status codes.

```typescript
import { HttpStatus } from 'yinzerflow';

// Status texts
console.log(HttpStatus.OK);                  // OK
console.log(HttpStatus.CREATED);             // Created
console.log(HttpStatus.BAD_REQUEST);         // Bad Request
console.log(HttpStatus.UNAUTHORIZED);        // Unauthorized
console.log(HttpStatus.FORBIDDEN);           // Forbidden
console.log(HttpStatus.NOT_FOUND);           // Not Found
console.log(HttpStatus.INTERNAL_SERVER_ERROR);// Internal Server Error

// Usage example (automatic when using HttpStatusCode)
response.setStatus(HttpStatusCode.CREATED);
// Response will include "Created" as the status text
```

### ContentType

Content type constants for setting response content types.

```typescript
import { ContentType } from 'yinzerflow';

// Available content types
console.log(ContentType.JSON);      // application/json
console.log(ContentType.HTML);      // text/html
console.log(ContentType.PLAIN);     // text/plain
console.log(ContentType.XML);       // application/xml
console.log(ContentType.FORM);      // application/x-www-form-urlencoded
console.log(ContentType.MULTIPART); // multipart/form-data
console.log(ContentType.CSS);       // text/css
console.log(ContentType.JS);        // application/javascript

// Usage example
response.setContentType(ContentType.JSON);
```

## Types

### IRoute

Represents a route definition with method, path, and handler.

```typescript
import type { IRoute } from 'yinzerflow';

const route: IRoute = {
  method: 'GET',                // HTTP method
  path: '/users/:id',           // URL path with optional parameters
  handler: (context) => {       // Route handler function
    const { id } = context.request.params;
    return { id };
  },
  options: {                    // Optional route options
    beforeHandler: (context) => {
      // Middleware specific to this route
    }
  }
};
```

### TMiddleware

Represents a middleware function that can process requests and either pass to the next middleware or return a response.

```typescript
import type { TMiddleware } from 'yinzerflow';

const middleware: TMiddleware = (context, next) => {
  // Process the request
  console.log(`Request to ${context.request.path}`);
  
  // Modify the context if needed
  context.request.user = { id: 1, role: 'admin' };
  
  // Either:
  // 1. Call next() to continue to the next middleware/handler
  return next();
  
  // Or:
  // 2. Return a response to short-circuit the middleware chain
  // context.response.setStatus(401);
  // return { success: false, message: 'Unauthorized' };
};
```

### Context

Represents the context passed to route handlers and middleware, containing the request and response objects.

```typescript
import type { Context } from 'yinzerflow';

const handler = (context: Context) => {
  const { request, response } = context;
  
  // Access request data
  const userId = request.params.id;
  const queryParams = request.query;
  const requestBody = request.body;
  
  // Set response properties
  response.setStatus(200);
  response.addHeaders([{ 'X-Custom-Header': 'value' }]);
  
  // Return response body
  return {
    success: true,
    data: {
      id: userId,
      name: 'John Doe'
    }
  };
};
```

### TResponseBody

Represents the response body that can be returned from route handlers and middleware.

```typescript
import type { TResponseBody } from 'yinzerflow';

// Define a typed response
interface UserResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
  };
  error?: string;
}

// Use the type in a handler
const getUserHandler = (context): TResponseBody<UserResponse> => {
  const { id } = context.request.params;
  
  // Return typed response
  return {
    success: true,
    user: {
      id,
      name: 'John Doe'
    }
  };
};
```

## Advanced Usage

### Error Handling

Custom error handling allows you to gracefully handle exceptions:

```typescript
const app = new YinzerFlow({
  port: 3000,
  errorHandler: ({ request, response }, error) => {
    console.error('Error:', error);
    
    // Log the error with request details
    console.log(`Error occurred on ${request.method} ${request.path}`);
    
    // Set appropriate status based on error type
    if (error.name === 'ValidationError') {
      response.setStatus(HttpStatusCode.BAD_REQUEST);
      return {
        success: false,
        message: 'Validation failed',
        errors: error.details
      };
    }
    
    // Default server error response
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
    return {
      success: false,
      message: 'An unexpected error occurred',
      requestId: generateRequestId()
    };
  }
});
```

### Middleware Patterns

Middleware can be used for various purposes:

```typescript
// Authentication middleware
const authMiddleware = ({ request, response }, next) => {
  const token = request.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    response.setStatus(HttpStatusCode.UNAUTHORIZED);
    return { success: false, message: 'Authentication required' };
  }
  
  try {
    // Verify token and attach user to request
    request.user = verifyToken(token);
    return next();
  } catch (error) {
    response.setStatus(HttpStatusCode.UNAUTHORIZED);
    return { success: false, message: 'Invalid token' };
  }
};

// Rate limiting middleware
const rateLimitMiddleware = ({ request, response }, next) => {
  const clientIp = request.ip;
  
  if (isRateLimited(clientIp)) {
    response.setStatus(HttpStatusCode.TOO_MANY_REQUESTS);
    return { success: false, message: 'Too many requests' };
  }
  
  return next();
};

// Apply middleware
app.beforeAll(rateLimitMiddleware);
app.beforeAll(authMiddleware, { 
  paths: 'allButExcluded', 
  excluded: ['/login', '/register', '/public'] 
});
```

### Route Groups

Organize routes into logical groups:

```typescript
// User routes
const userRoutes = [
  app.get('/profile', getUserProfile),
  app.put('/profile', updateUserProfile),
  app.get('/settings', getUserSettings),
  app.put('/settings', updateUserSettings)
];

// Admin routes
const adminRoutes = [
  app.get('/users', getAllUsers),
  app.post('/users', createUser),
  app.delete('/users/:id', deleteUser)
];

// Apply route groups
app.group('/user', userRoutes, {
  beforeGroup: authMiddleware
});

app.group('/admin', adminRoutes, {
  beforeGroup: (ctx, next) => {
    // Check if user is admin
    if (ctx.request.user?.role !== 'admin') {
      ctx.response.setStatus(HttpStatusCode.FORBIDDEN);
      return { success: false, message: 'Admin access required' };
    }
    return next();
  }
});
``` 