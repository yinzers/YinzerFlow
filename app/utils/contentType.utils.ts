import type { CsvData, JsonData, MultipartFormData, PlainTextData, TRequestBody, UrlEncodedFormData, XmlData } from 'types/http/Request.ts';

/**
 * Type guard to check if the request body is multipart form data
 *
 * @param body - Request body to check
 * @returns True if the body is multipart form data
 */
export const isMultipartFormData = (body: TRequestBody): body is MultipartFormData =>
  typeof body === 'object' && body !== null && 'fields' in body && 'files' in body;

/**
 * Type guard to check if the request body is CSV data
 *
 * @param body - Request body to check
 * @returns True if the body is CSV data
 */
export const isCsvData = (body: TRequestBody): body is CsvData => typeof body === 'object' && body !== null && 'headers' in body && 'rows' in body;

/**
 * Type guard to check if the request body is plain text data
 *
 * @param body - Request body to check
 * @returns True if the body is plain text data
 */
export const isPlainTextData = (body: TRequestBody): body is PlainTextData =>
  typeof body === 'object' && body !== null && 'content' in body && Object.keys(body).length === 1;

/**
 * Type guard to check if the request body is XML data
 *
 * @param body - Request body to check
 * @returns True if the body is XML data
 */
export const isXmlData = (body: TRequestBody): body is XmlData => {
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
 * Type guard to check if the request body is JSON data
 *
 * Note: This is a simple check that the body is an object.
 * It will return true for most object types, so use with caution.
 *
 * @param body - Request body to check
 * @returns True if the body is JSON data
 */
export const isJsonData = (body: TRequestBody): body is JsonData =>
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
export const isUrlEncodedFormData = (body: TRequestBody): body is UrlEncodedFormData =>
  typeof body === 'object' &&
  body !== null &&
  !isMultipartFormData(body) &&
  !isCsvData(body) &&
  !isPlainTextData(body) &&
  !isXmlData(body) &&
  Object.values(body).every((value) => typeof value === 'string');
