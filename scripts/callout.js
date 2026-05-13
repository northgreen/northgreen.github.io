'use strict';

// 将 Obsidian 风格的 > [!type] callout 转换为 markdown-it-container 的 ::: 语法
// 同时注册自定义 markdown-it-container 渲染器

const CALLOUT_OPEN = /^(\s*)> \[!(\w+)\]\s*(.*)$/;  // > [!note] title
const CALLOUT_LINE = /^(\s*)>\s(.+)$/;              // > content

function transformCalloutSyntax(data) {
  // 提前退出：没有 Hexo 上下文或空内容
  if (!this || !this.locals || !data || !data.content) {
    return data;
  }

  const lines = data.content.split('\n');
  const result = [];
  let inCallout = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = line.match(CALLOUT_OPEN);
    const contMatch = line.match(CALLOUT_LINE);

    if (openMatch) {
      // 关闭之前的 callout（如果仍处于打开状态）
      if (inCallout) {
        result.push(':::');
        inCallout = false;
      }

      // 开始新的 callout：> [!type] title => ::: type title
      const type = openMatch[2].toLowerCase();
      const title = openMatch[3].trim();
      result.push('::: ' + type + (title ? ' ' + title : ''));
      inCallout = true;
    } else if (inCallout && contMatch) {
      // callout 延续行：> content => content
      result.push(contMatch[1] + contMatch[2]); // 缩进 + 实际内容
    } else {
      // 结束 callout
      if (inCallout) {
        result.push(':::');
        inCallout = false;
      }
      result.push(line);
    }
  }

  // 关闭任何剩余的打开 callout
  if (inCallout) {
    result.push(':::');
  }

  data.content = result.join('\n');
  return data;
}

// 注册自定义容器渲染器
function registerCalloutContainers(md) {
  const types = [
    'note', 'tip', 'warning', 'danger', 'info',
    'question', 'example', 'quote', 'todo',
    'important', 'summary', 'abstract'
  ];

  const iconMap = {
    note: 'ri-information-line',
    tip: 'ri-lightbulb-line',
    warning: 'ri-alert-line',
    danger: 'ri-error-warning-line',
    info: 'ri-information-line',
    question: 'ri-question-line',
    example: 'ri-flask-line',
    quote: 'ri-double-quotes-l',
    todo: 'ri-checkbox-circle-line',
    important: 'ri-star-line',
    summary: 'ri-file-list-3-line',
    abstract: 'ri-file-list-2-line'
  };

  types.forEach(function(type) {
    md.use(require('markdown-it-container'), type, {
      validate: function(params) {
        return params.trim().match(new RegExp('^' + type + '\\s*(.*)$', 'i'));
      },
      render: function(tokens, idx, _options, env, slf) {
        const info = tokens[idx].info.trim();
        const title = info.slice(type.length).trim() ||
          type.charAt(0).toUpperCase() + type.slice(1);

        if (tokens[idx].nesting === 1) {
          // 开标签
          return '<div class="callout callout-' + type + '">\n' +
            '<div class="callout-title">\n' +
            '<i class="' + iconMap[type] + '"></i>\n' +
            md.utils.escapeHtml(title) + '\n' +
            '</div>\n' +
            '<div class="callout-content">\n';
        }
        // 闭标签
        return '</div>\n</div>\n';
      }
    });
  });
}

// 注册 before_post_render filter 将 > [!type] 转换为 ::: type
hexo.extend.filter.register('before_post_render', transformCalloutSyntax);

// 注册 markdown-it:renderer filter 添加自定义容器渲染
hexo.extend.filter.register('markdown-it:renderer', registerCalloutContainers);
