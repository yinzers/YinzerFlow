import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.ts';
import type { Request } from '@typedefs/public/Request.js';

/**
 * Represents multipart form data with file uploads
 *
 * This interface is used for handling form submissions that include file uploads.
 * It separates regular form fields from uploaded files for easier processing.
 */
export interface InternalMultipartFormData {
  /** Regular form fields as key-value pairs */
  fields: Record<string, string>;
  /** Uploaded files indexed by field name */
  files: Array<InternalFileUpload>;
}

export interface InternalFileUpload {
  /** Original filename provided by the client */
  filename: string;
  /** MIME type of the file */
  contentType: string;
  /** Size of the file in bytes */
  size: number;
  /** File content - Buffer for binary files, string for text files */
  content: Buffer | string;
  /** Additional metadata about the file */
  metadata?: Record<string, string>;
}

export interface InternalContentDisposition {
  name: string;
  filename?: string;
}

export interface InternalRequestImpl extends Request {
  readonly _rawRequest: Request['rawBody'];
  readonly _setup: InternalSetupImpl;
}
