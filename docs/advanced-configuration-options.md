# Advanced Configuration Options

YinzerFlow provides advanced configuration options for fine-tuning security, performance, and functionality. These options allow you to customize the framework's behavior for specific use cases while maintaining robust security defaults.

## Body Parser Configuration

Body parsing handles all incoming request data with built-in security protections against DoS attacks, prototype pollution, and memory exhaustion vulnerabilities. See [Body Parsing Documentation](./body-parsing.md) for detailed setup, configuration options, and security considerations.

```typescript
const app = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      maxDepth: 10,
      allowPrototypeProperties: false, // Security protection
      maxKeys: 1000
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB per file
      maxFiles: 10,
      allowedExtensions: ['.jpg', '.png', '.pdf']
    },
    urlEncoded: {
      maxSize: 1048576, // 1MB
      maxFields: 1000
    }
  }
});
```

## CORS Configuration

Cross-Origin Resource Sharing (CORS) configuration for browser security. See [CORS Documentation](./cors.md) for detailed setup and security considerations.

```typescript
const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});
```

## IP Security Configuration

IP address validation and spoofing protection for accurate client identification. See [IP Security Documentation](./ip-security.md) for detailed setup, security considerations, and advanced use cases.

```typescript
const app = new YinzerFlow({
  port: 3000,
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '::1', '192.168.1.10'],
    allowPrivateIps: true,
    headerPreference: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
    maxChainLength: 10,
    detectSpoofing: true
  }
});
```

## Server Configuration

### Connection Options

Fine-tune server connection behavior and timeouts:

```typescript
const app = new YinzerFlow({
  port: 3000,
  host: '0.0.0.0', // Bind address
  // IP extraction is now handled by ipSecurity configuration
  connectionOptions: {
    socketTimeout: 30000, // 30 seconds
    gracefulShutdownTimeout: 30000,
    keepAliveTimeout: 65000,
    headersTimeout: 66000
  }
});
```

| Option | Type | Default | Description |
|-----|---|---|---|
| `socketTimeout` | `number` | `30000` | Socket timeout in milliseconds |
| `gracefulShutdownTimeout` | `number` | `30000` | Graceful shutdown timeout |
| `keepAliveTimeout` | `number` | `65000` | Keep-alive timeout |
| `headersTimeout` | `number` | `66000` | Headers timeout (should be > keep-alive) |

### Graceful Shutdown Configuration

Control automatic graceful shutdown behavior:

```typescript
const app = new YinzerFlow({
  port: 3000,
  autoGracefulShutdown: true, // Enable automatic signal handling (default)
});
```

| Option | Type | Default | Description |
|-----|---|---|---|
| `autoGracefulShutdown` | `boolean` | `true` | Enable automatic SIGTERM/SIGINT handling |

**When enabled (default):**
- Automatically sets up SIGTERM and SIGINT signal handlers
- Logs shutdown process with Pittsburgh personality
- Calls `app.close()` and `process.exit(0)` automatically
- Prevents duplicate handlers when multiple instances are created

**When disabled:**
- No automatic signal handling
- Manual graceful shutdown setup required
- Useful for custom shutdown logic or integration with process managers

### Custom Graceful Shutdown Example

When `autoGracefulShutdown: false`, you can implement custom shutdown logic:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  autoGracefulShutdown: false, // Disable automatic handling
});

// Custom shutdown with additional cleanup
const gracefulShutdown = async (signal: string) => {
  console.log(`🛑 Received ${signal}, starting custom shutdown...`);
  
  // Custom cleanup logic
  await cleanupDatabase();
  await saveApplicationState();
  
  // Close the server
  await app.close();
  
  console.log('✅ Custom shutdown completed');
  process.exit(0);
};

// Set up custom signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

await app.listen();
```

### Advanced Custom Shutdown Example

For complex applications with multiple cleanup steps:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  autoGracefulShutdown: false,
});

let isShuttingDown = false;

const advancedShutdown = async (signal: string) => {
  if (isShuttingDown) {
    console.log('⚠️ Shutdown already in progress, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  console.log(`🛑 Received ${signal}, starting advanced shutdown...`);
  
  try {
    // Phase 1: Stop accepting new requests
    console.log('📝 Phase 1: Stopping new requests...');
    // Your logic here
    
    // Phase 2: Complete in-flight requests
    console.log('📝 Phase 2: Completing in-flight requests...');
    await waitForInFlightRequests();
    
    // Phase 3: Cleanup resources
    console.log('📝 Phase 3: Cleaning up resources...');
    await cleanupDatabase();
    await closeFileHandles();
    await flushLogs();
    
    // Phase 4: Close server
    console.log('📝 Phase 4: Closing server...');
    await app.close();
    
    console.log('✅ Advanced shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown failed:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => advancedShutdown('SIGTERM'));
process.on('SIGINT', () => advancedShutdown('SIGINT'));

await app.listen();
```

### Logging Configuration

Control framework logging output with built-in Pittsburgh personality or custom logging libraries. See [Logging Documentation](./logging.md) for detailed setup, custom logger integration, and advanced use cases.

```typescript
const app = new YinzerFlow({
  port: 3000,
  logLevel: 'info', // 'off', 'error', 'warn', 'info'
  networkLogs: true, // Enable nginx-style request logging
  logger: customLogger // Optional custom logger implementation
});
```

**Key Points:**
- **Application logs** (`log.info()`, `log.warn()`, etc.) route to custom logger if provided
- **Network logs** (nginx-style requests) can route to custom logger or use built-in formatting
- **Unified interface**: Framework and user code use same `log.info()` calls
- **Zero breaking changes**: Existing code continues to work with custom loggers
- **Flexible routing**: Use same logger for both (unified monitoring) or different loggers (separate concerns)



## Common Configuration Patterns

### High-Security API
```typescript
const secureApi = new YinzerFlow({
  port: 443,
  bodyParser: {
    json: { maxSize: 32768, maxDepth: 3, maxKeys: 50 }, // Very strict
    fileUploads: { maxFileSize: 0, maxFiles: 0 }, // No uploads
    urlEncoded: { maxSize: 8192, maxFields: 20 } // Minimal forms
  },
  cors: { enabled: false } // No CORS for security
});
```

### File Processing Service
```typescript
const fileService = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: { maxSize: 8192 }, // Minimal JSON for metadata
    fileUploads: {
      maxFileSize: 2147483648, // 2GB files
      maxTotalSize: 10737418240, // 10GB total
      maxFiles: 50,
      allowedExtensions: ['.zip', '.tar', '.gz', '.7z', '.rar']
    }
  }
});
```

### Development/Testing Environment
```typescript
const devApp = new YinzerFlow({
  port: 3000,
  logLevel: 'verbose', // Verbose logging
  bodyParser: {
    json: { maxSize: 10485760 }, // 10MB for testing
    fileUploads: { 
      maxFileSize: 104857600, // 100MB files
      allowedExtensions: [] // Allow all for development
    }
  },
  cors: { 
    enabled: true,
    origin: '*' // Open CORS for dev (⚠️ Never use in production)
  }
});
```

## Configuration Best Practices

### Security First
- **Never enable `allowPrototypeProperties`** unless absolutely necessary
- **Use allowlists over blocklists** for file extensions when possible
- **Set conservative limits initially** and increase as needed
- **Enable CORS carefully** with specific origins in production

### Performance Optimization
- **Match limits to your use case** - don't use defaults blindly
- **Consider memory usage** when setting maxSize limits
- **Balance security vs. functionality** based on your threat model

### Monitoring and Maintenance
- **Watch for security warnings** in your logs
- **Monitor actual usage patterns** to optimize limits
- **Review configuration regularly** as your application evolves
- **Test edge cases** with your specific limits

These advanced configuration options provide fine-grained control over YinzerFlow's behavior while maintaining security best practices and preventing common vulnerabilities.