# Logging

YinzerFlow provides a flexible logging system with built-in Pittsburgh personality and support for custom logging libraries. All framework and user log calls use the familiar `log.info()`, `log.warn()`, `log.error()` interface, which can be routed to custom logging libraries like Winston or Pino.

## Configuration

Basic setup with default YinzerFlow logger:

```typescript
import { YinzerFlow } from 'yinzerflow';

const server = new YinzerFlow({
  logLevel: 'info',
  networkLogs: true
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logLevel` | `'off' \| 'error' \| 'warn' \| 'info'` | `'warn'` | Application logging level |
| `networkLogs` | `boolean` | `false` | Enable nginx-style network request logging |
| `logger` | `Logger` | `undefined` | Custom logger for application logs |
| `networkLogger` | `Logger` | `undefined` | Custom logger for network logs (optional) |

## Examples

### Basic Example
```typescript
import { YinzerFlow } from 'yinzerflow';

const server = new YinzerFlow({
  logLevel: 'info',
  networkLogs: true
});

await server.listen();
```

Users can also use the built in logger as well by importing the log directly from yinzerflow
```typescript
import { YinzerFlow, log } from 'yinzerflow';

const server = new YinzerFlow({
  logLevel: 'info',
  networkLogs: true
});

log.info('The server is starting')

await server.listen();
```

### Custom Logger Example
```typescript
import { YinzerFlow } from 'yinzerflow';
import winston from 'winston';
import type { Logger } from 'yinzerflow';

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Winston adapter implementing YinzerFlow's Logger interface
const winstonAdapter: Logger = {
  info: (...args) => winstonLogger.info(...args),
  warn: (...args) => winstonLogger.warn(...args),
  error: (...args) => winstonLogger.error(...args),
  debug: (...args) => winstonLogger.debug(...args),
  trace: (...args) => winstonLogger.silly(...args),
};

// Use custom logger - all log.info(), log.warn(), etc. calls will route to Winston
const server = new YinzerFlow({
  logger: winstonAdapter,
  logLevel: 'info',
  networkLogs: true
});

// User can also use the same log interface in their code
log.info('User action', { userId: 123, action: 'login' });
// This also routes to Winston!
```

### Unified Logging with Datadog Example
```typescript
import { YinzerFlow } from 'yinzerflow';
import winston from 'winston';
import type { Logger } from 'yinzerflow';

// Create Winston logger with Datadog transport
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.Http({
      host: 'http-intake.logs.datadoghq.com',
      path: `/api/v2/logs?dd-api-key=${process.env.DD_API_KEY}&ddsource=nodejs&service=yinzerflow`,
      ssl: true
    })
  ]
});

const winstonAdapter: Logger = {
  info: (...args) => winstonLogger.info(...args),
  warn: (...args) => winstonLogger.warn(...args),
  error: (...args) => winstonLogger.error(...args),
  debug: (...args) => winstonLogger.debug(...args),
  trace: (...args) => winstonLogger.silly(...args),
};

// Use same logger for both application and network logs
const server = new YinzerFlow({
  logger: winstonAdapter,        // Application logs → Winston → Datadog
  networkLogger: winstonAdapter, // Network logs → Winston → Datadog
  logLevel: 'info',
  networkLogs: true
});

// Now both application and network logs go to Datadog!
```

### Pino Logger Example
```typescript
import { YinzerFlow } from 'yinzerflow';
import pino from 'pino';
import type { Logger } from 'yinzerflow';

const pinoLogger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty'
  }
});

const pinoAdapter: Logger = {
  info: (...args) => pinoLogger.info(...args),
  warn: (...args) => pinoLogger.warn(...args),
  error: (...args) => pinoLogger.error(...args),
  debug: (...args) => pinoLogger.debug(...args),
  trace: (...args) => pinoLogger.trace(...args),
};

const server = new YinzerFlow({
  logger: pinoAdapter
});
```

## Common Use Cases

- **Development Debugging**: Use `logLevel: 'info'` with network logs enabled for comprehensive debugging
- **Production Monitoring**: Use custom Winston/Pino logger with structured logging and file output
- **Silent Operation**: Set `logLevel: 'off'` for production environments where logging is handled externally
- **Error Tracking**: Use `logLevel: 'error'` to capture only critical errors with custom error reporting
- **Performance Monitoring**: Enable network logs to track request/response times and identify bottlenecks
- **Security Auditing**: Use custom logger with audit trails for compliance and security monitoring
- **Unified Logging**: Framework and user logs both use the same `log.info()` interface and route to the same custom logger
- **Infrastructure Monitoring**: Network logs provide nginx-style request/response logging separate from application logs

## Logger Interface

To use a custom logger, implement the `Logger` interface:

```typescript
interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug?(...args: unknown[]): void;
  trace?(...args: unknown[]): void;
}
```

All methods accept unlimited arguments just like `console.log()`. The interface is designed to be simple and compatible with most logging libraries.

## How It Works

1. **Framework Integration**: YinzerFlow automatically routes all internal log calls through the LoggerFactory
2. **User Code**: Your application code uses the same `log.info()`, `log.warn()`, etc. interface
3. **Custom Logger**: If provided, all log calls route to your custom logger implementation
4. **Built-in Fallback**: If no custom logger is set, YinzerFlow uses its built-in styled logger
5. **Network Logs**: Network request/response logs can route to custom logger or use built-in formatting

This design ensures:
- **Consistent API**: Same logging interface everywhere
- **Flexible Output**: Route to any logging library or transport
- **Zero Breaking Changes**: Existing code continues to work
- **Clear Separation**: Application logs vs infrastructure logs (but can be unified)

## Network Logs vs Application Logs

YinzerFlow maintains a clear separation between two types of logging:

### Application Logs
- **Purpose**: Business logic, user actions, errors, debugging
- **Interface**: `log.info()`, `log.warn()`, `log.error()`, etc.
- **Custom Logger**: Routes to your custom logger if provided
- **Examples**: User login, database errors, validation failures

### Network Logs  
- **Purpose**: Infrastructure monitoring, request/response tracking
- **Interface**: Automatic nginx-style logging
- **Custom Logger**: **Optional** - can route to custom logger or use built-in formatting
- **Examples**: HTTP requests, response times, connection events

This separation allows you to:
- Use structured logging for application events (Winston/Pino)
- Keep infrastructure logs in a consistent, readable format
- Route application logs to different destinations than network logs
- Maintain clear boundaries between business and infrastructure concerns
- **Unified monitoring**: Use same logger for both (e.g., Winston with Datadog transport)
- **Flexible routing**: Route network logs to monitoring systems while keeping app logs separate
```

### Built-in Logger Features

The default YinzerFlow logger includes:

- **Pittsburgh Personality**: Random phrases and emojis for friendly logging
- **Performance Logging**: `perf()` method for timing operations
- **Level Management**: `setLogLevel()` for runtime level changes
- **Console-like Behavior**: Accepts unlimited arguments like `console.log`

### Methods

| Method | Description |
|--------|-------------|
| `info(...args)` | Log informational messages |
| `warn(...args)` | Log warning messages |
| `error(...args)` | Log error messages |
| `debug(...args)` | Log debug messages (optional) |
| `trace(...args)` | Log trace messages (optional) |

## Error Handling

YinzerFlow's logging system handles errors gracefully:

- **Invalid Log Levels**: Defaults to `'warn'` if invalid level provided
- **Custom Logger Failures**: Falls back to built-in logger if custom logger throws errors
- **Network Log Errors**: Network logging failures don't affect application logging
- **Missing Logger Methods**: Optional methods (`debug`, `trace`) are safely ignored if not implemented

## Security Considerations

YinzerFlow implements several security measures for logging:

### 🛡️ Input Sanitization
- **Problem**: Malicious log input can cause injection attacks or log poisoning
- **YinzerFlow Solution**: All log arguments are safely handled through console.log's native formatting

### 🛡️ Sensitive Data Protection
- **Problem**: Logs may accidentally expose sensitive information like passwords or tokens
- **YinzerFlow Solution**: Built-in logger uses console.log's safe object formatting, custom loggers can implement their own sanitization

### 🛡️ Log Level Validation
- **Problem**: Invalid log levels could cause unexpected behavior or information leakage
- **YinzerFlow Solution**: Strict validation of log levels with safe defaults

### 🛡️ Custom Logger Isolation
- **Problem**: Custom loggers with vulnerabilities could compromise the application
- **YinzerFlow Solution**: Custom loggers are isolated and failures don't affect core functionality

These security measures ensure YinzerFlow's logging implementation follows security best practices and prevents common attack vectors while maintaining spec compliance.

## Integration with Other Systems

### Winston Integration
```typescript
import winston from 'winston';

const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'yinzerflow' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const winstonAdapter: Logger = {
  info: (...args) => winstonLogger.info(...args),
  warn: (...args) => winstonLogger.warn(...args),
  error: (...args) => winstonLogger.error(...args),
  debug: (...args) => winstonLogger.debug(...args),
  trace: (...args) => winstonLogger.silly(...args),
};
```

### Pino Integration
```typescript
import pino from 'pino';

const pinoLogger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

const pinoAdapter: Logger = {
  info: (...args) => pinoLogger.info(...args),
  warn: (...args) => pinoLogger.warn(...args),
  error: (...args) => pinoLogger.error(...args),
  debug: (...args) => pinoLogger.debug(...args),
  trace: (...args) => pinoLogger.trace(...args),
};
```

### Custom Structured Logger
```typescript
interface StructuredLogger extends Logger {
  log(level: string, message: string, meta?: Record<string, unknown>): void;
}

const structuredAdapter: StructuredLogger = {
  info: (...args) => console.log(JSON.stringify({ level: 'info', message: args[0], data: args.slice(1) })),
  warn: (...args) => console.log(JSON.stringify({ level: 'warn', message: args[0], data: args.slice(1) })),
  error: (...args) => console.log(JSON.stringify({ level: 'error', message: args[0], data: args.slice(1) })),
  debug: (...args) => console.log(JSON.stringify({ level: 'debug', message: args[0], data: args.slice(1) })),
  trace: (...args) => console.log(JSON.stringify({ level: 'trace', message: args[0], data: args.slice(1) })),
  log: (level, message, meta) => console.log(JSON.stringify({ level, message, ...meta }))
};
``` 