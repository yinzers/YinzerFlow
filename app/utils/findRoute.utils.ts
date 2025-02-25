import type HttpRequest from 'root/HttpRequest.ts';
import type { IRoute } from 'root/index.ts';

export default function findRouteUtils(request: HttpRequest, routes: Map<string, IRoute>): IRoute | undefined {
  // First try exact match
  const exactKey = `${request.method}:${request.path}`;
  const exactMatch = routes.get(exactKey);
  if (exactMatch) return exactMatch;

  // If no exact match, look for pattern matches
  for (const [, route] of routes) {
    if (route.method !== request.method) continue;

    // Convert route pattern to regex
    const pattern = route.path.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${pattern}$`);

    if (regex.test(request.path)) return route;
  }


  return undefined;
}

