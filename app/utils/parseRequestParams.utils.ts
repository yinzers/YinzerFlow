import type { IRequest } from 'root/HttpRequest.ts';
import type { IRoute } from 'root/index.ts';

/**
 * path = /users/1
 * route.path: /users/:id
 */
export default (path: IRequest['path'], route: IRoute): IRequest['params'] => {
  const parsedParams: IRequest['params'] = {};
  const pathParts = path.split('/');
  const routeParts = route.path.split('/');

  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i]?.startsWith(':')) {
      const key = routeParts[i]?.substring(1);
      const value = pathParts[i];
      if (!key || !value) continue;

      // @ts-expect-error - This is a valid assignment
      parsedParams[key] = value;
    }
  }

  return parsedParams;
};
