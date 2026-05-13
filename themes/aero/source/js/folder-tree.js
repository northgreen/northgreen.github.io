'use strict';

function initFolderTree() {
  var toggles = document.querySelectorAll('.folder-toggle.has-children');
  toggles.forEach(function(toggle) {
    // 移除旧监听器，避免 PJAX 重复绑定
    toggle.removeEventListener('click', toggleClickHandler);
    toggle.addEventListener('click', toggleClickHandler);
  });
}

function toggleClickHandler(e) {
  var toggle = e.currentTarget;
  var node = toggle.closest('.folder-node');
  if (!node) return;

  var children = node.querySelector('.folder-children');
  var arrow = toggle.querySelector('.folder-arrow');
  if (!children) return;

  var isExpanded = children.classList.contains('expanded');

  if (isExpanded) {
    children.classList.remove('expanded');
    children.classList.add('collapsed');
    if (arrow) arrow.textContent = '▸';
  } else {
    children.classList.remove('collapsed');
    children.classList.add('expanded');
    if (arrow) arrow.textContent = '▾';
  }
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', initFolderTree);

// PJAX 导航后重新初始化
document.addEventListener('pjax:success', function() {
  setTimeout(initFolderTree, 50);
});
