import { describe, expect, it } from 'bun:test';
import { _convertBytesToBytes } from '@core/utils/bytes.ts';

describe('_convertBytesToBytes', () => {
  describe('ByteString Conversion', () => {
    it('should convert bytes', () => {
      expect(_convertBytesToBytes('512b')).toBe(512);
      expect(_convertBytesToBytes('1b')).toBe(1);
    });

    it('should convert kilobytes', () => {
      expect(_convertBytesToBytes('1kb')).toBe(1024);
      expect(_convertBytesToBytes('256kb')).toBe(262144);
    });

    it('should convert megabytes', () => {
      expect(_convertBytesToBytes('1mb')).toBe(1048576);
      expect(_convertBytesToBytes('10mb')).toBe(10485760);
    });

    it('should convert gigabytes', () => {
      expect(_convertBytesToBytes('1gb')).toBe(1073741824);
      expect(_convertBytesToBytes('2gb')).toBe(2147483648);
    });

    it('should handle decimal values', () => {
      expect(_convertBytesToBytes('1.5kb')).toBe(1536);
      expect(_convertBytesToBytes('0.5mb')).toBe(524288);
    });
  });

  describe('Raw Number Passthrough', () => {
    it('should pass through positive raw numbers unchanged', () => {
      expect(_convertBytesToBytes(1024)).toBe(1024);
      expect(_convertBytesToBytes(4096)).toBe(4096);
      expect(_convertBytesToBytes(1)).toBe(1);
    });

    it('should reject zero and negative numbers', () => {
      expect(() => _convertBytesToBytes(0)).toThrow('Must be a positive number');
      expect(() => _convertBytesToBytes(-1)).toThrow('Must be a positive number');
      expect(() => _convertBytesToBytes(-100)).toThrow('Must be a positive number');
    });

    it('should reject non-finite numbers', () => {
      expect(() => _convertBytesToBytes(Infinity)).toThrow('Must be a positive number');
      expect(() => _convertBytesToBytes(NaN)).toThrow('Must be a positive number');
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid format', () => {
      expect(() => _convertBytesToBytes('abc' as any)).toThrow('Invalid byte format');
      expect(() => _convertBytesToBytes('10tb' as any)).toThrow('Invalid byte format');
      expect(() => _convertBytesToBytes('' as any)).toThrow('Invalid byte format');
    });

    it('should throw on non-string non-number input', () => {
      expect(() => _convertBytesToBytes(true as any)).toThrow('Invalid byte format');
    });
  });
});
