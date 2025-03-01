# YinzerFlow Examples

This directory contains examples of how to use the YinzerFlow framework in both JavaScript and TypeScript.

## Directory Structure

```
example/
├── javascript/        # JavaScript examples
│   ├── README.md      # JavaScript example documentation
│   ├── index.js       # Main entry point
│   ├── middleware/    # Middleware examples
│   ├── routes/        # Route examples
│   └── __tests__/     # Tests for JavaScript example
└── typescript/        # TypeScript examples
    ├── README.md      # TypeScript example documentation
    ├── index.ts       # Main entry point
    ├── middleware/    # Middleware examples
    ├── routes/        # Route examples
    └── __tests__/     # Tests for TypeScript example
```

## Choose Your Example

### [JavaScript Example](./javascript/README.md)

Perfect for:
- Node.js developers familiar with JavaScript
- Quick prototyping and simple applications
- Projects that don't require type safety

The JavaScript example demonstrates how to create a basic server with routes, middleware, and error handling using plain JavaScript.

### [TypeScript Example](./typescript/README.md)

Perfect for:
- Projects that benefit from type safety
- Larger applications with complex data structures
- Teams that prefer TypeScript's enhanced developer experience

The TypeScript example shows how to leverage YinzerFlow's full type safety features for a more robust development experience.

## Example Features

Both examples demonstrate:

1. **Server Setup**: Creating and configuring a YinzerFlow server
2. **Routing**: Defining routes with different HTTP methods (GET, POST, PUT, DELETE)
3. **Middleware**: Using middleware for authentication and request processing
4. **Error Handling**: Custom error handling for different scenarios
5. **Route Grouping**: Organizing routes into logical groups with shared prefixes
6. **Before Hooks**: Using hooks for pre-processing requests

## Testing the Examples

Each example includes a comprehensive test suite in its `__tests__` directory:

- **Running Tests**: Use `bun test example/javascript/__tests__` or `bun test example/typescript/__tests__`
- **Test Coverage**: Tests cover server configuration, routes, authentication, and error handling
- **Documentation**: Each test directory includes a README with details on the test structure

The tests demonstrate:

- Server startup and shutdown
- Route handling and response validation
- Authentication flow (login, logout, protected routes)
- Error handling and response formatting
- Type safety (in TypeScript tests)

For manual testing, each example includes instructions for testing the API endpoints using curl commands. These tests demonstrate:

- Basic route handling
- Authentication middleware
- Protected routes
- Error responses
- JSON parsing and response formatting

## Additional Resources

For more detailed documentation, check out:

- [API Documentation](/docs/api.md) - Comprehensive API reference
- [Project README](/README.md) - Overview of the YinzerFlow framework 