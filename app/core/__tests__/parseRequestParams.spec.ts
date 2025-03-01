import { describe, expect, it } from 'bun:test';
import { RequestParser } from 'core/RequestParser.ts';
import type { IRoute } from 'types/Route.ts';

describe('RequestParser.parseParams', () => {
  const parser = new RequestParser();

  it('should extract parameters from a path based on a route pattern', () => {
    const path = '/users/123/posts/456';
    const route: IRoute = { path: '/users/:userId/posts/:postId', method: 'GET', handler: () => ({}) };

    const result = parser.parseParams(route, path);

    expect(result).toEqual({
      userId: '123',
      postId: '456',
    });
  });

  it('should handle routes with no parameters', () => {
    const path = '/users';
    const route: IRoute = { path: '/users', method: 'GET', handler: () => ({}) };

    const result = parser.parseParams(route, path);

    expect(result).toEqual({});
  });

  it('should handle routes with parameters at the beginning', () => {
    const path = '/123/users';
    const route: IRoute = { path: '/:userId/users', method: 'GET', handler: () => ({}) };

    const result = parser.parseParams(route, path);

    expect(result).toEqual({
      userId: '123',
    });
  });

  it('should handle routes with parameters at the end', () => {
    const path = '/users/123';
    const route: IRoute = { path: '/users/:userId', method: 'GET', handler: () => ({}) };

    const result = parser.parseParams(route, path);

    expect(result).toEqual({
      userId: '123',
    });
  });

  it('should handle routes with multiple consecutive parameters', () => {
    const path = '/users/123/456';
    const route: IRoute = { path: '/users/:userId/:postId', method: 'GET', handler: () => ({}) };

    const result = parser.parseParams(route, path);

    expect(result).toEqual({
      userId: '123',
      postId: '456',
    });
  });
});
