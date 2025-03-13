import { IMultipartFormData, isJsonData, isMultipartFormData, isXmlData, TJsonData, TXmlData, YinzerFlow } from 'yinzerflow';

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
  // XML Data Handlers
  //=============================================================================

  /**
   * Fast approach for XML data (using type casting)
   */
  app.post('/api/xml/fast', ({ request }) => {
    // Use type assertion - fast but no runtime validation
    const body = request.body as TXmlData;

    // Get the root element name (first key in the object)
    const rootElement = Object.keys(body)[0];

    // Access XML attributes and child elements
    const rootNode = body[rootElement];
    const attributes = rootNode._attributes || {};

    return {
      success: true,
      rootElement,
      version: attributes.version || 'unknown',
      childElements: Object.keys(rootNode).filter((key) => key !== '_attributes'),
    };
  });

  /**
   * Safe approach for XML data (using type guards)
   */
  app.post('/api/xml/safe', ({ request, response }) => {
    // Runtime type checking
    if (!isXmlData(request.body)) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Expected XML data',
      };
    }

    // TypeScript knows request.body is XmlData here
    const rootElement = Object.keys(request.body)[0];
    const rootNode = request.body[rootElement];

    // Validate XML structure
    if (!rootElement || !rootNode) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Invalid XML structure',
      };
    }

    return {
      success: true,
      rootElement,
      attributes: rootNode._attributes || {},
      childElements: Object.keys(rootNode).filter((key) => key !== '_attributes'),
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
