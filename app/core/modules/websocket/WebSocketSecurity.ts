import { _defaultPortForScheme, _parseHostHeader, _parseOrigin } from '@core/modules/websocket/WebSocketOrigin.ts';

/**
 * WebSocket security: origin validation and per-IP connection tracking.
 */
export class WebSocketSecurity {
  private readonly _connectionCounts = new Map<string, number>();

  /**
   * Decide whether an upgrade's Origin is allowed.
   *
   * - A missing Origin (a non-browser client) is allowed exactly when `allowMissingOrigin` is true, in every mode.
   *   A present but empty Origin is not missing: no client sends one legitimately, so it is refused in every mode.
   * - `allowedOrigins` unset: same-origin only. The Origin's host and port must equal the `Host` header's, compared
   *   case-insensitively, with a missing port read as the Origin scheme's default (80 for http/ws, 443 for https/wss).
   *   Only http, https, ws and wss origins can be same-origin.
   * - `['*']`: every origin.
   * - Any other list (including `[]`): case-insensitive exact match against the list.
   */
  validateOrigin({
    origin,
    host,
    allowedOrigins,
    allowMissingOrigin,
  }: {
    origin: string | undefined;
    host: string | undefined;
    allowedOrigins: Array<string> | undefined;
    allowMissingOrigin: boolean;
  }): boolean {
    if (origin === undefined) return allowMissingOrigin;
    if (origin === '') return false;
    if (allowedOrigins === undefined) return _isSameOrigin(origin, host);
    if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') return true;

    const lowerOrigin = origin.toLowerCase();
    return allowedOrigins.some((allowed) => allowed.toLowerCase() === lowerOrigin);
  }

  /**
   * Check if an IP can open another connection (under the per-IP limit).
   */
  canConnect(ip: string, maxPerIp: number): boolean {
    const current = this._connectionCounts.get(ip) ?? 0;
    return current < maxPerIp;
  }

  /**
   * Track a new connection from an IP.
   */
  trackConnect(ip: string): void {
    const current = this._connectionCounts.get(ip) ?? 0;
    this._connectionCounts.set(ip, current + 1);
  }

  /**
   * Track a disconnection. Only decrements if the IP was tracked.
   */
  trackDisconnect(ip: string): void {
    const current = this._connectionCounts.get(ip);
    if (current === undefined) return;

    if (current <= 1) {
      this._connectionCounts.delete(ip);
    } else {
      this._connectionCounts.set(ip, current - 1);
    }
  }

  /**
   * Get current connection count for an IP (for monitoring).
   */
  connectionCount(ip: string): number {
    return this._connectionCounts.get(ip) ?? 0;
  }
}

/**
 * True when the Origin names the host and port the client addressed in `Host`. An Origin or Host that doesn't parse is not same-origin.
 */
const _isSameOrigin = (origin: string, host: string | undefined): boolean => {
  const parsedOrigin = _parseOrigin(origin);
  if (!parsedOrigin || !host) return false;
  const defaultPort = _defaultPortForScheme(parsedOrigin.scheme);
  if (defaultPort === undefined) return false;
  const parsedHost = _parseHostHeader(host);
  if (!parsedHost) return false;

  return parsedOrigin.host === parsedHost.host && (parsedOrigin.port ?? defaultPort) === (parsedHost.port ?? defaultPort);
};
