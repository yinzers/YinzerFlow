import type { InternalContentDisposition, InternalFileUpload, InternalMultipartFormData } from '@typedefs/internal/InternalRequestImpl.ts';
import type { InternalFileUploadConfiguration } from '@typedefs/internal/InternalConfiguration.js';
import { log } from '@core/utils/log.ts';

/**
 * Split a multipart section into headers and content
 *
 * @example
 * ```ts
 * splitMultipartSection('Content-Disposition: form-data; name="file"; filename="example.txt"\r\nContent-Type: text/plain\r\n\r\nThis is the content of the file.\r\n');
 * // Returns ['Content-Disposition: form-data; name="file"; filename="example.txt"\r\nContent-Type: text/plain\r\n', 'This is the content of the file.\r\n']
 * ```
 */
const splitMultipartSection = (section: string): [string, string] => {
  const trimmedSection = section.startsWith('\r\n') ? section.slice(2) : section;
  const headerEndIndex = trimmedSection.indexOf('\r\n\r\n');

  if (headerEndIndex === -1) {
    return ['', ''];
  }

  const headers = trimmedSection.slice(0, headerEndIndex);
  const content = trimmedSection.slice(headerEndIndex + 4);
  return [headers, content];
};

/**
 * Simple Content-Disposition parser for multipart sections
 *
 * @example
 * ```ts
 * parseContentDisposition('Content-Disposition: form-data; name="file"; filename="example.txt"\r\nContent-Type: text/plain\r\n\r\nThis is the content of the file.\r\n');
 * // Returns { name: 'file', filename: 'example.txt' }
 * ```
 */
const parseContentDisposition = (headerLine: string): InternalContentDisposition => {
  const result: InternalContentDisposition = { name: '' };

  const nameMatch = /name=(?:"(?<temp2>[^"]*)"|(?<temp1>[^;,\s]+))/i.exec(headerLine);
  const filenameMatch = /filename=(?:"(?<temp2>[^"]*)"|(?<temp1>[^;,\s]+))/i.exec(headerLine);

  if (nameMatch) {
    result.name = nameMatch[1] ?? nameMatch[2] ?? '';
  }

  if (filenameMatch) {
    const filename = filenameMatch[1] ?? filenameMatch[2];
    if (filename) {
      result.filename = filename;
    }
  }

  return result;
};

/**
 * Extract Content-Type from multipart section headers
 *
 * @example
 * ```ts
 * extractSectionContentType('Content-Type: text/plain\r\n\r\nThis is the content of the file.\r\n');
 * // Returns 'text/plain'
 * ```
 */
const extractSectionContentType = (headers: string): string => {
  const lines = headers.split(/\r?\n/);
  const contentTypeLine = lines.find((line) => line.toLowerCase().startsWith('content-type:'));

  if (!contentTypeLine) return 'application/octet-stream';

  return (
    contentTypeLine
      .slice(contentTypeLine.indexOf(':') + 1)
      .trim()
      .split(';')[0]
      ?.trim() ?? 'application/octet-stream'
  );
};

/**
 * Determine if content should be treated as binary
 *
 * @example
 * ```ts
 * isBinaryContent('image/png');
 * // Returns true
 * ```
 */
const isBinaryContent = (contentTypeValue: string): boolean => {
  const binaryTypes = ['image/', 'audio/', 'video/', 'application/octet-stream', 'application/pdf', 'application/zip', 'application/x-'];

  return binaryTypes.some((type) => contentTypeValue.toLowerCase().startsWith(type));
};

/**
 * Calculate content length for string or Buffer
 *
 * @example
 * ```ts
 * calculateContentLength('Hello, world!');
 * // Returns 13
 * ```
 */
const calculateContentLength = (content: Buffer | string): number => (Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf8'));

/**
 * Validate file against security configuration
 */
const _validateFileUpload = (file: InternalFileUpload, config?: InternalFileUploadConfiguration): void => {
  if (!config) return;

  // SECURITY: Check file size
  if (file.size > config.maxFileSize) {
    log.warn('[SECURITY] File upload too large', {
      filename: file.filename,
      size: file.size,
      limit: config.maxFileSize,
      sizeMB: Math.round(file.size / 1024 / 1024),
    });
    throw new Error(`File too large: ${file.filename} is ${file.size} bytes, exceeds limit of ${config.maxFileSize} bytes`);
  }

  // SECURITY: Check filename length
  if (file.filename && file.filename.length > config.maxFilenameLength) {
    throw new Error(`Filename too long: ${file.filename.length} characters exceeds limit of ${config.maxFilenameLength}`);
  }

  // SECURITY: Check file extension
  if (file.filename) {
    const extension = file.filename.toLowerCase().substring(file.filename.lastIndexOf('.'));

    // Check blocked extensions
    if (config.blockedExtensions.includes(extension)) {
      log.warn('[SECURITY] Blocked file type upload attempt', {
        filename: file.filename,
        extension,
        blockedExtensions: config.blockedExtensions,
      });
      throw new Error(`File type not allowed: ${extension} files are blocked for security reasons`);
    }

    // Check allowed extensions (if specified)
    if (config.allowedExtensions.length > 0 && !config.allowedExtensions.includes(extension)) {
      throw new Error(`File type not allowed: ${extension} is not in the allowed extensions list`);
    }
  }
};

/**
 * Handle file upload processing with binary support and security validation
 *
 * @example
 * ```ts
 * handleFileUpload({
 *   contentDisposition: { name: 'file', filename: 'example.txt' },
 *   contentSection: 'This is the content of the file.\r\n',
 * });
 * ```
 */
const handleFileUpload = ({
  contentDisposition,
  contentSection,
  headersSection,
  config,
}: {
  contentDisposition: InternalContentDisposition;
  contentSection: string;
  headersSection: string;
  config?: InternalFileUploadConfiguration | undefined;
}): InternalFileUpload => {
  const contentTypeValue = extractSectionContentType(headersSection);

  // Remove trailing \r\n that's part of the multipart boundary
  const trimmedContent = contentSection.endsWith('\r\n') ? contentSection.slice(0, -2) : contentSection;

  // For binary files, convert string to Buffer
  const content: Buffer | string = isBinaryContent(contentTypeValue) ? Buffer.from(trimmedContent, 'binary') : trimmedContent;

  const file: InternalFileUpload = {
    filename: contentDisposition.filename ?? '',
    contentType: contentTypeValue,
    size: calculateContentLength(content),
    content,
  };

  // SECURITY: Validate file against configuration
  _validateFileUpload(file, config);

  return file;
};

/**
 * Parse multipart form data request body with binary file support and security protections
 *
 * Security Features:
 * - File size validation per file and total
 * - File extension filtering (allow/block lists)
 * - Filename length validation
 * - File count limits
 *
 * @example
 * ```ts
 * const config = { maxFileSize: 10485760, maxFiles: 10, blockedExtensions: ['.exe'] };
 * parseMultipartFormData('...multipart body...', 'boundary123', config);
 * // Returns { fields: { ... }, files: [...] }
 * ```
 */
export const parseMultipartFormData = (body: string, boundary: string, config?: InternalFileUploadConfiguration): InternalMultipartFormData => {
  const result: InternalMultipartFormData = {
    fields: {},
    files: [],
  };

  // Split the body into parts using the boundary
  const parts = body.split(`--${boundary}`).slice(1); // Skip the first empty part

  let totalFileSize = 0;

  for (const part of parts) {
    // Skip empty parts and the final boundary marker
    if (!part || part.trim() === '' || part.trim() === '--') continue;

    // Parse the part headers and content
    const [headersSection, contentSection] = splitMultipartSection(part);
    if (!headersSection) continue; // Skip malformed parts

    // Find Content-Disposition header
    const lines = headersSection.split(/\r?\n/);
    const dispositionLine = lines.find((line) => line.toLowerCase().startsWith('content-disposition:'));
    if (!dispositionLine) continue;

    const contentDisposition = parseContentDisposition(dispositionLine);
    if (!contentDisposition.name) continue;

    // Handle file upload
    if (contentDisposition.filename !== undefined) {
      // SECURITY: Check file count limit
      if (config && result.files.length >= config.maxFiles) {
        log.warn('[SECURITY] Too many files in upload request', {
          fileCount: result.files.length,
          maxFiles: config.maxFiles,
        });
        throw new Error(`Too many files: maximum of ${config.maxFiles} files allowed per request`);
      }

      const file = handleFileUpload({
        contentDisposition,
        contentSection,
        headersSection,
        config,
      });

      totalFileSize += file.size;

      // SECURITY: Check total file size
      if (config && totalFileSize > config.maxTotalSize) {
        log.warn('[SECURITY] Total upload size too large', {
          totalSize: totalFileSize,
          limit: config.maxTotalSize,
          totalSizeMB: Math.round(totalFileSize / 1024 / 1024),
        });
        throw new Error(`Total file size too large: ${totalFileSize} bytes exceeds limit of ${config.maxTotalSize} bytes`);
      }

      result.files.push(file);
    }

    // Handle regular form field
    if (contentDisposition.filename === undefined) {
      // Remove trailing \r\n that's part of the multipart boundary
      const trimmedContent = contentSection.endsWith('\r\n') ? contentSection.slice(0, -2) : contentSection;
      result.fields[contentDisposition.name] = trimmedContent;
    }
  }

  return result;
};
