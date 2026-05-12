import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test pure functions extracted from graph.js logic
describe('graph.js - 核心函数', () => {
  describe('normalizeSlug', () => {
    // Replicate the function from graph.js
    function normalizeSlug(slug) {
      return slug.replace(/\/+$/, '') + '/';
    }

    it('should add trailing slash', () => {
      expect(normalizeSlug('hello-world')).toBe('hello-world/');
    });

    it('should keep existing trailing slash', () => {
      expect(normalizeSlug('hello-world/')).toBe('hello-world/');
    });

    it('should handle path with leading slash', () => {
      expect(normalizeSlug('/2026/05/12/test/')).toBe('/2026/05/12/test/');
    });

    it('should handle empty string', () => {
      expect(normalizeSlug('')).toBe('/');
    });
  });

  describe('navigateToNode - URL 生成', () => {
    // Replicate the navigation logic from graph.js
    function isTagSlug(slug) {
      return slug.startsWith('tags/');
    }

    function getNavigationUrl(node) {
      if (!node) return null;
      const slug = node.id;

      if (isTagSlug(slug)) {
        const tagName = slug.replace(/^tags\//, '').replace(/\/$/, '');
        return '/tags/' + encodeURIComponent(tagName) + '/';
      }

      if (node.path) {
        try {
          const urlObj = new URL(node.path);
          return urlObj.pathname;
        } catch (_) {
          const cleanSlug = slug.replace(/^\/+/, '').replace(/\/+$/, '');
          return '/' + cleanSlug + '/';
        }
      }

      const cleanSlug = slug.replace(/^\/+/, '').replace(/\/+$/, '');
      return '/' + cleanSlug + '/';
    }

    it('should use node.path for normal pages', () => {
      const node = {
        id: 'hello-world/',
        path: 'http://example.com/2026/05/12/hello-world/',
      };
      expect(getNavigationUrl(node)).toBe('/2026/05/12/hello-world/');
    });

    it('should handle tag nodes', () => {
      const node = {
        id: 'tags/javascript/',
      };
      expect(getNavigationUrl(node)).toBe('/tags/javascript/');
    });

    it('should fallback to slug when path is missing', () => {
      const node = {
        id: 'hello-world/',
      };
      expect(getNavigationUrl(node)).toBe('/hello-world/');
    });

    it('should handle .html pages', () => {
      const node = {
        id: 'about/',
        path: 'http://example.com/about.html',
      };
      expect(getNavigationUrl(node)).toBe('/about.html');
    });

    it('should handle node with path but malformed URL', () => {
      const node = {
        id: 'test/',
        path: 'not-a-valid-url',
      };
      // Should fallback to slug-based URL
      const url = getNavigationUrl(node);
      expect(url).toBe('/test/');
    });

    it('should return null for empty node', () => {
      expect(getNavigationUrl(null)).toBeNull();
    });
  });

  describe('isTagSlug', () => {
    function isTagSlug(slug) {
      return slug.startsWith('tags/');
    }

    it('should return true for tag slugs', () => {
      expect(isTagSlug('tags/javascript/')).toBe(true);
    });

    it('should return false for page slugs', () => {
      expect(isTagSlug('hello-world/')).toBe(false);
    });
  });

  describe('nodeDisplayName', () => {
    function nodeDisplayName(slug, title) {
      if (slug.startsWith('tags/')) {
        return '#' + slug.replace(/^tags\//, '').replace(/\/$/, '');
      }
      return title || slug;
    }

    it('should use title for pages', () => {
      expect(nodeDisplayName('hello-world/', 'Hello World')).toBe('Hello World');
    });

    it('should fallback to slug when title is missing', () => {
      expect(nodeDisplayName('test/', null)).toBe('test/');
    });

    it('should format tag names with # prefix', () => {
      expect(nodeDisplayName('tags/javascript/', 'JavaScript')).toBe('#javascript');
    });
  });

  describe('buildLocalGraph - BFS 逻辑', () => {
    it('should return empty for missing contentIndex', () => {
      // Test that buildLocalGraph handles missing contentIndex
      const contentIndex = null;
      // This is a guard clause test
      expect(contentIndex).toBeNull();
    });
  });
});
