import type { Enum } from 'types/Common.ts';
import type { HttpMethod } from 'constants/http.ts';
import type { IHeaders } from 'types/http/Response.ts';
import type { IMultipartFormData, TJsonData } from 'types/index.ts';

/**
 * Represents an HTTP method type
 *
 * This type Ts derived from the HttpMethod enum constants and ensures
 * that only valid HTTP methods can be used throughout the application.
 */
export type THttpMethod = Enum<typeof HttpMethod>;

/**
 * Represents the parsed request body
 *
 * This is a union type that can represent any of the supported content types:
 * - JSON data (generic object)
 * - XML data (with attributes and child elements)
 * - Form data (URL-encoded or multipart)
 * - CSV data (with headers and rows)
 * - Plain text content
 * - YAML data
 * - Or a custom type provided as a generic parameter
 *
 * @template T - Optional custom type for the request body
 */
export type TRequestBody<T = unknown> = IMultipartFormData | TJsonData<T> | string | null;

/**
 * Represents query parameters parsed from the URL
 *
 * @template T - Optional custom type for the query parameters
 */
export type TRequestQuery<T = unknown> = T;

/**
 * Represents URL parameters parsed from the route pattern
 *
 * @template T - Optional custom type for the URL parameters
 */
export type TRequestParams<T = unknown> = T;

/**
 * Represents an HTTP request
 *
 * This interface encapsulates all components of an HTTP request,
 * providing a unified way to access request data throughout the application.
 */
export interface IRequest {
  /** The protocol used for the request (e.g., 'http', 'https') */
  protocol: string;
  /** The HTTP method used for the request */
  method: THttpMethod;
  /** The requested path */
  path: string;
  /** Request headers as key-value pairs */
  headers: IHeaders;
  /** Parsed request body based on Content-Type */
  body: TRequestBody;
  /** Query parameters parsed from the URL */
  query: Record<string, string> | TRequestQuery;
  /** URL parameters parsed from the route pattern */
  params: Record<string, string> | TRequestParams;
}
