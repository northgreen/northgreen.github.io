'use strict';

function initMermaid() {
  if (typeof mermaid !== 'undefined') {
    var blocks = document.querySelectorAll('.mermaid');
    if (blocks.length > 0) {
      // 初始化配置
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#ca9ee6',
          primaryTextColor: '#303446',
          primaryBorderColor: '#ca9ee6',
          lineColor: '#838ba7',
          secondaryColor: '#e8d5f5',
          tertiaryColor: '#f5f0fa'
        }
      });
      // 渲染所有 mermaid 块
      mermaid.run({
        querySelector: '.mermaid',
      });
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initMermaid);

// PJAX 导航后重新初始化
document.addEventListener('pjax:success', function() {
  setTimeout(initMermaid, 100);
});
