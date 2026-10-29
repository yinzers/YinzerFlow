import { log } from '@core/utils/log.ts';
import { _formatBytesForDisplay } from '@core/utils/bytes.ts';
import { _defaultPortForScheme, _parseOrigin } from '@core/modules/websocket/WebSocketOrigin.ts';
import type { InternalWebSocketOptions } from '@typedefs/internal/InternalConfiguration.js';

/**
 * Default WebSocket configuration with sensible production defaults.
 */
export const DEFAULT_WEBSOCKET_CONFIG: InternalWebSocketOptions = {
  maxPayloadLength: 16_777_216, // 16MB
  idleTimeout: 120, // seconds
  maxConnectionsPerIp: 50,
  // allowedOrigins is left unset: same-origin only
  allowMissingOrigin: true,
  backpressure: {
    strategy: 'buffer',
    limit: 1_048_576, // 1MB
  },
  heartbeat: {
    enabled: true,
    interval: 30, // seconds
  },
  messageRateLimit: {
    enabled: false,
    maxMessages: 100,
    window: 10, // seconds
  },
  compression: {
    enabled: false,
    level: 1,
    threshold: 128,
    serverMaxWindowBits: 11,
    clientMaxWindowBits: 15,
  },
};

/**
 * Validate WebSocket configuration values.
 */
// eslint-disable-next-line complexity -- validation function with many independent checks
export const _validateWebSocketConfig = (config: InternalWebSocketOptions): void => {
  if (config.maxPayloadLength < 1) {
    throw new Error('websocket.maxPayloadLength must be at least 1 byte');
  }

  if (config.idleTimeout < 0) {
    throw new Error('websocket.idleTimeout must be >= 0 (0 = no timeout)');
  }

  if (config.maxConnectionsPerIp < 1) {
    throw new Error('websocket.maxConnectionsPerIp must be at least 1');
  }

  if (config.allowedOrigins !== undefined) _validateAllowedOrigins(config.allowedOrigins);

  if (config.backpressure.limit < 0) {
    throw new Error('websocket.backpressure.limit must be >= 0');
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation for JS users who bypass TypeScript
  if (config.backpressure.strategy !== 'buffer' && config.backpressure.strategy !== 'drop') {
    throw new Error(`websocket.backpressure.strategy must be 'buffer' or 'drop'. Got: "${config.backpressure.strategy as unknown as string}"`);
  }

  if (config.heartbeat.enabled && config.heartbeat.interval < 1) {
    throw new Error('websocket.heartbeat.interval must be at least 1 second');
  }

  if (config.messageRateLimit.enabled) {
    if (!Number.isInteger(config.messageRateLimit.maxMessages) || config.messageRateLimit.maxMessages < 1) {
      throw new Error('websocket.messageRateLimit.maxMessages must be an integer >= 1');
    }
    if (!Number.isInteger(config.messageRateLimit.window) || config.messageRateLimit.window < 1) {
      throw new Error('websocket.messageRateLimit.window must be an integer >= 1 (seconds)');
    }
  }

  if (config.compression.enabled) {
    if (config.compression.level < 1 || config.compression.level > 9) {
      throw new Error('websocket.compression.level must be between 1 and 9');
    }
    if (config.compression.threshold < 0) {
      throw new Error('websocket.compression.threshold must be >= 0');
    }
    if (config.compression.serverMaxWindowBits < 9 || config.compression.serverMaxWindowBits > 15) {
      throw new Error('websocket.compression.serverMaxWindowBits must be between 9 and 15');
    }
    if (config.compression.clientMaxWindowBits < 9 || config.compression.clientMaxWindowBits > 15) {
      throw new Error('websocket.compression.clientMaxWindowBits must be between 9 and 15');
    }
  }
};

/**
 * Validate `websocket.allowedOrigins`: either exactly `['*']`, or serialized origins a browser could send
 * (`scheme://host[:port]`, no path, no trailing slash, no default port). An entry that can never match throws.
 */
const _validateAllowedOrigins = (allowedOrigins: Array<string>): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation for JS users who bypass TypeScript
  if (!Array.isArray(allowedOrigins)) {
    throw new Error("websocket.allowedOrigins must be an array of origins, ['*'], or [] (leave it unset for same-origin only)");
  }

  if (allowedOrigins.includes('*') && allowedOrigins.length > 1) {
    throw new Error("websocket.allowedOrigins: '*' must be the only entry. Use ['*'] to allow every origin, or list origins without it.");
  }

  for (const entry of allowedOrigins) {
    if (entry === '*') continue;
    _validateOriginEntry(entry);
  }
};

const _validateOriginEntry = (entry: unknown): void => {
  const parsed = typeof entry === 'string' ? _parseOrigin(entry) : null;
  if (!parsed) {
    throw new Error(
      `websocket.allowedOrigins: ${JSON.stringify(entry)} is not an origin. ` +
        "Write it the way a browser sends it, like 'https://app.example.com' or 'http://localhost:3000' " +
        '(scheme, host and optional port; no path, no trailing slash, no wildcards).',
    );
  }
  if (parsed.port === undefined) return;
  if (parsed.port < 1 || parsed.port > 65_535) {
    throw new Error(`websocket.allowedOrigins: ${JSON.stringify(entry)} has an invalid port; port must be 1-65535.`);
  }
  if (parsed.port === _defaultPortForScheme(parsed.scheme)) {
    throw new Error(
      `websocket.allowedOrigins: ${JSON.stringify(entry)} would never match, because browsers omit the default port. ` +
        `Write '${parsed.scheme}://${parsed.host}'.`,
    );
  }
};

/**
 * Issue security warnings for risky WebSocket configurations.
 */
export const _warnWebSocketConfig = (config: InternalWebSocketOptions): void => {
  if (config.maxPayloadLength > 67_108_864) {
    // 64MB
    log.warn(
      `[SECURITY WARNING] websocket.maxPayloadLength is set to ${_formatBytesForDisplay(config.maxPayloadLength)}. ` +
        'Very large payloads can cause memory exhaustion. Consider if this size is necessary.',
    );
  }

  if (config.allowedOrigins?.length === 1 && config.allowedOrigins[0] === '*') {
    log.warn(
      "[SECURITY WARNING] websocket.allowedOrigins is ['*'], so any website can open a WebSocket to this server. " +
        'If upgrades are authenticated by cookies, that socket is logged in as the visiting user (cross-site WebSocket hijacking).',
    );
  }

  if (config.idleTimeout === 0) {
    log.warn(
      '[SECURITY WARNING] websocket.idleTimeout is 0 (disabled). ' +
        'Idle connections will never be closed automatically, which can lead to resource exhaustion.',
    );
  }

  _warnIdleBelowHeartbeat({ setting: 'websocket.idleTimeout', idleTimeout: config.idleTimeout, config, warn: log.warn });

  if (!config.heartbeat.enabled) {
    log.warn(
      '[SECURITY WARNING] websocket.heartbeat is disabled. ' +
        'Half-open connections (client network died without clean close) will not be detected automatically.',
    );
  }
};

/**
 * Warn when an idle timeout would close a listen-only client before the next heartbeat ping keeps it alive: the ping's
 * pong is the only frame such a client sends. `routeHeartbeatInterval` is a route's override (0 turns its heartbeat
 * off); the sweep always runs at the global interval.
 */
export const _warnIdleBelowHeartbeat = ({
  setting,
  idleTimeout,
  config,
  routeHeartbeatInterval,
  warn,
}: {
  setting: string;
  idleTimeout: number;
  config: InternalWebSocketOptions;
  routeHeartbeatInterval?: number | undefined;
  warn: (message: string) => void;
}): void => {
  if (idleTimeout <= 0 || !config.heartbeat.enabled || routeHeartbeatInterval === 0) return;
  if (idleTimeout > config.heartbeat.interval) return;
  warn(
    `${setting} (${idleTimeout}s) is at or below the heartbeat interval (websocket.heartbeat.interval, ${config.heartbeat.interval}s). ` +
      'A client that only listens is closed for idleness before the next ping can keep it alive. Raise the idle timeout above the interval.',
  );
};
