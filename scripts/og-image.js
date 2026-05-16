'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const sass = require('sass');

/**
 * Generate Open Graph images for all posts.
 * Runs as an after_generate filter in Hexo.
 */
async function generateOgImages() {
  // ============================================================
  // Guard Clauses
  // ============================================================
  const config = this.config;
  
  // Check if og_image is enabled
  if (!config.og_image || config.og_image.enable !== true) {
    return;
  }
  
  // Check if posts exist
  const posts = this.locals.get('posts');
  if (!posts || posts.length === 0) {
    return;
  }
  
  // Check if template exists
  const templatePath = path.join(__dirname, '..', 'og-template', 'og-image.ejs');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`[og-image] Template not found: ${templatePath}`);
  }
  
  // ============================================================
  // Configuration
  // ============================================================
  const outputDir = config.og_image.output_dir || 'og-images';
  const width = config.og_image.width || 1200;
  const height = config.og_image.height || 630;
  const publicDir = this.public_dir || 'public';
  const cacheDir = path.join(process.cwd(), '.cache');
  const cacheFile = path.join(cacheDir, 'og-metadata.json');
  
  // Ensure directories exist
  fs.mkdirSync(path.join(publicDir, outputDir), { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  
  // ============================================================
  // Load Cache
  // ============================================================
  let cache = {};
  if (fs.existsSync(cacheFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    } catch (_) {
      cache = {};
    }
  }
  
  // ============================================================
  // Load Template
  // ============================================================
  const template = fs.readFileSync(templatePath, 'utf-8');

// ============================================================
// Compile SCSS
// ============================================================
const scssPath = path.join(__dirname, '..', 'og-template', 'og-image.scss');
const cssResult = sass.compile(scssPath);
let css = cssResult.css;

// ============================================================
// Inline reflection.png as base64
// ============================================================
const reflectionPath = path.join(__dirname, '..', 'og-template', 'reflection.png');
if (fs.existsSync(reflectionPath)) {
  const reflectionBuffer = fs.readFileSync(reflectionPath);
  const reflectionBase64 = `data:image/png;base64,${reflectionBuffer.toString('base64')}`;
  css = css.replace('__REFLECTION_IMG__', reflectionBase64);
}
  
  // ============================================================
  // Launch Puppeteer
  // ============================================================
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    
    // ============================================================
    // Process Each Post
    // ============================================================
    const postsArray = posts.toArray ? posts.toArray() : posts;
    let generated = 0;
    let skipped = 0;
    
    for (const post of postsArray) {
      const slug = post.slug || '';
      const encodedSlug = encodeURIComponent(slug);
      const imagePath = path.join(publicDir, outputDir, `${encodedSlug}.png`);
      
      // Prepare data for template
      const siteName = config.title || '';
      const title = post.title || '';
      const date = post.date ? post.date.format('YYYY-MM-DD') : '';
      const tags = post.tags ? post.tags.map(t => t.name || t) : [];
      
      // Get article excerpt, strip HTML, truncate to 150 chars
      let description = post.excerpt || '';
      // Strip HTML tags
      description = description.replace(/<[^>]*>/g, '');
      description = description.substring(0, 150);
      
      // ============================================================
      // Incremental Strategy: Compare Hash
      // ============================================================
      const hashInput = `${title}|${date}|${tags.join(',')}|${description}|${siteName}`;
      // Add image content hash
      let imageHash = '';
      if (fs.existsSync(reflectionPath)) {
        const reflectionBuffer = fs.readFileSync(reflectionPath);
        imageHash = crypto.createHash('md5').update(reflectionBuffer).digest('hex');
      }
      const hash = crypto.createHash('md5').update(`${hashInput}|${imageHash}`).digest('hex');
      
      if (cache[slug] === hash && fs.existsSync(imagePath)) {
        skipped++;
        continue;
      }
      
      // ============================================================
      // Render Template & Screenshot
      // ============================================================
      const html = ejs.render(template, {
        title,
        date,
        tags,
        siteName,
        description,
        css
      });
      
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Wait for fonts to load
      await page.evaluate(() => document.fonts.ready);
      
      await page.screenshot({
        path: imagePath,
        type: 'png'
      });
      
      // Update cache
      cache[slug] = hash;
      generated++;
    }
    
    // ============================================================
    // Save Cache
    // ============================================================
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
    
    console.log(`[og-image] Generated: ${generated}, Skipped: ${skipped}`);
    
  } finally {
    await browser.close();
  }
}

// Register as after_generate filter
hexo.extend.filter.register('after_generate', generateOgImages);
