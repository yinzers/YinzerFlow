import { log } from '@core/utils/log.ts';
import { _formatBytesForDisplay } from '@core/utils/bytes.ts';

/**
 * Default WebSocket configuration with sensible production defaults.
 */
export const DEFAULT_WEBSOCKET_CONFIG = {
  maxPayloadLength: 16_777_216, // 16MB
  idleTimeout: 120, // seconds
  maxConnectionsPerIp: 50,
  allowedOrigins: [] as Array<string>,
  backpressure: {
    strategy: 'buffer' as const,
    limit: 1_048_576, // 1MB
  },
};

export type InternalWebSocketConfig = typeof DEFAULT_WEBSOCKET_CONFIG;

/**
 * Validate WebSocket configuration values.
 */
export const _validateWebSocketConfig = (config: InternalWebSocketConfig): void => {
  if (config.maxPayloadLength < 1) {
    throw new Error('websocket.maxPayloadLength must be at least 1 byte');
  }

  if (config.idleTimeout < 0) {
    throw new Error('websocket.idleTimeout must be >= 0 (0 = no timeout)');
  }

  if (config.maxConnectionsPerIp < 1) {
    throw new Error('websocket.maxConnectionsPerIp must be at least 1');
  }

  if (config.backpressure.limit < 0) {
    throw new Error('websocket.backpressure.limit must be >= 0');
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation for JS users who bypass TypeScript
  if (config.backpressure.strategy !== 'buffer' && config.backpressure.strategy !== 'drop') {
    throw new Error(`websocket.backpressure.strategy must be 'buffer' or 'drop'. Got: "${config.backpressure.strategy as unknown as string}"`);
  }
};

/**
 * Issue security warnings for risky WebSocket configurations.
 */
export const _warnWebSocketConfig = (config: InternalWebSocketConfig): void => {
  if (config.maxPayloadLength > 67_108_864) { // 64MB
    log.warn(
      `[SECURITY WARNING] websocket.maxPayloadLength is set to ${_formatBytesForDisplay(config.maxPayloadLength)}. ` +
      'Very large payloads can cause memory exhaustion. Consider if this size is necessary.',
    );
  }

  if (config.idleTimeout === 0) {
    log.warn(
      '[SECURITY WARNING] websocket.idleTimeout is 0 (disabled). ' +
      'Idle connections will never be closed automatically, which can lead to resource exhaustion.',
    );
  }
};
