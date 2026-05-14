(function () {
  'use strict';

  // ============================================================
  // Configuration
  // ============================================================
  var DEFAULTS = {
    depth: 1,
    scale: 1.1,
    repelForce: 0.5,
    centerForce: 0.3,
    linkDistance: 30,
    fontSize: 12,
    opacityScale: 1.0,
    showTags: true,
    removeTags: [],
    enableRadial: false,
    focusOnHover: true,
  };

  // ============================================================
  // Global State
  // ============================================================
  var contentIndex = null;
  var contentIndexPromise = null;
  var graphInstances = new Map();
  var globalGraphActive = false;

  // ============================================================
  // CSS Variable Helper
  // ============================================================
  function getCSSVar(name, fallback) {
    try {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getNodeColor(node, slug) {
    var visited = getVisitedPages();
    if (node.id === slug) {
      return getCSSVar('--graph-highlight', '#fab005');
    }
    if (node.isTag) {
      return getCSSVar('--graph-tag', '#82c91e');
    }
    if (visited.has(node.id)) {
      return getCSSVar('--graph-visited', '#868e96');
    }
    return getCSSVar('--graph-node', '#49b0f5');
  }

  function getTextColor() {
    return getCSSVar('--graph-text', '#333333');
  }

  function getLinkColor() {
    return getCSSVar('--graph-link', '#a0c4ff');
  }

  // ============================================================
  // Visited Pages (localStorage)
  // ============================================================
  var LS_KEY = 'graph-visited';

  function getVisitedPages() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) {
      return new Set();
    }
  }

  function markPageVisited(slug) {
    try {
      var visited = getVisitedPages();
      visited.add(slug);
      localStorage.setItem(LS_KEY, JSON.stringify(Array.from(visited)));
    } catch (_) {
      // localStorage unavailable
    }
  }

  // ============================================================
  // Slug Helpers
  // ============================================================
  function normalizeSlug(slug) {
    return slug.replace(/\/+$/, '') + '/';
  }

  function getCurrentSlug() {
    var path = window.location.pathname;
    console.log('[Graph] getCurrentSlug: path =', path);
    // 尝试从 contentIndex 中查找匹配的节点
    if (contentIndex && Array.isArray(contentIndex)) {
      for (var i = 0; i < contentIndex.length; i++) {
        var node = contentIndex[i];
        // 检查 path 是否匹配（去掉域名，比较 pathname）
        if (node.path) {
          try {
            var urlObj = new URL(node.path);
            if (urlObj.pathname === path || normalizeSlug(urlObj.pathname) === normalizeSlug(path)) {
              console.log('[Graph] getCurrentSlug: matched node.id =', node.id);
              return node.id || node.slug;
            }
          } catch (_) {}
        }
        // 也检查 slug 直接匹配
        if (node.slug && normalizeSlug(node.slug) === normalizeSlug(path)) {
          console.log('[Graph] getCurrentSlug: matched by slug =', node.id);
          return node.id || node.slug;
        }
      }
    }
    // Fallback: 使用路径
    var fallback = normalizeSlug(path);
    console.log('[Graph] getCurrentSlug: fallback =', fallback);
    return fallback;
  }

  function isTagSlug(slug) {
    return slug.startsWith('tags/');
  }

  function tagDisplayName(slug) {
    return '#' + slug.replace(/^tags\//, '').replace(/\/$/, '');
  }

  function nodeDisplayName(slug, title) {
    if (isTagSlug(slug)) return tagDisplayName(slug);
    return title || slug;
  }

  // ============================================================
  // Data Loading
  // ============================================================
  function loadContentIndex() {
    if (contentIndex) return Promise.resolve(contentIndex);
    if (contentIndexPromise) return contentIndexPromise;

    contentIndexPromise = fetch('/contentIndex.json')
      .then(function (resp) {
        if (!resp.ok) throw new Error('Failed to load contentIndex.json');
        return resp.json();
      })
      .then(function (data) {
        contentIndex = data;
        return data;
      })
      .catch(function (err) {
        contentIndexPromise = null;
        console.error('[Graph] Failed to load content index:', err);
        throw err;
      });

    return contentIndexPromise;
  }

  // ============================================================
  // Graph Data Builders
  // ============================================================
  function buildLocalGraph(currentSlug, maxDepth, opts) {
    if (!contentIndex) return { nodes: [], links: [] };
    opts = opts || {};

    var showTags = opts.showTags !== undefined ? opts.showTags : DEFAULTS.showTags;
    var removeTags = opts.removeTags || DEFAULTS.removeTags;

    // Parse content index into a Map
    var data = new Map();
    // contentIndex is an array, iterate and use each node's id/slug as key
    for (var i = 0; i < contentIndex.length; i++) {
      var node = contentIndex[i];
      var nodeId = node.id || node.slug || String(i);
      data.set(normalizeSlug(nodeId), node);
    }

    var validSlugs = new Set(data.keys());
    var allLinks = [];
    var allTags = [];

    // Build all links and collect tags
    data.forEach(function (details, source) {
      var outgoing = details.links || [];
      for (var i = 0; i < outgoing.length; i++) {
        var dest = normalizeSlug(outgoing[i]);
        if (validSlugs.has(dest)) {
          allLinks.push({ source: source, target: dest });
        }
      }

      if (showTags) {
        var tags = details.tags || [];
        for (var j = 0; j < tags.length; j++) {
          var tag = tags[j];
          if (removeTags.indexOf(tag) !== -1) continue;
          var tagSlug = normalizeSlug('tags/' + tag);
          if (allTags.indexOf(tagSlug) === -1) allTags.push(tagSlug);
          allLinks.push({ source: source, target: tagSlug });
        }
      }
    });

    // BFS to find neighbourhood within maxDepth
    var neighbourhood = new Set();
    var queue = [currentSlug, '__SENTINEL__'];
    var depth = maxDepth;

    if (depth >= 0) {
      while (depth >= 0 && queue.length > 0) {
        var cur = queue.shift();
        if (cur === '__SENTINEL__') {
          depth--;
          if (depth >= 0) queue.push('__SENTINEL__');
        } else {
          if (!neighbourhood.has(cur)) {
            neighbourhood.add(cur);
            var outgoing = [];
            var incoming = [];
            for (var k = 0; k < allLinks.length; k++) {
              if (allLinks[k].source === cur) outgoing.push(allLinks[k].target);
              if (allLinks[k].target === cur) incoming.push(allLinks[k].source);
            }
            for (var m = 0; m < outgoing.length; m++) queue.push(outgoing[m]);
            for (var n = 0; n < incoming.length; n++) queue.push(incoming[n]);
          }
        }
      }
    } else {
      validSlugs.forEach(function (id) { neighbourhood.add(id); });
      for (var t = 0; t < allTags.length; t++) neighbourhood.add(allTags[t]);
    }

    // Build nodes
    var nodeMap = new Map();
    var nodes = [];
    neighbourhood.forEach(function (slug) {
      var isTag = isTagSlug(slug);
      var details = data.get(slug);
      var node = {
        id: slug,
        text: nodeDisplayName(slug, details ? details.title : null),
        tags: details ? (details.tags || []) : [],
        isTag: isTag,
        isCurrent: slug === currentSlug,
        path: details ? details.path : null,  // 添加 path 字段，用于导航
      };
      nodeMap.set(slug, node);
      nodes.push(node);
    });

    // Build links (only those between nodes in neighbourhood)
    var links = [];
    for (var li = 0; li < allLinks.length; li++) {
      var l = allLinks[li];
      if (neighbourhood.has(l.source) && neighbourhood.has(l.target)) {
        links.push({ source: l.source, target: l.target });
      }
    }

    return { nodes: nodes, links: links, nodeMap: nodeMap };
  }

  function buildGlobalGraph(opts) {
    if (!contentIndex) return { nodes: [], links: [] };
    opts = opts || {};
    return buildLocalGraph('__global__', -1, opts);
  }

  // ============================================================
  // Core Rendering Engine
  // ============================================================
  async function createGraph(container, graphData, config) {
    var cfg = {};
    for (var key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        cfg[key] = DEFAULTS[key];
      }
    }
    if (config) {
      for (var ck in config) {
        if (Object.prototype.hasOwnProperty.call(config, ck)) {
          cfg[ck] = config[ck];
        }
      }
    }

    var nodes = graphData.nodes;
    var links = graphData.links;

    // Guard: empty graph
    if (nodes.length === 0) return null;

    var width = container.clientWidth || 400;
    var height = Math.max(container.clientHeight || 250, 250);
    var w2 = width / 2;
    var h2 = height / 2;

    // --- PixiJS Application ---
    var app = new PIXI.Application();
    await app.init({
      width: width,
      height: height,
      antialias: true,
      autoStart: false,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
    });
    container.appendChild(app.canvas);

    // When autoDensity is true, the canvas CSS size = width / resolution.
    // But offsetX/offsetY are in CSS pixels, so multiply by resolution for PixiJS internal coords.
    var resolution = window.devicePixelRatio || 1;

    // --- Containers ---
    var linkContainer = new PIXI.Container();
    linkContainer.zIndex = 1;
    var nodeContainer = new PIXI.Container();
    nodeContainer.zIndex = 2;
    var labelContainer = new PIXI.Container();
    labelContainer.zIndex = 3;

    app.stage.addChild(linkContainer, nodeContainer, labelContainer);


    // --- Create Nodes ---
    var nodeRenderData = [];
    var textColor = getTextColor();
    var linkColor = getLinkColor();

    for (var ni = 0; ni < nodes.length; ni++) {
      var n = nodes[ni];
      var nodeColor = getNodeColor(n, cfg.currentSlug);
      var r = nodeRadius(n, links);

      var gfx = new PIXI.Graphics();
      gfx.eventMode = 'static';
      gfx.cursor = 'pointer';
      gfx.circle(0, 0, r);
      gfx.fill({ color: nodeColor });

      if (n.isTag) {
        gfx.stroke({ width: 2, color: getCSSVar('--graph-tag-stroke', '#5c940d') });
      }

      nodeContainer.addChild(gfx);

      var label = new PIXI.Text({
        text: n.text,
        style: {
          fontSize: cfg.fontSize,
          fill: textColor,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      });
      label.anchor.set(0.5, 0);
      label.alpha = 1;
      labelContainer.addChild(label);

      nodeRenderData.push({
        simulationData: n,
        gfx: gfx,
        label: label,
        color: nodeColor,
        alpha: 1,
        active: false,
      });
    }

    // --- Create Links ---
    var linkRenderData = [];
    for (var li = 0; li < links.length; li++) {
      var gfxLink = new PIXI.Graphics();
      gfxLink.eventMode = 'none';
      linkContainer.addChild(gfxLink);

      linkRenderData.push({
        simulationData: links[li],
        gfx: gfxLink,
        color: linkColor,
        alpha: 1,
        active: false,
      });
    }

    // --- Hover State ---
    var hoveredNodeId = null;
    var hoveredNeighbours = new Set();

    function updateHover(newId) {
      hoveredNodeId = newId;

      if (newId === null) {
        hoveredNeighbours = new Set();
        for (var i = 0; i < nodeRenderData.length; i++) nodeRenderData[i].active = false;
        for (var j = 0; j < linkRenderData.length; j++) linkRenderData[j].active = false;
        return;
      }

      // Compute 1-hop neighbours
      var neighbours = new Set([newId]);
      for (var k = 0; k < linkRenderData.length; k++) {
        var ld = linkRenderData[k].simulationData;
        var src = typeof ld.source === 'object' ? ld.source.id : ld.source;
        var tgt = typeof ld.target === 'object' ? ld.target.id : ld.target;
        var isNeighbour = src === newId || tgt === newId;
        linkRenderData[k].active = isNeighbour;
        if (isNeighbour) {
          neighbours.add(src);
          neighbours.add(tgt);
        }
      }
      for (var m = 0; m < nodeRenderData.length; m++) {
        nodeRenderData[m].active = neighbours.has(nodeRenderData[m].simulationData.id);
      }
      hoveredNeighbours = neighbours;
    }

    // Attach hover events
    for (var ndi = 0; ndi < nodeRenderData.length; ndi++) {
      var nd = nodeRenderData[ndi];
      nd.gfx.on('pointerover', function (nodeId) {
        return function () { updateHover(nodeId); };
      }(nd.simulationData.id));
      nd.gfx.on('pointerleave', function () {
        updateHover(null);
      });
    }

    // --- D3 Force Simulation ---
    var simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-100 * cfg.repelForce))
      .force('center', d3.forceCenter().strength(cfg.centerForce))
      .force('link', d3.forceLink(links).distance(cfg.linkDistance).id(function (d) { return d.id; }))
      .force('collide', d3.forceCollide(7).iterations(3))
      .alpha(0.3);

    if (cfg.enableRadial) {
      var radius = (Math.min(width, height) / 2) * 0.8;
      simulation.force('radial', d3.forceRadial(radius).strength(0.2));
    }

    // --- Drag State ---
    var dragData = null;

    // Coordinate conversion helpers
    function domToSim(clientX, clientY) {
      var rect = app.canvas.getBoundingClientRect();
      var scaleX = app.canvas.width / rect.width;
      var scaleY = app.canvas.height / rect.height;
      var canvasX = (clientX - rect.left) * scaleX;
      var canvasY = (clientY - rect.top) * scaleY;
      return {
        x: (canvasX - app.stage.position.x) / app.stage.scale.x - w2,
        y: (canvasY - app.stage.position.y) / app.stage.scale.y - h2,
      };
    }

    // PixiJS pointerdown on each node → start drag
    for (var dndi = 0; dndi < nodeRenderData.length; dndi++) {
      var nd2 = nodeRenderData[dndi];
      nd2.gfx.on('pointerdown', function (simNode) {
        return function (event) {
          event.stopPropagation();
          dragData = {
            node: simNode,
            startTime: Date.now(),
            moved: false,
            startX: simNode.x,
            startY: simNode.y,
          };
          simNode.fx = simNode.x;
          simNode.fy = simNode.y;
          simulation.alphaTarget(0.3).restart();
        };
      }(nd2.simulationData));
    }

    // DOM pointermove on canvas → drag update
    app.canvas.addEventListener('pointermove', function (e) {
      if (!dragData) return;
      var pos = domToSim(e.clientX, e.clientY);
      var dx = pos.x - dragData.startX;
      var dy = pos.y - dragData.startY;
      if (!dragData.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragData.moved = true;
      }
      dragData.node.fx = pos.x;
      dragData.node.fy = pos.y;
    });

    // DOM pointerup on canvas → end drag or navigate
    app.canvas.addEventListener('pointerup', function (e) {
      if (!dragData) return;

      var wasMoved = dragData.moved;
      var elapsed = Date.now() - dragData.startTime;
      var clickedNode = dragData.node;

      // Release the node
      dragData.node.fx = null;
      dragData.node.fy = null;
      simulation.alphaTarget(0);
      dragData = null;

      // Detect click: short press without significant movement
      if (!wasMoved && elapsed < 500 && clickedNode) {
        navigateToNode(clickedNode);
      }
    });

    // DOM pointercancel → cancel drag
    app.canvas.addEventListener('pointercancel', function () {
      if (!dragData) return;
      dragData.node.fx = null;
      dragData.node.fy = null;
      simulation.alphaTarget(0);
      dragData = null;
    });

    // --- Zoom (d3-zoom on canvas via D3) ---
    var currentTransform = d3.zoomIdentity;
    if (cfg.enableZoom !== false) {
      var zoomBehavior = d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.25, 4])
        .on('zoom', function (event) {
          currentTransform = event.transform;
          app.stage.scale.set(event.transform.k, event.transform.k);
          app.stage.position.set(event.transform.x, event.transform.y);

          // Adjust label opacity based on zoom level
          var scale = event.transform.k * cfg.opacityScale;
          var labelScaleOpacity = Math.max((scale - 1) / 3.75, 0);
          for (var li2 = 0; li2 < nodeRenderData.length; li2++) {
            var nd3 = nodeRenderData[li2];
            if (!nd3.active) {
              nd3.label.alpha = labelScaleOpacity;
            } else {
              nd3.label.alpha = 1;
            }
          }
        });

      d3.select(app.canvas).call(zoomBehavior);

      // Apply initial scale
      if (cfg.scale && cfg.scale !== 1) {
        var initialTransform = d3.zoomIdentity.translate(0, 0).scale(cfg.scale);
        d3.select(app.canvas).call(zoomBehavior.transform, initialTransform);
      }
    }

    // --- Animation Loop ---
    var animId = null;
    var stopAnimation = false;

    function animate(time) {
      if (stopAnimation) return;

      var cw = container.clientWidth;
      var ch = Math.max(container.clientHeight, 250);
      var cx = cw / 2;
      var cy = ch / 2;

      // Update node positions
      for (var ani = 0; ani < nodeRenderData.length; ani++) {
        var nd4 = nodeRenderData[ani];
        var d = nd4.simulationData;
        if (d.x == null || d.y == null || isNaN(d.x) || isNaN(d.y)) continue;

        nd4.gfx.position.set(d.x + cx, d.y + cy);
        nd4.label.position.set(d.x + cx, d.y + cy + 4);

        // Hover highlight: dim non-active nodes
        if (hoveredNodeId !== null) {
          nd4.gfx.alpha = nd4.active ? 1 : 0.15;
          nd4.label.alpha = nd4.active ? 1 : 0.15;
        } else {
          nd4.gfx.alpha = 1;
          nd4.label.alpha = 1;
        }
      }

      // Update link positions
      for (var ali = 0; ali < linkRenderData.length; ali++) {
        var ld2 = linkRenderData[ali];
        var linkD = ld2.simulationData;
        var src = typeof linkD.source === 'object' ? linkD.source : null;
        var tgt = typeof linkD.target === 'object' ? linkD.target : null;
        if (!src || !tgt) continue;
        if (src.x == null || tgt.x == null || isNaN(src.x) || isNaN(tgt.x)) continue;

        ld2.gfx.clear();
        ld2.gfx.moveTo(src.x + cx, src.y + cy);
        ld2.gfx.lineTo(tgt.x + cx, tgt.y + cy);
        ld2.gfx.stroke({ width: 1, color: ld2.color, alpha: ld2.alpha });

        if (hoveredNodeId !== null) {
          ld2.gfx.alpha = ld2.active ? 1 : 0.15;
        } else {
          ld2.gfx.alpha = 1;
        }
      }

      app.render();
      animId = requestAnimationFrame(animate);
    }

    animId = requestAnimationFrame(animate);

    // --- Resize Handler ---
    function handleResize() {
      var newW = container.clientWidth;
      var newH = Math.max(container.clientHeight, 250);
      if (newW <= 0 || newH <= 0) return;

      app.renderer.resize(newW, newH);
      // Update center force target
      w2 = newW / 2;
      h2 = newH / 2;
      simulation.force('center', d3.forceCenter().strength(cfg.centerForce));
      simulation.alpha(0.1).restart();
    }

    window.addEventListener('resize', handleResize);

    // --- Return Instance ---
    return {
      app: app,
      simulation: simulation,
      nodeRenderData: nodeRenderData,
      linkRenderData: linkRenderData,
      destroy: function () {
        stopAnimation = true;
        if (animId !== null) cancelAnimationFrame(animId);
        window.removeEventListener('resize', handleResize);
        simulation.stop();
        app.destroy(true, { children: true, texture: true });
      },
      resize: handleResize,
    };
  }

  // ============================================================
  // Node Radius
  // ============================================================
  function nodeRadius(node, links) {
    var count = 0;
    for (var i = 0; i < links.length; i++) {
      var src = typeof links[i].source === 'object' ? links[i].source.id : links[i].source;
      var tgt = typeof links[i].target === 'object' ? links[i].target.id : links[i].target;
      if (src === node.id || tgt === node.id) count++;
    }
    return 3 + Math.sqrt(count);
  }

  // ============================================================
  // Navigation
  // ============================================================
  function navigateToNode(node) {
    if (!node) return;
    var slug = node.id;
    var url;

    if (isTagSlug(slug)) {
      // Tag: 使用 slug 生成标签页 URL
      var tagName = slug.replace(/^tags\//, '').replace(/\/$/, '');
      url = '/tags/' + encodeURIComponent(tagName) + '/';
    } else if (node.path) {
      // Page: 使用 node.path 提取相对路径
      try {
        var urlObj = new URL(node.path);
        url = urlObj.pathname;
      } catch (_) {
        // Fallback: 使用 slug
        var cleanSlug = slug.replace(/^\/+/, '').replace(/\/+$/, '');
        url = '/' + cleanSlug + '/';
      }
    } else {
      var cleanSlug = slug.replace(/^\/+/, '').replace(/\/+$/, '');
      url = '/' + cleanSlug + '/';
    }

    markPageVisited(slug);
    window.location.href = url;
  }

  // ============================================================
  // Local Graph (Sidebar)
  // ============================================================
  function initLocalGraph(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.warn('[Graph] initLocalGraph: container not found:', containerId);
      return;
    }
    console.log('[Graph] initLocalGraph: container found, loading data...');

    loadContentIndex()
      .then(function () {
        console.log('[Graph] initLocalGraph: data loaded, calling renderLocalGraph...');
        renderLocalGraph(containerId);
      })
      .catch(function (err) {
        console.error('[Graph] Failed to init local graph:', err);
        var el = document.getElementById(containerId);
        if (el) el.innerHTML = '<div class="graph-empty">图谱加载失败</div>';
      });
  }

  function renderLocalGraph(containerId, currentSlug) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.warn('[Graph] renderLocalGraph: container not found:', containerId);
      return;
    }
    if (!contentIndex) {
      console.warn('[Graph] renderLocalGraph: contentIndex not loaded');
      container.innerHTML = '<div class="graph-empty">图谱数据未加载</div>';
      return;
    }

    currentSlug = currentSlug || getCurrentSlug();
    console.log('[Graph] renderLocalGraph: currentSlug =', currentSlug);

    // Destroy existing instance
    if (graphInstances.has(containerId)) {
      graphInstances.get(containerId).destroy();
      graphInstances.delete(containerId);
    }

    var graphData = buildLocalGraph(currentSlug, DEFAULTS.depth);
    console.log('[Graph] renderLocalGraph: graphData.nodes.length =', graphData.nodes.length);

    // Guard: too few nodes
    if (graphData.nodes.length < 2) {
      console.warn('[Graph] renderLocalGraph: too few nodes, showing empty state');
      container.innerHTML = '<div class="graph-empty">暂无关联页面</div>';
      return;
    }

    // 清除容器内的"加载中..."等旧内容，为画布腾出空间
    container.innerHTML = '';

    // Create a shallow copy of config with currentSlug for coloring
    var cfg = {};
    for (var k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
        cfg[k] = DEFAULTS[k];
      }
    }
    cfg.currentSlug = currentSlug;

    createGraph(container, graphData, cfg).then(function(instance) {
      console.log('[Graph] renderLocalGraph: graph created successfully');
      if (instance) {
        graphInstances.set(containerId, instance);
      }
    }).catch(function(err) {
      console.error('[Graph] Failed to create local graph:', err);
      container.innerHTML = '<div class="graph-empty">图谱渲染失败</div>';
    });
  }

  // ============================================================
  // Global Graph (Fullscreen Overlay)
  // ============================================================
  function openGlobalGraph() {
    if (globalGraphActive) return;
    globalGraphActive = true;

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'global-graph-overlay';
    overlay.innerHTML =
      '<div class="global-graph-header">' +
        '<span class="global-graph-title">关系图谱</span>' +
        '<button class="global-graph-close" id="global-graph-close">&times;</button>' +
      '</div>' +
      '<div id="global-graph-container" class="global-graph-container card"></div>';
    document.body.appendChild(overlay);

    // Close button
    document.getElementById('global-graph-close').addEventListener('click', closeGlobalGraph);
    document.addEventListener('keydown', globalGraphEscapeHandler);

    // Load data and render
    loadContentIndex()
      .then(function () {
        var graphData = buildGlobalGraph();
        var container = document.getElementById('global-graph-container');
        if (!container) return;

        if (graphData.nodes.length < 2) {
          container.innerHTML = '<div class="graph-empty">暂无关联页面</div>';
          return;
        }

        createGraph(container, graphData, {
          depth: -1,
          scale: 0.9,
          enableRadial: true,
          centerForce: 0.2,
        }).then(function(instance) {
          if (instance) {
            graphInstances.set('global-graph', instance);
          }
        }).catch(function(err) {
          console.error('[Graph] Failed to create global graph:', err);
        });
      })
      .catch(function (err) {
        console.error('[Graph] Failed to load global graph:', err);
        var container = document.getElementById('global-graph-container');
        if (container) {
          container.innerHTML = '<div class="graph-empty">图谱加载失败</div>';
        }
      });
  }

  function closeGlobalGraph() {
    var overlay = document.getElementById('global-graph-overlay');
    if (overlay) {
      if (graphInstances.has('global-graph')) {
        graphInstances.get('global-graph').destroy();
        graphInstances.delete('global-graph');
      }
      overlay.remove();
    }
    globalGraphActive = false;
    document.removeEventListener('keydown', globalGraphEscapeHandler);
  }

  function globalGraphEscapeHandler(e) {
    if (e.key === 'Escape') closeGlobalGraph();
  }

  // ============================================================
  // Event Setup
  // ============================================================

  // ============================================================
  // Post Page Visibility
  // ============================================================

  /**
   * Toggle graph widget visibility based on whether current page is a post.
   * Hides the widget on non-post pages (homepage, archives, tags, etc.)
   * and shows it on post pages. Returns true if current page is a post.
   */
  function toggleGraphVisibility() {
    var widget = document.querySelector('.graph-widget');
    if (!widget) return false;
    var isPost = !!document.querySelector('.post-full');
    widget.style.display = isPost ? '' : 'none';
    return isPost;
  }

  // PJAX navigation integration
  document.addEventListener('pjax:success', function () {
    if (toggleGraphVisibility()) {
      renderLocalGraph('graph-container');
    }
  });

  // Page load initialization
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (toggleGraphVisibility()) {
        initLocalGraph('graph-container');
      }

      // Wire up global graph buttons (always, even when hidden)
      var globalBtn = document.getElementById('graph-global-btn');
      if (globalBtn) {
        globalBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openGlobalGraph();
        });
      }

      var navBtn = document.getElementById('nav-graph-btn');
      if (navBtn) {
        navBtn.addEventListener('click', function (e) {
          e.preventDefault();
          openGlobalGraph();
        });
      }
    }, 100);
  });

  // Ctrl+G / Cmd+G keyboard shortcut
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      if (globalGraphActive) closeGlobalGraph();
      else openGlobalGraph();
    }
  });

  // ============================================================
  // Public API
  // ============================================================
  window.Graph = {
    init: function () {
      initLocalGraph('graph-container');
    },
    render: function (slug) {
      renderLocalGraph('graph-container', slug);
    },
    openGlobal: openGlobalGraph,
    closeGlobal: closeGlobalGraph,
  };

})();
