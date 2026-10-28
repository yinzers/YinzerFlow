import type { InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { WebSocketUpgradeRejection } from '@typedefs/public/WebSocket.js';

/**
 * The value `rejectUpgrade` returns. A class, so the upgrade path recognizes it with `instanceof` and per-socket data
 * that happens to have a `statusCode` field is never mistaken for a refusal.
 */
class WebSocketUpgradeRejectionImpl implements WebSocketUpgradeRejection {
  readonly statusCode: InternalHttpStatusCode;
  readonly body: unknown;

  constructor(statusCode: InternalHttpStatusCode, body: unknown) {
    this.statusCode = statusCode;
    this.body = body;
  }
}

/**
 * Refuse a WebSocket upgrade with an HTTP status and an optional body. Return it from a route's `upgrade` handler.
 *
 * Returning `false` still refuses with 403; use this when the client should see a different status, such as 401 for
 * an expired token so it knows to sign in again.
 *
 * @param statusCode - A 4xx or 5xx status code
 * @param body - Response body, serialized like a route handler's return value. Defaults to
 *   `{ error: 'WebSocket upgrade rejected' }`
 * @throws When `statusCode` is not a 4xx or 5xx code (an upgrade can only be refused with an error status)
 *
 * @example
 * ```typescript
 * import { rejectUpgrade } from 'yinzerflow';
 *
 * app.ws<{ userId: string }>('/feed', {
 *   async upgrade(req) {
 *     const session = await sessions.find(req.headers.authorization);
 *     if (!session) return rejectUpgrade(401, { error: 'Sign in again' });
 *     if (!session.canStream) return false; // 403
 *     return { userId: session.userId };
 *   },
 * });
 * ```
 */
export const rejectUpgrade = (statusCode: InternalHttpStatusCode, body?: unknown): WebSocketUpgradeRejection => {
  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    throw new Error(
      `rejectUpgrade() needs a 4xx or 5xx status code, got ${String(statusCode)}. ` +
        `An upgrade is accepted by returning data from upgrade(), not by a success status, n'at.`,
    );
  }
  return new WebSocketUpgradeRejectionImpl(statusCode, body ?? { error: 'WebSocket upgrade rejected' });
};

/** True when an upgrade handler returned `rejectUpgrade(...)`. */
export const _isUpgradeRejection = (value: unknown): value is WebSocketUpgradeRejection => value instanceof WebSocketUpgradeRejectionImpl;
