'use strict';

function graphBuilderFilter() {
  const posts = this.locals.get('posts') || [];
  const pages = this.locals.get('pages') || [];

  // 构建 slug → doc 的映射，用于解析链接目标
  const slugMap = new Map();
  const allDocs = [...posts.toArray(), ...pages.toArray()];
  
  allDocs.forEach(doc => {
    const slug = (doc.slug || '').replace(/^\/+|\/+$/g, '');
    if (slug) {
      slugMap.set(slug, doc);
      slugMap.set('/' + slug + '/', doc);   // /slug/
      slugMap.set('/' + slug, doc);         // /slug (no trailing)
      slugMap.set(slug + '/', doc);         // slug/
    }
    
    // 按 permalink 路径映射（去掉域名部分）
    const permalink = doc.permalink || '';
    if (permalink) {
      // 尝试解析 URL 提取路径部分
      let permalinkPath;
      try {
        const urlObj = new URL(permalink);
        permalinkPath = urlObj.pathname;
      } catch (_) {
        permalinkPath = permalink;
      }
      const cleanPath = permalinkPath.replace(/\/+$/, '') + '/';
      slugMap.set(cleanPath, doc);
      slugMap.set(cleanPath.replace(/^\//, ''), doc);
    }
    
    // 也按 source 文件名映射
    const source = doc.source || '';
    const filename = source.replace(/\.\w+$/, '').replace(/^source\//, '').toLowerCase();
    if (filename) {
      slugMap.set(filename, doc);
      slugMap.set('/' + filename + '/', doc);
    }
  });

  // 构建内容索引
  const index = allDocs.map(doc => {
    const content = doc.content || '';
    const links = new Set();
    const tags = doc.tags ? (Array.isArray(doc.tags) ? doc.tags.map(t => t.name || t) : []) : [];
    
    // 解析 content 中的内部链接
    // 匹配 <a href="/path/"> 和 <a href="/path">
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"/gi;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[1];
      // 只取本站内部链接（以 / 开头，不包含 ://，不是纯锚点）
      if (href.startsWith('/') && !href.includes('://') && href !== '/') {
        // 去掉可能存在的 .html 后缀和 trailing slash
        let clean = href.replace(/\.html$/, '').replace(/\/+$/, '') + '/';
        // 跳过不是其他 post/page 的链接
        const targetDoc = slugMap.get(clean) || slugMap.get(href);
        if (targetDoc && targetDoc.slug !== doc.slug) {
          links.add(clean);
        }
      }
    }
    
    // 也解析 plain markdown 链接模式 [text](path) - 可能 Wikilink filter 没处理到
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = mdLinkRegex.exec(content)) !== null) {
      const href = match[2];
      if (href.startsWith('/') && !href.includes('://') && href !== '/') {
        let clean = href.replace(/\.html$/, '').replace(/\/+$/, '') + '/';
        const targetDoc = slugMap.get(clean) || slugMap.get(href);
        if (targetDoc && targetDoc.slug !== doc.slug) {
          links.add(clean);
        }
      }
    }
    
    // 构造 slug 用于 ID - 去掉前导/尾部斜杠，确保 id = "slug/"
    let slug = (doc.slug || '').replace(/^\/+|\/+$/g, '');
    if (!slug || slug === '/') {
      const source = doc.source || '';
      const filename = source.replace(/\.\w+$/, '').replace(/^source\//, '').toLowerCase();
      if (filename) slug = filename;
    }
    const id = slug ? slug + '/' : '/';
    
    return {
      id: id,
      title: doc.title || slug,
      slug: id,
      path: doc.permalink || '/' + id,
      tags: tags,
      links: [...links]
    };
  });

  // 写入 public/contentIndex.json
  const fs = require('fs');
  const path = require('path');
  const outputDir = this.public_dir || 'public';
  const outputPath = path.join(outputDir, 'contentIndex.json');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
  
  console.log(`[graph-builder] 生成了 ${index.length} 个节点的 contentIndex.json`);
}

hexo.extend.filter.register('after_generate', graphBuilderFilter);
