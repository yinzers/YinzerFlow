# Getting Started with YinzerFlow

YinzerFlow is a lightweight, modular HTTP server framework for Node.js built with TypeScript. It provides a powerful routing system, comprehensive security features, and built-in Pittsburgh personality with flexible logging and configuration options.

## What is YinzerFlow?

YinzerFlow is designed for developers who want:
- **Security-first approach** with built-in protections against common web vulnerabilities
- **TypeScript-first development** with full type safety and IntelliSense support
- **Flexible configuration** for different deployment environments and use cases
- **Pittsburgh personality** with witty logging and error messages
- **Modular architecture** that scales from simple APIs to complex microservices

## Quick Start

For a complete quick reference with all common patterns, see [Quick Reference](./quick-reference.md).

### Installation

```bash
# Using npm
npm install yinzerflow

# Using Yarn
yarn add yinzerflow

# Using Bun
bun add yinzerflow
```

### Minimal Example

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
// Although you can log the server is started, the built in logging will log this for you already when the server is listening
```

### Basic API Example

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// GET route with parameters
app.get('/api/users/:id', ({ request }) => {
  const userId = request.params.id;
  const includeProfile = request.query.include_profile;
  
  return {
    id: userId,
    name: 'John Doe',
    includeProfile: !!includeProfile
  };
});

// POST route with body parsing
app.post('/api/users', ({ request }) => {
  const userData = request.body;
  
  return {
    message: 'User created successfully',
    data: userData
  };
});

await app.listen();
```

### Graceful Shutdown

YinzerFlow automatically handles graceful shutdown for SIGTERM and SIGINT signals. No manual setup required:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Add your routes
app.get('/hello', () => {
  return { message: 'Hello, World!' };
});

// Start the server - graceful shutdown is automatically configured
await app.listen();
```

**That's it!** YinzerFlow will automatically:
- Listen for SIGTERM and SIGINT signals
- Log the shutdown process with Pittsburgh personality
- Close the server gracefully
- Exit the process cleanly

For custom shutdown handling, see [Advanced Configuration](./advanced-configuration-options.md).

## Documentation Overview

### Core Features

- **[Routes](./core/routes.md)** - Comprehensive routing system with HTTP methods, parameters, hooks, and groups
- **[Context Object](./core/context.md)** - Central interface for request data, response controls, and request lifecycle
- **[Request Object](./core/request.md)** - Access headers, body, query parameters, route parameters, and raw body
- **[Response Object](./core/response.md)** - Set status codes, headers, and return various response types
- **[Error Handling](./core/error-handling.md)** - Automatic error catching, custom error handlers, and comprehensive error management

### Security & Configuration

- **[Security Overview](./security/security-overview.md)** - Comprehensive security features and configuration patterns
- **[Body Parsing](./security/body-parsing.md)** - Secure parsing of JSON, file uploads, and form data with DoS protection
- **[CORS](./security/cors.md)** - Cross-Origin Resource Sharing with comprehensive security measures
- **[IP Security](./security/ip-security.md)** - Client IP validation and spoofing protection for load balancers and CDNs
- **[Logging](./security/logging.md)** - Flexible logging with custom logger support and Pittsburgh personality
- **[Configuration Patterns](./configuration/configuration-patterns.md)** - Common configuration patterns and best practices
- **[Advanced Configuration](./configuration/advanced-configuration-options.md)** - Fine-tune security, performance, and functionality

### Common Use Cases

- **API Development**: Create RESTful APIs with automatic body parsing and security
- **File Uploads**: Handle multipart form data with size limits and type validation
- **Authentication**: Implement middleware hooks for token validation and user sessions
- **Rate Limiting**: Add before hooks to limit request frequency and prevent abuse
- **Load Balancer Integration**: Configure trusted proxies for accurate client IP detection
- **Production Monitoring**: Use custom loggers with structured logging and monitoring

## Key Features

### 🛡️ Security First
- Built-in protection against DoS attacks, prototype pollution, and memory exhaustion
- Automatic security headers and CORS validation
- IP spoofing protection with trusted proxy validation
- Comprehensive input validation and sanitization

### 🔧 Flexible Configuration
- Configurable body parsing limits and security settings
- Custom logger integration (Winston, Pino, etc.)
- Environment-specific configurations (development, production, high-security)
- Graceful shutdown with connection timeout handling

### 🚀 TypeScript Native
- Full TypeScript support with comprehensive type definitions
- IntelliSense support for all framework features
- Type-safe request/response handling
- Generic support for custom body and response types

### 🎭 Pittsburgh Personality
- Witty logging messages and error handling
- Built-in Pittsburgh-themed personality
- Customizable logging with familiar `log.info()` interface
- Network request logging with nginx-style formatting

## Next Steps

1. **Start with Routes**: Learn the routing system in [routes.md](./routes.md)
2. **Understand Requests**: Explore request handling in [request.md](./request.md)
3. **Configure Security**: Set up IP security and CORS in [ip-security.md](./ip-security.md) and [cors.md](./cors.md)
4. **Customize Logging**: Implement custom loggers in [logging.md](./logging.md)
5. **Advanced Configuration**: Fine-tune settings in [advanced-configuration-options.md](./advanced-configuration-options.md)

## Examples

Check out the `/example` directory for complete working examples:

- **TypeScript Example** - Full-featured API with authentication, file uploads, and custom logging
- **Basic Example** - Minimal server setup for quick prototyping
- **Production Example** - High-security configuration with monitoring and graceful shutdown

## Contributing

We welcome contributions! Please see our contribution guidelines and feel free to submit pull requests for documentation improvements, bug fixes, or new features.

---

**Ready to build something amazing?** Start with the [Routes documentation](./routes.md) to learn how to create your first API endpoints!