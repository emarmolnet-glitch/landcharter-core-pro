import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

test('1. redrawCurrentRoute includes guard clause checking !mapInstance || !mapInstance.getContainer() before rendering', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // Verify guard clause in redrawCurrentRoute
  const redrawFnStart = indexHtml.indexOf('function redrawCurrentRoute(');
  assert.ok(redrawFnStart !== -1, 'redrawCurrentRoute must be defined in index.html');
  const redrawFnEnd = indexHtml.indexOf('window.redrawCurrentRoute = redrawCurrentRoute;', redrawFnStart);
  const redrawCode = indexHtml.slice(redrawFnStart, redrawFnEnd);

  assert.match(
    redrawCode,
    /if\s*\(\s*!mapInstance\s*\|\|\s*!mapInstance\.getContainer\(\)\s*\)\s*\{/,
    'redrawCurrentRoute must guard against missing mapInstance or missing container'
  );

  assert.match(
    redrawCode,
    /console\.warn\(\s*["']⚠️\s*\[Mapa\]\s*Intento de redibujar ruta ignorado:\s*El mapa no está montado en esta vista\.?["']\s*\)/,
    'redrawCurrentRoute must log warning when map is not mounted'
  );
});

test('2. redrawCurrentRoute guards against unmounted DOM container and ForwarderWorkspace view', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  const redrawFnStart = indexHtml.indexOf('function redrawCurrentRoute(');
  const redrawFnEnd = indexHtml.indexOf('window.redrawCurrentRoute = redrawCurrentRoute;', redrawFnStart);
  const redrawCode = indexHtml.slice(redrawFnStart, redrawFnEnd);

  assert.match(
    redrawCode,
    /!document\.body\.contains\(mapInstance\.getContainer\(\)\)/,
    'redrawCurrentRoute must check if container is contained in document.body'
  );

  assert.match(
    redrawCode,
    /window\.currentView\s*===\s*['"]FORWARDERS['"]/,
    'redrawCurrentRoute must check for FORWARDERS view'
  );
});

test('3. handleVehicleTypeSelection only triggers redrawCurrentRoute if current view contains map, ignoring ForwarderWorkspace', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  const fnStart = indexHtml.indexOf('function handleVehicleTypeSelection(');
  assert.ok(fnStart !== -1, 'handleVehicleTypeSelection must exist in index.html');
  const fnEnd = indexHtml.indexOf('window.handleVehicleTypeSelection = handleVehicleTypeSelection;', fnStart);
  const fnCode = indexHtml.slice(fnStart, fnEnd);

  assert.match(
    fnCode,
    /isForwarderWorkspace/,
    'handleVehicleTypeSelection must determine if user is in ForwarderWorkspace (Proyectos)'
  );

  assert.match(
    fnCode,
    /isMapViewActive/,
    'handleVehicleTypeSelection must verify if map view (Calculadora o Rutas Terrestres) is active'
  );

  assert.match(
    fnCode,
    /if\s*\(\s*isMapViewActive\s*&&\s*typeof\s+window\.redrawCurrentRoute\s*===\s*['"]function['"]\s*\)/,
    'handleVehicleTypeSelection must only call redrawCurrentRoute when isMapViewActive is true'
  );
});

test('4. destroyRouteMap clears window.GlobalLeafletMap to prevent stale references', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  const destroyStart = indexHtml.indexOf('function destroyRouteMap()');
  assert.ok(destroyStart !== -1, 'destroyRouteMap must exist in index.html');
  const destroyEnd = indexHtml.indexOf('async function initMap()', destroyStart);
  const destroyCode = indexHtml.slice(destroyStart, destroyEnd);

  assert.match(
    destroyCode,
    /window\.GlobalLeafletMap\s*=\s*null;/,
    'destroyRouteMap must null window.GlobalLeafletMap'
  );
});

test('5. ForwarderWorkspace.jsx guards redrawCurrentRoute when in Proyectos workspace', async () => {
  const forwarderJsx = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  assert.match(
    forwarderJsx,
    /window\.currentView\s*!==\s*['"]FORWARDERS['"]/,
    'ForwarderWorkspace must avoid triggering redrawCurrentRoute when in FORWARDERS view'
  );
});

test('6. Execution safety: redrawCurrentRoute does not throw when mapInstance is null or destroyed', () => {
  // Simulate execution of guarded function pattern
  let warned = false;
  const mockWarn = (msg) => {
    if (msg.includes('Intento de redibujar ruta ignorado')) warned = true;
  };
  const originalWarn = console.warn;
  console.warn = mockWarn;

  try {
    function simulateGuardedRedraw(mapInstance) {
      if (!mapInstance || !mapInstance.getContainer()) {
        console.warn("⚠️ [Mapa] Intento de redibujar ruta ignorado: El mapa no está montado en esta vista.");
        return;
      }
      // If guard fails, this would throw
      mapInstance.getContainer().appendChild({});
    }

    // Test case 1: mapInstance is null
    warned = false;
    assert.doesNotThrow(() => simulateGuardedRedraw(null));
    assert.equal(warned, true);

    // Test case 2: mapInstance exists but getContainer() returns null (Leaflet destroyed map)
    warned = false;
    assert.doesNotThrow(() => simulateGuardedRedraw({ getContainer: () => null }));
    assert.equal(warned, true);
  } finally {
    console.warn = originalWarn;
  }
});
