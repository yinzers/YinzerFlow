import type { InternalHttpHeaders, InternalHttpStatusCode } from '@typedefs/constants/http.js';

/**
 * Public facing response object
 *
 * This is the response object that is sent to the client.
 */
export interface Response {
  setStatusCode: (statusCode: InternalHttpStatusCode) => void;
  addHeaders: (headers: Partial<Record<InternalHttpHeaders, string>>) => void;
  removeHeaders: (headerNames: Array<InternalHttpHeaders>) => void;
}
