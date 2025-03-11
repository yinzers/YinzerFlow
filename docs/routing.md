# Routing System

The YinzerFlow routing system provides a flexible and efficient way to define and manage routes in your application. This document explains the core components, features, and best practices for using the routing system.

## Core Components

The routing system consists of two main components:

1. **RouteRegistry**: Responsible for storing and managing routes
2. **RouteFinder**: Responsible for finding and matching routes based on requests

### RouteRegistry

The `RouteRegistry` class manages the registration and storage of routes. It provides methods for adding, removing, and retrieving routes.

```typescript
import { RouteRegistry } from 'yinzerflow';

const registry = new RouteRegistry();
```

#### Key Features

- **Event-based architecture**: Emits events when routes are added, removed, or changed
- **Path validation**: Validates route paths to ensure they follow proper formatting rules
- **Route grouping**: Supports grouping routes with common prefixes
- **Route removal**: Allows removing individual routes or clearing all routes

### RouteFinder

The `RouteFinder` class handles route lookup and matching. It uses efficient algorithms to find the appropriate route for a given request.

```typescript
import { RouteFinder } from 'yinzerflow';

const finder = new RouteFinder(registry);
```

#### Key Features

- **Pattern route caching**: Caches pattern routes for faster lookup
- **Path normalization**: Handles trailing slashes and path normalization
- **Parameter extraction**: Extracts parameters from request paths

## Route Definition

Routes in YinzerFlow are defined with a path, HTTP method, and handler function. You can also specify optional middleware functions to be executed before or after the main handler.

```typescript
app.get('/users', handleGetUsers);
app.post('/users', handleCreateUser);
app.put('/users/:id', handleUpdateUser);
app.delete('/users/:id', handleDeleteUser);
app.patch('/users/:id', handlePartialUpdateUser);
```

### Route Parameters

You can define route parameters by prefixing a path segment with a colon (`:`). These parameters will be extracted and made available in the request context.

```typescript
app.get('/users/:id', (ctx) => {
  const userId = ctx.request.params.id;
  // ...
});
```

### Route Groups

You can group routes with a common prefix using the `group` method:

```typescript
const apiRoutes = [
  app.get('/users', handleGetUsers),
  app.post('/users', handleCreateUser),
];

app.group('/api', apiRoutes);
```

This will register the routes as `/api/users` for GET and POST methods.

## Advanced Features

### Route Events

The routing system emits events when routes are added, removed, or changed. You can listen for these events to perform additional actions:

```typescript
import { RouteRegistryEvent } from 'yinzerflow/constants/route';

app.routeRegistry.on(RouteRegistryEvent.ROUTE_ADDED, (route) => {
  console.log(`New route added: ${route.method} ${route.path}`);
});
```

### Route Validation

The routing system validates route paths to ensure they follow proper formatting rules:

- Paths must start with a slash
- Paths cannot have consecutive slashes
- Path parameters must have names

If a path doesn't meet these requirements, an error will be thrown:

```typescript
try {
  app.get('invalid-path', handler); // Will throw an error
} catch (error) {
  console.error(error.message); // "Route path must start with a slash: invalid-path"
}
```

### Route Removal

You can remove routes using the `removeRoute` method:

```typescript
app.routeRegistry.removeRoute('GET', '/users/:id');
```

Or clear all routes:

```typescript
app.routeRegistry.clearRoutes();
```

## Best Practices

### Organizing Routes

For larger applications, it's recommended to organize routes by feature or resource:

```typescript
// users.routes.ts
export function registerUserRoutes(app) {
  app.get('/users', handleGetUsers);
  app.post('/users', handleCreateUser);
  // ...
}

// main.ts
registerUserRoutes(app);
```

### Route Naming Conventions

Follow these conventions for route paths:

- Use lowercase for paths
- Use hyphens for multi-word resources (e.g., `/user-profiles`)
- Use plural nouns for resource collections (e.g., `/users` instead of `/user`)
- Use singular nouns with parameters for specific resources (e.g., `/users/:id`)

### Error Handling

Implement proper error handling in your route handlers:

```typescript
app.get('/users/:id', async (ctx) => {
  try {
    const user = await getUserById(ctx.request.params.id);
    if (!user) {
      ctx.response.setStatus(404);
      return { error: 'User not found' };
    }
    return user;
  } catch (error) {
    console.error('Failed to retrieve user:', error);
    ctx.response.setStatus(500);
    return { error: 'Failed to retrieve user' };
  }
});
```

For more details on error handling, refer to the [Error Handling](./error-handling.md) documentation.

## Performance Considerations

The routing system is designed to be efficient, but here are some tips to maximize performance:

- **Avoid excessive route parameters**: Each parameter adds overhead to route matching
- **Use route groups**: Grouping routes with common prefixes improves organization and can slightly improve performance
- **Order routes by specificity**: Place more specific routes before more general ones

## Debugging Routes

You can get information about registered routes using these methods:

```typescript
// Get all routes
const routes = app.routeRegistry.getRoutes();

// Check if a route exists
const hasRoute = app.routeRegistry.hasRoute('GET', '/users/:id');

// Get the number of registered routes
const routeCount = app.routeRegistry.routeCount;
```

## Conclusion

The YinzerFlow routing system provides a flexible and efficient way to define and manage routes in your application. By understanding its core components and features, you can build well-organized and performant web applications. 