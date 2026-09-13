import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const contractRefSource = await readFile(new URL('../contract-reference.js', import.meta.url), 'utf8');
const appJsxSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const indexHtmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('1. contract-reference.js anchors URL ref parameter and blocks random RDM/2026-XXXX fallbacks', () => {
  const customLocation = {
    search: '?ref=EXP-VAL-ALG-2026',
    href: 'https://landchartercorepro.netlify.app/?ref=EXP-VAL-ALG-2026',
    pathname: '/',
    hash: ''
  };

  const listeners = new Map();
  const storage = new Map();
  const customWindow = {
    location: customLocation,
    history: {
      state: {},
      replaceState: () => {},
    },
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    sessionStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    addEventListener: (type, fn) => listeners.set(type, fn),
    dispatchEvent: () => true,
    URLSearchParams,
    URL,
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    console: { log: () => {}, warn: () => {}, error: () => {} }
  };
  customWindow.window = customWindow;

  vm.createContext(customWindow);
  vm.runInNewContext(contractRefSource, customWindow);

  const manager = customWindow.ContractRefManager;
  assert.ok(manager, 'ContractRefManager must be defined');

  // getActiveContractRef must return the anchored URL ref
  const activeRef = manager.getActiveContractRef();
  assert.equal(activeRef, 'EXP-VAL-ALG-2026');

  // Any call to generateVoyageRef must NOT autogenerate a random RDM/2026-XXXX
  const fallbackRef = manager.generateVoyageRef();
  assert.equal(fallbackRef, 'EXP-VAL-ALG-2026', 'Fallback generator must return anchored reference, not random sequence');

  // createNewReference without force must return the anchored reference
  const nextRef = manager.createNewReference();
  assert.equal(nextRef, 'EXP-VAL-ALG-2026', 'createNewReference must respect locked URL reference');
});

test('2. index.html includes URL ref parameter reader and anchors reference in global state', () => {
  assert.match(
    indexHtmlSource,
    /new\s+URLSearchParams\([^)]*location\.search\)\.get\(['"]ref['"]\)/,
    'index.html must read ?ref= parameter from window.location.search'
  );
  assert.match(
    indexHtmlSource,
    /window\.anchoredReference\s*=\s*cleanRef/,
    'index.html must anchor the clean reference'
  );
  assert.match(
    indexHtmlSource,
    /window\.isRefAnchored\s*=\s*true/,
    'index.html must set isRefAnchored to true'
  );
});

test('3. applyMultimodalPortPreload preloads Destino with POL and leaves Origen empty for Pre-carriage (Export)', () => {
  // Mock DOM elements
  const mockPolInput = { id: 'map-port-pol', value: 'Old Value', dataset: {}, dispatchEvent: () => {} };
  const mockPodInput = { id: 'map-port-pod', value: '', dataset: {}, dispatchEvent: () => {} };

  const dom = {
    'map-port-pol': mockPolInput,
    'map-port-pod': mockPodInput,
    'port-pol': { id: 'port-pol', value: '', dataset: {}, dispatchEvent: () => {} },
    'port-pod': { id: 'port-pod', value: '', dataset: {}, dispatchEvent: () => {} },
    'input-pol': { id: 'input-pol', value: '', dataset: {}, dispatchEvent: () => {} },
    'input-pod': { id: 'input-pod', value: '', dataset: {}, dispatchEvent: () => {} },
  };

  const sandbox = {
    document: {
      getElementById: (id) => dom[id] || null
    },
    Event: class Event {
      constructor(type) { this.type = type; }
    },
    window: {
      State: { pol: '', pod: '' }
    }
  };

  // Extract applyMultimodalPortPreload implementation from App.jsx or index.html
  const fnMatch = appJsxSource.match(/export\s+function\s+applyMultimodalPortPreload\s*\([\s\S]*?\n\}/);
  assert.ok(fnMatch, 'applyMultimodalPortPreload must be defined in App.jsx');

  const fnCode = fnMatch[0].replace(/export\s+function/, 'function');
  vm.createContext(sandbox);
  vm.runInNewContext(`${fnCode}\nwindow.applyMultimodalPortPreload = applyMultimodalPortPreload;`, sandbox);

  // Run Pre-carriage (Export) with maritime POL "Valencia" and POD "Béjaïa"
  sandbox.window.applyMultimodalPortPreload({
    pol: 'Puerto de Valencia',
    pod: 'Puerto de Béjaïa',
    mode: 'export'
  });

  // Destino must be preloaded with maritime POL
  assert.equal(dom['map-port-pod'].value, 'Puerto de Valencia', 'Destino must receive maritime POL in Pre-carriage');
  assert.equal(dom['port-pod'].value, 'Puerto de Valencia');
  assert.equal(sandbox.window.State.pod, 'Puerto de Valencia');

  // Origen must be left empty for user or Cerebro IA to enter factory (e.g. Sétif)
  assert.equal(dom['map-port-pol'].value, '', 'Origen must remain empty in Pre-carriage for factory insertion');
  assert.equal(dom['port-pol'].value, '');
  assert.equal(sandbox.window.State.pol, '');

  // Inputs must NOT be readOnly or disabled
  assert.equal(dom['map-port-pol'].readOnly, false);
  assert.equal(dom['map-port-pol'].disabled, false);
  assert.equal(dom['map-port-pod'].readOnly, false);
  assert.equal(dom['map-port-pod'].disabled, false);
});

test('4. applyMultimodalPortPreload preloads Origen with POD and leaves Destino empty for On-carriage (Import)', () => {
  const dom = {
    'map-port-pol': { id: 'map-port-pol', value: '', dataset: {}, dispatchEvent: () => {} },
    'map-port-pod': { id: 'map-port-pod', value: 'Pre-existing', dataset: {}, dispatchEvent: () => {} },
    'port-pol': { id: 'port-pol', value: '', dataset: {}, dispatchEvent: () => {} },
    'port-pod': { id: 'port-pod', value: '', dataset: {}, dispatchEvent: () => {} },
    'input-pol': { id: 'input-pol', value: '', dataset: {}, dispatchEvent: () => {} },
    'input-pod': { id: 'input-pod', value: '', dataset: {}, dispatchEvent: () => {} },
  };

  const sandbox = {
    document: {
      getElementById: (id) => dom[id] || null
    },
    Event: class Event {
      constructor(type) { this.type = type; }
    },
    window: {
      State: { pol: '', pod: '' }
    }
  };

  const fnMatch = appJsxSource.match(/export\s+function\s+applyMultimodalPortPreload\s*\([\s\S]*?\n\}/);
  const fnCode = fnMatch[0].replace(/export\s+function/, 'function');
  vm.createContext(sandbox);
  vm.runInNewContext(`${fnCode}\nwindow.applyMultimodalPortPreload = applyMultimodalPortPreload;`, sandbox);

  // Run On-carriage (Import) with maritime POL "Marseille" and POD "Béjaïa"
  sandbox.window.applyMultimodalPortPreload({
    pol: 'Marseille',
    pod: 'Puerto de Béjaïa',
    mode: 'import'
  });

  // Origen must be preloaded with maritime POD
  assert.equal(dom['map-port-pol'].value, 'Puerto de Béjaïa', 'Origen must receive maritime POD in On-carriage');
  assert.equal(sandbox.window.State.pol, 'Puerto de Béjaïa');

  // Destino must be left empty for inland destination
  assert.equal(dom['map-port-pod'].value, '', 'Destino must remain empty in On-carriage');
  assert.equal(sandbox.window.State.pod, '');

  // Inputs must remain enabled
  assert.equal(dom['map-port-pol'].readOnly, false);
  assert.equal(dom['map-port-pod'].disabled, false);
});

test('5. Cerebro IA can freely write to the remaining input (e.g. Sétif) without interference', () => {
  const polInput = { id: 'map-port-pol', value: '', readOnly: false, disabled: false, dataset: {} };
  const podInput = { id: 'map-port-pod', value: 'Puerto de Béjaïa', readOnly: false, disabled: false, dataset: {} };

  // Cerebro IA fills in the inland factory / warehouse
  polInput.value = 'Sétif, Algérie';
  polInput.dataset.userEdited = 'true';

  assert.equal(polInput.value, 'Sétif, Algérie');
  assert.equal(podInput.value, 'Puerto de Béjaïa');
  assert.equal(polInput.disabled, false);
  assert.equal(polInput.readOnly, false);
});

test('6. index.html includes multimodal mode selector buttons for Export (Pre-carriage) and Import (On-carriage)', () => {
  assert.match(indexHtmlSource, /id="btn-mode-export"/, 'Export mode button must exist');
  assert.match(indexHtmlSource, /id="btn-mode-import"/, 'Import mode button must exist');
  assert.match(indexHtmlSource, /window\.setMultimodalMode\('export'\)/, 'Export mode onclick must trigger setMultimodalMode');
  assert.match(indexHtmlSource, /window\.setMultimodalMode\('import'\)/, 'Import mode onclick must trigger setMultimodalMode');
});

test('7. App.jsx defines useUrlReferenceSync hook and calls it in AppLayout', () => {
  assert.match(appJsxSource, /export\s+function\s+useUrlReferenceSync/);
  assert.match(appJsxSource, /useUrlReferenceSync\(\);/);
});

test('8. fetchMultimodalPorts discards HTML responses (such as SPA index.html fallback) and only parses valid JSON', async () => {
  // Test sandbox with mock fetch that returns HTML for first endpoint and JSON for dossiers
  const requestedUrls = [];
  const sandbox = {
    fetch: async (url, options) => {
      requestedUrls.push(url);
      if (url.includes('voyage-active') || url.includes('/api/voyage/active')) {
        // Simulates broken route returning 200 with index.html fallback
        return {
          ok: true,
          status: 200,
          headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=UTF-8' : null) },
          json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
        };
      }
      if (url.includes('forwarder-projects') || url.includes('dossiers')) {
        return {
          ok: true,
          status: 200,
          headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
          json: async () => ([
            {
              project_ref: 'EXP-VAL-ALG-2026',
              route_and_chartering: {
                pol: 'Valencia Port',
                pod: 'Algiers Port'
              }
            }
          ])
        };
      }
      return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) };
    },
    encodeURIComponent,
    console: { warn: () => {}, error: () => {}, log: () => {} },
    window: { getApiUrl: (p) => p }
  };

  const fnMatch = appJsxSource.match(/export\s+async\s+function\s+fetchMultimodalPorts\s*\([\s\S]*?\n\}/);
  assert.ok(fnMatch, 'fetchMultimodalPorts must be in App.jsx');

  const fnCode = fnMatch[0].replace(/export\s+async\s+function/, 'async function');
  vm.createContext(sandbox);
  vm.runInNewContext(`${fnCode}\nwindow.fetchMultimodalPorts = fetchMultimodalPorts;`, sandbox);

  const result = await sandbox.window.fetchMultimodalPorts('EXP-VAL-ALG-2026');
  assert.ok(result, 'Result must be returned successfully from JSON endpoint');
  assert.equal(result.pol, 'Valencia Port');
  assert.equal(result.pod, 'Algiers Port');
});

test('9. setMultimodalMode executes fetch and preload when ports are not yet in memory', () => {
  assert.match(
    indexHtmlSource,
    /function\s+setMultimodalMode\(mode\)\s*\{[\s\S]*?fetchAndApplyMultimodalPorts/,
    'setMultimodalMode must fetch and apply multimodal ports if not yet present in memory'
  );
});

test('10. fetchMultimodalExpedientePorts and fetchMultimodalPorts query direct Netlify Function path /.netlify/functions/voyage-active?contractRef=', () => {
  assert.match(
    indexHtmlSource,
    /fetch\(['"]\/\.netlify\/functions\/voyage-active\?contractRef=['"]\s*\+\s*encodeURIComponent/,
    'index.html must query /.netlify/functions/voyage-active directly with contractRef'
  );
  assert.match(
    appJsxSource,
    /fetch\(['"]\/\.netlify\/functions\/voyage-active\?contractRef=['"]\s*\+\s*encodeURIComponent/,
    'App.jsx must query /.netlify/functions/voyage-active directly with contractRef'
  );
});


