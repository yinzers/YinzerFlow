import { IMultipartFormData, isJsonData, isMultipartFormData, TJsonData, YinzerFlow } from 'yinzerflow';

/**
 * This file demonstrates different approaches to handle various content types:
 * 1. Fast approach using type casting (no runtime checks)
 * 2. Safe approach using type guards (with runtime validation)
 */
export default function setupContentHandlers(app: YinzerFlow) {
  //=============================================================================
  // JSON Data Handlers
  //=============================================================================

  /**
   * Fast approach for JSON data (using type casting)
   */
  app.post('/api/json/fast', ({ request }) => {
    // Use type assertion - fast but no runtime validation
    const body = request.body as TJsonData<{ name: string; email: string; preferences: Record<string, unknown> }>;

    // Access properties directly
    const { name, email, preferences } = body;

    return {
      success: true,
      message: `Processed JSON data for ${name}`,
      emailConfirmed: !!email,
      preferencesCount: preferences ? Object.keys(preferences).length : 0,
    };
  });

  /**
   * Safe approach for JSON data (using type guards)
   */
  app.post('/api/json/safe', ({ request, response }) => {
    // Runtime type checking
    if (!isJsonData<{ name: string; email: string; preferences: Record<string, unknown> }>(request.body)) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Expected JSON data',
      };
    }

    // TypeScript knows request.body is JsonData here
    const body = request.body;

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      response.setStatus(400);
      return {
        success: false,
        message: 'Missing or invalid required field: name',
      };
    }

    return {
      success: true,
      message: `Processed JSON data for ${body.name}`,
      receivedFields: Object.keys(body),
    };
  });

  //=============================================================================
  // Multipart Form Data Handlers
  //=============================================================================

  /**
   * Fast approach for multipart form data (using type casting)
   */
  app.post('/api/multipart/fast', ({ request }) => {
    // Use type assertion - fast but no runtime validation
    const body = request.body as IMultipartFormData;

    // Access form fields and files
    const { fields, files } = body;

    return {
      success: true,
      message: 'Processed multipart form data',
      fieldCount: Object.keys(fields).length,
      fileCount: Object.keys(files).length,
      fileNames: Object.keys(files),
    };
  });

  /**
   * Safe approach for multipart form data (using type guards)
   */
  app.post('/api/multipart/safe', ({ request, response }) => {
    // Runtime type checking
    if (!isMultipartFormData(request.body)) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Expected multipart form data',
      };
    }

    // TypeScript knows request.body is MultipartFormData here
    const { fields, files } = request.body;

    // Process files
    const fileInfo = Object.entries(files).map(([name, file]) => ({
      name,
      size: file.size,
      contentType: file.contentType,
    }));

    return {
      success: true,
      message: 'Processed multipart form data',
      fields,
      files: fileInfo,
    };
  });
}
