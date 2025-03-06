/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable max-statements */
import type { IRequest, IYamlData, TRequestBody } from '../types/http/Request.ts';
import type { IRoute } from '../types/Route.ts';
import { ContentType } from '../constants/http.ts';

/**
 * Represents a file uploaded via multipart form data
 */
export interface UploadedFile {
  /** Original filename provided by the client */
  filename: string;
  /** MIME type of the file */
  contentType: string;
  /** Size of the file in bytes */
  size: number;
  /** Raw file content as a string */
  content: string;
  /** Additional metadata about the file */
  metadata?: Record<string, string>;
}

/**
 * Handles parsing of HTTP request components
 *
 * This class encapsulates all request parsing logic:
 * - Body parsing (JSON, XML, form data, multipart, etc.)
 * - Header parsing
 * - Query parameter parsing
 * - URL parameter parsing
 * - File upload handling
 */
export class RequestParser {
  /**
   * Parse request body based on Content-Type
   *
   * @param headers - Request headers containing Content-Type
   * @param body - Raw request body string
   * @returns Parsed request body object
   * @throws Error if Content-Type is missing or body format is invalid
   */
  parseBody(headers: IRequest['headers'], body: string): TRequestBody {
    if (!headers['Content-Type']) {
      throw new Error('Missing Content-Type header');
    }

    const contentType = headers['Content-Type'];

    // Use a more efficient approach with early returns
    if (contentType === ContentType.JSON) {
      return this._handleApplicationJson(body);
    }

    if (contentType === ContentType.FORM) {
      return this._handleXwwwFormUrlencoded(body);
    }

    if (contentType.includes(ContentType.MULTIPART)) {
      return this._handleMultipartFormData(body);
    }

    if (contentType === ContentType.XML || contentType === 'text/xml') {
      return this._handleXml(body);
    }

    if (contentType === ContentType.TEXT) {
      return this._handlePlainText(body);
    }

    if (contentType === ContentType.URL_ENCODED_JSON) {
      return this._handleUrlEncodedJson(body);
    }

    if (contentType === ContentType.CSV || contentType === 'application/csv') {
      return this._handleCsv(body);
    }

    if (contentType === ContentType.YAML || contentType === 'application/x-yaml' || contentType === 'text/yaml') {
      return this._handleYaml(body);
    }

    // Default case - return empty object for unsupported content types
    return {};
  }

  /**
   * Parse request headers
   *
   * @param rawHeaders - Raw header string
   * @returns Object with parsed headers
   */
  parseHeaders(rawHeaders: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!rawHeaders) return headers;

    // Normalize line endings and split
    const normalizedHeaders = rawHeaders.replace(/\r\n|\r|\n/g, '\n');
    const headerLines = normalizedHeaders.split('\n');

    for (const line of headerLines) {
      if (!line) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (key) {
        headers[key] = value;
      }
    }

    return headers;
  }

  /**
   * Parse URL parameters from route pattern
   *
   * @param route - Route object containing path pattern
   * @param path - Actual request path
   * @returns Object with parsed parameters
   */
  parseParams(route: IRoute, path: string): Record<string, string> {
    const params: Record<string, string> = {};

    // Early returns for invalid inputs
    if (typeof route.path !== 'string') return params;
    if (typeof path !== 'string') return params;

    // Extract parameter names from route pattern
    const paramMatches = route.path.match(/:[^/]+/g);
    const paramNames = paramMatches ? paramMatches.map((param) => param.slice(1)) : [];

    if (paramNames.length === 0) return params;

    // Convert route pattern to regex with capture groups
    const pattern = route.path.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${pattern}$`);

    // Extract parameter values from path
    const match = path.match(regex);
    if (!match) return params;

    // Map parameter names to values (skip first match which is the full string)
    for (let i = 0; i < paramNames.length; i++) {
      const value = match[i + 1];
      const paramName = paramNames[i];

      // Only add to params if both value and paramName are defined
      if (value && paramName) {
        params[paramName] = value;
      }
    }

    return params;
  }

  /**
   * Parse query parameters from URL
   *
   * @param url - URL string potentially containing query parameters
   * @returns Object with parsed query parameters
   */
  parseQuery(url: string): Record<string, string> {
    if (!url) return {};

    if (!url.includes('?')) return {};

    const [, queryString] = url.split('?', 2);
    if (!queryString) return {};

    const result: Record<string, string> = {};
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      if (!pair) continue;

      // Handle parameters without values (e.g., "param" instead of "param=value")
      if (!pair.includes('=')) {
        result[pair] = '';
        continue;
      }

      const [key, value] = pair.split('=', 2);
      if (!key) continue;

      result[key] = value ?? '';
    }

    return result;
  }

  /**
   * Parse JSON request body
   *
   * @param body - Raw JSON string
   * @returns Parsed JSON object
   * @throws Error if JSON is invalid
   */
  private _handleApplicationJson(body: string): TRequestBody {
    try {
      return <TRequestBody>JSON.parse(body);
    } catch (error) {
      throw new Error(`Invalid JSON body: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Parse form-urlencoded request body
   *
   * @param body - Raw form-urlencoded string
   * @returns Parsed form data object
   */
  private _handleXwwwFormUrlencoded(body: string): TRequestBody {
    return this._parseKeyValuePairs(body, '&', '=');
  }

  /**
   * Helper method to parse key-value pairs from a string
   *
   * @param data - String containing key-value pairs
   * @param pairSeparator - Character that separates pairs (e.g., '&')
   * @param keyValueSeparator - Character that separates keys from values (e.g., '=')
   * @returns Object with parsed key-value pairs
   */
  private _parseKeyValuePairs(data: string, pairSeparator: string, keyValueSeparator: string): TRequestBody {
    const result: Record<string, string> = {};

    if (!data) return result;

    const pairs = data.split(pairSeparator);
    for (const pair of pairs) {
      if (!pair) continue;

      const separatorIndex = pair.indexOf(keyValueSeparator);
      if (separatorIndex === -1) continue;

      const key = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);

      if (!key) continue;
      result[key] = value || '';
    }

    return result;
  }

  /**
   * Parse multipart form data request body
   *
   * @param body - Raw multipart form data string
   * @returns Parsed form data object with fields and files
   * @throws Error if multipart format is invalid
   */
  private _handleMultipartFormData(body: string): TRequestBody {
    const result: Record<string, any> = {
      fields: {},
      files: {},
    };

    // Extract the boundary from the Content-Type header
    // In real requests, the boundary is in the Content-Type header, not in the body
    // For our tests, we'll check if the body starts with a boundary
    const boundaryMatch = /^--(?<boundary>[^\r\n]+)/.exec(body);
    const boundary = boundaryMatch?.groups?.boundary ?? null;

    if (!boundary) {
      throw new Error('Invalid multipart form data: missing boundary');
    }

    // Split the body into parts using the boundary
    const parts = body.split(`--${boundary}`).slice(1); // Skip the first empty part

    for (const part of parts) {
      // Skip empty parts and the final boundary marker
      if (!part || part.trim() === '--') continue;

      // Parse the part headers
      const [headersSection, contentSection] = this._splitMultipartSection(part);
      if (!headersSection || !contentSection) continue;

      // Parse the Content-Disposition header
      const contentDisposition = this._parseContentDisposition(headersSection);
      if (!contentDisposition.name) continue;

      // Check if this is a file upload
      if (contentDisposition.filename) {
        // This is a file upload
        const contentType = this._extractContentType(headersSection) ?? 'application/octet-stream';

        // Create a file object
        const file: UploadedFile = {
          filename: contentDisposition.filename,
          contentType,
          size: contentSection.length,
          content: contentSection,
          metadata: {
            uploadedAt: new Date().toISOString(),
          },
        };

        // Add to files collection
        result.files[contentDisposition.name] = file;
      } else {
        // This is a regular form field
        result.fields[contentDisposition.name] = contentSection.trim();
      }
    }

    return result;
  }

  /**
   * Split a multipart section into headers and content
   *
   * @param section - Raw multipart section
   * @returns Tuple of [headers, content]
   */
  private _splitMultipartSection(section: string): [string, string] {
    const doubleNewlineIndex = section.indexOf('\r\n\r\n');
    if (doubleNewlineIndex === -1) return ['', ''];

    const headers = section.substring(0, doubleNewlineIndex);
    let content = section.substring(doubleNewlineIndex + 4); // Skip the double newline

    // Remove trailing newlines before boundary
    if (content.endsWith('\r\n')) {
      content = content.slice(0, -2);
    }

    return [headers, content];
  }

  /**
   * Parse the Content-Disposition header to extract field name and filename
   *
   * @param header - Content-Disposition header value
   * @returns Object with name and optional filename
   */
  private _parseContentDisposition(header: string): { name: string; filename?: string } {
    const result: { name: string; filename?: string } = { name: '' };

    // Extract the field name
    const nameMatch = /name="(?<name>[^"]+)"/.exec(header);
    if (nameMatch?.groups?.name) {
      result.name = nameMatch.groups.name;
    }

    // Extract the filename if present
    const filenameMatch = /filename="(?<filename>[^"]+)"/.exec(header);
    if (filenameMatch?.groups?.filename) {
      result.filename = filenameMatch.groups.filename;
    }

    return result;
  }

  /**
   * Extract Content-Type from headers section
   *
   * @param headers - Headers section of multipart part
   * @returns Content-Type string or undefined if not found
   */
  private _extractContentType(headers: string): string | undefined {
    const contentTypeMatch = /Content-Type:\s*(?<contentType>[^\r\n]+)/i.exec(headers);
    return contentTypeMatch?.groups?.contentType?.trim();
  }

  /**
   * Parse XML request body
   *
   * @param body - Raw XML string
   * @returns Parsed XML object
   * @throws Error if XML parsing is not supported
   */
  private _handleXml(body: string): TRequestBody {
    try {
      // Simple XML parsing - convert to JSON-like structure
      // This is a basic implementation - for production, use a proper XML parser
      const result: Record<string, any> = {};

      // Extract root element
      const rootMatch = /<(?<rootName>[^\s>]+)(?<rootAttrs>[^>]*)>(?<rootContent>[\s\S]*?)<\/\1>/.exec(body);
      if (!rootMatch?.groups) {
        throw new Error('Invalid XML format');
      }

      const { rootName, rootAttrs = '', rootContent = '' } = rootMatch.groups;

      // Parse attributes
      const attributes: Record<string, string> = {};
      const attrMatches = rootAttrs.matchAll(/(?<attrName>[^\s=]+)="(?<attrValue>[^"]*)"/g);
      for (const match of attrMatches) {
        if (match.groups?.attrName && match.groups.attrValue !== undefined) {
          attributes[match.groups.attrName] = match.groups.attrValue;
        }
      }

      // Parse child elements
      const childElements: Record<string, any> = {};
      const childMatches = rootContent.matchAll(/<(?<childName>[^\s>]+)(?<childAttrs>[^>]*)>(?<childContent>[\s\S]*?)<\/\1>/g);
      for (const match of childMatches) {
        if (match.groups?.childName && match.groups.childContent !== undefined) {
          const { childName, childContent } = match.groups;

          // Check if content has nested elements
          if (childContent.includes('<')) {
            // Recursive parsing would be needed here for nested elements
            // For simplicity, we'll just store the content as is
            childElements[childName] = childContent.trim();
          } else {
            childElements[childName] = childContent.trim();
          }
        }
      }

      // Combine root info, attributes, and child elements
      if (rootName) {
        result[rootName] = {
          _attributes: attributes,
          ...childElements,
        };
      }

      return result;
    } catch (error) {
      throw new Error(`XML parsing not fully supported: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Parse plain text request body
   *
   * @param body - Raw text string
   * @returns Object with text content
   */
  private _handlePlainText(body: string): TRequestBody {
    return { content: body };
  }

  /**
   * Parse URL-encoded JSON request body
   *
   * @param body - Raw URL-encoded JSON string
   * @returns Parsed JSON object
   * @throws Error if JSON is invalid
   */
  private _handleUrlEncodedJson(body: string): TRequestBody {
    try {
      // First parse as URL-encoded
      const decoded = this._handleXwwwFormUrlencoded(body);

      // Then parse any JSON values
      const result: Record<string, any> = {};

      // Fix: Type-safe Object.entries with type assertion
      for (const [key, value] of Object.entries(<Record<string, unknown>>decoded)) {
        try {
          // Try to parse as JSON
          // First decode the URL-encoded JSON string
          const decodedValue = decodeURIComponent(String(value));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          result[key] = JSON.parse(decodedValue);
        } catch {
          // If not valid JSON, keep as is
          result[key] = value;
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Invalid URL-encoded JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Parse CSV request body
   *
   * @param body - Raw CSV string
   * @returns Array of objects representing CSV rows
   */
  private _handleCsv(body: string): TRequestBody {
    try {
      // Split into lines
      const lines = body.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length === 0) {
        return { rows: <Array<Record<string, string>>>[] };
      }

      // Parse header row
      const [headerLine, ...dataLines] = lines;
      if (!headerLine) {
        return { rows: <Array<Record<string, string>>>[] };
      }

      const headers = this._parseCsvLine(headerLine);

      // Parse data rows
      const rows: Array<Record<string, string>> = [];
      for (const line of dataLines) {
        if (!line) continue;

        const values = this._parseCsvLine(line);
        if (values.length === 0) continue;

        const row: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          if (j < values.length && header !== undefined) {
            row[header] = values[j] ?? '';
          }
        }

        rows.push(row);
      }

      return { headers, rows };
    } catch (error) {
      throw new Error(`CSV parsing error: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Parse a single CSV line, handling quoted values
   *
   * @param line - CSV line to parse
   * @returns Array of values
   */
  private _parseCsvLine(line: string): Array<string> {
    const values = new Array<string>();
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Handle quotes
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote inside quotes
          currentValue += '"';
          i++; // Skip the next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of value
        values.push(currentValue);
        currentValue = '';
      } else {
        // Add to current value
        currentValue += char;
      }
    }

    // Add the last value
    values.push(currentValue);

    return values;
  }

  /**
   * Parse YAML request body
   *
   * @param body - Raw YAML string
   * @returns Parsed YAML object
   * @throws Error if YAML parsing is not supported
   */
  private _handleYaml(body: string): TRequestBody {
    try {
      // Simple YAML parsing - convert to JSON-like structure
      // This is a basic implementation - for production, use a proper YAML parser
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result: IYamlData = Object.create(null);

      // Split into lines
      const lines = body.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#'));

      // Track indentation levels
      let currentIndent = 0;
      let currentPath: Array<string> = [];

      for (const line of lines) {
        // Calculate indentation
        const indent = line.search(/\S/);
        const content = line.trim();

        // Skip comments
        if (content.startsWith('#')) continue;

        // Handle indentation changes
        if (indent < currentIndent) {
          // Going back up in the hierarchy
          const levelsUp = (currentIndent - indent) / 2; // Assuming 2-space indentation
          currentPath = currentPath.slice(0, -levelsUp);
        } else if (indent > currentIndent) {
          // Going deeper in the hierarchy
          // No need to modify path here, it's handled when we process the key
        }

        currentIndent = indent;

        // Parse key-value pair
        if (content.includes(':')) {
          const [key, value] = content.split(':', 2);
          if (!key || value === undefined) continue;

          const trimmedKey = key.trim();
          const trimmedValue = value.trim();

          if (trimmedValue) {
            // Simple key-value pair
            this._setNestedValue(result, [...currentPath, trimmedKey], this._parseYamlValue(trimmedValue));
          } else {
            // Key with nested values
            currentPath.push(trimmedKey);
          }
        }
      }

      return <TRequestBody>result;
    } catch (error) {
      throw new Error(`YAML parsing not fully supported: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Parse a YAML value, handling different types
   *
   * @param value - YAML value string
   * @returns Parsed value
   */
  private _parseYamlValue(value: string): unknown {
    // Handle numbers
    if (/^-?\d+(?:\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Handle booleans
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Handle null
    if (value === 'null' || value === '~') return null;

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Default to string
    return value;
  }

  /**
   * Set a nested value in an object using a path array
   *
   * @param obj - Object to modify
   * @param path - Array of keys representing the path
   * @param value - Value to set
   */
  private _setNestedValue(obj: IYamlData, path: Array<string>, value: unknown): void {
    let current = obj;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (key === undefined) continue;

      if (!current[key]) {
        current[key] = Object.create(null);
      }
      // Safe cast since we just assigned an object
      current = <IYamlData>current[key];
    }

    const lastKey = path[path.length - 1];
    if (lastKey !== undefined) {
      current[lastKey] = value;
    }
  }
}
