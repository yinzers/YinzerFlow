import { describe, expect, it } from 'bun:test';
import { extractBoundaryFromHeader } from '../extractBoundaryFromHeader.ts';

describe('extractBoundaryFromHeader', () => {
  describe('Valid boundary extraction', () => {
    it('should extract simple boundary', () => {
      const contentType = 'multipart/form-data; boundary=boundary123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('boundary123');
    });

    it('should extract boundary with hyphens', () => {
      const contentType = 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('----WebKitFormBoundary7MA4YWxkTrZu0gW');
    });

    it('should extract boundary with alphanumeric characters', () => {
      const contentType = 'multipart/form-data; boundary=1234567890abcdefABCDEF';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('1234567890abcdefABCDEF');
    });

    it('should extract boundary with underscores', () => {
      const contentType = 'multipart/form-data; boundary=boundary_with_underscores_123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('boundary_with_underscores_123');
    });

    it('should extract boundary with dots', () => {
      const contentType = 'multipart/form-data; boundary=boundary.with.dots.123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('boundary.with.dots.123');
    });
  });

  describe('Case insensitive matching', () => {
    it('should handle uppercase BOUNDARY', () => {
      const contentType = 'multipart/form-data; BOUNDARY=test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle mixed case Boundary', () => {
      const contentType = 'multipart/form-data; Boundary=test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle BoundAry', () => {
      const contentType = 'multipart/form-data; BoundAry=test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });
  });

  describe('Whitespace handling', () => {
    it('should handle spaces around equals sign', () => {
      const contentType = 'multipart/form-data; boundary = test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle spaces before boundary parameter', () => {
      const contentType = 'multipart/form-data;  boundary=test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle tabs and spaces', () => {
      const contentType = 'multipart/form-data;\t boundary\t=\ttest123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });
  });

  describe('Multiple parameters', () => {
    it('should extract boundary when it comes first', () => {
      const contentType = 'multipart/form-data; boundary=test123; charset=utf-8';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should extract boundary when it comes last', () => {
      const contentType = 'multipart/form-data; charset=utf-8; boundary=test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should extract boundary from middle of parameters', () => {
      const contentType = 'multipart/form-data; charset=utf-8; boundary=test123; name=file';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle multiple parameters with spaces', () => {
      const contentType = 'multipart/form-data; charset=utf-8; boundary=test123; name="uploaded file"';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });
  });

  describe('Edge cases and invalid inputs', () => {
    it('should return undefined for undefined input', () => {
      const result = extractBoundaryFromHeader(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const result = extractBoundaryFromHeader('');

      expect(result).toBeUndefined();
    });

    it('should return undefined when boundary parameter is missing', () => {
      const contentType = 'multipart/form-data; charset=utf-8';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBeUndefined();
    });

    it('should return undefined for non-multipart content type', () => {
      const contentType = 'application/json; charset=utf-8';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBeUndefined();
    });

    it('should handle boundary with no value', () => {
      const contentType = 'multipart/form-data; boundary=';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('');
    });

    it('should handle malformed boundary parameter', () => {
      const contentType = 'multipart/form-data; boundary';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBeUndefined();
    });
  });

  describe('Boundary termination', () => {
    it('should stop at semicolon', () => {
      const contentType = 'multipart/form-data; boundary=test123; charset=utf-8';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should stop at comma', () => {
      const contentType = 'multipart/form-data; boundary=test123, charset=utf-8';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should stop at whitespace', () => {
      const contentType = 'multipart/form-data; boundary=test123 charset=utf-8';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle boundary at end of string', () => {
      const contentType = 'multipart/form-data; boundary=test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });
  });

  describe('Different content types with boundary', () => {
    it('should extract from multipart/mixed', () => {
      const contentType = 'multipart/mixed; boundary=simple_boundary';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('simple_boundary');
    });

    it('should extract from multipart/alternative', () => {
      const contentType = 'multipart/alternative; boundary=alt_boundary_123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('alt_boundary_123');
    });

    it('should extract from multipart/related', () => {
      const contentType = 'multipart/related; boundary=related_boundary; type="application/json"';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('related_boundary');
    });
  });

  describe('Complex parameter scenarios', () => {
    it('should handle quoted parameter values', () => {
      const contentType = 'multipart/form-data; name="file"; boundary=test123; filename="upload.txt"';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle parameter with equals in quoted value', () => {
      const contentType = 'multipart/form-data; equation="x=5+3"; boundary=test123';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('test123');
    });

    it('should handle very long parameter list', () => {
      const contentType = 'multipart/form-data; charset=utf-8; name=file; filename=test.txt; boundary=long_boundary_name_123; size=12345; modified=2023-01-01';
      const result = extractBoundaryFromHeader(contentType);

      expect(result).toBe('long_boundary_name_123');
    });
  });
});
