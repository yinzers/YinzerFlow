import type { TRequestBody } from 'types/http/Request.ts';
import type { IMultipartFormData } from 'types/index.ts';

/**
 * Type guard to check if the request body is multipart form data
 *
 * @param body - Request body to check
 * @returns True if the body is multipart form data
 */
export const isMultipartFormData = (body: TRequestBody): body is IMultipartFormData =>
  body !== null && typeof body === 'object' && 'fields' in body && 'files' in body && Array.isArray(body.files) && typeof (<any>body.fields) === 'object';
