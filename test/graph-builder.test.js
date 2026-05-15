import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 屏蔽 console.log 避免测试输出噪音
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('graph-builder', () => {
  let tempDir;
  let registeredFilter;
  let mockPosts;
  let mockPages;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-test-'));

    // 清除模块缓存，确保每次加载干净的副本
    delete require.cache[
      require.resolve(path.resolve(__dirname, '../scripts/graph-builder'))
    ];

    registeredFilter = null;

    // 设置全局 hexo mock，graph-builder.js 依赖它注册 filter
    global.hexo = {
      extend: {
        filter: {
          register: (name, fn) => {
            if (name === 'after_generate') {
              registeredFilter = fn;
            }
          },
        },
      },
    };

    mockPosts = { toArray: () => [] };
    mockPages = { toArray: () => [] };
  });

  afterEach(() => {
    delete global.hexo;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * 创建模拟文档对象
   */
  function createMockDoc(overrides = {}) {
    return {
      slug: 'test-page',
      title: 'Test Page',
      source: 'source/_posts/test-page.md',
      content: '<p>Hello</p>',
      permalink: 'http://localhost:4000/2026/05/12/test-page/',
      tags: [],
      ...overrides,
    };
  }

  /**
   * 加载 graph-builder 模块并以指定文档列表运行 filter
   * @param {Array} posts  文档列表
   * @param {Array} pages  页面列表
   * @returns {Array} 解析后的 contentIndex.json 数组
   */
  function runWithContext(posts = [], pages = []) {
    require(path.resolve(__dirname, '../scripts/graph-builder'));

    if (!registeredFilter) {
      throw new Error('graph-builder filter 未注册');
    }

    mockPosts.toArray = () => posts;
    mockPages.toArray = () => pages;

    const ctx = {
      locals: {
        get: (key) => {
          if (key === 'posts') return mockPosts;
          if (key === 'pages') return mockPages;
          return { toArray: () => [] };
        },
      },
      public_dir: tempDir,
    };

    registeredFilter.call(ctx);

    const outputPath = path.join(tempDir, 'contentIndex.json');
    return fs.existsSync(outputPath)
      ? JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
      : [];
  }

  // ==============================================================
  // 测试点 1: 节点 ID 应带尾部斜杠
  // ==============================================================
  describe('节点 ID 应带尾部斜杠', () => {
    it('slug 不带斜杠时，id 应被添加尾部斜杠', () => {
      const nodes = runWithContext([
        createMockDoc({ slug: 'hello-world', title: 'Hello' }),
      ]);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('hello-world/');
    });

    it('slug 已有尾部斜杠时，id 应保持一个尾部斜杠', () => {
      const nodes = runWithContext([
        createMockDoc({ slug: 'hello-world/', title: 'Hello' }),
      ]);
      expect(nodes[0].id).toBe('hello-world/');
    });
  });

  // ==============================================================
  // 测试点 2: 正确解析 HTML 链接并生成 links
  // ==============================================================
  describe('正确解析 HTML 链接并生成 links', () => {
    it('应解析 <a href="/path/"> 链接（带尾部斜杠）', () => {
      const target = createMockDoc({
        slug: 'other-page',
        title: 'Other Page',
        permalink: 'http://localhost:4000/other-page/',
      });
      const source = createMockDoc({
        slug: 'hello-world',
        title: 'Hello World',
        content: '<p>查看 <a href="/other-page/">另一页</a></p>',
      });
      const nodes = runWithContext([source, target]);
      const n = nodes.find((x) => x.id === 'hello-world/');
      expect(n.links).toContain('other-page/');
    });

    it('应解析 <a href="/path"> 链接（无尾部斜杠）', () => {
      const target = createMockDoc({
        slug: 'other-page',
        title: 'Other Page',
        permalink: 'http://localhost:4000/other-page/',
      });
      const source = createMockDoc({
        slug: 'hello-world',
        title: 'Hello World',
        content: '<p>查看 <a href="/other-page">另一页</a></p>',
      });
      const nodes = runWithContext([source, target]);
      const n = nodes.find((x) => x.id === 'hello-world/');
      expect(n.links).toContain('other-page/');
    });

    it('应忽略外部链接（包含 ://）', () => {
      const source = createMockDoc({
        slug: 'hello-world',
        title: 'Hello World',
        content: '<p>查看 <a href="https://example.com">外部</a></p>',
      });
      const nodes = runWithContext([source]);
      const n = nodes.find((x) => x.id === 'hello-world/');
      expect(n.links).toHaveLength(0);
    });

    it('应忽略根路径链接 href="/"', () => {
      const source = createMockDoc({
        slug: 'hello-world',
        title: 'Hello World',
        content: '<p><a href="/">首页</a></p>',
      });
      const nodes = runWithContext([source]);
      const n = nodes.find((x) => x.id === 'hello-world/');
      expect(n.links).toHaveLength(0);
    });
  });

  // ==============================================================
  // 测试点 4: 正确处理 .html 页面（about）
  // ==============================================================
  describe('正确处理 .html 页面（about）', () => {
    it('应索引 .html 页面并通过完整路径链接解析', () => {
      const about = createMockDoc({
        slug: 'about/index.html',
        title: 'About',
        source: 'source/about/index.md',
        permalink: 'http://localhost:4000/about/index.html',
      });
      const post = createMockDoc({
        slug: 'hello-world',
        title: 'Hello World',
        content: '<p>查看 <a href="/about/index.html">关于</a></p>',
      });
      const nodes = runWithContext([post, about]);

      const postNode = nodes.find((x) => x.id === 'hello-world/');
      const aboutNode = nodes.find((x) => x.title === 'About');

      expect(aboutNode).toBeTruthy();
      expect(postNode.links).toHaveLength(1);
      expect(postNode.links[0]).toBe(aboutNode.id);
    });
  });

  // ==============================================================
  // 测试点 5: 过滤掉指向自身的链接
  // ==============================================================
  describe('过滤掉指向自身的链接', () => {
    it('HTML 链接指向自身时应被过滤', () => {
      const nodes = runWithContext([
        createMockDoc({
          slug: 'hello-world',
          title: 'Hello World',
          content: '<p><a href="/hello-world/">自身链接</a></p>',
        }),
      ]);
      const n = nodes.find((x) => x.id === 'hello-world/');
      expect(n.links).toHaveLength(0);
    });
  });

  // ==============================================================
  // 测试点 6: 处理空 slug 的页面（fallback 到 source 文件名）
  // ==============================================================
  describe('处理空 slug 的页面（fallback 到 source 文件名）', () => {
    it('slug 为空时应使用 source 文件名生成 id', () => {
      const nodes = runWithContext([
        createMockDoc({
          slug: '',
          title: 'No Slug',
          source: 'source/_posts/no-slug-post.md',
        }),
      ]);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('_posts/no-slug-post/');
    });

    it('slug 为 "/" 时应使用 source 文件名生成 id', () => {
      const nodes = runWithContext([
        createMockDoc({
          slug: '/',
          title: 'Root Slug',
          source: 'source/_posts/root-slug.md',
        }),
      ]);
      expect(nodes[0].id).toBe('_posts/root-slug/');
    });
  });

  // ==============================================================
  // 测试点 7: path 字段应为完整 URL
  // ==============================================================
  describe('path 字段应为完整 URL', () => {
    it('path 应使用文档的 permalink', () => {
      const nodes = runWithContext([
        createMockDoc({
          slug: 'hello-world',
          permalink: 'http://localhost:4000/2026/hello-world/',
        }),
      ]);
      expect(nodes[0].path).toBe('http://localhost:4000/2026/hello-world/');
    });

    it('无 permalink 时 path 应回退为 "/id"', () => {
      const nodes = runWithContext([
        createMockDoc({
          slug: 'hello-world',
          permalink: '',
        }),
      ]);
      expect(nodes[0].path).toBe('/hello-world/');
    });
  });

  // ==============================================================
  // 数据完整性校验
  // ==============================================================
  describe('数据完整性', () => {
    it('所有节点应包含 expected 字段', () => {
      const nodes = runWithContext([
        createMockDoc({
          slug: 'hello-world',
          title: 'Hello',
          tags: [{ name: 'tech' }, { name: 'blog' }],
        }),
      ]);

      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes).toHaveLength(1);

      const node = nodes[0];
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('title');
      expect(node).toHaveProperty('slug');
      expect(node).toHaveProperty('path');
      expect(node).toHaveProperty('tags');
      expect(node).toHaveProperty('links');
      expect(node.tags).toEqual(['tech', 'blog']);
    });

    it('tags 字段处理标签对象数组', () => {
      const nodes = runWithContext([
        createMockDoc({
          tags: ['plain-tag', { name: 'named-tag' }],
        }),
      ]);
      expect(nodes[0].tags).toEqual(['plain-tag', 'named-tag']);
    });

    it('单文档无链接时 links 应为空数组', () => {
      const nodes = runWithContext([
        createMockDoc({ content: '<p>纯文本无链接</p>' }),
      ]);
      expect(nodes[0].links).toEqual([]);
    });
  });
});
