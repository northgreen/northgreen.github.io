(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────
  let searchIndex = null;
  let contentData = [];
  let currentResults = [];
  let selectedIndex = -1;
  let currentQuery = '';
  let isSearchOpen = false;
  const NUM_RESULTS = 8;

  // ─── DOM refs ───────────────────────────────────────
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');
  const triggerBtn = document.getElementById('search-trigger-btn');
  const closeBtn = document.getElementById('search-close');

  // ─── CJK Tokenizer for FlexSearch ───────────────────
  function cjkEncoder(str) {
    const tokens = [];
    let buffer = '';
    for (const char of str) {
      const code = char.codePointAt(0);
      const isCJK =
        (code >= 0x3040 && code <= 0x309f) ||
        (code >= 0x30a0 && code <= 0x30ff) ||
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0xac00 && code <= 0xd7af) ||
        (code >= 0x20000 && code <= 0x2a6df);
      if (isCJK) {
        if (buffer) { tokens.push(buffer); buffer = ''; }
        tokens.push(char);
      } else if (/\s/.test(char)) {
        if (buffer) { tokens.push(buffer); buffer = ''; }
      } else {
        buffer += char;
      }
    }
    if (buffer) tokens.push(buffer);
    return tokens;
  }

  // ─── Text highlight ─────────────────────────────────
  function highlightText(text, term) {
    if (!term || !text) return text || '';
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escaped + ')', 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  function getContentExcerpt(content, term, maxLen) {
    if (maxLen === undefined) maxLen = 200;
    if (!content) return '';
    const lowerContent = content.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const termIndex = lowerContent.indexOf(lowerTerm);

    if (termIndex >= 0) {
      var start = Math.max(0, termIndex - 80);
      var end = Math.min(content.length, termIndex + term.length + 120);
      var excerpt = content.slice(start, end);
      if (start > 0) excerpt = '...' + excerpt;
      if (end < content.length) excerpt = excerpt + '...';
      return highlightText(excerpt, term);
    }

    return content.slice(0, maxLen) + (content.length > maxLen ? '...' : '');
  }

  // ─── FlexSearch init ────────────────────────────────
  async function initSearch() {
    try {
      var response = await fetch('/contentIndex.json');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      contentData = await response.json();
      if (!contentData || !contentData.length) {
        resultsContainer.innerHTML = '<div class="search-empty">暂无搜索数据</div>';
        return;
      }

      searchIndex = new FlexSearch.Document({
        encode: cjkEncoder,
        document: {
          id: 'id',
          tag: 'tags',
          index: [
            { field: 'title', tokenize: 'forward' },
            { field: 'content', tokenize: 'forward' },
            { field: 'tags', tokenize: 'forward' }
          ]
        }
      });

      for (var i = 0; i < contentData.length; i++) {
        searchIndex.add(contentData[i]);
      }
    } catch (err) {
      console.error('Search init failed:', err);
      resultsContainer.innerHTML = '<div class="search-empty">搜索索引加载失败，请刷新页面</div>';
    }
  }

  // ─── Search handler ─────────────────────────────────
  async function onInput(e) {
    var query = e.target.value.trim();
    currentQuery = query;
    selectedIndex = -1;

    if (!query || !searchIndex) {
      resultsContainer.innerHTML = '<div class="search-empty">输入关键词开始搜索</div>';
      window.dispatchEvent(new CustomEvent('search:clear'));
      return;
    }

    var isTagSearch = query.startsWith('#');
    var searchTerm = isTagSearch ? query.slice(1).trim() : query;

    if (!searchTerm) {
      resultsContainer.innerHTML = '<div class="search-empty">输入关键词开始搜索</div>';
      window.dispatchEvent(new CustomEvent('search:clear'));
      return;
    }

    try {
      var results;
      if (isTagSearch) {
        results = await searchIndex.searchAsync(searchTerm, {
          limit: NUM_RESULTS,
          index: ['tags', 'title', 'content']
        });
      } else {
        results = await searchIndex.searchAsync(searchTerm, {
          limit: NUM_RESULTS,
          index: ['title', 'content']
        });
      }

      // Deduplicate results by id, title fields first
      var idSet = {};
      var merged = [];
      // Title results first
      for (var fi = 0; fi < results.length; fi++) {
        var fieldResult = results[fi];
        if (fieldResult && fieldResult.result) {
          for (var ri = 0; ri < fieldResult.result.length; ri++) {
            var id = fieldResult.result[ri];
            if (!idSet[id]) {
              idSet[id] = true;
              merged.push({ id: id });
            }
          }
        }
      }

      currentResults = merged;
      displayResults(merged, searchTerm);

      if (merged.length === 0) {
        window.dispatchEvent(new CustomEvent('search:clear'));
      }
    } catch (err) {
      console.error('Search failed:', err);
      resultsContainer.innerHTML = '<div class="search-empty">搜索出错，请重试</div>';
    }
  }

  function displayResults(results, term) {
    if (!results.length) {
      resultsContainer.innerHTML = '<div class="search-empty">未找到相关结果</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      var item = null;
      for (var j = 0; j < contentData.length; j++) {
        if (contentData[j].id === result.id) {
          item = contentData[j];
          break;
        }
      }
      if (!item) continue;

      var title = highlightText(item.title, term);
      var excerpt = getContentExcerpt(item.content, term);
      html += '<a class="result-card' + (i === selectedIndex ? ' selected' : '') + '" data-index="' + i + '" data-slug="' + item.slug + '" href="' + item.path + '">' +
        '<h3 class="result-title">' + title + '</h3>' +
        '<p class="result-excerpt">' + excerpt + '</p>' +
        '</a>';
    }

    resultsContainer.innerHTML = html || '<div class="search-empty">未找到相关结果</div>';

    // Auto-select first result
    if (results.length > 0 && selectedIndex < 0) {
      selectedIndex = 0;
      var firstCard = resultsContainer.querySelector('.result-card');
      if (firstCard) firstCard.classList.add('selected');
      showPreviewForResult(results[0]);
    }
  }

  function showPreviewForResult(result) {
    var item = null;
    for (var i = 0; i < contentData.length; i++) {
      if (contentData[i].id === result.id) {
        item = contentData[i];
        break;
      }
    }
    if (item) {
      // item.path is a full URL like "http://northgreen.github.io/2026/05/13/hello-world/"
      // Extract pathname for fetching: "/2026/05/13/hello-world/"
      var pathname = '';
      try {
        pathname = new URL(item.path).pathname;
      } catch (e) {
        pathname = '/' + item.slug; // fallback
      }
      window.dispatchEvent(new CustomEvent('search:preview', {
        detail: { slug: pathname, term: currentQuery.startsWith('#') ? currentQuery.slice(1).trim() : currentQuery.trim() }
      }));
    }
  }

  // ─── Keyboard navigation ────────────────────────────
  function navigateResults(direction) {
    var cards = resultsContainer.querySelectorAll('.result-card');
    if (!cards.length) return;

    if (cards[selectedIndex]) cards[selectedIndex].classList.remove('selected');
    selectedIndex = (selectedIndex + direction + cards.length) % cards.length;
    if (cards[selectedIndex]) {
      cards[selectedIndex].classList.add('selected');
      cards[selectedIndex].scrollIntoView({ block: 'nearest' });

      var slug = cards[selectedIndex].dataset.slug;
      if (slug && currentResults[selectedIndex]) {
        showPreviewForResult(currentResults[selectedIndex]);
      }
    }
  }

  function selectCurrent() {
    var cards = resultsContainer.querySelectorAll('.result-card');
    if (cards[selectedIndex]) {
      window.location.href = cards[selectedIndex].href;
      hideSearch();
    }
  }

  // ─── Toggle search overlay ──────────────────────────
  function showSearch() {
    if (!overlay) return;
    overlay.style.display = 'flex';
    isSearchOpen = true;
    setTimeout(function () { if (input) input.focus(); }, 100);
    document.body.style.overflow = 'hidden';
  }

  function hideSearch() {
    if (!overlay) return;
    overlay.style.display = 'none';
    isSearchOpen = false;
    if (input) { input.value = ''; input.blur(); }
    document.body.style.overflow = '';
    if (resultsContainer) resultsContainer.innerHTML = '<div class="search-empty">输入关键词开始搜索</div>';
    currentResults = [];
    selectedIndex = -1;
    currentQuery = '';
    window.dispatchEvent(new CustomEvent('search:clear'));
  }

  // ─── Event binding ──────────────────────────────────
  function bindEvents() {
    if (triggerBtn) triggerBtn.addEventListener('click', showSearch);
    if (closeBtn) closeBtn.addEventListener('click', hideSearch);

    if (input) {
      input.addEventListener('input', function (e) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(function () { onInput(e); }, 200);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); navigateResults(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); navigateResults(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); selectCurrent(); }
        else if (e.key === 'Escape') { hideSearch(); }
      });
    }

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) hideSearch();
      });
    }

    // Global shortcut: Cmd/Ctrl + K
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isSearchOpen ? hideSearch() : showSearch();
      }
    });

    // Hover preview on result cards
    if (resultsContainer) {
      resultsContainer.addEventListener('mouseover', function (e) {
        var card = e.target.closest('.result-card');
        if (card) {
          var idx = parseInt(card.dataset.index);
          if (idx !== selectedIndex) {
            var cards = resultsContainer.querySelectorAll('.result-card');
            if (cards[selectedIndex]) cards[selectedIndex].classList.remove('selected');
            selectedIndex = idx;
            card.classList.add('selected');
            if (currentResults[idx]) showPreviewForResult(currentResults[idx]);
          }
        }
      });
    }
  }

  // ─── Init ───────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initSearch();
      bindEvents();
    });
  } else {
    initSearch();
    bindEvents();
  }
})();
