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
- 🔌 **Middleware Support**: Flexible middleware system for request processing
- 🛣️ **Route Groups**: Organize routes with prefixes and shared middleware
- 🪝 **Hooks**: Before-hooks for fine-grained control over request flow

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

## Examples

Check out the [examples](/example) directory for more detailed usage examples:

- [JavaScript Example](/example/javascript) - Basic server implementation in JavaScript
- [TypeScript Example](/example/typescript) - Type-safe server implementation in TypeScript

## Documentation

For detailed documentation, see the [docs](/docs) directory:

- [API Documentation](/docs/api.md) - Comprehensive API reference

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
