#!/usr/bin/env node

/**
 * Graph Navigation Test Script
 * Validates contentIndex.json for correct node structure and link integrity
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'public', 'contentIndex.json');

/**
 * Extract pathname from full URL
 * @param {string} url - Full URL
 * @returns {string} Pathname portion
 */
function extractPathname(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Check if pathname matches expected Hexo pattern
 * @param {string} id - Node ID (slug)
 * @param {string} pathname - URL pathname
 * @returns {{ valid: boolean, expected: string }}
 */
function validatePathname(id, pathname) {
  // About page is special - maps to /about.html
  if (id === 'about/') {
    return {
      valid: pathname === '/about.html',
      expected: '/about.html'
    };
  }

  // Posts follow pattern: /YYYY/MM/DD/slug/ (slug may contain subdirectories)
  const postPattern = /^\/\d{4}\/\d{2}\/\d{2}\/.+\/$/;
  const expectedPath = pathname; // We expect the path to already be correct format

  return {
    valid: postPattern.test(pathname),
    expected: expectedPath
  };
}

/**
 * Main test function
 */
function runTests() {
  console.log('Testing graph navigation...');

  // Read content index
  let nodes;
  try {
    const content = fs.readFileSync(INDEX_PATH, 'utf8');
    nodes = JSON.parse(content);
  } catch (err) {
    console.error(`✗ FAILED: Cannot read contentIndex.json - ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(nodes)) {
    console.error('✗ FAILED: contentIndex.json must be an array');
    process.exit(1);
  }

  const errors = [];
  const nodeIdSet = new Set();

  // Build node ID set for link validation
  for (const node of nodes) {
    if (node.id) {
      nodeIdSet.add(node.id);
    }
  }

  // Validate each node
  for (const node of nodes) {
    const nodeId = node.id || '(unknown)';

    // Check id field exists
    if (!node.id) {
      errors.push(`✗ FAILED: node has no id field`);
      continue;
    }

    // Check path field exists
    if (!node.path) {
      errors.push(`✗ FAILED: ${nodeId} has no path field`);
      continue;
    }

    // Validate pathname format
    const pathname = extractPathname(node.path);
    const pathValidation = validatePathname(nodeId, pathname);

    if (pathValidation.valid) {
      console.log(`✓ ${nodeId}: path = ${pathname}`);
    } else {
      errors.push(`✗ FAILED: ${nodeId} path "${pathname}" does not match expected pattern`);
    }
  }

  // Validate links
  for (const node of nodes) {
    if (!node.id) continue;

    const nodeId = node.id;
    const invalidLinks = [];
    const validLinks = [];

    if (node.links && Array.isArray(node.links)) {
      for (const linkId of node.links) {
        if (nodeIdSet.has(linkId)) {
          validLinks.push(linkId);
        } else {
          invalidLinks.push(linkId);
          errors.push(`✗ FAILED: ${nodeId} has link "${linkId}" not found in nodes`);
        }
      }
    }

    const linksDisplay = validLinks.length > 0 ? validLinks.join(', ') : '(none)';
    const linkStatus = invalidLinks.length === 0 ? 'all valid' : `${invalidLinks.length} invalid`;

    console.log(`✓ ${nodeId} links: ${linksDisplay} (${linkStatus})`);
  }

  // Summary
  console.log();
  if (errors.length === 0) {
    console.log('All tests passed!');
    process.exit(0);
  } else {
    console.log(`Tests failed: ${errors.length}`);
    process.exit(1);
  }
}

// Run tests
runTests();
