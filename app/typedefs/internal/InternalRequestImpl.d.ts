import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.ts';
import type { Request } from '@typedefs/public/Request.js';

/**
 * Represents multipart form data with file uploads.
 *
 * This interface is used for handling form submissions that include file uploads.
 * It separates regular form fields from uploaded files for easier processing.
 *
 * ## Structure
 *
 * - **fields**: Regular form data as key-value pairs
 * - **files**: Array of uploaded files with metadata and content
 *
 * @example
 * ```typescript
 * // This interface is used internally by YinzerFlow
 * // Users typically don't interact with it directly
 *
 * // However, if you're extending the framework:
 * class CustomRequestHandler {
 *   async handleMultipartFormData(data: InternalMultipartFormData) {
 *     // Process regular form fields
 *     const { username, email } = data.fields;
 *
 *     // Process uploaded files
 *     for (const file of data.files) {
 *       if (file.contentType.startsWith('image/')) {
 *         await this.processImage(file);
 *       } else if (file.contentType === 'application/pdf') {
 *         await this.processPDF(file);
 *       }
 *     }
 *
 *     return { success: true, fields: data.fields, fileCount: data.files.length };
 *   }
 *
 *   private async processImage(file: InternalFileUpload) {
 *     // Process image file
 *     console.log(`Processing image: ${file.filename} (${file.size} bytes)`);
 *   }
 * }
 * ```
 *
 * @see {@link InternalFileUpload} for file upload structure
 * @see {@link Request} for the public request interface
 */
export interface InternalMultipartFormData {
  /**
   * Regular form fields as key-value pairs.
   *
   * Contains all non-file form data submitted with the request.
   *
   * @example
   * ```typescript
   * // Example form fields
   * fields: {
   *   username: 'john_doe',
   *   email: 'john@example.com',
   *   bio: 'Software developer',
   *   newsletter: 'true'
   * }
   * ```
   */
  fields: Record<string, string>;

  /**
   * Uploaded files indexed by field name.
   *
   * Array of file objects containing metadata and content for each uploaded file.
   *
   * @example
   * ```typescript
   * // Example files array
   * files: [
   *   {
   *     filename: 'profile.jpg',
   *     contentType: 'image/jpeg',
   *     size: 1024000,
   *     content: Buffer.from('...'),
   *     metadata: { fieldName: 'avatar' }
   *   }
   * ]
   * ```
   */
  files: Array<InternalFileUpload>;
}

/**
 * Represents an individual file upload with metadata and content.
 *
 * This interface provides all the information needed to process uploaded files,
 * including the original filename, MIME type, size, and actual file content.
 *
 * ## File Types
 *
 * - **Binary files**: content is a Buffer (images, PDFs, executables)
 * - **Text files**: content is a string (CSV, JSON, plain text)
 *
 * @example
 * ```typescript
 * // This interface is used internally by YinzerFlow
 * // Users typically don't interact with it directly
 *
 * // However, if you're extending the framework:
 * class FileProcessor {
 *   async processFile(file: InternalFileUpload) {
 *     // Validate file size
 *     if (file.size > 10 * 1024 * 1024) { // 10MB limit
 *       throw new Error('File too large');
 *     }
 *
 *     // Check file type
 *     if (!this.isAllowedFileType(file.contentType)) {
 *       throw new Error('File type not allowed');
 *     }
 *
 *     // Process based on content type
 *     if (file.contentType.startsWith('image/')) {
 *       return await this.processImage(file);
 *     } else if (file.contentType === 'application/json') {
 *       return await this.processJSON(file);
 *     }
 *
 *     // Default processing
 *     return await this.processGenericFile(file);
 *   }
 *
 *   private isAllowedFileType(contentType: string): boolean {
 *     const allowedTypes = [
 *       'image/jpeg', 'image/png', 'image/gif',
 *       'application/pdf', 'text/plain', 'application/json'
 *     ];
 *     return allowedTypes.includes(contentType);
 *   }
 * }
 * ```
 *
 * @see {@link InternalMultipartFormData} for multipart form handling
 */
export interface InternalFileUpload {
  /**
   * Original filename provided by the client.
   *
   * The filename as it was named on the user's system when uploaded.
   *
   * @example
   * ```typescript
   * filename: 'vacation-photo-2024.jpg'
   * filename: 'document.pdf'
   * filename: 'data-export.csv'
   * ```
   */
  filename: string;

  /**
   * MIME type of the file.
   *
   * Indicates the file format and how it should be processed.
   *
   * @example
   * ```typescript
   * contentType: 'image/jpeg'        // JPEG image
   * contentType: 'application/pdf'   // PDF document
   * contentType: 'text/csv'          // CSV data file
   * contentType: 'application/json'  // JSON data
   * ```
   */
  contentType: string;

  /**
   * Size of the file in bytes.
   *
   * Useful for validation, storage planning, and security checks.
   *
   * @example
   * ```typescript
   * size: 1024000    // 1MB
   * size: 524288     // 512KB
   * size: 1048576    // 1MB
   *
   * // Size validation
   * if (file.size > maxFileSize) {
   *   throw new Error(`File size ${file.size} exceeds limit ${maxFileSize}`);
   * }
   * ```
   */
  size: number;

  /**
   * File content - Buffer for binary files, string for text files.
   *
   * The actual file data that can be processed, stored, or analyzed.
   *
   * @example
   * ```typescript
   * // Binary file (image, PDF, etc.)
   * if (file.content instanceof Buffer) {
   *   // Save to disk
   *   await fs.writeFile(`uploads/${file.filename}`, file.content);
   *
   *   // Process with image library
   *   const image = await sharp(file.content).resize(800, 600).toBuffer();
   * }
   *
   * // Text file (CSV, JSON, etc.)
   * if (typeof file.content === 'string') {
   *   // Parse CSV
   *   const rows = file.content.split('\n').map(row => row.split(','));
   *
   *   // Parse JSON
   *   const data = JSON.parse(file.content);
   * }
   * ```
   */
  content: Buffer | string;

  /**
   * Additional metadata about the file.
   *
   * Optional field for storing custom information about the file upload.
   *
   * @example
   * ```typescript
   * metadata: {
   *   fieldName: 'avatar',           // Form field name
   *   uploadTime: '2024-01-15T10:30:00Z',
   *   userId: 'user-123',
   *   category: 'profile-picture'
   * }
   *
   * // Using metadata
   * if (file.metadata?.category === 'profile-picture') {
   *   await this.processProfilePicture(file);
   * }
   * ```
   */
  metadata?: Record<string, string>;
}

/**
 * Content disposition information for multipart form data.
 *
 * Contains metadata about how form fields and files should be interpreted,
 * including field names and optional filenames.
 *
 * @example
 * ```typescript
 * // This interface is used internally by YinzerFlow
 * // Users typically don't interact with it directly
 *
 * // However, if you're extending the framework:
 * class MultipartParser {
 *   parseContentDisposition(header: string): InternalContentDisposition {
 *     // Parse Content-Disposition header
 *     // Example: "form-data; name=\"username\"; filename=\"profile.jpg\""
 *
 *     const nameMatch = header.match(/name="([^"]+)"/);
 *     const filenameMatch = header.match(/filename="([^"]+)"/);
 *
 *     return {
 *       name: nameMatch?.[1] || '',
 *       filename: filenameMatch?.[1]
 *     };
 *   }
 * }
 * ```
 *
 * @see {@link InternalMultipartFormData} for multipart form handling
 * @see {@link InternalFileUpload} for file upload structure
 */
export interface InternalContentDisposition {
  /**
   * The name of the form field.
   *
   * Identifies which form field this data belongs to.
   *
   * @example
   * ```typescript
   * name: 'username'      // Username field
   * name: 'avatar'        // File upload field
   * name: 'bio'           // Text area field
   * ```
   */
  name: string;

  /**
   * Optional filename for file uploads.
   *
   * Present when the field contains a file upload, undefined for regular form fields.
   *
   * @example
   * ```typescript
   * filename: 'profile.jpg'     // File upload field
   * filename: undefined         // Regular form field
   * filename: 'document.pdf'    // File upload field
   * ```
   */
  filename?: string;
}

/**
 * Internal request implementation that extends the public Request interface.
 *
 * This interface provides access to internal request data and setup information
 * that's needed for request processing but not exposed to users.
 *
 * ## Internal Properties
 *
 * - **_rawRequest**: Access to the original raw request data
 * - **_setup**: Reference to the setup implementation for route resolution
 *
 * @example
 * ```typescript
 * // This interface is used internally by YinzerFlow
 * // Users typically don't interact with it directly
 *
 * // However, if you're extending the framework:
 * class CustomRequestHandler {
 *   async processRequest(request: InternalRequestImpl) {
 *     // Access public request properties
 *     const { method, path, headers, body } = request;
 *
 *     // Access internal properties for advanced processing
 *     const rawData = request._rawRequest;
 *     const setup = request._setup;
 *
 *     // Custom processing logic
 *     if (rawData instanceof Buffer) {
 *       // Process binary data
 *       const processedData = await this.processBinaryData(rawData);
 *       return processedData;
 *     }
 *
 *     // Standard processing
 *     return await this.processStandardRequest(request);
 *   }
 * }
 * ```
 *
 * @see {@link Request} for the public request interface
 * @see {@link InternalSetupImpl} for setup implementation details
 */
export interface InternalRequestImpl extends Request {
  /**
   * The original raw request data as received from the client.
   *
   * Provides access to the unprocessed request data for custom parsing
   * or when the standard parsing doesn't meet your needs.
   *
   * @example
   * ```typescript
   * // Access raw request data
   * const rawData = request._rawRequest;
   *
   * if (rawData instanceof Buffer) {
   *   // Process as binary data
   *   const hexString = rawData.toString('hex');
   *   console.log('Raw hex data:', hexString);
   * } else if (typeof rawData === 'string') {
   *   // Process as text data
   *   const lines = rawData.split('\n');
   *   console.log('Raw text lines:', lines.length);
   * }
   * ```
   */
  readonly _rawRequest: Request['rawBody'];

  /**
   * Reference to the setup implementation for route resolution.
   *
   * Provides access to the internal setup for advanced request processing,
   * route matching, and framework extension.
   *
   * @example
   * ```typescript
   * // Access setup for custom route resolution
   * const setup = request._setup;
   *
   * // Custom route matching logic
   * const customRoute = await this.findCustomRoute(setup, request.path);
   * if (customRoute) {
   *   return await customRoute.handler(request);
   * }
   *
   * // Access internal route registry
   * const routes = setup._routeRegistry;
   * console.log('Registered routes:', routes.size);
   * ```
   */
  readonly _setup: InternalSetupImpl;
}
