import { createLogger } from '@core/utils/log.ts';
import { _convertTimeToMs } from '@core/utils/time.ts';
import { _convertBytesToBytes } from '@core/utils/bytes.ts';
import { _sanitizeLogField } from '@core/utils/sanitize.ts';
import type { InternalDiagnosticsOptions } from '@typedefs/internal/InternalConfiguration.js';

/**
 * Pittsburgh-themed performance phrases for diagnostic output.
 * Moved from the old networkLog.ts `logPerformanceDetails` function.
 */
const DIAGNOSTIC_PHRASES = {
  slowRequest: [
    "that's draggin' n'at",
    'slower than a bus on Forbes Ave',
    'yinz might wanna optimize that',
    'what a jagoff response time!',
    "slowin' down a bit there",
  ],
  largePayload: ["that's a yuge payload n'at", "bigger than a Primanti's sandwich", "that's a lot of data, yinz", 'hefty response there'],
  memory: ["heap's gettin' full n'at", 'memory usage update', "keepin' an eye on the heap"],
  eventLoop: ["event loop's laggin' n'at", "the loop's stuck in traffic on 376", 'yinz got a blocking operation'],
  rateLimit: ["somebody's hammerin' the server n'at", 'slow down there, jagoff', 'rate limit hit'],
} as const;

const _getRandomDiagPhrase = (type: keyof typeof DIAGNOSTIC_PHRASES): string => {
  const phrases = DIAGNOSTIC_PHRASES[type];
  return phrases[Math.floor(Math.random() * phrases.length)] ?? '';
};

/**
 * Resolved diagnostics config — all thresholds converted to numbers.
 * `false` means the diagnostic is disabled.
 */
interface ResolvedConfig {
  slowRequestsMs: number | false;
  largeResponsesBytes: number | false;
  largeRequestsBytes: number | false;
  memoryIntervalMs: number | false;
  eventLoopThresholdMs: number | false;
  rateLimits: boolean;
}

/**
 * Framework health monitoring — independent of app log level.
 *
 * Diagnostics fire only when thresholds are exceeded. All thresholds default
 * to `false` (disabled). Even with `logging.level: 'off'`, diagnostics still
 * fire because they use their own logger instance always at 'info' level.
 *
 * Three categories:
 * - **Per-request**: Slow requests, large request/response bodies
 * - **Interval**: Memory usage, event loop lag
 * - **Event**: Rate limit hits
 */
export class DiagnosticsMonitor {
  _config: ResolvedConfig;
  _personality: boolean;
  _memoryTimer?: ReturnType<typeof setInterval> | undefined;
  _eventLoopTimer?: ReturnType<typeof setTimeout> | undefined;
  _log: ReturnType<typeof createLogger>;
  private _destroyed = false;

  constructor(config: InternalDiagnosticsOptions, personality: boolean) {
    this._config = _resolveConfig(config);
    this._personality = personality;
    // Own logger — always at 'info', bypasses the app log level
    this._log = createLogger({ level: 'info', prefix: 'DIAGNOSTIC', personality: false });
  }

  /** Append a Pittsburgh phrase only when personality is enabled. */
  _phrase(type: keyof typeof DIAGNOSTIC_PHRASES): string {
    return this._personality ? ` — ${_getRandomDiagPhrase(type)}` : '';
  }

  /**
   * Check a completed request against diagnostic thresholds.
   * Called after the response has been written to the socket.
   *
   * @param method - Pre-sanitized HTTP method (caller handles sanitization to avoid double-sanitize)
   * @param path - Pre-sanitized request path
   */
  checkRequest({ duration, reqBytes, resBytes, method, path }: { duration: number; reqBytes: number; resBytes: number; method: string; path: string }): void {
    if (this._config.slowRequestsMs !== false && duration > this._config.slowRequestsMs) {
      this._log.warn(`🐌 Slow request: ${method} ${path} took ${duration}ms (threshold: ${this._config.slowRequestsMs}ms)${this._phrase('slowRequest')}`);
    }

    if (this._config.largeResponsesBytes !== false && resBytes > this._config.largeResponsesBytes) {
      this._log.warn(
        `📦 Large response: ${method} ${path} ${resBytes} bytes (threshold: ${this._config.largeResponsesBytes} bytes)${this._phrase('largePayload')}`,
      );
    }

    if (this._config.largeRequestsBytes !== false && reqBytes > this._config.largeRequestsBytes) {
      this._log.warn(
        `📦 Large request: ${method} ${path} ${reqBytes} bytes (threshold: ${this._config.largeRequestsBytes} bytes)${this._phrase('largePayload')}`,
      );
    }
  }

  /**
   * Called when the rate limiter fires for an IP.
   */
  onRateLimitHit(ip: string, path: string): void {
    if (!this._config.rateLimits) return;
    this._log.warn(`🚫 Rate limit hit: ${ip} on ${_sanitizeLogField(path)}${this._phrase('rateLimit')}`);
  }

  /**
   * Start interval-based monitors (memory, event loop).
   * Call once after server is constructed.
   */
  start(): void {
    this._startMemoryMonitor();
    this._startEventLoopMonitor();
  }

  /**
   * Clean up all intervals and timers. Call on server close.
   */
  destroy(): void {
    this._destroyed = true;
    if (this._memoryTimer) {
      clearInterval(this._memoryTimer);
      this._memoryTimer = undefined;
    }
    if (this._eventLoopTimer) {
      clearTimeout(this._eventLoopTimer);
      this._eventLoopTimer = undefined;
    }
  }

  /**
   * Check if any diagnostics are enabled.
   */
  hasAnyEnabled(): boolean {
    return (
      this._config.slowRequestsMs !== false ||
      this._config.largeResponsesBytes !== false ||
      this._config.largeRequestsBytes !== false ||
      this._config.memoryIntervalMs !== false ||
      this._config.eventLoopThresholdMs !== false ||
      this._config.rateLimits
    );
  }

  /**
   * Periodic memory usage logging.
   */
  private _startMemoryMonitor(): void {
    if (this._config.memoryIntervalMs === false) return;

    const intervalMs = this._config.memoryIntervalMs;
    this._memoryTimer = setInterval(() => {
      const mem = process.memoryUsage();
      const toMB = (bytes: number): string => (bytes / 1024 / 1024).toFixed(1);
      this._log.info(
        `💾 Heap: ${toMB(mem.heapUsed)}MB / ${toMB(mem.heapTotal)}MB | RSS: ${toMB(mem.rss)}MB | External: ${toMB(mem.external)}MB${this._phrase('memory')}`,
      );
    }, intervalMs);

    // Don't prevent process exit
    this._memoryTimer.unref();
  }

  /**
   * Event loop lag detection via setTimeout drift.
   * If the callback fires significantly later than scheduled, the event loop is lagging.
   */
  private _startEventLoopMonitor(): void {
    if (this._config.eventLoopThresholdMs === false) return;

    const threshold = this._config.eventLoopThresholdMs;
    // Check every 1 second
    const checkIntervalMs = 1000;

    const check = (): void => {
      if (this._destroyed) return;
      const start = Date.now();
      this._eventLoopTimer = setTimeout(() => {
        if (this._destroyed) return;
        const lag = Date.now() - start - checkIntervalMs;
        if (lag > threshold) {
          this._log.warn(`⏱️ Event loop lag: ${lag}ms (threshold: ${threshold}ms)${this._phrase('eventLoop')}`);
        }
        check();
      }, checkIntervalMs);
      this._eventLoopTimer.unref();
    };

    check();
  }
}

/**
 * Resolve TimeString/ByteString config values to raw numbers.
 * `false` values pass through as disabled.
 */
const _resolveConfig = (config: InternalDiagnosticsOptions): ResolvedConfig => ({
  slowRequestsMs: config.slowRequests === false ? false : _convertTimeToMs(config.slowRequests),
  largeResponsesBytes: config.largeResponses === false ? false : _convertBytesToBytes(config.largeResponses),
  largeRequestsBytes: config.largeRequests === false ? false : _convertBytesToBytes(config.largeRequests),
  memoryIntervalMs: config.memory === false ? false : _convertTimeToMs(config.memory),
  eventLoopThresholdMs: config.eventLoop === false ? false : _convertTimeToMs(config.eventLoop),
  rateLimits: config.rateLimits,
});
