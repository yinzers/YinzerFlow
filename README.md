# YinzerFlow

A lightweight, modular HTTP server framework for Node.js built with TypeScript. Features comprehensive security protections, Pittsburgh personality, and flexible configuration options.

## 🚀 Quick Start

For complete documentation and examples, see **[docs/start-here.md](docs/start-here.md)**.

## 📦 Installation

```bash
npm install yinzerflow
# or
bun add yinzerflow
```

## 🔧 Basic Usage

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

app.get('/hello', () => {
  return { message: 'Hello, World!' };
});

await app.listen();
```

## ✨ Features

- **Security-first** - Built-in protections against common web vulnerabilities
- **TypeScript-first** - Full type safety and IntelliSense support
- **Pittsburgh personality** - Witty logging and error messages
- **Flexible configuration** - Comprehensive options for different use cases
- **Modular architecture** - Scales from simple APIs to complex applications

## 📚 Documentation

- **[Getting Started](docs/start-here.md)** - Complete guide and examples
- **[Routes](docs/routes.md)** - Routing system and handlers
- **[Request/Response](docs/request.md)** - Request and response objects
- **[Logging](docs/logging.md)** - Logging configuration and customization
- **[Advanced Configuration](docs/advanced-configuration-options.md)** - Detailed configuration options

## 🛡️ Security

YinzerFlow includes comprehensive security features:
- IP security and rate limiting
- CORS protection
- Body parsing with security limits
- Header validation and sanitization
- Prototype pollution protection

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
