# YinzerFlow Documentation

Welcome to the YinzerFlow documentation! This directory contains comprehensive documentation for the YinzerFlow framework, a lightweight, modular HTTP server framework for Node.js built with TypeScript.

## Contents

- [Routing System](./routing.md) - Comprehensive guide to the routing system, including route definition, parameters, and groups.
- [Request Lifecycle Hooks](./hooks.md) - In-depth documentation of the hooks system (formerly middleware) for intercepting and modifying requests.
- [Content Type Handling](./content-types.md) - Working with different content types in requests and responses.
- [Error Handling](./error-handling.md) - Guide to handling errors at different levels in your application.
- [Connection Management](#connection-management) - Information about the built-in connection management system.

## Getting Started

If you're new to YinzerFlow, we recommend starting with the examples in the `/example` directory:

- [TypeScript Example](/example/typescript/README.md) - A type-safe server implementation in TypeScript

### Installation

You can install YinzerFlow using your preferred package manager:

```bash
# Using npm
npm install yinzerflow

# Using Yarn
yarn add yinzerflow

# Using Bun
bun add yinzerflow
```

### Quick Start

Here's a minimal example to get a server up and running:

```typescript
import { YinzerFlow } from 'yinzerflow';

// Create a new YinzerFlow instance
const app = new YinzerFlow({ port: 3000 });

// Add a simple route
app.get('/hello', () => {
  return { message: 'Hello, World!' };
});

// Start the server
await app.listen();
const { port, isListening } = app.getStatus();

if (isListening) console.log(`Server running on http://localhost:${port}`);
```

## Core Concepts

### Routing

YinzerFlow provides a simple and intuitive routing system:

```typescript
// Basic route
app.get('/users', () => {
  return { users: [] };
});

// Route with parameters
app.get('/users/:id', ({ request }) => {
  const { id } = request.params;
  return { user: { id, name: 'John Doe' } };
});

// Different HTTP methods
app.post('/users', ({ request }) => {
  const newUser = request.body;
  // Create user logic
  return { success: true, user: newUser };
});

app.put('/users/:id', ({ request }) => {
  const { id } = request.params;
  const userData = request.body;
  // Update user logic
  return { success: true };
});

app.delete('/users/:id', ({ request }) => {
  const { id } = request.params;
  // Delete user logic
  return { success: true };
});
```

For more detailed information about routing, see the [Routing System](./routing.md) documentation.

### Request Lifecycle Hooks

YinzerFlow provides a powerful hooks system (traditionally called middleware in other frameworks) that allows you to intercept and modify requests at various points in the request lifecycle:

```typescript
// Global hooks
app.beforeAll(({ request }) => {
  console.log(`Request received: ${request.method} ${request.path}`);
});

// Path-specific hooks
app.beforeAll(
  ({ request, response }) => {
    const token = request.headers['authorization'];
    if (!token) {
      response.setStatus(401);
      return { error: 'Authentication required' };
    }
  },
  { paths: ['/admin', '/profile'] }
);

// Excluded paths
app.beforeAll(
  authHook,
  { paths: 'allButExcluded', excluded: ['/login', '/register'] }
);

// Method chaining
app
  .beforeAll(logRequest)
  .beforeAll(checkAuth, { paths: ['/admin/*'] });
```

For more detailed information about hooks, see the [Request Lifecycle Hooks](./hooks.md) documentation.

### Route Groups

Group related routes under a common prefix:

```typescript
// Define routes
const userRoutes = [
  app.get('/profile', userProfileHandler),
  app.put('/profile', updateProfileHandler),
  app.get('/settings', userSettingsHandler)
];

// Apply group
app.group('/user', userRoutes, {
  beforeGroup: authHook
});
```

### Content Type Handling

YinzerFlow automatically parses request bodies based on the Content-Type header:

```typescript
// JSON data
app.post('/api/json', ({ request, response }) => {
  if (!isJsonData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected JSON data' };
  }
  
  const { name, email } = request.body;
  return { success: true, data: { name, email } };
});

// File uploads
app.post('/api/upload', ({ request, response }) => {
  if (!isMultipartFormData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected multipart form data' };
  }
  
  const { fields, files } = request.body;
  return { 
    success: true, 
    message: `Received ${Object.keys(files).length} files` 
  };
});
```

For detailed information about working with different content types, see the [Content Type Handling](./content-types.md) documentation.

### Error Handling

Custom error handling for graceful error responses:

```typescript
const app = new YinzerFlow({
  port: 3000,
  errorHandler: ({ response }, error) => {
    console.error('Error:', error);
    response.setStatus(500);
    return {
      success: false,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };
  }
});
```

### Event-Based Architecture

YinzerFlow uses an event-based architecture that allows you to subscribe to framework events:

```typescript
import { HookManagerEvent } from 'yinzerflow/constants/hooks';

// Subscribe to hook execution events
app.hooks.on(HookManagerEvent.BEFORE_ALL_EXECUTED, (context, hook) => {
  console.log(`Executed beforeAll hook for ${context.request.path}`);
});

// Subscribe to hook addition events
app.hooks.on(HookManagerEvent.HOOK_ADDED, (hook) => {
  console.log(`Added new hook for paths: ${JSON.stringify(hook.paths)}`);
});

// Subscribe to route registration events
app.routes.on('route-registered', (route) => {
  console.log(`Registered route: ${route.method} ${route.path}`);
});
```

### Connection Management

YinzerFlow includes built-in connection management that handles tracking, monitoring, and graceful shutdown of server connections. This is managed internally by the framework to ensure reliable operation.

#### Configuration

You can configure connection management options when creating a YinzerFlow instance:

```typescript
import { YinzerFlow } from 'yinzerflow';

// Create a YinzerFlow instance with connection management options
const app = new YinzerFlow({ 
  port: 3000,
  connectionOptions: {
    // Maximum time (in ms) to wait for connections to close during shutdown
    gracefulShutdownTimeout: 10000,
    // Socket timeout in milliseconds (how long until inactive connections are closed)
    socketTimeout: 60000
  }
});
```

#### Graceful Shutdown

To implement graceful shutdown in your application:

```typescript
// Graceful shutdown example
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // This will:
  // 1. Stop accepting new connections
  // 2. Wait for existing connections to complete (up to the configured timeout)
  // 3. Close the server
  await app.close();
  
  console.log('Server shut down gracefully');
  process.exit(0);
});

app.listen();
console.log('Server running on http://localhost:3000');
```

The `close()` method handles the entire shutdown process, including:
- Stopping the server from accepting new connections
- Waiting for existing connections to finish (respecting the configured timeout)
- Closing all remaining connections and the server itself

This ensures that your application can shut down cleanly without abruptly terminating active connections.

### Path Matching Patterns

YinzerFlow supports advanced path matching patterns for hooks:

```typescript
// Exact path matching
app.beforeAll(adminHook, { paths: ['/admin'] });

// Wildcard matching
app.beforeAll(apiHook, { paths: ['/api/*'] });

// Parameter matching
app.beforeAll(userHook, { paths: ['/users/:id'] });

// Regular expression matching
app.beforeAll(secureHook, { paths: [/^\/secure\/.+/] });
```

## Contributing to Documentation

We welcome contributions to improve this documentation! If you find any issues or have suggestions for improvements, please feel free to submit a pull request.

When contributing to documentation:

1. Use clear, concise language
2. Include code examples where appropriate
3. Follow Markdown best practices
4. Test all links to ensure they work correctly

## Documentation Structure

The documentation is organized as follows:

```
docs/
├── README.md                # This file - overview and getting started
├── routing.md               # Comprehensive guide to the routing system
├── hooks.md                 # In-depth documentation of the hooks system
├── content-types.md         # Working with different content types
├── error-handling.md        # Guide to handling errors at different levels in your application
```

Additional documentation files will be added as the framework evolves, including:

- Error handling and logging
- Performance optimization guides
- Security best practices
- Deployment strategies
- Troubleshooting and FAQs