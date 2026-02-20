import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DiagnosticsMonitor } from '@core/modules/diagnostics/DiagnosticsMonitor.ts';
import type { InternalDiagnosticsOptions } from '@typedefs/internal/InternalConfiguration.js';

const ALL_DISABLED: InternalDiagnosticsOptions = {
  slowRequests: false,
  largeResponses: false,
  largeRequests: false,
  memory: false,
  eventLoop: false,
  rateLimits: false,
};

/** Helper — all tests default personality to true */
const createMonitor = (config: InternalDiagnosticsOptions, personality = true) => new DiagnosticsMonitor(config, personality);

// Mock console to capture output
const originalConsole = { ...console };
const mockConsole = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

describe('DiagnosticsMonitor', () => {
  beforeEach(() => {
    mockConsole.info.mockClear();
    mockConsole.warn.mockClear();
    mockConsole.error.mockClear();
    mockConsole.debug.mockClear();
    global.console = { ...originalConsole, ...mockConsole } as unknown as Console;
  });

  afterEach(() => {
    global.console = originalConsole as Console;
  });

  describe('hasAnyEnabled', () => {
    it('should return false when all diagnostics are disabled', () => {
      const monitor = createMonitor(ALL_DISABLED);
      expect(monitor.hasAnyEnabled()).toBe(false);
    });

    it('should return true when slowRequests is enabled', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, slowRequests: 500 });
      expect(monitor.hasAnyEnabled()).toBe(true);
    });

    it('should return true when rateLimits is enabled', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, rateLimits: true });
      expect(monitor.hasAnyEnabled()).toBe(true);
    });
  });

  describe('Slow Request Detection', () => {
    it('should log when request exceeds threshold', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, slowRequests: 100 });
      monitor.checkRequest({ duration: 150, reqBytes: 100, resBytes: 200, method: 'GET', path: '/api/test' });
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const call = mockConsole.warn.mock.calls[0] as Array<string>;
      expect(call.some((arg: string) => typeof arg === 'string' && arg.includes('Slow request'))).toBe(true);
    });

    it('should not log when request is within threshold', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, slowRequests: 100 });
      monitor.checkRequest({ duration: 50, reqBytes: 100, resBytes: 200, method: 'GET', path: '/api/test' });
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('should fire even when app log level would be off', () => {
      // DiagnosticsMonitor creates its own logger at 'info' — independent of app level
      const monitor = createMonitor({ ...ALL_DISABLED, slowRequests: 100 });
      monitor.checkRequest({ duration: 200, reqBytes: 0, resBytes: 0, method: 'POST', path: '/slow' });
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
    });

    it('should accept TimeString threshold', () => {
      // '1s' = 1000ms
      const monitor = createMonitor({ ...ALL_DISABLED, slowRequests: '1s' });
      monitor.checkRequest({ duration: 1500, reqBytes: 0, resBytes: 0, method: 'GET', path: '/slow' });
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Large Response Detection', () => {
    it('should log when response exceeds threshold', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, largeResponses: 1024 });
      monitor.checkRequest({ duration: 10, reqBytes: 0, resBytes: 2048, method: 'GET', path: '/big' });
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const call = mockConsole.warn.mock.calls[0] as Array<string>;
      expect(call.some((arg: string) => typeof arg === 'string' && arg.includes('Large response'))).toBe(true);
    });

    it('should not log when response is within threshold', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, largeResponses: 1024 });
      monitor.checkRequest({ duration: 10, reqBytes: 0, resBytes: 512, method: 'GET', path: '/small' });
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('should accept ByteString threshold', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, largeResponses: '1kb' });
      monitor.checkRequest({ duration: 10, reqBytes: 0, resBytes: 2048, method: 'GET', path: '/big' });
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Large Request Detection', () => {
    it('should log when request body exceeds threshold', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, largeRequests: 1024 });
      monitor.checkRequest({ duration: 10, reqBytes: 4096, resBytes: 0, method: 'POST', path: '/upload' });
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const call = mockConsole.warn.mock.calls[0] as Array<string>;
      expect(call.some((arg: string) => typeof arg === 'string' && arg.includes('Large request'))).toBe(true);
    });

    it('should not log when request body is within threshold', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, largeRequests: 1024 });
      monitor.checkRequest({ duration: 10, reqBytes: 512, resBytes: 0, method: 'POST', path: '/upload' });
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limit Hit Logging', () => {
    it('should log when rate limit is hit and enabled', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, rateLimits: true });
      monitor.onRateLimitHit('192.168.1.1', '/api/users');
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const call = mockConsole.warn.mock.calls[0] as Array<string>;
      expect(call.some((arg: string) => typeof arg === 'string' && arg.includes('Rate limit hit'))).toBe(true);
    });

    it('should not log when rate limit logging is disabled', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, rateLimits: false });
      monitor.onRateLimitHit('192.168.1.1', '/api/users');
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });
  });

  describe('Memory Monitor', () => {
    it('should start and stop memory monitor cleanly', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, memory: 100 });
      monitor.start();
      expect(monitor._memoryTimer).toBeDefined();
      monitor.destroy();
      expect(monitor._memoryTimer).toBeUndefined();
    });

    it('should not start memory monitor when disabled', () => {
      const monitor = createMonitor(ALL_DISABLED);
      monitor.start();
      expect(monitor._memoryTimer).toBeUndefined();
      monitor.destroy();
    });
  });

  describe('Event Loop Monitor', () => {
    it('should start and stop event loop monitor cleanly', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, eventLoop: 100 });
      monitor.start();
      expect(monitor._eventLoopTimer).toBeDefined();
      monitor.destroy();
      expect(monitor._eventLoopTimer).toBeUndefined();
    });

    it('should not start event loop monitor when disabled', () => {
      const monitor = createMonitor(ALL_DISABLED);
      monitor.start();
      expect(monitor._eventLoopTimer).toBeUndefined();
      monitor.destroy();
    });
  });

  describe('destroy', () => {
    it('should clear all intervals and timers', () => {
      const monitor = createMonitor({
        ...ALL_DISABLED,
        memory: 100,
        eventLoop: 50,
      });
      monitor.start();
      expect(monitor._memoryTimer).toBeDefined();
      expect(monitor._eventLoopTimer).toBeDefined();
      monitor.destroy();
      expect(monitor._memoryTimer).toBeUndefined();
      expect(monitor._eventLoopTimer).toBeUndefined();
    });

    it('should be safe to call multiple times', () => {
      const monitor = createMonitor({ ...ALL_DISABLED, memory: 100 });
      monitor.start();
      monitor.destroy();
      monitor.destroy();
      expect(monitor._memoryTimer).toBeUndefined();
    });
  });

  describe('Multiple Diagnostics', () => {
    it('should fire multiple diagnostics for the same request', () => {
      const monitor = createMonitor({
        ...ALL_DISABLED,
        slowRequests: 100,
        largeResponses: 1024,
      });
      // Both slow AND large response
      monitor.checkRequest({ duration: 200, reqBytes: 0, resBytes: 2048, method: 'GET', path: '/both' });
      expect(mockConsole.warn).toHaveBeenCalledTimes(2);
    });
  });
});
