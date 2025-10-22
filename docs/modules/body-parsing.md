# 📖 Body Parsing Security

YinzerFlow provides comprehensive body parsing with built-in security protections against DoS attacks, prototype pollution, and memory exhaustion vulnerabilities. The body parser automatically handles JSON, file uploads, and URL-encoded form data with configurable security limits.

For detailed configuration examples and patterns, see [Configuration Guide](../configuration/configuration.md).

# ⚙️ Usage

## 🎛️ Settings

### json.maxSize — @default <span style="color: #2ecc71">`262144`</span> (256KB)

Maximum JSON request body size in bytes.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: {
      maxSize: 262144  // 256KB limit
    }
  }
});
```

<aside>

Options: `number` (in bytes)

- Minimum: `1024` (1KB)
- Recommended: `262144` (256KB) for APIs
- Maximum: Depends on use case, but avoid values over 10MB
</aside>

### json.maxDepth — @default <span style="color: #2ecc71">`10`</span>

Maximum nesting depth to prevent stack overflow attacks.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: {
      maxDepth: 10  // Prevent deep nesting
    }
  }
});
```

<aside>

Options: `number`

- Minimum: `1`
- Recommended: `10` for most APIs
- Maximum: `50` (higher values increase stack overflow risk)
</aside>

### json.allowPrototypeProperties — @default <span style="color: #e74c3c">`false`</span>

Allow dangerous prototype properties (⚠️ Security Risk).

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: {
      allowPrototypeProperties: false  // ✅ Always keep false!
    }
  }
});
```

<aside>

Options: `boolean`

- `false`: Block prototype pollution (default, secure)
- `true`: Allow prototype properties (⚠️ Security Risk)
</aside>

### json.maxKeys — @default <span style="color: #2ecc71">`1000`</span>

Maximum object keys to prevent memory exhaustion.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: {
      maxKeys: 1000  // Prevent memory exhaustion
    }
  }
});
```

<aside>

Options: `number`

- Minimum: `10`
- Recommended: `1000` for most APIs
- Maximum: `10000` (higher values increase memory usage)
</aside>

### json.maxStringLength — @default <span style="color: #2ecc71">`1048576`</span> (1MB)

Maximum length of JSON string values.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: {
      maxStringLength: 1048576  // 1MB string limit
    }
  }
});
```

<aside>

Options: `number` (in bytes)

- Minimum: `100`
- Recommended: `1048576` (1MB) for most APIs
- Maximum: `10485760` (10MB) for large text fields
</aside>

### json.maxArrayLength — @default <span style="color: #2ecc71">`10000`</span>

Maximum number of array elements.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: {
      maxArrayLength: 10000  // Prevent large arrays
    }
  }
});
```

<aside>

Options: `number`

- Minimum: `10`
- Recommended: `10000` for most APIs
- Maximum: `100000` (higher values increase memory usage)
</aside>

### fileUploads.maxFileSize — @default <span style="color: #2ecc71">`10485760`</span> (10MB)

Maximum size per individual file.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    fileUploads: {
      maxFileSize: 10485760  // 10MB per file
    }
  }
});
```

<aside>

Options: `number` (in bytes)

- Minimum: `1024` (1KB)
- Recommended: `10485760` (10MB) for most use cases
- Maximum: `1073741824` (1GB) for large file handling
</aside>

### fileUploads.maxTotalSize — @default <span style="color: #2ecc71">`52428800`</span> (50MB)

Maximum total size of all files in a single request.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    fileUploads: {
      maxTotalSize: 52428800  // 50MB total
    }
  }
});
```

<aside>

Options: `number` (in bytes)

- Minimum: `1024` (1KB)
- Recommended: `52428800` (50MB) for most use cases
- Maximum: `1073741824` (1GB) for large file uploads
</aside>

### fileUploads.maxFiles — @default <span style="color: #2ecc71">`10`</span>

Maximum number of files per request.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    fileUploads: {
      maxFiles: 10  // Reasonable file count
    }
  }
});
```

<aside>

Options: `number`

- Minimum: `1`
- Recommended: `10` for most use cases
- Maximum: `100` (higher values increase processing time)
</aside>

### fileUploads.allowedExtensions — @default <span style="color: #2ecc71">`[]`</span>

Allowed file extensions (empty array allows all).

```typescript
const app = new YinzerFlow({
  bodyParser: {
    fileUploads: {
      allowedExtensions: ['.jpg', '.png', '.pdf', '.txt']  // Specific types only
    }
  }
});
```

<aside>

Options: `string[]`

- `[]`: Allow all extensions (default)
- `['.jpg', '.png', '.pdf']`: Specific file types only
- `['.txt', '.md', '.json']`: Document types only
</aside>

### fileUploads.blockedExtensions — @default <span style="color: #2ecc71">`['.exe', '.bat', '.cmd', '.scr', '.pif', '.com']`</span>

Blocked file extensions for security.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    fileUploads: {
      blockedExtensions: ['.exe', '.bat', '.cmd']  // Block dangerous files
    }
  }
});
```

<aside>

Options: `string[]`

- `[]`: No blocked extensions (less secure)
- `['.exe', '.bat', '.cmd']`: Block executable files (recommended)
- `['.exe', '.bat', '.cmd', '.scr', '.pif', '.com']`: Comprehensive blocking (default)
</aside>

### fileUploads.maxFilenameLength — @default <span style="color: #2ecc71">`255`</span>

Maximum filename length to prevent path issues.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    fileUploads: {
      maxFilenameLength: 255  // Standard filename limit
    }
  }
});
```

<aside>

Options: `number`

- Minimum: `10`
- Recommended: `255` (standard filesystem limit)
- Maximum: `500` (higher values increase processing overhead)
</aside>

### urlEncoded.maxSize — @default <span style="color: #2ecc71">`1048576`</span> (1MB)

Maximum form data size.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    urlEncoded: {
      maxSize: 1048576  // 1MB form data limit
    }
  }
});
```

<aside>

Options: `number` (in bytes)

- Minimum: `1024` (1KB)
- Recommended: `1048576` (1MB) for most forms
- Maximum: `10485760` (10MB) for large forms
</aside>

### urlEncoded.maxFields — @default <span style="color: #2ecc71">`1000`</span>

Maximum form fields to prevent DoS attacks.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    urlEncoded: {
      maxFields: 1000  // Prevent DoS through many fields
    }
  }
});
```

<aside>

Options: `number`

- Minimum: `10`
- Recommended: `1000` for most forms
- Maximum: `10000` (higher values increase processing time)
</aside>

### urlEncoded.maxFieldNameLength — @default <span style="color: #2ecc71">`100`</span>

Maximum field name length.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    urlEncoded: {
      maxFieldNameLength: 100  // Reasonable field names
    }
  }
});
```

<aside>

Options: `number`

- Minimum: `5`
- Recommended: `100` for most forms
- Maximum: `500` (higher values increase processing overhead)
</aside>

### urlEncoded.maxFieldLength — @default <span style="color: #2ecc71">`1048576`</span> (1MB)

Maximum field value length.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    urlEncoded: {
      maxFieldLength: 1048576  // 1MB per field
    }
  }
});
```

<aside>

Options: `number` (in bytes)

- Minimum: `100`
- Recommended: `1048576` (1MB) for most fields
- Maximum: `10485760` (10MB) for large text fields
</aside>

# ✨ Best Practices

- **Set appropriate size limits** based on your use case
- **Keep `allowPrototypeProperties: false`** for JSON parsing security
- **Block dangerous file extensions** for file uploads
- **Use reasonable field limits** to prevent DoS attacks
- **Test with large payloads** to verify limits work correctly
- **Monitor memory usage** with high limits

# 💻 Examples

### Production API

**Use Case:** Secure API with strict body parsing limits

**Description:** Production-ready body parsing configuration with conservative limits, blocked dangerous file types, and comprehensive security protections for maximum security.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 131072,                    // 128KB - smaller for strict APIs
      maxDepth: 5,                       // Shallow nesting only
      allowPrototypeProperties: false,   // Always keep false!
      maxKeys: 100,                      // Fewer keys allowed
      maxStringLength: 10240,            // 10KB strings max
      maxArrayLength: 100                // Small arrays only
    },
    fileUploads: {
      maxFileSize: 1048576,              // 1MB files only
      maxTotalSize: 5242880,             // 5MB total
      maxFiles: 3,                       // Very few files
      allowedExtensions: ['.jpg', '.png', '.pdf'], // Specific types only
      blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'],
      maxFilenameLength: 50               // Short filenames
    },
    urlEncoded: {
      maxSize: 32768,                    // 32KB forms only
      maxFields: 50,                     // Fewer fields
      maxFieldNameLength: 50,            // Shorter field names
      maxFieldLength: 10240              // 10KB per field
    }
  }
});

app.post('/api/data', ({ request }) => {
  const data = request.body; // Parsed and validated
  
  return { success: true, received: data };
});

await app.listen();
```

### Dev API

**Use Case:** Development server with relaxed body parsing limits

**Description:** Development configuration with larger limits, permissive file uploads, and relaxed restrictions for easier testing and debugging.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 1048576,                  // 1MB for development
      maxDepth: 20,                      // Deeper nesting for testing
      allowPrototypeProperties: false,   // Still keep secure!
      maxKeys: 5000,                     // More keys for development
      maxStringLength: 10485760,         // 10MB strings for testing
      maxArrayLength: 50000              // Large arrays for testing
    },
    fileUploads: {
      maxFileSize: 104857600,            // 100MB for development
      maxTotalSize: 524288000,           // 500MB total
      maxFiles: 50,                      // More files for testing
      allowedExtensions: [],             // Allow all extensions in dev
      blockedExtensions: [],             // No blocking in dev
      maxFilenameLength: 500             // Longer filenames for testing
    },
    urlEncoded: {
      maxSize: 10485760,                 // 10MB for development
      maxFields: 10000,                  // More fields for testing
      maxFieldNameLength: 500,           // Longer field names
      maxFieldLength: 10485760           // 10MB per field
    }
  }
});

app.post('/api/test', ({ request }) => {
  const data = request.body;
  return { message: 'Development mode', data };
});

await app.listen();
```

## 🚀 Performance Notes

- **Early size validation**: Prevents unnecessary processing of oversized requests
- **Memory limits**: Configurable limits prevent memory exhaustion
- **Processing overhead**: Minimal impact on request processing time
- **File upload limits**: Prevent DoS through large file uploads

## 🔒 Security Notes

YinzerFlow implements comprehensive security measures to prevent body parsing vulnerabilities:

### 🛡️ JSON DoS Attack Prevention
- **Problem**: Large or deeply nested JSON can cause memory exhaustion and stack overflow attacks
- **YinzerFlow Solution**: Configurable size limits, nesting depth limits, key count restrictions, and string/array length limits prevent resource exhaustion

### 🛡️ Prototype Pollution Protection
- **Problem**: Malicious JSON can pollute JavaScript prototypes using `__proto__`, `constructor`, and `prototype` properties
- **YinzerFlow Solution**: Blocks dangerous properties by default with `allowPrototypeProperties: false` and validates all object keys

### 🛡️ File Upload Security
- **Problem**: Malicious file uploads can execute code, consume server resources, or bypass security controls
- **YinzerFlow Solution**: File type filtering, size limits, filename validation, and extension-based security controls

### 🛡️ Memory Exhaustion Protection
- **Problem**: Large form data, arrays, or objects can exhaust server memory and cause crashes
- **YinzerFlow Solution**: Configurable limits on strings, arrays, fields, object keys, and total request sizes

### 🛡️ Request Size Validation
- **Problem**: Extremely large requests can cause DoS through resource exhaustion
- **YinzerFlow Solution**: Content-type specific size limits with early validation before full parsing

## 🔧 Troubleshooting

### JSON Parsing Fails
- **Problem**: Invalid JSON syntax or exceeds limits
- **Fix**: Check JSON syntax and size limits

```typescript
// ❌ Wrong - invalid JSON
const invalidJson = '{ "name": "John", "age": }';

// ✅ Correct - valid JSON
const validJson = '{ "name": "John", "age": 30 }';
```

### File Upload Rejected
- **Problem**: File too large or blocked extension
- **Fix**: Check file size and extension configuration

```typescript
// ❌ Wrong - file too large
fileUploads: { maxFileSize: 1048576 } // 1MB limit
// Uploading 2MB file

// ✅ Correct - increase limit or reduce file size
fileUploads: { maxFileSize: 2097152 } // 2MB limit
```

### Form Data Too Large
- **Problem**: Form exceeds size or field limits
- **Fix**: Check form size and field configuration

```typescript
// ❌ Wrong - too many fields
urlEncoded: { maxFields: 100 }
// Form has 150 fields

// ✅ Correct - increase limit or reduce fields
urlEncoded: { maxFields: 200 }
```

### Prototype Pollution Warning
- **Problem**: `allowPrototypeProperties: true` enables dangerous properties
- **Fix**: Keep this setting false for security

```typescript
// ❌ Wrong - enables prototype pollution
json: { allowPrototypeProperties: true }

// ✅ Correct - blocks prototype pollution
json: { allowPrototypeProperties: false }
```