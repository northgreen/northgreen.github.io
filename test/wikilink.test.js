import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

describe('wikilink.js - Wikilink 解析器', () => {
  let registeredFilters;
  let mockPosts;
  let mockPages;
  let mockHexo;

  beforeEach(() => {
    // 清除模块缓存，确保每次加载全新的 wikilink.js
    delete require.cache[
      require.resolve(path.resolve(__dirname, '../scripts/wikilink'))
    ];

    registeredFilters = {};

    mockPosts = [
      {
        title: 'Hello World',
        source: 'source/_posts/hello-world.md',
        slug: 'hello-world',
        path: '2026/05/12/hello-world/',
        permalink: 'http://localhost:4000/2026/05/12/hello-world/',
      },
      {
        title: 'test',
        source: 'source/_posts/qwq/test.md',
        slug: 'qwq/test',
        path: '2026/05/12/qwq/test/',
        permalink: 'http://localhost:4000/2026/05/12/qwq/test/',
      },
    ];

    mockPages = [
      {
        title: 'About',
        source: 'source/about.md',
        slug: 'about',
        path: 'about.html',
        permalink: 'http://localhost:4000/about.html',
      },
    ];

    // 设置全局 hexo mock
    // wikilink.js 通过 hexo.extend.filter.register('before_post_render', fn) 注册
    // filter 内部通过 this.locals.get('posts'|'pages') 获取文档
    mockHexo = {
      extend: {
        filter: {
          register: (name, fn) => {
            if (!registeredFilters[name]) registeredFilters[name] = [];
            registeredFilters[name].push(fn);
          },
          get: (name) => registeredFilters[name] || [],
        },
      },
      locals: {
        get: (key) => {
          if (key === 'posts') return { toArray: () => mockPosts };
          if (key === 'pages') return { toArray: () => mockPages };
          return { toArray: () => [] };
        },
      },
    };

    global.hexo = mockHexo;
    require(path.resolve(__dirname, '../scripts/wikilink'));
  });

  afterEach(() => {
    delete global.hexo;
  });

  function processWikilink(content) {
    const filters = global.hexo.extend.filter.get('before_post_render');
    const filterFn = filters[filters.length - 1];
    return filterFn.call(mockHexo, { content });
  }

  // ==============================================================
  // 测试点 1: [[Title]] → [Title](/path/to/title/)
  // ==============================================================
  it('should convert [[Title]] to Markdown link', () => {
    const result = processWikilink('查看 [[test]] 页面');
    expect(result.content).toContain('[test](');
    expect(result.content).toContain('/2026/05/12/qwq/test/');
    expect(result.content).not.toContain('[[');
  });

  // ==============================================================
  // 测试点 2: [[Title|Alias]] → [Alias](/path/to/title/)
  // ==============================================================
  it('should convert [[Title|Alias]] with custom display text', () => {
    const result = processWikilink('查看 [[Hello World|欢迎]]');
    expect(result.content).toContain('[欢迎](');
    expect(result.content).toContain('/2026/05/12/hello-world/');
  });

  // ==============================================================
  // 测试点 3: [[Title#Heading]] → [Title](/path/to/title/#heading)
  // ==============================================================
  it('should convert [[Title#Heading]] with anchor', () => {
    const result = processWikilink('查看 [[test#安装指南]]');
    expect(result.content).toContain('/2026/05/12/qwq/test/#%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97');
  });

  // ==============================================================
  // 测试点 4: [[Title#Heading|Alias]] → [Alias](/path/to/title/#heading)
  // ==============================================================
  it('should convert [[Title#Heading|Alias]] with both anchor and alias', () => {
    const result = processWikilink('查看 [[Hello World#简介|欢迎页面]]');
    expect(result.content).toContain(
      '[欢迎页面](/2026/05/12/hello-world/#%E7%AE%80%E4%BB%8B)'
    );
  });

  // ==============================================================
  // 测试点 5: 找不到 → <span class="wikilink-broken">[[原文]]</span>
  // ==============================================================
  it('should render broken wikilink for non-existent title', () => {
    const result = processWikilink('查看 [[不存在的页面]]');
    expect(result.content).toContain('wikilink-broken');
    expect(result.content).toContain('[[不存在的页面]]');
    expect(result.content).not.toContain(']:');
  });

  // ==============================================================
  // 测试点 6: 大小写不敏感匹配
  // ==============================================================
  it('should match title case-insensitively', () => {
    const result = processWikilink('查看 [[HELLO WORLD]]');
    expect(result.content).toContain('/2026/05/12/hello-world/');
  });

  // ==============================================================
  // 测试点 7: 多个 wikilink 在一行
  // ==============================================================
  it('should handle multiple wikilinks in one line', () => {
    const result = processWikilink('阅读 [[Hello World]] 和 [[test]]');
    expect(result.content).toContain('/2026/05/12/hello-world/');
    expect(result.content).toContain('/2026/05/12/qwq/test/');
  });

  // ==============================================================
  // 测试点 8: 没有 wikilink 的内容保持不变
  // ==============================================================
  it('should leave content without wikilinks unchanged', () => {
    const result = processWikilink('普通文本没有链接');
    expect(result.content).toBe('普通文本没有链接');
  });

  // ==============================================================
  // 测试点 9: 空内容直接返回 data 不变
  // ==============================================================
  it('should return data as-is when content is empty', () => {
    const result = processWikilink('');
    expect(result.content).toBe('');
  });

  it('should return data as-is when content is null/undefined', () => {
    const result = processWikilink(null);
    expect(result).toBeTruthy();
  });

  // ==============================================================
  // 测试点 10: ![[Page]] → embed card (非列表上下文)
  // ==============================================================
  it('should convert ![[About]] to embed card with wikilink-embed', () => {
    const result = processWikilink('![[About]]');
    expect(result.content).toContain('wikilink-embed');
    expect(result.content).toContain('/about.html');
    expect(result.content).not.toContain('[[');
  });

  // ==============================================================
  // 测试点 11: 列表中 ![[Page]] → inline link (embed-inline)
  // ==============================================================
  it('should render embed-inline for ![[About]] inside an unordered list item', () => {
    const result = processWikilink('- 嵌入页面：![[About]]');
    expect(result.content).toContain('embed-inline');
    expect(result.content).not.toContain('wikilink-embed');
    expect(result.content).toContain('/about.html');
  });

  it('should render embed-inline for ![[About]] inside an ordered list item', () => {
    const result = processWikilink('1. 嵌入页面：![[About]]');
    expect(result.content).toContain('embed-inline');
    expect(result.content).not.toContain('wikilink-embed');
  });

  // ==============================================================
  // 测试点 12: ![[不存在的页面]] → embed-broken
  // ==============================================================
  it('should render embed-broken for non-existent ![[Page]]', () => {
    const result = processWikilink('![[不存在的页面]]');
    expect(result.content).toContain('embed-broken');
    expect(result.content).toContain('![');
  });
});
