'use strict';

function initMermaid() {
  if (typeof mermaid !== 'undefined') {
    var blocks = document.querySelectorAll('.mermaid');
    if (blocks.length > 0) {
      mermaid.run({
        querySelector: '.mermaid',
      });
    }
  }
}

// 初始化配置（只调用一次）
function setupMermaid() {
  if (typeof mermaid !== 'undefined') {
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
  }
}

// 页面加载完成后设置配置并渲染
document.addEventListener('DOMContentLoaded', function() {
  setupMermaid();
  initMermaid();
});

// PJAX 导航后重新渲染（不重复 initialize）
document.addEventListener('pjax:success', function() {
  setTimeout(initMermaid, 100);
});
