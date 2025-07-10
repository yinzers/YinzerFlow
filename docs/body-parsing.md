# Body Parsing

YinzerFlow provides comprehensive body parsing with built-in security protections against DoS attacks, prototype pollution, and memory exhaustion vulnerabilities. The body parser automatically handles JSON, file uploads, and URL-encoded form data with configurable security limits.

## Configuration

Body parsing is automatically enabled with secure defaults that protect against common attack vectors:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 262144, // 256KB (reasonable for JSON APIs)
      maxDepth: 10,
      allowPrototypeProperties: false, // Blocks prototype pollution
      maxKeys: 1000,
      maxStringLength: 1048576, // 1MB per string
      maxArrayLength: 10000
    },
    fileUploads: {
      maxFileSize: 10485760, // 10MB per file
      maxTotalSize: 52428800, // 50MB total
      maxFiles: 10,
      allowedExtensions: [], // Empty = allow all
      blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'],
      maxFilenameLength: 255
    },
    urlEncoded: {
      maxSize: 1048576, // 1MB
      maxFields: 1000,
      maxFieldNameLength: 100,
      maxFieldLength: 1048576 // 1MB per field
    }
  }
});
```

### Configuration Options

#### JSON Parser Configuration

Controls how JSON request bodies are parsed and validated:

| Option | Type | Default | Description |
|-----|---|---|---|
| `maxSize` | `number` | `262144` (256KB) | Maximum JSON body size in bytes |
| `maxDepth` | `number` | `10` | Maximum nesting depth to prevent stack overflow |
| `allowPrototypeProperties` | `boolean` | `false` | Allow dangerous prototype properties (⚠️ Security Risk) |
| `maxKeys` | `number` | `1000` | Maximum object keys to prevent memory exhaustion |
| `maxStringLength` | `number` | `1048576` (1MB) | Maximum string length per property |
| `maxArrayLength` | `number` | `10000` | Maximum array elements per property |

#### File Upload Configuration

Controls file upload processing and security:

| Option | Type | Default | Description |
|-----|---|---|---|
| `maxFileSize` | `number` | `10485760` (10MB) | Maximum size per individual file |
| `maxTotalSize` | `number` | `52428800` (50MB) | Maximum total upload size per request |
| `maxFiles` | `number` | `10` | Maximum number of files per request |
| `allowedExtensions` | `string[]` | `[]` | Allowed file extensions (empty = allow all) |
| `blockedExtensions` | `string[]` | `['.exe', '.bat', ...]` | Blocked file extensions for security |
| `maxFilenameLength` | `number` | `255` | Maximum filename length |

#### URL-Encoded Form Configuration

Controls form data parsing and validation:

| Option | Type | Default | Description |
|-----|---|---|---|
| `maxSize` | `number` | `1048576` (1MB) | Maximum form data size |
| `maxFields` | `number` | `1000` | Maximum form fields to prevent DoS |
| `maxFieldNameLength` | `number` | `100` | Maximum field name length |
| `maxFieldLength` | `number` | `1048576` (1MB) | Maximum field value length |

## Examples

#### Strict API Configuration
```typescript
const strictApiApp = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 131072, // 128KB - smaller for strict APIs
      maxDepth: 5, // Shallow nesting only
      allowPrototypeProperties: false, // Always keep false!
      maxKeys: 100, // Fewer keys allowed
      maxStringLength: 10240, // 10KB strings max
      maxArrayLength: 100 // Small arrays only
    },
    fileUploads: {
      maxFileSize: 1048576, // 1MB files only
      maxFiles: 3, // Very few files
      allowedExtensions: ['.jpg', '.png', '.pdf'], // Specific types only
      maxFilenameLength: 50 // Short filenames
    }
  }
});
```

#### Media Upload Configuration
```typescript
const mediaApp = new YinzerFlow({
  port: 3000,
  bodyParser: {
    json: {
      maxSize: 512000, // 500KB for metadata
      maxDepth: 3, // Simple metadata only
      allowPrototypeProperties: false
    },
    fileUploads: {
      maxFileSize: 104857600, // 100MB per file for media
      maxTotalSize: 524288000, // 500MB total
      maxFiles: 20,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.pdf'],
      blockedExtensions: [], // Using allowlist instead
      maxFilenameLength: 200
    }
  }
});
```

#### High-Security Configuration
```typescript
const secureApp = new YinzerFlow({
  port: 443,
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
  }
});
```

## Common Use Cases

- **API Data Processing**: Parse JSON payloads with automatic security validation and DoS protection
- **File Upload Handling**: Secure file upload processing with size, type, and count restrictions
- **Form Data Processing**: Handle HTML form submissions with field validation and memory protection
- **Content Type Detection**: Automatic parsing based on Content-Type headers with fallback handling
- **Security Compliance**: Built-in protection against common web vulnerabilities and attack vectors
- **Memory Protection**: Prevent DoS attacks through configurable size and complexity limits

## API Reference

### Request Body Properties

When body parsing is successful, the parsed data is available on `request.body`:

#### JSON Requests
```typescript
// Content-Type: application/json
request.body: unknown // Parsed JSON object or array
```

#### File Upload Requests
```typescript
// Content-Type: multipart/form-data
request.body: {
  fields: Record<string, string | string[]>; // Form fields
  files: Array<{
    fieldname: string;
    filename: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }>;
}
```

#### URL-Encoded Form Requests
```typescript
// Content-Type: application/x-www-form-urlencoded
request.body: Record<string, string | string[]> // Parsed form data
```

### Configuration Methods

Body parser configuration is set during YinzerFlow initialization:

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: JsonParserOptions,
    fileUploads: FileUploadOptions,
    urlEncoded: UrlEncodedOptions
  }
});
```

## Configuration Validation and Warnings

YinzerFlow validates all body parser configuration options and provides security warnings for potentially risky settings:

### Automatic Validation
- **Minimum limits**: Prevents broken configurations (e.g., maxSize: 0)
- **Type checking**: Ensures proper data types for all options
- **Logical validation**: Checks for contradictory settings

### Security Warnings
YinzerFlow will log warnings (but not block) potentially risky configurations:

```typescript
// This will trigger security warnings
const riskyApp = new YinzerFlow({
  bodyParser: {
    json: {
      maxSize: 52428800, // 50MB JSON - warning about memory risk
      allowPrototypeProperties: true, // Warning about prototype pollution
      maxDepth: 100 // Warning about stack overflow risk
    },
    fileUploads: {
      maxFileSize: 1073741824, // 1GB files - warning about resources
      allowedExtensions: ['.exe'] // Warning about dangerous file types
    }
  }
});
```

## Error Handling

YinzerFlow automatically handles body parsing errors and provides clear error messages:

**JSON parsing errors:**
- `Invalid JSON in request body: Unexpected token at position X`
- `JSON body too large: maximum 256KB allowed`
- `JSON nesting too deep: maximum 10 levels allowed`
- `JSON object has too many keys: maximum 1000 allowed`

**File upload errors:**
- `File too large: maximum 10MB per file allowed`
- `Too many files: maximum 10 files per request`
- `File type not allowed: .exe files are blocked`
- `Total upload size exceeded: maximum 50MB total allowed`

**URL-encoded form errors:**
- `Form data too large: maximum 1MB allowed`
- `Too many form fields: maximum 1000 fields allowed`
- `Form field name too long: maximum 100 characters`
- `Form field value too large: maximum 1MB per field`

These errors automatically result in appropriate HTTP status codes (400 Bad Request) and prevent malformed or malicious requests from reaching your application handlers.

## Security Considerations

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

### 🛡️ Malformed Data Handling
- **Problem**: Invalid or malformed data can crash parsers, cause security issues, or bypass validation
- **YinzerFlow Solution**: Graceful error handling with detailed security context and safe fallback parsing

### 🛡️ Filename Injection Prevention
- **Problem**: Malicious filenames can contain path traversal attacks or dangerous characters
- **YinzerFlow Solution**: Filename length validation, character sanitization, and path traversal prevention

### 🛡️ MIME Type Validation
- **Problem**: Spoofed or incorrect MIME types can bypass security filters
- **YinzerFlow Solution**: Content-Type header validation and file extension cross-checking for uploaded files

These security measures ensure YinzerFlow's body parsing implementation follows security best practices and prevents common attack vectors while maintaining spec compliance. 