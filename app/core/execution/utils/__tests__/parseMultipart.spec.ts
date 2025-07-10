import { describe, expect, it } from 'bun:test';
import { parseMultipartFormData } from '../parseMultipart.ts';

describe('parseMultipartFormData', () => {
  describe('Basic form field parsing', () => {
    it('should parse simple form fields', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="username"',
        '',
        'johndoe',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"',
        '',
        'john@example.com',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect(result).toHaveProperty('fields');
      expect(result).toHaveProperty('files');
      expect((result as any).fields).toEqual({
        username: 'johndoe',
        email: 'john@example.com',
      });
      expect((result as any).files).toEqual([]);
    });

    it('should handle empty form fields', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="empty"',
        '',
        '',
        `--${boundary}`,
        'Content-Disposition: form-data; name="notempty"',
        '',
        'value',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields).toEqual({
        empty: '',
        notempty: 'value',
      });
    });

    it('should handle fields with special characters', () => {
      const boundary = 'boundary123';
      const body = [`--${boundary}`, 'Content-Disposition: form-data; name="message"', '', 'Hello\nWorld\r\nWith special chars: !@#$%', `--${boundary}--`].join(
        '\r\n',
      );

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields.message).toBe('Hello\nWorld\r\nWith special chars: !@#$%');
    });
  });

  describe('File upload parsing', () => {
    it('should parse simple file upload', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="upload"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'File content here',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files).toHaveLength(1);
      expect((result as any).files[0]).toEqual({
        filename: 'test.txt',
        contentType: 'text/plain',
        content: 'File content here',
        size: 17, // Length of "File content here"
      });
    });

    it('should handle binary file uploads', () => {
      const boundary = 'boundary123';
      const binaryContent = 'binary\x00\x01\x02\x03data';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="image"; filename="test.jpg"',
        'Content-Type: image/jpeg',
        '',
        binaryContent,
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files).toHaveLength(1);
      expect((result as any).files[0].filename).toBe('test.jpg');
      expect((result as any).files[0].contentType).toBe('image/jpeg');
      expect(Buffer.isBuffer((result as any).files[0].content)).toBe(true);
      expect((result as any).files[0].content).toEqual(Buffer.from(binaryContent, 'binary'));
    });

    it('should handle files without explicit content type', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="unknownfile"; filename="mystery.dat"',
        '',
        'unknown content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files[0].contentType).toBe('application/octet-stream');
      // Files without explicit content type default to binary
      expect(Buffer.isBuffer((result as any).files[0].content)).toBe(true);
      expect((result as any).files[0].content).toEqual(Buffer.from('unknown content', 'binary'));
    });

    it('should handle empty files', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="emptyfile"; filename="empty.txt"',
        'Content-Type: text/plain',
        '',
        '',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files[0]).toEqual({
        filename: 'empty.txt',
        contentType: 'text/plain',
        content: '',
        size: 0,
      });
    });
  });

  describe('Mixed form data', () => {
    it('should handle both fields and files', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="title"',
        '',
        'My Upload',
        `--${boundary}`,
        'Content-Disposition: form-data; name="description"',
        '',
        'This is a test file',
        `--${boundary}`,
        'Content-Disposition: form-data; name="document"; filename="doc.pdf"',
        'Content-Type: application/pdf',
        '',
        'PDF content here',
        `--${boundary}`,
        'Content-Disposition: form-data; name="category"',
        '',
        'documents',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields).toEqual({
        title: 'My Upload',
        description: 'This is a test file',
        category: 'documents',
      });

      expect((result as any).files).toHaveLength(1);
      expect((result as any).files[0].filename).toBe('doc.pdf');
      expect((result as any).files[0].contentType).toBe('application/pdf');
      expect(Buffer.isBuffer((result as any).files[0].content)).toBe(true);
    });

    it('should handle multiple file uploads', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file1"; filename="text.txt"',
        'Content-Type: text/plain',
        '',
        'Text file content',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file2"; filename="image.png"',
        'Content-Type: image/png',
        '',
        'PNG image data',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files).toHaveLength(2);
      expect((result as any).files[0].filename).toBe('text.txt');
      expect((result as any).files[1].filename).toBe('image.png');
      expect((result as any).files[1].contentType).toBe('image/png');
      expect(Buffer.isBuffer((result as any).files[1].content)).toBe(true);
    });
  });

  describe('Content-Disposition parsing', () => {
    it('should handle quoted field names', () => {
      const boundary = 'boundary123';
      const body = [`--${boundary}`, 'Content-Disposition: form-data; name="field-name"', '', 'value', `--${boundary}--`].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields['field-name']).toBe('value');
    });

    it('should handle unquoted field names', () => {
      const boundary = 'boundary123';
      const body = [`--${boundary}`, 'Content-Disposition: form-data; name=fieldname', '', 'value', `--${boundary}--`].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields.fieldname).toBe('value');
    });

    it('should handle quoted filenames with spaces', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="upload"; filename="my file.txt"',
        'Content-Type: text/plain',
        '',
        'content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files[0].filename).toBe('my file.txt');
    });

    it('should handle special characters in filenames', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="upload"; filename="file-with-dashes_and_underscores.txt"',
        'Content-Type: text/plain',
        '',
        'content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files[0].filename).toBe('file-with-dashes_and_underscores.txt');
    });
  });

  describe('Binary content detection', () => {
    it('should treat images as binary', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="image"; filename="test.jpg"',
        'Content-Type: image/jpeg',
        '',
        'jpeg-data-here',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect(Buffer.isBuffer((result as any).files[0].content)).toBe(true);
    });

    it('should treat PDFs as binary', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="doc"; filename="doc.pdf"',
        'Content-Type: application/pdf',
        '',
        'pdf-content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect(Buffer.isBuffer((result as any).files[0].content)).toBe(true);
    });

    it('should treat text files as strings', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="textfile"; filename="text.txt"',
        'Content-Type: text/plain',
        '',
        'text content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect(typeof (result as any).files[0].content).toBe('string');
      expect((result as any).files[0].content).toBe('text content');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should skip parts without Content-Disposition', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Type: text/plain',
        '',
        'orphaned content',
        `--${boundary}`,
        'Content-Disposition: form-data; name="valid"',
        '',
        'valid content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields).toEqual({ valid: 'valid content' });
    });

    it('should skip parts without field names', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data',
        '',
        'no name',
        `--${boundary}`,
        'Content-Disposition: form-data; name="valid"',
        '',
        'valid content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields).toEqual({ valid: 'valid content' });
    });

    it('should handle malformed parts gracefully', () => {
      const boundary = 'boundary123';
      const body = [
        `--${boundary}`,
        'malformed part without proper headers',
        `--${boundary}`,
        'Content-Disposition: form-data; name="valid"',
        '',
        'valid content',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields).toEqual({ valid: 'valid content' });
    });

    it('should handle empty multipart body', () => {
      const boundary = 'boundary123';
      const body = `--${boundary}--`;

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields).toEqual({});
      expect((result as any).files).toEqual([]);
    });

    it('should calculate correct content sizes', () => {
      const boundary = 'boundary123';
      const content = 'Test content with 🎉 emoji';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="textfile"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        content,
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).files[0].size).toBe(Buffer.byteLength(content, 'utf8'));
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should handle typical file upload form', () => {
      const boundary = 'WebKitFormBoundary7MA4YWxkTrZu0gW';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="title"',
        '',
        'Document Upload',
        `--${boundary}`,
        'Content-Disposition: form-data; name="category"',
        '',
        'important',
        `--${boundary}`,
        'Content-Disposition: form-data; name="document"; filename="report.pdf"',
        'Content-Type: application/pdf',
        '',
        '%PDF-1.4 fake pdf content',
        `--${boundary}`,
        'Content-Disposition: form-data; name="thumbnail"; filename="thumb.jpg"',
        'Content-Type: image/jpeg',
        '',
        'JPEG fake image data',
        `--${boundary}`,
        'Content-Disposition: form-data; name="public"',
        '',
        'true',
        `--${boundary}--`,
      ].join('\r\n');

      const result = parseMultipartFormData(body, boundary);

      expect((result as any).fields).toEqual({
        title: 'Document Upload',
        category: 'important',
        public: 'true',
      });

      expect((result as any).files).toHaveLength(2);
      expect((result as any).files[0].filename).toBe('report.pdf');
      expect((result as any).files[1].filename).toBe('thumb.jpg');
      expect(Buffer.isBuffer((result as any).files[0].content)).toBe(true);
      expect(Buffer.isBuffer((result as any).files[1].content)).toBe(true);
    });
  });
});
