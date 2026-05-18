(function() {
  'use strict';

  var THEME_KEY = 'aero-theme';
  var html = document.documentElement;

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch(e) {}
    updateButton(theme === 'dark' ? 'light' : 'dark');
  }

  function updateButton(opposite) {
    var icon = document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.className = opposite === 'dark' ? 'ri-moon-line theme-icon' : 'ri-sun-line theme-icon';
    }
  }

  function toggleTheme() {
    var current = html.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch(e) {}
    var theme = saved || 'dark';
    setTheme(theme);

    var btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        toggleTheme();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:success', function() {
    var current = html.getAttribute('data-theme') || 'dark';
    updateButton(current === 'dark' ? 'light' : 'dark');
    var btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        toggleTheme();
      });
    }
  });
})();
