import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('1. index.html defines guard clauses (!lat || !lng || isNaN) in renderPortOnMap', () => {
  assert.match(
    indexHtml,
    /function renderPortOnMap\s*\(\s*mapInstance,\s*port,\s*type\s*\)\s*\{[\s\S]*?const lat = Number\([\s\S]*?\);[\s\S]*?const lng = Number\([\s\S]*?\);[\s\S]*?if\s*\(\s*!lat\s*\|\|\s*!lng\s*\|\|\s*isNaN\(lat\)\s*\|\|\s*isNaN\(lng\)/,
    'renderPortOnMap must have early return checking !lat || !lng || isNaN(lat) || isNaN(lng)'
  );
});

test('2. index.html checks mapInstance._loaded before attempting Leaflet render', () => {
  assert.match(
    indexHtml,
    /if\s*\(\s*!mapInstance\s*\|\|\s*!mapInstance\._loaded\s*\)\s*return false;/,
    'renderPortOnMap must check if (!mapInstance || !mapInstance._loaded) return false;'
  );
  assert.match(
    indexHtml,
    /if\s*\(\s*!routeMap\s*\|\|\s*!routeMap\._loaded\s*\)\s*return false;/,
    'renderMasterRouteMap must check if (!routeMap || !routeMap._loaded) return false;'
  );
});

test('3. index.html wraps Leaflet circleMarker and marker creation in defensive try/catch', () => {
  assert.match(
    indexHtml,
    /try\s*\{[\s\S]*?marker\s*=\s*L\.circleMarker\([\s\S]*?marker\.addTo\([\s\S]*?\}\s*catch\s*\(\s*e\s*\)\s*\{[\s\S]*?console\.warn\(\s*['"]Leaflet render skipped due to missing bounds\/renderer:['"]/,
    'renderPortOnMap must wrap circleMarker and addTo in try/catch logging missing bounds/renderer'
  );
  assert.match(
    indexHtml,
    /console\.warn\(\s*['"]Leaflet render skipped due to missing bounds\/renderer:['"]/,
    'route L.marker must wrap creation in try/catch logging missing bounds/renderer'
  );
});

test('4. renderPortOnMap simulated execution returns false when map._loaded is false or coordinates are missing', () => {
  let circleMarkerCalled = false;
  let addToCalled = false;

  const mockL = {
    circleMarker: (coords, opts) => {
      circleMarkerCalled = true;
      const marker = {
        _map: null,
        addTo: (map) => {
          addToCalled = true;
          marker._map = map;
          return marker;
        },
        bindPopup: () => marker,
        bindTooltip: () => marker
      };
      return marker;
    }
  };

  const fnMatch = indexHtml.match(/function renderPortOnMap\s*\([\s\S]*?\n\s{12}\}/);
  assert.ok(fnMatch, 'renderPortOnMap function should be found in index.html');

  const checkReady = () => true;
  const cleanDynamicLayers = () => {};
  const isMapboxRouteMap = () => false;
  const state = { densityMap: null };
  const aisMap = null;

  const renderPortOnMap = new Function(
    'L', 'checkReady', 'cleanDynamicLayers', 'isMapboxRouteMap', 'state', 'aisMap',
    `return ${fnMatch[0]}`
  )(mockL, checkReady, cleanDynamicLayers, isMapboxRouteMap, state, aisMap);

  // Unloaded map instance
  const mockUnloadedMap = {
    _loaded: false,
    _panes: { tooltipPane: {} },
    eachLayer: () => {},
    removeLayer: () => {},
    hasLayer: () => true
  };

  // Loaded map instance
  const mockLoadedMap = {
    _loaded: true,
    _panes: { tooltipPane: {} },
    eachLayer: () => {},
    removeLayer: () => {},
    hasLayer: () => true
  };

  // Test 1: Unloaded map returns false
  assert.equal(renderPortOnMap(mockUnloadedMap, { lat: 36.14, lon: -5.35, name: 'Algeciras' }, 'POL'), false);
  assert.equal(circleMarkerCalled, false);

  // Test 2: null port
  assert.equal(renderPortOnMap(mockLoadedMap, null, 'POL'), false);
  assert.equal(circleMarkerCalled, false);

  // Test 3: undefined coordinates
  assert.equal(renderPortOnMap(mockLoadedMap, { lat: undefined, lon: undefined }, 'POL'), false);
  assert.equal(circleMarkerCalled, false);

  // Test 4: null coordinates
  assert.equal(renderPortOnMap(mockLoadedMap, { lat: null, lon: null }, 'POD'), false);
  assert.equal(circleMarkerCalled, false);

  // Test 5: NaN coordinates
  assert.equal(renderPortOnMap(mockLoadedMap, { lat: NaN, lon: 10 }, 'POL'), false);
  assert.equal(circleMarkerCalled, false);

  // Test 6: Valid coordinates with loaded map
  const validResult = renderPortOnMap(mockLoadedMap, { lat: 36.14, lon: -5.35, name: 'Algeciras' }, 'POL');
  assert.equal(validResult, true);
  assert.equal(circleMarkerCalled, true);
  assert.equal(addToCalled, true);
});

test('5. renderPortOnMap catches Leaflet bounds/renderer intersects crash gracefully', () => {
  const mockCrashingL = {
    circleMarker: () => {
      const marker = {
        addTo: () => {
          throw new TypeError("Cannot read properties of undefined (reading 'intersects')");
        }
      };
      return marker;
    }
  };

  const mockLoadedMap = {
    _loaded: true,
    _panes: { tooltipPane: {} },
    eachLayer: () => {},
    removeLayer: () => {},
    hasLayer: () => true
  };

  const fnMatch = indexHtml.match(/function renderPortOnMap\s*\([\s\S]*?\n\s{12}\}/);
  const checkReady = () => true;
  const cleanDynamicLayers = () => {};
  const isMapboxRouteMap = () => false;
  const state = { densityMap: null };
  const aisMap = null;

  const renderPortOnMap = new Function(
    'L', 'checkReady', 'cleanDynamicLayers', 'isMapboxRouteMap', 'state', 'aisMap',
    `return ${fnMatch[0]}`
  )(mockCrashingL, checkReady, cleanDynamicLayers, isMapboxRouteMap, state, aisMap);

  assert.doesNotThrow(() => {
    const res = renderPortOnMap(mockLoadedMap, { lat: 41.38, lon: 2.17, name: 'Barcelona' }, 'POL');
    assert.equal(res, false);
  });
});
