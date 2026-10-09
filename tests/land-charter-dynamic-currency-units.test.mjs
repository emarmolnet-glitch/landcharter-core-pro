import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { detectUnitSystem, isUSLocation } from '../src/utils/unitSystemDetector.mjs';

const indexHtmlPath = new URL('../index.html', import.meta.url);
const voyageCostEnginePath = new URL('../voyage-cost-engine.js', import.meta.url);

const indexSource = await readFile(indexHtmlPath, 'utf8');
const scriptSource = await readFile(voyageCostEnginePath, 'utf8');

function loadVoyageCostEngine(code) {
  const sandbox = {
    window: {},
    root: {},
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.SeaCharterVoyageCostEngine || sandbox.window.SeaCharterVoyageCostEngine || {
    updateExecutiveDashboard: sandbox.updateExecutiveDashboard || sandbox.window.updateExecutiveDashboard,
  };
}

function createMockDashboardDOM() {
  const elements = new Map();
  const getOrCreate = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        textContent: '',
        innerText: '',
        value: id === 'exec-agency-margin' ? '10' : '',
        title: '',
        style: {},
        classList: {
          add: () => {},
          remove: () => {},
          toggle: () => {},
          contains: () => false,
        },
      });
    }
    return elements.get(id);
  };

  const fakeDocument = {
    activeElement: null,
    getElementById: (id) => getOrCreate(id),
    querySelectorAll: (selector) => {
      return Array.from(elements.values());
    },
  };

  return { fakeDocument, elements };
}

test('1. index.html contiene identificadores clave para títulos y etiquetas dinámicas', () => {
  assert.match(indexSource, /id="exec-carrier-purchase-title"/, 'Debe existir id="exec-carrier-purchase-title"');
  assert.match(indexSource, /id="exec-carrier-rate-unit-label"/, 'Debe existir id="exec-carrier-rate-unit-label"');
  assert.match(indexSource, /id="exec-buy-freight"/);
  assert.match(indexSource, /id="exec-sell-freight"/);
  assert.match(indexSource, /id="exec-charterer-profit"/);
});

test('2. Detección Geográfica de Rutas en Estados Unidos (isUSRoute)', () => {
  assert.equal(isUSLocation('Houston, TX, United States'), true);
  assert.equal(isUSLocation('Chicago, USA'), true);
  assert.equal(isUSLocation('Miami, Florida, Estados Unidos'), true);
  assert.equal(isUSLocation('Madrid, España'), false);
  assert.equal(isUSLocation('Rotterdam, Netherlands'), false);

  assert.equal(detectUnitSystem('Houston, TX', 'Dallas, TX'), 'IMPERIAL');
  assert.equal(detectUnitSystem('Madrid', 'Barcelona'), 'METRIC');
});

test('3. Ruta en Estados Unidos inyecta $ y mi dinámicamente en LADO DEL TRANSPORTISTA y LADO DE LA AGENCIA', () => {
  const engine = loadVoyageCostEngine(scriptSource);
  const { fakeDocument, elements } = createMockDashboardDOM();

  engine.updateExecutiveDashboard({
    pol: 'New York, USA',
    pod: 'Chicago, United States',
    mode: 'terrestre',
    modeNarrative: 'terrestre',
    totalKm: 1200,
    drivingHours: 14,
    buyFreight: 1.62,
    buyFreightTotal: 74844,
    sellFreight: 1.95,
    sellFreightTotal: 82404,
    chartererProfit: 7560,
    cargoQty: 24,
    agencyMargin: 10,
    tce: 74844,
  }, { polCountry: 'US', podCountry: 'USA' }, fakeDocument);

  // 1. Títulos y etiquetas de sección
  assert.equal(elements.get('exec-carrier-purchase-title').textContent, 'Tarifa Cerrada de Compra ($)');
  assert.equal(elements.get('exec-carrier-rate-unit-label').textContent, 'Tarifa/mi:');

  // 2. Lado Transportista: tasas en $/mi y totales en $
  assert.match(elements.get('exec-buy-freight').textContent, /1\.62\s*\$\/mi/);
  assert.match(elements.get('exec-buy-freight-total').textContent, /74\.844\s*\$/);
  assert.match(elements.get('exec-carrier-sell-freight').textContent, /1\.95\s*\$\/mi/);
  assert.match(elements.get('exec-carrier-sell-total').textContent, /82\.404\s*\$/);
  assert.match(elements.get('exec-tce').textContent, /74\.844\s*\$/);
  assert.match(elements.get('exec-carrier-margin-km').textContent, /\$\/mi/);

  // 3. Lado Agencia: flete de coste asociado, venta, spread y beneficio en $ y $/mi
  assert.match(elements.get('exec-sell-freight').textContent, /1\.95\s*\$\/mi/);
  assert.match(elements.get('exec-sell-freight-total').textContent, /82\.404\s*\$/);
  assert.match(elements.get('exec-agency-cost-freight').textContent, /1\.62\s*\$\/mi/);
  assert.match(elements.get('exec-agency-cost-total').textContent, /74\.844\s*\$/);
  assert.match(elements.get('exec-charterer-profit').textContent, /\+7\.?560\s*\$/);
  assert.match(elements.get('exec-spread-mt').textContent, /0\.33\s*\$\/mi/);
  assert.match(elements.get('exec-agency-spread-total').textContent, /7\.?560\s*\$/);
});

test('4. Ruta en Europa/Resto del Mundo mantiene € y km dinámicamente', () => {
  const engine = loadVoyageCostEngine(scriptSource);
  const { fakeDocument, elements } = createMockDashboardDOM();

  engine.updateExecutiveDashboard({
    pol: 'Madrid, España',
    pod: 'Valencia, España',
    mode: 'terrestre',
    modeNarrative: 'terrestre',
    totalKm: 350,
    drivingHours: 4.5,
    buyFreight: 1.35,
    buyFreightTotal: 473,
    sellFreight: 1.75,
    sellFreightTotal: 613,
    chartererProfit: 140,
    cargoQty: 24,
    agencyMargin: 10,
    tce: 180,
  }, { polCountry: 'ES', podCountry: 'ES' }, fakeDocument);

  // 1. Títulos y etiquetas de sección
  assert.equal(elements.get('exec-carrier-purchase-title').textContent, 'Tarifa Cerrada de Compra (€)');
  assert.equal(elements.get('exec-carrier-rate-unit-label').textContent, 'Tarifa/km:');

  // 2. Lado Transportista: tasas en €/km y totales en €
  assert.match(elements.get('exec-buy-freight').textContent, /1\.35\s*€\/km/);
  assert.match(elements.get('exec-buy-freight-total').textContent, /473\s*€/);
  assert.match(elements.get('exec-carrier-sell-freight').textContent, /1\.75\s*€\/km/);
  assert.match(elements.get('exec-carrier-sell-total').textContent, /613\s*€/);
  assert.match(elements.get('exec-tce').textContent, /180\s*€/);
  assert.match(elements.get('exec-carrier-margin-km').textContent, /€\/km/);

  // 3. Lado Agencia: flete de coste asociado, venta, spread y beneficio en € y €/km
  assert.match(elements.get('exec-sell-freight').textContent, /1\.75\s*€\/km/);
  assert.match(elements.get('exec-sell-freight-total').textContent, /613\s*€/);
  assert.match(elements.get('exec-agency-cost-freight').textContent, /1\.35\s*€\/km/);
  assert.match(elements.get('exec-agency-cost-total').textContent, /473\s*€/);
  assert.match(elements.get('exec-charterer-profit').textContent, /\+140\s*€/);
  assert.match(elements.get('exec-spread-mt').textContent, /0\.40\s*€\/km/);
  assert.match(elements.get('exec-agency-spread-total').textContent, /140\s*€/);
});

test('5. Detección por país seleccionado en API (EE.UU. / US / USA) activa modo $ y mi', () => {
  const engine = loadVoyageCostEngine(scriptSource);
  const { fakeDocument, elements } = createMockDashboardDOM();

  engine.updateExecutiveDashboard({
    pol: 'Terminal A',
    pod: 'Terminal B',
    mode: 'terrestre',
    modeNarrative: 'terrestre',
    totalKm: 500,
    buyFreight: 2.0,
    buyFreightTotal: 1000,
    sellFreight: 2.5,
    sellFreightTotal: 1250,
    chartererProfit: 250,
    cargoQty: 20,
    tce: 1000,
  }, { polCountry: 'EE.UU.', podCountry: 'US' }, fakeDocument);

  assert.equal(elements.get('exec-carrier-purchase-title').textContent, 'Tarifa Cerrada de Compra ($)');
  assert.equal(elements.get('exec-carrier-rate-unit-label').textContent, 'Tarifa/mi:');
  assert.match(elements.get('exec-buy-freight').textContent, /2\.00\s*\$\/mi/);
  assert.match(elements.get('exec-charterer-profit').textContent, /\+250\s*\$/);
});
