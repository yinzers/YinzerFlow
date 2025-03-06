import { YinzerFlow } from 'yinzerflow';
import { MultipartFormData, JsonData, XmlData, UrlEncodedFormData, CsvData, PlainTextData } from 'yinzerflow/types/http/Request';
import { isMultipartFormData, isJsonData, isXmlData, isUrlEncodedFormData, isCsvData, isPlainTextData } from 'yinzerflow/utils/contentType.utils';

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
    const body = request.body as JsonData;

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
    if (!isJsonData(request.body)) {
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
    const body = request.body as XmlData;

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
  // URL-Encoded Form Data Handlers
  //=============================================================================

  /**
   * Fast approach for URL-encoded form data (using type casting)
   */
  app.post('/api/form/fast', ({ request }) => {
    // Use type assertion - fast but no runtime validation
    const body = request.body as UrlEncodedFormData;

    // Access form fields directly
    const username = body.username || 'anonymous';
    const email = body.email || 'not provided';

    return {
      success: true,
      message: `Form submitted by ${username}`,
      contactEmail: email,
      fieldCount: Object.keys(body).length,
    };
  });

  /**
   * Safe approach for URL-encoded form data (using type guards)
   */
  app.post('/api/form/safe', ({ request, response }) => {
    // Runtime type checking
    if (!isUrlEncodedFormData(request.body)) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Expected URL-encoded form data',
      };
    }

    // TypeScript knows request.body is UrlEncodedFormData here
    const body = request.body;

    // Validate required fields
    if (!body.username) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Missing required field: username',
      };
    }

    return {
      success: true,
      message: `Form submitted by ${body.username}`,
      fields: Object.keys(body),
    };
  });

  //=============================================================================
  // CSV Data Handlers
  //=============================================================================

  /**
   * Fast approach for CSV data (using type casting)
   */
  app.post('/api/csv/fast', ({ request }) => {
    // Use type assertion - fast but no runtime validation
    const body = request.body as CsvData;

    // Access CSV data directly
    const { headers, rows } = body;

    return {
      success: true,
      message: `Processed CSV with ${rows.length} rows`,
      headers,
      rowCount: rows.length,
      firstRow: rows[0] || {},
    };
  });

  /**
   * Safe approach for CSV data (using type guards)
   */
  app.post('/api/csv/safe', ({ request, response }) => {
    // Runtime type checking
    if (!isCsvData(request.body)) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Expected CSV data',
      };
    }

    // TypeScript knows request.body is CsvData here
    const { headers, rows } = request.body;

    // Validate CSV structure
    if (headers.length === 0) {
      response.setStatus(400);
      return {
        success: false,
        message: 'CSV must have at least one header',
      };
    }

    return {
      success: true,
      message: `Processed CSV with ${rows.length} rows`,
      headers,
      rowCount: rows.length,
    };
  });

  //=============================================================================
  // Plain Text Data Handlers
  //=============================================================================

  /**
   * Fast approach for plain text data (using type casting)
   */
  app.post('/api/text/fast', ({ request }) => {
    // Use type assertion - fast but no runtime validation
    const body = request.body as PlainTextData;

    // Access text content directly
    const { content } = body;

    return {
      success: true,
      message: 'Processed text content',
      charCount: content.length,
      wordCount: content.split(/\s+/).length,
      preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
    };
  });

  /**
   * Safe approach for plain text data (using type guards)
   */
  app.post('/api/text/safe', ({ request, response }) => {
    // Runtime type checking
    if (!isPlainTextData(request.body)) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Expected plain text data',
      };
    }

    // TypeScript knows request.body is PlainTextData here
    const { content } = request.body;

    // Validate text content
    if (content.trim().length === 0) {
      response.setStatus(400);
      return {
        success: false,
        message: 'Text content cannot be empty',
      };
    }

    return {
      success: true,
      message: 'Processed text content',
      charCount: content.length,
      wordCount: content.split(/\s+/).length,
      lineCount: content.split(/\r?\n/).length,
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
    const body = request.body as MultipartFormData;

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

  //=============================================================================
  // Universal Content Handler
  //=============================================================================

  /**
   * Universal content handler that can process multiple content types
   */
  app.post('/api/content', ({ request, response }) => {
    const { body } = request;

    // Check for JSON data
    if (isJsonData(body)) {
      return {
        type: 'json',
        processed: true,
        fields: Object.keys(body),
      };
    }

    // Check for XML data
    if (isXmlData(body)) {
      const rootElement = Object.keys(body)[0];
      return {
        type: 'xml',
        processed: true,
        rootElement,
        attributes: body[rootElement]._attributes || {},
      };
    }

    // Check for URL-encoded form data
    if (isUrlEncodedFormData(body)) {
      return {
        type: 'form',
        processed: true,
        fields: Object.keys(body),
      };
    }

    // Check for multipart form data with file uploads
    if (isMultipartFormData(body)) {
      const { fields, files } = body;
      return {
        type: 'multipart',
        processed: true,
        fieldCount: Object.keys(fields).length,
        fileCount: Object.keys(files).length,
      };
    }

    // Check for CSV data
    if (isCsvData(body)) {
      const { headers, rows } = body;
      return {
        type: 'csv',
        processed: true,
        headers,
        rowCount: rows.length,
      };
    }

    // Check for plain text data
    if (isPlainTextData(body)) {
      const { content } = body;
      return {
        type: 'text',
        processed: true,
        length: content.length,
        preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      };
    }

    // Unknown content type
    response.setStatus(415); // Unsupported Media Type
    return {
      error: 'Unsupported content type',
      contentType: request.headers['Content-Type'],
    };
  });
}
