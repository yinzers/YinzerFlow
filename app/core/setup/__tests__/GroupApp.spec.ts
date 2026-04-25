/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from 'bun:test';
import { httpMethod } from '@constants/http.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { GroupApp } from '@core/setup/GroupApp.ts';

describe('GroupApp', () => {
  describe('Path Building', () => {
    it('should build paths correctly with leading slashes', () => {
      const setup = new SetupImpl();
      const app = new GroupApp(setup, '/api');
      app.get('/users', () => ({}));

      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/users')).toBeDefined();
    });

    it('should build paths correctly without leading slashes', () => {
      const setup = new SetupImpl();
      const app = new GroupApp(setup, '/api');
      app.get('users', () => ({}));

      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/users')).toBeDefined();
    });

    it('should handle mixed slash usage', () => {
      const setup = new SetupImpl();
      const app = new GroupApp(setup, '/api');
      app.get('v1/users', () => ({}));

      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users')).toBeDefined();
    });
  });

  describe('Hook Merging', () => {
    it('should merge beforeHooks in correct order', () => {
      const setup = new SetupImpl();
      const hook1 = () => console.log('hook1');
      const hook2 = () => console.log('hook2');

      const app = new GroupApp(setup, '/api', { beforeHooks: [hook1] });
      app.get('/users', () => ({}), { beforeHooks: [hook2] });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/users')!;
      expect(route.options.beforeHooks).toContain(hook1);
      expect(route.options.beforeHooks).toContain(hook2);
      expect(route.options.beforeHooks!.indexOf(hook1)).toBeLessThan(route.options.beforeHooks!.indexOf(hook2));
    });

    it('should merge afterHooks in reverse order', () => {
      const setup = new SetupImpl();
      const hook1 = () => console.log('hook1');
      const hook2 = () => console.log('hook2');

      const app = new GroupApp(setup, '/api', { afterHooks: [hook1] });
      app.get('/users', () => ({}), { afterHooks: [hook2] });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/users')!;
      expect(route.options.afterHooks).toContain(hook1);
      expect(route.options.afterHooks).toContain(hook2);
      expect(route.options.afterHooks!.indexOf(hook2)).toBeLessThan(route.options.afterHooks!.indexOf(hook1));
    });
  });

  describe('HTTP Methods', () => {
    it('should support all HTTP methods', () => {
      const setup = new SetupImpl();
      const groupApp = new GroupApp(setup, '/api/v1');
      // Note: HEAD is auto-registered for GET routes, so we don't test it separately
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options'] as const;

      methods.forEach((method) => {
        groupApp[method]('/test', () => ({}));
        const route = setup._routeRegistry._findRoute(httpMethod[method], '/api/v1/test');
        expect(route).toBeDefined();
      });

      // Verify HEAD was auto-registered for GET
      const headRoute = setup._routeRegistry._findRoute(httpMethod.head, '/api/v1/test');
      expect(headRoute).toBeDefined();
    });

    it('should auto-register HEAD for GET routes', () => {
      const setup = new SetupImpl();
      const groupApp = new GroupApp(setup, '/api/v1');
      groupApp.get('/users', () => ({}));

      const getRoute = setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users');
      const headRoute = setup._routeRegistry._findRoute(httpMethod.head, '/api/v1/users');

      expect(getRoute).toBeDefined();
      expect(headRoute).toBeDefined();
      expect(getRoute!.handler).toBe(headRoute!.handler);
    });
  });

  describe('Nested Groups', () => {
    it('should create nested groups with correct paths', () => {
      const setup = new SetupImpl();
      const groupApp = new GroupApp(setup, '/api/v1');

      groupApp.group('/admin', (admin) => {
        admin.get('/users', () => ({}));
      });

      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/admin/users')).toBeDefined();
    });

    it('should inherit hooks from parent group', () => {
      const setup = new SetupImpl();
      const parentHook = () => console.log('parent');
      const childHook = () => console.log('child');

      const app = new GroupApp(setup, '/api', { beforeHooks: [parentHook] });
      app.group('/v1', (v1) => {
        v1.get('/users', () => ({}), { beforeHooks: [childHook] });
      });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users');
      expect(route?.options.beforeHooks).toContain(parentHook);
      expect(route?.options.beforeHooks).toContain(childHook);
    });

    it('should return nested group app', () => {
      const setup = new SetupImpl();
      const groupApp = new GroupApp(setup, '/api/v1');

      const nestedGroup = groupApp.group('/admin', (admin) => {
        admin.get('/users', () => ({}));
      });

      expect(nestedGroup).toBeDefined();
      expect(typeof nestedGroup.get).toBe('function');
      expect(typeof nestedGroup.group).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined options gracefully', () => {
      const setup = new SetupImpl();
      const app = new GroupApp(setup, '/api');
      expect(() => {
        app.get('/users', () => ({}), undefined);
      }).not.toThrow();
    });

    it('should handle empty hook arrays', () => {
      const setup = new SetupImpl();
      const app = new GroupApp(setup, '/api', { beforeHooks: [], afterHooks: [] });
      app.get('/users', () => ({}));

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/users');
      expect(route?.options.beforeHooks).toEqual([]);
      expect(route?.options.afterHooks).toEqual([]);
    });
  });
});
