# Handling Different Content Types in YinzerFlow

YinzerFlow provides built-in support for parsing various content types in HTTP requests. This document covers how to work with different content types in your route handlers.

## Supported Content Types

YinzerFlow automatically parses request bodies based on the Content-Type header:

| Content Type | Type Guard | Type Interface | Description |
|--------------|------------|----------------|-------------|
| JSON | `isJsonData` | `IJsonData` | JSON data as a generic object (`Record<string, any>`) |
| XML | `isXmlData` | `IXmlData` | XML data with root elements, attributes, and child elements |
| Multipart Form | `isMultipartFormData` | `IMultipartFormData` | Form data with `fields` and `files` properties |
| URL-encoded Form | `isUrlEncodedFormData` | `IUrlEncodedFormData` | Form data as key-value pairs (`Record<string, string>`) |
| URL-encoded JSON | `isUrlEncodedJsonData` | `IJsonData` | URL-encoded data with JSON values |
| CSV | `isCsvData` | `ICsvData` | CSV data with `headers` and `rows` properties |
| Plain Text | `isPlainTextData` | `IPlainTextData` | Text data with a `content` property |
| YAML | `isYamlData` | `IYamlData` | YAML data as a structured object |

## Working with Content Types

There are two main approaches to working with parsed request bodies:

### Approach 1: Type Casting (Fastest)

This approach assumes the request body is of a specific content type and uses type assertion. It's the fastest option but provides no runtime safety. Use this when you're certain the endpoint will only receive a specific content type:

```typescript
import { IMultipartFormData } from 'yinzerflow/types/http/Request';

app.post('/upload', ({ request }) => {
    // Use type assertion - fast but no runtime validation
    const body = request.body as IMultipartFormData;

    // Access fields and files directly
    const { fields, files } = body;

    // Process fields
    const username = fields.username || 'anonymous';

    // Process files
    const fileNames = Object.keys(files);
    const fileSizes = fileNames.map((name) => ({
      name,
      size: files[name].size,
      type: files[name].contentType,
    }));

    return {
      success: true,
      message: `Upload received for ${username}`,
      fieldCount: Object.keys(fields).length,
      fileCount: fileNames.length,
      files: fileSizes,
    };
});
```

### Approach 2: Type Guards with Validation (Safer)

This approach uses runtime type checking for better safety. It's safer but adds a small runtime overhead. Use this when the endpoint might receive different content types or when you need validation:

```typescript
import { isMultipartFormData } from 'yinzerflow/types/http/Request';

app.post('/upload', ({ request, response }) => {
    // Runtime type checking
    if (!isMultipartFormData(request.body)) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Expected multipart form data',
      };
    }

    // TypeScript knows request.body is IMultipartFormData here
    const { fields, files } = request.body;

    // Process fields
    const username = fields.username || 'anonymous';

    // Process files
    const fileNames = Object.keys(files);
    const fileSizes = fileNames.map((name) => ({
      name,
      size: files[name].size,
      type: files[name].contentType,
    }));

    return {
      success: true,
      message: `Upload received for ${username}`,
      fieldCount: Object.keys(fields).length,
      fileCount: fileNames.length,
      files: fileSizes,
    };
});
```

## Content Type Examples

### JSON Data

```typescript
import { isJsonData } from 'yinzerflow/types/http/Request';

app.post('/api/json', ({ request, response }) => {
  if (!isJsonData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected JSON data' };
  }
  
  // Work with JSON data
  const { name, email } = request.body;
  
  return { success: true, data: { name, email } };
});
```

### XML Data

```typescript
import { isXmlData } from 'yinzerflow/types/http/Request';

app.post('/api/xml', ({ request, response }) => {
  if (!isXmlData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected XML data' };
  }
  
  // Access XML elements and attributes
  const user = request.body.user;
  const attributes = user?._attributes || {};
  const name = user?.name || '';
  
  return { success: true, data: { id: attributes.id, name } };
});
```

### CSV Data

```typescript
import { isCsvData } from 'yinzerflow/types/http/Request';

app.post('/api/csv', ({ request, response }) => {
  if (!isCsvData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected CSV data' };
  }
  
  // Access CSV headers and rows
  const { headers, rows } = request.body;
  
  return { 
    success: true, 
    columnCount: headers.length,
    rowCount: rows.length,
    data: rows
  };
});
```

### Plain Text Data

```typescript
import { isPlainTextData } from 'yinzerflow/types/http/Request';

app.post('/api/text', ({ request, response }) => {
  if (!isPlainTextData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected plain text data' };
  }
  
  // Access text content
  const { content } = request.body;
  const wordCount = content.split(/\s+/).length;
  
  return { 
    success: true, 
    wordCount,
    charCount: content.length
  };
});
```

### YAML Data

```typescript
import { isYamlData } from 'yinzerflow/types/http/Request';

app.post('/api/yaml', ({ request, response }) => {
  if (!isYamlData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected YAML data' };
  }
  
  // Access YAML data
  const { config, version } = request.body;
  
  return { 
    success: true, 
    version,
    configItems: Object.keys(config || {}).length
  };
});
```

### URL-encoded Form Data

```typescript
import { isUrlEncodedFormData } from 'yinzerflow/types/http/Request';

app.post('/api/form', ({ request, response }) => {
  if (!isUrlEncodedFormData(request.body)) {
    response.setStatus(400);
    return { error: 'Expected form data' };
  }
  
  // Access form fields
  const { username, email } = request.body;
  
  return { 
    success: true, 
    user: { username, email }
  };
});
```

## Type Guards Implementation

For reference, here's how the type guards are implemented:

```typescript
// Type guard for JSON data
export function isJsonData(body: unknown): body is IJsonData {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

// Type guard for multipart form data
export function isMultipartFormData(body: unknown): body is IMultipartFormData {
  return (
    typeof body === 'object' && 
    body !== null && 
    'fields' in body && 
    'files' in body &&
    typeof (body as any).fields === 'object' &&
    typeof (body as any).files === 'object'
  );
}

// Additional type guards follow the same pattern
```

For more detailed examples, see the [content handlers example](/example/routes/content-types.ts). 