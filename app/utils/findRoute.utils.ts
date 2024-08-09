import type HttpRequest from 'root/HttpRequest.ts';
import type { IRoute } from 'root/index.ts';

export default (request: HttpRequest, routes: Array<IRoute>): IRoute | undefined => {
  /**
   * To speed up the response time we are going to ensure the route exists before worrying about any other logic.
   */
  const route = routes.find((r) => r.path === request.path && r.method === request.method);
  if (route) return route;

  /**
   * To save time we will only check for params if we don't find a route that matches exactly.
   *
   * It is possible for the route not to match exactly if the route has params in it.
   * So we are going to check for that here and if we don't find a route we will return undefined
   * and handle a 404 response in the listen method.
   */
  return routes.find((r) => {
    const pathParts = r.path.split('/');
    const requestPathParts = request.path.split('/');
    if (pathParts.length !== requestPathParts.length) return false;
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i]?.startsWith(':')) continue;
      if (pathParts[i] !== requestPathParts[i]) return false;
    }
    return true;
  });
};
