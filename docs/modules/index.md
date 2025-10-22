# 📦 Modules

YinzerFlow's modular architecture provides built-in modules for common web development needs. Each module is self-contained and can be configured independently.

## Available Modules

### 🛡️ Security Modules

#### [Rate Limiting](rate-limiting.md)
Protect your API from abuse and DoS attacks with configurable rate limiting.

- **Sliding Window Counter** algorithm for accurate rate limiting
- **Global and per-route** limits
- **Custom key generators** for authenticated users
- **Memory efficient** with automatic cleanup
- **Standard headers** for client feedback

#### [CORS](cors.md)
Handle cross-origin requests securely with comprehensive CORS support.

- **Origin validation** with wildcard and regex support
- **Preflight handling** for complex requests
- **Credential support** for authenticated requests
- **Custom headers** and methods configuration
- **Security-first defaults** (disabled by default)

#### [IP Security](ip-security.md)
Advanced IP address validation and security features.

- **Private IP detection** and handling
- **Trusted proxy support** for load balancers
- **Spoofing detection** with pattern analysis
- **Configurable chain length** limits
- **Security logging** for suspicious activity

#### [Body Parsing](body-parsing.md)
Secure and efficient request body parsing with comprehensive validation.

- **JSON parsing** with size limits and validation
- **Form data handling** with file upload support
- **URL-encoded data** parsing
- **Text content** processing
- **Security protections** against common attacks

## Module Configuration

All modules can be configured through the main YinzerFlow constructor:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  // Rate limiting configuration
  rateLimit: {
    enabled: true,
    windowMs: 900000, // 15 minutes
    max: 100 // 100 requests per window
  },
  
  // CORS configuration
  cors: {
    enabled: true,
    origin: ['https://app.example.com'],
    credentials: true
  },
  
  // IP security configuration
  ipSecurity: {
    enabled: true,
    trustProxy: true,
    maxChainLength: 5
  },
  
  // Body parsing configuration
  bodyParser: {
    json: {
      maxSize: 262144 // 256KB
    },
    form: {
      maxFields: 1000
    }
  }
});
```

## Module Features

### 🔧 Easy Configuration
- **Sensible defaults** - Works out of the box
- **Type-safe options** - Full TypeScript support
- **Validation** - Built-in configuration validation
- **Warnings** - Helpful warnings for misconfigurations

### 🚀 Performance Optimized
- **Memory efficient** - Minimal overhead
- **Fast execution** - Optimized algorithms
- **Automatic cleanup** - No memory leaks
- **Scalable** - Handles high traffic

### 🛡️ Security First
- **Built-in protections** - Common vulnerabilities covered
- **Secure defaults** - Safe out of the box
- **Validation** - Input validation and sanitization
- **Logging** - Security event logging

### 📚 Comprehensive Documentation
- **Detailed guides** - Step-by-step instructions
- **Examples** - Real-world usage patterns
- **Troubleshooting** - Common issues and solutions
- **Best practices** - Recommended configurations

## Getting Started with Modules

1. **Choose your modules** - Select the modules you need for your application
2. **Configure options** - Set up module-specific configuration
3. **Test thoroughly** - Verify module behavior in your environment
4. **Monitor performance** - Use built-in logging and metrics
5. **Scale as needed** - Adjust configuration for production loads

## Need Help?

- **Module-specific guides** - Each module has detailed documentation
- **Configuration examples** - See [Configuration Guide](../configuration/configuration.md)
- **Troubleshooting** - Check individual module troubleshooting sections
- **Best practices** - Follow security and performance recommendations
