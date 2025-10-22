# 📖 Logging

YinzerFlow provides a flexible logging system with built-in Pittsburgh personality, performance tracking, and support for custom logger implementations.

For detailed configuration examples and patterns, see [Configuration Guide](../configuration/configuration.md).

# ⚙️ Usage

## 🎛️ Settings

### Log Level — @default <span style="color: #2ecc71">`'info'`</span>

Minimum log level to output messages.

```typescript
import { createLogger } from 'yinzerflow';

const logger = createLogger({
  logLevel: 'info'  // 'off', 'error', 'warn', 'info'
});

logger.info('This will be logged');
logger.warn('This will be logged');
logger.error('This will be logged');
```

<aside>

Options: `'off' | 'error' | 'warn' | 'info'`

- `'off'`: No logging at all
- `'error'`: Only errors
- `'warn'`: Warnings and errors
- `'info'`: All messages (most verbose)
</aside>

### Prefix — @default <span style="color: #2ecc71">`'YINZER'`</span>

Prefix for log messages to identify different components.

```typescript
import { createLogger } from 'yinzerflow';

const dbLogger = createLogger({
  prefix: 'DATABASE',
  logLevel: 'error'
});

dbLogger.error('Connection failed');
// Output: [DATABASE] ❌ [timestamp] [ERROR] Connection failed - aw jeez
```

<aside>

Options: `string`

- Default: `'YINZER'`
- Used to identify different components or modules
- Appears in all log messages as `[PREFIX]`
</aside>

### Custom Logger — @default <span style="color: #2ecc71">`undefined`</span>

Custom logger implementation for integration with external logging systems.

```typescript
import { YinzerFlow } from 'yinzerflow';

// Winston logger implementation
const winstonLogger = {
  info: (...args) => winston.info(args.join(' ')),
  warn: (...args) => winston.warn(args.join(' ')),
  error: (...args) => winston.error(args.join(' '))
};

const app = new YinzerFlow({
  port: 3000,
  logger: winstonLogger
});
```

<aside>

Options: `Logger | undefined`

- Custom logger must implement `info`, `warn`, `error` methods
- Each method accepts variable arguments
- Methods should not return values (void)
- Falls back to built-in logger if undefined
</aside>

### Network Logs — @default <span style="color: #e74c3c">`false`</span>

Enable nginx-style network request logging.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  networkLogs: true  // Enable network request logging
});
```

<aside>

Options: `boolean`

- `false`: No network logging (default)
- `true`: Enable nginx-style request/response logging
- Separate from application logging
- Can use different logger instance
</aside>

# ✨ Best Practices

- **Use appropriate log levels** - error for failures, warn for issues, info for status
- **Create component-specific loggers** - Use different prefixes for different modules
- **Integrate with external systems** - Use custom loggers for Winston, Pino, etc.
- **Enable network logs in development** - Use `networkLogs: true` for debugging
- **Use table logging for structured data** - Use `log.table()` for arrays and objects
- **Avoid logging sensitive data** - Be careful with passwords, tokens, etc.

# 💻 Examples

### Production API

**Use Case:** Production API with structured logging and external log management

**Description:** Production-ready logging with Winston integration, structured JSON output, and comprehensive error tracking for monitoring and debugging.

```typescript
import { YinzerFlow, createLogger } from 'yinzerflow';
import winston from 'winston';

// Production Winston logger
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Custom logger implementation
const customLogger = {
  info: (...args) => winstonLogger.info(args.join(' ')),
  warn: (...args) => winstonLogger.warn(args.join(' ')),
  error: (...args) => winstonLogger.error(args.join(' '))
};

// Component-specific loggers
const dbLogger = createLogger({
  prefix: 'DATABASE',
  logLevel: 'error',
  logger: customLogger
});

const authLogger = createLogger({
  prefix: 'AUTH',
  logLevel: 'warn',
  logger: customLogger
});

const apiLogger = createLogger({
  prefix: 'API',
  logLevel: 'info',
  logger: customLogger
});

const app = new YinzerFlow({
  port: 3000,
  logger: customLogger,
  networkLogs: true,
  networkLogger: customLogger
});

// Database operations
const connectToDatabase = async () => {
  try {
    await database.connect();
    dbLogger.info('Database connection established');
  } catch (error) {
    dbLogger.error('Database connection failed', error);
    throw error;
  }
};

// Authentication operations
const validateToken = async (token: string) => {
  try {
    const user = await jwt.verify(token);
    authLogger.info('Token validated successfully', { userId: user.id });
    return user;
  } catch (error) {
    authLogger.warn('Token validation failed', { token: token.substring(0, 10) + '...' });
    throw new Error('Invalid token');
  }
};

// API operations
app.get('/api/users', async (ctx) => {
  try {
    apiLogger.info('Fetching users', { 
      requestId: ctx.state.requestId,
      ipAddress: ctx.request.ipAddress 
    });
    
    const users = await getAllUsers();
    
    apiLogger.info('Users fetched successfully', { 
      count: users.length,
      requestId: ctx.state.requestId 
    });
    
    return { users };
  } catch (error) {
    apiLogger.error('Failed to fetch users', { 
      error: error.message,
      requestId: ctx.state.requestId 
    });
    
    ctx.response.setStatusCode(500);
    return { error: 'Internal server error' };
  }
});

// Error handling with logging
app.onError(async (ctx, error) => {
  apiLogger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    requestId: ctx.state.requestId,
    method: ctx.request.method,
    path: ctx.request.path,
    ipAddress: ctx.request.ipAddress
  });
  
  ctx.response.setStatusCode(500);
  return { error: 'Internal server error' };
});

await app.listen();
```

### Dev API

**Use Case:** Development server with detailed logging and debugging

**Description:** Development configuration with built-in logger, extensive debugging information, and table logging for easier development and testing.

```typescript
import { YinzerFlow, log, createLogger } from 'yinzerflow';

// Development loggers with different prefixes
const dbLogger = createLogger({ 
  prefix: 'DATABASE', 
  logLevel: 'info' 
});

const authLogger = createLogger({ 
  prefix: 'AUTH', 
  logLevel: 'warn' 
});

const apiLogger = createLogger({ 
  prefix: 'API', 
  logLevel: 'info' 
});

const app = new YinzerFlow({
  port: 3000,
  logLevel: 'info',
  networkLogs: true  // Enable network logging for debugging
});

// Database operations with detailed logging
const connectToDatabase = async () => {
  try {
    log.info('Connecting to database...');
    await database.connect();
    dbLogger.info('Database connection established');
    
    // Log database configuration (non-sensitive)
    dbLogger.info('Database configuration', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME
    });
  } catch (error) {
    dbLogger.error('Database connection failed', error);
    throw error;
  }
};

// Authentication with detailed logging
const validateToken = async (token: string) => {
  try {
    authLogger.info('Validating token', { tokenLength: token.length });
    const user = await jwt.verify(token);
    authLogger.info('Token validated successfully', { userId: user.id });
    return user;
  } catch (error) {
    authLogger.warn('Token validation failed', { error: error.message });
    throw new Error('Invalid token');
  }
};

// API operations with comprehensive logging
app.get('/api/users', async (ctx) => {
  try {
    apiLogger.info('Fetching users', { 
      requestId: ctx.state.requestId,
      ipAddress: ctx.request.ipAddress,
      userAgent: ctx.request.headers['user-agent']
    });
    
    const users = await getAllUsers();
    
    // Use table logging for structured data
    apiLogger.table(users, 'Users fetched successfully');
    
    apiLogger.info('Users fetched successfully', { 
      count: users.length,
      requestId: ctx.state.requestId 
    });
    
    return { users };
  } catch (error) {
    apiLogger.error('Failed to fetch users', { 
      error: error.message,
      stack: error.stack,
      requestId: ctx.state.requestId 
    });
    
    ctx.response.setStatusCode(500);
    return { error: 'Internal server error' };
  }
});

// Debug route with extensive logging
app.get('/debug', async (ctx) => {
  log.info('Debug route accessed');
  
  // Log request details
  apiLogger.info('Debug request details', {
    method: ctx.request.method,
    path: ctx.request.path,
    headers: ctx.request.headers,
    query: ctx.request.query,
    params: ctx.request.params,
    body: ctx.request.body,
    ipAddress: ctx.request.ipAddress
  });
  
  // Log state information
  apiLogger.table(ctx.state, 'Request state');
  
  return {
    message: 'Debug information logged',
    timestamp: new Date().toISOString()
  };
});

// Error handling with detailed logging
app.onError(async (ctx, error) => {
  log.error('Unhandled error occurred', error);
  
  apiLogger.error('Unhandled error details', {
    error: error.message,
    stack: error.stack,
    requestId: ctx.state.requestId,
    method: ctx.request.method,
    path: ctx.request.path,
    ipAddress: ctx.request.ipAddress,
    headers: ctx.request.headers,
    body: ctx.request.body
  });
  
  ctx.response.setStatusCode(500);
  return { error: 'Internal server error' };
});

await app.listen();
```

## 🚀 Performance Notes

- **Early returns**: Log level checks prevent unnecessary processing when logging is disabled
- **Native console methods**: Uses built-in console methods for optimal performance
- **Minimal overhead**: Logging adds minimal overhead when disabled
- **Table optimization**: Table logging uses native console.table for efficient display

## 🔒 Security Notes

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

### 🛡️ Network Logging Security
- **Problem**: Network logs can expose sensitive request data
- **YinzerFlow Solution**: Network logging is separate and configurable, allowing selective logging

## 🔧 Troubleshooting

### Logs Not Appearing
- **Problem**: Log messages not showing up
- **Fix**: Check log level configuration

```typescript
// ❌ Wrong - log level too high
const logger = createLogger({ logLevel: 'error' });
logger.info('This will not appear'); // Blocked by log level

// ✅ Correct - appropriate log level
const logger = createLogger({ logLevel: 'info' });
logger.info('This will appear'); // Will be logged
```

### Custom Logger Not Working
- **Problem**: Custom logger not being used
- **Fix**: Check logger interface implementation

```typescript
// ❌ Wrong - missing required methods
const customLogger = {
  info: (...args) => console.log(...args)
  // Missing warn and error methods
};

// ✅ Correct - implement all required methods
const customLogger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};
```

### Network Logs Not Working
- **Problem**: Network request logs not appearing
- **Fix**: Enable network logging in configuration

```typescript
// ❌ Wrong - network logging disabled
const app = new YinzerFlow({
  port: 3000,
  networkLogs: false  // Disabled
});

// ✅ Correct - enable network logging
const app = new YinzerFlow({
  port: 3000,
  networkLogs: true  // Enabled
});
```

### Table Logging Not Working
- **Problem**: Table logs not displaying properly
- **Fix**: Use appropriate data types for table logging

```typescript
// ❌ Wrong - primitive data
logger.table('string data'); // Not suitable for table display

// ✅ Correct - structured data
logger.table([
  { id: 1, name: 'John' },
  { id: 2, name: 'Jane' }
]); // Will display as table
```