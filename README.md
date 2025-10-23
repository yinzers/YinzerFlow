# YinzerFlow

A lightweight, modular HTTP server framework for Node.js and Bun built with TypeScript. This is a **framework project**, not an API or application. The code here is meant to be used by other developers to build their own applications.



## ✨ Features

YinzerFlow is designed for developers who want:

- **Security-first** — Built-in protections against common web vulnerabilities
- **TypeScript-first** — Full type safety and IntelliSense support (JavaScript is supported natively)
- **Pittsburgh personality** — Witty logging and error messages
- **Flexible configuration** — Comprehensive options for different use cases
- **Modular architecture** — Scales from simple APIs to complex applications

## 🚀 Quick Start

```bash
# Install
npm install yinzerflow
# or
bun add yinzerflow
```

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

app.get('/hello', () => {
  return { message: 'Hello, World!' };
});

await app.listen();
```

YinzerFlow works right out of the box—no configuration required. However, plenty of configuration options are available.

## 📚 Documentation

For complete documentation, examples, and guides, see the **[docs/](docs/)** folder:

- **[Core Concepts](docs/core/core-concepts.md)** - Context, Request, Response, Routing, and Hooks
- **[Configuration](docs/configuration/configuration.md)** - All configuration options
- **[Modules](docs/modules/)** - Built-in modules (Rate Limiting, CORS, IP Security, Body Parsing)

**📖 [Official Documentation](https://redactdigital.notion.site/YinzerFlow-Web-Framework-Using-bun-and-typescript-293f97dd45ce80ea830deb5197ef7004)** - Published docs with interactive examples

## 🛡️ Built-in Security

YinzerFlow includes comprehensive security features out of the box:

- **Rate limiting** - Protection against DoS attacks (enabled by default)
- **IP security** - Advanced IP validation and spoofing detection
- **CORS protection** - Configurable cross-origin resource sharing
- **Body parsing limits** - Protection against payload attacks
- **Header validation** - Automatic sanitization and size limits
- **CRLF injection prevention** - Secure header handling

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.