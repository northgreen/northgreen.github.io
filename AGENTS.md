# AGENTS.md — Ictye Blog

## VCS

- **Jujutsu (jj)** is the VCS for the main repo (`.jj/` exists). **Never use `git`** in the root — use `jj describe`, `jj new`, `jj log`, `jj diff`.
- `.gitignore` ignores `public/`, `node_modules/`, `db.json`, `.deploy*/`.

## Commands

```bash
npm run build       # hexo generate — creates public/
npm run clean       # hexo clean — deletes db.json + public/
npm run server      # hexo server — dev server at localhost:4000
npm test            # vitest run — requires `public/contentIndex.json` (build first)
npm run test:watch  # vitest in watch mode
```

Order: `npm run clean && npm run build && npm test` to do a clean full check.

## Architecture

- **Hexo 8.x** blog, theme: `aero` (set in `_config.yml:99`)
- **EJS** templates in `themes/aero/layout/`, **SCSS** in `themes/aero/source/css/`
- **SCSS compiler**: `hexo-renderer-sass` (Dart Sass via `@use`). **Important**: each partial's `:root` block is isolated — duplicate `:root` across partials causes the second one to be silently dropped. Keep all CSS custom properties in `_variables.scss`'s single `:root` block.
- **Markdown**: `hexo-renderer-markdown-it`
- **SPA navigation**: PJAX (theme built-in, `pjax:success` event)

## Custom Scripts (`scripts/`)

| File | Type | When |
|------|------|------|
| `wikilink.js` | `hexo.extend.filter.register('before_post_render', ...)` | Parses `[[Title]]`, `[[Title\|Alias]]`, `[[Title#Heading]]` to markdown links. Uses `doc.path` for relative URLs. |
| `graph-builder.js` | `hexo.extend.filter.register('after_generate', ...)` | Builds `public/contentIndex.json` (array of nodes with id/title/slug/path/tags/links). Generates links from HTML `<a>` tags, markdown `[text](path)`, and `[[Wikilink]]` patterns. Maps slug variants (`/slug/`, `slug/`, `.html`). |
| `og-image.js` | `hexo.extend.filter.register('after_generate', ...)` | Generates 1200x630 Open Graph preview images for each post. Uses EJS template + Puppeteer screenshot. Incremental build via MD5 hash cache in `.cache/og-metadata.json`. |

The scripts use `this.locals.get('posts')` and `this.locals.get('pages')` — they need the Hexo context.

## Knowledge Graph Feature

- **Renderer**: `themes/aero/source/js/graph.js` (PixiJS v8 + D3.js v7) — loaded via CDN in `layout.ejs`
- **Styles**: `themes/aero/source/css/_partial/_graph.scss`
- **Data**: `public/contentIndex.json` fetched at runtime by `graph.js`
- **Config**: `themes/aero/_config.yml:35-36` (`graph.enable: true`)
- **PixiJS v8 API**: Uses fluent Graphics API (`gfx.circle().fill().stroke()`, `new PIXI.Application()` + `await app.init()`, `app.canvas`). Do NOT use v7 API.
- **CDN**: PixiJS 8.18.1 from jsDelivr, D3.js 7.9.0 from cdnjs

## OG Image Feature

- **Template**: `og-template/og-image.ejs` — 1200x630 HTML template with Catppuccin Frappe gradient background
- **Script**: `scripts/og-image.js` — after_generate filter that renders template + Puppeteer screenshot
- **Output**: `public/og-images/{slug}.png` — one PNG per post
- **Config**: `_config.yml` og_image section (enable, output_dir, width, height)
- **Cache**: `.cache/og-metadata.json` — MD5 hash cache for incremental builds
- **Meta Tags**: `layout.ejs` head section includes og:title, og:description, og:image, twitter:card, etc.
- **Dependencies**: puppeteer (devDependency)
- **Note**: Template uses Google Fonts CDN (Noto Sans SC) for Chinese font support

## Tests (`test/`)

- **Vitest v4** with jsdom
- `test/graph.test.js` uses `jsdom` environment (configured in `vitest.config.js` via `environmentMatchGlobs`)
- Other test files use `node` environment (default)
- **Prerequisite**: `npm run build` before running integration tests (`navigation-integration.test.js` needs `public/contentIndex.json`)

## Critical Gotchas

1. **`themes/aero/` is a nested git repo** — changes there need `git commit` inside that directory, not `jj`.
2. **SCSS `:root` isolation** — `hexo-renderer-sass` treats each partial independently. CSS variables must be declared exactly once in `_variables.scss:root`.
3. **`contentIndex.json` is an array** — `graph.js` must iterate with indexed `for` loop (not `for...in`).
4. **Wikilink lookup priority**: title (case-insensitive) > source filename > slug.
5. **Graph click navigation** uses `node.path` (full URL via `new URL(node.path).pathname`). The `node` object must include `path` from `contentIndex.json` details.
6. **OG image template path** — moved from `scripts/templates/` to `og-template/` to avoid Hexo loading it as a script.
7. **Puppeteer timeout** — uses `domcontentloaded` with 60s timeout (not `networkidle0`) for faster builds.
