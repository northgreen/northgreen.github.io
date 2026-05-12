'use strict';

// 匹配 [[Title]]、[[Title|Alias]]、[[Title#Heading]]、[[Title#Heading|Alias]]
const WIKILINK_REGEX = /\[\[([^\[\]\|\#]+?)(?:#([^\[\]\|]*?))?(?:\|([^\[\]]*?))?\]\]/g;

function wikilinkFilter(data) {
  // Guard: 如果没有 Hexo 上下文或内容为空，直接返回
  if (!this || !this.locals || !data || !data.content) {
    return data;
  }

  const posts = this.locals.get('posts');
  const pages = this.locals.get('pages');

  // 构建查找映射：title / filename / slug → post/page
  const lookup = new Map();

  for (const doc of [...(posts ? posts.toArray() : []), ...(pages ? pages.toArray() : [])]) {
    // 按 title 映射（不区分大小写）
    if (doc.title) {
      lookup.set(doc.title.toLowerCase(), doc);
    }

    // 按文件名（不含扩展名）映射
    const source = doc.source || '';
    const filename = source.replace(/\.\w+$/, '').toLowerCase();
    if (filename) {
      // 只在未占用时设置，让 title 优先
      if (!lookup.has(filename)) {
        lookup.set(filename, doc);
      }
    }

    // 按 slug 映射
    const slug = (doc.slug || '').toLowerCase();
    if (slug) {
      if (!lookup.has(slug)) {
        lookup.set(slug, doc);
      }
    }
  }

  data.content = data.content.replace(WIKILINK_REGEX, (match, title, heading, alias) => {
    const key = title.trim().toLowerCase();
    const doc = lookup.get(key);

    if (doc) {
      // 使用相对路径，确保 graph-builder 能正确解析
      const relPath = '/' + (doc.path || '').replace(/index\.html$/, '');
      const url = relPath !== '/' ? relPath : (doc.permalink || '/');
      const display = (alias || title).trim();
      const href = heading ? `${url}#${heading}` : url;
      return `[${display}](${href})`;
    }

    // 找不到匹配 → broken link，保留原文并加样式
    return `<span class="wikilink-broken" data-wikilink="${title.trim()}">[[${title.trim()}]]</span>`;
  });

  return data;
}

hexo.extend.filter.register('before_post_render', wikilinkFilter);
