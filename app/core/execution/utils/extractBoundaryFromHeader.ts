/**
 * Extract the boundary from the content type header
 *
 * @example
 * ```ts
 * extractBoundaryFromHeader('multipart/form-data; boundary=----WebKitFormBoundary1234567890');
 * // Returns '----WebKitFormBoundary1234567890'
 * ```
 */
export const extractBoundaryFromHeader = (contentTypeHeader?: string): string | undefined => {
  if (!contentTypeHeader) return undefined;

  const boundaryMatch = /boundary\s*=\s*(?<temp1>[^;,\s]*)/i.exec(contentTypeHeader);
  return boundaryMatch?.[1];
};
