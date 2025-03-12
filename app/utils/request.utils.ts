/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable max-statements */
import type { TRequestBody, TYamlData } from 'types/http/Request.ts';

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
 * Parse JSON request body
 *
 * @param body - Raw JSON string
 * @returns Parsed JSON object
 * @throws Error if JSON is invalid
 */
export const handleApplicationJson = (body: string): TRequestBody => {
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/**
 * Parse x-www-form-urlencoded request body
 *
 * @param body - Raw form data string
 * @returns Parsed form data object
 */
export const handleXwwwFormUrlencoded = (body: string): TRequestBody => parseKeyValuePairs(body, '&', '=');

/**
 * Parse key-value pairs from a string
 *
 * @param data - String containing key-value pairs
 * @param pairSeparator - Character that separates pairs
 * @param keyValueSeparator - Character that separates keys from values
 * @returns Object with parsed key-value pairs
 */
export const parseKeyValuePairs = (data: string, pairSeparator: string, keyValueSeparator: string): TRequestBody => {
  const result: Record<string, string> = {};
  if (!data) return result;

  const pairs = data.split(pairSeparator);
  for (const pair of pairs) {
    if (!pair) continue;

    const [key, value] = pair.split(keyValueSeparator, 2);
    if (key) {
      const decodedKey = decodeURIComponent(key.trim());
      const decodedValue = value ? decodeURIComponent(value.trim()) : '';

      // Replace '+' with spaces for form-urlencoded data
      result[decodedKey] = decodedValue.replace(/\+/g, ' ');
    }
  }

  return result;
};

/**
 * Parse multipart form data request body
 *
 * @param body - Raw multipart form data string
 * @returns Parsed form data object with fields and files
 * @throws Error if multipart format is invalid
 */
export const handleMultipartFormData = (body: string): TRequestBody => {
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
    const [headersSection, contentSection] = splitMultipartSection(part);
    if (!headersSection || !contentSection) continue;

    // Parse the Content-Disposition header
    const contentDisposition = parseContentDisposition(headersSection);
    if (!contentDisposition.name) continue;

    // Check if this is a file upload
    if (contentDisposition.filename) {
      const contentType = extractContentType(headersSection) ?? 'application/octet-stream';

      // Create a file object
      const file: UploadedFile = {
        filename: contentDisposition.filename,
        contentType,
        size: contentSection.length,
        content: contentSection,
      };

      result.files[contentDisposition.name] = file;
    } else {
      // This is a regular form field
      result.fields[contentDisposition.name] = contentSection;
    }
  }

  return result;
};

/**
 * Split a multipart section into headers and content
 *
 * @param section - Raw multipart section string
 * @returns Tuple containing headers and content
 */
export const splitMultipartSection = (section: string): [string, string] => {
  // Remove leading newline if present
  const trimmedSection = section.startsWith('\r\n') ? section.slice(2) : section;

  // Find the double newline that separates headers from content
  const headerEndIndex = trimmedSection.indexOf('\r\n\r\n');
  if (headerEndIndex === -1) return ['', ''];

  const headers = trimmedSection.slice(0, headerEndIndex);
  const content = trimmedSection.slice(headerEndIndex + 4).trim(); // +4 for \r\n\r\n and trim to remove trailing newlines

  return [headers, content];
};

/**
 * Parse Content-Disposition header
 *
 * @param header - Raw header string
 * @returns Object with name and optional filename
 */
export const parseContentDisposition = (header: string): { name: string; filename?: string } => {
  // Initialize with empty string for name and no filename property
  const result = { name: '' };

  // Find the Content-Disposition line
  const lines = header.split('\r\n');
  const dispositionLine = lines.find((line) => line.toLowerCase().startsWith('content-disposition:'));
  if (!dispositionLine) return result;

  // Extract name and filename
  const nameMatch = /name="(?<name>[^"]*)"/.exec(dispositionLine);
  const filenameMatch = /filename="(?<filename>[^"]*)"/.exec(dispositionLine);

  if (nameMatch?.groups?.name) {
    result.name = nameMatch.groups.name;
  }

  if (filenameMatch?.groups?.filename) {
    // Only add filename property if it exists
    Object.assign(result, { filename: filenameMatch.groups.filename });
  }

  return result;
};

/**
 * Extract Content-Type from headers
 *
 * @param headers - Raw headers string
 * @returns Content-Type or undefined if not found
 */
export const extractContentType = (headers: string): string | undefined => {
  const lines = headers.split('\r\n');
  const contentTypeLine = lines.find((line) => line.toLowerCase().startsWith('content-type:'));
  if (!contentTypeLine) return undefined;

  const contentType = contentTypeLine.slice(contentTypeLine.indexOf(':') + 1).trim();
  return contentType;
};

/**
 * Parse XML request body
 *
 * @param body - Raw XML string
 * @returns Parsed XML object
 * @throws Error if XML is invalid
 */
export const handleXml = (body: string): TRequestBody => {
  try {
    // Remove XML declaration if present
    const xmlContent = body.replace(/<\?xml.*\?>/, '').trim();

    // Get root element name
    const rootMatch = /<(?<rootName>[^\s>]+)/.exec(xmlContent);
    if (!rootMatch?.groups?.rootName) {
      throw new Error('Invalid XML: missing root element');
    }

    const { rootName } = rootMatch.groups;

    // Extract content between root tags
    const rootRegex = new RegExp(`<${rootName}[^>]*>(.*)</${rootName}>`, 's');
    const contentMatch = rootRegex.exec(xmlContent);

    if (!contentMatch?.[1]) {
      throw new Error('Invalid XML: malformed root element');
    }

    // Parse child elements
    return parseXmlElements(contentMatch[1].trim());
  } catch (e: unknown) {
    throw new Error(`Invalid XML: ${(<Error>e).message}`);
  }
};

/**
 * Parse XML elements from content
 *
 * @param content - XML content to parse
 * @returns Parsed XML object
 */
export const parseXmlElements = (content: string): Record<string, any> => {
  const result: Record<string, any> = {};

  // Parse child elements
  const elementRegex = /<(?<tagName>[^\s>]+)(?:\s+[^>]*)?>(?<temp1>(?:.*?))<\/\1>/gs;
  let match: RegExpExecArray | null = null;

  while ((match = elementRegex.exec(content)) !== null) {
    if (match.groups?.tagName) {
      const { tagName } = match.groups;
      const [, , tagContent] = match;

      if (tagContent !== undefined) {
        // Check if content has child elements
        if (/<[^\s>]+[^>]*>.*<\/[^\s>]+>/s.test(tagContent)) {
          // Recursive parsing for nested elements
          result[tagName] = handleXml(`<${tagName}>${tagContent}</${tagName}>`);
        } else {
          // Simple text content
          result[tagName] = tagContent;
        }
      }
    }
  }

  return result;
};

/**
 * Parse plain text request body
 *
 * @param body - Raw text string
 * @returns Object with content property containing the text
 */
export const handlePlainText = (body: string): TRequestBody => ({
  content: body,
});

/**
 * Parse URL-encoded JSON request body
 *
 * @param body - Raw URL-encoded JSON string
 * @returns Parsed JSON object
 * @throws Error if JSON is invalid after decoding
 */
export const handleUrlEncodedJson = (body: string): TRequestBody => {
  try {
    // First, parse as URL-encoded form data
    const formData = handleXwwwFormUrlencoded(body);

    // Then, try to parse each value as JSON
    const result: Record<string, unknown> = {};

    // Cast formData to Record<string, string> to satisfy TypeScript
    const formDataEntries = Object.entries(<Record<string, string>>formData);

    for (const [key, value] of formDataEntries) {
      try {
        // Only try to parse if the value looks like JSON
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          // Parse JSON and explicitly type as unknown
          const parsedValue: unknown = JSON.parse(value);
          result[key] = parsedValue;
        } else {
          result[key] = value;
        }
      } catch {
        // If parsing fails, keep the original string value
        result[key] = value;
      }
    }

    return result;
  } catch (e) {
    throw new Error(`Invalid URL-encoded JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/**
 * Parse CSV request body
 *
 * @param body - Raw CSV string
 * @returns Object with headers and rows arrays
 * @throws Error if CSV is invalid
 */
export const handleCsv = (body: string): TRequestBody => {
  try {
    const result: {
      headers: Array<string>;
      rows: Array<Array<string>>;
    } = {
      headers: [],
      rows: [],
    };

    // Split into lines and filter out empty lines
    const lines = body.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      return result;
    }

    // Parse headers from the first line
    if (lines[0]) {
      result.headers = parseCsvLine(lines[0]);
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line) {
        const row = parseCsvLine(line);
        result.rows.push(row);
      }
    }

    return result;
  } catch (e: unknown) {
    throw new Error(`Invalid CSV: ${(<Error>e).message}`);
  }
};

/**
 * Parse a single CSV line, handling quoted values and escaping
 *
 * @param line - Raw CSV line
 * @returns Array of values
 */
export const parseCsvLine = (line: string): Array<string> => {
  const result: Array<string> = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quotes
        currentValue += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      result.push(currentValue);
      currentValue = '';
    } else {
      // Regular character
      currentValue += char;
    }
  }

  // Add the last value
  result.push(currentValue);

  return result;
};

/**
 * Parse YAML request body
 *
 * @param body - Raw YAML string
 * @returns Parsed YAML object
 * @throws Error if YAML is invalid
 */
export const handleYaml = (body: string): TRequestBody => {
  try {
    // Simple YAML parsing implementation
    // This is a basic implementation and doesn't handle all YAML features
    const result: TYamlData = {};

    // Split into lines
    const lines = body.split(/\r?\n/);

    // Track indentation levels and their corresponding objects
    const stack: Array<{ indent: number; obj: TYamlData }> = [{ indent: -1, obj: result }];

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line || line.trim() === '' || line.trim().startsWith('#')) continue;

      // Calculate indentation level
      const indent = line.search(/\S/);
      const content = line.trim();

      // Check for key-value pair
      if (content.includes(':')) {
        const [key, value] = content.split(':', 2);
        if (!key) continue;

        const trimmedKey = key.trim();
        const trimmedValue = value?.trim() ?? '';

        // Pop stack until we find the parent object for this indentation
        // Make sure stack has at least one element before accessing
        while (stack.length > 1) {
          const lastItem = stack[stack.length - 1];
          if (lastItem && lastItem.indent >= indent) {
            stack.pop();
          } else {
            break;
          }
        }

        // Get parent object safely
        const lastStackItem = stack[stack.length - 1];
        if (!lastStackItem) continue;

        const parent = lastStackItem.obj;

        if (trimmedValue === '') {
          // This is an object key with nested values
          parent[trimmedKey] = {};
          // Type assertion is safe here because we're creating an empty object
          const newObj = <TYamlData>parent[trimmedKey];
          stack.push({ indent, obj: newObj });
        } else {
          // This is a key with a value
          parent[trimmedKey] = parseYamlValue(trimmedValue);
        }
      } else if (content.startsWith('-')) {
        // List item
        // Not implemented in this basic version
        continue;
      }
    }

    return result;
  } catch (e) {
    throw new Error(`Invalid YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/**
 * Parse a YAML value, handling different types
 *
 * @param value - Raw YAML value string
 * @returns Parsed value (string, number, boolean, null)
 */
export const parseYamlValue = (value: string): unknown => {
  // Check for quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Check for null/undefined
  if (value === 'null' || value === '~' || value === '') {
    return null;
  }

  // Check for booleans
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Check for numbers
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  // Default to string
  return value;
};
