(function () {
  'use strict';

  function restoreAll() {
    var navMore = document.getElementById('nav-more');
    var dropdown = document.getElementById('nav-dropdown');

    var hidden = document.querySelectorAll('[data-overflow="true"]');
    for (var i = 0; i < hidden.length; i++) {
      hidden[i].style.display = '';
      delete hidden[i].dataset.overflow;
    }

    // Clear dropdown items but keep the label (first child)
    if (dropdown) {
      while (dropdown.children.length > 1) {
        dropdown.removeChild(dropdown.lastChild);
      }
    }

    if (navMore) {
      navMore.style.display = 'none';
      navMore.classList.remove('open');
    }
  }

  /**
   * Measure all nav items and compute available space
   */
  function measureItems(items, navLinks, moreWidth) {
    var totalWidth = 0;
    for (var i = 0; i < items.length; i++) {
      totalWidth += items[i].offsetWidth;
    }
    var availableWidth = navLinks.parentElement.clientWidth - moreWidth;
    return { totalWidth: totalWidth, availableWidth: availableWidth };
  }

  /**
   * Build hide queue: rightmost first, active item last
   */
  function buildHideQueue(items, activeIdx) {
    var queue = [];
    for (var i = items.length - 1; i >= 0; i--) {
      if (i !== activeIdx) {
        queue.push(items[i]);
      }
    }
    if (activeIdx >= 0) {
      queue.push(items[activeIdx]);
    }
    return queue;
  }

  /**
   * Clone a nav link into the dropdown menu
   */
  function cloneLinkToDropdown(link, dropdown) {
    if (!link) return;
    var clone = document.createElement('a');

    var href = link.getAttribute('href');
    if (href) clone.setAttribute('href', href);

    // Clone nav-text content safely using DOM API
    var navText = link.querySelector('.nav-text');
    if (navText) {
      var textClone = navText.cloneNode(true);
      while (textClone.firstChild) {
        clone.appendChild(textClone.firstChild);
      }
    }

    if (link.classList.contains('active')) {
      clone.classList.add('active');
    }
    clone.removeAttribute('id');

    var li = document.createElement('li');
    li.appendChild(clone);
    dropdown.appendChild(li);
  }

  /**
   * Hide a nav item (without modifying dropdown)
   */
  function hideItem(item) {
    item.style.display = 'none';
    item.dataset.overflow = 'true';
  }

  /**
   * Assumption: nav-links uses display:flex with no flex-grow/shrink,
   * so hiding items linearly reduces total width.
   * If flex-grow is added to nav items, this algorithm must be revised.
   */
  function calcOverflow() {
    var navLinks = document.querySelector('.nav-links');
    var navMore = document.getElementById('nav-more');
    var dropdown = document.getElementById('nav-dropdown');

    if (!navLinks || !navMore || !dropdown) return;

    // Collect non-more nav items
    var items = [];
    var children = navLinks.children;
    for (var i = 0; i < children.length; i++) {
      if (!children[i].classList.contains('nav-more')) {
        items.push(children[i]);
      }
    }
    if (items.length === 0) return;

    // Pre-measure while all items are visible
    var totalWidth = 0;
    for (var j = 0; j < items.length; j++) {
      totalWidth += items[j].offsetWidth;
    }

    var availableWidth = navLinks.parentElement.clientWidth;

    // All items fit — hide more, done
    if (totalWidth <= availableWidth) {
      navMore.style.display = 'none';
      return;
    }

    // Show more button and recalc available
    navMore.style.display = 'flex';
    var meas = measureItems(items, navLinks, navMore.offsetWidth);
    var navAvailable = meas.availableWidth;

    if (navAvailable <= 0) {
      // Extremely narrow — hide everything
      for (var z = 0; z < items.length; z++) {
        hideItem(items[z]);
      }
      // Add all items to dropdown in original order
      for (var z2 = 0; z2 < items.length; z2++) {
        cloneLinkToDropdown(items[z2].querySelector('a'), dropdown);
      }
      return;
    }

    // Find active item
    var activeIdx = -1;
    for (var k = 0; k < items.length; k++) {
      if (items[k].querySelector('.active')) {
        activeIdx = k;
        break;
      }
    }

    // Hide items until remaining fit
    var hideQueue = buildHideQueue(items, activeIdx);
    var runningWidth = totalWidth;

    for (var n = 0; n < hideQueue.length; n++) {
      if (runningWidth <= navAvailable) break;
      runningWidth -= hideQueue[n].offsetWidth;
      hideItem(hideQueue[n]);
    }

    // Add hidden items to dropdown in original left-to-right order
    for (var p = 0; p < items.length; p++) {
      if (items[p].style.display === 'none') {
        cloneLinkToDropdown(items[p].querySelector('a'), dropdown);
      }
    }
  }

  function setupToggle() {
    var navMore = document.getElementById('nav-more');
    var moreBtn = document.getElementById('nav-more-btn');

    if (!navMore || !moreBtn) return;

    var newBtn = moreBtn.cloneNode(true);
    moreBtn.parentNode.replaceChild(newBtn, moreBtn);

    newBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      navMore.classList.toggle('open');
    });
  }

  function init() {
    var navLinks = document.querySelector('.nav-links');
    var navMore = document.getElementById('nav-more');

    if (!navLinks || !navMore) return;

    restoreAll();
    setupToggle();
    calcOverflow();
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, delay);
    };
  }

  // ─── Outside click handler ────────────────────────
  document.addEventListener('click', function (e) {
    var navMore = document.getElementById('nav-more');
    if (navMore && navMore.classList.contains('open') && !navMore.contains(e.target)) {
      navMore.classList.remove('open');
    }
  });

  // ─── Init events ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:success', init);
  window.addEventListener('resize', debounce(init, 100));
})();
