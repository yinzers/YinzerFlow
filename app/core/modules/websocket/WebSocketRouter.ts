import { normalizePath } from '@core/setup/utils/normalizeStringPatterns.ts';
import type { WebSocketHandlers, WebSocketRouteOptions } from '@typedefs/public/WebSocket.js';

interface WsRoute {
  path: string;
  handlers: WebSocketHandlers;
  options?: WebSocketRouteOptions;
  pattern?: RegExp;
  paramNames?: Array<string>;
}

interface WsRouteMatch {
  handlers: WebSocketHandlers;
  options?: WebSocketRouteOptions;
  params: Record<string, string>;
}

/**
 * WebSocket route registry with exact + parameterized path matching.
 * Mirrors the HTTP RouteRegistryImpl pattern but without HTTP method discrimination.
 */
export class WebSocketRouter {
  private readonly _exactRoutes = new Map<string, WsRoute>();
  private readonly _parameterizedRoutes: Array<WsRoute> = [];

  _register(path: string, handlers: WebSocketHandlers, options?: WebSocketRouteOptions): void {
    const normalizedPath = normalizePath(path);
    const isParameterized = normalizedPath.includes(':');

    if (isParameterized) {
      const paramNames: Array<string> = [];
      const pattern = normalizedPath
        .replace(/:\w+/g, (match) => {
          paramNames.push(match.slice(1));
          return '([^/]+)';
        })
        .replace(/\//g, '\\/');

      this._parameterizedRoutes.push({
        path: normalizedPath,
        handlers,
        options,
        pattern: new RegExp(`^${pattern}$`),
        paramNames,
      });
    } else {
      this._exactRoutes.set(normalizedPath, { path: normalizedPath, handlers, options });
    }
  }

  _match(path: string): WsRouteMatch | undefined {
    const normalizedPath = normalizePath(path);

    // O(1) exact match first
    const exact = this._exactRoutes.get(normalizedPath);
    if (exact) {
      return { handlers: exact.handlers, options: exact.options, params: {} };
    }

    // O(n) parameterized match
    for (const route of this._parameterizedRoutes) {
      if (!route.pattern) continue;
      const match = route.pattern.exec(normalizedPath);
      if (match) {
        const params: Record<string, string> = {};
        for (let i = 0; i < (route.paramNames?.length ?? 0); i++) {
          const name = route.paramNames?.[i];
          const value = match[i + 1];
          if (name && value) {
            params[name] = value;
          }
        }
        return { handlers: route.handlers, options: route.options, params };
      }
    }

    return undefined;
  }

  _hasRoutes(): boolean {
    return this._exactRoutes.size > 0 || this._parameterizedRoutes.length > 0;
  }
}
