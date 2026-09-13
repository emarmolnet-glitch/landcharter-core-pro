import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const indexHtmlPath = resolve('index.html');
const voyageCostEnginePath = resolve('voyage-cost-engine.js');
const tceWorkspacePath = resolve('TceCalculatorWorkspace.tsx');

test('1. Executive Dashboard in index.html displays road transport labels and units', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Label: "Resumen de Carga y Tiempos" instead of "Resumen de Mercancía y Ritmos"
  assert.match(indexSource, /Resumen de Carga y Tiempos/);
  assert.doesNotMatch(indexSource, /Resumen de Mercancía y Ritmos/);

  // Label: "Ratio Carga / Descarga" reflecting pallets/h or t/h
  assert.match(indexSource, /Ratio Carga \/ Descarga/);
  assert.match(indexSource, /pallets\/h o t\/h/);
  assert.doesNotMatch(indexSource, /Ritmo Carga: <strong[^>]*>0<\/strong> MT\/día/);
  assert.doesNotMatch(indexSource, /Ritmo Desc\.:/);

  // Section: "Vehículo y Tiempos de Ruta" with "Conducción" and "Descanso"
  assert.match(indexSource, /Vehículo y Tiempos de Ruta/);
  assert.doesNotMatch(indexSource, /Buque y Duración Operativa/);
  assert.match(indexSource, /Conducción:\s*<strong[^>]*id="exec-sea-days"/);
  assert.match(indexSource, /Descanso:\s*<strong[^>]*id="exec-port-days"/);

  // Currency & units: € and €/km or €/t instead of $ and MT
  assert.match(indexSource, /<span[^>]*id="exec-buy-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /<span[^>]*id="exec-tce"[^>]*>0\s*€<\/span>/);
  assert.match(indexSource, /<span[^>]*id="exec-sell-freight"[^>]*>0\.00\s*€\/km<\/span>/);
  assert.match(indexSource, /<span[^>]*id="exec-charterer-profit"[^>]*>0\s*€<\/span>/);
  assert.match(indexSource, /<strong[^>]*id="exec-cargo-qty"[^>]*>0\s*t<\/strong>/);
  assert.doesNotMatch(indexSource, /<strong[^>]*id="exec-cargo-qty"[^>]*>0\s*MT<\/strong>/);
  assert.doesNotMatch(indexSource, /<span[^>]*id="exec-buy-freight"[^>]*>\$0\.00\s*\/Km<\/span>/);
  assert.doesNotMatch(indexSource, /<span[^>]*id="exec-sell-freight"[^>]*>\$0\.00\s*\/Km<\/span>/);
});

test('2. Module 2 crane inputs are permanently hidden and disabled for road transport', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // HTML containers for cranes are hidden
  assert.match(indexSource, /id="contenedor-gruas-pol"[^>]*class="[^"]*hidden[^"]*"[^>]*style="[^"]*display:\s*none;?[^"]*"/);
  assert.match(indexSource, /id="contenedor-gruas-pod"[^>]*class="[^"]*hidden[^"]*"[^>]*style="[^"]*display:\s*none;?[^"]*"/);

  // Inputs are not required
  assert.doesNotMatch(indexSource, /id="ritmo_nominal_pol"[^>]*required/);
  assert.doesNotMatch(indexSource, /id="ritmo_nominal_pod"[^>]*required/);

  // Function actualizarCampoGruasPuerto keeps them hidden and disabled
  assert.match(indexSource, /function actualizarCampoGruasPuerto\([^)]*\)\s*\{[\s\S]*?container\.classList\.add\('hidden'\);[\s\S]*?container\.style\.display\s*=\s*'none';[\s\S]*?input\.required\s*=\s*false;[\s\S]*?input\.disabled\s*=\s*true;/);
});

test('3. voyage-cost-engine formats executive dashboard metrics with EUR, €/km, t, and road vehicle', async () => {
  const scriptSource = await readFile(voyageCostEnginePath, 'utf8');

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
    ['exec-buy-freight', { textContent: '' }],
    ['exec-tce', { textContent: '' }],
    ['exec-sell-freight', { textContent: '' }],
    ['exec-charterer-profit', { textContent: '' }],
    ['exec-spread-mt', { textContent: '' }],
    ['exec-risk-level', { textContent: '', style: {} }],
    ['exec-insight-text', { textContent: '' }],
  ]);

  const fakeDocument = {
    getElementById: (id) => elements.get(id) || null,
  };

  const sandbox = {
    window: {},
    document: fakeDocument,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptSource, sandbox);

  const engine = sandbox.window.SeaCharterVoyageCostEngine;
  assert.ok(engine, 'Engine must be exported');

  // Test empty state
  engine.updateExecutiveDashboard({ forceEmpty: true }, {}, fakeDocument);
  assert.match(elements.get('exec-cargo-qty').textContent, /^0\s*t$/);
  assert.match(elements.get('exec-buy-freight').textContent, /0\.00\s*€\/km/);
  assert.match(elements.get('exec-sell-freight').textContent, /0\.00\s*€\/km/);
  assert.match(elements.get('exec-charterer-profit').textContent, /0\s*€/);
  assert.match(elements.get('exec-spread-mt').textContent, /0[.,]00\s*€\s*\/\s*km/);

  // Test populated state
  engine.updateExecutiveDashboard({
    pol: 'Madrid',
    pod: 'Valencia',
    cargoQty: 24,
    cargoType: 'Paletizado General',
    loadRate: 25,
    dischargeRate: 25,
    vesselType: 'Trailer Tauliner',
    seaDays: 0.5,
    portDays: 0.2,
    totalDays: 0.7,
    buyFreight: 1.25,
    sellFreight: 1.65,
    totalProfit: 140,
    chartererProfit: 140,
    tce: 200,
  }, { riskLevel: 'BAJO' }, fakeDocument);

  assert.match(elements.get('exec-cargo-qty').textContent, /^24\s*t$/);
  assert.match(elements.get('exec-buy-freight').textContent, /1\.25\s*€\/km/);
  assert.match(elements.get('exec-sell-freight').textContent, /1\.65\s*€\/km/);
  assert.match(elements.get('exec-charterer-profit').textContent, /140\s*€/);
  assert.match(elements.get('exec-spread-mt').textContent, /0[.,]40\s*€\s*\/\s*km/);
  assert.equal(elements.get('exec-vessel-type').textContent, 'Trailer Tauliner');
});

test('4. TceCalculatorWorkspace formats pricing and outputs with EUR and road transport units', async () => {
  const tceSource = await readFile(tceWorkspacePath, 'utf8');

  // Formatter uses EUR
  assert.match(tceSource, /currency:\s*'EUR'/);
  assert.doesNotMatch(tceSource, /currency:\s*'USD'/);

  // Labels and suffixes
  assert.match(tceSource, /label:\s*'Conducción'/);
  assert.match(tceSource, /label:\s*'Descanso'/);
  assert.match(tceSource, /suffix:\s*'€'/);
  assert.match(tceSource, /suffix:\s*'€\/día'/);
  assert.match(tceSource, /suffix:\s*'€\/t'/);

  // Freight rate displays
  assert.match(tceSource, /€ \/ t/);
  assert.match(tceSource, /€ \/ Día/);
  assert.match(tceSource, /Demurrage \(€\/d\)/);
  assert.doesNotMatch(tceSource, /Demurrage \(\$\/d\)/);
  assert.doesNotMatch(tceSource, /USD \/ MT/);
});

test('5. Executive Insight Comercial scales fleet (trucks_needed) and calculates unit operational hours for road transport', async () => {
  const scriptSource = await readFile(voyageCostEnginePath, 'utf8');
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
    ['exec-buy-freight', { textContent: '' }],
    ['exec-tce', { textContent: '' }],
    ['exec-sell-freight', { textContent: '' }],
    ['exec-charterer-profit', { textContent: '' }],
    ['exec-spread-mt', { textContent: '' }],
    ['exec-risk-level', { textContent: '', style: {} }],
    ['exec-insight-text', { textContent: '', style: {} }],
  ]);
  const fakeDoc = { getElementById: (id) => elements.get(id) || null };

  const sandbox = {
    window: {},
    document: fakeDoc,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptSource, sandbox);

  const engine = sandbox.window.SeaCharterVoyageCostEngine;
  assert.ok(engine, 'Engine must be exported');

  // Project cargo of 8000t with 24t payload per truck -> Math.ceil(8000 / 24) = 334 trucks
  // loadRate = 25 t/h, dischargeRate = 25 t/h -> 24 / 25 = ~1.0h unit time
  engine.updateExecutiveDashboard({
    pol: 'Madrid',
    pod: 'Valencia',
    cargoQty: 8000,
    cargoType: 'Carga de Proyecto',
    loadRate: 25,
    dischargeRate: 25,
    vesselType: 'Camión / Tráiler',
    vehiclePayload: 24,
    mode: 'terrestre',
    totalKm: 350,
  }, { riskLevel: 'BAJO' }, fakeDoc);

  const insightText = elements.get('exec-insight-text').textContent;

  // Verify the exact required fleet insight text template:
  assert.match(insightText, /Operación de flota: Se requieren ~334 vehículos para mover 8000t\./);
  assert.match(insightText, /Tiempo operativo unitario estimado: ~1h de carga y ~1h de descarga por vehículo\./);
  assert.match(insightText, /\(Total horas-hombre del proyecto: 334h\)\./);
  assert.match(insightText, /Ruta terrestre optimizada: cumplimiento de tacógrafo para 1 chófer, sin demoras aduaneras y sin restricciones ADR\./);

  // Confirm no multi-day sequential hours (no "320 días" or "7680 horas")
  assert.doesNotMatch(insightText, /días.*horas.*de carga en/i);
});

