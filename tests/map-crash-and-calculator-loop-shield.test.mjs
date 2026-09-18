import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const forwarderWorkspacePath = path.join(projectRoot, 'src/components/ForwarderWorkspace.jsx');
const forwarderWorkspaceSource = fs.readFileSync(forwarderWorkspacePath, 'utf8');

const lazyMapPath = path.join(projectRoot, 'src/components/LazyGlobeMap.tsx');
const lazyMapSource = fs.readFileSync(lazyMapPath, 'utf8');

const indexHtmlPath = path.join(projectRoot, 'index.html');
const indexHtmlSource = fs.readFileSync(indexHtmlPath, 'utf8');

function normalizeStr(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const detectFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+detectCargoPackagingType[\s\S]*?\n\}/);
const detectCargoPackagingType = new Function('normalizeStr', `${detectFnMatch[0].replace('export function detectCargoPackagingType', 'return function detectCargoPackagingType')}`)(normalizeStr);

test('1. Freno al Bucle Infinito: ForwarderWorkspace uses useRef and JSON.stringify deep compare for autoCalculateEstimates', () => {
  // useRef declared for deep comparison of items
  assert.match(
    forwarderWorkspaceSource,
    /const\s+lastCalculatedItemsRef\s*=\s*useRef\(['"]*['"]*\)/,
    'Must define lastCalculatedItemsRef with useRef'
  );

  // useEffect calling autoCalculateEstimates performs deep comparison check with early return
  assert.match(
    forwarderWorkspaceSource,
    /const\s+currentItemsString\s*=\s*JSON\.stringify\(cargoItems\)[\s\S]*?if\s*\(\s*lastCalculatedItemsRef\.current\s*===\s*currentItemsString\s*\)\s*\{\s*return;\s*\}[\s\S]*?lastCalculatedItemsRef\.current\s*=\s*currentItemsString[\s\S]*?autoCalculateEstimates\(cargoItems\)/,
    'useEffect must compare current JSON.stringify(cargoItems) against lastCalculatedItemsRef and abort re-calculation if unchanged'
  );

  // autoCalculateEstimates keeps lastCalculatedItemsRef synchronized
  assert.match(
    forwarderWorkspaceSource,
    /lastCalculatedItemsRef\.current\s*=\s*JSON\.stringify\(items\)/,
    'autoCalculateEstimates must update lastCalculatedItemsRef on calculation execution'
  );
});

test('2. Freno al Bucle Infinito: sync-road fetch in ForwarderWorkspace is shielded with deep compare ref', () => {
  assert.match(
    forwarderWorkspaceSource,
    /const\s+lastRoadSyncPayloadRef\s*=\s*useRef\(['"]*['"]*\)/,
    'Must define lastRoadSyncPayloadRef with useRef'
  );

  assert.match(
    forwarderWorkspaceSource,
    /lastRoadSyncPayloadRef\.current\s*!==\s*currentRoadSyncKey/,
    'Must guard roadSyncFn dispatch by checking if payload key is different from lastRoadSyncPayloadRef'
  );
});

test('3. Proteger el Mapa: ForwarderWorkspace and Map components implement map.remove() in cleanup and early return on missing container', () => {
  // LandCharterMap / ForwarderRouteMap component exists and is exported
  assert.match(
    forwarderWorkspaceSource,
    /export\s+function\s+LandCharterMap\s*\(/,
    'Must export LandCharterMap component'
  );
  assert.match(
    forwarderWorkspaceSource,
    /export\s+const\s+ForwarderRouteMap\s*=\s*LandCharterMap/,
    'Must alias ForwarderRouteMap to LandCharterMap'
  );

  // Early return if container doesn't exist to prevent appendChild errors
  assert.match(
    forwarderWorkspaceSource,
    /if\s*\(\s*!container\s*\)\s*\{\s*return;\s*\}/,
    'Map component must check if container exists and return early to avoid appendChild crashes'
  );

  // Cleanup destroys previous map instance before new one or on unmount
  assert.match(
    forwarderWorkspaceSource,
    /mapInstance(?:Ref\.current)?\.remove\(\)/,
    'Map component must invoke map.remove() in cleanup'
  );

  // ForwarderWorkspace workspace-level map effect guards against unmounted DOM
  assert.match(
    forwarderWorkspaceSource,
    /\/\/ Proteger el Mapa[\s\S]*?if\s*\(\s*!container\s*\)\s*return;[\s\S]*?mapInstanceRef\.current\.remove\(\)/,
    'ForwarderWorkspace must include map cleanup hook invoking map.remove()'
  );
});

test('4. Proteger el Mapa: LazyGlobeMap and index.html verify container existence and cleanup map instances', () => {
  // LazyGlobeMap checks container existence
  assert.match(
    lazyMapSource,
    /const\s+container\s*=\s*typeof\s+map\.getContainer\s*===\s*['"]function['"]\s*\?\s*map\.getContainer\(\)\s*:\s*null;\s*if\s*\(\s*!container\s*\)\s*return;/,
    'RouteAutoFitter must check map.getContainer() before attaching'
  );
  assert.match(
    lazyMapSource,
    /GlobalLeafletMap\.remove\(\)/,
    'LazyGlobeMap must invoke remove() on previous map instance in cleanup'
  );

  // index.html initMap destroys previous map instance with map.remove()
  assert.match(
    indexHtmlSource,
    /async\s+function\s+initMap\(\)\s*\{[\s\S]*?const\s+mapContainer\s*=\s*document\.getElementById\(['"]map-container['"]\);[\s\S]*?if\s*\(\s*!mapContainer\s*\)\s*return;[\s\S]*?if\s*\(\s*map\s*\)\s*\{[\s\S]*?map\.remove\(\)/,
    'index.html initMap must check mapContainer and destroy existing map instance with map.remove()'
  );
});

test('5. Blindar el NLP: React hydration strictly forces Camión Plataforma con Grúa Autocarga for Big Bag and blocks bulk fallback', () => {
  // Check in useEffect([activeProject])
  assert.match(
    forwarderWorkspaceSource,
    /const\s+isBigBagDetected\s*=\s*\/big\\s\*bag\/i\.test\(nlpOrCargoText\)/,
    'React hydration must test for "big bag" case-insensitively across project fields'
  );
  assert.match(
    forwarderWorkspaceSource,
    /if\s*\(\s*isBigBagDetected\s*\)\s*\{[\s\S]*?setVehicleType\(['"]Camión Plataforma con Grúa Autocarga['"]\)[\s\S]*?setLoadingMethod\(['"]Autocarga con Grúa del Camión['"]\)[\s\S]*?setDischargeMethod\(['"]Autocarga con Grúa del Camión['"]\)/,
    'React hydration must enforce Camión Plataforma con Grúa Autocarga when big bag is detected'
  );

  // Check in handleSyncDataBridge
  assert.match(
    forwarderWorkspaceSource,
    /handleSyncDataBridge[\s\S]*?const\s+isBigBagDetected\s*=\s*\/big\\s\*bag\/i\.test\(nlpOrCargoText\)[\s\S]*?setVehicleType\(['"]Camión Plataforma con Grúa Autocarga['"]\)/,
    'handleSyncDataBridge must enforce Camión Plataforma con Grúa Autocarga on sync hydration'
  );

  // Check that bulk fallback is strictly blocked when big bag is present
  const bigBagWithBulkWord = [{ type: '1000 big bags de cemento a granel' }];
  const res = detectCargoPackagingType(bigBagWithBulkWord, null);
  assert.equal(res.isPackaged, true, 'Big bag must be packaged even if text contains "granel"');
  assert.equal(res.isBulk, false, 'Big bag must never be bulk');
  assert.equal(res.recommendedVehicle, 'Camión Plataforma con Grúa Autocarga', 'Must force Camión Plataforma con Grúa Autocarga');
});

test('6. Aislamiento: autoCalculateEstimates, handleRecalculate, and stowing calculations remain intact', () => {
  assert.match(
    forwarderWorkspaceSource,
    /const\s+autoCalculateEstimates\s*=\s*\(items\)\s*=>\s*\{/,
    'autoCalculateEstimates function must remain defined'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+handleRecalculate\s*=\s*async\s*\(\)\s*=>\s*\{/,
    'handleRecalculate function must remain defined'
  );
  assert.match(
    forwarderWorkspaceSource,
    /calculateUniversalStowagePlan/,
    'Stowage plan calculations must remain active and connected'
  );
});
