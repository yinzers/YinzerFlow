import type { TYamlData } from 'types/index.ts';

export interface IContentDisposition {
  name: string;
  filename?: string;
}

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
  files: Array<IUploadedFile>;
}

/**
 * Represents a file uploaded via multipart form data
 */
export interface IUploadedFile {
  /** Original filename provided by the client */
  filename: string;
  /** MIME type of the file */
  contentType: string;
  /** Size of the file in bytes */
  size: number;
  /** file content */
  content: TYamlData | string;
  /** Additional metadata about the file */
  metadata?: Record<string, string>;
}
