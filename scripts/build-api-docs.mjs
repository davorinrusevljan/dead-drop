#!/usr/bin/env node

/**
 * Build script for API documentation
 * Generates OpenAPI spec and Redoc HTML pages for GitHub Pages
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import Hono app and config
const { v1Router } = await import('../apps/core/src/api/v1/index.js');
const { v1OpenApiConfig } = await import('../apps/core/src/api/v1/openapi.js');

/**
 * SEO meta tags injected into the pre-rendered Redoc HTML
 */
function seoMetaTags(version) {
  return [
    '<meta name="description" content="dead-drop API documentation - Privacy-focused ephemeral data sharing. ' +
      version +
      '">',
    '<meta name="robots" content="index, follow">',
    `<link rel="canonical" href="https://davorinrusevljan.github.io/dead-drop/${version}/">`,
    '<meta property="og:title" content="dead-drop API Documentation">',
    '<meta property="og:description" content="Privacy-focused, ephemeral data-sharing API">',
    `<meta property="og:url" content="https://davorinrusevljan.github.io/dead-drop/${version}/">`,
    '<meta property="og:type" content="website">',
    '<link rel="icon" href="https://dead-drop.xyz/favicon.ico">',
  ].join('\n  ');
}

/**
 * Pre-render Redoc HTML with redoc-cli (SSR: full content in HTML, crawlable)
 */
function generateRedocHtml(version, specDir) {
  const specPath = join(specDir, 'openapi.json');
  const outPath = join(specDir, 'index.html');

  execFileSync(
    join('node_modules', '.bin', 'redocly'),
    [
      'build-docs',
      specPath,
      '--output',
      outPath,
      '--title',
      `dead-drop API - ${version}`,
      '--disableGoogleFont',
    ],
    { stdio: 'inherit', cwd: process.cwd() }
  );

  // Inject SEO meta tags after <head>
  let html = readFileSync(outPath, 'utf-8');
  html = html.replace(/<head>/, `<head>\n  ${seoMetaTags(version)}`);
  if (!html.includes('rel="canonical"')) {
    throw new Error(`SEO meta injection failed for ${version}`);
  }
  writeFileSync(outPath, html);
}

/**
 * Generate redirect HTML for root
 */
function generateRedirectHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=./latest/">
  <title>dead-drop API Documentation</title>
  <link rel="canonical" href="https://davorinrusevljan.github.io/dead-drop/latest/">
</head>
<body>
  <p>Redirecting to <a href="./latest/">latest API documentation</a>...</p>
</body>
</html>`;
}

/**
 * Main build function
 */
async function buildApiDocs() {
  console.log('📄 Building API documentation...');

  // 1. Generate OpenAPI document
  console.log('  - Generating OpenAPI spec...');
  const spec = v1Router.getOpenAPIDocument(v1OpenApiConfig);

  // 2. Enhance spec with additional SEO fields
  spec.info.termsOfService = 'https://dead-drop.xyz/terms';
  spec.info.license = {
    name: 'MIT',
    url: 'https://github.com/davorinrusevljan/dead-drop/blob/main/LICENSE',
  };
  spec.externalDocs = {
    url: 'https://dead-drop.xyz',
    description: 'dead-drop website',
  };

  // 3. Get version
  const version = spec.info.version;
  console.log(`  - API version: ${version}`);

  // 4. Setup directories
  const distDir = join(process.cwd(), 'api-docs-dist');
  const latestDir = join(distDir, 'latest');
  const versionDir = join(distDir, `v${version}`);

  mkdirSync(latestDir, { recursive: true });
  mkdirSync(versionDir, { recursive: true });

  // 5. Preserve previous versions from gh-pages if available
  const ghPagesDir = process.env.GH_PAGES_DIR;
  const existingVersions = new Set([version]);

  if (ghPagesDir && existsSync(ghPagesDir)) {
    console.log('  - Preserving previous versions from gh-pages...');

    try {
      const versionsJsonPath = join(ghPagesDir, 'versions.json');
      if (existsSync(versionsJsonPath)) {
        const versionsData = JSON.parse(readFileSync(versionsJsonPath, 'utf-8'));
        for (const v of versionsData.versions) {
          if (v !== version) {
            const src = join(ghPagesDir, `v${v}`);
            const dst = join(distDir, `v${v}`);
            if (existsSync(src)) {
              cpSync(src, dst, { recursive: true });
              existingVersions.add(v);
              console.log(`    - Preserved v${v}`);
            }
          }
        }
      }
    } catch (error) {
      console.warn('  - Warning: Could not preserve previous versions:', error.message);
    }
  }

  // 6. Write spec files
  console.log('  - Writing spec files...');
  writeFileSync(join(latestDir, 'openapi.json'), JSON.stringify(spec, null, 2));
  writeFileSync(join(versionDir, 'openapi.json'), JSON.stringify(spec, null, 2));

  // 7. Generate pre-rendered Redoc HTML pages
  console.log('  - Pre-rendering Redoc HTML pages (redoc-cli bundle)...');
  generateRedocHtml('latest', latestDir);
  generateRedocHtml(`v${version}`, versionDir);

  // 8. Generate versions.json
  console.log('  - Generating versions.json...');
  const versionsList = Array.from(existingVersions).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  writeFileSync(join(distDir, 'versions.json'), JSON.stringify({ versions: versionsList }, null, 2));

  // 9. Generate redirect index.html
  console.log('  - Generating root redirect...');
  writeFileSync(join(distDir, 'index.html'), generateRedirectHtml());

  console.log(`\n✅ API documentation built successfully!`);
  console.log(`   Output: ${distDir}`);
  console.log(`   Latest: ${latestDir}`);
  console.log(`   Version v${version}: ${versionDir}`);
  console.log(`   Versions: ${versionsList.join(', ')}`);
}

buildApiDocs().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
