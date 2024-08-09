import { describe, expect, it } from 'bun:test';
import type { IRoute } from 'root/index.ts';
import parseRequestParamsUtils from 'utils/parseRequestParams.utils.ts';

describe('parseRequestParams', () => {
  it('should return a TRequestParams object', () => {
    const path = '/user/1/posts/2';
    const route = <IRoute>{ path: '/user/:id/posts/:postId', method: 'GET', handler: () => ({}) };
    const result = parseRequestParamsUtils(path, route);

    expect(result).toEqual({ id: '1', postId: '2' });
  });
});
