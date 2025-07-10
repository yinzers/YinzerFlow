# Configuration Patterns

YinzerFlow provides flexible configuration options for different deployment environments and use cases. This document contains common configuration patterns and best practices.

For security principles and architecture, see [Security Overview](../security/security-overview.md).

## Quick Configuration Reference

### Minimal Configuration
```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });
```

### Basic API Configuration
```typescript
const app = new YinzerFlow({
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com']
  }
});
```

### Production Configuration
```typescript
const app = new YinzerFlow({
  port: 443,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'],
    credentials: true
  },
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      allowPrototypeProperties: false
    }
  },
  ipSecurity: {
    trustedProxies: ['127.0.0.1'],
    detectSpoofing: true
  }
});
```

## Security-First Configurations

These configurations prioritize security while maintaining functionality. For detailed security principles, see [Security Overview](../security/security-overview.md).

### High-Security Configuration
For applications requiring maximum security:

```typescript
const highSecurityConfig = {
  port: 443,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'], // Specific domain only
    credentials: true,
    methods: ['GET', 'POST'], // Minimal methods
    allowedHeaders: ['Content-Type']
  },
  bodyParser: {
    json: { 
      maxSize: 32768, // 32KB only
      maxDepth: 3, 
      maxKeys: 50 
    },
    fileUploads: { 
      maxFileSize: 0, // No file uploads
      maxFiles: 0 
    },
    urlEncoded: { 
      maxSize: 8192, // 8KB forms only
      maxFields: 20 
    }
  },
  ipSecurity: {
    trustedProxies: [], // No trusted proxies
    allowPrivateIps: false,
    detectSpoofing: true
  }
};
```

### Public API Configuration
For public APIs with controlled access:

```typescript
const publicApiConfig = {
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://api.yourdomain.com'],
    credentials: false, // No credentials for public API
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      maxDepth: 10,
      allowPrototypeProperties: false
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB
      allowedExtensions: ['.jpg', '.png', '.pdf'],
      maxFiles: 5
    }
  }
};
```

## Environment-Specific Configurations

### Development Configuration
```typescript
const devConfig = {
  port: 3000,
  cors: {
    enabled: true,
    origin: '*', // Allow all origins in development
    credentials: true
  },
  bodyParser: {
    json: {
      maxSize: 1048576, // 1MB for development
      maxDepth: 20,
      allowPrototypeProperties: false
    },
    fileUploads: {
      maxFileSize: 52428800, // 50MB
      maxFiles: 20,
      allowedExtensions: [] // Allow all for development
    }
  },
  ipSecurity: {
    allowPrivateIps: true,
    detectSpoofing: false // Disable for development
  }
};
```

### Staging Configuration
```typescript
const stagingConfig = {
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://staging.yourdomain.com'],
    credentials: true
  },
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      maxDepth: 10,
      allowPrototypeProperties: false
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB
      maxFiles: 10,
      allowedExtensions: ['.jpg', '.png', '.pdf']
    }
  },
  ipSecurity: {
    trustedProxies: ['127.0.0.1'],
    allowPrivateIps: true,
    detectSpoofing: true
  }
};
```

### Production Configuration
```typescript
const productionConfig = {
  port: 443,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB
      maxDepth: 10,
      allowPrototypeProperties: false,
      maxKeys: 1000
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB
      maxFiles: 10,
      allowedExtensions: ['.jpg', '.png', '.pdf'],
      blockedExtensions: ['.exe', '.bat', '.cmd']
    },
    urlEncoded: {
      maxSize: 1048576, // 1MB
      maxFields: 1000
    }
  },
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '192.168.1.10'],
    allowPrivateIps: false,
    headerPreference: ['x-forwarded-for', 'x-real-ip'],
    maxChainLength: 10,
    detectSpoofing: true
  }
};
```

### High-Security Configuration
```typescript
const highSecurityConfig = {
  port: 443,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'], // Specific domain only
    credentials: true,
    methods: ['GET', 'POST'], // Minimal methods
    allowedHeaders: ['Content-Type']
  },
  bodyParser: {
    json: { 
      maxSize: 32768, // 32KB only
      maxDepth: 3, 
      maxKeys: 50 
    },
    fileUploads: { 
      maxFileSize: 0, // No file uploads
      maxFiles: 0 
    },
    urlEncoded: { 
      maxSize: 8192, // 8KB forms only
      maxFields: 20 
    }
  },
  ipSecurity: {
    trustedProxies: [], // No trusted proxies
    allowPrivateIps: false,
    detectSpoofing: true
  }
};
```

## Use Case Configurations

### File Upload Service Configuration
```typescript
const fileUploadConfig = {
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://upload.yourdomain.com'],
    credentials: true
  },
  bodyParser: {
    json: {
      maxSize: 512000, // 500KB for metadata
      maxDepth: 3,
      allowPrototypeProperties: false
    },
    fileUploads: {
      maxFileSize: 104857600, // 100MB per file
      maxTotalSize: 524288000, // 500MB total
      maxFiles: 20,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.pdf'],
      blockedExtensions: [], // Using allowlist instead
      maxFilenameLength: 200
    }
  }
};
```

### Microservice Configuration
```typescript
const microserviceConfig = {
  port: 3000,
  cors: {
    enabled: false // No CORS for internal services
  },
  bodyParser: {
    json: {
      maxSize: 131072, // 128KB
      maxDepth: 5,
      allowPrototypeProperties: false
    },
    fileUploads: {
      maxFileSize: 0, // No file uploads
      maxFiles: 0
    }
  },
  ipSecurity: {
    trustedProxies: ['127.0.0.1', '10.0.0.0/8'],
    allowPrivateIps: true,
    detectSpoofing: true
  }
};
```

### Load Balancer Configuration
```typescript
const loadBalancerConfig = {
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'],
    credentials: true
  },
  ipSecurity: {
    trustedProxies: ['192.168.1.10', '192.168.1.11'], // Load balancer IPs
    allowPrivateIps: true,
    headerPreference: ['x-forwarded-for', 'x-real-ip'],
    maxChainLength: 5,
    detectSpoofing: true
  }
};
```

### CDN Configuration
```typescript
const cdnConfig = {
  port: 3000,
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com'],
    credentials: true
  },
  ipSecurity: {
    trustedProxies: [
      // Cloudflare IP ranges
      '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22'
    ],
    headerPreference: ['cf-connecting-ip', 'x-forwarded-for'],
    allowPrivateIps: false // Only real client IPs
  }
};
```

## Configuration Best Practices

### 1. Environment Variables
Use environment variables for sensitive configuration:

```typescript
const app = new YinzerFlow({
  port: parseInt(process.env.PORT || '3000'),
  cors: {
    enabled: true,
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
  },
  bodyParser: {
    json: {
      maxSize: parseInt(process.env.MAX_JSON_SIZE || '262144')
    }
  }
});
```

### 2. Configuration Validation
Validate configuration at startup:

```typescript
const validateConfig = (config: any) => {
  if (!config.port || config.port < 1 || config.port > 65535) {
    throw new Error('Invalid port configuration');
  }
  
  if (config.cors?.enabled && !config.cors?.origin) {
    throw new Error('CORS enabled but no origin specified');
  }
  
  return config;
};

const config = validateConfig({
  port: 3000,
  cors: { enabled: true, origin: ['https://yourdomain.com'] }
});

const app = new YinzerFlow(config);
```

### 3. Configuration Composition
Compose configurations from smaller parts:

```typescript
const baseConfig = {
  port: 3000,
  bodyParser: {
    json: {
      allowPrototypeProperties: false
    }
  }
};

const securityConfig = {
  cors: {
    enabled: true,
    origin: ['https://yourdomain.com']
  },
  ipSecurity: {
    detectSpoofing: true
  }
};

const productionConfig = {
  ...baseConfig,
  ...securityConfig,
  port: 443
};
```

### 4. Configuration Testing
Test your configuration:

```typescript
const testConfig = async (config: any) => {
  const app = new YinzerFlow(config);
  
  try {
    await app.listen();
    console.log('✅ Configuration is valid');
    await app.close();
  } catch (error) {
    console.error('❌ Configuration error:', error);
    throw error;
  }
};

await testConfig(productionConfig);
```

## Configuration Reference

For detailed configuration options, see:

- **[Advanced Configuration Options](./advanced-configuration-options.md)** - Complete configuration reference
- **[Security Overview](../security/security-overview.md)** - Security configuration patterns
- **[Body Parsing Security](../security/body-parsing.md)** - Body parser configuration
- **[CORS Security](../security/cors.md)** - CORS configuration
- **[IP Security](../security/ip-security.md)** - IP security configuration
- **[Logging Security](../security/logging.md)** - Logging configuration

## Common Issues and Solutions

### CORS Errors
**Problem**: Browser blocks requests due to CORS policy
**Solution**: Configure CORS with proper origins and credentials

```typescript
cors: {
  enabled: true,
  origin: ['https://yourdomain.com'], // Specific origin
  credentials: true, // If using cookies/auth
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}
```

### File Upload Failures
**Problem**: File uploads rejected or too large
**Solution**: Configure appropriate file upload limits

```typescript
bodyParser: {
  fileUploads: {
    maxFileSize: 10485760, // 10MB per file
    maxFiles: 10,
    allowedExtensions: ['.jpg', '.png', '.pdf']
  }
}
```

### IP Address Issues
**Problem**: Wrong client IP address detected
**Solution**: Configure trusted proxies for your infrastructure

```typescript
ipSecurity: {
  trustedProxies: ['127.0.0.1', '192.168.1.10'],
  headerPreference: ['x-forwarded-for', 'x-real-ip']
}
```

### Memory Issues
**Problem**: Server runs out of memory with large requests
**Solution**: Reduce body parsing limits

```typescript
bodyParser: {
  json: {
    maxSize: 131072, // 128KB instead of 256KB
    maxDepth: 5,     // Shallow nesting
    maxKeys: 100     // Fewer object keys
  }
}
``` 