import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const voyageCostEngineSource = await readFile(new URL('../voyage-cost-engine.js', import.meta.url), 'utf8');

function loadVoyageCostEngine(scriptSource) {
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
  vm.runInContext(scriptSource, sandbox);
  return sandbox.SeaCharterVoyageCostEngine || sandbox.window.SeaCharterVoyageCostEngine || {
    updateExecutiveDashboard: sandbox.updateExecutiveDashboard || sandbox.window.updateExecutiveDashboard,
  };
}

const engine = loadVoyageCostEngine(voyageCostEngineSource);

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
  };

  return { fakeDocument, elements };
}

test('1. Interfaz Vista Ejecutiva: Panel Transportista refleja Coste de Compra oficial y Panel Agencia inyecta Margen Markup', () => {
  // Lado Transportista: Tarifa de Compra oficial
  assert.match(indexSource, /LADO DEL TRANSPORTISTA \/ CHÓFER/);
  assert.match(indexSource, /Tarifa Transportista \(Coste de Compra Agencia\)/);
  assert.match(indexSource, /id="exec-buy-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-buy-freight-total"[^>]*>0\s*€<\/strong>/);
  assert.match(indexSource, /Tarifa Cerrada de Compra \(€\)/);
  assert.match(indexSource, /id="exec-tce"[^>]*>0\s*€<\/span>/);

  // Lado Agencia: Margen de Agencia / Markup inyectado (10% por defecto)
  assert.match(indexSource, /LADO DE LA AGENCIA \/ CLIENTE \(NUESTRA CASA\)/);
  assert.match(indexSource, /id="exec-agency-margin"[^>]*value="10"/);
  assert.match(indexSource, /window\.setExecutiveAgencyMargin\(this\.value\)/);

  // Lado Agencia: Flete de Coste Asociado, Precio Cliente y Beneficio
  assert.match(indexSource, /id="exec-agency-cost-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-agency-cost-total"[^>]*>0\s*€<\/span>/);
  assert.match(indexSource, /id="exec-sell-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-sell-freight-total"[^>]*>0\s*€<\/strong>/);
  assert.match(indexSource, /id="exec-charterer-profit"[^>]*>0\s*€<\/span>/);
});

test('2. Lógica de Brokerage en voyage-cost-engine: Compra (191€) + Markup Agencia (10%) = Venta Cliente (~210€) y Beneficio Agencia (~19€)', () => {
  const { fakeDocument, elements } = createMockDashboardDOM();

  // Simulación trayecto terrestre: Compra carrier = 191€ (~1.79 €/km sobre 107 km)
  engine.updateExecutiveDashboard({
    pol: 'Madrid',
    pod: 'Toledo',
    mode: 'terrestre',
    modeNarrative: 'terrestre',
    totalKm: 107,
    drivingHours: 1.43,
    buyFreight: 1.785,
    buyFreightTotal: 191,
    sellFreight: 1.9635,
    sellFreightTotal: 210.1,
    chartererProfit: 19.1,
    totalTripCost: 191,
    totalRevenue: 210.1,
    agencyMargin: 10,
    cargoQty: 24,
    vehicleType: 'Camión / Tráiler',
  }, {}, fakeDocument);

  // 1. Lado Transportista: refleja tarifa de compra (191€)
  assert.match(elements.get('exec-buy-freight').textContent, /1\.7[89]\s*€\/km/);
  assert.match(elements.get('exec-buy-freight-total').textContent, /191\s*€/);

  // 2. Lado Agencia: Flete de Coste Asociado igual a tarifa de compra (191€)
  assert.match(elements.get('exec-agency-cost-freight').textContent, /1\.7[89]\s*€\/km/);
  assert.match(elements.get('exec-agency-cost-total').textContent, /191\s*€/);

  // 3. Lado Agencia: Precio Total del Viaje Cliente = 191€ + 10% = ~210€
  assert.match(elements.get('exec-sell-freight').textContent, /1\.96\s*€\/km/);
  assert.match(elements.get('exec-sell-freight-total').textContent, /210\s*€/);

  // 4. Beneficio Total Agencia = 210€ - 191€ = ~19€
  assert.match(elements.get('exec-charterer-profit').textContent, /19\s*€/);
  assert.match(elements.get('exec-agency-spread-total').textContent, /19\s*€/);
});

test('3. Fallback automático en voyage-cost-engine aplica coste transportista (187-191€) y markup 10% (~206-210€) si fletes no se introducen', () => {
  const { fakeDocument, elements } = createMockDashboardDOM();

  // 107 km sin fletes explícitos
  engine.updateExecutiveDashboard({
    pol: 'Madrid',
    pod: 'Toledo',
    mode: 'terrestre',
    modeNarrative: 'terrestre',
    totalKm: 107,
    cargoQty: 24,
    agencyMargin: 10,
  }, {}, fakeDocument);

  // Operativo base ~162.64€ -> Tarifa Transportista +15% = ~187€
  // Precio Cliente +10% = ~206€
  // Beneficio Agencia = ~19€
  const buyTotalText = elements.get('exec-buy-freight-total').textContent;
  const sellTotalText = elements.get('exec-sell-freight-total').textContent;
  const profitText = elements.get('exec-charterer-profit').textContent;

  const buyTotal = parseInt(buyTotalText.replace(/[^\d]/g, ''), 10);
  const sellTotal = parseInt(sellTotalText.replace(/[^\d]/g, ''), 10);
  const profit = parseInt(profitText.replace(/[^\d]/g, ''), 10);

  assert.ok(buyTotal >= 180 && buyTotal <= 195, `Coste de compra esperado entre 180 y 195€, obtenido ${buyTotal}€`);
  assert.ok(sellTotal >= 200 && sellTotal <= 215, `Precio de venta esperado entre 200 y 215€, obtenido ${sellTotal}€`);
  assert.equal(profit, sellTotal - buyTotal, `El beneficio debe ser exactamente la diferencia entre venta y compra (${profit} vs ${sellTotal - buyTotal})`);
});

test('4. Alineación con Modo Técnico Sección 8 en index.html', () => {
  // Verificación de variables en runEngine
  assert.match(indexSource, /const carrierMarkupPercent = marginOwner > 0 \? marginOwner : 15;/);
  assert.match(indexSource, /const defaultCarrierTariffUnit = unitaryTripCost \* \(1 \+ \(carrierMarkupPercent \/ 100\)\);/);
  assert.match(indexSource, /const defaultClientSaleUnit = carrierPurchaseUnit \* agencyMarkupMultiplier;/);
  assert.match(indexSource, /const agencyNetProfit = Math\.max\(0, clientSaleUnit - carrierPurchaseUnit\);/);

  // Sincronización en State
  assert.match(indexSource, /State\.carrierPurchaseTotal =/);
  assert.match(indexSource, /State\.clientSaleTotal =/);
  assert.match(indexSource, /State\.agencyProfit =/);
  assert.match(indexSource, /State\.marginCharterer =/);

  // Controlador de Margen Ejecutivo window.setExecutiveAgencyMargin sincroniza con margin-charterer
  assert.match(indexSource, /window\.setExecutiveAgencyMargin = function/);
  assert.match(indexSource, /marginChartererInput\.value = margin;/);
});
