import type { Enum } from 'types/Common.ts';
import type { HttpMethod } from 'constants/http.ts';
import type { IHeaders } from 'types/http/Response.ts';
import type { UploadedFile } from 'utils/request.utils.ts';

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
export type TRequestBody<T = unknown> =
  | Record<
      string,
      {
        _attributes?: Record<string, string>;
        [childElement: string]: unknown;
      }
    >
  | Record<string, unknown>
  | T
  | {
      // For CSV data
      headers: Array<string>;
      rows: Array<Record<string, string>>;
    }
  | {
      // For multipart form data with file uploads
      fields: Record<string, string>;
      files: Record<string, UploadedFile>;
    }
  | {
      // For plain text content
      content: string;
    };

/**
 * Represents multipart form data with file uploads
 *
 * This interface is used for handling form submissions that include file uploads.
 * It separates regular form fields from uploaded files for easier processing.
 */
export interface IMultipartFormData {
  /** Regular form fields as key-value pairs */
  fields: Record<string, string>;
  /** Uploaded files indexed by field name */
  files: Record<string, UploadedFile>;
}

/**
 * Represents CSV data parsed from a request
 *
 * This interface provides a structured way to work with CSV data,
 * separating the header row from the data rows.
 */
export interface ICsvData {
  /** Column headers from the first row of the CSV */
  headers: Array<string>;
  /** Data rows as objects where keys are the column headers */
  rows: Array<Record<string, string>>;
}

/**
 * Represents plain text data parsed from a request
 *
 * This interface is used for handling plain text content types,
 * providing the raw text content as a string.
 */
export interface IPlainTextData {
  /** The raw text content */
  content: string;
}

/**
 * Represents XML data parsed from a request
 *
 * This type provides a structured representation of XML content,
 * including support for attributes and nested elements.
 */
export type TXmlData = Record<
  string,
  {
    /** XML element attributes as key-value pairs */
    _attributes?: Record<string, string>;
    /** Child elements and text content */
    [childElement: string]: unknown;
  }
>;

/**
 * Represents JSON data parsed from a request
 *
 * This type provides a generic object representation of JSON data.
 */
export type TJsonData = Record<string, unknown>;

/**
 * Represents URL-encoded form data parsed from a request
 *
 * This type provides a simple key-value representation of form data.
 */
export type TUrlEncodedFormData = Record<string, string>;

/**
 * Represents YAML data parsed from a request
 *
 * This type provides a structured representation of YAML content,
 * using unknown for type safety while allowing for nested structures.
 */
export type TYamlData = Record<string, unknown>;

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
 * Represents URL-encoded JSON data parsed from a request
 *
 * This type provides a simple key-value representation of JSON data.
 */
export type TUrlEncodedJson = Record<string, string>;

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
  query: TRequestQuery | object;
  /** URL parameters parsed from the route pattern */
  params: TRequestParams | object;
}
