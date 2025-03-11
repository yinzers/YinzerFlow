# Content Type Handling

YinzerFlow provides robust support for parsing and handling various content types in HTTP requests and responses. This document explains the core concepts, features, and best practices for working with different content types.

## Core Concepts

In web applications, HTTP requests and responses can contain data in various formats, such as JSON, XML, form data, and more. YinzerFlow automatically detects and parses these formats based on the `Content-Type` header, making it easy to work with different types of data.

### Content Type Detection

YinzerFlow uses the `Content-Type` header to determine how to parse the request body:

```
Content-Type: application/json
Content-Type: application/xml
Content-Type: multipart/form-data
Content-Type: application/x-www-form-urlencoded
Content-Type: text/csv
Content-Type: text/plain
Content-Type: application/yaml
```

### Type Safety

YinzerFlow provides TypeScript interfaces and type guards for each supported content type, allowing you to work with request bodies in a type-safe manner.

## Supported Content Types

YinzerFlow supports the following content types out of the box:

| Content Type | MIME Type | Type Interface | Type Guard | Description |
|--------------|-----------|----------------|------------|-------------|
| JSON | `application/json` | `TJsonData` | `isJsonData` | JSON data as a generic object |
| XML | `application/xml` | `TXmlData` | `isXmlData` | XML data with elements, attributes, and children |
| Multipart Form | `multipart/form-data` | `IMultipartFormData` | `isMultipartFormData` | Form data with fields and file uploads |
| URL-encoded Form | `application/x-www-form-urlencoded` | `TUrlEncodedFormData` | `isUrlEncodedFormData` | Form data as key-value pairs |
| URL-encoded JSON | `application/x-www-form-urlencoded+json` | `TUrlEncodedJson` | `isUrlEncodedJson` | URL-encoded data with JSON values |
| CSV | `text/csv` | `ICsvData` | `isCsvData` | CSV data with headers and rows |
| Plain Text | `text/plain` | `IPlainTextData` | `isPlainTextData` | Text data with a content property |
| YAML | `application/yaml` | `TYamlData` | `isYamlData` | YAML data as a structured object |

## Working with Content Types

There are two main approaches to working with parsed request bodies in YinzerFlow:

### Approach 1: Type Casting (Simple but Less Safe)

This approach uses TypeScript's type assertion to specify the expected content type:

```typescript
import { IMultipartFormData } from 'yinzerflow/types/http/Request';

app.post('/upload', ({ request }) => {
  // Use type assertion - simple but no runtime validation
  const body = request.body as IMultipartFormData;
  
  // Access fields and files directly
  const { fields, files } = body;
  
  // Process the data...
  return { success: true };
});
```

**When to use this approach:**
- When you're certain about the content type (e.g., an internal API with controlled clients)
- When performance is critical and you want to avoid runtime type checking
- In simple applications where type safety is less important

### Approach 2: Type Guards (Safer and Recommended)

This approach uses runtime type checking for better safety:

```typescript
import { isMultipartFormData } from 'yinzerflow/types/http/Request';

app.post('/upload', ({ request, response }) => {
  // Runtime type checking
  if (!isMultipartFormData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected multipart form data' };
  }
  
  // TypeScript knows request.body is IMultipartFormData here
  const { fields, files } = request.body;
  
  // Process the data...
  return { success: true };
});
```

**When to use this approach:**
- When handling requests from external clients
- When an endpoint might receive different content types
- When you want to provide clear error messages for invalid requests
- In most production applications (recommended approach)

For more details on handling errors, including content type validation errors, refer to the [Error Handling](./error-handling.md) documentation.

## Detailed Content Type Examples

### JSON Data

JSON is one of the most common formats for API requests and responses:

```typescript
import { isJsonData } from 'yinzerflow/types/http/Request';

app.post('/api/users', ({ request, response }) => {
  if (!isJsonData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected JSON data' };
  }
  
  // Validate required fields
  const { name, email, age } = request.body;
  if (!name || !email) {
    response.setStatus(400);
    return { error: 'Name and email are required' };
  }
  
  // Process the data
  const newUser = {
    id: generateId(),
    name,
    email,
    age: age || null,
    createdAt: new Date().toISOString()
  };
  
  // Save the user (example)
  saveUser(newUser);
  
  response.setStatus(201);
  return newUser;
});
```

#### Type Definition

```typescript
// The JSON data type
type TJsonData = Record<string, unknown>;

// Type guard for JSON data
function isJsonData(data: unknown): data is TJsonData {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}
```

### Multipart Form Data (File Uploads)

Multipart form data is used for file uploads and complex forms:

```typescript
import { isMultipartFormData } from 'yinzerflow/types/http/Request';
import { saveFile } from './file-service';

app.post('/api/upload', ({ request, response }) => {
  if (!isMultipartFormData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected multipart form data' };
  }
  
  const { fields, files } = request.body;
  
  // Validate form fields
  const userId = fields.userId;
  if (!userId) {
    response.setStatus(400);
    return { error: 'User ID is required' };
  }
  
  // Process uploaded files
  const uploadedFiles = [];
  for (const [fieldName, file] of Object.entries(files)) {
    // Check file type
    if (!file.contentType.startsWith('image/')) {
      response.setStatus(400);
      return { error: `File ${file.name} is not an image` };
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      response.setStatus(400);
      return { error: `File ${file.name} exceeds the 5MB limit` };
    }
    
    // Save the file (example)
    const savedPath = saveFile(file.path, userId);
    
    uploadedFiles.push({
      originalName: file.name,
      size: file.size,
      type: file.contentType,
      savedPath
    });
  }
  
  response.setStatus(201);
  return {
    success: true,
    message: `Uploaded ${uploadedFiles.length} files for user ${userId}`,
    files: uploadedFiles
  };
});
```

#### Type Definition

```typescript
// The multipart form data interface
interface IMultipartFormData {
  fields: Record<string, string>;
  files: Record<string, UploadedFile>;
}

// The uploaded file interface
interface UploadedFile {
  name: string;
  path: string;
  size: number;
  contentType: string;
}

// Type guard for multipart form data
function isMultipartFormData(data: unknown): data is IMultipartFormData {
  return (
    data !== null &&
    typeof data === 'object' &&
    'fields' in data &&
    'files' in data &&
    typeof (data as any).fields === 'object' &&
    typeof (data as any).files === 'object'
  );
}
```

### XML Data

XML is commonly used in enterprise systems and SOAP APIs:

```typescript
import { isXmlData } from 'yinzerflow/types/http/Request';

app.post('/api/orders', ({ request, response }) => {
  if (!isXmlData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected XML data' };
  }
  
  // Validate required elements
  const orderElement = request.body.elements.find(el => el.name === 'order');
  if (!orderElement) {
    response.setStatus(400);
    return { error: 'Missing order element' };
  }
  
  // Process the order...
  
  response.setStatus(201);
  return { success: true, orderId: generatedOrderId };
});
```

### CSV Data

CSV is useful for importing and exporting tabular data:

```typescript
import { isCsvData } from 'yinzerflow/types/http/Request';

app.post('/api/import-users', ({ request, response }) => {
  if (!isCsvData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected CSV data' };
  }
  
  // Validate required columns
  const requiredColumns = ['name', 'email', 'role'];
  for (const column of requiredColumns) {
    if (!request.body.headers.includes(column)) {
      response.setStatus(400);
      return { error: `Missing required column: ${column}` };
    }
  }
  
  // Process the CSV data...
  
  return { success: true, importedCount: request.body.rows.length };
});
```

## Best Practices

### 1. Always Validate Request Bodies

Always validate the content type and structure of request bodies, especially for public APIs:

```typescript
app.post('/api/data', ({ request, response }) => {
  // Validate content type
  if (!isJsonData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected JSON data' };
  }
  
  // Validate required fields
  const { name, email } = request.body;
  if (!name || !email) {
    response.setStatus(400);
    return { error: 'Name and email are required' };
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    response.setStatus(400);
    return { error: 'Invalid email format' };
  }
  
  // Process the data...
});
```

### 2. Use Type Guards for Public APIs

For public APIs, always use type guards to validate request bodies:

```typescript
// Good practice for public APIs
if (!isJsonData(request.body)) {
  response.setStatus(400);
  return { error: 'Expected JSON data' };
}

// Avoid type assertions for public APIs
const body = request.body as TJsonData; // Unsafe
```

### 3. Set Appropriate Content-Type Headers for Responses

Set the appropriate `Content-Type` header for responses:

```typescript
app.get('/api/data.csv', ({ response }) => {
  const csvContent = generateCsvData();
  
  response.setStatus(200);
  response.modifyHeader('Content-Type', 'text/csv');
  response.modifyHeader('Content-Disposition', 'attachment; filename="data.csv"');
  return csvContent;
});
```

### 4. Handle Large File Uploads Properly

For file uploads, implement proper validation and limits:

```typescript
app.post('/api/upload', ({ request, response }) => {
  if (!isMultipartFormData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected multipart form data' };
  }
  
  const { files } = request.body;
  
  // Check file count
  if (Object.keys(files).length > 10) {
    response.setStatus(400);
    return { error: 'Maximum 10 files allowed' };
  }
  
  // Check file sizes
  for (const [, file] of Object.entries(files)) {
    if (file.size > 10 * 1024 * 1024) { // 10MB
      response.setStatus(400);
      return { error: `File ${file.name} exceeds the 10MB limit` };
    }
  }
  
  // Process files...
});
```

### 5. Use Structured Error Responses

Provide clear and structured error responses:

```typescript
app.post('/api/users', ({ request, response }) => {
  if (!isJsonData(request.body)) {
    response.setStatus(400);
    return {
      success: false,
      error: 'INVALID_CONTENT_TYPE',
      message: 'Expected JSON data'
    };
  }
  
  // Validate fields...
  const errors = validateUserData(request.body);
  if (errors.length > 0) {
    response.setStatus(400);
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid user data',
      details: errors
    };
  }
  
  // Process the data...
});
```

## Advanced Topics

### Custom Content Type Parsers

YinzerFlow allows you to register custom content type parsers:

```typescript
import { registerContentTypeParser } from 'yinzerflow';

// Register a custom parser for application/protobuf
registerContentTypeParser('application/protobuf', (body, contentType) => {
  // Parse the protobuf data
  const parsedData = decodeProtobuf(body);
  return parsedData;
});
```

### Content Negotiation

Implement content negotiation to support multiple response formats:

```typescript
app.get('/api/users/:id', ({ request, response }) => {
  const user = getUserById(request.params.id);
  if (!user) {
    response.setStatus(404);
    return { error: 'User not found' };
  }
  
  // Check Accept header
  const acceptHeader = request.headers.accept || 'application/json';
  
  if (acceptHeader.includes('application/xml')) {
    // Return XML response
    const xmlData = convertToXml({ user });
    response.modifyHeader('Content-Type', 'application/xml');
    return xmlData;
  }
  
  if (acceptHeader.includes('text/csv')) {
    // Return CSV response
    const csvData = convertToCsv([user]);
    response.modifyHeader('Content-Type', 'text/csv');
    return csvData;
  }
  
  // Default to JSON
  return user;
});
```

### Handling Binary Data

For binary data like images or PDFs:

```typescript
app.get('/api/files/:id', ({ request, response }) => {
  const file = getFileById(request.params.id);
  if (!file) {
    response.setStatus(404);
    return { error: 'File not found' };
  }
  
  // Return binary data
  response.modifyHeader('Content-Type', file.contentType);
  response.modifyHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  return file.data;
});
```

## Conclusion

YinzerFlow's content type handling system provides a flexible and type-safe way to work with various data formats in your web applications. By following the best practices outlined in this document, you can build robust APIs that handle different content types correctly and provide a great developer experience. 

// Find and update all remaining examples that use response helper methods

// Example for form data validation
app.post('/api/contact', ({ request, response }) => {
  if (!isUrlEncodedFormData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected form data' };
  }
  
  // Validate required fields
  const { name, email, message } = request.body;
  if (!name || !email || !message) {
    response.setStatus(400);
    return { error: 'Name, email, and message are required' };
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    response.setStatus(400);
    return { error: 'Invalid email format' };
  }
  
  // Process the contact form...
  
  return { success: true, message: 'Your message has been sent' };
});

// Example for file upload validation
app.post('/api/documents', ({ request, response }) => {
  if (!isMultipartFormData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected multipart form data' };
  }
  
  const { files } = request.body;
  
  // Check number of files
  if (Object.keys(files).length > 10) {
    response.setStatus(400);
    return { error: 'Maximum 10 files allowed' };
  }
  
  // Validate each file
  for (const [fieldName, file] of Object.entries(files)) {
    if (file.size > 10 * 1024 * 1024) {
      response.setStatus(400);
      return { error: `File ${file.name} exceeds the 10MB limit` };
    }
    
    // Process the file...
  }
  
  response.setStatus(201);
  return { success: true, message: 'Files uploaded successfully' };
});

// Example for retrieving a user
app.get('/api/users/:id', ({ request, response }) => {
  const userId = request.params.id;
  const user = findUserById(userId);
  
  if (!user) {
    response.setStatus(404);
    return { error: 'User not found' };
  }
  
  return user;
});

// Example for retrieving a file
app.get('/api/files/:id', ({ request, response }) => {
  const fileId = request.params.id;
  const file = findFileById(fileId);
  
  if (!file) {
    response.setStatus(404);
    return { error: 'File not found' };
  }
  
  // Set appropriate content type for the file
  response.modifyHeader('Content-Type', file.contentType);
  
  // Return the file content
  return file.content;
}); 