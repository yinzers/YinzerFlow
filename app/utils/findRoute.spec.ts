/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from 'bun:test';
import type HttpRequest from 'root/HttpRequest.ts';
import type { IRoute } from 'root/index.ts';
import findRouteUtils from 'utils/findRoute.utils.ts';

describe('findRoute', () => {
  it('should return an exact route without params', () => {
    const request = <HttpRequest>{
      path: '/test/goes/here',
      method: 'GET',
    };
    const routes = new Map<string, IRoute>([
      [
        'GET:/test/goes/here',
        {
          method: 'GET',
          path: '/test/goes/here',
          handler: () => ({}),
        },
      ],
      [
        'PUT:/test/goes/here',
        {
          method: 'PUT',
          path: '/test/goes/here',
          handler: () => ({}),
        },
      ],
      [
        'POST:/user',
        {
          method: 'POST',
          path: '/user',
          handler: () => ({}),
        },
      ],
    ]);

    const result = findRouteUtils(request, routes);
    expect(result).toEqual(routes.get('GET:/test/goes/here'));
  });

  it('should return an exact route with params', () => {
    const request = <HttpRequest>{
      path: '/test/:id/here/:id2',
      method: 'POST',
    };
    const routes = new Map<string, IRoute>([
      [
        'GET:/test/goes/here',
        {
          method: 'GET',
          path: '/test/goes/here',
          handler: () => ({}),
        },
      ],
      [
        'PUT:/test/:id/here',
        {
          method: 'PUT',
          path: '/test/:id/here',
          handler: () => ({}),
        },
      ],
      [
        'POST:/test/:id/here/:id2',
        {
          method: 'POST',
          path: '/test/:id/here/:id2',
          handler: () => ({}),
        },
      ],
    ]);

    const result = findRouteUtils(request, routes);
    console.log(result);
    expect(result).toEqual(routes.get('POST:/test/:id/here/:id2'));
  });
});
