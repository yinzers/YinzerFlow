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

## Context State Examples

### Basic State Usage

```typescript
app.get('/api/users', async (ctx) => {
  // Store simple data in state
  ctx.state.requestId = generateRequestId();
  ctx.state.timestamp = Date.now();
  ctx.state.clientIp = ctx.request.ipAddress;
  
  // Access the stored data
  console.log(`Request ${ctx.state.requestId} from ${ctx.state.clientIp}`);
  
  return { users: ['John', 'Jane'] };
});
```

### Authentication State Pattern

```typescript
// Authentication middleware
const authMiddleware: HandlerCallback = async (ctx) => {
  const token = ctx.request.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Unauthorized');
  }
  
  try {
    const user = await validateJWT(token);
    const permissions = await getUserPermissions(user.id);
    
    // Store authentication data in state
    ctx.state.user = user;
    ctx.state.permissions = permissions;
    ctx.state.isAuthenticated = true;
    ctx.state.authTimestamp = Date.now();
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Protected route using the state
app.get('/api/admin/users', authMiddleware, async (ctx) => {
  // Access the authenticated user data
  const { user, permissions, isAuthenticated } = ctx.state;
  
  if (!permissions.includes('admin')) {
    throw new Error('Insufficient permissions');
  }
  
  return {
    message: 'Admin access granted',
    user: { id: user.id, name: user.name },
    permissions,
    authenticatedAt: ctx.state.authTimestamp
  };
});
```

### Typed State Pattern

```typescript
// Define your state interface
interface UserContext extends InternalHandlerCallbackGenerics {
  state: {
    user: User;
    permissions: string[];
    requestId: string;
    session: {
      id: string;
      expiresAt: Date;
      lastActivity: Date;
    };
  };
}

// Use typed state in your handler
const userProfileHandler: HandlerCallback<UserContext> = async (ctx) => {
  // Fully type-safe access to state
  const { user, permissions, session } = ctx.state;
  
  // No type assertions needed!
  if (session.expiresAt < new Date()) {
    throw new Error('Session expired');
  }
  
  // Update session activity
  ctx.state.session.lastActivity = new Date();
  
  return {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      permissions
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      lastActivity: ctx.state.session.lastActivity
    }
  };
};
```

### Middleware Chain State Pattern

```typescript
// Rate limiting middleware
const rateLimitMiddleware: HandlerCallback = async (ctx) => {
  const clientIp = ctx.request.ipAddress;
  const currentCount = await getRequestCount(clientIp);
  
  if (currentCount > 100) {
    throw new Error('Rate limit exceeded');
  }
  
  // Store rate limiting data in state
  ctx.state.rateLimit = {
    clientIp,
    currentCount,
    limit: 100,
    resetTime: Date.now() + 60000 // 1 minute
  };
  
  await incrementRequestCount(clientIp);
};

// Logging middleware
const loggingMiddleware: HandlerCallback = async (ctx) => {
  // Access state from previous middleware
  const rateLimit = ctx.state.rateLimit;
  
  ctx.state.logData = {
    requestId: generateRequestId(),
    timestamp: Date.now(),
    clientIp: ctx.request.ipAddress,
    rateLimitInfo: rateLimit,
    userAgent: ctx.request.headers['user-agent']
  };
  
  console.log('Request started:', ctx.state.logData);
};

// Route using both middlewares
app.get('/api/data', rateLimitMiddleware, loggingMiddleware, async (ctx) => {
  // Access state from all previous middleware
  const { rateLimit, logData } = ctx.state;
  
  // Add route-specific data to state
  ctx.state.routeData = {
    endpoint: '/api/data',
    method: 'GET',
    processingTime: Date.now() - logData.timestamp
  };
  
  return {
    message: 'Data retrieved successfully',
    rateLimit: {
      remaining: rateLimit.limit - rateLimit.currentCount,
      resetTime: rateLimit.resetTime
    },
    requestInfo: logData,
    routeInfo: ctx.state.routeData
  };
});
```

### Route Group State Pattern

```typescript
app.group('/api/v1', (api) => {
  // Global API state
  api.beforeAll([async (ctx) => {
    ctx.state.apiVersion = 'v1';
    ctx.state.environment = process.env.NODE_ENV;
    ctx.state.baseUrl = 'https://api.example.com';
  }]);
  
  api.group('/admin', (admin) => {
    // Admin-specific state
    admin.beforeAll([async (ctx) => {
      ctx.state.requiresAuth = true;
      ctx.state.adminOnly = true;
      ctx.state.auditLog = true;
    }]);
    
    admin.group('/users', (users) => {
      // User management state
      users.beforeAll([async (ctx) => {
        ctx.state.resourceType = 'user';
        ctx.state.allowedOperations = ['create', 'read', 'update', 'delete'];
      }]);
      
      // Route inherits all state from parent groups
      users.get('/', async (ctx) => {
        const {
          apiVersion,        // "v1"
          environment,       // "production"
          requiresAuth,      // true
          adminOnly,         // true
          auditLog,          // true
          resourceType,      // "user"
          allowedOperations  // ["create", "read", "update", "delete"]
        } = ctx.state;
        
        return {
          message: 'User list retrieved',
          apiInfo: { version: apiVersion, environment },
          security: { requiresAuth, adminOnly, auditLog },
          resource: { type: resourceType, operations: allowedOperations }
        };
      });
    });
  });
});
```

### State Validation Pattern

```typescript
// State validation helper
const validateState = (ctx: Context, requiredKeys: string[]) => {
  const missing = requiredKeys.filter(key => !(key in ctx.state));
  
  if (missing.length > 0) {
    throw new Error(`Missing required state: ${missing.join(', ')}`);
  }
};

// Middleware that sets required state
const userContextMiddleware: HandlerCallback = async (ctx) => {
  const userId = ctx.request.params.userId;
  
  if (!userId) {
    throw new Error('User ID required');
  }
  
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Set required state
  ctx.state.user = user;
  ctx.state.userId = userId;
  ctx.state.userPermissions = await getUserPermissions(userId);
};

// Route that validates state
app.get('/api/users/:userId/profile', userContextMiddleware, async (ctx) => {
  // Validate required state
  validateState(ctx, ['user', 'userId', 'userPermissions']);
  
  // Now we can safely access state
  const { user, userPermissions } = ctx.state;
  
  return {
    profile: user,
    permissions: userPermissions,
    lastAccessed: new Date().toISOString()
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