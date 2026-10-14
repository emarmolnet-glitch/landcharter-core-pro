import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../src/global-splash-screen.js', import.meta.url), 'utf8');

test('global splash covers the complete interface from the first body paint', () => {
  assert.match(indexSource, /<body class="[^"]*bg-slate-900[^"]*" data-app-ready="false" aria-busy="true">/);
  assert.match(indexSource, /id="global-splash-screen" class="fixed inset-0 z-50 bg-slate-900"/);
  assert.match(indexSource, /id="global-splash-status"/);
  assert.match(indexSource, /#global-splash-screen \{[\s\S]*position: fixed;[\s\S]*inset: 0;[\s\S]*z-index: 2147483000 !important;/);
});

test('startup controller keeps the map mounted behind the splash', () => {
  assert.match(controllerSource, /window\.ensureRouteMapReady\('map-host'\)/);
  assert.match(controllerSource, /mapContainer\.dataset\.renderKey !== 'mounted'/);
  assert.match(controllerSource, /mapContainer\.querySelector\('canvas'\)/);
  assert.match(controllerSource, /new ResizeObserver\(scheduleMount\)/);
  assert.doesNotMatch(controllerSource, /display\s*=\s*['"]none|remove\(\)/);
});

test('startup controller releases the interface after WebGL or a safe timeout', () => {
  assert.match(controllerSource, /complete\('webgl-mounted'\)/);
  assert.match(controllerSource, /const STARTUP_TIMEOUT_MS = 15000/);
  assert.match(controllerSource, /complete\('startup-timeout'\)/);
  assert.match(controllerSource, /document\.body\.dataset\.appReady = 'true'/);
  assert.match(controllerSource, /seacharter:app-ready/);
});

test('global splash renders the official combined identity: active LandCharter Core PRO sub-brand and CHARTER CORE PRO master brand', () => {
  // Active Sub-Brand block with direct clean 100px circular container with #f0f6f8 background and clean typography below
  assert.match(indexSource, /<img\s+src="\/assets\/landcharter-icon\.png"\s+alt="LandCharter Logo"/, 'Must render official LandCharter image tag with landcharter-icon.png');
  assert.match(indexSource, /width:\s*100px;\s*height:\s*100px;\s*border-radius:\s*50%;\s*overflow:\s*hidden;/, 'Must render 100px circular container');
  assert.match(indexSource, /background:\s*#f0f6f8;/, 'Must have #f0f6f8 background for seamless corner blending');
  assert.match(indexSource, /box-shadow:\s*0\s+10px\s+30px\s+rgba\(10,\s*35,\s*44,\s*0\.12\);/, 'Must have adjusted subtle shadow');
  assert.match(indexSource, /width:\s*100%;\s*height:\s*100%;\s*object-fit:\s*cover;/, 'Must style image with width: 100%; height: 100%; object-fit: cover;');
  assert.match(indexSource, /LandCharter<\/div>\s*<div[^>]*>Core PRO<\/div>/, 'Must render LandCharter Core PRO sub-brand text');

  // Loading state block without duplicate title, preserving status and progress bar
  assert.doesNotMatch(indexSource, /<p class="global-splash__title">/, 'Duplicate title must be removed from splash screen');
  assert.match(indexSource, /<p id="global-splash-status" class="global-splash__status">Preparando logística terrestre\.\.\.<\/p>/);
  assert.match(indexSource, /<div class="global-splash__progress" aria-hidden="true"><\/div>/);

  // Master Brand block
  assert.match(indexSource, /id="masterGradLand"/, 'Must define master brand linearGradient id masterGradLand');
  assert.match(indexSource, /CHARTER<\/div>\s*<div[^>]*>\s*<span[^>]*>CORE<\/span>\s*<span[^>]*>PRO<\/span>/, 'Must render CHARTER CORE PRO master brand text');
});
