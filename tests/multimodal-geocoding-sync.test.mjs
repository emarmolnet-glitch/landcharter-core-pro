import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const [indexHtmlSource, appJsxSource] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
]);

test('1. index.html defines geocodeMultimodalPort and exports it to window', () => {
  assert.match(
    indexHtmlSource,
    /async\s+function\s+geocodeMultimodalPort\s*\(/,
    'index.html must define geocodeMultimodalPort'
  );
  assert.match(
    indexHtmlSource,
    /window\.geocodeMultimodalPort\s*=\s*geocodeMultimodalPort/,
    'index.html must export geocodeMultimodalPort to window'
  );
});

test('2. App.jsx exports geocodeMultimodalPort', () => {
  assert.match(
    appJsxSource,
    /export\s+async\s+function\s+geocodeMultimodalPort\s*\(/,
    'App.jsx must export geocodeMultimodalPort'
  );
  assert.match(
    appJsxSource,
    /window\.geocodeMultimodalPort\s*=\s*geocodeMultimodalPort/,
    'App.jsx must assign geocodeMultimodalPort to window'
  );
});

test('3. applyMultimodalPortPreload triggers geocoding for injected port string', () => {
  assert.match(
    indexHtmlSource,
    /geocode(?:Fn|MultimodalPort)\(polVal,\s*podInputs\[0\]/,
    'index.html must invoke geocoding for export mode with POL on podInputs'
  );
  assert.match(
    indexHtmlSource,
    /geocode(?:Fn|MultimodalPort)\(podVal,\s*polInputs\[0\]/,
    'index.html must invoke geocoding for import mode with POD on polInputs'
  );
  assert.match(
    appJsxSource,
    /geocode(?:Fn|MultimodalPort)\(polValue,\s*podInputs\[0\]/,
    'App.jsx must invoke geocoding for export mode'
  );
  assert.match(
    appJsxSource,
    /geocode(?:Fn|MultimodalPort)\(podValue,\s*polInputs\[0\]/,
    'App.jsx must invoke geocoding for import mode'
  );
});

test('4. fetchAndApplyMultimodalPorts awaits Nominatim promise resolution and updates portData coordinates', () => {
  assert.match(
    indexHtmlSource,
    /await\s+preloadResult\.coordsPromise/,
    'index.html fetchAndApplyMultimodalPorts must await coordsPromise'
  );
  assert.match(
    appJsxSource,
    /await\s+preloadResult\.coordsPromise/,
    'App.jsx fetchAndApplyMultimodalPorts must await coordsPromise'
  );
});

test('5. geocodeMultimodalPort resolves Bejaia (DZ) via Nominatim/dictionary and updates state and input datasets', async () => {
  const inputs = {
    'map-port-pod': { value: '', dataset: {}, dispatchEvent: () => {} },
    'port-pod': { value: '', dataset: {}, dispatchEvent: () => {} },
    'input-pod': { value: '', dataset: {}, dispatchEvent: () => {} },
    'map-port-pol': { value: '', dataset: {}, dispatchEvent: () => {} },
    'port-pol': { value: '', dataset: {}, dispatchEvent: () => {} },
    'input-pol': { value: '', dataset: {}, dispatchEvent: () => {} }
  };

  const dispatchedEvents = [];
  const postCalls = [];

  const sandbox = {
    document: {
      getElementById: (id) => inputs[id] || null
    },
    window: {
      State: {},
      GlobalStore: {},
      multimodalState: { mode: 'export' },
      app_state: {},
      dispatchEvent: (e) => dispatchedEvents.push(e)
    },
    fetch: async (url, options) => {
      if (options?.method === 'POST') {
        postCalls.push({ url, body: JSON.parse(options.body) });
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (url.includes('nominatim.openstreetmap.org')) {
        return {
          ok: true,
          json: async () => ([
            {
              lat: '36.7512',
              lon: '5.0644',
              display_name: 'Béjaïa, Daïra Béjaïa, Béjaïa, 06000, Algérie'
            }
          ])
        };
      }
      return { ok: false };
    },
    CustomEvent: function (type, init) {
      this.type = type;
      this.detail = init?.detail;
    },
    encodeURIComponent,
    console
  };

  sandbox.window.window = sandbox.window;

  // Extract geocodeMultimodalPort implementation
  const fnMatch = appJsxSource.match(/export\s+async\s+function\s+geocodeMultimodalPort\s*\([\s\S]*?\n\}/);
  assert.ok(fnMatch, 'geocodeMultimodalPort must be defined in App.jsx');

  const fnCode = fnMatch[0].replace(/export\s+async\s+function/, 'async function');
  vm.createContext(sandbox);
  vm.runInNewContext(`${fnCode}\nwindow.geocodeMultimodalPort = geocodeMultimodalPort;`, sandbox);

  const geo = await sandbox.window.geocodeMultimodalPort('Bejaia (DZ)', inputs['port-pod'], false);
  assert.ok(geo, 'Geocoding result must be returned');
  assert.equal(typeof geo.lat, 'number');
  assert.equal(typeof geo.lon, 'number');
  assert.ok(geo.lat > 36 && geo.lat < 37, 'Latitude must match Bejaia');
  assert.ok(geo.lon > 5 && geo.lon < 6, 'Longitude must match Bejaia');

  // Verify map and global state updates
  assert.ok(sandbox.window.destinationCoords, 'window.destinationCoords must be populated');
  assert.equal(sandbox.window.destinationCoords.lat, geo.lat);
  assert.equal(sandbox.window.destinationCoords.lon, geo.lon);

  assert.ok(sandbox.window.State.destinationCoords, 'State.destinationCoords must be populated');
  assert.ok(sandbox.window.GlobalStore.destinationCoords, 'GlobalStore.destinationCoords must be populated');
  assert.ok(sandbox.window.multimodalState.destinationCoords, 'multimodalState.destinationCoords must be populated');
  assert.ok(sandbox.window.app_state.destinationCoords, 'app_state.destinationCoords must be populated');
  assert.ok(sandbox.window.LandData?.destination, 'LandData.destination must be populated');
  assert.equal(sandbox.window.LandData.destination.lat, geo.lat);

  // Verify input dataset coordinates
  assert.equal(inputs['port-pod'].dataset.selectedLatitude, String(geo.lat));
  assert.equal(inputs['port-pod'].dataset.selectedLongitude, String(geo.lon));
  assert.equal(inputs['map-port-pod'].dataset.selectedLatitude, String(geo.lat));

  // Verify reactive events
  const customEvent = dispatchedEvents.find((e) => e.type === 'map:destination-updated');
  assert.ok(customEvent, 'map:destination-updated event must be dispatched');
  assert.equal(customEvent.detail.lat, geo.lat);

  // Verify remote app-state persistence call
  const appStatePost = postCalls.find((c) => c.url.includes('/api/app-state') && c.body.key === 'destinationCoords');
  assert.ok(appStatePost, 'Expected POST to /api/app-state with destinationCoords');
});

test('6. runOnDemandMapRouteWorkflow reads destinationCoords and originCoords without failing', () => {
  assert.match(
    indexHtmlSource,
    /directPod\s*=\s*normalizeCoord\(overridePod,\s*['"]Destino['"]\)\s*\|\|\s*\(typeof window !== 'undefined' && window\.destinationCoords \? normalizeCoord\(window\.destinationCoords,\s*['"]Destino['"]\) : null\)/,
    'runOnDemandMapRouteWorkflow must support destinationCoords fallback'
  );
  assert.match(
    indexHtmlSource,
    /window\.destinationCoords\?\.lat/,
    'podCoords must incorporate window.destinationCoords.lat as fallback'
  );
});
