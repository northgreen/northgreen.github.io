(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────
  var previewContainer = document.getElementById('preview-container');
  var fetchCache = new Map();

  // ─── Fetch page HTML ────────────────────────────────
  function fetchContent(slug) {
    if (fetchCache.has(slug)) return Promise.resolve(fetchCache.get(slug));

    // Ensure absolute path from site root
    var url = slug.startsWith('/') ? slug : '/' + slug;
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    }).then(function (html) {
      fetchCache.set(slug, html);
      return html;
    }).catch(function (err) {
      console.error('Preview fetch failed:', err);
      return null;
    });
  }

  // ─── Extract main content area ──────────────────────
  function extractMainContent(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    // Try #pjax-container first, then fallbacks
    var content = doc.querySelector('#pjax-container');
    if (!content) content = doc.querySelector('main');
    if (!content) content = doc.querySelector('.post-content');
    if (!content) content = doc.querySelector('article');

    if (!content) return null;

    var clone = content.cloneNode(true);

    // Remove unwanted elements
    var removals = clone.querySelectorAll('script, style, nav, aside, .sidebar, iframe');
    for (var i = 0; i < removals.length; i++) {
      removals[i].remove();
    }

    return clone;
  }

  // ─── Highlight search terms in DOM ──────────────────
  function highlightInDOM(element, term) {
    if (!term || !element) return;

    var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex;
    try {
      regex = new RegExp('(' + escaped + ')', 'gi');
    } catch (e) {
      return;
    }

    function walk(node) {
      if (node.nodeType === 3) { // Text node
        var text = node.textContent;
        if (regex.test(text)) {
          regex.lastIndex = 0;
          var span = document.createElement('span');
          span.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
          node.parentNode.replaceChild(span, node);
        }
      } else if (node.nodeType === 1) { // Element node
        var tag = node.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') return;
        // Convert childNodes to array to avoid live mutation issues
        var children = Array.prototype.slice.call(node.childNodes);
        for (var i = 0; i < children.length; i++) {
          walk(children[i]);
        }
      }
    }

    var children = Array.prototype.slice.call(element.childNodes);
    for (var i = 0; i < children.length; i++) {
      walk(children[i]);
    }
  }

  // ─── Show preview ───────────────────────────────────
  function showPreview(slug, term) {
    if (!previewContainer) return;

    previewContainer.innerHTML = '<div class="preview-loading">加载预览中...</div>';

    fetchContent(slug).then(function (html) {
      if (!html) {
        previewContainer.innerHTML = '<div class="preview-empty">无法加载预览</div>';
        return;
      }

      var content = extractMainContent(html);
      if (!content) {
        previewContainer.innerHTML = '<div class="preview-empty">预览解析失败</div>';
        return;
      }

      // Sanitize with DOMPurify
      // DOMPurify.sanitize returns sanitized HTML string
      var cleanHtml = DOMPurify.sanitize(content.innerHTML);

      // Inject into preview
      previewContainer.innerHTML = cleanHtml;

      // Highlight search terms
      if (term) {
        highlightInDOM(previewContainer, term);

        // Scroll to first highlight
        var firstHighlight = previewContainer.querySelector('.highlight');
        if (firstHighlight) {
          try {
            firstHighlight.scrollIntoView({ block: 'center' });
          } catch (e) {
            // fallback for older browsers
          }
        }
      }
    });
  }

  function hidePreview() {
    if (!previewContainer) return;
    previewContainer.innerHTML = '<div class="preview-empty">选择结果查看预览</div>';
  }

  // ─── Event listeners ────────────────────────────────
  window.addEventListener('search:preview', function (e) {
    var slug = e.detail && e.detail.slug;
    var term = e.detail && e.detail.term;
    if (slug) showPreview(slug, term || '');
  });

  window.addEventListener('search:clear', function () {
    hidePreview();
  });
})();
