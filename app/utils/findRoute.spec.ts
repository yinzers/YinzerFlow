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
    const routes = <Array<IRoute>>[
      {
        method: 'GET',
        path: '/test/goes/here',
        handler: () => ({}),
      },
      {
        method: 'PUT',
        path: '/test/goes/here',
        handler: () => ({}),
      },
      {
        method: 'POST',
        path: '/user',
        handler: () => ({}),
      },
    ];

    const result = findRouteUtils(request, routes);
    expect(result).toEqual(routes[0]);
  });

  it('should return an exact route with params', () => {
    const request = <HttpRequest>{
      path: '/test/:id/here/:id2',
      method: 'PUT',
    };
    const routes = <Array<IRoute>>[
      {
        method: 'GET',
        path: '/test/goes/here',
        handler: () => ({}),
      },
      {
        method: 'PUT',
        path: '/test/:id/here',
        handler: () => ({}),
      },
      {
        method: 'POST',
        path: '/test/:id/here/:id2',
        handler: () => ({}),
      },
    ];

    const result = findRouteUtils(request, routes);
    expect(result).toEqual(routes[2]);
  });
});
