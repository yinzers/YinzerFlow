# Routes

YinzerFlow provides a powerful and flexible routing system with support for HTTP methods, route parameters, query parameters, hooks, and route grouping for organized API development.

## Configuration

Route registration is automatically enabled and requires no configuration for basic usage:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Routes are registered directly on the app instance
app.get('/api/users', (ctx) => {
  return { message: 'Users endpoint' };
});
```

### Configuration Options

YinzerFlow's routing system includes built-in security and performance optimizations:

| Feature | Default | Description |
|---------|---------|-------------|
| **Route Parameters** | Automatic | Dynamic URL segments like `/users/:id` |
| **Query Parameters** | Automatic | URL query strings like `?search=test&limit=10` |
| **Request Body** | Automatic | JSON, form data, and file uploads |
| **Response Headers** | Automatic | Security headers and custom headers |
| **Hook System** | Optional | Before/after hooks for middleware |
| **Route Groups** | Optional | Organized route prefixes and shared hooks |

## Basic Examples

For common routing patterns and examples, see [Shared Examples](./examples.md).

## HTTP Methods

YinzerFlow supports all standard HTTP methods with automatic route registration:

### GET Routes
```typescript
app.get('/api/users', (ctx) => {
  return { users: ['John', 'Jane'] };
});

// Automatically registers corresponding HEAD route
app.get('/api/users/:id', (ctx) => {
  const userId = ctx.request.params.id;
  return { userId, name: 'John Doe' };
});
```

**Note**: GET routes automatically register corresponding HEAD routes for HTTP compliance. The HEAD route uses the same handler but returns only headers, no body.

### POST Routes
```typescript
app.post('/api/users', (ctx) => {
  const userData = ctx.request.body;
  return { message: 'User created', data: userData };
});
```

### PUT Routes
```typescript
app.put('/api/users/:id', (ctx) => {
  const userId = ctx.request.params.id;
  const updateData = ctx.request.body;
  return { message: 'User updated', userId, data: updateData };
});
```

### PATCH Routes
```typescript
app.patch('/api/users/:id', (ctx) => {
  const userId = ctx.request.params.id;
  const partialData = ctx.request.body;
  return { message: 'User partially updated', userId, data: partialData };
});
```

### DELETE Routes
```typescript
app.delete('/api/users/:id', (ctx) => {
  const userId = ctx.request.params.id;
  return { message: 'User deleted', userId };
});
```

### OPTIONS Routes
```typescript
app.options('/api/users', (ctx) => {
  ctx.response.addHeaders({
    'Allow': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  return { message: 'Available methods' };
});
```

## Route Parameters

Dynamic URL segments are automatically parsed and available in `ctx.request.params`. **Parameter names must be unique within a route** to prevent conflicts and ensure clarity:

```typescript
// Single parameter
app.get('/users/:id', ({ request }) => {
  const userId = request.params.id;
  return { userId };
});

// Multiple parameters
app.get('/users/:id/posts/:postId', ({ request }) => {
  const { id, postId } = request.params;
  return { userId: id, postId };
});

// Nested parameters
app.get('/api/v1/users/:userId/orders/:orderId/items/:itemId', ({ request }) => {
  const { userId, orderId, itemId } = request.params;
  return { userId, orderId, itemId };
});
```

### Parameter Validation

YinzerFlow automatically validates route parameters to ensure they are unique:

```typescript
// ❌ This will throw an error - duplicate parameter names
app.get('/users/:id/posts/:id', ({ request }) => {
  // Error: "Route /users/:id/posts/:id has duplicate parameter names: id"
});

// ✅ This is correct - unique parameter names
app.get('/users/:userId/posts/:postId', ({ request }) => {
  const { userId, postId } = request.params;
  return { userId, postId };
});
```

**Parameter naming best practices:**
- Use descriptive names: `:userId` instead of `:id`
- Be specific: `:postId` instead of `:id` 
- Use consistent naming conventions
- Avoid generic names that could cause confusion

## Query Parameters

URL query strings are automatically parsed and available in `ctx.request.query`:

```typescript
app.get('/api/search', ({ request }) => {
  const { q, limit, page, sort } = request.query;
  
  return {
    search: q,
    limit: parseInt(limit || '10'),
    page: parseInt(page || '1'),
    sort: sort || 'name'
  };
});

// Example: GET /api/search?q=test&limit=20&page=2&sort=date
```

## Request Body

Request bodies are automatically parsed based on Content-Type:

```typescript
// JSON body
app.post('/api/users', ({ request }) => {
  const userData = request.body; // Automatically parsed JSON
  return { message: 'User created', data: userData };
});

// Form data
app.post('/api/contact', ({ request }) => {
  const formData = request.body; // Automatically parsed form data
  return { message: 'Contact form submitted', data: formData };
});

// File uploads
app.post('/api/upload', ({ request }) => {
  const files = request.body; // Automatically parsed file data
  return { message: 'Files uploaded', files };
});
```

## Route Hooks

YinzerFlow provides a powerful hook system for middleware and request/response processing:

### Inline Route Hooks
```typescript
app.post(
  "/api/users/:id",
  ({ request, response }) => {
    const userId = request.params.id;
    const userData = request.body;
    
    return {
      message: 'User updated',
      userId,
      data: userData
    };
  },
  {
    beforeHooks: [
      ({ request, response }) => {
        // Authentication check
        const token = request.headers['authorization'];
        if (!token) {
          response.setStatusCode(401);
          return { error: 'Unauthorized' };
        }
        console.log('User authenticated');
      },
      ({ request }) => {
        // Log request
        console.log(`Updating user ${request.params.id}`);
      }
    ],
    afterHooks: [
      ({ request, response }) => {
        // Add response headers
        response.addHeaders({
          'X-User-ID': request.params.id,
          'X-Updated-At': new Date().toISOString()
        });
      },
      () => {
        // Log response
        console.log('User update completed');
      }
    ],
  }
);
```

### Global Hooks
```typescript
// Before all routes
app.beforeAll([
  ({ request, response }) => {
    // Global authentication
    const token = request.headers['authorization'];
    if (!token && request.path.startsWith('/api/')) {
      response.setStatusCode(401);
      return { error: 'Authentication required' };
    }
  },
  ({ request }) => {
    // Global logging
    console.log(`${request.method} ${request.path}`);
  }
]);

// After all routes
app.afterAll([
  ({ response }) => {
    // Global response headers
    response.addHeaders({
      'X-Response-Time': Date.now().toString(),
      'X-Powered-By': 'YinzerFlow'
    });
  }
]);

// Global hooks with options for selective execution
app.beforeAll([
  ({ request, response }) => {
    // Authentication hook - only for API routes
    const token = request.headers['authorization'];
    if (!token && request.path.startsWith('/api/')) {
      response.setStatusCode(401);
      return { error: 'Authentication required' };
    }
  }
], {
  routesToInclude: ['/api/users', '/api/posts'], // Only run on specific routes
  routesToExclude: ['/api/health'] // Skip health check endpoint
});

app.afterAll([
  ({ request }) => {
    // Logging hook - exclude sensitive routes
    console.log(`${request.method} ${request.path}`);
  }
], {
  routesToExclude: ['/api/admin', '/api/secret'] // Skip logging for admin/secret routes
});
```

### Hook Execution Order

Global hooks are executed in the following order:
1. **beforeAll hooks** (global before hooks)
2. **Group beforeHooks** (if route is in a group)
3. **Route beforeHooks** (route-specific before hooks)
4. **Route handler** (the actual route handler)
5. **Route afterHooks** (route-specific after hooks)
6. **Group afterHooks** (if route is in a group)
7. **afterAll hooks** (global after hooks)

## Route Groups

Organize related routes with shared prefixes and hooks. Groups automatically merge hooks from the group level with individual route hooks:

```typescript
// API v1 routes with authentication
app.group('/api/v1', (group) => {
  group.get('/users', ({ response }) => {
    return { users: ['John', 'Jane'] };
  });
  
  group.post('/users', ({ request }) => {
    const userData = request.body;
    return { message: 'User created', data: userData };
  });
  
  group.get('/users/:id', ({ request }) => {
    const userId = request.params.id;
    return { userId, name: 'John Doe' };
  });
}, {
  beforeHooks: [
    ({ request }) => {
      // API version logging
      console.log('API v1 request');
    }
  ]
});

// Admin routes with admin authentication
app.group('/admin', (group) => {
  group.get('/dashboard', ({ response }) => {
    return { message: 'Admin dashboard' };
  });
  
  group.post('/settings', ({ request }) => {
    const settings = request.body;
    return { message: 'Settings updated', settings };
  });
}, {
  beforeHooks: [
    ({ request, response }) => {
      // Admin authentication
      const adminToken = request.headers['x-admin-token'];
      if (!adminToken) {
        response.setStatusCode(403);
        return { error: 'Admin access required' };
      }
    }
  ]
});

// Nested groups with complex hook merging
app.group('/api/v1', (v1Group) => {
  v1Group.group('/admin', (adminGroup) => {
    adminGroup.get('/users', ({ response }) => {
      return { message: 'Admin users endpoint' };
    });
  }, {
    beforeHooks: [
      () => {
        // Admin-specific hook
        console.log('Admin group hook');
      }
    ]
  });
}, {
  beforeHooks: [
    () => {
      // API v1 hook
      console.log('API v1 group hook');
    }
  ]
});
```

### Group Hook Merging

Hooks are merged in the following order:
1. **Group beforeHooks** (executed first)
2. **Route beforeHooks** (executed second)
3. **Route handler** (executed third)
4. **Route afterHooks** (executed fourth)
5. **Group afterHooks** (executed last)

This allows for flexible middleware composition where group hooks provide shared functionality and route hooks handle specific logic.

## Separate Route Files

Organize routes into separate files for better maintainability:

### routes/users.ts
```typescript
import type { YinzerFlow } from 'yinzerflow';
import { userHandlers } from '@app/handlers/users.ts';

/**
 * Register user-related routes on the main app instance
 */
export const registerUserRoutes = (app: YinzerFlow) => {
  /**
   * Get all users
   */
  app.get('/api/users', userHandlers.getAllUsers);

  /**
   * Get user by ID
   */
  app.get('/api/users/:id', userHandlers.getUserById);

  /**
   * Create new user
   */
  app.post('/api/users', userHandlers.createUser);

  /**
   * Update user
   */
  app.put('/api/users/:id', userHandlers.updateUser);

  /**
   * Delete user
   */
  app.delete('/api/users/:id', userHandlers.deleteUser);
};
```

### routes/orders.ts
```typescript
import type { YinzerFlow } from 'yinzerflow';
import { orderHandlers } from '@app/handlers/orders.ts';

/**
 * Register order-related routes on the main app instance
 */
export const registerOrderRoutes = (app: YinzerFlow) => {
  /**
   * Get all orders for a user
   */
  app.get('/api/users/:userId/orders', orderHandlers.getUserOrders);

  /**
   * Get specific order
   */
  app.get('/api/orders/:orderId', orderHandlers.getOrderById);

  /**
   * Create new order
   */
  app.post('/api/orders', orderHandlers.createOrder);

  /**
   * Update order status
   */
  app.patch('/api/orders/:orderId/status', orderHandlers.updateOrderStatus);
};
```

### Main application file
```typescript
import { YinzerFlow } from 'yinzerflow';
import { registerUserRoutes } from './routes/users.ts';
import { registerOrderRoutes } from './routes/orders.ts';

const app = new YinzerFlow({ port: 3000 });

// Register route modules
registerUserRoutes(app);
registerOrderRoutes(app);

// Start the server
await app.listen();
```

## Error Handling

YinzerFlow provides comprehensive error handling with automatic error catching and custom error handlers. The framework automatically catches all errors thrown in route handlers, hooks, and middleware.

For detailed error handling documentation including advanced patterns, security considerations, and best practices, see [Error Handling Documentation](./error-handling.md).

## HandlerCallback Interface

The `HandlerCallback` interface provides type safety for route handlers:

```typescript
import type { HandlerCallback } from 'yinzerflow';

// Basic handler
const basicHandler: HandlerCallback = ({ request, response }) => {
  return { message: 'Hello world' };
};

// Typed handler with custom body and response types
interface UserBody {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const createUserHandler: HandlerCallback<{
  body: UserBody;
  response: UserResponse;
  query: Record<string, string>;
  params: Record<string, string>;
}> = ({ request }) => {
  const userData = request.body; // Typed as UserBody
  const userId = request.params.id;
  const includeProfile = request.query.include_profile;
  
  return {
    id: 'user-123',
    name: userData.name,
    email: userData.email,
    createdAt: new Date().toISOString()
  }; // Typed as UserResponse
};
```

The interface accepts these optional generic parameters:
- `body?: unknown` - Type for request body
- `response?: unknown` - Type for response body  
- `query?: Record<string, string>` - Type for query parameters
- `params?: Record<string, string>` - Type for route parameters

Using the interface is optional but encouraged for better type safety and developer experience.

## Security Considerations

YinzerFlow implements several security measures to prevent common routing vulnerabilities. For detailed security documentation, see:

- **[Body Parsing Security](../security/body-parsing.md)** - Protection against DoS attacks and malicious payloads
- **[CORS Security](../security/cors.md)** - Cross-origin request validation and protection
- **[IP Security](../security/ip-security.md)** - Client IP validation and spoofing protection

### Key Security Features

- **Route Parameter Validation**: Automatic validation and sanitization prevents injection attacks
- **Path Traversal Protection**: Comprehensive path normalization prevents directory traversal
- **Query Parameter Sanitization**: Built-in sanitization with configurable limits
- **Request Body Validation**: Size limits and content validation prevent DoS attacks
- **Hook Execution Security**: Isolated hook execution with graceful error handling
- **Route Collision Prevention**: Automatic detection and prevention of route conflicts
- **Method Validation**: Strict HTTP method validation against RFC specifications
- **Response Header Security**: Automatic security headers and validation

These security measures ensure YinzerFlow's routing implementation follows security best practices and prevents common attack vectors while maintaining HTTP compliance and performance.
