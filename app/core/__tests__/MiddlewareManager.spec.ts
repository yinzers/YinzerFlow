/**
 * MiddlewareManager Tests
 *
 * Tests for the MiddlewareManager class which manages middleware registration and execution.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { MiddlewareManager } from 'core/MiddlewareManager.ts';
import type { TMiddleware } from 'types/Middleware';
import type { Context } from 'types/Common';

describe('MiddlewareManager', () => {
  let manager: MiddlewareManager;

  // Sample middleware functions for testing
  const loggerMiddleware: TMiddleware = (ctx, next) => {
    console.log(`Request to ${ctx.request.path}`);
    return next();
  };

  const authMiddleware: TMiddleware = (ctx, next) => {
    if (!ctx.request.headers.authorization) {
      ctx.response.setStatus(401);
      return { success: false, message: 'Unauthorized' };
    }
    return next();
  };

  const rateLimitMiddleware: TMiddleware = (ctx, next) =>
    // Simulated rate limiting
    next();
  // Reset manager before each test
  beforeEach(() => {
    manager = new MiddlewareManager();
  });

  it('should initialize with an empty middleware array', () => {
    expect(manager.getMiddleware().length).toBe(0);
  });

  it('should add global middleware correctly', () => {
    manager.addMiddleware(loggerMiddleware, { paths: 'all' });

    const middleware = manager.getMiddleware();
    expect(middleware.length).toBe(1);
    expect(middleware[0].middleware).toBe(loggerMiddleware);
    expect(middleware[0].options.paths).toBe('all');
  });

  it('should add path-specific middleware correctly', () => {
    manager.addMiddleware(authMiddleware, { paths: ['/admin', '/profile'] });

    const middleware = manager.getMiddleware();
    expect(middleware.length).toBe(1);
    expect(middleware[0].middleware).toBe(authMiddleware);
    expect(Array.isArray(middleware[0].options.paths)).toBe(true);
    expect(middleware[0].options.paths).toContain('/admin');
    expect(middleware[0].options.paths).toContain('/profile');
  });

  it('should add excluded paths middleware correctly', () => {
    manager.addMiddleware(authMiddleware, {
      paths: 'allButExcluded',
      excluded: ['/login', '/register'],
    });

    const middleware = manager.getMiddleware();
    expect(middleware.length).toBe(1);
    expect(middleware[0].middleware).toBe(authMiddleware);
    expect(middleware[0].options.paths).toBe('allButExcluded');
    expect(Array.isArray(middleware[0].options.excluded)).toBe(true);
    expect(middleware[0].options.excluded).toContain('/login');
    expect(middleware[0].options.excluded).toContain('/register');
  });

  it('should add multiple middleware correctly', () => {
    manager.addMiddleware(loggerMiddleware, { paths: 'all' });
    manager.addMiddleware(authMiddleware, { paths: ['/admin', '/profile'] });
    manager.addMiddleware(rateLimitMiddleware, {
      paths: 'allButExcluded',
      excluded: ['/status'],
    });

    const middleware = manager.getMiddleware();
    expect(middleware.length).toBe(3);
  });

  it('should get middleware for a specific path correctly - global middleware', () => {
    manager.addMiddleware(loggerMiddleware, { paths: 'all' });

    const pathMiddleware = manager.getMiddlewareForPath('/any/path');
    expect(pathMiddleware.length).toBe(1);
    expect(pathMiddleware[0]).toBe(loggerMiddleware);
  });

  it('should get middleware for a specific path correctly - path-specific middleware', () => {
    manager.addMiddleware(authMiddleware, { paths: ['/admin', '/profile'] });

    const adminMiddleware = manager.getMiddlewareForPath('/admin');
    expect(adminMiddleware.length).toBe(1);
    expect(adminMiddleware[0]).toBe(authMiddleware);

    const homeMiddleware = manager.getMiddlewareForPath('/home');
    expect(homeMiddleware.length).toBe(0);
  });

  it('should get middleware for a specific path correctly - excluded paths middleware', () => {
    manager.addMiddleware(authMiddleware, {
      paths: 'allButExcluded',
      excluded: ['/login', '/register'],
    });

    const profileMiddleware = manager.getMiddlewareForPath('/profile');
    expect(profileMiddleware.length).toBe(1);
    expect(profileMiddleware[0]).toBe(authMiddleware);

    const loginMiddleware = manager.getMiddlewareForPath('/login');
    expect(loginMiddleware.length).toBe(0);
  });

  it('should get middleware for a specific path correctly - multiple middleware', () => {
    manager.addMiddleware(loggerMiddleware, { paths: 'all' });
    manager.addMiddleware(authMiddleware, { paths: ['/admin', '/profile'] });

    const adminMiddleware = manager.getMiddlewareForPath('/admin');
    expect(adminMiddleware.length).toBe(2);
    expect(adminMiddleware).toContain(loggerMiddleware);
    expect(adminMiddleware).toContain(authMiddleware);

    const homeMiddleware = manager.getMiddlewareForPath('/home');
    expect(homeMiddleware.length).toBe(1);
    expect(homeMiddleware).toContain(loggerMiddleware);
  });

  it('should handle path matching with trailing slashes', () => {
    manager.addMiddleware(authMiddleware, { paths: ['/admin', '/profile'] });

    const adminMiddleware = manager.getMiddlewareForPath('/admin/');
    expect(adminMiddleware.length).toBe(1);
    expect(adminMiddleware[0]).toBe(authMiddleware);
  });

  it('should handle subpath matching correctly', () => {
    manager.addMiddleware(authMiddleware, { paths: ['/admin'] });

    const subpathMiddleware = manager.getMiddlewareForPath('/admin/users');
    expect(subpathMiddleware.length).toBe(1);
    expect(subpathMiddleware[0]).toBe(authMiddleware);
  });

  it('should handle exact path matching correctly', () => {
    manager.addMiddleware(authMiddleware, {
      paths: ['/admin'],
      exact: true,
    });

    const exactPathMiddleware = manager.getMiddlewareForPath('/admin');
    expect(exactPathMiddleware.length).toBe(1);

    const subpathMiddleware = manager.getMiddlewareForPath('/admin/users');
    expect(subpathMiddleware.length).toBe(0);
  });
});
