import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';

describe('导航链接集成测试', () => {
  const contentIndexPath = path.resolve(__dirname, '..', 'public', 'contentIndex.json');
  let nodes;

  beforeAll(() => {
    if (!fs.existsSync(contentIndexPath)) {
      throw new Error('contentIndex.json not found. Run "hexo generate" first.');
    }
    const content = fs.readFileSync(contentIndexPath, 'utf-8');
    nodes = JSON.parse(content);
  });

  it('contentIndex.json 应该是有效数组', () => {
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('每个节点应有必要字段', () => {
    for (const node of nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('title');
      expect(node).toHaveProperty('slug');
      expect(node).toHaveProperty('path');
      expect(node).toHaveProperty('links');
    }
  });

  it('每个节点 ID 应以 / 结尾', () => {
    for (const node of nodes) {
      expect(typeof node.id).toBe('string');
      expect(node.id.endsWith('/')).toBe(true);
    }
  });

  it('每个节点的 path 应为有效 URL', () => {
    for (const node of nodes) {
      expect(() => {
        const urlObj = new URL(node.path);
        expect(urlObj.pathname).toBeTruthy();
      }).not.toThrow();
    }
  });

  it('所有链接应指向存在的节点', () => {
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const node of nodes) {
      for (const link of node.links) {
        expect(nodeIds.has(link)).toBe(true);
      }
    }
  });

  it('不应有空值或 null 链接', () => {
    for (const node of nodes) {
      for (const link of node.links) {
        expect(link).not.toBeNull();
        expect(link).not.toBeUndefined();
        expect(typeof link).toBe('string');
      }
    }
  });

  it('导航 URL 应正确（从 path 字段提取 pathname）', () => {
    for (const node of nodes) {
      const urlObj = new URL(node.path);
      const pathname = urlObj.pathname;
      // Pathname should start with /
      expect(pathname.startsWith('/')).toBe(true);
      // Should not be empty
      expect(pathname.length).toBeGreaterThan(1);
    }
  });
});
