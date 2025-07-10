import { describe, expect, it } from 'bun:test';
import { normalizePath, normalizeRouteStructure } from '../normalizeStringPatterns.ts';

describe('normalizeStringPatterns', () => {
  describe('normalizePath', () => {
    describe('Basic normalization', () => {
      it('should add leading slash when missing', () => {
        expect(normalizePath('users')).toBe('/users');
        expect(normalizePath('api/v1/users')).toBe('/api/v1/users');
      });

      it('should preserve existing leading slash', () => {
        expect(normalizePath('/users')).toBe('/users');
        expect(normalizePath('/api/v1/users')).toBe('/api/v1/users');
      });

      it('should remove double slashes', () => {
        expect(normalizePath('//users')).toBe('/users');
        expect(normalizePath('/api//v1///users')).toBe('/api/v1/users');
        expect(normalizePath('///multiple//slashes///')).toBe('/multiple/slashes');
      });

      it('should handle root path correctly', () => {
        expect(normalizePath('/')).toBe('/');
        expect(normalizePath('//')).toBe('/');
        expect(normalizePath('///')).toBe('/');
      });
    });

    describe('Trailing slash handling', () => {
      it('should remove trailing slashes for consistency', () => {
        expect(normalizePath('/users/')).toBe('/users');
        expect(normalizePath('/api/v1/users/')).toBe('/api/v1/users');
        expect(normalizePath('/users///')).toBe('/users');
      });

      it('should preserve root path with single slash', () => {
        expect(normalizePath('/')).toBe('/');
      });
    });

    describe('Query parameter handling', () => {
      it('should strip query parameters', () => {
        expect(normalizePath('/users?page=1')).toBe('/users');
        expect(normalizePath('/users?page=1&limit=10')).toBe('/users');
        expect(normalizePath('/search?q=hello+world&sort=date')).toBe('/search');
      });

      it('should handle empty query parameters', () => {
        expect(normalizePath('/users?')).toBe('/users');
        expect(normalizePath('/users?=')).toBe('/users');
      });
    });

    describe('Fragment handling', () => {
      it('should strip fragment identifiers', () => {
        expect(normalizePath('/users#section1')).toBe('/users');
        expect(normalizePath('/docs#introduction')).toBe('/docs');
      });

      it('should handle query params and fragments together', () => {
        expect(normalizePath('/users?page=1#section1')).toBe('/users');
        expect(normalizePath('/search?q=test#results')).toBe('/search');
      });
    });

    describe('URL decoding', () => {
      it('should decode URL-encoded characters', () => {
        expect(normalizePath('/users%20profile')).toBe('/users profile');
        expect(normalizePath('/search%2Bquery')).toBe('/search+query');
        expect(normalizePath('/path%2Fwith%2Fslashes')).toBe('/path/with/slashes');
      });

      it('should handle malformed URL encoding gracefully', () => {
        // Should not crash on invalid encoding
        expect(() => normalizePath('/users%')).not.toThrow();
        expect(() => normalizePath('/users%ZZ')).not.toThrow();
      });
    });

    describe('Dot segment resolution (Security)', () => {
      it('should resolve current directory segments', () => {
        expect(normalizePath('/users/./profile')).toBe('/users/profile');
        expect(normalizePath('/api/./v1/./users')).toBe('/api/v1/users');
        expect(normalizePath('/./users')).toBe('/users');
      });

      it('should resolve parent directory segments', () => {
        expect(normalizePath('/users/../admin')).toBe('/admin');
        expect(normalizePath('/api/v1/../v2/users')).toBe('/api/v2/users');
        expect(normalizePath('/a/b/c/../../d')).toBe('/a/d');
      });

      it('should prevent traversal above root', () => {
        expect(normalizePath('/../secret')).toBe('/secret');
        expect(normalizePath('/../../etc/passwd')).toBe('/etc/passwd');
        expect(normalizePath('/../../../admin')).toBe('/admin');
      });

      it('should handle complex dot segment combinations', () => {
        expect(normalizePath('/a/b/../c/./d/../e')).toBe('/a/c/e');
        expect(normalizePath('/users/../admin/./settings/../profile')).toBe('/admin/profile');
      });

      it('should handle edge cases', () => {
        expect(normalizePath('/.')).toBe('/');
        expect(normalizePath('/..')).toBe('/');
        expect(normalizePath('/./.')).toBe('/');
        expect(normalizePath('/../..')).toBe('/');
      });
    });

    describe('Combined normalization', () => {
      it('should handle all normalizations together', () => {
        expect(normalizePath('//users/../admin/.//profile/?page=1#section')).toBe('/admin/profile');
        expect(normalizePath('users%20profile/../settings/?sort=name')).toBe('/settings');
        expect(normalizePath('//api/./v1/../v2///users//?limit=10')).toBe('/api/v2/users');
      });
    });

    describe('Empty and edge cases', () => {
      it('should handle empty and invalid inputs', () => {
        expect(normalizePath('')).toBe('');
        expect(normalizePath('?')).toBe('');
        expect(normalizePath('#')).toBe('');
        expect(normalizePath('?#')).toBe('');
      });
    });
  });

  describe('normalizeRouteStructure', () => {
    it('should normalize parameter names to generic :param', () => {
      expect(normalizeRouteStructure('/users/:id')).toBe('/users/:param');
      expect(normalizeRouteStructure('/users/:userId')).toBe('/users/:param');
      expect(normalizeRouteStructure('/api/:version/users/:id')).toBe('/api/:param/users/:param');
    });

    it('should handle routes without parameters', () => {
      expect(normalizeRouteStructure('/users')).toBe('/users');
      expect(normalizeRouteStructure('/api/v1/users')).toBe('/api/v1/users');
    });

    it('should handle mixed routes', () => {
      expect(normalizeRouteStructure('/api/v1/users/:id/posts/:postId')).toBe('/api/v1/users/:param/posts/:param');
    });
  });
});
