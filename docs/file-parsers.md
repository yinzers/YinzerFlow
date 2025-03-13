# File Parsers

YinzerFlow provides robust support for parsing various file formats in HTTP requests and responses. This document explains the core concepts, features, and best practices for working with different file formats.

## Core Concepts

In web applications, files can be uploaded in various formats, such as YAML, CSV, and more. YinzerFlow automatically detects and parses these formats based on the file extension and content type, making it easy to work with different types of files.

### Parser Configuration

YinzerFlow allows you to configure how files are parsed through the `parserOptions` in your server configuration. You can control whether files should be automatically parsed:

```typescript
const app = new YinzerFlow({
  port: 5000,
  parserOptions: {
    yaml: {
      raw: true,
    },
    json: {
        raw: true,
    }
  },
  // Other options...
});
```

#### Raw Mode

Setting `raw: true` in the parser options disables automatic parsing of files. This is useful when:

- You want to handle the parsing yourself
- You're dealing with binary files that don't need parsing
- You need to implement custom parsing logic
- You want to improve performance by avoiding unnecessary parsing

When raw mode is enabled, file contents will be provided as Buffer objects or strings, depending on the file type.

### Type Safety

YinzerFlow provides TypeScript interfaces and type guards for each supported file format, allowing you to work with file contents in a type-safe manner.

## Supported File Formats

YinzerFlow supports the following file formats out of the box:

| Format | MIME Type | Type Interface | Type Guard | Description |
|--------|-----------|----------------|------------|-------------|
| YAML | `text/yaml`, `application/x-yaml` | `TYamlData` | `isYamlData` | YAML data with support for complex structures |
| CSV (Coming Soon) | `text/csv` | `TCsvData` | `isCsvData` | CSV data with headers and rows |
| JSON (Coming Soon) | `application/json` | `TJsonData` | `isJsonData` | JSON data as a generic object |

## Working with File Parsers

There are two main approaches to working with parsed file contents in YinzerFlow:

### Approach 1: Type Casting (Simple but Less Safe)

This approach uses TypeScript's type assertion to specify the expected file format:

```typescript
import { TYamlData } from 'yinzerflow/types/parsers/fileParsers/Yaml';

app.post('/upload', ({ request }) => {
  // Use type assertion - simple but no runtime validation
  const fileContent = request.file.content as TYamlData;
  
  // Access the parsed data directly
  const config = fileContent;
  
  // Process the data...
  return { success: true };
});
```

**When to use this approach:**
- When you're certain about the file format (e.g., an internal API with controlled clients)
- When performance is critical and you want to avoid runtime type checking
- In simple applications where type safety is less important

### Approach 2: Type Guards (Safer and Recommended)

This approach uses runtime type checking for better safety:

```typescript
import { isYamlData } from 'yinzerflow/types/parsers/fileParsers/Yaml';

app.post('/upload', ({ request, response }) => {
  // Runtime type checking
  if (!isYamlData(request.file.content)) {
    response.setStatus(400);
    return { error: 'Expected YAML file' };
  }
  
  // TypeScript knows request.file.content is TYamlData here
  const config = request.file.content;
  
  // Process the data...
  return { success: true };
});
```

**When to use this approach:**
- When handling files from external clients
- When an endpoint might receive different file formats
- When you want to provide clear error messages for invalid files
- In most production applications (recommended approach)

### Approach 3: Manual Parsing (When Raw Mode is Enabled)

When you've configured YinzerFlow with `raw: true` in the parser options, you'll need to manually parse file contents:

```typescript
// Your own custom parser
import { parseYaml } from 'custom/parser';

app.post('/upload', ({ request, response }) => {
  // Get the raw file content (as Buffer or string)
  const rawContent = request.file.content;
  
  try {
    // Manually parse the content
    const parsedContent = parseYaml(rawContent.toString());
    
    // Process the parsed content
    // ...
    
    return { success: true };
  } catch (error) {
    response.setStatus(400);
    return { error: 'Failed to parse YAML file' };
  }
});
```

**When to use this approach:**
- When you've disabled automatic parsing with `raw: true`
- When you need custom parsing logic
- When you want to handle parsing errors in a specific way
- When working with binary files or non-standard formats

## Detailed File Format Examples

### YAML Files

YAML is commonly used for configuration files and structured data:

```typescript
import { isYamlData } from 'yinzerflow/types/parsers/fileParsers/Yaml';

app.post('/api/config', ({ request, response }) => {
  if (!isYamlData(request.file.content)) {
    response.setStatus(400);
    return { error: 'Expected YAML file' };
  }
  
  // Validate required fields
  const config = request.file.content;
  if (!config.version || !config.settings) {
    response.setStatus(400);
    return { error: 'Invalid YAML structure' };
  }
  
  // Process the configuration
  const processedConfig = {
    version: config.version,
    settings: config.settings,
    processedAt: new Date().toISOString()
  };
  
  // Save the configuration (example)
  saveConfig(processedConfig);
  
  response.setStatus(201);
  return processedConfig;
});
```

#### Type Definition

```typescript
// The YAML data type
type TYamlData = Array<TYamlData> | boolean | number | string | { [key: string]: TYamlData } | null;

// Type guard for YAML data
const isYamlData = (content: unknown): content is TYamlData => {
  // Implementation details...
};
```

### CSV Files (Coming Soon)

CSV files are commonly used for data import/export:

### JSON Files (Coming Soon)

JSON files are commonly used for structured data:

## Best Practices

### 1. Always Validate File Contents

Always validate the file format and structure, especially for public APIs:

```typescript
app.post('/api/import', ({ request, response }) => {
  // Validate file format
  if (!isYamlData(request.file.content)) {
    response.setStatus(400);
    return { error: 'Expected YAML file' };
  }
  
  // Validate required structure
  const data = request.file.content;
  if (!data || typeof data !== 'object') {
    response.setStatus(400);
    return { error: 'Invalid YAML structure' };
  }
  
  // Validate specific fields
  const { name, version } = data;
  if (!name || !version) {
    response.setStatus(400);
    return { error: 'Missing required fields' };
  }
  
  // Process the data...
});
```

### 2. Use Type Guards for Public APIs

Always use type guards when handling files from external sources:

```typescript
app.post('/api/upload', ({ request, response }) => {
  // Check file type
  if (!request.file.contentType.startsWith('text/yaml')) {
    response.setStatus(415);
    return { error: 'Unsupported file type' };
  }
  
  // Validate file content
  if (!isYamlData(request.file.content)) {
    response.setStatus(400);
    return { error: 'Invalid YAML format' };
  }
  
  // Process the file...
});
```

### 3. Handle Large Files Efficiently

When dealing with large files, consider using streams and processing data in chunks:

```typescript
app.post('/api/import', async ({ request, response }) => {
  if (!isYamlData(request.file.content)) {
    response.setStatus(400);
    return { error: 'Expected YAML file' };
  }
  
  // Process large files in chunks
  const chunkSize = 1000;
  const data = request.file.content;
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await processChunk(chunk);
  }
  
  return { success: true };
});
```

