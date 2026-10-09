import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  isUSLocation,
  isEuropeanLocation,
  isEuropeanRoute,
  detectCurrencyAndUnit,
  updateTechnicalWorkspaceUI,
  getUnitLabels
} from '../src/utils/unitSystemDetector.mjs';

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
    querySelectorAll: () => Array.from(elements.values()),
  };

  return { fakeDocument, elements };
}

test('1. Lógica Geográfica Universal: Europa (€/km), EE. UU. ($/mi) y Resto del Mundo ($/km)', () => {
  // A. Rutas estrictamente europeas -> Moneda € y distancia km
  const euRoute1 = detectCurrencyAndUnit('Madrid, España', 'París, Francia', 'ES', 'FR');
  assert.equal(euRoute1.currency, '€');
  assert.equal(euRoute1.unit, 'km');
  assert.equal(euRoute1.isEuropeanRoute, true);
  assert.equal(euRoute1.isUSRoute, false);

  const euRoute2 = detectCurrencyAndUnit('Berlin, Germany', 'Warsaw, Poland', 'DE', 'PL');
  assert.equal(euRoute2.currency, '€');
  assert.equal(euRoute2.unit, 'km');

  // B. Rutas en Estados Unidos -> Moneda $ y distancia mi
  const usRoute = detectCurrencyAndUnit('Chicago, IL', 'Dallas, TX', 'US', 'US');
  assert.equal(usRoute.currency, '$');
  assert.equal(usRoute.unit, 'mi');
  assert.equal(usRoute.isEuropeanRoute, false);
  assert.equal(usRoute.isUSRoute, true);

  // C. Rutas en Resto del Mundo (fuera de Europa y no US) -> Moneda $ y distancia km
  const nonEuRoute1 = detectCurrencyAndUnit('Argel, Argelia', 'Sétif, Argelia', 'DZ', 'DZ');
  assert.equal(nonEuRoute1.currency, '$');
  assert.equal(nonEuRoute1.unit, 'km');
  assert.equal(nonEuRoute1.isEuropeanRoute, false);
  assert.equal(nonEuRoute1.isUSRoute, false);

  const nonEuRoute2 = detectCurrencyAndUnit('Casablanca, Marruecos', 'Tánger, Marruecos', 'MA', 'MA');
  assert.equal(nonEuRoute2.currency, '$');
  assert.equal(nonEuRoute2.unit, 'km');

  // D. Ruta mixta Europa / Resto del Mundo -> Si involucra fuera de Europa, pasa a $ y km
  const mixedRoute = detectCurrencyAndUnit('Valencia, España', 'Casablanca, Marruecos', 'ES', 'MA');
  assert.equal(mixedRoute.currency, '$');
  assert.equal(mixedRoute.unit, 'km');

  // E. Estado inicial por defecto (vacío) -> Europa: € y km
  const defaultRoute = detectCurrencyAndUnit('', '', '', '');
  assert.equal(defaultRoute.currency, '€');
  assert.equal(defaultRoute.unit, 'km');
});

test('2. updateTechnicalWorkspaceUI adapta dinámicamente Secciones 3, 4, 5 y 6 del Modo Técnico', () => {
  const dom = createMockDashboardDOM();
  const globalDoc = globalThis.document;
  globalThis.document = dom.fakeDocument;

  try {
    // Simular llamada con dólares y millas ($ y mi)
    updateTechnicalWorkspaceUI('$', 'mi', true);

    // Sección 3: Estructura de Costes
    assert.equal(dom.elements.get('label-price-diesel').textContent, 'PRECIO DIÉSEL ($/L)');
    assert.equal(dom.elements.get('price-sea').placeholder, '$/L');
    assert.equal(dom.elements.get('label-price-adblue').textContent, 'PRECIO ADBLUE ($/L)');
    assert.equal(dom.elements.get('price-ifo').placeholder, '$/L');
    assert.equal(dom.elements.get('label-pda-pol').textContent, 'Peajes ($)');
    assert.equal(dom.elements.get('label-pda-pod').textContent, 'Dietas / Pernocta Chófer ($)');

    // Sección 5: Simulador de Negociación y Spread
    assert.equal(dom.elements.get('negotiation-owner-currency-symbol').textContent, '$');
    assert.equal(dom.elements.get('negotiation-owner-unit-label').textContent, '/mi');
    assert.equal(dom.elements.get('negotiation-charterer-currency-symbol').textContent, '$');
    assert.equal(dom.elements.get('negotiation-charterer-unit-label').textContent, '/mi');

    // Sección 6: Comercial y Auditoría Financiera
    assert.equal(dom.elements.get('cost-plus-box-title').textContent, 'COSTE POR MI Y PRECIO TOTAL DEL VIAJE (COST-PLUS)');
    assert.equal(dom.elements.get('label-demurrage-rate').textContent, 'PARALIZACIONES ($/H)');
    assert.equal(dom.elements.get('label-buying-freight').textContent, 'Coste Compra Transportista (Precio por Tonelada - $/ton)');
    assert.equal(dom.elements.get('label-selling-freight').textContent, 'Precio Venta Cliente (Precio por Tonelada - $/ton)');
  } finally {
    globalThis.document = globalDoc;
  }
});

test('3. Modo Técnico en index.html incluye los identificadores y funciones de propagación', () => {
  assert.match(indexSource, /id="negotiation-owner-currency-symbol"/);
  assert.match(indexSource, /id="negotiation-owner-unit-label"/);
  assert.match(indexSource, /id="negotiation-charterer-currency-symbol"/);
  assert.match(indexSource, /id="negotiation-charterer-unit-label"/);
  assert.match(indexSource, /updateTechnicalWorkspaceUI/);
  assert.match(indexSource, /window\.LandCharterCurrency/);
  assert.match(indexSource, /window\.LandCharterUnit/);
});

test('4. Ruta fuera de Europa (ej. Argelia) aplica divisa $ y distancia km en la Vista Ejecutiva y Modo Técnico', () => {
  const engine = loadVoyageCostEngine(scriptSource);
  const { fakeDocument, elements } = createMockDashboardDOM();

  engine.updateExecutiveDashboard({
    pol: 'Argel, Argelia',
    pod: 'Sétif, Argelia',
    mode: 'terrestre',
    modeNarrative: 'terrestre',
    totalKm: 300,
    drivingHours: 4,
    buyFreight: 1.50,
    buyFreightTotal: 450,
    sellFreight: 1.90,
    sellFreightTotal: 570,
    chartererProfit: 120,
    cargoQty: 24,
    agencyMargin: 10,
    tce: 450,
  }, { polCountry: 'DZ', podCountry: 'DZ' }, fakeDocument);

  // Título de compra refleja moneda $
  assert.equal(elements.get('exec-carrier-purchase-title').textContent, 'Tarifa Cerrada de Compra ($)');
  // Etiqueta de distancia se mantiene en km porque NO es EE.UU.
  assert.equal(elements.get('exec-carrier-rate-unit-label').textContent, 'Tarifa/km:');

  // Lado transportista y agencia en $/km y totales en $
  assert.match(elements.get('exec-buy-freight').textContent, /1\.50\s*\$\/km/);
  assert.match(elements.get('exec-buy-freight-total').textContent, /450\s*\$/);
  assert.match(elements.get('exec-sell-freight').textContent, /1\.90\s*\$\/km/);
  assert.match(elements.get('exec-sell-freight-total').textContent, /570\s*\$/);
  assert.match(elements.get('exec-charterer-profit').textContent, /\+120\s*\$/);
});
