import type { TRequestBody } from 'types/http/Request.ts';
import type { TJsonData } from 'types/index.ts';
import { isMultipartFormData } from 'core/Request/guards/multipartFormData.ts';

/**
 * Type guard to check if the request body is JSON data
 *
 * Note: This is a simple check that eliminates other known types.
 * It will return true for most object types, so use with caution.
 *
 * @param body - Request body to check
 * @returns True if the body is JSON data
 */
export const isJsonData = <T = unknown>(body: TRequestBody): body is TJsonData<T> => !isMultipartFormData(body) && typeof body === 'object';
