# YinzerFlow

<div align="center">
  <h3>A lightweight, modular HTTP server framework for Node.js</h3>
  <p>Built with TypeScript. Zero dependencies. Blazing fast.</p>
</div>

## Features

- 🚀 **Lightweight & Fast**: Built from scratch with performance in mind
- 🧩 **Modular Architecture**: Easily extensible with a clean component structure
- 🔒 **Type-Safe**: Full TypeScript support with comprehensive type definitions
- 🧪 **Well-Tested**: Extensive test coverage for reliability
- 📦 **Zero Dependencies**: No bloated node_modules folder
- 🪝 **Request Lifecycle Hooks**: Powerful hooks system for request processing (formerly middleware)
- 🛣️ **Route Groups**: Organize routes with prefixes and shared hooks
- 🔄 **Event-Based Architecture**: Subscribe to framework events for advanced customization
- 🌐 **Content Type Handling**: Built-in support for JSON, XML, multipart forms, and more
- 🔌 **Connection Management**: Robust connection tracking with statistics and graceful shutdown

## Installation

```bash
npm install yinzerflow
# or
yarn add yinzerflow
# or
bun add yinzerflow
```

## Quick Start

### JavaScript

```javascript
const { YinzerFlow } = require('yinzerflow');

const app = new YinzerFlow({ port: 3000 });

app.get('/hello', ({ request }) => {
  return { message: 'Hello, World!' };
});

app.listen();
console.log('Server running on http://localhost:3000');
```

### TypeScript

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

app.get('/hello', ({ request }) => {
  return { message: 'Hello, World!' };
});

app.listen();
console.log('Server running on http://localhost:3000');
```

## Core Concepts

### Routing

```typescript
// Basic routes
app.get('/users', getAllUsersHandler);
app.post('/users', createUserHandler);
app.get('/users/:id', getUserByIdHandler);
app.put('/users/:id', updateUserHandler);
app.delete('/users/:id', deleteUserHandler);

// Route groups
app.group('/api/v1', [
  app.get('/products', getProductsHandler),
  app.post('/products', createProductHandler)
], {
  beforeGroup: authenticationHook
});
```

### Request Lifecycle Hooks

```typescript
// Global hook for all requests
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
  { paths: ['/admin/*', '/profile/*'] }
);

// Exclude specific paths
app.beforeAll(
  authHook,
  { paths: 'allButExcluded', excluded: ['/login', '/register'] }
);
```

### Content Type Handling

```typescript
// Automatically parses JSON requests
app.post('/api/json', ({ request, response }) => {
  if (!isJsonData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected JSON data' };
  }
  
  const { name, email } = request.body;
  return { success: true, data: { name, email } };
});

// Handle file uploads
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

### Connection Management

YinzerFlow provides a robust connection management system that allows you to track, monitor, and gracefully handle server connections:

```typescript
import { YinzerFlow } from 'yinzerflow';
import { ConnectionEvent } from 'yinzerflow/constants/connection';

const app = new YinzerFlow({ port: 3000 });

// Subscribe to connection events
app.connectionManager.on(ConnectionEvent.CONNECTION_ADDED, (socket) => {
  console.log('New connection established');
});

app.connectionManager.on(ConnectionEvent.CONNECTION_ERROR, (socket, error) => {
  console.error('Connection error:', error);
});

// Get connection statistics
app.get('/admin/stats', ({ request }) => {
  const stats = app.connectionManager.getStats();
  return {
    activeConnections: stats.activeConnections,
    totalConnections: stats.totalConnections,
    connectionErrors: stats.connectionErrors,
    uptime: stats.uptime
  };
});

// Graceful shutdown example
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Give connections 5 seconds to finish before force closing
  await app.connectionManager.closeAllConnections(5000);
  await app.close();
  
  console.log('Server shut down gracefully');
  process.exit(0);
});

app.listen();
console.log('Server running on http://localhost:3000');
```

## Examples

Check out the [examples](/example) directory for more detailed usage examples:

- [JavaScript Example](/example/javascript) - Basic server implementation in JavaScript
- [TypeScript Example](/example/typescript) - Type-safe server implementation in TypeScript

## Documentation

For detailed documentation, see the [docs](/docs) directory:

- [Getting Started](/docs/README.md) - Overview and quick start guide
- [Routing System](/docs/routing.md) - Comprehensive guide to the routing system
- [Request Lifecycle Hooks](/docs/hooks.md) - In-depth documentation of the hooks system
- [Content Type Handling](/docs/content-types.md) - Working with different content types
- [Error Handling](/docs/error-handling.md) - Guide to handling errors at different levels

## Project Structure

```
yinzerflow/
├── app/                # Source code
├── docs/               # Documentation
├── example/            # Usage examples
│   ├── javascript/     # JavaScript example
│   └── typescript/     # TypeScript example
├── package.json        # Package configuration
└── README.md           # This file
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Why "YinzerFlow"?

"Yinzer" is a term for a native or inhabitant of the city of Pittsburgh, Pennsylvania. The name combines the local Pittsburgh dialect with "flow" to represent the smooth flow of HTTP requests through the framework.

---

Built with ❤️ in Pittsburgh
