import { describe, expect, it } from 'bun:test';
import type { IRoute } from '@typedefs/core/setup/RouteRegistry.js';
import { compileRoutePattern } from '../compileRoutePatter.ts';
import { httpMethod } from '@constants/http.ts';

describe('compileRoutePattern', () => {
  describe('Basic route compilation', () => {
    it('should compile simple parameterized route', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/users/:id',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);

      expect(compiled.pattern).toBeInstanceOf(RegExp);
      expect(compiled.pattern.source).toBe('^\\/users\\/([^\\/]+)$');
      expect(compiled.paramNames).toEqual(['id']);
      expect(compiled.isParameterized).toBe(true);
      expect(compiled.method).toBe(httpMethod.get);
      expect(compiled.path).toBe('/users/:id');
      expect(compiled.handler).toBe(route.handler);
    });

    it('should compile route with multiple parameters', () => {
      const route: IRoute = {
        method: httpMethod.post,
        path: '/users/:userId/posts/:postId',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);

      expect(compiled.pattern.source).toBe('^\\/users\\/([^\\/]+)\\/posts\\/([^\\/]+)$');
      expect(compiled.paramNames).toEqual(['userId', 'postId']);
      expect(compiled.isParameterized).toBe(true);
    });

    it('should preserve all original route properties', () => {
      const routeOptions = {
        beforeHooks: [() => {}],
        afterHooks: [() => {}],
      };

      const route: IRoute = {
        method: httpMethod.put,
        path: '/api/:version/users/:id',
        handler: () => 'test handler',
        options: routeOptions,
      };

      const compiled = compileRoutePattern(route);

      expect(compiled.method).toBe(route.method);
      expect(compiled.path).toBe(route.path);
      expect(compiled.handler).toBe(route.handler);
      expect(compiled.options).toEqual(routeOptions);
    });
  });

  describe('Regex pattern generation', () => {
    it('should create patterns that match correctly', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/users/:id',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);

      // Should match valid paths
      expect(compiled.pattern.test('/users/123')).toBe(true);
      expect(compiled.pattern.test('/users/abc')).toBe(true);
      expect(compiled.pattern.test('/users/user-123')).toBe(true);
      expect(compiled.pattern.test('/users/user_name')).toBe(true);

      // Should NOT match invalid paths
      expect(compiled.pattern.test('/users')).toBe(false);
      expect(compiled.pattern.test('/users/')).toBe(false);
      expect(compiled.pattern.test('/users/123/extra')).toBe(false);
      expect(compiled.pattern.test('/posts/123')).toBe(false);
      expect(compiled.pattern.test('users/123')).toBe(false); // Missing leading slash
    });

    it('should create patterns for complex routes', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/api/v1/users/:userId/posts/:postId/comments/:commentId',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);

      // Should match valid paths
      expect(compiled.pattern.test('/api/v1/users/123/posts/456/comments/789')).toBe(true);
      expect(compiled.pattern.test('/api/v1/users/user123/posts/post456/comments/comment789')).toBe(true);

      // Should NOT match invalid paths
      expect(compiled.pattern.test('/api/v1/users/123/posts/456')).toBe(false);
      expect(compiled.pattern.test('/api/v1/users/123/posts/456/comments')).toBe(false);
      expect(compiled.pattern.test('/api/v2/users/123/posts/456/comments/789')).toBe(false);
    });

    it('should handle parameters at different positions', () => {
      const routes = [
        { path: '/:param', expected: '^/([^/]+)$' },
        { path: '/:param/static', expected: '^/([^/]+)/static$' },
        { path: '/static/:param', expected: '^/static/([^/]+)$' },
        { path: '/static/:param/more', expected: '^/static/([^/]+)/more$' },
      ];

      routes.forEach(({ path, expected }) => {
        const route: IRoute = { method: httpMethod.get, path, handler: () => {} };
        const compiled = compileRoutePattern(route);
        expect(compiled.pattern.source).toBe(expected.replace(/\//g, '\\/'));
      });
    });
  });

  describe('Parameter name extraction', () => {
    it('should extract parameter names in correct order', () => {
      const testCases = [
        { path: '/users/:id', expected: ['id'] },
        { path: '/:first/:second', expected: ['first', 'second'] },
        { path: '/api/:version/users/:userId/posts/:postId', expected: ['version', 'userId', 'postId'] },
        { path: '/:a/:b/:c/:d/:e', expected: ['a', 'b', 'c', 'd', 'e'] },
      ];

      testCases.forEach(({ path, expected }) => {
        const route: IRoute = { method: httpMethod.get, path, handler: () => {} };
        const compiled = compileRoutePattern(route);
        expect(compiled.paramNames).toEqual(expected);
      });
    });

    it('should handle complex parameter names', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/users/:user_id/posts/:post_id123/comments/:commentId',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);
      expect(compiled.paramNames).toEqual(['user_id', 'post_id123', 'commentId']);
    });

    it('should handle mixed static and parameter segments', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/api/v1/:orgId/repos/:repoName/issues/:issueNumber/comments',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);
      expect(compiled.paramNames).toEqual(['orgId', 'repoName', 'issueNumber']);
      expect(compiled.pattern.test('/api/v1/my-org/repos/my-repo/issues/123/comments')).toBe(true);
      expect(compiled.pattern.test('/api/v1/my-org/repos/my-repo/issues/123')).toBe(false);
    });
  });

  describe('Regex matching and parameter extraction', () => {
    it('should enable parameter extraction from matches', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/users/:userId/posts/:postId',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);
      const match = '/users/123/posts/456'.match(compiled.pattern);

      expect(match).not.toBeNull();

      // Type-safe access to match results
      if (match) {
        expect(match[0]).toBe('/users/123/posts/456'); // Full match
        expect(match[1]).toBe('123'); // First parameter (userId)
        expect(match[2]).toBe('456'); // Second parameter (postId)

        // Verify we can map to parameter names
        const params: Record<string, string> = {};
        for (let i = 0; i < compiled.paramNames.length; i++) {
          const paramValue = match[i + 1];
          const paramName = compiled.paramNames[i];
          if (paramValue !== undefined && paramName !== undefined) {
            params[paramName] = paramValue;
          }
        }
        expect(params).toEqual({ userId: '123', postId: '456' });
      }
    });

    it('should handle special characters in parameter values', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/users/:id',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);

      // Test various parameter values
      const testValues = ['123', 'user-name', 'user_name', 'user123', 'a1b2c3'];

      testValues.forEach((value) => {
        const testPath = `/users/${value}`;
        const match = testPath.match(compiled.pattern);
        expect(match).not.toBeNull();

        if (match) {
          expect(match[1]).toBe(value);
        }
      });
    });

    it('should not match paths with slashes in parameter values', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/users/:id',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);

      // Parameter values with slashes should not match (security feature)
      expect(compiled.pattern.test('/users/123/456')).toBe(false);
      expect(compiled.pattern.test('/users/path/to/file')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle routes with only parameters', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/:param',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);
      expect(compiled.pattern.source).toBe('^\\/([^\\/]+)$');
      expect(compiled.paramNames).toEqual(['param']);
    });

    it('should handle routes with consecutive parameters', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/:first/:second/:third',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);
      expect(compiled.pattern.source).toBe('^\\/([^\\/]+)\\/([^\\/]+)\\/([^\\/]+)$');
      expect(compiled.paramNames).toEqual(['first', 'second', 'third']);
      expect(compiled.pattern.test('/a/b/c')).toBe(true);
      expect(compiled.pattern.test('/a/b')).toBe(false);
    });

    it('should maintain isParameterized flag', () => {
      const route: IRoute = {
        method: httpMethod.get,
        path: '/users/:id',
        handler: () => {},
      };

      const compiled = compileRoutePattern(route);
      expect(compiled.isParameterized).toBe(true);
    });
  });
});
