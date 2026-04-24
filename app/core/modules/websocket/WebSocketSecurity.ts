/**
 * WebSocket security: origin validation and per-IP connection tracking.
 */
export class WebSocketSecurity {
  private readonly _connectionCounts = new Map<string, number>();

  /**
   * Validate the Origin header against the allowed origins list.
   * Empty allowedOrigins = allow all (including missing origin).
   * Non-empty list = case-insensitive exact match required.
   */
  validateOrigin(origin: string | undefined, allowedOrigins: Array<string>): boolean {
    if (allowedOrigins.length === 0) return true;
    if (!origin) return false;

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
