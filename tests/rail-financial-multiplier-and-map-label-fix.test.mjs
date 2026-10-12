import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Erradicar Multiplicador de Flota en Tren en index.html', () => {
  const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
  const indexSource = fs.readFileSync(indexHtmlPath, 'utf8');

  // Guardado en State
  assert.match(
    indexSource,
    /State\.carrierPurchaseTotal\s*=\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*carrierPurchaseUnit\s*:\s*\(isTerrestre\s*\?\s*\(carrierPurchaseUnit\s*\*\s*fleetTrucksNeeded\)\s*:\s*\(multiplier\s*\*\s*freightBuy\)\);/,
    'State.carrierPurchaseTotal debe priorizar carrierPurchaseUnit sin multiplicar por fleetTrucksNeeded en modo ferrocarril'
  );

  // Cálculo en runEngine / scheduleReactiveEngine
  assert.match(
    indexSource,
    /buyFreightTotal:\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*carrierPurchaseUnit\s*:\s*\(isTerrestre\s*\?\s*\(carrierPurchaseUnit\s*\*\s*fleetTrucksNeeded\)/,
    'buyFreightTotal debe ser carrierPurchaseUnit directo para modo ferroviario'
  );

  assert.match(
    indexSource,
    /tce:\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*carrierPurchaseUnit\s*:\s*\(isTerrestre\s*\?\s*\(carrierPurchaseUnit\s*\*\s*fleetTrucksNeeded\)/,
    'tce debe ser carrierPurchaseUnit directo para modo ferroviario'
  );
});

test('2. Corrección Etiqueta de Distancia en Mapa (sync-miles-card)', () => {
  const detectorPath = path.resolve(process.cwd(), 'src/utils/unitSystemDetector.mjs');
  const detectorSource = fs.readFileSync(detectorPath, 'utf8');

  assert.match(
    detectorSource,
    /const\s+syncCard\s*=\s*document\.getElementById\('sync-miles-card'\);\s*if\s*\(syncCard\)\s*\{\s*const\s+headerSpan\s*=\s*syncCard\.querySelector\('span'\);\s*if\s*\(headerSpan\)\s*\{\s*headerSpan\.textContent\s*=\s*'Distancia';/,
    'unitSystemDetector.mjs debe asignar textContent = "Distancia" en sync-miles-card'
  );

  const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
  const indexSource = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.match(
    indexSource,
    /const\s+syncMilesCard\s*=\s*document\.getElementById\('sync-miles-card'\);\s*if\s*\(syncMilesCard\)\s*\{[\s\S]*?const\s+syncSpan\s*=\s*syncMilesCard\.querySelector\('span'\);\s*if\s*\(syncSpan\)\s*syncSpan\.textContent\s*=\s*'Distancia';/,
    'index.html debe asignar textContent = "Distancia" en sync-miles-card'
  );
});
