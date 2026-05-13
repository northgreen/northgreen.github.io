'use strict';

// 匹配 [[Title]]、[[Title|Alias]]、[[Title#Heading]]、[[Title#Heading|Alias]]
const WIKILINK_REGEX = /\[\[([^\[\]\|\#]+?)(?:#([^\[\]\|]*?))?(?:\|([^\[\]]*?))?\]\]/g;

// 匹配 ![[Page]]、![[Page#Heading]]、![[Page|Alias]]、![[Page#Heading|Alias]]
// 不支持 ![[Page.pdf]] 或 ![[Page.md]] — 这些是图片或 markdown 嵌入
const EMBED_REGEX = /!\[\[([^\[\]\|\#]+?)(?:#([^\[\]\|]*?))?(?:\|([^\[\]]*?))?\]\]/g;

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

  // 先处理 Embed (![[...]])，再处理 Wikilink ([[...]])
  // 这样 Embed 内的 [[...]] 不会被 wikilink 重复处理

  // 处理 Embed
  data.content = data.content.replace(EMBED_REGEX, (match, title, heading, alias) => {
    const key = title.trim().toLowerCase();
    const doc = lookup.get(key);

    if (!doc) {
      return '<span class="embed-broken" data-embed="' + title.trim() + '">![' + title.trim() + ']</span>';
    }

    // 检查循环嵌入
    const embedChain = data.embedChain || [];
    if (embedChain.indexOf(doc.source) !== -1) {
      return '<span class="embed-error">检测到循环嵌入: ' + title.trim() + '</span>';
    }

    // 获取 source 文件路径
    const sourcePath = doc.full_source || doc.source;
    if (!sourcePath) {
      return '<span class="embed-error">无法读取嵌入内容: ' + title.trim() + '</span>';
    }

    // 对于图片文件
    const ext = (title.match(/\.(\w+)$/) || [])[1];
    if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].indexOf(ext.toLowerCase()) !== -1) {
      const imagePath = '/' + (doc.path || '');
      return '<img src="' + imagePath + '" alt="' + (alias || title).trim() + '" class="embed-image" />';
    }

    // 对于 markdown 页面，生成嵌入容器
    // 注意：在 before_post_render 阶段无法获取渲染后的内容
    // 所以输出一个带样式的引用容器
    const display = (alias || title).trim();
    const relPath = '/' + (doc.path || '').replace(/index\.html$/, '');

    // 如果指定了 heading，添加锚点链接
    const headingAnchor = heading ? '#' + heading : '';

    // 输出嵌入内容
    return '<div class="wikilink-embed">\n' +
      '<div class="wikilink-embed-header">\n' +
      '<a href="' + relPath + headingAnchor + '">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>' +
      ' ' + display + '</a>\n' +
      '</div>\n' +
      '<div class="wikilink-embed-body">\n' +
      '<p><a href="' + relPath + headingAnchor + '">查看 ' + display + '</a></p>\n' +
      '</div>\n' +
      '</div>';
  });

  // 处理 Wikilink
  data.content = data.content.replace(WIKILINK_REGEX, (match, title, heading, alias) => {
    const key = title.trim().toLowerCase();
    const doc = lookup.get(key);

    if (doc) {
      // 使用相对路径，确保 graph-builder 能正确解析
      const relPath = '/' + (doc.path || '').replace(/index\.html$/, '');
      const url = relPath !== '/' ? relPath : (doc.permalink || '/');
      const display = (alias || title).trim();
      const href = heading ? url + '#' + heading : url;
      return '[' + display + '](' + href + ')';
    }

    // 找不到匹配 → broken link，保留原文并加样式
    return '<span class="wikilink-broken" data-wikilink="' + title.trim() + '">[[' + title.trim() + ']]</span>';
  });

  return data;
}

hexo.extend.filter.register('before_post_render', wikilinkFilter);
