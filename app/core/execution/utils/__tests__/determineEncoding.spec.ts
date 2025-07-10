import { describe, expect, it } from 'bun:test';
import { determineEncoding, inferEncodingFromBody } from '../determineEncoding.ts';

describe('determineEncoding', () => {
  describe('Content-Type header detection', () => {
    it('should return base64 for image content types', () => {
      expect(determineEncoding('image/jpeg')).toBe('base64');
      expect(determineEncoding('image/png')).toBe('base64');
      expect(determineEncoding('image/gif')).toBe('base64');
      expect(determineEncoding('image/webp')).toBe('base64');
      expect(determineEncoding('image/bmp')).toBe('base64');
    });

    it('should return base64 for video content types', () => {
      expect(determineEncoding('video/mp4')).toBe('base64');
      expect(determineEncoding('video/avi')).toBe('base64');
      expect(determineEncoding('video/webm')).toBe('base64');
    });

    it('should return base64 for audio content types', () => {
      expect(determineEncoding('audio/mp3')).toBe('base64');
      expect(determineEncoding('audio/wav')).toBe('base64');
      expect(determineEncoding('audio/flac')).toBe('base64');
      expect(determineEncoding('audio/ogg')).toBe('base64');
    });

    it('should return base64 for document content types', () => {
      expect(determineEncoding('application/pdf')).toBe('base64');
      expect(determineEncoding('application/octet-stream')).toBe('base64');
      expect(determineEncoding('application/zip')).toBe('base64');
      expect(determineEncoding('application/x-rar-compressed')).toBe('base64');
      expect(determineEncoding('application/x-7z-compressed')).toBe('base64');
    });

    it('should return utf8 for text content types', () => {
      expect(determineEncoding('text/plain')).toBe('utf8');
      expect(determineEncoding('text/html')).toBe('utf8');
      expect(determineEncoding('text/css')).toBe('utf8');
      expect(determineEncoding('application/json')).toBe('utf8');
      expect(determineEncoding('application/xml')).toBe('utf8');
      expect(determineEncoding('application/javascript')).toBe('utf8');
    });

    it('should be case insensitive', () => {
      expect(determineEncoding('IMAGE/JPEG')).toBe('base64');
      expect(determineEncoding('Text/HTML')).toBe('utf8');
      expect(determineEncoding('APPLICATION/JSON')).toBe('utf8');
    });

    it('should return binary for unknown content types', () => {
      expect(determineEncoding('application/unknown')).toBe('binary');
      expect(determineEncoding('mysterious/format')).toBe('binary');
    });
  });

  describe('Body content inference when no Content-Type', () => {
    it('should detect JPEG signature', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(determineEncoding(undefined, jpegBuffer)).toBe('base64');
    });

    it('should detect PNG signature', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(determineEncoding(undefined, pngBuffer)).toBe('base64');
    });

    it('should detect GIF87a signature', () => {
      const gif87Buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      expect(determineEncoding(undefined, gif87Buffer)).toBe('base64');
    });

    it('should detect GIF89a signature', () => {
      const gif89Buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(determineEncoding(undefined, gif89Buffer)).toBe('base64');
    });

    it('should detect PDF signature', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(determineEncoding(undefined, pdfBuffer)).toBe('base64');
    });

    it('should detect ZIP signature', () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(determineEncoding(undefined, zipBuffer)).toBe('base64');
    });

    it('should detect RAR signature', () => {
      const rarBuffer = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
      expect(determineEncoding(undefined, rarBuffer)).toBe('base64');
    });

    it('should detect WebP with RIFF validation', () => {
      const webpBuffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x24,
        0x00,
        0x00,
        0x00, // File size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
        0x56,
        0x50,
        0x38,
        0x20, // VP8 chunk
      ]);
      expect(determineEncoding(undefined, webpBuffer)).toBe('base64');
    });

    it('should detect WAV with RIFF validation', () => {
      const wavBuffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x24,
        0x00,
        0x00,
        0x00, // File size
        0x57,
        0x41,
        0x56,
        0x45, // WAVE
        0x66,
        0x6d,
        0x74,
        0x20, // fmt chunk
      ]);
      expect(determineEncoding(undefined, wavBuffer)).toBe('base64');
    });

    it('should detect text content as utf8', () => {
      const textBuffer = Buffer.from('Hello, world!');
      expect(determineEncoding(undefined, textBuffer)).toBe('utf8');
    });

    it('should detect JSON objects as utf8', () => {
      const jsonObject = { message: 'Hello, world!' };
      expect(determineEncoding(undefined, jsonObject)).toBe('utf8');
    });

    it('should detect strings as utf8', () => {
      expect(determineEncoding(undefined, 'Hello, world!')).toBe('utf8');
    });

    it('should handle null/undefined body', () => {
      expect(determineEncoding(undefined, null)).toBe('utf8');
      expect(determineEncoding(undefined, undefined)).toBe('utf8');
    });
  });

  describe('Binary heuristics', () => {
    it('should detect high null byte percentage as binary', () => {
      // Buffer with 50% null bytes
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x00, 0x02, 0x00, 0x03]);
      expect(determineEncoding(undefined, binaryBuffer)).toBe('base64');
    });

    it('should detect high non-printable percentage as binary', () => {
      // Buffer with many non-printable characters
      const binaryBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      expect(determineEncoding(undefined, binaryBuffer)).toBe('base64');
    });

    it('should allow printable control characters in text', () => {
      // Tab, newline, carriage return should be considered text
      const textBuffer = Buffer.from('Hello\tworld\nHow are you?\r\n');
      expect(determineEncoding(undefined, textBuffer)).toBe('utf8');
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      expect(determineEncoding(undefined, emptyBuffer)).toBe('utf8');
    });
  });

  describe('Content-Type with body fallback', () => {
    it('should prioritize Content-Type over body analysis', () => {
      // Even if body looks like text, Content-Type should win
      const textBuffer = Buffer.from('Hello, world!');
      expect(determineEncoding('image/jpeg', textBuffer)).toBe('base64');
    });

    it('should use body analysis when Content-Type is undefined', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(determineEncoding(undefined, jpegBuffer)).toBe('base64');
    });
  });
});

describe('inferEncodingFromBody', () => {
  it('should return utf8 for string bodies', () => {
    expect(inferEncodingFromBody('Hello, world!')).toBe('utf8');
  });

  it('should return utf8 for object bodies', () => {
    expect(inferEncodingFromBody({ message: 'Hello' })).toBe('utf8');
    expect(inferEncodingFromBody([1, 2, 3])).toBe('utf8');
  });

  it('should return base64 for binary buffers', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(inferEncodingFromBody(jpegBuffer)).toBe('base64');
  });

  it('should return utf8 for text buffers', () => {
    const textBuffer = Buffer.from('Hello, world!');
    expect(inferEncodingFromBody(textBuffer)).toBe('utf8');
  });

  it('should handle null/undefined', () => {
    expect(inferEncodingFromBody(null)).toBe('utf8');
    expect(inferEncodingFromBody(undefined)).toBe('utf8');
  });

  it('should return utf8 for primitives', () => {
    expect(inferEncodingFromBody(42)).toBe('utf8');
    expect(inferEncodingFromBody(true)).toBe('utf8');
    expect(inferEncodingFromBody(BigInt(123))).toBe('utf8');
  });
});
