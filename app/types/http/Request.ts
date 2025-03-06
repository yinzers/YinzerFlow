import type { Enum } from '../Common.ts';
import type { HttpMethod } from '../../constants/http.ts';
import type { UploadedFile } from '../../core/RequestParser.ts';
import type { IHeaders } from './Response.ts';

export type THttpMethod = Enum<typeof HttpMethod>;

/**
 * Represents the parsed request body
 *
 * Can be one of:
 * - A generic object (for JSON, form data, etc.)
 * - A specific type provided as a generic parameter
 * - A structured object with fields and files (for multipart form data)
 * - A plain text content object
 * - A CSV data object with headers and rows
 * - An XML object with attributes and child elements
 * - A YAML object
 */
export type TRequestBody<T = unknown> =
  | Record<
      string,
      {
        _attributes?: Record<string, string>;
        [childElement: string]: any;
      }
    >
  | Record<string, any>
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

// Type definitions for different content types
export interface MultipartFormData {
  fields: Record<string, string>;
  files: Record<string, UploadedFile>;
}

export interface CsvData {
  headers: Array<string>;
  rows: Array<Record<string, string>>;
}

export interface PlainTextData {
  content: string;
}

export type XmlData = Record<
  string,
  {
    _attributes?: Record<string, string>;
    [childElement: string]: any;
  }
>;

export type JsonData = Record<string, any>;

export type UrlEncodedFormData = Record<string, string>;

export type TRequestQuery<T = unknown> = T;
export type TRequestParams<T = unknown> = T;

export interface IRequest {
  protocol: string;
  method: THttpMethod;
  path: string;
  headers: IHeaders;
  body: TRequestBody;
  query: TRequestQuery | object;
  params: TRequestParams | object;
}
