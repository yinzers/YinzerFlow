# Response Object

YinzerFlow provides a powerful response object for sending HTTP responses with automatic content type detection, header validation, and built-in security protections.

## Configuration

Response handling is automatically enabled and requires no configuration for basic usage:

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

// Response object is automatically available in handlers
app.get('/api/data', ({ response }) => {
  // Set status code
  response.setStatusCode(200);
  
  // Add headers
  response.addHeaders({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  
  return { message: 'Response sent successfully' };
});
```

YinzerFlow's response handling includes built-in security protections that are automatically applied to prevent common vulnerabilities, including automatic security headers on all responses.

## Basic Example

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({ port: 3000 });

app.get('/api/users/:id', ({ request, response }) => {
  const userId = request.params.id;
  
  // Set successful status code
  response.setStatusCode(200);
  
  // Add custom headers
  response.addHeaders({
    'X-User-ID': userId,
    'Cache-Control': 'max-age=3600',
    'X-API-Version': '1.0'
  });
  
  // Return JSON response body (Content-Type automatically set)
  return {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com',
    timestamp: new Date().toISOString()
  };
});

app.post('/api/files', ({ request, response }) => {
  // Set created status
  response.setStatusCode(201);
  
  // Add location header for created resource
  response.addHeaders({
    'Location': '/api/files/12345',
    'X-Upload-Size': request.headers['content-length'] || '0'
  });
  
  return { fileId: '12345', status: 'uploaded' };
});
```

## Response Body Handling

YinzerFlow automatically processes response bodies based on their type:

### JSON Objects and Arrays

Objects and arrays are automatically JSON stringified with `Content-Type: application/json`:

```typescript
// Automatically becomes JSON
return { message: 'Hello', data: [1, 2, 3] };
// Content-Type: application/json
// Body: {"message":"Hello","data":[1,2,3]}

return [{ id: 1 }, { id: 2 }];
// Content-Type: application/json  
// Body: [{"id":1},{"id":2}]
```

### Strings

String responses get intelligent content type detection:

```typescript
// JSON string
return '{"message": "Hello"}';
// Content-Type: application/json

// Form data
return 'name=John&email=john@example.com';
// Content-Type: application/x-www-form-urlencoded

// Plain text
return 'Hello, world!';
// Content-Type: text/plain
```

### Binary Data

Binary data is handled with appropriate encoding:

```typescript
// Buffer/Uint8Array/ArrayBuffer
const imageBuffer = Buffer.from(imageData);
return imageBuffer;
// Content-Type: application/octet-stream (for binary)
// Content-Type: text/plain (for text-like content)

// Base64 encoding for true binary
response.addHeaders({ 'Content-Transfer-Encoding': 'base64' });
return imageBuffer; // Automatically encoded as base64
```

### Primitives

Numbers, booleans, and other primitives are converted to strings:

```typescript
return 42;          // "42", Content-Type: text/plain
return true;        // "true", Content-Type: text/plain
return new Date();  // ISO string, Content-Type: text/plain
```

## API Reference

### setStatusCode(statusCode)

Sets the HTTP status code for the response.

```typescript
response.setStatusCode(200);  // OK
response.setStatusCode(201);  // Created
response.setStatusCode(400);  // Bad Request
response.setStatusCode(404);  // Not Found
response.setStatusCode(500);  // Internal Server Error
```

### addHeaders(headers)

Adds or updates response headers. Headers are validated for security before being set.

```typescript
// Single header
response.addHeaders({ 'X-Custom-Header': 'value' });

// Multiple headers
response.addHeaders({
  'Cache-Control': 'max-age=3600',
  'X-API-Version': '2.0',
  'Access-Control-Allow-Origin': '*'
});

// Security headers
response.addHeaders({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
});
```

### removeHeaders(headerNames)

Removes headers from the response.

```typescript
// Remove single header
response.removeHeaders(['X-Powered-By']);

// Remove multiple headers
response.removeHeaders(['Server', 'X-Debug-Info', 'X-Internal-ID']);
```

## Common Use Cases

- **Set Status Codes**: Configure HTTP status codes (200, 404, 500, etc.) to communicate request results to clients
- **Add Custom Headers**: Include metadata, caching directives, and API versioning information in responses
- **Handle File Downloads**: Stream binary data with proper Content-Type and Content-Disposition headers for file downloads
- **Configure CORS**: Enable cross-origin requests by adding Access-Control headers for browser security
- **Implement Redirects**: Send location headers with 301/302 status codes to redirect clients to new resources
- **Process Error Responses**: Return appropriate error status codes and structured error messages for client debugging

## Error Handling

YinzerFlow automatically handles response processing errors and provides clear error messages:

**Header-related errors:**
- `Invalid header value: contains CRLF characters`
- `Suspicious header pattern detected: potential injection attempt`
- `Header validation failed: invalid characters in header name`

**Body processing errors:**
- `Failed to stringify response body: circular reference detected`
- `Binary data encoding error: invalid buffer format`
- `Response body too large: exceeds maximum size limit`

These errors are automatically logged and result in appropriate HTTP status codes (500 Internal Server Error) to prevent malformed responses from being sent to clients.

## Security Considerations

YinzerFlow implements several security measures to prevent common response-based vulnerabilities:

### 🛡️ CRLF Injection Prevention
- **Problem**: Injecting carriage return (`\r`) or line feed (`\n`) characters in header values can allow attackers to inject additional headers or even HTTP response splitting attacks
- **YinzerFlow Solution**: Comprehensive validation detects and blocks CRLF characters in header values before they are set, preventing header injection attacks

### 🛡️ Response Header Validation
- **Problem**: Invalid header names or values can cause parsing errors in clients or bypass security controls
- **YinzerFlow Solution**: All response headers are validated against HTTP specifications and security patterns before being sent

### 🛡️ Suspicious Pattern Detection
- **Problem**: Attackers may try to inject malicious headers like `Set-Cookie` or create HTTP response splitting attacks
- **YinzerFlow Solution**: Advanced pattern detection identifies and blocks suspicious header values that could indicate injection attempts

### 🛡️ Safe Header Filtering
- **Problem**: Undefined or null header values can cause unexpected behavior or security bypasses
- **YinzerFlow Solution**: Automatic filtering removes undefined values and validates all headers before they reach the response

### 🛡️ Content-Type Security
- **Problem**: Missing or incorrect Content-Type headers can lead to MIME sniffing attacks or content confusion
- **YinzerFlow Solution**: Intelligent content type detection ensures appropriate Content-Type headers are set based on response body content

### 🛡️ JSON Stringification Safety
- **Problem**: Circular references or non-serializable objects can crash the server or leak sensitive information
- **YinzerFlow Solution**: Safe JSON stringification with error handling prevents crashes and provides fallback string conversion

### 🛡️ Binary Data Handling
- **Problem**: Improper binary data encoding can corrupt files or expose server internals
- **YinzerFlow Solution**: Proper binary data detection and encoding ensures files are transmitted correctly and securely

### 🛡️ Status Code Validation
- **Problem**: Invalid HTTP status codes can confuse clients or indicate server errors
- **YinzerFlow Solution**: Automatic mapping of status codes to standard HTTP status messages ensures consistent and valid responses

### 🛡️ Automatic Security Headers
- **Problem**: Missing security headers leave applications vulnerable to clickjacking, MIME sniffing, and XSS attacks
- **YinzerFlow Solution**: Automatically adds essential security headers to every response unless explicitly overridden by the application

These security measures ensure YinzerFlow's response implementation follows security best practices and prevents common attack vectors while maintaining HTTP compliance and performance. 