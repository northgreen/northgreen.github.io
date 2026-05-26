'use strict';

// mermaid 代码块的默认优先级（hexo 内置的 backtick_code_block 过滤器优先级为 10）
var MERMAID_FILTER_PRIORITY = 9;

// 匹配 ```mermaid 代码块
var rMermaidBlock = /^(`{3,})\s*mermaid\s*\n([\s\S]*?)\n\1\s*$/gm;

// 在 before_post_render 阶段将 ```mermaid 代码块替换为原始 HTML
// 在 backtick_code_block 过滤器（优先级 10）之前运行，绕过 highlight.js
function transformMermaidBlocks(data) {
  // 提前退出：没有内容或没有 mermaid 代码块
  if (!data || !data.content || !data.content.includes('```mermaid')) {
    return data;
  }

  data.content = data.content.replace(rMermaidBlock, function (match, ticks, content) {
    return '<div class="mermaid">\n' + content + '\n</div>\n';
  });

  return data;
}

// 注册 markdown-it:renderer 过滤器
// 重写 fence 规则，使 ```mermaid 代码块绕过 highlight.js
// 作为未通过 before_post_render 路径的情况下的安全网
function registerMermaidRenderer(md) {
  // 保存原始的 fence 渲染器
  var originalFence = md.renderer.rules.fence;

  md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
    var token = tokens[idx];
    var info = token.info ? token.info.trim() : '';
    var lang = info.split(/\s+/)[0];

    if (lang === 'mermaid') {
      // 直接输出 Mermaid 容器，绕过 highlight.js 处理
      return '<div class="mermaid">\n' + token.content + '\n</div>\n';
    }

    // 其他语言使用默认渲染器
    if (originalFence) {
      return originalFence(tokens, idx, options, env, slf);
    }
    return slf.renderToken(tokens, idx, options, env, slf);
  };
}

// 注册 before_post_render filter（优先级 9，在 backtick_code_block 的优先级 10 之前运行）
hexo.extend.filter.register('before_post_render', transformMermaidBlocks, MERMAID_FILTER_PRIORITY);

// 注册 markdown-it:renderer filter，作为后备方案
hexo.extend.filter.register('markdown-it:renderer', registerMermaidRenderer);
