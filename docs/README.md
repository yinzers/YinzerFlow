# YinzerFlow Documentation

Welcome to the YinzerFlow documentation! This directory contains comprehensive documentation for the YinzerFlow framework, a lightweight, modular HTTP server framework for Node.js built with TypeScript.

## Contents

- [API Documentation](./api.md) - Detailed documentation of the YinzerFlow API, including core classes, methods, constants, and types.

## Getting Started

If you're new to YinzerFlow, we recommend starting with the examples in the `/example` directory:

- [JavaScript Example](/example/javascript/README.md) - A basic server implementation in JavaScript
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
console.log('Server running on http://localhost:3000');
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

### Middleware

Middleware functions can process requests before they reach route handlers:

```typescript
// Global middleware
app.beforeAll(({ request }, next) => {
  console.log(`Request received: ${request.method} ${request.path}`);
  return next();
});

// Path-specific middleware
app.beforeAll(
  ({ request, response }, next) => {
    const token = request.headers['authorization'];
    if (!token) {
      response.setStatus(401);
      return { success: false, message: 'Authentication required' };
    }
    return next();
  },
  { paths: ['/admin', '/profile'] }
);

// Excluded paths middleware
app.beforeAll(
  authMiddleware,
  { paths: 'allButExcluded', excluded: ['/login', '/register'] }
);
```

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
  beforeGroup: authMiddleware
});
```

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

## Advanced Topics

For more advanced usage, check out the following documentation:

### Handling Different Content-Types In A Request ✅

YinzerFlow automatically parses request bodies based on the Content-Type header. The framework supports JSON, XML, form data, file uploads, CSV, YAML, and more.

```typescript
// Request body is automatically parsed based on Content-Type
app.post('/api/data', ({ request }) => {
  const data = request.body;
  return { received: data };
});
```

For detailed information about working with different content types, including type guards and examples, see the [Content Type Handling](./content-types.md) documentation.

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
├── content-types.md         # Working with different content types
```

Additional documentation files will be added as the framework evolves, including:

- Middleware and routing
- Error handling and logging
- Performance optimization guides
- Security best practices
- Deployment strategies
- Troubleshooting and FAQs