import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const indexHtmlPath = new URL('../index.html', import.meta.url);
const voyageCostEnginePath = new URL('../voyage-cost-engine.js', import.meta.url);

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
    updateExecutiveDashboard: sandbox.updateExecutiveDashboard || sandbox.window.updateExecutiveDashboard
  };
}

test('1. Land Charter Executive View - index.html has symmetric Carrier and Agency commercial blocks', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Must contain the two cards
  assert.match(indexSource, /LADO DEL TRANSPORTISTA \/ CHÓFER/);
  assert.match(indexSource, /LADO DE LA AGENCIA \/ CLIENTE \(NUESTRA CASA\)/);

  // Carrier side: Breakdown of purchase/porte cost (per km and total) alongside carrier margin
  assert.match(indexSource, /id="exec-buy-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-buy-freight-total"[^>]*>0\s*€<\/strong>/);
  assert.match(indexSource, /id="exec-tce"[^>]*>0\s*€<\/span>/);
  assert.match(indexSource, /id="exec-carrier-margin-km"[^>]*>0\.00\s*€\/km<\/strong>/);

  // Carrier side: Reflects associated sell freight
  assert.match(indexSource, /id="exec-carrier-sell-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-carrier-sell-total"[^>]*>0\s*€<\/span>/);

  // Agency side: Shows customer sale price (per km and total)
  assert.match(indexSource, /id="exec-sell-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-sell-freight-total"[^>]*>0\s*€<\/strong>/);

  // Agency side: Shows associated cost freight (per km and total)
  assert.match(indexSource, /id="exec-agency-cost-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-agency-cost-total"[^>]*>0\s*€<\/span>/);

  // Agency side: Shows commercial spread (per km and total) and total agency profit
  assert.match(indexSource, /id="exec-spread-mt"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /id="exec-agency-spread-total"[^>]*>0\s*€<\/strong>/);
  assert.match(indexSource, /id="exec-charterer-profit"[^>]*>0\s*€<\/span>/);
});

test('2. voyage-cost-engine initializes all symmetric metrics to zero in empty state', async () => {
  const scriptSource = await readFile(voyageCostEnginePath, 'utf8');
  const engine = loadVoyageCostEngine(scriptSource);

  const elements = new Map([
    ['exec-pol', { textContent: '' }],
    ['exec-pod', { textContent: '' }],
    ['exec-operation-icon', { textContent: '' }],
    ['exec-operation-status', { textContent: '' }],
    ['exec-total-margin', { textContent: '' }],
    ['exec-cargo-qty', { textContent: '' }],
    ['exec-cargo-type', { textContent: '' }],
    ['exec-load-rate', { textContent: '' }],
    ['exec-disch-rate', { textContent: '' }],
    ['exec-vessel-type', { textContent: '' }],
    ['exec-sea-days', { textContent: '' }],
    ['exec-port-days', { textContent: '' }],
    ['exec-total-days', { textContent: '' }],
    // Carrier metrics
    ['exec-buy-freight', { textContent: '' }],
    ['exec-buy-freight-total', { textContent: '' }],
    ['exec-carrier-sell-freight', { textContent: '' }],
    ['exec-carrier-sell-total', { textContent: '' }],
    ['exec-tce', { textContent: '' }],
    ['exec-carrier-margin-km', { textContent: '' }],
    // Agency metrics
    ['exec-sell-freight', { textContent: '' }],
    ['exec-sell-freight-total', { textContent: '' }],
    ['exec-agency-cost-freight', { textContent: '' }],
    ['exec-agency-cost-total', { textContent: '' }],
    ['exec-charterer-profit', { textContent: '' }],
    ['exec-spread-mt', { textContent: '' }],
    ['exec-agency-spread-total', { textContent: '' }],
    // Risks
    ['exec-risk-level', { textContent: '', style: {} }],
    ['exec-insight-text', { textContent: '' }],
  ]);
  const fakeDoc = { getElementById: (id) => elements.get(id) || null };

  engine.updateExecutiveDashboard({ forceEmpty: true }, {}, fakeDoc);

  // Carrier side assertions
  assert.match(elements.get('exec-buy-freight').textContent, /0\.00\s*€\/km/);
  assert.match(elements.get('exec-buy-freight-total').textContent, /0\s*€/);
  assert.match(elements.get('exec-carrier-sell-freight').textContent, /0\.00\s*€\/km/);
  assert.match(elements.get('exec-carrier-sell-total').textContent, /0\s*€/);
  assert.match(elements.get('exec-tce').textContent, /0\s*€/);
  assert.match(elements.get('exec-carrier-margin-km').textContent, /0\.00\s*€\/km/);

  // Agency side assertions
  assert.match(elements.get('exec-sell-freight').textContent, /0\.00\s*€\/km/);
  assert.match(elements.get('exec-sell-freight-total').textContent, /0\s*€/);
  assert.match(elements.get('exec-agency-cost-freight').textContent, /0\.00\s*€\/km/);
  assert.match(elements.get('exec-agency-cost-total').textContent, /0\s*€/);
  assert.match(elements.get('exec-charterer-profit').textContent, /0\s*€/);
  assert.match(elements.get('exec-spread-mt').textContent, /0[.,]00\s*€\s*\/\s*km/);
  assert.match(elements.get('exec-agency-spread-total').textContent, /0\s*€/);
});

test('3. voyage-cost-engine populates symmetric carrier and agency metrics with full commercial breakdown', async () => {
  const scriptSource = await readFile(voyageCostEnginePath, 'utf8');
  const engine = loadVoyageCostEngine(scriptSource);

  const elements = new Map([
    ['exec-pol', { textContent: '' }],
    ['exec-pod', { textContent: '' }],
    ['exec-operation-icon', { textContent: '' }],
    ['exec-operation-status', { textContent: '' }],
    ['exec-total-margin', { textContent: '' }],
    ['exec-cargo-qty', { textContent: '' }],
    ['exec-cargo-type', { textContent: '' }],
    ['exec-load-rate', { textContent: '' }],
    ['exec-disch-rate', { textContent: '' }],
    ['exec-vessel-type', { textContent: '' }],
    ['exec-sea-days', { textContent: '' }],
    ['exec-port-days', { textContent: '' }],
    ['exec-total-days', { textContent: '' }],
    // Carrier metrics
    ['exec-buy-freight', { textContent: '' }],
    ['exec-buy-freight-total', { textContent: '' }],
    ['exec-carrier-sell-freight', { textContent: '' }],
    ['exec-carrier-sell-total', { textContent: '' }],
    ['exec-tce', { textContent: '' }],
    ['exec-carrier-margin-km', { textContent: '' }],
    // Agency metrics
    ['exec-sell-freight', { textContent: '' }],
    ['exec-sell-freight-total', { textContent: '' }],
    ['exec-agency-cost-freight', { textContent: '' }],
    ['exec-agency-cost-total', { textContent: '' }],
    ['exec-charterer-profit', { textContent: '' }],
    ['exec-spread-mt', { textContent: '' }],
    ['exec-agency-spread-total', { textContent: '' }],
    // Risks
    ['exec-risk-level', { textContent: '', style: {} }],
    ['exec-insight-text', { textContent: '' }],
  ]);
  const fakeDoc = { getElementById: (id) => elements.get(id) || null };

  // Madrid to Valencia: 350 km, Buy 1.35 €/km (Total 472.50 €), Sell 1.75 €/km (Total 612.50 €), Spread 0.40 €/km (Total 140 €), Carrier margin 180 €
  engine.updateExecutiveDashboard({
    pol: 'Madrid',
    pod: 'Valencia',
    cargoQty: 24,
    cargoType: 'Paletizado General',
    loadRate: 25,
    dischargeRate: 25,
    vesselType: 'Camión / Tráiler',
    totalKm: 350,
    drivingHours: 4.67,
    buyFreight: 1.35,
    sellFreight: 1.75,
    totalTripCost: 472.5,
    totalRevenue: 612.5,
    totalProfit: 140,
    chartererProfit: 140,
    tce: 180,
  }, { riskLevel: 'BAJO' }, fakeDoc);

  // Carrier side: Purchase cost (1.35 €/km and ~473 € total), Carrier Margin (180 € and 0.51 €/km), Associated Sell (1.75 €/km and ~613 € total)
  assert.match(elements.get('exec-buy-freight').textContent, /1\.35\s*€\/km/);
  assert.match(elements.get('exec-buy-freight-total').textContent, /(472|473)\s*€/);
  assert.match(elements.get('exec-carrier-sell-freight').textContent, /1\.75\s*€\/km/);
  assert.match(elements.get('exec-carrier-sell-total').textContent, /(612|613)\s*€/);
  assert.match(elements.get('exec-tce').textContent, /180\s*€/);
  assert.match(elements.get('exec-carrier-margin-km').textContent, /0\.51\s*€\/km/);

  // Agency side: Sale price (1.75 €/km and ~613 € total), Associated Cost (1.35 €/km and ~473 € total), Spread (0.40 €/km and 140 € total), Total Agency Profit (140 €)
  assert.match(elements.get('exec-sell-freight').textContent, /1\.75\s*€\/km/);
  assert.match(elements.get('exec-sell-freight-total').textContent, /(612|613)\s*€/);
  assert.match(elements.get('exec-agency-cost-freight').textContent, /1\.35\s*€\/km/);
  assert.match(elements.get('exec-agency-cost-total').textContent, /(472|473)\s*€/);
  assert.match(elements.get('exec-charterer-profit').textContent, /140\s*€/);
  assert.match(elements.get('exec-spread-mt').textContent, /0[.,]40\s*€\s*\/\s*km/);
  assert.match(elements.get('exec-agency-spread-total').textContent, /140\s*€/);
});

test('4. Commercial symmetry check: Carrier purchase cost equals Agency associated cost freight, and Agency selling price equals Carrier associated selling freight', async () => {
  const scriptSource = await readFile(voyageCostEnginePath, 'utf8');
  const engine = loadVoyageCostEngine(scriptSource);

  const elements = new Map([
    ['exec-pol', { textContent: '' }],
    ['exec-pod', { textContent: '' }],
    ['exec-operation-icon', { textContent: '' }],
    ['exec-operation-status', { textContent: '' }],
    ['exec-total-margin', { textContent: '' }],
    ['exec-cargo-qty', { textContent: '' }],
    ['exec-cargo-type', { textContent: '' }],
    ['exec-load-rate', { textContent: '' }],
    ['exec-disch-rate', { textContent: '' }],
    ['exec-vessel-type', { textContent: '' }],
    ['exec-sea-days', { textContent: '' }],
    ['exec-port-days', { textContent: '' }],
    ['exec-total-days', { textContent: '' }],
    // Carrier metrics
    ['exec-buy-freight', { textContent: '' }],
    ['exec-buy-freight-total', { textContent: '' }],
    ['exec-carrier-sell-freight', { textContent: '' }],
    ['exec-carrier-sell-total', { textContent: '' }],
    ['exec-tce', { textContent: '' }],
    ['exec-carrier-margin-km', { textContent: '' }],
    // Agency metrics
    ['exec-sell-freight', { textContent: '' }],
    ['exec-sell-freight-total', { textContent: '' }],
    ['exec-agency-cost-freight', { textContent: '' }],
    ['exec-agency-cost-total', { textContent: '' }],
    ['exec-charterer-profit', { textContent: '' }],
    ['exec-spread-mt', { textContent: '' }],
    ['exec-agency-spread-total', { textContent: '' }],
    // Risks
    ['exec-risk-level', { textContent: '', style: {} }],
    ['exec-insight-text', { textContent: '' }],
  ]);
  const fakeDoc = { getElementById: (id) => elements.get(id) || null };

  engine.updateExecutiveDashboard({
    pol: 'Sevilla',
    pod: 'Zaragoza',
    cargoQty: 24,
    cargoType: 'Carga Seca',
    loadRate: 20,
    dischargeRate: 20,
    vesselType: 'Camión / Tráiler',
    totalKm: 800,
    buyFreight: 1.40,
    sellFreight: 1.85,
    buyFreightTotal: 1120,
    sellFreightTotal: 1480,
    totalProfit: 360,
    chartererProfit: 360,
    tce: 250,
  }, { riskLevel: 'MODERADO' }, fakeDoc);

  // Symmetry 1: Carrier buy rate === Agency associated cost rate
  assert.equal(
    elements.get('exec-buy-freight').textContent,
    elements.get('exec-agency-cost-freight').textContent
  );

  // Symmetry 2: Carrier buy total === Agency associated cost total
  assert.equal(
    elements.get('exec-buy-freight-total').textContent,
    elements.get('exec-agency-cost-total').textContent
  );

  // Symmetry 3: Agency sell rate === Carrier associated sell rate
  assert.equal(
    elements.get('exec-sell-freight').textContent,
    elements.get('exec-carrier-sell-freight').textContent
  );

  // Symmetry 4: Agency sell total === Carrier associated sell total
  assert.equal(
    elements.get('exec-sell-freight-total').textContent,
    elements.get('exec-carrier-sell-total').textContent
  );
});
