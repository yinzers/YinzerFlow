import { describe, expect, it } from 'bun:test';
import { validateParameterNames } from '../validateParameterNames.ts';

describe('validateParameterNames', () => {
  describe('Valid parameter names', () => {
    it('should allow routes with no parameters', () => {
      expect(() => validateParameterNames('/users')).not.toThrow();
      expect(() => validateParameterNames('/api/v1/posts')).not.toThrow();
      expect(() => validateParameterNames('/')).not.toThrow();
    });

    it('should allow routes with single parameter', () => {
      expect(() => validateParameterNames('/users/:id')).not.toThrow();
      expect(() => validateParameterNames('/posts/:postId')).not.toThrow();
      expect(() => validateParameterNames('/api/users/:userId')).not.toThrow();
    });

    it('should allow routes with multiple unique parameters', () => {
      expect(() => validateParameterNames('/users/:userId/posts/:postId')).not.toThrow();
      expect(() => validateParameterNames('/api/:version/users/:id/posts/:postId')).not.toThrow();
      expect(() => validateParameterNames('/:category/:subcategory/:item')).not.toThrow();
    });

    it('should allow routes with complex unique parameter names', () => {
      expect(() => validateParameterNames('/users/:userId/posts/:postId/comments/:commentId')).not.toThrow();
      expect(() => validateParameterNames('/api/:apiVersion/orgs/:orgId/repos/:repoName')).not.toThrow();
      expect(() => validateParameterNames('/:param1/:param2/:param3/:param4')).not.toThrow();
    });
  });

  describe('Invalid parameter names (duplicates)', () => {
    it('should throw error for simple duplicate parameter names', () => {
      expect(() => validateParameterNames('/users/:id/posts/:id')).toThrow(
        'Route /users/:id/posts/:id has duplicate parameter names: id. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });

    it('should throw error for multiple duplicate parameter names', () => {
      expect(() => validateParameterNames('/api/:id/users/:name/posts/:id/comments/:name')).toThrow(
        'Route /api/:id/users/:name/posts/:id/comments/:name has duplicate parameter names: id, name. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });

    it('should throw error for tripled parameter names', () => {
      expect(() => validateParameterNames('/:id/:id/:id')).toThrow(
        'Route /:id/:id/:id has duplicate parameter names: id, id. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });

    it('should throw error with complex duplicate patterns', () => {
      expect(() => validateParameterNames('/users/:userId/posts/:postId/comments/:userId/replies/:postId')).toThrow(
        'Route /users/:userId/posts/:postId/comments/:userId/replies/:postId has duplicate parameter names: userId, postId. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(() => validateParameterNames('')).not.toThrow();
    });

    it('should handle routes with only static segments between duplicates', () => {
      expect(() => validateParameterNames('/api/v1/:id/details/extended/:id')).toThrow(
        'Route /api/v1/:id/details/extended/:id has duplicate parameter names: id. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });

    it('should handle parameters with underscores and numbers', () => {
      expect(() => validateParameterNames('/users/:user_id/posts/:post_id')).not.toThrow();
      expect(() => validateParameterNames('/api/:v1/:v2/:v1')).toThrow(
        'Route /api/:v1/:v2/:v1 has duplicate parameter names: v1. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });

    it('should handle similar but different parameter names', () => {
      expect(() => validateParameterNames('/users/:id/posts/:id1')).not.toThrow();
      expect(() => validateParameterNames('/users/:userId/posts/:userIdx')).not.toThrow();
      expect(() => validateParameterNames('/api/:version/:versionId')).not.toThrow();
    });

    it('should be case sensitive', () => {
      expect(() => validateParameterNames('/users/:Id/posts/:id')).not.toThrow();
      expect(() => validateParameterNames('/users/:ID/posts/:id')).not.toThrow();
      expect(() => validateParameterNames('/users/:id/posts/:Id/comments/:id')).toThrow(
        'Route /users/:id/posts/:Id/comments/:id has duplicate parameter names: id. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });
  });

  describe('Error message accuracy', () => {
    it('should list all duplicate parameter names in error message', () => {
      expect(() => validateParameterNames('/:a/:b/:c/:a/:b/:d')).toThrow(
        'Route /:a/:b/:c/:a/:b/:d has duplicate parameter names: a, b. Parameter names must be unique within a route for clarity and to prevent conflicts.',
      );
    });

    it('should include the full route path in error message', () => {
      const route = '/very/long/api/path/with/:duplicateParam/in/middle/and/:duplicateParam/at/end';
      expect(() => validateParameterNames(route)).toThrow(
        `Route ${route} has duplicate parameter names: duplicateParam. Parameter names must be unique within a route for clarity and to prevent conflicts.`,
      );
    });
  });
});
