import type { RouteRegistry } from '../RouteRegistry.ts';
import { HttpMethod } from 'constants/http.ts';
import type { IRoute, IRouteOptions } from 'types/Route.ts';

export const addDeleteRoute =
  (registry: RouteRegistry) =>
  (path: IRoute['path'], handler: IRoute['handler'], options?: IRouteOptions): IRoute =>
    registry.addRoute({ path, handler, method: HttpMethod.DELETE, ...options });
