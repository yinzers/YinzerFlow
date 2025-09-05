# Logging

YinzerFlow provides a flexible logging system with built-in Pittsburgh personality and performance tracking.

## Configuration

```typescript
import { YinzerFlow, createLogger } from 'yinzerflow';

const logger = createLogger({
  prefix: 'MYAPP',
  logLevel: 'info'
});

const server = new YinzerFlow({
  port: 3000,
  logger,
  networkLogs: true
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logLevel` | `'off' \| 'error' \| 'warn' \| 'info'` | `'info'` | Minimum log level to output |
| `prefix` | `string` | `'YINZER'` | Prefix for log messages |
| `logger` | `Logger` | `undefined` | Custom logger implementation (Winston, Pino, etc.) |
| `networkLogs` | `boolean` | `false` | Enable nginx-style network request logging |
| `networkLogger` | `Logger` | `undefined` | Custom logger for network logs (can be same as `logger` or different) |

## Examples

### Basic Example

```typescript
import { log } from 'yinzerflow';

// Use the shared logger (default YINZER prefix)
log.info('Application started');
log.warn('Deprecated feature used');
log.error('Operation failed');
```

### Custom Logger

```typescript
import { createLogger } from 'yinzerflow';

const dbLogger = createLogger({ 
  prefix: 'DATABASE', 
  logLevel: 'error' 
});

dbLogger.error('Connection failed');
// Output: [DATABASE] ❌ [timestamp] [ERROR] Connection failed - aw jeez
```

### Unified Network and App Logging

```typescript
import { YinzerFlow, createLogger } from 'yinzerflow';

const logger = createLogger({ prefix: 'APP', logLevel: 'info' });

const server = new YinzerFlow({
  port: 3000,
  logger,
  networkLogs: true,
  networkLogger: logger  // Route network logs to same logger
});

// Both app and network logs go to the same custom logger
```

## Common Use Cases

- **Debug Development Issues**: Use default logger with `networkLogs: true` for comprehensive debugging
- **Track Application Errors**: Use `logLevel: 'error'` to capture only critical errors  
- **Monitor Component Health**: Create isolated loggers per subsystem with custom prefixes
- **Integrate External Logging**: Use custom logger implementation for Winston, Pino, etc.
- **Silent Operation**: Set `logLevel: 'off'` for environments with external log management
- **Script and Utility Logging**: Use shared `log` instance in standalone scripts and database seeds

## Methods

### `createLogger(options?): Logger`

Creates a logger instance with isolated state.

**Parameters:**
- `logLevel?: 'off' | 'error' | 'warn' | 'info'` - Minimum log level (default: 'info')
- `prefix?: string` - Log message prefix (default: 'YINZER')  
- `logger?: Logger` - Custom logger implementation

**Returns:** Logger with `info`, `warn`, `error`, and `levels` methods.

### Logger Methods

- `info(...args): void` - Log info-level messages
- `warn(...args): void` - Log warning messages
- `error(...args): void` - Log error messages
- `levels` - Access to log level constants

## Properties

### Log Levels

- `off` (0): No logging
- `error` (1): Only errors
- `warn` (2): Warnings and errors
- `info` (3): All messages (most verbose)

## Security Considerations

YinzerFlow implements several security measures for safe logging:

### 🛡️ Safe Data Handling
- **Problem**: Logging sensitive data can expose secrets in log files
- **YinzerFlow Solution**: Uses native `console.log` formatting to prevent accidental serialization of sensitive objects

### 🛡️ Log Level Protection
- **Problem**: Verbose logging in production can impact performance and expose internal details  
- **YinzerFlow Solution**: Configurable log levels with early returns to minimize overhead when logging is disabled

### 🛡️ Logger Isolation
- **Problem**: Custom loggers could interfere with framework logging
- **YinzerFlow Solution**: Clean interface boundaries and isolated logger instances prevent conflicts

These security measures ensure YinzerFlow's logging implementation follows security best practices and prevents common attack vectors while maintaining spec compliance.