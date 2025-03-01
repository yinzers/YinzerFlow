# YinzerFlow Framework Source Code

This directory contains the source code for the YinzerFlow framework.

## Directory Structure

```
app/
├── constants/        # Constants used throughout the application
├── core/             # Core framework components
│   └── __tests__/    # Tests for core components
├── types/            # Type definitions
│   └── http/         # HTTP-specific types
├── utils/            # Utility functions
│   └── __tests__/    # Tests for utilities
└── index.ts          # Main entry point
```

## Core Components

The framework is built around several core components, each with a single responsibility:

- **YinzerFlow**: Main server class that orchestrates all components
- **RouteRegistry**: Manages route registration and storage
- **RouteFinder**: Finds the appropriate route for a given request
- **MiddlewareManager**: Manages middleware registration
- **MiddlewareExecutor**: Executes middleware in the correct order
- **RequestHandler**: Handles incoming HTTP requests
- **RequestParser**: Parses HTTP request components
- **ResponseFormatter**: Formats HTTP responses
- **ConnectionManager**: Manages server connections
- **HttpRequest**: Represents an HTTP request
- **HttpResponse**: Represents an HTTP response

## Development

### Running Tests

```bash
# Run all tests
bun test

# Run specific tests
bun test app/core/__tests__/HttpResponse.spec.ts
```

### Building

```bash
# Build the framework
bun build.ts
```

## Documentation

For detailed API documentation, see the [/docs](/docs) directory at the root of the project.

## Examples

For examples of how to use the framework, see the [/example](/example) directory at the root of the project. 