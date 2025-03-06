import type {
  ICsvData,
  IMultipartFormData,
  IPlainTextData,
  TJsonData,
  TRequestBody,
  TUrlEncodedFormData,
  TUrlEncodedJson,
  TXmlData,
  TYamlData,
} from 'types/http/Request.ts';

/**
 * Type guard to check if the request body is multipart form data
 *
 * @param body - Request body to check
 * @returns True if the body is multipart form data
 */
export const isMultipartFormData = (body: TRequestBody): body is IMultipartFormData =>
  typeof body === 'object' && body !== null && 'fields' in body && 'files' in body;

/**
 * Type guard to check if the request body is CSV data
 *
 * @param body - Request body to check
 * @returns True if the body is CSV data
 */
export const isCsvData = (body: TRequestBody): body is ICsvData => typeof body === 'object' && body !== null && 'headers' in body && 'rows' in body;

/**
 * Type guard to check if the request body is plain text data
 *
 * @param body - Request body to check
 * @returns True if the body is plain text data
 */
export const isPlainTextData = (body: TRequestBody): body is IPlainTextData =>
  typeof body === 'object' && body !== null && 'content' in body && Object.keys(body).length === 1;

/**
 * Type guard to check if the request body is XML data
 *
 * @param body - Request body to check
 * @returns True if the body is XML data
 */
export const isXmlData = (body: TRequestBody): body is TXmlData => {
  if (typeof body !== 'object' || body === null) return false;

  const keys = Object.keys(body);
  if (keys.length !== 1) return false;

  const [rootKey] = keys;
  if (!rootKey) return false;

  const rootElement = (<Record<string, unknown>>body)[rootKey];

  return (
    typeof rootElement === 'object' &&
    rootElement !== null &&
    (Object.prototype.hasOwnProperty.call(rootElement, '_attributes') || (typeof rootElement === 'object' && Object.keys(rootElement).length > 0))
  );
};

/**
 * Type guard to check if the request body is YAML data
 *
 * @param body - Request body to check
 * @returns True if the body is YAML data
 */
export const isYamlData = (body: TRequestBody): body is TYamlData => {
  if (typeof body !== 'object' || body === null) return false;

  // Check that it's not any of the other specific types
  if (isMultipartFormData(body) || isCsvData(body) || isPlainTextData(body)) {
    return false;
  }

  // For YAML data, we'll check if it has a nested structure
  // but doesn't have XML-specific properties
  const hasNestedStructure = Object.values(body).some((value) => typeof value === 'object' && value !== null);

  // Check if it's not XML data (which would have _attributes)
  const hasXmlAttributes = Object.values(body).some((value) => typeof value === 'object' && value !== null && '_attributes' in value);

  // It's YAML if:
  // 1. It has a nested structure but no XML attributes, OR
  // 2. It's a simple object with primitive values (strings, numbers, booleans)
  if (hasNestedStructure && !hasXmlAttributes) {
    return true;
  }

  // Check if it's a simple YAML object (key-value pairs with primitive values)
  const allPrimitiveValues = Object.values(body).every(
    (value) => value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
  );

  return allPrimitiveValues && Object.keys(body).length > 0;
};

/**
 * Type guard to check if the request body is JSON data
 *
 * Note: This is a simple check that the body is an object.
 * It will return true for most object types, so use with caution.
 *
 * @param body - Request body to check
 * @returns True if the body is JSON data
 */
export const isJsonData = (body: TRequestBody): body is TJsonData =>
  typeof body === 'object' && body !== null && !isMultipartFormData(body) && !isCsvData(body) && !isPlainTextData(body) && !isXmlData(body);

/**
 * Type guard to check if the request body is URL-encoded form data
 *
 * Note: This is a simple check that all values are strings.
 * Use with caution as it may return true for other object types with string values.
 *
 * @param body - Request body to check
 * @returns True if the body is URL-encoded form data
 */
export const isUrlEncodedFormData = (body: TRequestBody): body is TUrlEncodedFormData =>
  typeof body === 'object' &&
  body !== null &&
  !isMultipartFormData(body) &&
  !isCsvData(body) &&
  !isPlainTextData(body) &&
  !isXmlData(body) &&
  !isYamlData(body) &&
  Object.values(body).every((value) => typeof value === 'string');

/**
 * Type guard to check if the request body is URL-encoded JSON data
 *
 * @param body - Request body to check
 * @returns True if the body is URL-encoded JSON data
 */
export const isUrlEncodedJson = (body: TRequestBody): body is TUrlEncodedJson => {
  if (typeof body !== 'object' || body === null) return false;

  // Check that it's not any of the other specific types
  if (isMultipartFormData(body) || isCsvData(body) || isPlainTextData(body) || isXmlData(body) || isYamlData(body)) {
    return false;
  }

  // For URL-encoded JSON, we need to check if any value is a complex object
  // or if any string value looks like JSON (starts with { or [)
  return Object.values(body).some((value) => {
    if (typeof value === 'object' && value !== null) {
      return true;
    }

    if (typeof value === 'string') {
      return value.startsWith('{') || value.startsWith('[');
    }

    return false;
  });
};
