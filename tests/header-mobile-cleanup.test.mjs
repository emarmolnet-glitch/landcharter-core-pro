import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Header parent container aligns items to end on mobile and between on desktop', () => {
  const headerMatch = indexSource.match(/<header class="app-header[\s\S]*?<\/header>/);
  assert.ok(headerMatch, 'header.app-header must be present');
  const headerHtml = headerMatch[0];

  assert.match(
    headerHtml,
    /<header class="app-header[^"]*\bjustify-end\b[^"]*\bmd:justify-between\b[^"]*"/,
    'Header parent must have justify-end for mobile and md:justify-between for desktop'
  );
  assert.match(
    headerHtml,
    /<header class="app-header[^"]*\bitems-center\b[^"]*"/,
    'Header parent must maintain items-center'
  );
});

test('Logo and title container is hidden on mobile (< 768px) with hidden md:flex', () => {
  assert.match(
    indexSource,
    /<div class="hidden md:flex items-center gap-3">[\s\S]*?Land Charter Core PRO[\s\S]*?<\/div>/,
    'Logo and title container must have hidden md:flex'
  );
});

test('Search container is hidden on mobile (< 768px) with hidden md:flex', () => {
  assert.match(
    indexSource,
    /<div id="header-vessel-search-container"[^>]*class="[^"]*\bhidden\b[^"]*\bmd:flex\b[^"]*"/,
    'Search container must have hidden md:flex'
  );
});

test('Voyage reference container is hidden on mobile (< 768px) with hidden md:flex', () => {
  assert.match(
    indexSource,
    /<div id="header-voyage-ref-container"[^>]*class="[^"]*\bhidden\b[^"]*\bmd:flex\b[^"]*"/,
    'Reference container must have hidden md:flex'
  );
});

test('Header actions right container remains visible with flex and contains MADRE, FAQ, and ROAD/RAIL controls', () => {
  assert.match(
    indexSource,
    /<div class="header-actions-right\s+flex\s+items-center[^"]*">/,
    'Header actions right must have flex items-center'
  );
  assert.match(
    indexSource,
    /id="btn-madre-trigger"/,
    'MADRE trigger button must be present in header'
  );
  assert.match(
    indexSource,
    /id="btn-open-faq-modal"/,
    'FAQ modal button must be present in header'
  );
  assert.match(
    indexSource,
    /id="global-view-mode-switch"/,
    'ROAD/RAIL mode switch must be present in header'
  );
});

test('CSS media query @media (max-width: 767px) ensures header actions remain visible and right-aligned', () => {
  assert.match(
    indexSource,
    /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?header\.app-header\s*\{[\s\S]*?justify-content:\s*flex-end\s*!important/,
    'Mobile CSS must align header to flex-end'
  );
  assert.match(
    indexSource,
    /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?header\.app-header\s*>\s*\.header-actions-right\s*\{[\s\S]*?display:\s*flex\s*!important/,
    'Mobile CSS must keep right actions visible as flex'
  );
});
