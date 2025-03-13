import type { TRequestBody } from 'types/http/Request.ts';
import type { TJsonData } from 'types/index.ts';

/**
 * Parse JSON request body
 *
 * @param body - Raw JSON string
 * @returns Parsed JSON object
 * @throws Error if JSON is invalid
 */
export const parseApplicationJson = (body: string): TRequestBody => {
  try {
    return <TJsonData>JSON.parse(body);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
};
